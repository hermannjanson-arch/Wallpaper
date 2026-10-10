// Variante A: KI-Erweiterung mit LaMa. Läuft im Hintergrund und braucht beim ersten Mal den Modell-Download.
import { LAMA_MODEL_BYTES } from '../config.js';
import { expandWithLama } from '../lama/expand.js';
import { loadModel, isModelCached, lamaInfo, lastCrash } from '../lama/lama-client.js';

const MB = 1_000_000;

// Das KI-Ergebnis wird auch von der Kombination genutzt, darum wird es pro Auftrag nur einmal berechnet
let shared = { key: null, promise: null, listeners: new Set() };

function expandShared(job, { onMessage, isCurrent }) {
  if (shared.key !== job.key) {
    const entry = { key: job.key, listeners: new Set() };
    entry.promise = expandWithLama(job, {
      isCurrent,
      onProgress: ({ done, total }) => {
        for (const l of entry.listeners) l(`KI rechnet … Rand ${Math.min(done + 1, total)} von ${total}`, done / total);
      },
    });
    entry.promise.catch(() => { if (shared === entry) shared = { key: null, listeners: new Set() }; });
    shared = entry;
  }
  shared.listeners.add(onMessage);
  return shared.promise;
}

export const lamaVariant = {
  id: 'lama',
  name: 'KI-Erweiterung',
  description: 'Eine KI malt die fehlenden Ränder passend zum Foto weiter.',
  async: true,
  activationKey: 'lama',
  activationHint: lastCrash
    ? 'Auf diesem Gerät abgestürzt. Antippen für neuen Versuch.'
    : `Antippen, um die KI zu laden (einmalig ca. ${Math.round(LAMA_MODEL_BYTES / MB)} MB)`,
  lastCrash,
  crashNotice: 'Die KI braucht mehr Arbeitsspeicher, als der Browser auf diesem Gerät erlaubt, und ist beim letzten Versuch abgestürzt. '
    + 'Tipp: Die Seite am Computer öffnen und das fertige Bild z. B. per AirDrop aufs Handy schicken.',

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

  expand: expandShared,

  render(job, opts) {
    return expandShared(job, opts);
  },
};
