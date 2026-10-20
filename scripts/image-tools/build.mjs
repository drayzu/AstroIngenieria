// Prepara los datos de las herramientas de imágenes (npm run imagenes).
// Genera data.json (salas, candidatas e imagen actual de cada obra) y
// miniaturas WebP en output/study-room-curation/_revision/elegir/.
// Hay que volver a ejecutarlo cuando llegan imágenes nuevas a elegida/:
//   npm run imagenes:actualizar
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createServer } from 'vite';

const ROOT = 'output/study-room-curation';
const OUT = path.join(ROOT, '_revision/elegir');
const IMAGE = /\.(png|webp|jpe?g)$/i;

// Títulos de las obras y de los capítulos, desde los datos del museo
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
const { allConcepts, chapters } = await server.ssrLoadModule('/src/data/astroData.ts');
await server.close();
const conceptTitle = new Map(allConcepts.map((concept) => [concept.id, concept.title]));
const chapterTitles = chapters.map((chapter) => chapter.title);

// Imagen actual de cada obra (principal primero), reconocida por parecido
const source = fs.readFileSync('src/data/selectedStudyImages.ts', 'utf8');
const current = {};
for (const match of source.matchAll(/^\s*(?:'([^']+)'|([a-zA-Z0-9]+)):\s*\[([^\]]*)\]/gm)) {
  current[match[1] || match[2]] = [...match[3].matchAll(/\$\{assetBase\}([^`]+)`/g)].map((item) => path.join('public/illustrations/selected', item[1]));
}
const fingerprint = async (file) => {
  const { data } = await sharp(file).resize(17, 16, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const bits = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) bits.push(data[y * 17 + x] < data[y * 17 + x + 1] ? 1 : 0);
  return bits;
};
const distance = (a, b) => a.reduce((sum, bit, index) => sum + (bit !== b[index] ? 1 : 0), 0);

const chapterDirs = fs.readdirSync(ROOT).filter((name) => /^\d\d-/.test(name)).sort();
const rooms = [];
fs.mkdirSync(path.join(OUT, 'thumbs'), { recursive: true });
for (const [chapterIndex, chapter] of chapterDirs.entries()) {
  const roomDirs = fs.readdirSync(path.join(ROOT, chapter), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{3}-/.test(entry.name)).map((entry) => entry.name).sort();
  for (const room of roomDirs) {
    const dir = path.join(ROOT, chapter, room, 'elegida');
    if (!fs.existsSync(dir)) continue;
    const id = room.slice(4);
    const files = fs.readdirSync(dir).filter((name) => IMAGE.test(name)).sort();
    const selected = await Promise.all((current[id] ?? []).filter((file) => fs.existsSync(file)).map(fingerprint));
    const candidates = [];
    for (const name of files) {
      const file = path.join(dir, name);
      const thumb = path.join(OUT, 'thumbs', room, name.replace(IMAGE, '.webp'));
      if (!fs.existsSync(thumb)) {
        fs.mkdirSync(path.dirname(thumb), { recursive: true });
        await sharp(file).resize(960).webp({ quality: 78 }).toFile(thumb);
      }
      const print = await fingerprint(file);
      const order = selected.findIndex((other) => distance(print, other) <= 28);
      candidates.push({
        n: name.replace(IMAGE, ''),
        file: name,
        full: `../../${chapter}/${room}/elegida/${name}`,
        thumb: `thumbs/${room}/${name.replace(IMAGE, '.webp')}`,
        actual: order < 0 ? null : order,
        date: fs.statSync(file).mtimeMs,
      });
    }
    // Imágenes que hoy usa la página y no están en elegida/: se suman como candidatas
    const actualFiles = (current[id] ?? []).filter((file) => fs.existsSync(file));
    for (const [order, file] of actualFiles.entries()) {
      if (candidates.some((cand) => cand.actual === order)) continue;
      const name = path.basename(file);
      const copy = path.join(OUT, 'actuales', room, name);
      if (!fs.existsSync(copy)) {
        fs.mkdirSync(path.dirname(copy), { recursive: true });
        fs.copyFileSync(file, copy);
      }
      const thumb = path.join(OUT, 'thumbs', room, `web-${name}`);
      if (!fs.existsSync(thumb)) await sharp(file).resize(960).webp({ quality: 78 }).toFile(thumb);
      candidates.push({
        n: `web ${name.replace(IMAGE, '')}`,
        file: name,
        web: file.split(path.sep).join('/'),
        full: `actuales/${room}/${name}`,
        thumb: `thumbs/${room}/web-${name}`,
        actual: order,
        date: fs.statSync(file).mtimeMs,
      });
    }
    rooms.push({
      room,
      id,
      number: room.slice(0, 3),
      title: conceptTitle.get(id) ?? id,
      chapter,
      chapterTitle: chapterTitles[chapterIndex] ?? chapter,
      candidates,
    });
    process.stdout.write('.');
  }
}
fs.writeFileSync(path.join(OUT, 'data.json'), `${JSON.stringify(rooms)}\n`);
console.log(`\n${rooms.length} salas, ${rooms.reduce((sum, room) => sum + room.candidates.length, 0)} candidatas`);
