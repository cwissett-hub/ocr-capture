import { createParser } from './serial.js';
import { createVoter } from './vote.js';
import { createStore } from './store.js';
import { createOcr } from './ocr.js';
import { createCamera } from './camera.js';

const LIST_KEY = 'serial-scanner:list';
const CONFIG_KEY = 'serial-scanner:config';
const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const listEl = $('list');

const store = createStore({
  load: () => { try { return JSON.parse(localStorage.getItem(LIST_KEY)) || []; } catch { return []; } },
  save: (items) => localStorage.setItem(LIST_KEY, JSON.stringify(items)),
});
const voter = createVoter({ needed: 3 });
let started = false;

function setStatus(msg) { statusEl.textContent = msg; }

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
    if (locked) { store.add(locked); render(); setStatus(`Locked ${locked}`); }
    else if (valid) setStatus(`Aligning… ${serial}`);
  };

  const camera = createCamera({
    video: $('video'),
    canvas: $('work'),
    roi: { xPct: 0.08, yPct: 0.43, wPct: 0.84, hPct: 0.14 }, // matches .roi CSS (slim band)
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
  $('clear').addEventListener('click', () => { if (confirm('Clear all serials?')) { store.clear(); render(); } });
}

function main() {
  render();
  wireSetup();
  const config = loadConfig();
  if (!validConfig(config)) { setStatus('Setup required — paste the configuration.'); showSetup(); return; }
  startScanner(config);
}

main();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
