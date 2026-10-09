// Variante A: KI-Erweiterung mit LaMa. Läuft im Hintergrund und braucht beim ersten Mal den Modell-Download.
import { LAMA_MODEL_BYTES } from '../config.js';
import { expandWithLama } from '../lama/expand.js';
import { loadModel, isModelCached, lamaInfo } from '../lama/lama-client.js';

const MB = 1_000_000;

export const lamaVariant = {
  id: 'lama',
  name: 'KI-Erweiterung',
  description: 'Eine KI malt die fehlenden Ränder passend zum Foto weiter.',
  async: true,
  activationHint: `Antippen, um die KI zu laden (einmalig ca. ${Math.round(LAMA_MODEL_BYTES / MB)} MB)`,

  isAvailable: (job) => !!job.axis,
  isReady: () => lamaInfo.ready,
  isCached: isModelCached,

  // Lädt das Modell. onMessage bekommt einen Text für die Fortschrittsanzeige und einen Anteil 0..1.
  activate(onMessage) {
    return loadModel((p) => {
      if (p.phase === 'prepare') onMessage('KI wird vorbereitet …', 1);
      else onMessage(`KI wird geladen … ${Math.round(p.loaded / MB)} von ${Math.round(p.total / MB)} MB`, p.loaded / p.total);
    });
  },

  render(job, { onMessage, isCurrent }) {
    return expandWithLama(job, {
      isCurrent,
      onProgress: ({ done, total }) => onMessage(`KI rechnet … Rand ${Math.min(done + 1, total)} von ${total}`, done / total),
    });
  },
};
