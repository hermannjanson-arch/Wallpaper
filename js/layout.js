// Berechnet, wo das Original in der Zielfläche liegt ("contain": vollständig sichtbar, nicht verzerrt).

// offset 0..1 verschiebt das Original entlang der Achse, auf der Platz frei ist (0.5 = mittig).
export function containRect(srcW, srcH, W, H, offset = 0.5) {
  const s = Math.min(W / srcW, H / srcH);
  const w = Math.min(W, Math.round(srcW * s));
  const h = Math.min(H, Math.round(srcH * s));
  return { x: Math.round((W - w) * offset), y: Math.round((H - h) * offset), w, h };
}

// Anteil der Zielfläche, die gefüllt werden muss (0..1)
export function fillShare(rect, W, H) {
  return 1 - (rect.w * rect.h) / (W * H);
}

// 'x' = links/rechts ist Platz frei, 'y' = oben/unten, null = Formate passen genau
export function freeAxis(rect, W, H) {
  if (rect.w < W) return 'x';
  if (rect.h < H) return 'y';
  return null;
}
