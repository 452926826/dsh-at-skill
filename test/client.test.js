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

test('client lists and inserts skills, caching per session and invalidating', async () => {
  let calls = 0;
  const { source, events } = await setup(async () => {
    calls++;
    return { ok: true, value: { skills: [{ name: 'alpha', description: 'A' }, { name: 'beta', description: 'B' }] } };
  });
  const session = { sessionId: 'main' };
  assert.equal(JSON.stringify(await source.candidates(session, request('al'))), JSON.stringify([{ name: 'alpha', description: 'A' }]));
  assert.equal(source.onPick({ candidate: { name: 'alpha' } }).text, '@alpha ');
  await source.candidates(session, request(''));
  assert.equal(calls, 1);
  assert.equal((await source.candidates({ sessionId: 'child' }, request(''))).length, 0);
  events.get('agent-preset/selected')('main');
  await source.candidates(session, request(''));
  events.get('connection/reset')();
  await source.candidates(session, request(''));
  assert.equal(calls, 3);
});

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
