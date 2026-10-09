// Verbindung zwischen Seite und LaMa-Worker.
import { LAMA_MODEL_URL, LAMA_CACHE_NAME, LAMA_MAX_THREADS, LAMA_SIZE } from '../config.js';

let worker = null;
let nextId = 1;
const pending = new Map(); // id -> { resolve, reject, onProgress }
let loadPromise = null;
export const lamaInfo = { ready: false, backend: null, threads: 0 };

// Absturz-Schutz: Vor jeder speicherhungrigen Phase wird sie notiert und danach wieder gelöscht.
// Steht beim nächsten Seitenaufruf noch eine Phase drin, ist der Browser dabei abgestürzt
// (auf Handys meist: zu wenig Arbeitsspeicher). Dann startet die KI nicht mehr von selbst.
const PHASE_KEY = 'lamaPhase';
function setPhase(phase) {
  try { if (phase) localStorage.setItem(PHASE_KEY, phase); else localStorage.removeItem(PHASE_KEY); } catch { /* egal */ }
}
export const lastCrash = (() => {
  try { const p = localStorage.getItem(PHASE_KEY); localStorage.removeItem(PHASE_KEY); return p; } catch { return null; }
})();
// Normales Schließen oder Wegnavigieren ist kein Absturz
addEventListener('pagehide', () => setPhase(null));

// Handys bekommen für den Browser wenig Arbeitsspeicher: dort sparsam rechnen
const lowMemory = matchMedia('(pointer: coarse)').matches;

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
    const maxThreads = lowMemory ? 2 : LAMA_MAX_THREADS;
    const threads = self.crossOriginIsolated ? Math.min(maxThreads, navigator.hardwareConcurrency || 2) : 1;
    setPhase('laden');
    loadPromise = call('init', { threads, lowMemory }, [], (p) => {
      if (p.phase === 'prepare') setPhase('vorbereiten');
      onProgress?.(p);
    }).then((info) => {
      setPhase(null);
      Object.assign(lamaInfo, info, { ready: true });
      return info;
    }, (err) => {
      setPhase(null);
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
  setPhase('rechnen');
  try {
    const { output } = await call('run', { image, mask, size: LAMA_SIZE }, [image.buffer, mask.buffer]);
    return output;
  } finally {
    setPhase(null);
  }
}
