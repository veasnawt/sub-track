import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseEvidence,messageText} from '../server/gmail/parser';
const headers={from:'Meshy <invoice+statements+acct_test@stripe.com>',subject:'Your receipt from Meshy', 'authentication-results':'mx.google.com; dkim=pass header.i=@stripe.com; dmarc=pass header.from=stripe.com'};
const receipt='Receipt from Meshy $10.00 Paid October 1, 2026 Receipt Oct 1–Nov 1, 2026 Pro Qty 1 $20.00 First-month 50% off Total $10.00 Amount paid $10.00';
test('receipt keeps regular price separate from paid amount and needs approved Stripe sender',()=>{
 const e=parseEvidence(headers,receipt)!;assert.equal(e.name,'Meshy Pro');assert.equal(e.price,20);assert.equal(e.amount,10);assert.equal(e.payment_date,'2026-10-01');assert.equal(e.next_billing_date,'2026-11-01');assert.equal(e.start_date,'2026-10-01');assert.equal(e.trusted,true);assert.equal(e.requires_approval,true);
});
test('unverified sender cannot automatically update services',()=>assert.equal(parseEvidence({...headers,'authentication-results':'dkim=fail; dmarc=fail'},receipt)?.trusted,false));
test('prepaid credits and promotions are not subscriptions',()=>{
 assert.equal(parseEvidence({...headers,subject:'Your receipt'},'Prepaid extra usage credit purchase $5.00'),null);
 assert.equal(parseEvidence({...headers,subject:'Save 50% on a subscription'},'Buy now and renew next month'),null);
});
test('failed payment does not imply paid or canceled',()=>{
 const e=parseEvidence({from:'failed-payments@mail.anthropic.com',subject:'$20.00 payment was unsuccessful'},'We attempted to charge your subscription but were unsuccessful')!;
 assert.equal(e.kind,'review');assert.equal(e.amount,undefined);assert.equal(e.status,undefined);
});
test('HTML emails exclude scripts, styles and never execute content',()=>{
 const text=messageText({mimeType:'text/html',body:{data:Buffer.from('<style>secret</style><script>fake</script><p>Amount paid $6.00</p>').toString('base64url')}});
 assert.equal(text.trim(),'Amount paid $6.00');
});
