// Variante D: Kombination. Nahe am Foto die KI-Ergänzung, nach außen weicher Übergang in den Unschärfe-Hintergrund.
// Gedacht für große Formatsprünge, bei denen die KI weit draußen verwaschen oder repetitiv wird.
import { COMBO_FADE_START, COMBO_FADE_END } from '../config.js';
import { makeCanvas, context2d } from '../image-io.js';
import { background } from './blur.js';
import { lamaVariant } from './lama.js';

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Anteil des KI-Bilds pro Pixel: 1 im Original, nach außen hin abnehmend
function blendLamaOverBackground(lama, bg, { W, H, rect }) {
  const out = makeCanvas(W, H);
  const ctx = context2d(out);
  ctx.drawImage(bg, 0, 0);
  const layer = makeCanvas(W, H);
  const lctx = context2d(layer);
  lctx.drawImage(lama, 0, 0);
  const img = lctx.getImageData(0, 0, W, H);
  const d = img.data;
  const gaps = { top: rect.y, bottom: H - rect.y - rect.h, left: rect.x, right: W - rect.x - rect.w };
  for (let y = 0; y < H; y++) {
    // Relative Entfernung vom Original, gemessen in Randbreiten (0 = Kante des Originals, 1 = Bildrand)
    let ty = 0;
    if (y < rect.y) ty = (rect.y - y) / gaps.top;
    else if (y >= rect.y + rect.h) ty = (y - rect.y - rect.h + 1) / gaps.bottom;
    for (let x = 0; x < W; x++) {
      let tx = 0;
      if (x < rect.x) tx = (rect.x - x) / gaps.left;
      else if (x >= rect.x + rect.w) tx = (x - rect.x - rect.w + 1) / gaps.right;
      const a = 1 - smoothstep(COMBO_FADE_START, COMBO_FADE_END, Math.max(tx, ty));
      d[(y * W + x) * 4 + 3] = Math.round(a * 255);
    }
  }
  lctx.putImageData(img, 0, 0);
  ctx.drawImage(layer, 0, 0);
  return out;
}

export const comboVariant = {
  id: 'combo',
  name: 'KI + Unschärfe',
  description: 'KI-Ergänzung nahe am Foto, nach außen weich in den Unschärfe-Hintergrund übergehend.',
  async: true,
  activationKey: 'lama', // nutzt dasselbe KI-Modell
  activationHint: lamaVariant.activationHint,
  isAvailable: (job) => !!job.axis,
  isReady: lamaVariant.isReady,
  isCached: lamaVariant.isCached,
  activate: lamaVariant.activate,

  async render(job, opts) {
    const lama = await lamaVariant.expand(job, opts);
    return blendLamaOverBackground(lama, background(job.source, job.W, job.H), job);
  },
};
