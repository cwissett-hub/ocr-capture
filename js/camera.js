import { zoomedRegion } from './zoom.js';

function zoomCapsFor(track) {
  try {
    const c = track && track.getCapabilities ? track.getCapabilities() : null;
    if (c && c.zoom && typeof c.zoom.max === 'number') {
      return { supported: true, native: true, max: Math.min(c.zoom.max, 5) };
    }
  } catch (e) { /* ignore */ }
  return { supported: true, native: false, max: 4 };
}

export function createCamera({ video, canvas, roi, onFrame, intervalMs = 450 }) {
  let stream = null;
  let timer = null;
  let busy = false;
  let digitalZoom = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  async function tick() {
    if (busy || !video.videoWidth || !video.clientWidth) return;
    busy = true;
    try {
      // object-fit: cover — map the on-screen ROI back to source-frame pixels.
      const vw = video.videoWidth, vh = video.videoHeight;
      const bw = video.clientWidth, bh = video.clientHeight;
      const scale = Math.max(bw / vw, bh / vh);
      const visW = bw / scale, visH = bh / scale;
      const offX = (vw - visW) / 2, offY = (vh - visH) / 2;
      const { sx, sy, sw, sh } = zoomedRegion(roi, visW, visH, offX, offY, digitalZoom);

      const targetW = 1024;
      canvas.width = targetW;
      canvas.height = Math.max(1, Math.round(targetW * sh / sw));
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      preprocess(ctx, canvas.width, canvas.height);
      await onFrame(canvas);
    } finally {
      busy = false;
    }
  }

  function preprocess(context, w, h) {
    const img = context.getImageData(0, 0, w, h);
    const d = img.data;
    let sum = 0, min = 255, max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = g;
      sum += g;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    const mean = sum / (d.length / 4);
    const thr = (min + max) / 2;
    const invert = mean < 110;
    for (let i = 0; i < d.length; i += 4) {
      let v = d[i] > thr ? 255 : 0;
      if (invert) v = 255 - v;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    context.putImageData(img, 0, 0);
  }

  return {
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 2560 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      const track = stream.getVideoTracks()[0];
      try {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
      } catch (e) {
        /* focusMode not supported — hardware AF still applies */
      }
      timer = setInterval(tick, intervalMs);
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    },
    capture() { return tick(); },
    track() { return stream ? stream.getVideoTracks()[0] : null; },
    zoomCaps() { return zoomCapsFor(stream ? stream.getVideoTracks()[0] : null); },
    async setZoom(z) {
      const t = stream ? stream.getVideoTracks()[0] : null;
      const caps = zoomCapsFor(t);
      const zz = Math.max(1, Math.min(z, caps.max));
      if (t && caps.native) {
        try {
          await t.applyConstraints({ advanced: [{ zoom: zz }] });
          digitalZoom = 1;
          video.style.transform = '';
          return;
        } catch (e) { /* fall through to digital */ }
      }
      digitalZoom = zz;
      video.style.transform = zz > 1 ? `scale(${zz})` : '';
    },
  };
}
