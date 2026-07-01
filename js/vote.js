export function createVoter({ needed = 3 } = {}) {
  let last = null;
  let count = 0;
  return {
    push(serial) {
      if (!serial) { last = null; count = 0; return null; }
      if (serial === last) count++;
      else { last = serial; count = 1; }
      if (count >= needed) { last = null; count = 0; return serial; }
      return null;
    },
    reset() { last = null; count = 0; },
  };
}
