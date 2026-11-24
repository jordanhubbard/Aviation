/// <reference types="vitest/globals" />
import assert from 'node:assert/strict';
import { appendTurn, getHistory } from '../src/memory';

test('distinct valid app scopes cannot collide through user or conversation delimiters', () => {
  appendTurn('collision-owner', 'app-one', 'user', 'First private conversation', 'app-two:conversation');
  appendTurn('collision-owner:app-one', 'app-two', 'assistant', 'Second private conversation', 'conversation');
  assert.deepEqual(getHistory('collision-owner', 'app-one', 'app-two:conversation'), [
    { role: 'user', content: 'First private conversation' },
  ]);
  assert.deepEqual(getHistory('collision-owner:app-one', 'app-two', 'conversation'), [
    { role: 'assistant', content: 'Second private conversation' },
  ]);
});

test('all tuple positions are retained when multiple separator characters occur', () => {
  const scopes = [['many:a', 'b', 'c:d'], ['many', 'a:b', 'c:d'], ['many', 'a', 'b:c:d']];
  scopes.forEach(([user, app, conversation], i) => appendTurn(user, app, 'user', 'scope-' + i, conversation));
  scopes.forEach(([user, app, conversation], i) => assert.deepEqual(getHistory(user, app, conversation), [
    { role: 'user', content: 'scope-' + i },
  ]));
});

test('Unicode identity is exact and is not normalized into another conversation', () => {
  appendTurn('unicode-é', 'chat', 'user', 'Composed', '🙂:one');
  appendTurn('unicode-e\u0301', 'chat', 'assistant', 'Decomposed', '🙂:one');
  assert.deepEqual(getHistory('unicode-é', 'chat', '🙂:one'), [{ role: 'user', content: 'Composed' }]);
  assert.deepEqual(getHistory('unicode-e\u0301', 'chat', '🙂:one'), [{ role: 'assistant', content: 'Decomposed' }]);
});

test('the last twenty messages remain ordered and truncation affects only that exact tuple', () => {
  appendTurn('retention', 'chat', 'user', 'Other conversation', 'other');
  for (let i = 0; i < 24; i++) appendTurn('retention', 'chat', i % 2 ? 'assistant' : 'user', 'message-' + i, 'bounded');
  const history = getHistory('retention', 'chat', 'bounded');
  assert.equal(history.length, 20); assert.equal(history[0].content, 'message-4');
  assert.equal(history[19].content, 'message-23');
  assert.deepEqual(getHistory('retention', 'chat', 'other'), [{ role: 'user', content: 'Other conversation' }]);
});

test('omitted, empty and literal default conversation IDs preserve their existing alias', () => {
  appendTurn('default-owner', 'chat', 'user', 'Omitted');
  appendTurn('default-owner', 'chat', 'assistant', 'Empty', '');
  appendTurn('default-owner', 'chat', 'user', 'Explicit', 'default');
  for (const conversation of [undefined, '', 'default']) assert.deepEqual(getHistory('default-owner', 'chat', conversation), [
    { role: 'user', content: 'Omitted' }, { role: 'assistant', content: 'Empty' }, { role: 'user', content: 'Explicit' },
  ]);
});

test('an unknown tuple has no history and does not create a turn', () => {
  assert.deepEqual(getHistory('never-written', 'chat', 'nothing'), []);
  assert.deepEqual(getHistory('never-written', 'chat', 'nothing'), []);
});
