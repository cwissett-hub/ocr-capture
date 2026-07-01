import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// Regression guard for the "OCR failed to load" bug: Tesseract only auto-selects
// a core filename (and can request an unvendored core, e.g. *-simd-lstm) when
// corePath is a DIRECTORY. Pinning corePath to an explicit, vendored .js core
// file avoids that. This test fails on a directory-style corePath.
const src = readFileSync(new URL('../js/ocr.js', import.meta.url), 'utf8');
const vendored = (name) => existsSync(new URL(`../vendor/tesseract/${name}`, import.meta.url));

test('ocr.js pins corePath to an explicit vendored .js core file that exists', () => {
  const m = src.match(/corePath:\s*`\$\{TESS\}\/([^`]+)`/);
  assert.ok(m, 'corePath must be `${TESS}/<file>` pointing at an explicit file');
  const rel = m[1];
  assert.ok(rel.endsWith('.js'), `corePath must be an explicit .js file, got "${rel}"`);
  assert.ok(vendored(rel), `vendored core file missing: vendor/tesseract/${rel}`);
});

test('worker/core/lang assets referenced by the OCR adapter are vendored', () => {
  for (const f of ['tesseract.min.js', 'worker.min.js', 'tesseract-core-simd.wasm', 'eng.traineddata.gz']) {
    assert.ok(vendored(f), `missing vendor/tesseract/${f}`);
  }
});
