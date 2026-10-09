// Verbindung zwischen Seite und LaMa-Worker.
import { LAMA_MODEL_URL, LAMA_CACHE_NAME, LAMA_MAX_THREADS, LAMA_SIZE } from '../config.js';

let worker = null;
let nextId = 1;
const pending = new Map(); // id -> { resolve, reject, onProgress }
let loadPromise = null;
export const lamaInfo = { ready: false, backend: null, threads: 0 };

function call(type, payload = {}, transfer = [], onProgress) {
  if (!worker) {
    worker = new Worker(new URL('./lama-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const p = pending.get(data.id);
      if (!p) return;
      if (data.progress) { p.onProgress?.(data.progress); return; }
      pending.delete(data.id);
      if (data.error) p.reject(new Error(data.error)); else p.resolve(data.result);
    };
    worker.onerror = (e) => {
      // z. B. zu wenig Arbeitsspeicher: alle offenen Aufträge abbrechen und neu starten lassen
      for (const p of pending.values()) p.reject(new Error(e.message || 'Die KI-Berechnung ist abgestürzt.'));
      pending.clear();
      worker = null;
      loadPromise = null;
      lamaInfo.ready = false;
    };
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    worker.postMessage({ id, type, ...payload }, transfer);
  });
}

// Liegt das Modell schon im Browser-Cache? Dann kann es ohne Download geladen werden.
export async function isModelCached() {
  try {
    const cache = await caches.open(LAMA_CACHE_NAME);
    return !!(await cache.match(LAMA_MODEL_URL));
  } catch {
    return false;
  }
}

// Lädt das Modell (einmalig). onProgress bekommt { loaded, total } beim Download und { phase: 'prepare' } danach.
export function loadModel(onProgress) {
  if (!loadPromise) {
    const threads = self.crossOriginIsolated ? Math.min(LAMA_MAX_THREADS, navigator.hardwareConcurrency || 2) : 1;
    loadPromise = call('init', { threads }, [], onProgress).then((info) => {
      Object.assign(lamaInfo, info, { ready: true });
      return info;
    }, (err) => {
      loadPromise = null;
      throw err;
    });
  }
  return loadPromise;
}

// Füllt die maskierten Bereiche. image: Float32Array 3×512×512 (0..1), mask: Float32Array 512×512 (1 = füllen).
// Liefert die Ausgabe als Float32Array 3×512×512 im Bereich 0..255.
export async function inpaint(image, mask) {
  await loadModel();
  const { output } = await call('run', { image, mask, size: LAMA_SIZE }, [image.buffer, mask.buffer]);
  return output;
}
