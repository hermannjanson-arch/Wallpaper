// Zentrale Einstellungen. Hier kannst du Werte nach dem Testen anpassen.

// Anteil der zu füllenden Fläche, ab dem eine andere Variante empfohlen wird (0.15 = 15 %)
export const FILL_SMALL = 0.15;   // bis hier: Seam Carving + KI
export const FILL_LARGE = 0.45;   // ab hier: Kombination + Unschärfe

// Seam Carving wird nur bis zu dieser Streckung angeboten (0.18 = 18 %)
export const SEAM_MAX_STRETCH = 0.18;

// Eingelesene Fotos werden auf diese Größe begrenzt, damit große Handyfotos (z. B. 48 MP)
// den Browser nicht überlasten. 12 MP liegt sicher unter der Canvas-Grenze von iPhones.
export const MAX_SOURCE_SIDE = 4096;
export const MAX_SOURCE_PIXELS = 12_000_000;

// Unschärfe-Hintergrund
export const BLUR_WORK_SCALE = 1 / 8;   // Hintergrund wird verkleinert weichgezeichnet (schnell und weich)
export const BLUR_RADIUS = 0.035;       // Unschärfe-Radius relativ zur längeren Seite
export const BLUR_DARKEN = 0.22;        // Abdunkeln: 0 = gar nicht, 1 = schwarz

// Export
export const JPEG_QUALITY = 0.92;

// Vorauswahl, wenn kein Handy erkannt wurde
export const DEFAULT_DEVICE = 'Apple iPhone 17 Pro';
