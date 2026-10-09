// Web Worker: lädt das LaMa-Modell (mit Browser-Cache) und führt es aus.
// Läuft getrennt von der Seite, damit diese während der Berechnung bedienbar bleibt.
import * as ort from '../../vendor/onnxruntime-web/ort.webgpu.min.mjs';
import { LAMA_MODEL_URL, LAMA_MODEL_BYTES, LAMA_CACHE_NAME } from '../config.js';

let session = null;

async function loadModelBytes(id) {
  const cache = await caches.open(LAMA_CACHE_NAME);
  const cached = await cache.match(LAMA_MODEL_URL);
  if (cached) return new Uint8Array(await cached.arrayBuffer());

  const res = await fetch(LAMA_MODEL_URL);
  if (!res.ok) throw new Error(`Download des KI-Modells fehlgeschlagen (HTTP ${res.status}).`);
  const total = Number(res.headers.get('content-length')) || LAMA_MODEL_BYTES;
  const bytes = new Uint8Array(total);
  const reader = res.body.getReader();
  let loaded = 0;
  for (;;) {
    let chunk;
    try {
      chunk = await reader.read();
    } catch (err) {
      // Firefox meldet über den Service Worker manchmal erst nach dem letzten Byte einen Stream-Fehler
      if (loaded === total) break;
      throw err;
    }
    if (chunk.done) break;
    bytes.set(chunk.value, loaded);
    loaded += chunk.value.length;
    postMessage({ id, progress: { loaded, total } });
  }
  if (loaded !== total) throw new Error('Download des KI-Modells war unvollständig. Bitte erneut versuchen.');
  // Speichern beschleunigt nur den nächsten Besuch. Wenn es scheitert (z. B. zu wenig Speicher), geht es trotzdem weiter.
  try {
    await cache.put(LAMA_MODEL_URL, new Response(new Blob([bytes]), { headers: { 'content-type': 'application/octet-stream' } }));
  } catch { /* ohne Cache weitermachen */ }
  return bytes;
}

async function createSession(bytes, threads) {
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
  const s = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all', logSeverityLevel: 3 });
  return { s, backend: 'wasm' };
}

async function init(id, { threads }) {
  const bytes = await loadModelBytes(id);
  postMessage({ id, progress: { phase: 'prepare' } });
  const { s, backend } = await createSession(bytes, threads);
  session = s;
  return { backend, threads };
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
