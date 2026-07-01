export function createCamera({ video, canvas, roi, onFrame, intervalMs = 450 }) {
  let stream = null;
  let timer = null;
  let busy = false;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  async function tick() {
    if (busy || !video.videoWidth) return;
    busy = true;
    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const sx = Math.floor(roi.xPct * vw);
      const sy = Math.floor(roi.yPct * vh);
      const sw = Math.floor(roi.wPct * vw);
      const sh = Math.floor(roi.hPct * vh);
      // Upscale the crop ~2x for the OCR engine.
      canvas.width = sw * 2;
      canvas.height = sh * 2;
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
    // Grayscale + fixed-threshold binarize for high-contrast screen text.
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const v = g > 140 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    context.putImageData(img, 0, 0);
  }

  return {
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      timer = setInterval(tick, intervalMs);
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    },
    capture() { return tick(); },
  };
}
