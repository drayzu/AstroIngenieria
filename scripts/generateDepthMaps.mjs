// Mapas de profundidad de las obras (cuadros vivos).
// Recorre public/illustrations/selected/ y, para cada imagen nueva o cambiada,
// calcula su profundidad con Depth Anything V2 (en la CPU, ~3 s por imagen).
// Blanco es cerca y negro lejos. Los mapas se guardan en
// public/illustrations/depth/<obra>/<imagen>.webp y src/data/depthMaps.json
// registra el hash de cada imagen: si no cambió, no se vuelve a calcular.
// Los mapas de imágenes que ya no existen se borran.
// Uso: node scripts/generateDepthMaps.mjs [--force]
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE = 'public/illustrations/selected';
const TARGET = 'public/illustrations/depth';
const MANIFEST = 'src/data/depthMaps.json';
const MODEL = 'onnx-community/depth-anything-v2-small';
// Ancho del mapa: la profundidad no necesita el detalle de la imagen
const WIDTH = 960;
const force = process.argv.includes('--force');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : entry.name.endsWith('.webp') ? [full] : [];
});
const publicPath = (file) => path.relative('public', file).split(path.sep).join('/');
const hashOf = (file) => createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 12);

const previous = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const images = walk(SOURCE).sort();
const next = {};
const pending = [];
for (const file of images) {
  const key = publicPath(file);
  const hash = hashOf(file);
  const out = path.join(TARGET, path.relative(SOURCE, file));
  next[key] = hash;
  if (force || previous[key] !== hash || !fs.existsSync(out)) pending.push({ file, key, out });
}

// Borrar los mapas cuya imagen ya no está
const wanted = new Set(images.map((file) => path.join(TARGET, path.relative(SOURCE, file))));
const stale = fs.existsSync(TARGET) ? walk(TARGET).filter((file) => !wanted.has(file)) : [];
stale.forEach((file) => fs.rmSync(file));

const write = (manifest) => fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

if (pending.length === 0) {
  write(next);
  console.log(`Profundidad al día: ${images.length} imágenes${stale.length ? `, ${stale.length} mapas viejos borrados` : ''}.`);
  process.exit(0);
}

let estimate;
try {
  const { pipeline } = await import('@huggingface/transformers');
  estimate = await pipeline('depth-estimation', MODEL, { dtype: 'fp32' });
} catch (error) {
  // Sin modelo (por ejemplo, sin red la primera vez) el build sigue: esas obras
  // se ven quietas hasta la próxima pasada
  console.warn(`No se pudo cargar el modelo de profundidad: ${error.message}`);
  const kept = Object.fromEntries(Object.entries(next).filter(([key]) => !pending.some((item) => item.key === key)));
  write(kept);
  process.exit(0);
}

const { RawImage } = await import('@huggingface/transformers');
const started = Date.now();
const done = { ...Object.fromEntries(Object.entries(next).filter(([key]) => !pending.some((item) => item.key === key))) };
for (const [index, item] of pending.entries()) {
  const { data, info } = await sharp(item.file).resize(WIDTH).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const image = new RawImage(new Uint8ClampedArray(data), info.width, info.height, 3);
  const { depth } = await estimate(image);
  fs.mkdirSync(path.dirname(item.out), { recursive: true });
  await sharp(Buffer.from(depth.data), { raw: { width: depth.width, height: depth.height, channels: 1 } })
    .resize(info.width, info.height)
    .blur(0.8)
    .webp({ quality: 90 })
    .toFile(item.out);
  done[item.key] = next[item.key];
  // Se guarda en cada paso: si se corta, lo hecho no se repite
  write(Object.fromEntries(Object.entries(done).sort(([a], [b]) => a.localeCompare(b))));
  console.log(`[${index + 1}/${pending.length}] ${item.key}`);
}
console.log(`Profundidad: ${pending.length} mapas en ${Math.round((Date.now() - started) / 1000)} s.`);
