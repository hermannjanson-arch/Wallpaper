// Variante B: Seam Carving. Streckt das Foto nur in unwichtigen Bereichen, für kleine Formatunterschiede.
import { SEAM_MAX_STRETCH } from '../config.js';
import { makeCanvas, context2d } from '../image-io.js';

let worker = null;
let nextId = 1;
const pending = new Map();

function carve(payload) {
  if (!worker) {
    worker = new Worker(new URL('../seam/seam-worker.js', import.meta.url));
    worker.onmessage = ({ data }) => {
      const p = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) p?.reject(new Error(data.error)); else p?.resolve(data.result);
    };
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, ...payload }, [payload.pixels.buffer]);
  });
}

// Wie stark das Foto gestreckt werden müsste (0.1 = 10 %)
export function stretchNeeded(job) {
  return job.axis === 'x' ? job.W / job.rect.w - 1 : job.axis === 'y' ? job.H / job.rect.h - 1 : 0;
}

export const seamVariant = {
  id: 'seam',
  name: 'Inhaltsbasiert gestreckt',
  description: 'Streckt das Foto nur an unauffälligen Stellen. Ganz ohne erfundene Bildteile.',
  async: true,
  usesOffset: false, // füllt die ganze Fläche, eine Position gibt es nicht
  isAvailable: (job) => !!job.axis && stretchNeeded(job) <= SEAM_MAX_STRETCH,
  isReady: () => true,
  keyFor: (job) => `${job.sourceId}|${job.W}x${job.H}|seam`,

  async render(job, { onMessage }) {
    onMessage('Wird gestreckt …', null);
    const { rect, W, H } = job;
    const c = makeCanvas(rect.w, rect.h);
    const ctx = context2d(c);
    ctx.drawImage(job.source, 0, 0, rect.w, rect.h);
    const pixels = ctx.getImageData(0, 0, rect.w, rect.h).data;
    const out = await carve({ pixels, w: rect.w, h: rect.h, outW: W, outH: H });
    const result = makeCanvas(W, H);
    context2d(result).putImageData(new ImageData(out, W, H), 0, 0);
    return result;
  },
};
