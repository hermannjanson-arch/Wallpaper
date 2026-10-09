// Automatische Auswahl: welche Varianten gezeigt werden und in welcher Reihenfolge (beste zuerst).
// Grundlage ist der Anteil der Fläche, die gefüllt werden muss. Die Schwellen stehen in config.js.
import { FILL_SMALL, FILL_LARGE } from './config.js';

export function rankVariantIds(job) {
  if (!job.axis) return ['exact'];                      // Foto passt schon genau
  if (job.share <= FILL_SMALL) return ['seam', 'lama']; // klein: Strecken ist unauffällig
  if (job.share <= FILL_LARGE) return ['lama', 'blur']; // mittel: KI kann den Rand gut ergänzen
  return ['combo', 'blur', 'lama'];                     // groß: KI allein wird außen verwaschen
}
