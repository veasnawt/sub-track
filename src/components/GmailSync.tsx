import React, {useEffect,useState} from 'react';
import {request,api} from '../lib/api';
export function GmailSync({onChange}:{onChange:()=>void}) {
  const [info,setInfo]=useState<any>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[review,setReview]=useState<any>();
  const load=async()=>setInfo(await request('/gmail/status'));
  useEffect(()=>{load().catch(e=>setError(e.message));},[]);
  async function run(action:()=>Promise<any>){setBusy(true);setError('');try{await action();await load();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
  async function edit(event:any){await run(async()=>{
    const all=await api.subscriptions.list();const matches=all.data.filter(x=>x.name===event.evidence.name);const existing=matches.length===1?matches[0]:undefined;const e=event.evidence;
    setReview({id:event.message_id,data:{name:e.name,category:existing?.category||'Other',price:e.price??existing?.price??'',currency:existing?.currency||'USD',billing_cycle:e.billing_cycle||existing?.billing_cycle||'monthly',start_date:e.payment_date||existing?.start_date||'',next_billing_date:e.next_billing_date||existing?.next_billing_date||'',status:e.status||existing?.status||'active',auto_renew:e.kind==='cancelled'?false:existing?.auto_renew??false,payment_method:existing?.payment_method||'other',notes:existing?.notes||e.summary,...(e.amount!==undefined&&e.payment_date?{initial_payment:{amount:e.amount,date:e.payment_date}}:{})}});
  });}
  const field=(key:string,value:any)=>setReview((v:any)=>({...v,data:{...v.data,[key]:value}}));
  const callbackStatus=new URLSearchParams(window.location.search).get('gmail');
  return <section className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
    <div><h2 className="font-bold">Automatic subscription tracking</h2><p className="text-sm text-slate-500 mt-1">Connect Gmail to find billing receipts and changes. Sub-Track cannot send, delete, or change your emails.</p></div>
    {callbackStatus&&<p role="status" className="text-sm">{callbackStatus==='connected'?'Gmail connected. Scan your receipts below.':callbackStatus==='account-mismatch'?'Choose the Gmail address used by your Sub-Track account.':'Gmail connection was not completed. Try again.'}</p>}
    {error&&<p role="alert" className="text-sm text-rose-600">{error}</p>}
    {!info?<p>Checking connection…</p>:!info.configured?<p className="text-sm text-amber-700">Gmail setup is not finished yet. Your subscriptions are saved; automatic email syncing will become available after Google connection setup.</p>:<>
      {!info.connected?<button disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded-xl" onClick={()=>run(async()=>{const r:any=await request('/gmail/connect',{method:'POST'});window.location.assign(r.url);})}>Connect Gmail</button>:<>
        <p className="text-sm">Connected: {info.email}{info.last_sync&&<> · Last scan: {new Date(info.last_sync).toLocaleString()}</>}</p>
        {info.last_error&&<p className="text-sm text-amber-700">{info.last_error}</p>}
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={info.auto_sync} disabled={busy} onChange={e=>run(()=>request('/gmail/preferences',{method:'PUT',body:JSON.stringify({auto_sync:e.target.checked})}))}/>Automatically update recognized services from verified receipts</label>
        <p className="text-xs text-slate-500">New services, cancellations, failed payments and unclear prices go to review. The first scan is always review-only. Only billing details and email links are saved, not email bodies.</p>
        <div className="flex flex-wrap gap-3"><button className="px-4 py-2 bg-indigo-600 text-white rounded-xl" disabled={busy} onClick={()=>run(async()=>{await request('/gmail/sync',{method:'POST'});onChange();})}>{busy?'Working…':'Scan billing emails'}</button><button disabled={busy} onClick={()=>run(()=>request('/gmail/connect',{method:'POST'}).then((r:any)=>window.location.assign(r.url)))}>Reconnect</button><button disabled={busy} onClick={()=>run(()=>request('/gmail/disconnect',{method:'POST'}))}>Disconnect Gmail</button></div>
      </>}
      <div className="space-y-3">{info.events?.map((e:any)=><div key={e.message_id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">
        <div className="font-semibold">{e.evidence.name} · {e.state==='applied'?'Tracked':'Needs review'}</div>
        <p>{e.evidence.summary}</p><p className="text-xs text-slate-500">Email: {new Date(e.email_date).toLocaleDateString()}{e.evidence.price!==undefined&&` · Regular price: $${e.evidence.price}`}{e.evidence.amount!==undefined&&` · Paid: $${e.evidence.amount}`}</p>
        <a className="text-indigo-600 underline" href={e.source_url} target="_blank" rel="noreferrer">View source email</a>
        {e.state==='pending'&&<div className="flex gap-4 mt-2"><button disabled={busy} onClick={()=>edit(e)}>Review details</button><button disabled={busy} onClick={()=>run(()=>request('/gmail/events/'+e.message_id+'/dismiss',{method:'POST'}))}>Dismiss</button></div>}
      </div>)}</div>
    </>}
    {review&&<form className="p-4 border border-indigo-200 rounded-xl space-y-3" onSubmit={e=>{e.preventDefault();run(async()=>{await request('/gmail/events/'+review.id+'/approve',{method:'POST',body:JSON.stringify({...review.data,price:Number(review.data.price)})});setReview(undefined);onChange();});}}>
      <h3 className="font-bold">Confirm subscription details</h3>
      <div className="grid sm:grid-cols-2 gap-3">{[['name','Service'],['price','Regular price'],['start_date','Start date'],['next_billing_date',review.data.status==='cancelled'?'Access ends':'Next billing date']].map(([key,label])=><label key={key} className="text-sm">{label}<input className="block border rounded p-2 w-full bg-transparent" required type={key.includes('date')?'date':key==='price'?'number':'text'} min={key==='price'?0:undefined} step={key==='price'?'0.01':undefined} value={review.data[key]} onChange={e=>field(key,e.target.value)}/></label>)}
        <label>Billing cycle<select className="block border rounded p-2 bg-transparent" value={review.data.billing_cycle} onChange={e=>field('billing_cycle',e.target.value)}>{['monthly','yearly','weekly','quarterly','semi_annual','lifetime'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Status<select className="block border rounded p-2 bg-transparent" value={review.data.status} onChange={e=>field('status',e.target.value)}>{['active','paused','cancelled','trial'].map(x=><option key={x}>{x}</option>)}</select></label>
      </div>
      <label className="flex gap-2"><input type="checkbox" checked={review.data.auto_renew} onChange={e=>field('auto_renew',e.target.checked)}/>Auto-renew enabled at the provider</label>
      {review.data.initial_payment&&<p className="text-sm">This receipt records ${review.data.initial_payment.amount} paid on {review.data.initial_payment.date}.</p>}
      <label className="text-sm">Notes<textarea className="block border rounded p-2 w-full bg-transparent" value={review.data.notes} onChange={e=>field('notes',e.target.value)}/></label>
      <div className="flex gap-4"><button disabled={busy} className="px-4 py-2 bg-indigo-600 text-white rounded-xl">Save verified details</button><button type="button" onClick={()=>setReview(undefined)}>Close</button></div>
    </form>}
  </section>;
}
