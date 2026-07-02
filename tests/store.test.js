import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';

test('adds newest-first and assigns unique ids', () => {
  const s = createStore();
  s.add('SERIAL-AAA');
  const b = s.add('SERIAL-BBB');
  const all = s.all();
  assert.equal(all[0].serial, 'SERIAL-BBB'); // newest first
  assert.equal(all[0].id, b.id);
  assert.notEqual(all[0].id, all[1].id);
});

test('flags duplicates but still adds them', () => {
  const s = createStore();
  const first = s.add('SERIAL-AAA');
  const again = s.add('SERIAL-AAA');
  assert.equal(first.dup, false);
  assert.equal(again.dup, true);
  assert.equal(s.all().length, 2);
});

test('remove deletes by id; clear empties', () => {
  const s = createStore();
  const a = s.add('SERIAL-AAA');
  s.add('SERIAL-BBB');
  s.remove(a.id);
  assert.equal(s.all().length, 1);
  s.clear();
  assert.equal(s.all().length, 0);
});

test('persists via save after each mutation and hydrates from load', () => {
  let saved = [];
  const s1 = createStore({ load: () => [], save: (x) => { saved = x; } });
  s1.add('SERIAL-AAA');
  assert.equal(saved.length, 1);

  const s2 = createStore({ load: () => saved.map((i) => ({ ...i })) });
  assert.equal(s2.all()[0].serial, 'SERIAL-AAA');
  const next = s2.add('SERIAL-BBB'); // id must not collide with hydrated item
  assert.notEqual(next.id, s2.all()[1].id);
});

test('add records a timestamp and it round-trips through save/load', () => {
  let saved = [];
  const s1 = createStore({ load: () => [], save: (x) => { saved = x; } });
  const it = s1.add('SERIAL-AAA', 1700000000000);
  assert.equal(it.ts, 1700000000000);
  const s2 = createStore({ load: () => saved.map((i) => ({ ...i })) });
  assert.equal(s2.all()[0].ts, 1700000000000);
});

test('add without a timestamp stores ts null', () => {
  const s = createStore();
  assert.equal(s.add('SERIAL-AAA').ts, null);
});

test('update changes the serial and recomputes dup', () => {
  const s = createStore();
  const a = s.add('SERIAL-AAA');
  s.add('SERIAL-BBB');
  s.update(a.id, 'SERIAL-BBB');            // now collides with the other row
  const updated = s.all().find((it) => it.id === a.id);
  assert.equal(updated.serial, 'SERIAL-BBB');
  assert.equal(updated.dup, true);
  s.update(a.id, 'SERIAL-ZZZ');            // now unique again
  assert.equal(s.all().find((it) => it.id === a.id).dup, false);
});
