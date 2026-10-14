import {createHash} from 'node:crypto';
// Deterministic extraction only: email content cannot execute instructions or call tools.
export interface Evidence {
  name: string; kind: 'receipt'|'paused'|'cancelled'|'review';
  sender_key?: string; requires_approval?: boolean; payment_date?: string; price?: number; amount?: number; start_date?: string; next_billing_date?: string;
  billing_cycle?: 'monthly'|'yearly'; status?: 'active'|'paused'|'cancelled';
  summary: string; trusted: boolean;
}
export function messageText(payload: any): string {
  function parts(p: any, type: string): string[] { return (p.mimeType === type && p.body?.data ? [Buffer.from(p.body.data,'base64url').toString('utf8')] : []).concat(...(p.parts||[]).map((x:any)=>parts(x,type))); }
  let text = parts(payload,'text/plain').join(' ');
  if (!text) text = parts(payload,'text/html').join(' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&');
  return text.replace(/\s+/g,' ').slice(0,100000);
}
const month = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const d = month + '\\s+\\d{1,2}(?:,?\\s+20\\d{2})?';
function date(value:string, year?:string) { const v=new Date(value + (/20\d{2}/.test(value)?'':', '+year) + ' UTC');return Number.isNaN(v.valueOf())?undefined:v.toISOString().slice(0,10); }
export function parseEvidence(headers: Record<string,string>, text: string): Evidence|null {
  const from = headers.from||'', subject=headers.subject||'';
  // Only Gmail's top Authentication-Results header may establish trust.
  const auth=headers['authentication-results']||'';
  const sender=from.match(/(?:<|\b)([A-Z0-9._%+-]+@[A-Z0-9.-]+)/i)?.[1]?.toLowerCase()||'';
  const domain=sender.split('@')[1]||'';
  const verified=auth.includes('mx.google.com;') && /\bdkim=pass\b/.test(auth) && /\bdmarc=pass\b/.test(auth);
  const known=[['ElevenLabs Starter','elevenlabs.io'],['Meshy Pro','meshy.ai'],['Claude Pro','anthropic.com'],['ChatGPT Plus','openai.com'],['Telegram Premium','apple.com'],['Railway Pro','railway.app']];
  let entry=known.find(([,v])=>domain===v||domain.endsWith('.'+v));
  if(domain==='stripe.com') {
    if(/receipt from Eleven Labs Inc\./i.test(subject+' '+text))entry=['ElevenLabs Starter','stripe.com'];
    if(/receipt from Meshy/i.test(subject+' '+text))entry=['Meshy Pro','stripe.com'];
  }
  if (/one.time|prepaid|extra usage|credit purchase|reset key/i.test(subject+' '+text)) return null;
  if (!/(receipt|invoice|subscri|renew|payment|paused|cancel)/i.test(subject)) return null;
  if (/(save \d|offer|discount|deal|newsletter)/i.test(subject) && !/receipt|invoice/i.test(subject)) return null;
  let name=entry?.[0]||'Unrecognized service';
  if (domain==='apple.com' && !/Telegram Premium/i.test(text)) name='Apple subscription — review service';
  const trusted=Boolean(entry)&&verified;
  const identity={sender_key:createHash('sha256').update(sender).digest('hex'),requires_approval:domain==='stripe.com'};
  if (name==='Claude Pro' && /access.*(?:has been|is) paused/i.test(subject+' '+text)) return {...identity,name,kind:'paused',status:'paused',summary:'Paid access paused; verify outstanding invoice.',trusted};
  if (name==='ChatGPT Plus' && /will not renew|won.t renew/i.test(text)) {
    const end=text.match(new RegExp('(?:current (?:billing )?period|access|end)[\\s\\S]{0,100}?('+d+')','i'));
    return {...identity,name,kind:'cancelled',status:'cancelled',next_billing_date:end?date(end[1]):undefined,summary:'Nonrenewing; access may continue until the stated period end.',trusted};
  }
  if (/unsuccessful|declined|failed|past.due/i.test(subject)) return {...identity,name,kind:'review',summary:'Payment failed; no payment recorded. Check access and retry status.',trusted};
  if (/receipt/i.test(subject) && ['ElevenLabs Starter','Meshy Pro'].includes(name)) {
    const period=text.match(new RegExp('('+d+')\\s*[–—-]\\s*('+d+')','i'));
    const year=period?.[2].match(/20\d{2}/)?.[0]||period?.[1].match(/20\d{2}/)?.[0];
    const start=period?date(period[1],year):undefined,end=period?date(period[2],year):undefined;
    const paid=text.match(new RegExp('Paid\\s+('+d+')','i'));
    const paidDate=paid?date(paid[1],year):undefined;
    const amount=text.match(/(?:amount paid|paid)\s*\$([\d,]+\.\d{2})/i)?.[1];
    // Require the regular line item, not the receipt total or guessed market price.
    const plan=name==='Meshy Pro'?'Pro':'Starter';
    const regular=text.match(new RegExp('\\b'+plan+'\\b[^$]{0,100}?\\$([\\d,]+\\.\\d{2})','i'))?.[1];
    if(start&&end&&amount&&regular&&paidDate&&end>start) return {...identity,name,kind:'receipt',payment_date:paidDate,price:Number(regular.replace(/,/g,'')),amount:Number(amount.replace(/,/g,'')),start_date:start,next_billing_date:end,billing_cycle:'monthly',status:'active',summary:'Receipt parsed; billing-period end used as expected next billing date.',trusted};
  }
  return {...identity,name,kind:'review',summary:'Billing email found. Verify service, recurring price, dates and current status before importing.',trusted};
}
