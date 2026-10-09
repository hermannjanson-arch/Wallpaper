// Erweitert ein Foto mit LaMa auf die Zielfläche.
// Ablauf pro Rand: ein quadratisches Fenster (Lücke + angrenzendes Original) auf 512×512 verkleinern,
// von LaMa füllen lassen, wieder hochskalieren und nur die Lücke plus einen weichen Übergang übernehmen.
// Das Original bleibt in voller Auflösung erhalten.
import { LAMA_SIZE, LAMA_MASK_DILATE, LAMA_FEATHER, LAMA_GRAIN, LAMA_STEPS } from '../config.js';
import { makeCanvas, context2d } from '../image-io.js';
import { inpaint } from './lama-client.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Bekannter Bereich nach Anteil t (0 = nur Original, 1 = ganze Fläche)
function grownRect(rect, W, H, t) {
  const x0 = Math.round(rect.x * (1 - t)), y0 = Math.round(rect.y * (1 - t));
  const x1 = Math.round(rect.x + rect.w + (W - rect.x - rect.w) * t);
  const y1 = Math.round(rect.y + rect.h + (H - rect.y - rect.h) * t);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Kanten des bekannten Bereichs, an denen in diesem Schritt etwas ergänzt wird
function openEdges(known, fill) {
  return {
    top: known.y > fill.y,
    bottom: known.y + known.h < fill.y + fill.h,
    left: known.x > fill.x,
    right: known.x + known.w < fill.x + fill.w,
  };
}

// Quadratische Fenster, jeweils bündig an der Außenkante des zu füllenden Bereichs
function windowsFor(W, H, known, fill) {
  const S = Math.min(W, H);
  const cx = Math.round(clamp(known.x + known.w / 2 - S / 2, 0, W - S));
  const cy = Math.round(clamp(known.y + known.h / 2 - S / 2, 0, H - S));
  const e = openEdges(known, fill);
  const wins = [];
  if (e.top) wins.push({ x: cx, y: clamp(fill.y, 0, H - S) });
  if (e.bottom) wins.push({ x: cx, y: clamp(fill.y + fill.h - S, 0, H - S) });
  if (e.left) wins.push({ x: clamp(fill.x, 0, W - S), y: cy });
  if (e.right) wins.push({ x: clamp(fill.x + fill.w - S, 0, W - S), y: cy });
  const seen = new Set();
  return wins.filter((w) => { const k = `${w.x},${w.y}`; return !seen.has(k) && seen.add(k); }).map((w) => ({ ...w, S }));
}

// Abstand eines Punkts im bekannten Bereich zur nächsten offenen Kante (Infinity, wenn keine offen ist)
function edgeDistance(gx, gy, known, edges) {
  let d = Infinity;
  if (edges.top) d = Math.min(d, gy - known.y);
  if (edges.bottom) d = Math.min(d, known.y + known.h - 1 - gy);
  if (edges.left) d = Math.min(d, gx - known.x);
  if (edges.right) d = Math.min(d, known.x + known.w - 1 - gx);
  return d;
}

const inside = (gx, gy, r) => gx >= r.x && gx < r.x + r.w && gy >= r.y && gy < r.y + r.h;

async function fillWindow(work, wctx, win, known, fill, coverage, W, opts) {
  const { x, y, S } = win;
  const N = LAMA_SIZE * LAMA_SIZE, k = S / LAMA_SIZE;
  const edges = openEdges(known, fill);

  // 1. Fenster auf Modellgröße verkleinern und Maske bauen
  const small = makeCanvas(LAMA_SIZE, LAMA_SIZE);
  const sctx = context2d(small);
  sctx.drawImage(work, x, y, S, S, 0, 0, LAMA_SIZE, LAMA_SIZE);
  const px = sctx.getImageData(0, 0, LAMA_SIZE, LAMA_SIZE).data;
  const image = new Float32Array(3 * N), mask = new Float32Array(N);
  const dilate = LAMA_MASK_DILATE * k;
  for (let j = 0; j < N; j++) {
    const gx = x + ((j % LAMA_SIZE) + 0.5) * k, gy = y + (Math.floor(j / LAMA_SIZE) + 0.5) * k;
    const known_ = inside(gx, gy, known) && edgeDistance(gx, gy, known, edges) >= dilate;
    mask[j] = known_ ? 0 : 1;
    if (known_) for (let c = 0; c < 3; c++) image[c * N + j] = px[j * 4 + c] / 255;
  }

  // 2. LaMa rechnen lassen
  const out = await inpaint(image, mask);
  let max = 0;
  for (let j = 0; j < out.length; j += 101) max = Math.max(max, out[j]);
  const scale = max > 2 ? 1 : 255; // Ausgabe kommt als 0..255; zur Sicherheit auch 0..1 erkennen

  const outCanvas = makeCanvas(LAMA_SIZE, LAMA_SIZE);
  const octx = context2d(outCanvas);
  const od = octx.createImageData(LAMA_SIZE, LAMA_SIZE);
  for (let j = 0; j < N; j++) {
    for (let c = 0; c < 3; c++) od.data[j * 4 + c] = out[c * N + j] * scale;
    od.data[j * 4 + 3] = 255;
  }
  octx.putImageData(od, 0, 0);

  // 3. Hochskalieren und nur Lücke + weichen Übergang übernehmen
  const up = makeCanvas(S, S);
  const uctx = context2d(up);
  uctx.drawImage(outCanvas, 0, 0, S, S);
  const ud = uctx.getImageData(0, 0, S, S);
  const feather = opts.feather;
  for (let yy = 0; yy < S; yy++) {
    const gy = y + yy;
    for (let xx = 0; xx < S; xx++) {
      const gx = x + xx;
      let a = 0;
      if (inside(gx, gy, fill)) {
        a = inside(gx, gy, known) ? clamp(1 - edgeDistance(gx, gy, known, edges) / feather, 0, 1) : 1;
      }
      ud.data[(yy * S + xx) * 4 + 3] = Math.round(a * 255);
      const gi = gy * W + gx;
      if (a > coverage[gi]) coverage[gi] = a;
    }
  }
  uctx.putImageData(ud, 0, 0);
  wctx.drawImage(up, x, y);
}

// Schätzt das feine Bildrauschen des Originals (robust gegen Kanten über den Median)
function estimateNoise(ctx, rect) {
  const step = Math.max(1, Math.floor(Math.sqrt((rect.w * rect.h) / 40000)));
  const d = ctx.getImageData(rect.x, rect.y, rect.w, rect.h).data;
  const diffs = [];
  for (let yy = 0; yy < rect.h; yy += step) {
    for (let xx = 0; xx < rect.w - 1; xx += step) {
      const i = (yy * rect.w + xx) * 4;
      const l1 = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const l2 = 0.299 * d[i + 4] + 0.587 * d[i + 5] + 0.114 * d[i + 6];
      diffs.push(Math.abs(l1 - l2));
    }
  }
  diffs.sort((a, b) => a - b);
  return (1.4826 * diffs[diffs.length >> 1]) / Math.SQRT2;
}

// Feines Korn auf die ergänzte Fläche, damit sie nicht glatter wirkt als das Original
function addGrain(ctx, coverage, W, H, sigma) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0, p = 0; p < coverage.length; p++, i += 4) {
    const a = coverage[p];
    if (!a) continue;
    // Näherung einer Normalverteilung aus drei Zufallszahlen
    const n = (Math.random() + Math.random() + Math.random() - 1.5) * 2 * sigma * a;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// job: { source, W, H, rect }. onProgress({ done, total }), isCurrent() → false bricht ab.
export async function expandWithLama(job, { onProgress, isCurrent = () => true, ...overrides } = {}) {
  const opts = { feather: LAMA_FEATHER, grain: LAMA_GRAIN, steps: LAMA_STEPS, ...overrides };
  const { source, W, H, rect } = job;
  const work = makeCanvas(W, H);
  const wctx = context2d(work);
  wctx.drawImage(source, rect.x, rect.y, rect.w, rect.h);
  if (rect.w === W && rect.h === H) return work;

  // Mehrere Schritte nur, wenn ein Rand so breit ist, dass das Fenster kaum noch Original enthält
  const S = Math.min(W, H);
  const maxGap = Math.max(rect.y, H - rect.y - rect.h, rect.x, W - rect.x - rect.w);
  const steps = overrides.steps ?? Math.max(opts.steps, Math.ceil(maxGap / (S * 0.85)));

  const plan = [];
  for (let s = 0; s < steps; s++) {
    const known = grownRect(rect, W, H, s / steps), fill = grownRect(rect, W, H, (s + 1) / steps);
    plan.push({ known, fill, wins: windowsFor(W, H, known, fill) });
  }
  const total = plan.reduce((n, p) => n + p.wins.length, 0);
  const coverage = new Float32Array(W * H);
  let done = 0;
  onProgress?.({ done, total });
  for (const { known, fill, wins } of plan) {
    for (const win of wins) {
      if (!isCurrent()) throw new Error('stale');
      await fillWindow(work, wctx, win, known, fill, coverage, W, opts);
      onProgress?.({ done: ++done, total });
    }
  }

  if (opts.grain > 0) addGrain(wctx, coverage, W, H, estimateNoise(wctx, rect) * opts.grain);
  return work;
}
