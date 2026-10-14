import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newDb } from 'pg-mem';
import pg from 'pg';

// Tests use an isolated PostgreSQL emulator, never a production database.
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
process.env.JWT_SECRET = 'test-only-key-for-isolated-integration-tests-123456';
const memory = newDb();
memory.public.none('CREATE TABLE pinly_guard (id text PRIMARY KEY, value text); INSERT INTO pinly_guard VALUES (\'keep\', \'unchanged\');');
const schema = readFileSync('supabase/migrations/001_initial_schema.sql', 'utf8');
// pg-mem does not implement RLS; production applies the unchanged RLS statements.
memory.public.none(schema.replace(/ALTER TABLE .*? ENABLE ROW LEVEL SECURITY;/g, ''));
const adapter = memory.adapters.createPg();
const pool = new adapter.Pool();
const skipRLS=(sql:string)=>/^ALTER TABLE .* ENABLE ROW LEVEL SECURITY;?$/.test(sql.trim());
pg.Pool.prototype.query = (async(sql:string,...args:any[])=>skipRLS(sql)?{rows:[],rowCount:0}:pool.query(sql,...args)) as any;
pg.Pool.prototype.connect = (async()=>{const client=await pool.connect();const query=client.query.bind(client);client.query=async(sql:string,...args:any[])=>skipRLS(sql)?{rows:[],rowCount:0}:query(sql,...args);return client;}) as any;
const { default: app } = await import('../server/index');
const { db, bindSQL } = await import('../server/db');
const { getPool, connectionURL } = await import('../server/postgres');

async function serve() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  return { server, url: `http://127.0.0.1:${address.port}` };
}

const subscription = { name: 'Test subscription', category: 'Other', price: 12.50,
  billing_cycle: 'monthly', start_date: '2026-10-01', next_billing_date: '2026-11-01' };

test('parameter binding keeps injected values out of SQL', () => {
  const value = "x'; DROP TABLE pinly_guard; --";
  assert.deepEqual(bindSQL('SELECT id FROM public.subtrack_users WHERE email = ?', [value]), {
    text: 'SELECT id FROM public.subtrack_users WHERE email = $1', values: [value],
  });
});

test('register, CRUD, isolation, renewal, import and persistence across API restart', async () => {
  let running = await serve();
  const request = async (path: string, method = 'GET', body?: unknown, token?: string) => {
    const response = await fetch(running.url + '/api' + path, { method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() as any };
  };
  try {
    assert.equal((await request('/health')).status, 200);
    const a = await request('/auth/register', 'POST', { name: 'User One', email: 'one@example.test', password: 'test1234' });
    const b = await request('/auth/register', 'POST', { name: 'User Two', email: 'two@example.test', password: 'test1234' });
    assert.equal(a.status, 201); assert.equal(b.status, 201);
    const token = a.body.token;
    assert.equal((await request('/subscriptions', 'GET', undefined, token)).body.count, 0);
    const created = await request('/subscriptions', 'POST', subscription, token);
    assert.equal(created.status, 201);
    assert.equal(created.body.data.price, 12.5);
    const id = created.body.data.id;
    assert.equal((await request('/subscriptions')).status, 401);
    assert.equal((await request('/subscriptions/' + id, 'GET', undefined, b.body.token)).status, 404);
    assert.equal((await request('/subscriptions/' + id, 'PUT', subscription, b.body.token)).status, 404);
    assert.equal((await request('/subscriptions/' + id, 'DELETE', undefined, b.body.token)).status, 404);
    assert.equal((await request('/subscriptions', 'GET', undefined, b.body.token)).body.count, 0);
    assert.equal((await request('/subscriptions/' + id, 'PUT', { ...subscription, price: 15 }, token)).body.data.price, 15);
    assert.equal((await request('/subscriptions/' + id + '/renew', 'POST', {}, token)).status, 200);
    assert.equal((await request('/subscriptions/' + id, 'GET', undefined, token)).body.data.history.length, 2);
    assert.equal((await request('/subscriptions/import', 'POST', { subscriptions: [subscription] }, token)).body.importedCount, 1);
    const intro = {...subscription,name:'Intro service',price:20,source_id:'gmail:receipt-one',initial_payment:{amount:10,date:'2026-10-01'}};
    assert.equal((await request('/subscriptions/import','POST',{subscriptions:[intro]},token)).body.importedCount,1);
    assert.equal((await request('/subscriptions/import','POST',{subscriptions:[intro]},token)).body.importedCount,0);
    const imported=(await request('/subscriptions','GET',undefined,token)).body.data.find((s:any)=>s.name==='Intro service');
    assert.equal(imported.price,20);
    const payments=(await request('/subscriptions/'+imported.id,'GET',undefined,token)).body.data.history;
    assert.equal(payments.length,1);assert.equal(payments[0].amount,10);
    assert.equal((await request('/subscriptions/import','POST',{subscriptions:[{...subscription,next_billing_date:'2026-02-31'}]},token)).status,400);
    assert.equal((await request('/gmail/cron')).status,401);
    assert.equal((await request('/gmail/status','GET',undefined,token)).body.connected,false);
    assert.equal((await request('/analytics/summary', 'GET', undefined, token)).status, 200);
    await new Promise<void>(resolve => running.server.close(() => resolve()));
    running = await serve();
    const login = await request('/auth/login', 'POST', { email: 'one@example.test', password: 'test1234' });
    assert.equal(login.status, 200);
    assert.equal((await request('/subscriptions', 'GET', undefined, login.body.token)).body.count, 3);
    assert.equal((await request('/subscriptions/' + id, 'DELETE', undefined, login.body.token)).status, 200);
    assert.equal((await request('/subscriptions/' + id, 'GET', undefined, login.body.token)).status, 404);
    assert.deepEqual(memory.public.many('SELECT * FROM pinly_guard'), [{ id: 'keep', value: 'unchanged' }]);
  } finally {
    await new Promise<void>(resolve => running.server.close(() => resolve()));
  }
});

test('transactions roll back and release on failure', async () => {
  const commands: string[] = [];
  const release = () => commands.push('RELEASE');
  const original = getPool().connect;
  getPool().connect = (async () => ({ query: async (sql: string) => { commands.push(sql); return { rows: [], rowCount: 0 }; }, release })) as any;
  try {
    await assert.rejects(db.transaction(async () => { throw new Error('forced failure'); })(), /forced failure/);
    assert.deepEqual(commands, ['BEGIN', 'ROLLBACK', 'RELEASE']);
  } finally { getPool().connect = original; }
});


test('direct project URI maps to the Vercel pooler without changing password', () => {
  const url = connectionURL('postgresql://postgres:test%23value@db.hmluapddxfnimuqqmtpr.supabase.co:5432/postgres?sslmode=require');
  assert.equal(url.hostname, 'aws-0-ap-northeast-1.pooler.supabase.com');
  assert.equal(url.port, '6543');
  assert.equal(url.username, 'postgres.hmluapddxfnimuqqmtpr');
  assert.equal(url.password, 'test%23value');
  assert.equal(url.searchParams.has('sslmode'), false);
  assert.equal(connectionURL('postgresql://test:test@localhost/test').hostname, 'localhost');
});

test('Gmail token encryption is authenticated and randomized', async()=>{
 const {encrypt,decrypt}=await import('../server/gmail/service');
 const a=encrypt('test-refresh-token'),b=encrypt('test-refresh-token');
 assert.notEqual(a,b);assert.equal(decrypt(a),'test-refresh-token');
 const raw=Buffer.from(a,'base64url');raw[30]^=1;assert.throws(()=>decrypt(raw.toString('base64url')));
});

test('Gmail state is bound to the browser, single-use, and events are scoped per user',async()=>{
 process.env.GOOGLE_CLIENT_ID='test-client';process.env.GOOGLE_CLIENT_SECRET='test-secret';process.env.APP_URL='https://example.test';
 const running=await serve();
 const call=async(path:string,method='GET',body?:any,token?:string,cookie?:string)=>fetch(running.url+'/api'+path,{method,redirect:'manual',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 try{
  const a=await(await call('/auth/register','POST',{name:'Gmail One',email:'gmail-one@example.test',password:'test1234'})).json() as any;
  const b=await(await call('/auth/register','POST',{name:'Gmail Two',email:'gmail-two@example.test',password:'test1234'})).json() as any;
  const connected=await call('/gmail/connect','POST',{},a.token);
  const c=await connected.json() as any;const url=new URL(c.url);assert.equal(url.searchParams.get('scope'),'https://www.googleapis.com/auth/gmail.readonly');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  const state=url.searchParams.get('state');const nonceCookie=connected.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await call('/gmail/callback?state='+state+'&error=access_denied')).status,400);
  assert.equal((await call('/gmail/callback?state='+state+'&error=access_denied','GET',undefined,undefined,nonceCookie)).status,302);
  assert.equal((await call('/gmail/callback?state='+state+'&error=access_denied','GET',undefined,undefined,nonceCookie)).status,400);
  const {encrypt,applyEvidence}=await import('../server/gmail/service');
  await db.prepare('INSERT INTO public.subtrack_gmail_connections(user_id,email,refresh_cipher) VALUES(?,?,?)').run(a.user.userId,'gmail-one@example.test',encrypt('private-test-token'));
  const status=await(await call('/gmail/status','GET',undefined,a.token)).json() as any;assert.equal(status.connected,true);assert.equal(JSON.stringify(status).includes('refresh_cipher'),false);
  assert.equal((await(await call('/gmail/status','GET',undefined,b.token)).json() as any).connected,false);
  await db.prepare('INSERT INTO public.subtrack_gmail_events(user_id,message_id,evidence,source_url,email_date) VALUES(?,?,?,?,?)').run(a.user.userId,'event-one',JSON.stringify({name:'Meshy Pro',trusted:true,sender_key:'merchant-one'}),'https://mail.google.com/mail/u/0/#all/event-one',new Date().toISOString());
  assert.equal((await call('/gmail/events/event-one/approve','POST',subscription,b.token)).status,404);
  const record={...subscription,name:'Meshy Pro',price:20,initial_payment:{amount:10,date:'2026-10-01'}};
  assert.equal((await call('/gmail/events/event-one/approve','POST',record,a.token)).status,200);
  assert.equal((await call('/gmail/events/event-one/approve','POST',record,a.token)).status,404);
  const evidence={name:'Meshy Pro',kind:'receipt' as const,trusted:true,requires_approval:true,sender_key:'not-approved',summary:'receipt',price:20,amount:20,payment_date:'2026-11-01',start_date:'2026-11-01',next_billing_date:'2026-12-01',billing_cycle:'monthly' as const};
  assert.equal(await applyEvidence(a.user.userId,'next-receipt',evidence),false);
  assert.equal(await applyEvidence(a.user.userId,'next-receipt',{...evidence,sender_key:'merchant-one'}),true);
  assert.equal(await applyEvidence(b.user.userId,'next-receipt',{...evidence,sender_key:'merchant-one'}),false);
  assert.deepEqual(memory.public.many('SELECT * FROM pinly_guard'),[{id:'keep',value:'unchanged'}]);
 }finally{delete process.env.GOOGLE_CLIENT_ID;delete process.env.GOOGLE_CLIENT_SECRET;delete process.env.APP_URL;await new Promise<void>(resolve=>running.server.close(()=>resolve()));}
});
