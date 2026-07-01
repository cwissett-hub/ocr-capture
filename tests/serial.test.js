import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createParser } from '../js/serial.js';

// Dummy, non-sensitive format used ONLY to prove the generic engine works.
// 'AB' + 3 digits + a coupled 2-char suffix ([XY]P or ZQ). Reveals nothing real.
const DUMMY = {
  length: 7,
  regex: '^AB\\d{3}(?:[XY]P|ZQ)$',
  positions: [
    { class: 'fixed', value: 'A' },
    { class: 'fixed', value: 'B' },
    { class: 'digit' }, { class: 'digit' }, { class: 'digit' },
    { class: 'set', chars: 'XYZ' },
    { class: 'set', chars: 'PQ' },
  ],
  couplings: [
    { ifPos: 5, inSet: 'XY', thenPos: 6, equals: 'P' },
    { ifPos: 5, inSet: 'Z',  thenPos: 6, equals: 'Q' },
  ],
};
const parse = createParser(DUMMY);

test('accepts a clean value, confidence 1', () => {
  const r = parse('AB123XP');
  assert.equal(r.valid, true);
  assert.equal(r.serial, 'AB123XP');
  assert.equal(r.confidence, 1);
});
test('accepts both couplings', () => {
  assert.equal(parse('AB000ZQ').valid, true);
  assert.equal(parse('AB777YP').valid, true);
});
test('normalizes case and whitespace', () => {
  assert.equal(parse('ab 123 xp').serial, 'AB123XP');
});
test('corrects digit-block confusables', () => {
  assert.equal(parse('ABI23XP').serial, 'AB123XP'); // I->1
  assert.equal(parse('ABO23XP').serial, 'AB023XP'); // O->0
});
test('coupling repairs the second suffix char from the first', () => {
  assert.equal(parse('AB123XQ').serial, 'AB123XP'); // X implies P
  assert.equal(parse('AB123ZP').serial, 'AB123ZQ'); // Z implies Q
});
test('rejects wrong length / uncorrectable chars / empty', () => {
  assert.equal(parse('AB12XP').valid, false);   // length 6
  assert.equal(parse('AB123WP').valid, false);  // W not in {X,Y,Z}, no confusable
  assert.equal(parse('').valid, false);
  assert.equal(parse(null).valid, false);
});
test('confidence drops with corrections', () => {
  const r = parse('ABI2OXP'); // I->1, O->0 : 2 corrections
  assert.ok(r.valid && r.confidence < 1 && r.confidence > 0);
});
