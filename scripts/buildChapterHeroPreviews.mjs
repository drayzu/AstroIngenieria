import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve('output/chapter-hero-cinema');
const [manifestName = 'BATCH-2026-09-26.json', previewFolder = 'previews'] = process.argv.slice(2);
const previews = path.join(root, previewFolder);
const batch = JSON.parse(await fs.readFile(path.join(root, manifestName), 'utf8'));
await fs.mkdir(previews, { recursive: true });
const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const fullTiles = [];
const desktopTiles = [];
const mobileTiles = [];

for (const item of batch.images) {
  const source = path.join(root, item.original);
  await fs.mkdir(path.join(root, item.id, 'elegida'), { recursive: true });
  await fs.mkdir(path.join(root, item.id, 'basura'), { recursive: true });
  const metadata = await sharp(source).metadata();
  if (metadata.width * 3 !== metadata.height * 7 || metadata.space !== 'srgb' || metadata.hasAlpha) {
    throw new Error(`Invalid original ${item.original}`);
  }
  const stem = path.basename(item.original, '.png');
  await sharp(source).resize(640, 360, { fit: 'cover', position: 'centre' })
    .png().toFile(path.join(previews, `${stem}-desktop.png`));
  await sharp(source).resize(240, 426, { fit: 'cover', position: 'centre' })
    .png().toFile(path.join(previews, `${stem}-mobile.png`));
  const label = item.variant ? `${item.title} · ${item.variant.toUpperCase()}` : item.title;
  const overlay = Buffer.from(`<svg width="560" height="240" xmlns="http://www.w3.org/2000/svg"><rect y="197" width="560" height="43" fill="rgba(0,0,0,0.83)"/><text x="14" y="225" fill="#f5f5f5" font-family="Arial, sans-serif" font-size="17">${escapeXml(label)}</text></svg>`);
  fullTiles.push(await sharp(source).resize(560, 240, { fit: 'cover', position: 'centre' })
    .composite([{ input: overlay }]).png().toBuffer());
  desktopTiles.push(await sharp(source).resize(560, 315, { fit: 'cover', position: 'centre' }).png().toBuffer());
  mobileTiles.push(await sharp(source).resize(202, 359, { fit: 'cover', position: 'centre' }).png().toBuffer());
}

async function sheet(tiles, start, count, columns, width, height, filename) {
  const selected = tiles.slice(start, start + count);
  await sharp({ create: {
    width: columns * width,
    height: Math.ceil(selected.length / columns) * height,
    channels: 4,
    background: '#05070a',
  } }).composite(selected.map((input, index) => ({
    input,
    left: (index % columns) * width,
    top: Math.floor(index / columns) * height,
  }))).png().toFile(path.join(previews, filename));
}

const groupCount = Math.ceil(batch.images.length / 10);
for (let group = 0; group < groupCount; group++) {
  const suffix = String(group + 1).padStart(2, '0');
  const count = Math.min(10, batch.images.length - group * 10);
  await sheet(fullTiles, group * 10, count, 2, 560, 240, `contact-${suffix}.png`);
  await sheet(desktopTiles, group * 10, count, 2, 560, 315, `desktop-${suffix}.png`);
  await sheet(mobileTiles, group * 10, count, 2, 202, 359, `mobile-${suffix}.png`);
}
const overviewTiles = await Promise.all(fullTiles.map((input) => sharp(input).resize(420, 180).png().toBuffer()));
await sheet(overviewTiles, 0, overviewTiles.length, 2, 420, 180, 'overview.png');
console.log(`Prepared ${batch.images.length} heroes, ${batch.images.length * 2} viewport crops, ${groupCount} contact sheet(s) and overview.`);
