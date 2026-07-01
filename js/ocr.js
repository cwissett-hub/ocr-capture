// Thin wrapper over the globally-loaded Tesseract UMD build (index.html loads
// vendor/tesseract/tesseract.min.js before the module graph). All paths point
// at vendored files so nothing is fetched from a CDN at runtime.
const TESS = 'vendor/tesseract';
const FULL_ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export async function createOcr({ whitelist } = {}) {
  const Tesseract = window.Tesseract;
  if (!Tesseract) throw new Error('Tesseract not loaded');

  const worker = await Tesseract.createWorker('eng', 1, {
    workerPath: `${TESS}/worker.min.js`,
    // Explicit .js file — Tesseract loads it verbatim. A DIRECTORY here makes
    // Tesseract auto-select a core by SIMD+OEM and, with OEM 1 (lstmOnly), request
    // tesseract-core-simd-lstm.wasm.js — which we don't vendor → "Failed to load
    // TesseractCore". The combined SIMD core supports LSTM/OEM 1. (Assumes SIMD,
    // which every modern iOS/desktop browser has.)
    corePath: `${TESS}/tesseract-core-simd.wasm.js`,
    langPath: `${TESS}/`,          // dir containing eng.traineddata.gz
    gzip: true,
  });

  await worker.setParameters({
    tessedit_char_whitelist: whitelist || FULL_ALNUM,
    tessedit_pageseg_mode: '7',    // treat the image as a single text line
  });

  return {
    async recognize(source) {
      const { data } = await worker.recognize(source);
      return data.text || '';
    },
    terminate() { return worker.terminate(); },
  };
}
