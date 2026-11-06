import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

async function setup(list) {
  let plugin;
  const code = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  vm.runInNewContext(code, { window: { __ModuleLoader__: { load: value => { plugin = value.factory(); } } } });
  const events = new Map();
  let source;
  const ctx = {
    sessions: { subagentAddress: id => id === 'child' ? {} : undefined },
    remote: { skills: { list }, $on: (name, fn) => events.set(name, fn) },
    get: name => name === 'sessions'
      ? { subagentAddress: id => id === 'child' ? {} : undefined }
      : { registerSource: value => { source = value; } },
    on: (name, fn) => events.set(name, fn),
    effect: fn => fn(),
  };
  plugin.apply(ctx);
  return { source, events };
}

const request = query => ({ query, signal: new AbortController().signal });

test('client refreshes settled catalogs and inserts skills', async () => {
  let calls = 0;
  const { source } = await setup(async () => {
    calls++;
    return { ok: true, value: { skills: calls === 1 ? [{ name: 'alpha', description: 'A' }] : [{ name: 'beta', description: 'B' }] } };
  });
  const session = { sessionId: 'main' };
  assert.equal(JSON.stringify(await source.candidates(session, request('al'))), JSON.stringify([{ name: 'alpha', description: 'A' }]));
  assert.equal(source.onPick({ candidate: { name: 'alpha' } }).text, '@alpha ');
  assert.equal(JSON.stringify(await source.candidates(session, request(''))), JSON.stringify([{ name: 'beta', description: 'B' }]));
  assert.equal((await source.candidates({ sessionId: 'child' }, request(''))).length, 0);
  assert.equal(calls, 2);
});

test('client deduplicates concurrent requests and refreshes afterward', async () => {
  let calls = 0;
  let resolve;
  const { source } = await setup(() => {
    calls++;
    return new Promise(r => { resolve = r; });
  });
  const session = { sessionId: 'main' };
  const first = source.candidates(session, request(''));
  const second = source.candidates(session, request(''));
  assert.equal(calls, 1);
  resolve({ ok: true, value: { skills: [] } });
  await Promise.all([first, second]);
  const third = source.candidates(session, request(''));
  assert.equal(calls, 2);
  resolve({ ok: true, value: { skills: [] } });
  await third;
});

for (const event of ['agent-preset/selected', 'connection/reset']) {
  test(`${event} invalidates old in-flight results without disturbing new requests`, async () => {
    const resolvers = [];
    const { source, events } = await setup(() => new Promise(resolve => resolvers.push(resolve)));
    const session = { sessionId: 'main' };
    const old = source.candidates(session, request(''));
    events.get(event)('main');
    const current = source.candidates(session, request(''));
    resolvers[0]({ ok: true, value: { skills: [{ name: 'old', description: 'Old' }] } });
    assert.equal((await old).length, 0);
    const concurrent = source.candidates(session, request(''));
    assert.equal(resolvers.length, 2);
    resolvers[1]({ ok: true, value: { skills: [{ name: 'new', description: 'New' }] } });
    assert.equal(JSON.stringify(await current), JSON.stringify([{ name: 'new', description: 'New' }]));
    assert.equal(JSON.stringify(await concurrent), JSON.stringify([{ name: 'new', description: 'New' }]));
  });
}

test('client retries failed skill catalog requests', async () => {
  let calls = 0;
  const { source } = await setup(async () => ++calls === 1
    ? { ok: false, error: { code: 'error', message: 'unavailable' } }
    : { ok: true, value: { skills: [] } });
  const session = { sessionId: 'main' };
  await assert.rejects(source.candidates(session, request('')), /skills\/list failed/);
  assert.equal((await source.candidates(session, request(''))).length, 0);
  assert.equal(calls, 2);
});

test('client retries rejected transport requests', async () => {
  let calls = 0;
  const { source } = await setup(async () => {
    if (++calls === 1) throw new Error('offline');
    return { ok: true, value: { skills: [] } };
  });
  const session = { sessionId: 'main' };
  await assert.rejects(source.candidates(session, request('')), /offline/);
  assert.equal((await source.candidates(session, request(''))).length, 0);
  assert.equal(calls, 2);
});
