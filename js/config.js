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

// KI-Erweiterung (LaMa)
export const LAMA_MODEL_URL = 'https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx';
export const LAMA_MODEL_BYTES = 208044816;  // für die Fortschrittsanzeige, falls der Server keine Größe meldet
export const LAMA_CACHE_NAME = 'lama-model-v1';
export const LAMA_SIZE = 512;               // feste Eingabegröße des Modells
export const LAMA_MASK_DILATE = 4;          // Maske ragt so viele Modell-Pixel ins Original (gegen Kanten-Artefakte)
export const LAMA_FEATHER = 48;             // weicher Übergang zum Original in Ziel-Pixeln (16 war im Test sichtbar)
export const LAMA_GRAIN = 1;                // Korn auf der ergänzten Fläche, passend zum Rauschen des Originals (0 = aus)
export const LAMA_STEPS = 1;                // Schritte für große Ränder. Im Test sahen 2 Schritte schlechter aus als 1
export const LAMA_MAX_THREADS = 4;          // mehr Threads waren im Test langsamer (Effizienzkerne)
export const LAMA_RECOMPUTE_DELAY = 500;    // Wartezeit (ms) nach dem Verschieben, bevor die KI neu rechnet

// Export
export const JPEG_QUALITY = 0.92;

// Vorauswahl, wenn kein Handy erkannt wurde
export const DEFAULT_DEVICE = 'Apple iPhone 17 Pro';
