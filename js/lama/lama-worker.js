// Web Worker: lädt das LaMa-Modell (mit Browser-Cache) und führt es aus.
// Läuft getrennt von der Seite, damit diese während der Berechnung bedienbar bleibt.
import * as ort from '../../vendor/onnxruntime-web/ort.webgpu.min.mjs';
import { LAMA_MODEL_URL, LAMA_MODEL_BYTES, LAMA_CACHE_NAME } from '../config.js';

let session = null;

// Reicht die Download-Daten durch, zählt den Fortschritt mit und prüft die Vollständigkeit.
// Firefox meldet über den Service Worker manchmal erst nach dem letzten Byte einen Stream-Fehler; der wird ignoriert.
function countingStream(body, total, onProgress) {
  const reader = body.getReader();
  let loaded = 0;
  return new ReadableStream({
    async pull(controller) {
      let chunk;
      try {
        chunk = await reader.read();
      } catch (err) {
        if (loaded === total) controller.close(); else controller.error(err);
        return;
      }
      if (chunk.done) {
        if (loaded === total) controller.close();
        else controller.error(new Error('Download des KI-Modells war unvollständig. Bitte erneut versuchen.'));
        return;
      }
      loaded += chunk.value.length;
      onProgress(loaded);
      controller.enqueue(chunk.value);
    },
    cancel(reason) { return reader.cancel(reason); },
  });
}

async function loadModelBytes(id) {
  const cache = await caches.open(LAMA_CACHE_NAME);
  let cached = await cache.match(LAMA_MODEL_URL);
  if (!cached) {
    const res = await fetch(LAMA_MODEL_URL);
    if (!res.ok) throw new Error(`Download des KI-Modells fehlgeschlagen (HTTP ${res.status}).`);
    const total = Number(res.headers.get('content-length')) || LAMA_MODEL_BYTES;
    const body = countingStream(res.body, total, (loaded) => postMessage({ id, progress: { loaded, total } }));
    try {
      // Direkt in den Cache schreiben: So liegt das Modell beim Laden nicht doppelt im Arbeitsspeicher
      await cache.put(LAMA_MODEL_URL, new Response(body, { headers: { 'content-type': 'application/octet-stream' } }));
      cached = await cache.match(LAMA_MODEL_URL);
    } catch (err) {
      if (/unvollständig/.test(err?.message)) throw err;
      cached = null; // Cache nicht nutzbar (z. B. Speicher voll): unten ohne Cache laden
    }
    if (!cached) return new Uint8Array(await (await fetch(LAMA_MODEL_URL)).arrayBuffer());
  }
  return new Uint8Array(await cached.arrayBuffer());
}

// Spart Arbeitsspeicher (gemessen in Chrome: Spitze 1,6 → 1,2 GB), rechnet dafür etwa 20 % langsamer.
// Wird auf Handys verwendet, wo der Browser nur begrenzt Speicher bekommt.
const LOW_MEMORY_OPTIONS = {
  graphOptimizationLevel: 'disabled',
  enableCpuMemArena: false,
  enableMemPattern: false,
  extra: { session: { disable_prepacking: '1' } },
};

async function createSession(bytes, threads, lowMemory) {
  ort.env.wasm.numThreads = threads;
  ort.env.logLevel = 'error'; // harmlose Hinweise nicht als Fehler in die Konsole schreiben
  // Safari führt dieses Modell mit WebGPU deutlich langsamer aus als mit dem Prozessor
  // (gemessen mit Safari 26: 12,7 s statt 6–10 s pro Rand), darum dort direkt den Prozessor nehmen
  const ua = self.navigator.userAgent;
  const isSafari = /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|Firefox\//.test(ua);
  if (self.navigator.gpu && !isSafari) {
    try {
      const s = await ort.InferenceSession.create(bytes, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all', logSeverityLevel: 3 });
      return { s, backend: 'webgpu' };
    } catch { /* WebGPU nicht nutzbar, Prozessor nehmen */ }
  }
  const options = lowMemory ? LOW_MEMORY_OPTIONS : { graphOptimizationLevel: 'all' };
  const s = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], logSeverityLevel: 3, ...options });
  return { s, backend: 'wasm' };
}

async function init(id, { threads, lowMemory }) {
  let bytes = await loadModelBytes(id);
  postMessage({ id, progress: { phase: 'prepare' } });
  const created = await createSession(bytes, threads, lowMemory);
  bytes = null; // die Sitzung hat jetzt ihre eigene Kopie
  session = created.s;
  return { backend: created.backend, threads, lowMemory };
}

async function run({ image, mask, size }) {
  const [imageName, maskName] = session.inputNames;
  const t0 = performance.now();
  const results = await session.run({
    [imageName]: new ort.Tensor('float32', image, [1, 3, size, size]),
    [maskName]: new ort.Tensor('float32', mask, [1, 1, size, size]),
  });
  const out = results[session.outputNames[0]].data;
  const output = out instanceof Float32Array ? out : Float32Array.from(out);
  return { output, ms: performance.now() - t0 };
}

onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    if (type === 'init') postMessage({ id, result: await init(id, data) });
    else if (type === 'run') {
      const result = await run(data);
      postMessage({ id, result }, [result.output.buffer]);
    }
  } catch (err) {
    postMessage({ id, error: String(err?.message ?? err) });
  }
};
