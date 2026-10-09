// Web Worker: lädt das LaMa-Modell (mit Cache) und führt es aus.
// Läuft getrennt von der Seite, damit diese während der Berechnung nicht einfriert.
import * as ort from '../vendor/onnxruntime-web/ort.webgpu.min.mjs';

const MODEL_URL = 'https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx';
const MODEL_BYTES = 208044816; // Fallback, falls der Server keine Größe meldet
const CACHE_NAME = 'lama-model-v1';

let session = null;

async function loadModelBytes() {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(MODEL_URL);
  if (cached) {
    postMessage({ type: 'progress', phase: 'cache', loaded: 1, total: 1 });
    return new Uint8Array(await cached.arrayBuffer());
  }

  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Modell-Download fehlgeschlagen: HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || MODEL_BYTES;
  const bytes = new Uint8Array(total);
  const reader = res.body.getReader();
  let loaded = 0;
  for (;;) {
    let chunk;
    try {
      chunk = await reader.read();
    } catch (err) {
      // Firefox meldet über den Service Worker manchmal erst NACH dem letzten Byte einen Stream-Fehler
      if (loaded === total) { postMessage({ type: 'warning', message: `Stream-Fehler nach vollständigem Download ignoriert: ${err?.message ?? err}` }); break; }
      throw err;
    }
    const { done, value } = chunk;
    if (done) break;
    bytes.set(value, loaded);
    loaded += value.length;
    postMessage({ type: 'progress', phase: 'download', loaded, total });
  }
  // Speichern ist nur eine Beschleunigung für den nächsten Besuch. Schlägt es fehl, geht es trotzdem weiter.
  try {
    await cache.put(MODEL_URL, new Response(new Blob([bytes]), { headers: { 'content-type': 'application/octet-stream' } }));
  } catch (err) {
    postMessage({ type: 'warning', message: `Modell konnte nicht im Cache gespeichert werden: ${err?.message ?? err}` });
  }
  return bytes;
}

async function init({ ep, threads }) {
  const t0 = performance.now();
  const bytes = await loadModelBytes();
  const tLoaded = performance.now();

  ort.env.wasm.numThreads = threads;
  session = await ort.InferenceSession.create(bytes, {
    executionProviders: ep === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm'],
    graphOptimizationLevel: 'all',
  });
  const tSession = performance.now();

  postMessage({
    type: 'ready',
    inputNames: session.inputNames,
    outputNames: session.outputNames,
    loadMs: tLoaded - t0,
    sessionMs: tSession - tLoaded,
    crossOriginIsolated: self.crossOriginIsolated,
    hasWebGPU: !!self.navigator.gpu,
  });
}

async function run({ image, mask, size }) {
  const [imageName, maskName] = session.inputNames;
  const feeds = {
    [imageName]: new ort.Tensor('float32', image, [1, 3, size, size]),
    [maskName]: new ort.Tensor('float32', mask, [1, 1, size, size]),
  };
  const t0 = performance.now();
  const results = await session.run(feeds);
  const ms = performance.now() - t0;
  const out = results[session.outputNames[0]];
  const data = out.data instanceof Float32Array ? out.data : Float32Array.from(out.data);
  postMessage({ type: 'result', output: data, dims: out.dims, ms }, [data.buffer]);
}

onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') await init(data);
    else if (data.type === 'run') await run(data);
  } catch (err) {
    postMessage({ type: 'error', message: String(err?.message ?? err) });
  }
};
