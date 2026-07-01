// Frequency voting over a sliding window: a serial locks once it has been seen
// `needed` times within the last `window` frames (not necessarily consecutive).
// This tolerates the occasional jittery OCR frame between good reads, which a
// strict "N in a row" rule does not — that rule can leave a valid serial stuck
// "aligning" forever if any frame in between differs.
export function createVoter({ needed = 2, window = 5 } = {}) {
  let buf = [];
  return {
    push(serial) {
      buf.push(serial || null);
      if (buf.length > window) buf.shift();
      if (!serial) return null;
      let count = 0;
      for (const s of buf) if (s === serial) count++;
      if (count >= needed) { buf = []; return serial; }
      return null;
    },
    reset() { buf = []; },
  };
}
