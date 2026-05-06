import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outputDir = path.join(root, 'public', 'illustrations', 'ai', 'concepts', 'habitats');
const width = 1920;
const height = 1080;

const concepts = [
  {
    id: 'iss',
    title: 'Estaciones espaciales actuales',
    prompt:
      'Cinematic realistic orbital station study plate, modular pressurized modules, long solar arrays, docking ports and radiators over Earth, SpaceX-inspired dark aerospace lighting, no text, no logos.',
    accent: '#9fc8ff',
    shape: 'station',
  },
  {
    id: 'bernal-sphere',
    title: 'Bernal Sphere',
    prompt:
      'Cinematic realistic Bernal sphere habitat study plate, polished metallic sphere with equatorial habitat band, mirror petals and service trusses in orbit, dark premium aerospace style, no text, no logos.',
    accent: '#d9f3ff',
    shape: 'sphere',
  },
  {
    id: 'stanford-torus',
    title: 'Stanford Torus',
    prompt:
      'Cinematic realistic Stanford torus study plate, rotating ring habitat with illuminated inner rim, hub, spokes and construction cranes over Earth, dark SpaceX-inspired aerospace style, no text, no logos.',
    accent: '#d7fbff',
    shape: 'torus',
  },
  {
    id: 'oneill-cylinder',
    title: 'Cilindro de O’Neill',
    prompt:
      'Cinematic realistic O’Neill cylinder study plate, colossal rotating cylinder with open rim, exterior panels, radiators and inspection spacecraft, dark premium aerospace lighting, no text, no logos.',
    accent: '#ffffff',
    shape: 'cylinder',
  },
  {
    id: 'bishop-ring',
    title: 'Bishop Ring',
    prompt:
      'Cinematic realistic Bishop ring study plate, immense open ring habitat with thin atmosphere, rim lights, tension structure and construction tugs, dark scientific aerospace style, no text, no logos.',
    accent: '#cff7d9',
    shape: 'wide-ring',
  },
  {
    id: 'mckendree-cylinder',
    title: 'McKendree Cylinder',
    prompt:
      'Cinematic realistic McKendree cylinder study plate, ultra-large carbon-composite rotating habitat cylinder with layered structure, docking towers and scale spacecraft, dark aerospace style, no text, no logos.',
    accent: '#c8d4ff',
    shape: 'mega-cylinder',
  },
  {
    id: 'asteroid-habitat',
    title: 'Hábitats dentro de asteroides',
    prompt:
      'Cinematic realistic asteroid habitat study plate, dark rocky asteroid with engineered lit cavity, docking tunnels, radiators and small construction vehicles, premium aerospace realism, no text, no logos.',
    accent: '#f1c189',
    shape: 'asteroid',
  },
  {
    id: 'worldship',
    title: 'Naves generacionales y worldships',
    prompt:
      'Cinematic realistic generation ship study plate, long interstellar worldship with rotating habitat sections, radiators, propulsion spine and tiny escort craft, dark aerospace style, no text, no logos.',
    accent: '#ffddad',
    shape: 'worldship',
  },
  {
    id: 'life-support',
    title: 'Ecosistemas cerrados y soporte vital',
    prompt:
      'Cinematic realistic closed ecosystem habitat study plate, greenhouse bioregenerative life support modules inside orbital structure, water loops, radiators and soft interior glow, dark aerospace style, no text, no logos.',
    accent: '#b8ffba',
    shape: 'ecosystem',
  },
];

const commonDefs = (accent) => `
  <defs>
    <radialGradient id="spaceGlow" cx="66%" cy="42%" r="62%">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.35" />
      <stop offset="0.42" stop-color="#5e6977" stop-opacity="0.13" />
      <stop offset="1" stop-color="#020304" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="earth" cx="48%" cy="42%" r="65%">
      <stop offset="0" stop-color="#2e7dcc" stop-opacity="0.65" />
      <stop offset="0.5" stop-color="#0c2740" stop-opacity="0.9" />
      <stop offset="1" stop-color="#02060a" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="metal" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#f6fbff" stop-opacity="0.95" />
      <stop offset="0.28" stop-color="#8a929b" stop-opacity="0.86" />
      <stop offset="0.58" stop-color="#232932" stop-opacity="0.96" />
      <stop offset="1" stop-color="#dbe5ef" stop-opacity="0.72" />
    </linearGradient>
    <linearGradient id="darkMetal" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#d9e0e8" stop-opacity="0.68" />
      <stop offset="0.54" stop-color="#151a21" stop-opacity="0.94" />
      <stop offset="1" stop-color="#030405" stop-opacity="0.88" />
    </linearGradient>
    <filter id="glow" x="-70%" y="-70%" width="240%" height="240%">
      <feGaussianBlur stdDeviation="16" result="blur" />
      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <filter id="fineGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>`;

const stars = Array.from({ length: 80 }, (_, index) => {
  const x = (index * 379) % width;
  const y = (index * 211) % height;
  const opacity = 0.14 + ((index * 17) % 36) / 100;
  const radius = 0.8 + (index % 3) * 0.5;
  return `<circle cx="${x}" cy="${y}" r="${radius}" fill="#fff" opacity="${opacity.toFixed(2)}" />`;
}).join('\n');

const background = (accent) => `
  <rect width="100%" height="100%" fill="#020303" />
  <rect width="100%" height="100%" fill="url(#spaceGlow)" />
  ${stars}
  <circle cx="260" cy="1040" r="410" fill="url(#earth)" opacity="0.72" />
  <path d="M0 750 C460 700 950 780 1920 650" stroke="#fff" stroke-opacity="0.07" stroke-width="2" fill="none" />
  <path d="M0 830 C560 735 1180 835 1920 735" stroke="${accent}" stroke-opacity="0.11" stroke-width="2" fill="none" />
  <rect width="100%" height="100%" fill="url(#readShade)" />`;

function station(accent) {
  return `
    <g transform="translate(265 250) rotate(-8)" opacity="0.98">
      <rect x="70" y="204" width="1180" height="18" fill="#d9e4ef" opacity="0.56" />
      <rect x="70" y="170" width="300" height="86" fill="#0e141c" stroke="#e8f2ff" stroke-width="5" opacity="0.96" />
      <rect x="960" y="170" width="300" height="86" fill="#0e141c" stroke="#e8f2ff" stroke-width="5" opacity="0.96" />
      ${Array.from({ length: 18 }, (_, i) => `<line x1="${95 + i * 64}" y1="172" x2="${95 + i * 64}" y2="254" stroke="${accent}" stroke-opacity="0.2" stroke-width="2" />`).join('')}
      <rect x="462" y="166" width="120" height="96" rx="24" fill="url(#metal)" stroke="#fff" stroke-opacity="0.55" stroke-width="3" />
      <rect x="594" y="158" width="182" height="112" rx="34" fill="url(#darkMetal)" stroke="#fff" stroke-opacity="0.42" stroke-width="3" />
      <rect x="790" y="182" width="138" height="68" rx="18" fill="url(#metal)" stroke="#fff" stroke-opacity="0.36" stroke-width="3" />
      <circle cx="538" cy="214" r="46" fill="none" stroke="#fff" stroke-width="8" opacity="0.72" />
      <circle cx="682" cy="214" r="58" fill="none" stroke="${accent}" stroke-width="5" opacity="0.44" filter="url(#fineGlow)" />
    </g>`;
}

function sphere(accent) {
  return `
    <g transform="translate(585 145)">
      <ellipse cx="360" cy="360" rx="330" ry="330" fill="url(#darkMetal)" stroke="#fff" stroke-opacity="0.62" stroke-width="7" />
      <ellipse cx="312" cy="310" rx="250" ry="220" fill="${accent}" opacity="0.11" filter="url(#glow)" />
      <path d="M78 360 C190 294 535 276 660 352 C548 424 198 430 78 360Z" fill="#0d1319" stroke="${accent}" stroke-opacity="0.55" stroke-width="4" />
      ${Array.from({ length: 8 }, (_, i) => `<path d="M${150 + i * 52} 330 C${184 + i * 42} 362 ${226 + i * 40} 370 ${270 + i * 39} 348" fill="none" stroke="#fff" stroke-opacity="0.13" stroke-width="2" />`).join('')}
      <path d="M84 362 L-165 208" stroke="#dce5ef" stroke-opacity="0.45" stroke-width="5" />
      <path d="M660 352 L890 206" stroke="#dce5ef" stroke-opacity="0.45" stroke-width="5" />
      <rect x="-235" y="145" width="170" height="82" fill="#101820" stroke="#fff" stroke-opacity="0.38" />
      <rect x="810" y="137" width="170" height="82" fill="#101820" stroke="#fff" stroke-opacity="0.38" />
    </g>`;
}

function torus(accent) {
  return `
    <g transform="translate(520 115) rotate(-8)">
      <ellipse cx="455" cy="400" rx="505" ry="292" fill="none" stroke="#edf3fa" stroke-opacity="0.82" stroke-width="84" />
      <ellipse cx="455" cy="400" rx="438" ry="232" fill="none" stroke="#050607" stroke-opacity="0.97" stroke-width="68" />
      <ellipse cx="455" cy="400" rx="505" ry="292" fill="none" stroke="url(#metal)" stroke-opacity="0.52" stroke-width="72" />
      ${Array.from({ length: 18 }, (_, i) => `<line x1="455" y1="400" x2="${455 + Math.cos((i / 18) * Math.PI * 2) * 392}" y2="${400 + Math.sin((i / 18) * Math.PI * 2) * 188}" stroke="#eef4fb" stroke-opacity="0.16" stroke-width="3" />`).join('')}
      <circle cx="455" cy="400" r="62" fill="url(#metal)" stroke="#fff" stroke-opacity="0.5" stroke-width="4" />
      <ellipse cx="455" cy="400" rx="505" ry="292" fill="none" stroke="${accent}" stroke-opacity="0.18" stroke-width="116" filter="url(#glow)" />
    </g>`;
}

function cylinder(accent, mega = false) {
  const scale = mega ? 1.12 : 1;
  const tx = mega ? 270 : 420;
  return `
    <g transform="translate(${tx} ${mega ? 150 : 165}) rotate(-6) scale(${scale})">
      <path d="M140 260 C165 120 850 96 1050 178 L1050 594 C838 724 168 694 140 536Z" fill="url(#darkMetal)" stroke="#f5f8fb" stroke-opacity="0.58" stroke-width="7" />
      <ellipse cx="1050" cy="386" rx="128" ry="210" fill="#050607" stroke="#fff" stroke-opacity="0.78" stroke-width="10" />
      <ellipse cx="142" cy="398" rx="94" ry="140" fill="url(#metal)" stroke="#fff" stroke-opacity="0.55" stroke-width="5" />
      ${Array.from({ length: mega ? 13 : 9 }, (_, i) => `<path d="M${190 + i * 66} ${245 - i * 5} C${285 + i * 58} ${290 - i * 4} ${310 + i * 58} ${500 + i * 3} ${205 + i * 66} ${584 - i * 2}" fill="none" stroke="#fff" stroke-opacity="${mega ? 0.13 : 0.18}" stroke-width="3" />`).join('')}
      ${Array.from({ length: 7 }, (_, i) => `<rect x="${315 + i * 82}" y="${208 + i * 5}" width="46" height="20" fill="${accent}" opacity="0.22" filter="url(#fineGlow)" />`).join('')}
    </g>`;
}

function wideRing(accent) {
  return `
    <g transform="translate(270 138) rotate(-4)">
      <ellipse cx="680" cy="430" rx="700" ry="276" fill="none" stroke="#eaf0f6" stroke-opacity="0.72" stroke-width="42" />
      <ellipse cx="680" cy="430" rx="660" ry="236" fill="none" stroke="#040506" stroke-opacity="0.95" stroke-width="74" />
      <ellipse cx="680" cy="430" rx="696" ry="276" fill="none" stroke="url(#metal)" stroke-opacity="0.48" stroke-width="44" />
      <ellipse cx="680" cy="410" rx="610" ry="194" fill="none" stroke="${accent}" stroke-opacity="0.18" stroke-width="10" filter="url(#glow)" />
      ${Array.from({ length: 18 }, (_, i) => `<circle cx="${680 + Math.cos((i / 18) * Math.PI * 2) * 690}" cy="${430 + Math.sin((i / 18) * Math.PI * 2) * 270}" r="5" fill="#fff" opacity="0.5" />`).join('')}
    </g>`;
}

function asteroid(accent) {
  return `
    <g transform="translate(510 135)">
      <path d="M450 80 C610 90 785 200 812 352 C852 580 666 766 442 790 C244 812 86 700 40 520 C-20 290 190 66 450 80Z" fill="#242018" stroke="#b7a38c" stroke-opacity="0.55" stroke-width="6" />
      <path d="M245 330 C356 258 560 272 658 374 C576 468 376 510 242 450 C195 420 197 366 245 330Z" fill="#030405" stroke="${accent}" stroke-opacity="0.64" stroke-width="6" />
      <ellipse cx="448" cy="390" rx="210" ry="94" fill="${accent}" opacity="0.13" filter="url(#glow)" />
      ${Array.from({ length: 18 }, (_, i) => `<circle cx="${110 + (i * 73) % 640}" cy="${150 + (i * 113) % 560}" r="${10 + (i % 4) * 8}" fill="#070809" opacity="0.35" />`).join('')}
      <path d="M660 375 L930 310" stroke="#e9edf2" stroke-opacity="0.5" stroke-width="5" />
      <rect x="895" y="280" width="118" height="48" rx="8" fill="url(#metal)" />
    </g>`;
}

function worldship(accent) {
  return `
    <g transform="translate(210 305) rotate(-5)">
      <path d="M60 245 L1420 110" stroke="#dfe7f0" stroke-opacity="0.82" stroke-width="34" />
      <path d="M176 234 L1380 115" stroke="#11161d" stroke-opacity="0.62" stroke-width="16" />
      ${[260, 520, 800, 1070].map((x, i) => `<g transform="translate(${x} ${220 - i * 28})"><ellipse cx="0" cy="0" rx="126" ry="56" fill="none" stroke="url(#metal)" stroke-width="24"/><ellipse cx="0" cy="0" rx="92" ry="35" fill="none" stroke="#020303" stroke-width="22"/><ellipse cx="0" cy="0" rx="132" ry="61" fill="none" stroke="${accent}" stroke-opacity="0.14" stroke-width="34" filter="url(#glow)"/></g>`).join('')}
      <path d="M1420 110 L1580 170 L1428 220Z" fill="url(#metal)" stroke="#fff" stroke-opacity="0.45" />
      <path d="M78 245 L-90 332" stroke="${accent}" stroke-opacity="0.18" stroke-width="58" filter="url(#glow)" />
    </g>`;
}

function ecosystem(accent) {
  return `
    <g transform="translate(430 155)">
      <rect x="0" y="190" width="1050" height="470" rx="44" fill="#07100b" stroke="#dfffe1" stroke-opacity="0.62" stroke-width="7" />
      <path d="M40 520 C210 350 406 380 550 510 C708 360 894 370 1010 512" fill="none" stroke="${accent}" stroke-opacity="0.34" stroke-width="22" filter="url(#glow)" />
      ${Array.from({ length: 8 }, (_, i) => `<path d="M${120 + i * 108} 595 C${120 + i * 108} 506 ${160 + i * 80} 438 ${208 + i * 72} 380" stroke="#bffff0" stroke-opacity="0.33" stroke-width="5" fill="none" />`).join('')}
      <ellipse cx="530" cy="428" rx="465" ry="160" fill="${accent}" opacity="0.08" />
      <rect x="112" y="238" width="820" height="38" fill="#e7fff0" opacity="0.14" />
      <circle cx="922" cy="596" r="35" fill="${accent}" opacity="0.38" filter="url(#fineGlow)" />
    </g>`;
}

function shapeMarkup(shape, accent) {
  switch (shape) {
    case 'station': return station(accent);
    case 'sphere': return sphere(accent);
    case 'torus': return torus(accent);
    case 'cylinder': return cylinder(accent);
    case 'wide-ring': return wideRing(accent);
    case 'mega-cylinder': return cylinder(accent, true);
    case 'asteroid': return asteroid(accent);
    case 'worldship': return worldship(accent);
    case 'ecosystem': return ecosystem(accent);
    default: return torus(accent);
  }
}

function imageSvg(concept) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${concept.title}</title>
  <desc id="desc">${concept.prompt}</desc>
  ${commonDefs(concept.accent)}
  <defs>
    <linearGradient id="readShade" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.26" />
      <stop offset="0.52" stop-color="#000" stop-opacity="0.05" />
      <stop offset="1" stop-color="#000" stop-opacity="0.52" />
    </linearGradient>
  </defs>
  ${background(concept.accent)}
  ${shapeMarkup(concept.shape, concept.accent)}
</svg>`;
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const manifest = {
  generatedAt: '2026-05-06',
  source: 'procedural SVG concept plates',
  note:
    'Text-based cinematic concept plates for Space Habitats. SVG is used so pull requests remain reviewable in environments that reject binary image diffs.',
  concepts: [],
};

for (const concept of concepts) {
  const output = path.join(outputDir, `${concept.id}.svg`);
  await fs.writeFile(output, `${imageSvg(concept)}\n`);

  manifest.concepts.push({
    id: concept.id,
    title: concept.title,
    output: path.relative(root, output),
    prompt: concept.prompt,
  });
}

await fs.writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${concepts.length} habitat concept SVG images in ${path.relative(root, outputDir)}`);
