// Generic OCR confusable groups — characters that look alike. Generic OCR
// knowledge only; contains NO format-specific information.
const CONFUSABLE_GROUPS = ['0OQD', '1ILJ', '2Z', '4A', '5S', '6G', '7T', '8B'];
const DIGITS = '0123456789';

// Return ch if already allowed; else the first confusable that IS allowed;
// else ch unchanged (the regex gate will reject if still out of class).
function coerce(ch, allowed) {
  if (allowed.includes(ch)) return ch;
  for (const group of CONFUSABLE_GROUPS) {
    if (group.includes(ch)) {
      for (const cand of group) {
        if (cand !== ch && allowed.includes(cand)) return cand;
      }
    }
  }
  return ch;
}

function allowedFor(pos) {
  if (pos.class === 'fixed') return pos.value;
  if (pos.class === 'digit') return DIGITS;
  if (pos.class === 'set') return pos.chars;
  return ''; // unknown class -> nothing allowed -> gate rejects
}

export function createParser(config) {
  const { length, regex, positions, couplings = [] } = config;
  const re = new RegExp(regex);

  return function parse(raw) {
    const cleaned = (raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    const fail = { valid: false, serial: '', confidence: 0 };
    if (cleaned.length !== length) return fail;

    const c = cleaned.split('');
    let corrections = 0;
    for (let i = 0; i < length; i++) {
      const next = coerce(c[i], allowedFor(positions[i]));
      if (next !== c[i]) { corrections++; c[i] = next; }
    }
    for (const cp of couplings) {
      if (cp.inSet.includes(c[cp.ifPos]) && c[cp.thenPos] !== cp.equals) {
        c[cp.thenPos] = cp.equals;
        corrections++;
      }
    }
    const serial = c.join('');
    if (!re.test(serial)) return fail;
    return { valid: true, serial, confidence: (length - corrections) / length };
  };
}
