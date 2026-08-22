import type { AstroConcept, Plausibility } from '../../types';
import { createRng } from '../shared/conceptImages';

/**
 * Cronografía — modelo de tiempo profundo: mapea cada concepto a la época
 * (en años logarítmicos) en la que existiría, y define las eras del futuro
 * cósmico que estructuran el scroll.
 */

export interface Era {
  id: string;
  num: string;
  name: string;
  from: number;
  to: number;
  tagline: string;
  description: string;
  accent: string;
}

export const ERAS: Era[] = [
  {
    id: 'lanzamiento',
    num: 'I',
    name: 'Era del Lanzamiento',
    from: 1,
    to: 2,
    tagline: '10¹ – 10² años',
    description:
      'Del presente a un siglo: cohetes reutilizables, estaciones operativas y los primeros talleres en órbita.',
    accent: '#8fd0e8',
  },
  {
    id: 'asentamiento',
    num: 'II',
    name: 'Asentamiento',
    from: 2,
    to: 3,
    tagline: '10² – 10³ años',
    description:
      'De un siglo a un milenio: hábitats rotatorios, bases lunares, ascensores espaciales y las primeras colonias que no dependen de la Tierra.',
    accent: '#9ee66f',
  },
  {
    id: 'industrial',
    num: 'III',
    name: 'Industrialización Solar',
    from: 3,
    to: 5,
    tagline: '10³ – 10⁵ años',
    description:
      'Milenios de construcción a escala del sistema: minería de asteroides, anillos orbitales y los primeros segmentos del enjambre.',
    accent: '#f9d66e',
  },
  {
    id: 'estelar',
    num: 'IV',
    name: 'Ingeniería Estelar',
    from: 5,
    to: 8,
    tagline: '10⁵ – 10⁸ años',
    description:
      'La civilización toca su estrella: motores estelares, extracción de masa y relojería solar para alargar la luz.',
    accent: '#ff7a59',
  },
  {
    id: 'galactica',
    num: 'V',
    name: 'Expansión Galáctica',
    from: 8,
    to: 10,
    tagline: '10⁸ – 10¹⁰ años',
    description:
      'Sondas autorreplicantes y civilizaciones tipo III: la infraestructura se vuelve tan grande que desde lejos es invisible.',
    accent: '#b48ce0',
  },
  {
    id: 'degenerada',
    num: 'VI',
    name: 'Era Degenerada',
    from: 10,
    to: 14,
    tagline: '10¹⁰ – 10¹⁴ años',
    description:
      'Se agota el gas para formar estrellas nuevas; el atlas sigue funcionando con enanas rojas, enanas blancas y luz almacenada.',
    accent: '#d96a4a',
  },
  {
    id: 'agujeros',
    num: 'VII',
    name: 'Era de los Agujeros Negros',
    from: 14,
    to: 40,
    tagline: '10¹⁴ – 10⁴⁰ años',
    description:
      'Solo quedan restos densos y horizontes de sucesos: la última energía disponible es la caída lenta hacia dentro.',
    accent: '#7a6cff',
  },
  {
    id: 'termica',
    num: 'VIII',
    name: 'Muerte Térmica',
    from: 40,
    to: 100,
    tagline: '10⁴⁰ – 10¹⁰⁰ años',
    description:
      'Ni gradiente ni movimiento: el archivo se cierra con la última página casi en blanco.',
    accent: '#3d3a52',
  },
];

/** Overrides curados: id de concepto → índice de era. */
const CURATED_ERAS: Record<string, number> = {
  iss: 0,
  'reusable-launch': 0,
  'chemical-rockets': 0,
  'ion-drives': 0,
  'hall-thrusters': 0,
  'solar-electric': 0,
  'solar-sails': 0,
  seti: 0,
  technosignatures: 0,
  'radio-seti': 0,
  'optical-seti': 0,
  fermi: 0,
  latencia: 0,
  'bernal-sphere': 1,
  'stanford-torus': 1,
  'oneill-cylinder': 1,
  'life-support': 1,
  'lunar-bases': 1,
  'orbital-ports': 1,
  'fuel-depots': 1,
  'space-elevator': 1,
  'bishop-ring': 2,
  'mckendree-cylinder': 2,
  'asteroid-habitat': 2,
  worldship: 2,
  'asteroid-mining': 2,
  'orbital-ring': 2,
  'launch-loop': 2,
  'mass-driver': 2,
  shipyards: 2,
  isru: 1,
  terraforming: 2,
  'terraforming-mars': 2,
  'terraforming-venus': 2,
  'venus-floating': 2,
  paraterraforming: 2,
  worldhouse: 2,
  'domed-cities': 1,
  'orbital-mirrors': 2,
  sunshades: 2,
  magnetospheres: 2,
  'dyson-swarm': 3,
  'dyson-shell': 3,
  'dyson-bubble': 3,
  'statite-swarm': 3,
  'partial-dyson': 2,
  'matrioshka-brain': 4,
  'jupiter-brain': 4,
  computronium: 4,
  'stellar-engine': 3,
  shkadov: 3,
  caplan: 3,
  'star-lifting': 3,
  'stellar-husbandry': 3,
  'black-hole-engineering': 6,
  'kardashev': 4,
  'tipo-iii': 5,
  'galactic-colonization': 4,
  'von-neumann': 4,
  berserkers: 4,
  'cosmic-futures': 6,
  ringworld: 3,
  'space-law': 0,
};

const plausibilityEra: Record<Plausibility, number> = {
  actual: 0,
  plausible: 1,
  frontera: 2,
  especulativo: 4,
};

const eraForConcept = (concept: AstroConcept): number => {
  const curated = CURATED_ERAS[concept.id];
  if (curated !== undefined) {
    return curated;
  }
  const base = plausibilityEra[concept.plausibility];
  if (concept.chapterId === 'stellar') {
    return Math.max(base, 3);
  }
  if (concept.chapterId === 'civilizations' && concept.plausibility === 'especulativo') {
    return 4;
  }
  if (concept.chapterId === 'propulsion' && concept.plausibility === 'especulativo') {
    return 4;
  }
  return base;
};

export interface TimedEvent {
  concept: AstroConcept;
  eraIndex: number;
  logYear: number;
  accent: string;
}

export const buildTimeline = (concepts: AstroConcept[]): TimedEvent[] => {
  const byEra = new Map<number, AstroConcept[]>();
  concepts.forEach((concept) => {
    const eraIndex = eraForConcept(concept);
    const bucket = byEra.get(eraIndex) ?? [];
    bucket.push(concept);
    byEra.set(eraIndex, bucket);
  });

  const events: TimedEvent[] = [];
  byEra.forEach((bucket, eraIndex) => {
    const era = ERAS[eraIndex];
    const rng = createRng(`era-${era.id}`);
    const keys = new Map(bucket.map((concept) => [concept.id, createRng(concept.id).unit()]));
    const shuffled = [...bucket].sort((a, b) => (keys.get(a.id) ?? 0) - (keys.get(b.id) ?? 0));
    shuffled.forEach((concept, index) => {
      const t = (index + 1) / (shuffled.length + 1);
      const jitter = (rng.unit() - 0.5) * ((era.to - era.from) / (shuffled.length + 1)) * 0.6;
      events.push({
        concept,
        eraIndex,
        logYear: Math.min(
          era.to - 0.05,
          Math.max(era.from + 0.05, era.from + (era.to - era.from) * t + jitter),
        ),
        accent: era.accent,
      });
    });
  });

  return events.sort((a, b) => a.logYear - b.logYear);
};
