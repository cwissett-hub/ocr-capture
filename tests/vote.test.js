import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoter } from '../js/vote.js';

test('locks after N identical reads and returns the serial once', () => {
  const v = createVoter({ needed: 3 });
  assert.equal(v.push('SERIAL-AAA'), null);
  assert.equal(v.push('SERIAL-AAA'), null);
  assert.equal(v.push('SERIAL-AAA'), 'SERIAL-AAA'); // lock
  assert.equal(v.push('SERIAL-AAA'), null);            // reset — needs 3 again
});

test('a different read resets the streak', () => {
  const v = createVoter({ needed: 3 });
  v.push('SERIAL-CCC');
  v.push('SERIAL-BBB'); // breaks streak
  assert.equal(v.push('SERIAL-BBB'), null);
  assert.equal(v.push('SERIAL-BBB'), 'SERIAL-BBB');
});

test('null/empty read breaks the streak', () => {
  const v = createVoter({ needed: 2 });
  v.push('SERIAL-AAA');
  assert.equal(v.push(null), null);
  assert.equal(v.push('SERIAL-AAA'), null); // streak restarted
  assert.equal(v.push('SERIAL-AAA'), 'SERIAL-AAA');
});

test('reset clears state', () => {
  const v = createVoter({ needed: 2 });
  v.push('SERIAL-AAA');
  v.reset();
  assert.equal(v.push('SERIAL-AAA'), null);
});
