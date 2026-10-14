import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth';
import { ImportSchema, importSubscription } from '../subscription-import';
import { configured,appURL,hash,encrypt,decrypt,ensureSchema,tokens,gmail,syncUser } from '../gmail/service';
const router=Router();
const scope='https://www.googleapis.com/auth/gmail.readonly';
const callback=()=>appURL()+'/api/gmail/callback';
function cookie(req:any,name:string){return (req.headers.cookie||'').split(';').map((s:string)=>s.trim()).find((s:string)=>s.startsWith(name+'='))?.slice(name.length+1)||'';}
router.get('/callback',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  if(!configured())return res.status(503).send('Gmail connection is not configured.');
  await ensureSchema();
  const state=typeof req.query.state==='string'?req.query.state:'';
  const nonce=cookie(req,'subtrack_gmail_nonce');
  if(!state||!nonce)return res.status(400).send('Connection expired. Start again from Settings.');
  const pending=await db.prepare('DELETE FROM public.subtrack_gmail_states WHERE hash=? AND nonce_hash=? AND expires_at>? RETURNING *').get(hash(state),hash(nonce),new Date().toISOString());
  res.clearCookie('subtrack_gmail_nonce',{path:'/api/gmail/callback',secure:appURL().startsWith('https:'),sameSite:'lax'});
  if(!pending)return res.status(400).send('Connection expired. Start again from Settings.');
  if(req.query.error || typeof req.query.code!=='string')return res.redirect(appURL()+'/?gmail=declined');
  try {
    const token=await tokens({grant_type:'authorization_code',code:req.query.code,redirect_uri:callback(),code_verifier:decrypt(pending.verifier_cipher)});
    if(!String(token.scope||'').split(' ').includes(scope)||!token.refresh_token)throw new Error('Missing Gmail permission.');
    const profile=await gmail('profile',token.access_token);
    const user=await db.prepare('SELECT email FROM public.subtrack_users WHERE id=?').get(pending.user_id);
    if(profile.emailAddress.toLowerCase()!==user.email.toLowerCase())return res.redirect(appURL()+'/?gmail=account-mismatch');
    await db.prepare(`INSERT INTO public.subtrack_gmail_connections (user_id,email,refresh_cipher) VALUES (?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET email=EXCLUDED.email,refresh_cipher=EXCLUDED.refresh_cipher,last_error=NULL`).run(pending.user_id,profile.emailAddress,encrypt(token.refresh_token));
    return res.redirect(appURL()+'/?gmail=connected');
  }catch{return res.redirect(appURL()+'/?gmail=failed');}
});
router.get('/cron',async(req,res)=>{
  const secret=process.env.CRON_SECRET;
  const supplied=req.headers.authorization||'';
  const expected='Bearer '+secret;
  if(!secret||secret.length<32||supplied.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return res.status(401).json({error:'Unauthorized'});
  if(!configured())return res.json({configured:false});
  await ensureSchema();
  const users=await db.prepare('SELECT user_id FROM public.subtrack_gmail_connections ORDER BY last_sync ASC NULLS FIRST LIMIT 10').all();
  const deadline=Date.now()+240000;
  let checked=0,failed=0;for(const u of users){if(Date.now()>deadline-180000)break;try{await syncUser(u.user_id);checked++;}catch{failed++;}}
  return res.json({checked,failed});
});
router.use(authMiddleware);
router.get('/status',async(req:AuthenticatedRequest,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!configured())return res.json({configured:false,connected:false,events:[]});
  await ensureSchema();
  const conn=await db.prepare('SELECT email,auto_sync,last_sync,last_error FROM public.subtrack_gmail_connections WHERE user_id=?').get(req.user!.userId);
  const events=await db.prepare("SELECT message_id,evidence,source_url,email_date,state FROM public.subtrack_gmail_events WHERE user_id=? AND state IN ('pending','applied') ORDER BY email_date DESC LIMIT 100").all(req.user!.userId);
  return res.json({configured:true,connected:Boolean(conn),...conn,events:events.map(e=>({...e,evidence:JSON.parse(e.evidence)}))});
});
router.use(async(_req,res,next)=>{if(!configured())return res.status(503).json({error:'Gmail setup is not finished yet.'});await ensureSchema();next();});
router.post('/connect',async(req:AuthenticatedRequest,res)=>{
  const state=crypto.randomBytes(32).toString('base64url'),nonce=crypto.randomBytes(32).toString('base64url'),verifier=crypto.randomBytes(32).toString('base64url');
  await db.prepare('DELETE FROM public.subtrack_gmail_states WHERE expires_at<?').run(new Date().toISOString());
  await db.prepare('INSERT INTO public.subtrack_gmail_states(hash,user_id,nonce_hash,verifier_cipher,expires_at) VALUES(?,?,?,?,?)').run(hash(state),req.user!.userId,hash(nonce),encrypt(verifier),new Date(Date.now()+600000).toISOString());
  res.cookie('subtrack_gmail_nonce',nonce,{httpOnly:true,secure:appURL().startsWith('https:'),sameSite:'lax',path:'/api/gmail/callback',maxAge:600000});
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID!,redirect_uri:callback(),response_type:'code',scope,access_type:'offline',prompt:'consent',state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',login_hint:req.user!.email}).toString();
  res.json({url:url.toString()});
});
router.post('/sync',async(req:AuthenticatedRequest,res)=>res.json(await syncUser(req.user!.userId)));
router.put('/preferences',async(req:AuthenticatedRequest,res)=>{
  const parsed=z.object({auto_sync:z.boolean()}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Invalid preference'});
  await db.prepare('UPDATE public.subtrack_gmail_connections SET auto_sync=? WHERE user_id=?').run(parsed.data.auto_sync,req.user!.userId);return res.json({success:true});
});
router.post('/disconnect',async(req:AuthenticatedRequest,res)=>{
  const c=await db.prepare('SELECT refresh_cipher FROM public.subtrack_gmail_connections WHERE user_id=?').get(req.user!.userId);
  // Local unlink always succeeds; Google's permissions page can also revoke the grant.
  if(c)try{await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:decrypt(c.refresh_cipher)}),signal:AbortSignal.timeout(10000)});}catch{}
  await db.transaction(async()=>{
    await db.prepare('DELETE FROM public.subtrack_gmail_connections WHERE user_id=?').run(req.user!.userId);
    await db.prepare('DELETE FROM public.subtrack_gmail_states WHERE user_id=?').run(req.user!.userId);
  })();return res.json({success:true});
});
router.post('/events/:id/dismiss',async(req:AuthenticatedRequest,res)=>{
  await db.prepare("UPDATE public.subtrack_gmail_events SET state='dismissed' WHERE user_id=? AND message_id=? AND state='pending'").run(req.user!.userId,req.params.id);return res.json({success:true});
});
router.post('/events/:id/approve',async(req:AuthenticatedRequest,res)=>{
  const parsed=ImportSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0].message});
  let done=false;
  await db.transaction(async()=>{
    const e=await db.prepare("SELECT * FROM public.subtrack_gmail_events WHERE user_id=? AND message_id=? AND state='pending' FOR UPDATE").get(req.user!.userId,req.params.id);
    if(!e)return;
    const s=parsed.data;
    const evidence=JSON.parse(e.evidence);
    if(evidence.trusted && evidence.sender_key) await db.prepare('INSERT INTO public.subtrack_gmail_senders(user_id,sender_key,name) VALUES(?,?,?) ON CONFLICT(user_id,sender_key) DO UPDATE SET name=EXCLUDED.name').run(req.user!.userId,evidence.sender_key,s.name);
    // Approving updates a unique existing service or creates it, never guesses which duplicate to overwrite.
    const matching=await db.prepare('SELECT id FROM public.subtrack_subscriptions WHERE user_id=? AND name=?').all(req.user!.userId,s.name);
    if(matching.length>1)throw new Error('Resolve duplicate services before approving.');
    if(matching.length===1){
      await db.prepare('UPDATE public.subtrack_subscriptions SET price=?,billing_cycle=?,next_billing_date=?,status=?,auto_renew=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').run(s.price,s.billing_cycle,s.next_billing_date,s.status,Number(Boolean(s.auto_renew)),s.notes,matching[0].id,req.user!.userId);
      if(s.initial_payment)await db.prepare('INSERT INTO public.subtrack_payment_history(id,user_id,subscription_id,amount,currency,billing_date,payment_method,status) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run('gmail-'+hash(req.user!.userId+req.params.id),req.user!.userId,matching[0].id,s.initial_payment.amount,s.currency,s.initial_payment.date,s.payment_method,s.initial_payment.status);
    }else await importSubscription(req.user!.userId,{...s,source_id:'gmail:'+req.params.id,notes:s.notes+'\nSource: '+e.source_url});
    await db.prepare("UPDATE public.subtrack_gmail_events SET state='applied' WHERE user_id=? AND message_id=?").run(req.user!.userId,req.params.id);done=true;
  })();return res.status(done?200:404).json({success:done});
});
export default router;
