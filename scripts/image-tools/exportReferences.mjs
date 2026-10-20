// Prepara una colección de referencias para dársela a ChatGPT:
// una carpeta en output/referencias-chatgpt/<colección>/ con las imágenes
// numeradas (JPEG de 2048 px como máximo), hojas de contacto que las juntan
// con su número y referencias.txt, el texto para pegar junto a las imágenes.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export const REFERENCES = path.resolve('output/referencias-chatgpt');
const CURATION = path.resolve('output/study-room-curation');
const DATA = path.join(CURATION, '_revision/elegir');
const LONG_SIDE = 2048;
const SHEET = { width: 2400, columns: 4, gap: 16, perSheet: 16 };

export const slug = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'coleccion';

const sourceOf = (candidate) => (candidate.full.startsWith('../../')
  ? path.join(CURATION, candidate.full.slice(6))
  : path.join(DATA, candidate.full));

const label = (number, size) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size * 1.9}" height="${size * 1.3}">
  <rect width="100%" height="100%" rx="${size * 0.25}" fill="rgba(0,0,0,0.78)"/>
  <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="${size}" fill="#fff">${number}</text>
</svg>`);

const contactSheet = async (files, firstNumber, target) => {
  const { width, gap } = SHEET;
  const columns = Math.min(SHEET.columns, Math.max(2, Math.ceil(Math.sqrt(files.length))));
  const cell = Math.floor((width - gap * (columns + 1)) / columns);
  const tiles = await Promise.all(files.map(async (file) => {
    const { data, info } = await sharp(file).resize({ width: cell }).toBuffer({ resolveWithObject: true });
    return { data, height: info.height };
  }));
  const rows = [];
  for (let i = 0; i < tiles.length; i += columns) rows.push(tiles.slice(i, i + columns));
  const rowHeights = rows.map((row) => Math.max(...row.map((tile) => tile.height)));
  const height = rowHeights.reduce((sum, h) => sum + h + gap, gap);
  const layers = [];
  let y = gap;
  rows.forEach((row, r) => {
    row.forEach((tile, c) => {
      const x = gap + c * (cell + gap);
      layers.push({ input: tile.data, left: x, top: y });
      layers.push({ input: label(firstNumber + r * columns + c, 44), left: x + 12, top: y + 12 });
    });
    y += rowHeights[r] + gap;
  });
  await sharp({ create: { width, height, channels: 3, background: '#111' } }).composite(layers).jpeg({ quality: 86 }).toFile(target);
};

const promptText = (collection, entries) => {
  const lines = [`Te adjunto ${entries.length} ${entries.length === 1 ? 'imagen' : 'imágenes'} de referencia, numeradas igual que en la hoja de contacto.`];
  if (collection.nota?.trim()) lines.push('', collection.nota.trim());
  lines.push('', entries.some((entry) => entry.nota) ? 'Lo que me gusta de cada una:' : 'Las imágenes:');
  for (const entry of entries) lines.push(`${entry.number}. ${entry.title}${entry.nota ? `: ${entry.nota}` : ''}`);
  return `${lines.join('\n')}\n`;
};

export const exportCollection = async (collection) => {
  if (!collection?.items?.length) throw new Error('La colección está vacía');
  const rooms = new Map(JSON.parse(fs.readFileSync(path.join(DATA, 'data.json'), 'utf8')).map((room) => [room.room, room]));
  const folder = path.join(REFERENCES, slug(collection.nombre || 'coleccion'));
  fs.mkdirSync(folder, { recursive: true });
  // La carpeta es de la herramienta: se reemplaza lo que dejó la exportación anterior
  for (const name of fs.readdirSync(folder)) {
    if (/^(\d\d-.*\.jpg|hoja(-\d+)?\.jpg|referencias\.txt)$/.test(name)) fs.rmSync(path.join(folder, name));
  }
  const entries = [];
  for (const [index, item] of collection.items.entries()) {
    const room = rooms.get(item.room);
    const candidate = room?.candidates.find((cand) => cand.n === item.n);
    if (!candidate) throw new Error(`No encuentro la imagen ${item.n} de ${item.room}`);
    const number = index + 1;
    const file = path.join(folder, `${String(number).padStart(2, '0')}-${room.id}-${slug(item.n)}.jpg`);
    await sharp(sourceOf(candidate)).resize({ width: LONG_SIDE, height: LONG_SIDE, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toFile(file);
    entries.push({ number, file, title: room.title, nota: item.nota?.trim() ?? '' });
  }
  const sheets = [];
  for (let i = 0; i < entries.length; i += SHEET.perSheet) {
    const chunk = entries.slice(i, i + SHEET.perSheet);
    const name = entries.length > SHEET.perSheet ? `hoja-${sheets.length + 1}.jpg` : 'hoja.jpg';
    await contactSheet(chunk.map((entry) => entry.file), chunk[0].number, path.join(folder, name));
    sheets.push(name);
  }
  const text = promptText(collection, entries);
  fs.writeFileSync(path.join(folder, 'referencias.txt'), text);
  return { folder, images: entries.length, sheets, text };
};
