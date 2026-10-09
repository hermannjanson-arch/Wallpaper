// Geräteliste laden, durchsuchen und das aktuelle Handy erkennen.
import { slugify } from './image-io.js';

export async function loadDevices() {
  const res = await fetch('data/devices.json');
  const data = await res.json();
  return data.geraete.map((d) => {
    const screenLabel = d.bildschirm ? ` (${d.bildschirm[0].toUpperCase()}${d.bildschirm.slice(1)}display)` : '';
    const label = `${d.hersteller} ${d.modell}${screenLabel}`;
    return {
      ...d,
      label,
      shortLabel: `${d.modell}${screenLabel}`,
      slug: slugify(`${d.modell}${d.bildschirm ? ' ' + d.bildschirm : ''}`),
      w: d.breite,
      h: d.hoehe,
      searchText: `${label} ${d.jahr} ${d.breite}x${d.hoehe}`.toLowerCase(),
    };
  });
}

// Alle Suchwörter müssen vorkommen, z. B. "pixel 9 pro" oder "samsung 2024"
export function searchDevices(devices, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return devices;
  const phrase = words.join(' ');
  const hits = devices.filter((d) => words.every((w) => d.searchText.includes(w)));
  // Treffer, die den Suchtext am Stück enthalten, zuerst; davon die kürzesten Namen (genauester Treffer)
  const rank = (d) => (d.label.toLowerCase().includes(phrase) ? 0 : 1);
  return hits.sort((a, b) => rank(a) - rank(b) || (rank(a) === 0 ? a.label.length - b.label.length : 0));
}

// Erkennt die Bildschirmauflösung, wenn die Seite auf einem Handy geöffnet wird.
// Hinweis: Manche Android-Handys sind ab Werk auf eine niedrigere Auflösung eingestellt,
// darum ist das nur ein Vorschlag.
export function detectScreen(devices) {
  const isPhone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 600;
  if (!isPhone) return null;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(Math.min(screen.width, screen.height) * dpr);
  const h = Math.round(Math.max(screen.width, screen.height) * dpr);
  const near = (a, b) => Math.abs(a - b) <= 4;
  const matches = devices.filter((d) => near(d.w, w) && near(d.h, h));
  return { w, h, matches };
}
