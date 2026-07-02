export function createBeeper() {
  let ctx = null;
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, ms) {
    const c = ensure();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(c.destination);
    const t = c.currentTime;
    osc.start(t);
    osc.stop(t + ms / 1000);
  }
  return {
    unlock() { ensure(); },
    beep(kind) { if (kind === 'dup') tone(420, 90); else tone(880, 110); },
  };
}
