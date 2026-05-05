import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const dataPath = path.join(root, 'src', 'data', 'astroData.ts');
const outputDir = path.join(root, 'public', 'illustrations');
const data = await readFile(dataPath, 'utf8');

const conceptRegex =
  /concept\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'/g;

const concepts = [];
let match;

while ((match = conceptRegex.exec(data)) !== null) {
  concepts.push({
    chapterId: match[1],
    id: match[2],
    title: match[3],
    category: match[4],
    scale: match[5],
    plausibility: match[6],
  });
}

const paletteByScale = {
  nave: ['#f8f5ef', '#20242b', '#b14b33', '#d8d0c3'],
  habitat: ['#f8f5ef', '#1f2a27', '#507567', '#ded6c9'],
  orbital: ['#f7f4ee', '#1f252d', '#4d6577', '#d8d1c7'],
  planetaria: ['#f7f4ee', '#2b2620', '#8a6a4c', '#d9d2c8'],
  estelar: ['#f8f4e8', '#1f2024', '#bf8b43', '#d8c7aa'],
  galactica: ['#f7f4ef', '#1f2228', '#6d6179', '#d6cbd8'],
};

const hash = (value) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

const rand = (seed) => {
  let state = seed || 1;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return ((state >>> 0) % 10000) / 10000;
  };
};

const starField = (random, count, color = '#ffffff') =>
  Array.from({ length: count }, () => {
    const x = Math.round(random() * 1600);
    const y = Math.round(random() * 960);
    const r = (0.5 + random() * 1.5).toFixed(2);
    const opacity = (0.12 + random() * 0.42).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${opacity}" />`;
  }).join('');

const lineTexture = (random, count) =>
  Array.from({ length: count }, () => {
    const y = Math.round(150 + random() * 650);
    const x = Math.round(120 + random() * 220);
    const w = Math.round(820 + random() * 420);
    const opacity = (0.04 + random() * 0.08).toFixed(2);
    return `<path d="M${x} ${y} C ${x + 260} ${y - 80}, ${x + 560} ${y + 90}, ${x + w} ${y - 20}" stroke="#ffffff" stroke-width="1" opacity="${opacity}" fill="none" />`;
  }).join('');

const planetScene = (random, colors) => {
  const radius = 180 + random() * 70;
  const cx = 930 + random() * 120;
  const cy = 510 + random() * 80;
  return `
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#planet)" />
    <path d="M${cx - radius * 0.9} ${cy + radius * 0.12} C ${cx - radius * 0.3} ${cy - 25}, ${cx + radius * 0.3} ${cy + 70}, ${cx + radius * 0.9} ${cy - 10}" stroke="${colors[3]}" stroke-width="18" opacity="0.28" fill="none"/>
    <path d="M${cx - radius * 0.82} ${cy - radius * 0.2} C ${cx - radius * 0.2} ${cy - 80}, ${cx + radius * 0.22} ${cy + 20}, ${cx + radius * 0.72} ${cy - 60}" stroke="#fffaf0" stroke-width="7" opacity="0.22" fill="none"/>
  `;
};

const ringScene = (random, colors) => {
  const cx = 920 + random() * 70;
  const cy = 470 + random() * 60;
  return `
    <ellipse cx="${cx}" cy="${cy}" rx="390" ry="116" fill="none" stroke="${colors[3]}" stroke-width="28" opacity="0.58"/>
    <ellipse cx="${cx}" cy="${cy}" rx="390" ry="116" fill="none" stroke="${colors[2]}" stroke-width="4" opacity="0.62"/>
    <circle cx="${cx}" cy="${cy}" r="118" fill="url(#object)" opacity="0.95"/>
    <path d="M${cx - 350} ${cy + 24} L${cx + 350} ${cy - 24}" stroke="#ffffff" stroke-width="2" opacity="0.16"/>
  `;
};

const cylinderScene = (random, colors) => {
  const x = 690 + random() * 60;
  const y = 300 + random() * 60;
  return `
    <g transform="rotate(-10 960 520)">
      <ellipse cx="${x}" cy="${y + 170}" rx="95" ry="220" fill="url(#object)" opacity="0.92"/>
      <rect x="${x}" y="${y - 50}" width="520" height="440" fill="url(#metal)" opacity="0.86"/>
      <ellipse cx="${x + 520}" cy="${y + 170}" rx="95" ry="220" fill="${colors[1]}" stroke="${colors[3]}" stroke-width="8" opacity="0.94"/>
      <path d="M${x + 55} ${y + 10} L${x + 470} ${y + 58} M${x + 55} ${y + 160} L${x + 470} ${y + 205} M${x + 55} ${y + 310} L${x + 470} ${y + 350}" stroke="#f7f4ef" stroke-width="5" opacity="0.28"/>
    </g>
  `;
};

const propulsionScene = (random, colors) => {
  const x = 890 + random() * 60;
  const y = 470 + random() * 80;
  return `
    <path d="M${x - 420} ${y + 40} C ${x - 260} ${y - 120}, ${x + 120} ${y - 110}, ${x + 270} ${y}" stroke="${colors[3]}" stroke-width="3" opacity="0.34" fill="none"/>
    <path d="M${x - 30} ${y - 42} L${x + 220} ${y} L${x - 30} ${y + 42} L${x + 18} ${y} Z" fill="url(#metal)" stroke="${colors[3]}" stroke-width="4"/>
    <path d="M${x - 40} ${y - 28} C ${x - 230} ${y - 110}, ${x - 360} ${y - 45}, ${x - 500} ${y}" stroke="${colors[2]}" stroke-width="34" opacity="0.18" fill="none"/>
    <path d="M${x - 40} ${y + 28} C ${x - 230} ${y + 110}, ${x - 360} ${y + 45}, ${x - 500} ${y}" stroke="${colors[3]}" stroke-width="14" opacity="0.18" fill="none"/>
  `;
};

const stellarScene = (random, colors) => {
  const cx = 910 + random() * 90;
  const cy = 480 + random() * 70;
  return `
    <circle cx="${cx}" cy="${cy}" r="150" fill="url(#star)" />
    <circle cx="${cx}" cy="${cy}" r="235" fill="none" stroke="${colors[3]}" stroke-width="2" opacity="0.16" />
    <path d="M${cx - 360} ${cy - 190} C ${cx - 60} ${cy - 340}, ${cx + 250} ${cy - 220}, ${cx + 420} ${cy + 90}" stroke="${colors[3]}" stroke-width="44" opacity="0.16" fill="none"/>
    <path d="M${cx + 120} ${cy - 220} C ${cx + 280} ${cy - 120}, ${cx + 320} ${cy + 80}, ${cx + 210} ${cy + 250}" stroke="#ffffff" stroke-width="9" opacity="0.22" fill="none"/>
  `;
};

const civilizationScene = (random, colors) => {
  const cx = 930;
  const cy = 500;
  const arms = Array.from({ length: 4 }, (_, arm) => {
    const angle = arm * 90 + random() * 8;
    return `<path d="M${cx} ${cy} C ${cx + 110} ${cy - 40}, ${cx + 260} ${cy - 180}, ${cx + 440} ${cy - 80}" transform="rotate(${angle} ${cx} ${cy})" stroke="${colors[3]}" stroke-width="46" opacity="0.12" fill="none"/>`;
  }).join('');
  return `
    ${arms}
    <circle cx="${cx}" cy="${cy}" r="78" fill="url(#object)" opacity="0.92"/>
    ${Array.from({ length: 42 }, () => {
      const angle = random() * Math.PI * 2;
      const radius = 150 + random() * 330;
      return `<circle cx="${cx + Math.cos(angle) * radius}" cy="${cy + Math.sin(angle) * radius * 0.72}" r="${1.2 + random() * 3}" fill="${colors[3]}" opacity="${0.22 + random() * 0.42}"/>`;
    }).join('')}
  `;
};

const sceneFor = (concept, random, colors) => {
  const text = `${concept.id} ${concept.title}`.toLowerCase();
  if (
    text.includes('cylinder') ||
    text.includes('cilindro') ||
    text.includes('worldship') ||
    text.includes('ship')
  ) {
    return cylinderScene(random, colors);
  }
  if (
    text.includes('torus') ||
    text.includes('ring') ||
    text.includes('anillo') ||
    text.includes('orbital')
  ) {
    return ringScene(random, colors);
  }
  if (
    concept.scale === 'nave' ||
    text.includes('propulsion') ||
    text.includes('vela') ||
    text.includes('sail') ||
    text.includes('drive') ||
    text.includes('cohete')
  ) {
    return propulsionScene(random, colors);
  }
  if (
    concept.scale === 'estelar' ||
    text.includes('dyson') ||
    text.includes('stellar') ||
    text.includes('star') ||
    text.includes('shkadov') ||
    text.includes('caplan')
  ) {
    return stellarScene(random, colors);
  }
  if (
    concept.scale === 'galactica' ||
    text.includes('seti') ||
    text.includes('fermi') ||
    text.includes('civilizacion')
  ) {
    return civilizationScene(random, colors);
  }
  return planetScene(random, colors);
};

const makeSvg = (concept) => {
  const seed = hash(concept.id);
  const random = rand(seed);
  const colors = paletteByScale[concept.scale] ?? paletteByScale.galactica;
  const scene = sceneFor(concept, random, colors);
  const stars = starField(random, 140, colors[3]);
  const texture = lineTexture(random, 18);

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="960" viewBox="0 0 1600 960">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${colors[0]}"/>
      <stop offset="0.52" stop-color="#ebe6dc"/>
      <stop offset="1" stop-color="#111318"/>
    </linearGradient>
    <radialGradient id="object" cx="42%" cy="36%" r="70%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.3" stop-color="${colors[3]}"/>
      <stop offset="1" stop-color="${colors[1]}"/>
    </radialGradient>
    <radialGradient id="planet" cx="36%" cy="30%" r="70%">
      <stop offset="0" stop-color="#fffaf0"/>
      <stop offset="0.38" stop-color="${colors[3]}"/>
      <stop offset="1" stop-color="${colors[1]}"/>
    </radialGradient>
    <radialGradient id="star" cx="40%" cy="38%" r="74%">
      <stop offset="0" stop-color="#fff8d7"/>
      <stop offset="0.46" stop-color="#d8a64e"/>
      <stop offset="1" stop-color="#5b3a1f"/>
    </radialGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8f5ef"/>
      <stop offset="0.32" stop-color="${colors[3]}"/>
      <stop offset="1" stop-color="${colors[1]}"/>
    </linearGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="${seed % 97}" />
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.13"/>
      </feComponentTransfer>
    </filter>
    <filter id="soft">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
  </defs>
  <rect width="1600" height="960" fill="url(#bg)"/>
  <rect width="1600" height="960" fill="#000000" opacity="0.02" filter="url(#grain)"/>
  <circle cx="1180" cy="270" r="360" fill="${colors[2]}" opacity="0.08" filter="url(#soft)"/>
  <g opacity="0.68">${stars}</g>
  <g>${texture}</g>
  <g>${scene}</g>
  <rect x="0" y="0" width="1600" height="960" fill="url(#bg)" opacity="0.04"/>
</svg>`;
};

await mkdir(outputDir, { recursive: true });

const heroSvg = makeSvg(
  {
    id: 'hero-astroingenieria',
    title: 'Astroingeniería',
    category: 'Museo de mundos posibles',
    scale: 'estelar',
  },
  {
    title: 'Astroingeniería',
    subtitle: 'Hábitats, energía estelar, mundos y civilizaciones cósmicas',
  },
);

await sharp(Buffer.from(heroSvg)).webp({ quality: 84, effort: 5 }).toFile(path.join(outputDir, 'hero.webp'));

for (const concept of concepts) {
  const svg = makeSvg(concept);
  await sharp(Buffer.from(svg))
    .resize(1280, 768, { fit: 'cover' })
    .webp({ quality: 82, effort: 5 })
    .toFile(path.join(outputDir, `${concept.id}.webp`));
}

const manifest = {
  generatedAt: new Date().toISOString(),
  total: concepts.length + 1,
  note:
    'Initial local generative WebP illustration library. Prompts and IA-curation metadata are stored in the app data layer for replacement with externally curated AI outputs if desired.',
  files: ['hero.webp', ...concepts.map((concept) => `${concept.id}.webp`)],
};

await writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`Generated ${manifest.total} WebP illustrations in ${path.relative(root, outputDir)}`);
