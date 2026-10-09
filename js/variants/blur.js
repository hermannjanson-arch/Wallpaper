// Variante C: Unschärfe-Hintergrund.
// Das Foto füllt verkleinert, weichgezeichnet und abgedunkelt die ganze Fläche, das Original liegt unverändert darüber.
import { BLUR_WORK_SCALE, BLUR_RADIUS, BLUR_DARKEN } from '../config.js';
import { makeCanvas, context2d } from '../image-io.js';

// Schneller Weichzeichner: drei Durchgänge Box-Blur ergeben fast eine Gauß-Unschärfe.
function boxBlur(data, w, h, r) {
  const tmp = new Uint8ClampedArray(data.length);
  const pass = (src, dst, len, lines, stride, step) => {
    const div = 2 * r + 1;
    for (let line = 0; line < lines; line++) {
      const base = line * stride;
      for (let c = 0; c < 3; c++) {
        // Ränder werden fortgesetzt, damit sie nicht dunkel auslaufen
        let sum = 0;
        for (let i = -r; i <= r; i++) sum += src[base + Math.min(len - 1, Math.max(0, i)) * step + c];
        for (let i = 0; i < len; i++) {
          dst[base + i * step + c] = sum / div;
          sum += src[base + Math.min(len - 1, i + r + 1) * step + c] - src[base + Math.max(0, i - r) * step + c];
        }
      }
      for (let i = 0; i < len; i++) dst[base + i * step + 3] = 255;
    }
  };
  for (let k = 0; k < 3; k++) {
    pass(data, tmp, w, h, w * 4, 4);   // waagerecht
    pass(tmp, data, h, w, 4, w * 4);   // senkrecht
  }
}

// Der Hintergrund hängt nicht von der Position des Originals ab, darum wird er zwischengespeichert.
const backgroundCache = new WeakMap();

export function background(source, W, H) {
  const key = `${W}x${H}`;
  const cached = backgroundCache.get(source);
  if (cached?.key === key) return cached.canvas;

  const sw = Math.max(8, Math.round(W * BLUR_WORK_SCALE)), sh = Math.max(8, Math.round(H * BLUR_WORK_SCALE));
  const small = makeCanvas(sw, sh);
  const sctx = context2d(small);
  const s = Math.max(sw / source.width, sh / source.height); // "cover": füllt die Fläche komplett
  const dw = source.width * s, dh = source.height * s;
  sctx.drawImage(source, (sw - dw) / 2, (sh - dh) / 2, dw, dh);

  const img = sctx.getImageData(0, 0, sw, sh);
  boxBlur(img.data, sw, sh, Math.max(1, Math.round(Math.max(sw, sh) * BLUR_RADIUS)));
  sctx.putImageData(img, 0, 0);
  sctx.fillStyle = `rgba(0, 0, 0, ${BLUR_DARKEN})`;
  sctx.fillRect(0, 0, sw, sh);

  const bg = makeCanvas(W, H);
  context2d(bg).drawImage(small, 0, 0, W, H);
  backgroundCache.set(source, { key, canvas: bg });
  return bg;
}

export const blurVariant = {
  id: 'blur',
  name: 'Unschärfe-Hintergrund',
  description: 'Das Foto weichgezeichnet als Hintergrund. Funktioniert immer und sofort.',
  isAvailable: () => true,
  render({ source, W, H, rect }) {
    const out = makeCanvas(W, H);
    const ctx = context2d(out);
    ctx.drawImage(background(source, W, H), 0, 0);
    ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h);
    return out;
  },
};
