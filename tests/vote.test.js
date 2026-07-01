import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoter } from '../js/vote.js';

test('locks after `needed` occurrences within the window, returns once', () => {
  const v = createVoter({ needed: 2, window: 5 });
  assert.equal(v.push('SERIAL-AAA'), null);
  assert.equal(v.push('SERIAL-AAA'), 'SERIAL-AAA'); // 2nd occurrence -> lock
  assert.equal(v.push('SERIAL-AAA'), null);          // buffer cleared after lock
});

test('tolerates a null (jitter) frame between good reads', () => {
  const v = createVoter({ needed: 2, window: 5 });
  assert.equal(v.push('SERIAL-AAA'), null);
  assert.equal(v.push(null), null);
  assert.equal(v.push('SERIAL-AAA'), 'SERIAL-AAA'); // still 2 within the window
});

test('tolerates a different interspersed read', () => {
  const v = createVoter({ needed: 2, window: 5 });
  v.push('SERIAL-AAA');
  v.push('SERIAL-BBB'); // different serial, does not help AAA's count
  assert.equal(v.push('SERIAL-AAA'), 'SERIAL-AAA'); // AAA seen twice within last 3
});

test('a serial that ages out of the window does not lock', () => {
  const v = createVoter({ needed: 2, window: 3 });
  assert.equal(v.push('SERIAL-AAA'), null);
  assert.equal(v.push('SERIAL-BBB'), null);
  assert.equal(v.push('SERIAL-CCC'), null);
  assert.equal(v.push('SERIAL-AAA'), null); // first AAA has aged out of the 3-window
});

test('reset clears state', () => {
  const v = createVoter({ needed: 2, window: 5 });
  v.push('SERIAL-AAA');
  v.reset();
  assert.equal(v.push('SERIAL-AAA'), null);
});
