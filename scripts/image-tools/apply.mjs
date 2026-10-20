// Aplica las elecciones de elecciones.json a la página.
// - Convierte cada imagen elegida a WebP en public/illustrations/selected/<obra>/
//   con el nombre de su versión original (v05, v12-21x9…).
// - Reescribe la lista de cada obra en src/data/selectedStudyImages.ts
//   (principal primero, después las secundarias en el orden elegido).
// Las salas sin decidir quedan como están. No borra archivos.
// Uso, desde la raíz del repo:
//   npm run imagenes:aplicar                (prueba, no escribe)
//   npm run imagenes:aplicar -- --write
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const write = process.argv.includes('--write');
const BASE = 'output/study-room-curation';
const DIR = path.join(BASE, '_revision/elegir');
const SELECTED = 'public/illustrations/selected';
const LIST = 'src/data/selectedStudyImages.ts';
const WIDTH = 1916;

const rooms = JSON.parse(fs.readFileSync(path.join(DIR, 'data.json'), 'utf8'));
const choices = JSON.parse(fs.readFileSync(path.join(DIR, 'elecciones.json'), 'utf8'));

const fingerprint = async (file) => {
  const { data } = await sharp(file).resize(17, 16, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const bits = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) bits.push(data[y * 17 + x] < data[y * 17 + x + 1] ? 1 : 0);
  return bits;
};
const same = async (a, b) => {
  const [x, y] = await Promise.all([fingerprint(a), fingerprint(b)]);
  return x.filter((bit, i) => bit !== y[i]).length <= 28;
};

// Nombre de la versión original de cada candidata (007-oneill-cylinder-v10.png → v10)
const originalName = (room, file) => {
  const index = path.join(BASE, '_revision', `${room.room}-todas.json`);
  if (!fs.existsSync(index)) return null;
  const entry = JSON.parse(fs.readFileSync(index, 'utf8')).images?.find((image) => image.file === file);
  if (!entry?.originalFile) return null;
  return entry.originalFile.replace(/\.(png|webp|jpe?g)$/i, '').replace(new RegExp(`^${room.room}-`), '').replace(new RegExp(`^${room.id}-`), '') || null;
};

const plan = [];
for (const room of rooms) {
  const choice = choices[room.room];
  if (!choice?.principal || choice.nueva) continue;
  const picks = [choice.principal, ...choice.secundarias];
  const files = [];
  for (const n of picks) {
    const cand = room.candidates.find((item) => item.n === n);
    if (!cand) throw new Error(`${room.room}: no existe la candidata ${n}`);
    if (cand.web) {
      files.push({ name: path.basename(cand.web), action: 'ya está en la web' });
      continue;
    }
    const source = path.join(BASE, room.chapter, room.room, 'elegida', cand.file);
    let name = `${originalName(room, cand.file) ?? `elegida-${cand.n}`}.webp`;
    const target = path.join(SELECTED, room.id, name);
    let action = 'nueva';
    if (fs.existsSync(target)) {
      if (await same(source, target)) action = 'ya existe igual';
      else { name = name.replace('.webp', `-e${cand.n}.webp`); action = 'nueva (nombre ajustado)'; }
    }
    files.push({ name, action, source });
  }
  plan.push({ room, files });
}

const created = plan.flatMap(({ files }) => files.filter((file) => file.action.startsWith('nueva'))).length;
console.log(`${plan.length} salas a actualizar, ${plan.reduce((sum, item) => sum + item.files.length, 0)} imágenes, ${created} archivos WebP nuevos`);
for (const { room, files } of plan.slice(0, 4)) console.log(`  ${room.room}: ${files.map((file) => `${file.name} (${file.action})`).join(', ')}`);

if (!write) {
  console.log('Prueba: no se escribió nada. Agrega --write para aplicar.');
  process.exit(0);
}

let list = fs.readFileSync(LIST, 'utf8');
for (const { room, files } of plan) {
  for (const file of files) {
    if (!file.action.startsWith('nueva')) continue;
    const target = path.join(SELECTED, room.id, file.name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const meta = await sharp(file.source).metadata();
    await sharp(file.source).resize(Math.min(WIDTH, meta.width)).webp({ quality: 86 }).toFile(target);
  }
  const key = /^[a-zA-Z0-9]+$/.test(room.id) ? room.id : `'${room.id}'`;
  const entry = new RegExp(`(^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*\\[)[^\\]]*(\\])`, 'm');
  const body = `\n${files.map((file) => `    \`\${assetBase}${room.id}/${file.name}\`,`).join('\n')}\n  `;
  if (!entry.test(list)) throw new Error(`${room.id}: no está en ${LIST}`);
  list = list.replace(entry, `$1${body}$2`);
  process.stdout.write('.');
}
fs.writeFileSync(LIST, list);
console.log(`\nListo: ${LIST} actualizado.`);
