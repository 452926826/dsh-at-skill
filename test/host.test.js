import assert from 'node:assert/strict';
import test from 'node:test';
import { apply, inject } from '../lib/index.js';

test('skill lookup follows the current working directory and forwards cancellation', async () => {
  let handler;
  let cwd = '/first';
  const agent = { session: { header: { cwd: '/original' } } };
  const signal = new AbortController().signal;
  const ensured = [];
  const lookups = [];
  const ctx = {
    on: (event, callback) => { assert.equal(event, 'agent/pre-step'); handler = callback; },
    workingDirectory: { ensure: async (actualAgent, actualSignal) => {
      ensured.push([actualAgent, actualSignal]);
      return cwd;
    } },
    get: () => undefined,
    skills: { get: async (name, options) => { lookups.push({ name, ...options }); return undefined; } },
  };
  assert.ok(inject.includes('workingDirectory'));
  apply(ctx);
  const messages = [{ source: { kind: 'user' }, content: [{ type: 'text', text: '@example' }] }];
  const next = async () => ({ kind: 'enter', messages: [] });
  await handler({ agent, messages, signal }, next);
  cwd = '/second';
  await handler({ agent, messages, signal }, next);
  assert.deepEqual(ensured, [[agent, signal], [agent, signal]]);
  assert.deepEqual(lookups, [
    { name: 'example', cwd: '/first', signal, scope: agent },
    { name: 'example', cwd: '/second', signal, scope: agent },
  ]);
});

test('preset registry takes precedence and preserves upstream decision fields', async () => {
  let handler;
  let hostCalls = 0;
  const agent = {};
  const signal = new AbortController().signal;
  const skill = { name: 'example', provider: 'preset', content: 'preset body', invocation: { userInvocable: true } };
  const scoped = { get: async () => skill };
  const ctx = {
    on: (_, callback) => { handler = callback; },
    workingDirectory: { ensure: async () => '/current' },
    get: name => name === 'agentPresets' ? { serviceFor: (actual, key) => {
      assert.equal(actual, agent);
      assert.equal(key, 'skills');
      return scoped;
    } } : undefined,
    skills: { get: async () => { hostCalls++; return { ...skill, content: 'host body' }; } },
  };
  apply(ctx);
  const messages = [{ source: { kind: 'user' }, content: [{ type: 'text', text: '@example' }] }];
  const result = await handler({ agent, messages, signal }, async () => ({ kind: 'enter', messages: [], startsRequestSeries: true }));
  assert.equal(hostCalls, 0);
  assert.equal(result.startsRequestSeries, true);
  assert.match(result.messages[0].content[0].text, /preset body/);
  assert.doesNotMatch(result.messages[0].content[0].text, /host body/);
});
