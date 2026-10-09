// Web Worker: Seam Carving (inhaltsbasiertes Strecken).
// Fügt Pixelstreifen ("Seams") dort ein, wo das Bild wenig Struktur hat, z. B. im Himmel,
// und lässt wichtige Objekte unverzerrt. Für die Geschwindigkeit werden die Seams auf einer
// verkleinerten Kopie gesucht; das Ergebnis ist eine Verschiebungskarte, mit der das Foto
// anschließend in voller Auflösung neu abgetastet wird.

const WORK_MAX_W = 360;   // Breite der Arbeitskopie (in Streckrichtung)
const WORK_MAX_H = 720;
const PENALTY = 60;       // macht frisch eingefügte Seams "teuer", damit sich neue Seams verteilen

// Tauscht Zeilen und Spalten (damit immer nur Spalten eingefügt werden müssen)
function transpose(px, w, h) {
  const out = new Uint8ClampedArray(px.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, j = (x * h + y) * 4;
      out[j] = px[i]; out[j + 1] = px[i + 1]; out[j + 2] = px[i + 2]; out[j + 3] = px[i + 3];
    }
  }
  return out;
}

// Helligkeit der Arbeitskopie: Mittelwert über Blöcke des Originals
function downscaleLuma(px, w, h, lw, lh) {
  const sum = new Float32Array(lw * lh), cnt = new Float32Array(lw * lh);
  for (let y = 0; y < h; y++) {
    const ly = Math.min(lh - 1, Math.floor((y * lh) / h));
    for (let x = 0; x < w; x++) {
      const lx = Math.min(lw - 1, Math.floor((x * lw) / w));
      const i = (y * w + x) * 4;
      sum[ly * lw + lx] += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      cnt[ly * lw + lx]++;
    }
  }
  for (let i = 0; i < sum.length; i++) sum[i] /= cnt[i] || 1;
  return sum;
}

// Fügt k Spalten-Seams in die Arbeitskopie ein. Liefert für jede Zeile, von welcher
// (gebrochenen) Spalte des Originals jedes Ausgabepixel stammt.
function insertSeams(luma, lw, lh, k) {
  const stride = lw + k;
  const lum = new Float32Array(stride * lh), src = new Float32Array(stride * lh), pen = new Float32Array(stride * lh);
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) { lum[y * stride + x] = luma[y * lw + x]; src[y * stride + x] = x; }
  }
  const energy = new Float32Array(stride * lh), cost = new Float32Array(stride * lh);
  const seam = new Int32Array(lh);

  for (let cw = lw; cw < lw + k; cw++) {
    // Energie = Helligkeitsunterschiede zu den Nachbarn + Strafe für schon eingefügte Seams
    for (let y = 0; y < lh; y++) {
      const r = y * stride, up = Math.max(0, y - 1) * stride, dn = Math.min(lh - 1, y + 1) * stride;
      for (let x = 0; x < cw; x++) {
        const l = Math.max(0, x - 1), rr = Math.min(cw - 1, x + 1);
        energy[r + x] = Math.abs(lum[r + rr] - lum[r + l]) + Math.abs(lum[dn + x] - lum[up + x]) + pen[r + x];
      }
    }
    // Günstigster Weg von oben nach unten (dynamische Programmierung)
    for (let x = 0; x < cw; x++) cost[x] = energy[x];
    for (let y = 1; y < lh; y++) {
      const r = y * stride, p = r - stride;
      for (let x = 0; x < cw; x++) {
        let m = cost[p + x];
        if (x > 0 && cost[p + x - 1] < m) m = cost[p + x - 1];
        if (x < cw - 1 && cost[p + x + 1] < m) m = cost[p + x + 1];
        cost[r + x] = energy[r + x] + m;
      }
    }
    let bx = 0;
    const last = (lh - 1) * stride;
    for (let x = 1; x < cw; x++) if (cost[last + x] < cost[last + bx]) bx = x;
    seam[lh - 1] = bx;
    for (let y = lh - 2; y >= 0; y--) {
      const r = y * stride, px = seam[y + 1];
      let best = px;
      if (px > 0 && cost[r + px - 1] < cost[r + best]) best = px - 1;
      if (px < cw - 1 && cost[r + px + 1] < cost[r + best]) best = px + 1;
      seam[y] = best;
    }
    // Seam einfügen: neues Pixel = Mittel aus Seam-Pixel und rechtem Nachbarn
    for (let y = 0; y < lh; y++) {
      const r = y * stride, s = seam[y], n = Math.min(cw - 1, s + 1);
      for (let x = cw; x > s + 1; x--) { lum[r + x] = lum[r + x - 1]; src[r + x] = src[r + x - 1]; pen[r + x] = pen[r + x - 1]; }
      lum[r + s + 1] = (lum[r + s] + lum[r + n]) / 2;
      src[r + s + 1] = (src[r + s] + src[r + n]) / 2;
      pen[r + s] += PENALTY; pen[r + s + 1] = pen[r + s];
    }
  }
  return { src, stride };
}

// Original in voller Auflösung mit der (geglätteten) Verschiebungskarte neu abtasten
function resample(px, w, h, outW, src, stride, lw, lh) {
  const out = new Uint8ClampedArray(outW * h * 4);
  const lwOut = stride;
  const sx = new Float32Array(outW);
  for (let y = 0; y < h; y++) {
    const ly = Math.min(lh - 1, Math.max(0, ((y + 0.5) * lh) / h - 0.5));
    const y0 = Math.floor(ly), y1 = Math.min(lh - 1, y0 + 1), ty = ly - y0;
    for (let x = 0; x < outW; x++) {
      const lx = Math.min(lwOut - 1, Math.max(0, ((x + 0.5) * lwOut) / outW - 0.5));
      const x0 = Math.floor(lx), x1 = Math.min(lwOut - 1, x0 + 1), tx = lx - x0;
      const a = src[y0 * stride + x0] * (1 - tx) + src[y0 * stride + x1] * tx;
      const b = src[y1 * stride + x0] * (1 - tx) + src[y1 * stride + x1] * tx;
      sx[x] = Math.min(w - 1, Math.max(0, ((a * (1 - ty) + b * ty + 0.5) * w) / lw - 0.5));
    }
    const row = y * w * 4, orow = y * outW * 4;
    for (let x = 0; x < outW; x++) {
      const f = sx[x], x0 = Math.floor(f), x1 = Math.min(w - 1, x0 + 1), t = f - x0;
      const i0 = row + x0 * 4, i1 = row + x1 * 4, o = orow + x * 4;
      out[o] = px[i0] * (1 - t) + px[i1] * t;
      out[o + 1] = px[i0 + 1] * (1 - t) + px[i1 + 1] * t;
      out[o + 2] = px[i0 + 2] * (1 - t) + px[i1 + 2] * t;
      out[o + 3] = 255;
    }
  }
  return out;
}

// pixels: RGBA des Originals in Größe w×h, Ziel outW×outH (eine der beiden Seiten ist gleich)
function carve({ pixels, w, h, outW, outH }) {
  const vertical = outH > h; // Zeilen einfügen → über Transponieren auf Spalten zurückführen
  let px = pixels, W0 = w, H0 = h, OW = outW;
  if (vertical) { px = transpose(pixels, w, h); W0 = h; H0 = w; OW = outH; }

  const ls = Math.min(1, WORK_MAX_W / W0, WORK_MAX_H / H0);
  const lw = Math.max(2, Math.round(W0 * ls)), lh = Math.max(2, Math.round(H0 * ls));
  const k = Math.max(1, Math.round((OW * lw) / W0) - lw);
  const { src, stride } = insertSeams(downscaleLuma(px, W0, H0, lw, lh), lw, lh, k);
  let out = resample(px, W0, H0, OW, src, stride, lw, lh);
  if (vertical) out = transpose(out, OW, H0);
  return out;
}

onmessage = ({ data }) => {
  try {
    const out = carve(data);
    postMessage({ id: data.id, result: out }, [out.buffer]);
  } catch (err) {
    postMessage({ id: data.id, error: String(err?.message ?? err) });
  }
};
