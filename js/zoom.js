// Source rectangle to crop for a given zoom factor: a 1/z region centered on the
// ROI center. z=1 returns exactly the plain ROI rect (no behavior change at 1x).
export function zoomedRegion(roi, visW, visH, offX, offY, z = 1) {
  const zoom = z >= 1 ? z : 1;
  const sw = (roi.wPct * visW) / zoom;
  const sh = (roi.hPct * visH) / zoom;
  const cx = offX + (roi.xPct + roi.wPct / 2) * visW;
  const cy = offY + (roi.yPct + roi.hPct / 2) * visH;
  return { sx: cx - sw / 2, sy: cy - sh / 2, sw, sh };
}
