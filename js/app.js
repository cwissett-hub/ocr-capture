import { createParser } from './serial.js';
import { createStore } from './store.js';
import { createOcr } from './ocr.js';
import { createCamera } from './camera.js';
import { toCsv } from './csv.js';
import { createBeeper } from './audio.js';

const APP_VERSION = 'v10';
const LIST_KEY = 'serial-scanner:list';
const CONFIG_KEY = 'serial-scanner:config';
const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const listEl = $('list');

const store = createStore({
  load: () => { try { return JSON.parse(localStorage.getItem(LIST_KEY)) || []; } catch { return []; } },
  save: (items) => localStorage.setItem(LIST_KEY, JSON.stringify(items)),
});
const beeper = createBeeper();
let started = false;
let parse = null;      // bound to the config when the scanner starts
let editingId = null;  // row being edited, or null

function setStatus(msg) { statusEl.textContent = msg; }

// --- Scan band (ROI): user-adjustable, shared live with the camera ---------
const ROI_KEY = 'serial-scanner:roi';
const DEFAULT_ROI = { wPct: 0.90, hPct: 0.24 };
const roi = { xPct: 0, yPct: 0, wPct: DEFAULT_ROI.wPct, hPct: DEFAULT_ROI.hPct };
(function initRoi() {
  try {
    const s = JSON.parse(localStorage.getItem(ROI_KEY));
    if (s && typeof s.wPct === 'number' && typeof s.hPct === 'number') {
      roi.wPct = Math.min(0.96, Math.max(0.40, s.wPct));
      roi.hPct = Math.min(0.60, Math.max(0.08, s.hPct));
    }
  } catch { /* keep defaults */ }
})();
function applyRoi() {
  roi.xPct = (1 - roi.wPct) / 2;
  roi.yPct = (1 - roi.hPct) / 2;
  const box = $('roi');
  box.style.left = `${roi.xPct * 100}%`;
  box.style.top = `${roi.yPct * 100}%`;
  box.style.width = `${roi.wPct * 100}%`;
  box.style.height = `${roi.hPct * 100}%`;
  const w = $('roi-w'), h = $('roi-h');
  if (w) w.value = String(Math.round(roi.wPct * 100));
  if (h) h.value = String(Math.round(roi.hPct * 100));
}
function wireRoi() {
  const w = $('roi-w'), h = $('roi-h');
  const onInput = () => {
    roi.wPct = Number(w.value) / 100;
    roi.hPct = Number(h.value) / 100;
    applyRoi();
    try { localStorage.setItem(ROI_KEY, JSON.stringify({ wPct: roi.wPct, hPct: roi.hPct })); } catch { /* ignore */ }
  };
  w.addEventListener('input', onInput);
  h.addEventListener('input', onInput);
}

function loadConfig() { try { return JSON.parse(localStorage.getItem(CONFIG_KEY)); } catch { return null; } }
function validConfig(c) {
  return !!c && typeof c === 'object'
    && Number.isInteger(c.length)
    && typeof c.regex === 'string'
    && Array.isArray(c.positions)
    && c.positions.length === c.length;
}

function render() {
  listEl.replaceChildren();
  for (const it of store.all()) {
    const li = document.createElement('li');
    li.dataset.id = it.id;
    if (it.id === editingId) {
      li.className = 'editing';
      const input = document.createElement('input');
      input.className = 'edit-input';
      input.value = it.serial;
      input.setAttribute('spellcheck', 'false');
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commitEdit(it.id, input.value);
        else if (e.key === 'Escape') { editingId = null; render(); }
      });
      const ok = document.createElement('button');
      ok.className = 'ok'; ok.textContent = '✓'; ok.setAttribute('aria-label', 'Save');
      ok.addEventListener('click', () => commitEdit(it.id, input.value));
      const cancel = document.createElement('button');
      cancel.className = 'del'; cancel.textContent = '×'; cancel.setAttribute('aria-label', 'Cancel');
      cancel.addEventListener('click', () => { editingId = null; render(); });
      li.append(input, ok, cancel);
      listEl.appendChild(li);
      input.focus();
      continue;
    }
    li.className = it.dup ? 'dup' : '';
    const span = document.createElement('span');
    span.className = 'serial';
    span.textContent = it.serial;
    span.addEventListener('click', () => copy(it.serial, li));
    const edit = document.createElement('button');
    edit.className = 'edit'; edit.textContent = '✎'; edit.setAttribute('aria-label', 'Edit');
    edit.addEventListener('click', () => { editingId = it.id; render(); });
    const del = document.createElement('button');
    del.className = 'del'; del.textContent = '×'; del.setAttribute('aria-label', 'Delete');
    del.addEventListener('click', () => { store.remove(it.id); render(); });
    li.append(span, edit, del);
    listEl.appendChild(li);
  }
  const c = $('count');
  if (c) c.textContent = `${listEl.children.length} captured`;
}

function commitEdit(id, value) {
  if (!parse) { setStatus('Cannot edit before setup.'); return; }
  const { valid, serial } = parse(value);
  if (!valid) { setStatus('Invalid format — not saved.'); return; }
  store.update(id, serial);
  editingId = null;
  render();
  setStatus(`Edited to ${serial}`);
}

function flashRow(id) {
  const row = listEl.querySelector(`li[data-id="${id}"]`);
  if (!row) return;
  row.classList.add('flash');
  row.scrollIntoView({ block: 'nearest' });
  setTimeout(() => row.classList.remove('flash'), 500);
}

async function copy(serial, li) {
  try {
    await navigator.clipboard.writeText(serial);
    setStatus(`Copied ${serial}`);
  } catch (e) {
    console.error('Clipboard write failed', e);
    const r = document.createRange();
    r.selectNodeContents(li.querySelector('.serial'));
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    setStatus('Copy blocked — text selected, tap Copy');
  }
  li.classList.add('copied');
  setTimeout(() => li.classList.remove('copied'), 600);
}

function exportCsv() {
  const items = store.all();
  if (!items.length) { setStatus('Nothing to export.'); return; }
  const blob = new Blob([toCsv(items)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `serials-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus(`Exported ${items.length} serials.`);
}

async function copyAll() {
  const items = store.all();          // newest-first, same order as the list
  if (!items.length) { setStatus('Nothing to copy.'); return; }
  const text = items.map((it) => it.serial).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    setStatus(`Copied ${items.length} serials.`);
  } catch (e) {
    console.error('Copy all failed', e);
    setStatus('Copy blocked — use Export CSV instead.');
  }
}

function showSetup(prefill) {
  if (prefill) $('setup-config').value = prefill;
  $('setup-error').textContent = '';
  $('setup').hidden = false;
}
function hideSetup() { $('setup').hidden = true; }
function wireSetup() {
  $('setup-open').addEventListener('click', () => showSetup(localStorage.getItem(CONFIG_KEY) || ''));
  $('setup-save').addEventListener('click', () => {
    let cfg;
    try { cfg = JSON.parse($('setup-config').value); }
    catch { $('setup-error').textContent = 'Not valid JSON.'; return; }
    if (!validConfig(cfg)) {
      $('setup-error').textContent = 'Config missing required fields (length, regex, positions).';
      return;
    }
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    hideSetup();
    startScanner(cfg);
  });
}

// --- keep-awake ------------------------------------------------------------
let wakeLock = null;
async function acquireWakeLock() {
  try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); }
  catch (e) { /* unsupported or denied */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && started) acquireWakeLock();
});

function setupTorch(camera) {
  const track = camera.track();
  const btn = $('torch');
  let caps = null;
  try { caps = track && track.getCapabilities ? track.getCapabilities() : null; } catch { caps = null; }
  if (!track || !caps || !('torch' in caps)) return; // unsupported: stays hidden
  btn.hidden = false;
  let on = false;
  btn.addEventListener('click', async () => {
    on = !on;
    try { await track.applyConstraints({ advanced: [{ torch: on }] }); btn.classList.toggle('on', on); }
    catch (e) { console.error('Torch failed', e); }
  });
}

function setupTapToFocus(camera) {
  $('video').addEventListener('click', async () => {
    const track = camera.track();
    if (!track || !track.applyConstraints) return;
    try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); }
    catch (e) { /* unsupported */ }
  });
}

async function startScanner(config) {
  if (started) return;
  started = true;
  parse = createParser(config);

  let ocr;
  try {
    ocr = await createOcr({ whitelist: config.whitelist });
  } catch (e) {
    console.error('OCR load failed', e);
    setStatus('OCR failed to load — reconnect once to cache it, then works offline.');
    started = false;
    return;
  }

  let held = null;
  const onFrame = async (canvas) => {
    const text = await ocr.recognize(canvas);
    const { valid, serial } = parse(text);
    if (!valid) { held = null; return; }
    if (serial === held) { setStatus(`Added ${serial}`); return; }
    held = serial;
    const item = store.add(serial, Date.now());
    render();
    flashRow(item.id);
    beeper.beep(item.dup ? 'dup' : 'new');
    setStatus(`Added ${serial}`);
  };

  const camera = createCamera({ video: $('video'), canvas: $('work'), roi, onFrame });
  window.addEventListener('pagehide', () => {
    camera.stop();
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  });

  try {
    await camera.start();
    setStatus('Point the box at a serial.');
    acquireWakeLock();
    setupTorch(camera);
    setupTapToFocus(camera);
  } catch (e) {
    console.error('Camera start failed', e);
    setStatus('Camera unavailable. Enable camera in iOS Settings › Safari, or use Capture.');
  }

  $('capture').addEventListener('click', () => { beeper.unlock(); camera.capture(); });

  let clearArm = false;
  const clearBtn = $('clear');
  clearBtn.addEventListener('click', () => {
    if (!clearArm) {
      clearArm = true;
      clearBtn.textContent = 'Tap again to clear';
      setTimeout(() => { clearArm = false; clearBtn.textContent = 'Clear all'; }, 2500);
      return;
    }
    clearArm = false;
    clearBtn.textContent = 'Clear all';
    store.clear();
    render();
    setStatus('List cleared.');
  });
}

function main() {
  const ver = $('ver');
  if (ver) ver.textContent = APP_VERSION;
  render();
  wireSetup();
  wireRoi();
  applyRoi();
  $('export').addEventListener('click', exportCsv);
  $('copyall').addEventListener('click', copyAll);
  document.addEventListener('pointerdown', () => beeper.unlock(), { once: true });
  const config = loadConfig();
  if (!validConfig(config)) { setStatus('Setup required — paste the configuration.'); showSetup(); return; }
  startScanner(config);
}

main();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
