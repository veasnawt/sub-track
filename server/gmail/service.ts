import crypto from 'node:crypto';
import { db } from '../db';
import { JWT_SECRET } from '../middleware/auth';
import { gmailSchema } from './schema';
import { messageText, parseEvidence, type Evidence } from './parser';

export function configured() { return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.APP_URL); }
export function appURL() {
  const url=new URL(process.env.APP_URL!);
  if(url.protocol!=='https:' && url.hostname!=='localhost') throw new Error('APP_URL must use HTTPS');
  return url.origin;
}
export const hash=(s:string)=>crypto.createHash('sha256').update(s).digest('hex');
const key=crypto.scryptSync(JWT_SECRET,'subtrack:gmail:tokens:v1',32);
export function encrypt(s:string) { const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([c.update(s,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),data]).toString('base64url'); }
export function decrypt(s:string) { const raw=Buffer.from(s,'base64url'),c=crypto.createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));c.setAuthTag(raw.subarray(12,28));return Buffer.concat([c.update(raw.subarray(28)),c.final()]).toString('utf8'); }
let ready:Promise<void>|undefined;
export function ensureSchema() { if(!ready) ready=(async()=>{await db.transaction(async()=>{for(const sql of gmailSchema.split(';').filter(x=>x.trim())) await db.prepare(sql).run();})();})().catch(e=>{ready=undefined;throw e;});return ready; }
export async function googleJSON(url:string, options:RequestInit) {
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
  const value=await response.json() as any;
  if(!response.ok) { const e=new Error(response.status===400||response.status===401?'Reconnect Gmail to restore access.':'Gmail request failed; try again later.');(e as any).status=502;throw e; }
  return value;
}
export async function tokens(params:Record<string,string>) {return googleJSON('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...params,client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!})});}
export async function gmail(path:string,access:string) { return googleJSON('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{headers:{Authorization:'Bearer '+access}}); }
export async function applyEvidence(userId:string,messageId:string,e:Evidence) {
  // Only an authenticated, explicit receipt/status notice may update an existing exact service.
  const subscriptions=await db.prepare('SELECT * FROM public.subtrack_subscriptions WHERE user_id = ? AND name = ?').all(userId,e.name);
  if(subscriptions.length!==1 || !e.trusted) return false;
  if(e.requires_approval && !await db.prepare('SELECT name FROM public.subtrack_gmail_senders WHERE user_id=? AND sender_key=? AND name=?').get(userId,e.sender_key,e.name)) return false;
  const s=subscriptions[0];
  if(e.kind==='receipt' && e.price!==undefined && e.amount!==undefined && e.start_date && e.payment_date && e.next_billing_date && e.billing_cycle===s.billing_cycle && e.next_billing_date>=s.next_billing_date && s.status==='active' && s.currency==='USD') {
    await db.prepare(`UPDATE public.subtrack_subscriptions SET price=?,next_billing_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`).run(e.price,e.next_billing_date,s.id,userId);
    await db.prepare(`INSERT INTO public.subtrack_payment_history (id,user_id,subscription_id,amount,currency,billing_date,payment_method,status) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).run('gmail-'+hash(userId+messageId),userId,s.id,e.amount,'USD',e.payment_date,s.payment_method,'paid');
    return true;
  }
  if(e.kind==='paused') {await db.prepare("UPDATE public.subtrack_subscriptions SET status='paused',updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").run(s.id,userId);return true;}
  // Cancellations stay in review: a historical notice must not cancel a newer plan.
  return false;
}
export async function syncUser(userId:string) {
  await ensureSchema();
  const now=new Date();
  const deadline=Date.now()+180000;
  const conn=await db.prepare(`UPDATE public.subtrack_gmail_connections SET sync_until=? WHERE user_id=? AND (sync_until IS NULL OR sync_until < ?) RETURNING *`).get(new Date(now.valueOf()+300000).toISOString(),userId,now.toISOString());
  if(!conn) return {busy:true,found:0,applied:0};
  let found=0,applied=0;
  try {
    const access=(await tokens({grant_type:'refresh_token',refresh_token:decrypt(conn.refresh_cipher)})).access_token;
    const from=conn.scan_from ? new Date(conn.scan_from) : conn.last_sync ? new Date(new Date(conn.last_sync).valueOf()-3*86400000):new Date(now.valueOf()-100*86400000);
    const query='after:'+Math.floor(from.valueOf()/1000)+' -in:trash -in:spam (subject:receipt OR subject:invoice OR subject:subscription OR subject:renewal OR subject:cancel OR subject:payment OR subject:paused)';
    let page=conn.scan_page||'';let pages=0;let incomplete=false;
    const scanStarted=conn.scan_started||now.toISOString();
    do {
      const list=await gmail('messages?'+new URLSearchParams({q:query,maxResults:'50',...(page?{pageToken:page}:{})}),access);
      const currentPage=page;
      for(const m of list.messages||[]) {
        if(Date.now()>deadline){incomplete=true;break;}
        if(await db.prepare('SELECT state FROM public.subtrack_gmail_events WHERE user_id=? AND message_id=?').get(userId,m.id))continue;
        const msg=await gmail('messages/'+encodeURIComponent(m.id)+'?format=full',access);
        const headers:Record<string,string>={};for(const h of msg.payload?.headers||[]) if(headers[h.name.toLowerCase()]===undefined) headers[h.name.toLowerCase()]=h.value;
        const evidence=parseEvidence(headers,messageText(msg.payload));
        const emailDate=new Date(Number(msg.internalDate)).toISOString();
        await db.transaction(async()=>{
          const claimed=await db.prepare('INSERT INTO public.subtrack_gmail_events (user_id,message_id,evidence,source_url,email_date,state) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,message_id) DO NOTHING').run(userId,m.id,JSON.stringify(evidence||{}),'https://mail.google.com/mail/u/0/#all/'+m.id,emailDate,evidence?'pending':'ignored');
          if(!claimed.changes||!evidence)return;
          found++;
          // Initial backfill is review-only. Do not replay historical status changes.
          if(conn.auto_sync && conn.last_sync && new Date(emailDate)>new Date(conn.last_sync) && await applyEvidence(userId,m.id,evidence)) {
            await db.prepare("UPDATE public.subtrack_gmail_events SET state='applied' WHERE user_id=? AND message_id=?").run(userId,m.id);applied++;
          }
        })();
      }
      page=incomplete?currentPage:(list.nextPageToken||'');pages++;
      if(incomplete)break;
    }while(page&&pages<4);
    // Never advance the watermark when results remain unprocessed.
    if(page||incomplete) await db.prepare("UPDATE public.subtrack_gmail_connections SET scan_page=?,scan_from=?,scan_started=?,last_error='More billing emails remain. Run Scan again to continue.' WHERE user_id=?").run(page,from.toISOString(),scanStarted,userId);
    else await db.prepare('UPDATE public.subtrack_gmail_connections SET last_sync=?,scan_page=NULL,scan_from=NULL,scan_started=NULL,last_error=NULL WHERE user_id=?').run(scanStarted,userId);
    return {found,applied,more:Boolean(page)||incomplete};
  }catch(e){await db.prepare("UPDATE public.subtrack_gmail_connections SET last_error='Sync failed. Reconnect Gmail if it continues.' WHERE user_id=?").run(userId);throw e;}
  finally{await db.prepare('UPDATE public.subtrack_gmail_connections SET sync_until=NULL WHERE user_id=?').run(userId);}
}
