// Sonderfall: Das Foto hat schon genau das Zielformat und wird nur auf die Zielgröße gebracht.
import { makeCanvas, context2d } from '../image-io.js';

export const exactVariant = {
  id: 'exact',
  name: 'Passt genau',
  description: 'Das Foto hat schon das richtige Format und wird nur auf die passende Größe gebracht.',
  isAvailable: (job) => !job.axis,
  render({ source, W, H }) {
    const out = makeCanvas(W, H);
    context2d(out).drawImage(source, 0, 0, W, H);
    return out;
  },
};
