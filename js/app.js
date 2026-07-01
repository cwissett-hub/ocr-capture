import { createParser } from './serial.js';
import { createVoter } from './vote.js';
import { createStore } from './store.js';
import { createOcr } from './ocr.js';
import { createCamera } from './camera.js';

const APP_VERSION = 'v7';
const LIST_KEY = 'serial-scanner:list';
const CONFIG_KEY = 'serial-scanner:config';
const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const listEl = $('list');

const store = createStore({
  load: () => { try { return JSON.parse(localStorage.getItem(LIST_KEY)) || []; } catch { return []; } },
  save: (items) => localStorage.setItem(LIST_KEY, JSON.stringify(items)),
});
const voter = createVoter({ needed: 2, window: 5 });
let started = false;

function setStatus(msg) { statusEl.textContent = msg; }

// --- Scan band (ROI): user-adjustable, shared live with the camera ---------
const ROI_KEY = 'serial-scanner:roi';
const DEFAULT_ROI = { wPct: 0.90, hPct: 0.24 };
// The camera reads these fractions every frame. Width/height are adjustable via
// the on-screen sliders; x/y are derived so the band stays centered.
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

function loadConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY)); } catch { return null; }
}
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
    li.className = it.dup ? 'dup' : '';
    li.dataset.id = it.id;
    const span = document.createElement('span');
    span.className = 'serial';
    span.textContent = it.serial;
    span.addEventListener('click', () => copy(it.serial, li));
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '×';
    del.setAttribute('aria-label', 'Delete');
    del.addEventListener('click', () => { store.remove(it.id); render(); });
    li.append(span, del);
    listEl.appendChild(li);
  }
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

function showSetup(prefill) {
  if (prefill) $('setup-config').value = prefill;
  $('setup-error').textContent = '';
  $('setup').hidden = false;
}
function hideSetup() { $('setup').hidden = true; }

function wireSetup() {
  $('setup-open').addEventListener('click', () => {
    showSetup(localStorage.getItem(CONFIG_KEY) || '');
  });
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

async function startScanner(config) {
  if (started) return;   // camera/OCR already running from a prior config
  started = true;
  const parse = createParser(config);

  let ocr;
  try {
    ocr = await createOcr({ whitelist: config.whitelist });
  } catch (e) {
    console.error('OCR load failed', e);
    setStatus('OCR failed to load — reconnect once to cache it, then works offline.');
    started = false;
    return;
  }

  const onFrame = async (canvas) => {
    const text = await ocr.recognize(canvas);
    const { valid, serial } = parse(text);
    const locked = voter.push(valid ? serial : null);
    if (locked) { store.add(locked); render(); setStatus(`Added ${locked}`); }
    else if (valid) setStatus(`Reading ${serial}… hold steady`);
  };

  const camera = createCamera({
    video: $('video'),
    canvas: $('work'),
    roi, // module-scope, live-adjustable via the W/H sliders
    onFrame,
  });
  window.addEventListener('pagehide', () => camera.stop());

  try {
    await camera.start();
    setStatus('Point the box at a serial.');
  } catch (e) {
    console.error('Camera start failed', e);
    setStatus('Camera unavailable. Enable camera in iOS Settings › Safari, or use Capture.');
  }

  $('capture').addEventListener('click', () => camera.capture());

  // Two-tap clear — avoids the native confirm() dialog, which suspends the page
  // and stalls the live camera on iOS. First tap arms; second tap within 2.5s clears.
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
  const config = loadConfig();
  if (!validConfig(config)) { setStatus('Setup required — paste the configuration.'); showSetup(); return; }
  startScanner(config);
}

main();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
