import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoomedRegion } from '../js/zoom.js';

const ROI = { xPct: 0.1, yPct: 0.2, wPct: 0.8, hPct: 0.4 };

test('z=1 reproduces the plain ROI rectangle', () => {
  assert.deepEqual(zoomedRegion(ROI, 1000, 500, 0, 0, 1),
    { sx: 100, sy: 100, sw: 800, sh: 200 });
});

test('z=1 is the default', () => {
  assert.deepEqual(zoomedRegion(ROI, 1000, 500, 0, 0),
    { sx: 100, sy: 100, sw: 800, sh: 200 });
});

test('z=2 samples a quarter-area region centered on the same center', () => {
  // center = (0+ (0.1+0.4)*1000, 0+(0.2+0.2)*500) = (500, 200)
  assert.deepEqual(zoomedRegion(ROI, 1000, 500, 0, 0, 2),
    { sx: 300, sy: 150, sw: 400, sh: 100 });
});

test('offsets (object-fit cover letterbox) are applied', () => {
  const r = zoomedRegion(ROI, 1000, 500, 50, 20, 1);
  assert.deepEqual(r, { sx: 150, sy: 120, sw: 800, sh: 200 });
});

test('z below 1 clamps to 1', () => {
  assert.deepEqual(zoomedRegion(ROI, 1000, 500, 0, 0, 0.5),
    zoomedRegion(ROI, 1000, 500, 0, 0, 1));
});
