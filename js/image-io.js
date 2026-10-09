// Fotos einlesen (mit EXIF-Drehung und Größenbegrenzung) und Ergebnisse speichern.
import { MAX_SOURCE_SIDE, MAX_SOURCE_PIXELS, JPEG_QUALITY } from './config.js';

export function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

export function context2d(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

// Verkleinert in Halbierungsschritten. Ein einzelner großer Schritt sieht in Safari pixelig aus.
function drawScaled(img, srcW, srcH, w, h) {
  let cur = img, cw = srcW, ch = srcH;
  while (cw / 2 >= w && ch / 2 >= h) {
    const step = makeCanvas(Math.round(cw / 2), Math.round(ch / 2));
    context2d(step).drawImage(cur, 0, 0, step.width, step.height);
    cur = step; cw = step.width; ch = step.height;
  }
  const out = makeCanvas(w, h);
  context2d(out).drawImage(cur, 0, 0, w, h);
  return out;
}

// Liest ein Foto als Canvas ein. Der Browser dreht Handyfotos dabei anhand der EXIF-Angabe richtig herum.
export async function loadImageFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error('Dieses Bild kann dein Browser nicht öffnen. Bitte als JPEG oder PNG speichern und erneut versuchen. (HEIC-Fotos funktionieren z. B. nur in Safari.)');
    }
    const srcW = img.naturalWidth, srcH = img.naturalHeight;
    const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(srcW, srcH), Math.sqrt(MAX_SOURCE_PIXELS / (srcW * srcH)));
    const w = Math.max(1, Math.round(srcW * scale)), h = Math.max(1, Math.round(srcH * scale));
    const canvas = drawScaled(img, srcW, srcH, w, h);
    const name = (file.name || 'foto').replace(/\.[^.]+$/, '');
    return { canvas, width: w, height: h, name, originalWidth: srcW, originalHeight: srcH };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function slugify(text) {
  return text.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/\+/g, '-plus')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'foto';
}

export function buildFileName(photoName, deviceSlug, W, H, format) {
  return `${slugify(photoName)}_${deviceSlug}_${W}x${H}.${format === 'png' ? 'png' : 'jpg'}`;
}

export function canvasToBlob(canvas, format) {
  return new Promise((resolve, reject) => {
    const type = format === 'png' ? 'image/png' : 'image/jpeg';
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Bild konnte nicht erzeugt werden.'))), type, JPEG_QUALITY);
  });
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// Auf Handys: Teilen-Menü (z. B. "Bild sichern" in die Fotos-App), wenn der Browser das kann
export function canShareFile(blob, fileName) {
  try {
    return !!navigator.canShare?.({ files: [new File([blob], fileName, { type: blob.type })] });
  } catch {
    return false;
  }
}

export async function shareBlob(blob, fileName) {
  await navigator.share({ files: [new File([blob], fileName, { type: blob.type })] });
}
