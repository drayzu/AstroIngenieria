import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dataPath = path.join(root, 'src', 'data', 'astroData.ts');
const outputPath = path.join(root, 'tmp', 'visual-layer-queue.json');
const data = await readFile(dataPath, 'utf8');

const conceptRegex =
  /concept\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'/g;

const visualArchetypeLabels = {
  'introduccion-principios': 'Introducción y principios base',
  'habitats-espaciales': 'Hábitats espaciales',
  'infraestructura-espacial': 'Infraestructura espacial',
  'energia-estelar-computacion': 'Energía estelar y computación cósmica',
  'propulsion-espacial': 'Propulsión espacial',
  'propulsion-especulativa': 'Propulsión especulativa o hipotética',
  'ingenieria-planetaria': 'Ingeniería planetaria',
  'ingenieria-estelar': 'Ingeniería estelar',
  'civilizaciones-seti': 'Civilizaciones cósmicas y SETI',
  'complementarios-abstractos': 'Temas complementarios y abstractos',
};

const visualArchetypeByChapter = {
  intro: 'introduccion-principios',
  habitats: 'habitats-espaciales',
  infrastructure: 'infraestructura-espacial',
  energy: 'energia-estelar-computacion',
  propulsion: 'propulsion-espacial',
  planetary: 'ingenieria-planetaria',
  stellar: 'ingenieria-estelar',
  civilizations: 'civilizaciones-seti',
  complements: 'complementarios-abstractos',
};

const speculativePropulsionConcepts = new Set(['alcubierre', 'wormholes', 'reactionless']);

const visualArchetypeGuidance = {
  'introduccion-principios': {
    conceptual:
      'Represent the principle as an explanatory notebook page: energy scales, rotation, civilization levels, orbital arcs, planets, stars and simple comparative diagrams.',
    immersive:
      'Communicate deep future astroengineering: humanity building at planetary, orbital or stellar scale, with cosmic wonder and civilizational ambition.',
  },
  'habitats-espaciales': {
    conceptual:
      'Show structure and function: cross-section, rotation axis, habitable zones, life support, mirrors, radiators, docking modules, fields or closed ecological loops.',
    immersive:
      'Show the lived interior experience when appropriate: curved landscapes, overhead cities, light bands, water, fields, transit and human scale inside a built world.',
  },
  'infraestructura-espacial': {
    conceptual:
      'Show operations and mechanisms: assembly steps, modules, trajectories, cargo transfer, anchors, vehicles, mining tools, local resources or technical cutaways.',
    immersive:
      'Show an operational scene with robots, astronauts, vehicles, orbital construction, mining, launches, maintenance or industrial activity at space scale.',
  },
  'energia-estelar-computacion': {
    conceptual:
      'Show collectors, orbits, energy flows, radiators, transmission beams, computational layers, modular structure and thermal dissipation around stars or planets.',
    immersive:
      'Show cosmic scale: stars surrounded by swarms, power beams, illuminated planets, giant radiators or civilization capturing stellar energy.',
  },
  'propulsion-espacial': {
    conceptual:
      'Show the working principle: engine geometry, chamber, reactor, sail, beam, magnetic field, particles, propellant flow, thrust vector or braking system.',
    immersive:
      'Show the phenomenon in action: spacecraft accelerating, sails lit by beams, plasma glow, radiation, interstellar travel, braking near a star or extreme speed.',
  },
  'propulsion-especulativa': {
    conceptual:
      'Treat it as theoretical physics, not confirmed technology: spacetime geometry, relativistic diagrams, field bubbles, curvature and explicit uncertainty through visual language.',
    immersive:
      'Keep the scene evocative but sober: spacecraft near gravitational distortion, warped star fields or a theoretical spacetime tunnel without making it look solved.',
  },
  'ingenieria-planetaria': {
    conceptual:
      'Show planetary systems: atmospheric layers, mirrors, sunshades, domes, processors, artificial magnetospheres, ecological cycles or staged transformation.',
    immersive:
      'Show the experience of living or working during transformation: domed cities, Venusian clouds, protected habitats, changing landscapes and adaptive civilization.',
  },
  'ingenieria-estelar': {
    conceptual:
      'Show stars as physical systems: magnetic fields, collectors, mirrors, plasma extraction, jets, stellar acceleration structures or black hole energy interfaces.',
    immersive:
      'Show extreme scale: civilization manipulating a star, plasma streams, structures around a sun, stellar engines, black hole power systems or distant technosignatures.',
  },
  'civilizaciones-seti': {
    conceptual:
      'Avoid turning every idea into a machine; use galactic maps, timelines, expansion fronts, light cones, signals, nodes, probes, filters or civilizational diagrams.',
    immersive:
      'Use a philosophical cosmic mood: galactic colonization patterns, lost signals, observatories listening, silent civilizations, autonomous probes or deep time.',
  },
  'complementarios-abstractos': {
    conceptual:
      'Use editorial or diagrammatic composition: maps, organisms, planets, documents, orbits, timelines, decision networks or governance diagrams without false machinery.',
    immersive:
      'Communicate the central feeling: discovering life, distant worlds, deep future, cosmic decisions, megastructure ruins, ethical dilemmas or humanity facing vast scales.',
  },
};

const visualNegativePrompt =
  'Avoid cartoon, childish illustration, pixel art, cold CAD render, generic stock image, generic AI art, long readable paragraphs, dense typography, logos, watermarks, flags and brand marks.';

const trimCaption = (value, maxLength = 170) => {
  const cleanValue = value.replace(/\s+/g, ' ').trim();
  if (cleanValue.length <= maxLength) {
    return cleanValue;
  }
  return `${cleanValue.slice(0, maxLength).replace(/\s+\S*$/, '')}...`;
};

const cleanPromptSentence = (value) => value.replace(/\s+/g, ' ').replace(/[.。]+$/u, '').trim();

const getVisualArchetype = (chapterId, id) => {
  if (speculativePropulsionConcepts.has(id)) {
    return 'propulsion-especulativa';
  }
  return visualArchetypeByChapter[chapterId] ?? 'complementarios-abstractos';
};

const createPrompt = (concept, layer, visualArchetype) => {
  const archetypeLabel = visualArchetypeLabels[visualArchetype];
  const guidance = visualArchetypeGuidance[visualArchetype][layer];
  const speculativeCaution =
    visualArchetype === 'propulsion-especulativa'
      ? 'Scientific caution: present this as a theoretical visualization or thought experiment, not as confirmed engineering or a solved spacecraft system.'
      : concept.plausibility === 'especulativo'
        ? 'Scientific caution: keep the image speculative and conceptually honest; do not present the idea as confirmed technology.'
        : 'Scientific coherence: keep the design plausible for the stated concept and avoid physically incoherent spectacle.';
  const layerIntro =
    layer === 'conceptual'
      ? 'Layer: boceto conceptual / engineering sketch. Narrative role: how it is thought, how it works, or what principle it represents.'
      : 'Layer: vision artistica / immersive experience. Narrative role: how it would feel, what emotion, scale or meaning it communicates.';
  const style =
    layer === 'conceptual'
      ? [
          'Style: graphite pencil and technical ink sketch on lightly textured paper, visible construction lines, sectional views, arrows, axes and dotted guides; human and preliminary, not a cold CAD blueprint.',
          'Annotation direction: use exactly 3-5 short readable handwritten labels in English, each only 1-3 words, derived from the concept and attached to visible parts of the sketch. Every label must sit inside its own small square or rectangular callout box, with a thin hand-drawn border and an arrow pointing to the relevant part. Use simple labels such as thrust axis, heat flow, habitat ring, signal cone or energy collector only when they fit the subject. Make the boxed labels larger, separated and high-contrast like engineering notebook marginalia. Do not add title headings, bullet lists, paragraphs, tables or dense written notes inside the image. Keep one clear main structure plus 2-4 small auxiliary diagrams. Do not saturate the sheet; the image must remain understandable without relying on the labels.',
        ].join('\n')
      : 'Style: semi-realistic cinematic concept art, credible but evocative, atmospheric lighting, strong composition, rich but disciplined color, sense of scale and wonder without fantasy excess.';

  return [
    'Use case: scientific-educational visual layer for a Spanish astroengineering atlas.',
    layerIntro,
    `Concept: ${concept.title}.`,
    `Visual archetype: ${archetypeLabel}.`,
    `Category: ${concept.category}; scale: ${concept.scale}; plausibility: ${concept.plausibility}.`,
    `Core idea: ${cleanPromptSentence(concept.keyIdea)}.`,
    `Mental image to adapt: ${cleanPromptSentence(concept.mentalImage)}.`,
    `Principle or mechanism to represent: ${cleanPromptSentence(concept.mechanism)}.`,
    speculativeCaution,
    `Archetype-specific direction: ${guidance}`,
    style,
    visualNegativePrompt,
  ].join('\n');
};

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
    summary: match[7],
    keyIdea: match[8],
    mentalImage: match[9],
    mechanism: match[10],
  });
}

const queue = concepts.flatMap((concept) => {
  const visualArchetype = getVisualArchetype(concept.chapterId, concept.id);
  const targetBase = `public/illustrations/ai/concepts/${concept.chapterId}`;

  return [
    {
      slug: concept.id,
      chapterId: concept.chapterId,
      title: concept.title,
      visualArchetype,
      layer: 'conceptual',
      target: `${targetBase}/conceptual/${concept.id}.webp`,
      prompt: createPrompt(concept, 'conceptual', visualArchetype),
      caption: `Una lectura de diseño: ${trimCaption(concept.mechanism)}`,
    },
    {
      slug: concept.id,
      chapterId: concept.chapterId,
      title: concept.title,
      visualArchetype,
      layer: 'immersive',
      target: `${targetBase}/immersive/${concept.id}.webp`,
      prompt: createPrompt(concept, 'immersive', visualArchetype),
      caption: `Una interpretación de escala y experiencia: ${trimCaption(concept.keyIdea)}`,
    },
  ];
});

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: path.relative(root, dataPath),
      total: queue.length,
      concepts: concepts.length,
      note:
        'Queue for generating conceptual sketch and immersive visual layers. Existing exterior images and habitat interiors are intentionally left unchanged.',
      queue,
    },
    null,
    2,
  ),
);

console.log(`Prepared ${queue.length} visual layer prompts for ${concepts.length} concepts in ${path.relative(root, outputPath)}`);
