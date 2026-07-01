export function createCamera({ video, canvas, roi, onFrame, intervalMs = 450 }) {
  let stream = null;
  let timer = null;
  let busy = false;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  async function tick() {
    if (busy || !video.videoWidth || !video.clientWidth) return;
    busy = true;
    try {
      // The video is shown with object-fit: cover, so the element crops the
      // frame. Map the on-screen ROI (fractions of the DISPLAYED video box) back
      // to source-frame pixels, so the region we OCR is exactly the guide box.
      const vw = video.videoWidth, vh = video.videoHeight;
      const bw = video.clientWidth, bh = video.clientHeight;
      const scale = Math.max(bw / vw, bh / vh);   // object-fit: cover
      const visW = bw / scale, visH = bh / scale;  // source px visible in the box
      const offX = (vw - visW) / 2, offY = (vh - visH) / 2;
      const sx = offX + roi.xPct * visW;
      const sy = offY + roi.yPct * visH;
      const sw = roi.wPct * visW;
      const sh = roi.hPct * visH;

      // Draw the crop at a fixed OCR-friendly width so recognition is consistent
      // regardless of the (now high-res) source frame.
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
    // Grayscale + running mean brightness.
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = g;
      sum += g;
    }
    const mean = sum / (d.length / 4);
    // Dark background (light-on-dark equipment display) -> invert so the text
    // ends up dark-on-light, which is what the OCR engine expects.
    const invert = mean < 110;
    for (let i = 0; i < d.length; i += 4) {
      let v = d[i] > 140 ? 255 : 0;
      if (invert) v = 255 - v;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    context.putImageData(img, 0, 0);
  }

  return {
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({
        // Ask for a high-res rear stream so small serials stay legible after the
        // ROI crop. The browser clamps to the nearest supported mode.
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 2560 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      // Best-effort continuous autofocus (ignored where unsupported).
      const track = stream.getVideoTracks()[0];
      try {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
      } catch (e) {
        /* focusMode not supported on this device — hardware AF still applies */
      }
      timer = setInterval(tick, intervalMs);
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    },
    capture() { return tick(); },
  };
}
