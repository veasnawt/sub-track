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
pg.Pool.prototype.query = pool.query.bind(pool) as any;
pg.Pool.prototype.connect = pool.connect.bind(pool) as any;
const { default: app } = await import('../server/index');
const { db, bindSQL } = await import('../server/db');
const { getPool } = await import('../server/postgres');

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
    const a = await request('/auth/register', 'POST', { name: 'User One', email: 'one@example.test', password: 'test1234', seedSamples: false });
    const b = await request('/auth/register', 'POST', { name: 'User Two', email: 'two@example.test', password: 'test1234', seedSamples: false });
    assert.equal(a.status, 201); assert.equal(b.status, 201);
    const token = a.body.token;
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
    assert.equal((await request('/analytics/summary', 'GET', undefined, token)).status, 200);
    await new Promise<void>(resolve => running.server.close(() => resolve()));
    running = await serve();
    const login = await request('/auth/login', 'POST', { email: 'one@example.test', password: 'test1234' });
    assert.equal(login.status, 200);
    assert.equal((await request('/subscriptions', 'GET', undefined, login.body.token)).body.count, 2);
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
