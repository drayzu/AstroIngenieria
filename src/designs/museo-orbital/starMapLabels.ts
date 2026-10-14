import type { MapLabel } from './starMapRender';

/* Rótulos del mapa estelar: números en mono y títulos en Fraunces, dibujados
   una sola vez en un lienzo 2D del hilo principal (que ya tiene las fuentes
   del museo) y enviados al worker como atlas. Allí viajan pegados a cada
   estrella sin costo para la página. */

export type MapLabelEntry = { number: string; title: string };

const SERIF = "'Fraunces Variable', Georgia, 'Times New Roman', serif";
const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
const PAD = 3;
const ATLAS_WIDTH = 1024;

type Piece = {
  index: number;
  kind: 0 | 1 | 2;
  text: string;
  font: string;
  spacing: number;
  // Posición respecto de la estrella (px CSS); la vertical, centrada
  ox: number;
  oy: number;
  width: number;
  height: number;
  extent: number;
};

export const drawMapLabels = async (entries: MapLabelEntry[], hereText: string, dpr: number) => {
  try {
    await Promise.all([
      document.fonts.load(`460 18px ${SERIF}`),
      document.fonts.load(`500 10px ${MONO}`),
    ]);
  } catch {
    // Con la fuente de respaldo también se lee
  }
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;
  const spaced = typeof (context as { letterSpacing?: unknown }).letterSpacing === 'string';

  const measure = (text: string, font: string, spacing: number) => {
    context.font = font;
    const metrics = context.measureText(text);
    return metrics.width + Math.max(0, text.length - 1) * spacing;
  };

  const pieces: Piece[] = [];
  entries.forEach((entry, index) => {
    const numberFont = `500 ${10.5 * dpr}px ${MONO}`;
    const titleFont = `460 ${18 * dpr}px ${SERIF}`;
    const numberSpacing = 1.6 * dpr;
    const numberWidth = entry.number ? measure(entry.number, numberFont, numberSpacing) / dpr : 0;
    const titleWidth = measure(entry.title, titleFont, 0) / dpr;
    // Arriba a la derecha de la estrella: la ruta pasa por su centro sin tocar el rótulo
    const lead = index === 0 ? 10 : 13;
    const rise = index === 0 ? -9 : -14;
    const titleX = entry.number ? lead + numberWidth + 9 : lead;
    const extent = titleX + titleWidth;
    if (entry.number) {
      pieces.push({ index, kind: 0, text: entry.number, font: numberFont, spacing: numberSpacing, ox: lead, oy: rise + 1, width: numberWidth, height: 14, extent });
    }
    pieces.push({ index, kind: 1, text: entry.title, font: titleFont, spacing: 0, ox: titleX, oy: rise, width: titleWidth, height: 26, extent });
  });
  if (hereText) {
    const font = `500 ${8.5 * dpr}px ${MONO}`;
    const spacing = 2.8 * dpr;
    const text = hereText.toUpperCase();
    const width = measure(text, font, spacing) / dpr;
    // Sobre la retícula, centrado: abajo baja el tallo y a la derecha va el
    // número. Se dibuja una vez y se ancla a todos los puntos: el shader
    // muestra solo el actual
    pieces.push({ index: -1, kind: 2, text, font, spacing, ox: -width / 2, oy: -37, width, height: 12, extent: width });
  }

  // Estantes simples: cada rótulo en su caja con un margen para el suavizado
  let x = 0;
  let y = 0;
  let row = 0;
  const placed = pieces.map((piece) => {
    const w = Math.ceil(piece.width * dpr) + PAD * 2;
    const h = Math.ceil(piece.height * dpr) + PAD * 2;
    if (x + w > ATLAS_WIDTH) {
      x = 0;
      y += row;
      row = 0;
    }
    const at = { piece, u: x, v: y, w, h };
    x += w + 1;
    row = Math.max(row, h + 1);
    return at;
  });
  canvas.width = ATLAS_WIDTH;
  canvas.height = Math.max(1, y + row);
  context.fillStyle = '#fff';
  context.textBaseline = 'middle';
  for (const { piece, u, v, h } of placed) {
    context.font = piece.font;
    const middle = v + h / 2;
    if (spaced) {
      context.letterSpacing = `${piece.spacing}px`;
      context.fillText(piece.text, u + PAD, middle);
    } else {
      // Sin letterSpacing en el lienzo: letra por letra
      let cursor = u + PAD;
      for (const char of piece.text) {
        context.fillText(char, cursor, middle);
        cursor += context.measureText(char).width + piece.spacing;
      }
    }
  }

  const labels: MapLabel[] = placed.map(({ piece, u, v, w, h }) => ({
    index: piece.index,
    kind: piece.kind,
    // La caja incluye el margen: se corre para que el texto quede donde va
    ox: piece.ox - PAD / dpr,
    oy: piece.oy - h / dpr / 2,
    w,
    h,
    u,
    v,
    extent: piece.extent,
  }));
  const image = await createImageBitmap(canvas);
  return { image, labels, width: canvas.width, height: canvas.height };
};
