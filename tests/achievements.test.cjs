const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '../achievements.js');
const achievements = fs.existsSync(file) ? require(file) : {};

function api() {
  assert.equal(typeof achievements.createStore, 'function', 'account achievements must be implemented');
  return achievements;
}

function fixture() {
  const users = {
    alice: { id: 'alice', user_metadata: { nickname: 'Alice' } },
    bob: { id: 'bob', user_metadata: { nickname: 'Bob' } }
  };
  let account = 'alice', offline = false, writes = 0;
  const storage = new Map();
  const clone = value => structuredClone(value);
  const client = { auth: {
    async getSession() { return { data: { session: account ? { user: clone(users[account]), access_token: account } : null }, error: null }; },
    async getUser(token) { return offline ? { data: { user: null }, error: new Error('offline') } : { data: { user: clone(users[token]) }, error: null }; }
  } };
  const options = {
    client, url: 'https://example.test', key: 'public-anon-key',
    storage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    async fetch(url, init) {
      if (offline) throw new Error('offline');
      assert.equal(url, 'https://example.test/auth/v1/user');
      assert.equal(init.method, 'PUT');
      const owner = init.headers.Authorization.slice('Bearer '.length);
      const patch = JSON.parse(init.body).data;
      Object.assign(users[owner].user_metadata, patch);
      writes++;
      return { ok: true, async json() { return clone(users[owner]); } };
    }
  };
  return { users, options, get writes() { return writes; }, login(id) { account = id; }, offline(value) { offline = value; } };
}

test('Z9 achievement needs a completed run with every generated Z9 collected', () => {
  assert.equal(typeof achievements.evaluate, 'function');
  assert.deepEqual(achievements.evaluate('zrh-run', { won: true, z9Collected: 3, z9Total: 3 }), ['z9-collector']);
  for (const stats of [
    { won: false, z9Collected: 3, z9Total: 3 },
    { won: true, z9Collected: 2, z9Total: 3 },
    { won: true, z9Collected: 0, z9Total: 0 },
    { won: true, z9Collected: 4, z9Total: 3 }
  ]) assert.deepEqual(achievements.evaluate('zrh-run', stats), []);
});

test('luggage tags count within a single completed run', () => {
  assert.equal(typeof achievements.evaluate, 'function');
  assert.deepEqual(achievements.evaluate('lhr302-t3', { won: true, tagsCollected: 3, tagsTotal: 3 }), ['tag-collector']);
  assert.deepEqual(achievements.evaluate('lhr302-t3', { won: true, tagsCollected: 2, tagsTotal: 3 }), []);
  assert.deepEqual(achievements.evaluate('lhr302-t3', { won: false, tagsCollected: 3, tagsTotal: 3 }), []);
});

test('unlock survives a new device and leaves nickname intact', async () => {
  const f = fixture(), store = api().createStore(f.options);
  store.setUser(f.users.alice);
  await store.award('z9-run'); // Unknown IDs never unlock anything.
  await store.award('z9-collector');
  assert.equal(store.snapshot().items[0].status, 'unlocked');
  const other = api().createStore({ ...f.options, storage: null });
  other.setUser({ id: 'alice', user_metadata: {} });
  await other.sync();
  assert.equal(other.snapshot().items[0].status, 'unlocked');
  assert.equal(f.users.alice.user_metadata.nickname, 'Alice');
});

test('repeated wins do not overwrite the first unlock or write again', async () => {
  const f = fixture(), store = api().createStore(f.options);
  store.setUser(f.users.alice);
  await store.award('z9-collector');
  const date = store.snapshot().items[0].unlockedAt;
  const writes = f.writes;
  await store.award('z9-collector');
  assert.equal(f.writes, writes);
  assert.equal(store.snapshot().items[0].unlockedAt, date);
});

test('guest earns locally pending, then login claims it for that account', async () => {
  const f = fixture(); f.login(null);
  const store = api().createStore(f.options);
  await store.award('tag-collector');
  assert.equal(store.snapshot().items[1].status, 'pending');
  assert.equal(f.writes, 0);
  f.login('alice'); store.setUser(f.users.alice);
  await store.sync();
  assert.equal(store.snapshot().items[1].status, 'unlocked');
});

test('offline award is retried after reload and never leaks to another account', async () => {
  const f = fixture(), store = api().createStore(f.options);
  store.setUser(f.users.alice); f.offline(true);
  await store.award('tag-collector');
  assert.equal(store.snapshot().items[1].status, 'pending');
  f.offline(false); f.login('bob');
  const reloaded = api().createStore(f.options);
  reloaded.setUser(f.users.bob); await reloaded.sync();
  assert.equal(reloaded.snapshot().items[1].status, 'locked');
  f.login('alice'); reloaded.setUser(f.users.alice); await reloaded.sync();
  assert.equal(reloaded.snapshot().items[1].status, 'unlocked');
});

test('account switch during a save cannot write to or display on the new account', async () => {
  const f = fixture(); let release, arrived;
  const began = new Promise(r => { arrived = r; });
  const original = f.options.fetch;
  f.options.fetch = async (...args) => {
    arrived(); await new Promise(r => { release = r; });
    return original(...args);
  };
  const store = api().createStore(f.options); store.setUser(f.users.alice);
  const saving = store.award('z9-collector');
  await began;
  f.login('bob'); store.setUser(f.users.bob); release(); await saving;
  assert.equal(store.snapshot().items[0].status, 'locked');
  const bob = api().createStore({ ...f.options, fetch: original });
  bob.setUser(f.users.bob); await bob.sync();
  assert.equal(bob.snapshot().items[0].status, 'locked');
  f.login('alice'); bob.setUser(f.users.alice); await bob.sync();
  assert.equal(bob.snapshot().items[0].status, 'unlocked');
});

test('awards arriving during a save are both kept', async () => {
  const f = fixture(), store = api().createStore(f.options);
  store.setUser(f.users.alice);
  await Promise.all([store.award('z9-collector'), store.award('tag-collector')]);
  await store.sync();
  assert.deepEqual(store.snapshot().items.map(x => x.status), ['unlocked', 'unlocked']);
});

test('a rejected cloud write stays pending until a successful retry', async () => {
  const f = fixture(); let reject = true;
  const original = f.options.fetch;
  f.options.fetch = (...args) => reject ? Promise.resolve({ ok: false }) : original(...args);
  const store = api().createStore(f.options); store.setUser(f.users.alice);
  await store.award('tag-collector');
  assert.equal(store.snapshot().error, true);
  assert.equal(store.snapshot().items[1].status, 'pending');
  reject = false; await store.sync();
  assert.equal(store.snapshot().error, false);
  assert.equal(store.snapshot().items[1].status, 'unlocked');
});

test('blocked browser storage does not prevent account achievements', async () => {
  const f = fixture();
  f.options.storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const store = api().createStore(f.options); store.setUser(f.users.alice);
  await store.award('tag-collector');
  assert.equal(store.snapshot().items[1].status, 'unlocked');
  store.setUser(null);
  assert.equal(store.snapshot().items[1].status, 'locked');
});
