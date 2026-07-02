import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../js/csv.js';

test('empty list is just the header', () => {
  assert.equal(toCsv([]), 'serial,captured_at');
});

test('one row: serial + ISO timestamp', () => {
  const ts = 1700000000000;
  const iso = new Date(ts).toISOString();
  assert.equal(toCsv([{ serial: 'AB123XP', ts }]), `serial,captured_at\r\nAB123XP,${iso}`);
});

test('missing timestamp leaves captured_at empty', () => {
  assert.equal(toCsv([{ serial: 'AB123XP', ts: null }]), 'serial,captured_at\r\nAB123XP,');
});

test('rows are in list order', () => {
  const out = toCsv([{ serial: 'AAA', ts: 0 }, { serial: 'BBB', ts: 0 }]).split('\r\n');
  assert.equal(out[1].split(',')[0], 'AAA');
  assert.equal(out[2].split(',')[0], 'BBB');
});

test('RFC-4180 quotes fields with comma or quote', () => {
  assert.equal(toCsv([{ serial: 'A,B', ts: null }]), 'serial,captured_at\r\n"A,B",');
  assert.equal(toCsv([{ serial: 'A"B', ts: null }]), 'serial,captured_at\r\n"A""B",');
});
