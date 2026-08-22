import type { AstroConcept } from '../../types';

export interface ConceptImageVariant {
  id: string;
  label: string;
  src: string;
  caption?: string;
}

export const getConceptImageVariants = (concept: AstroConcept): ConceptImageVariant[] => {
  const out: ConceptImageVariant[] = [];
  const push = (label: string, src: string | undefined, caption?: string) => {
    if (src && !out.some((variant) => variant.src === src)) {
      out.push({ id: label.toLocaleLowerCase('es'), label, src, caption });
    }
  };

  push('Exterior', concept.visualNarrative.exterior.src, concept.visualNarrative.exterior.caption);
  push('Interior', concept.illustration.interior?.src, concept.illustration.interior?.alt);
  push(
    'Boceto conceptual',
    concept.visualNarrative.conceptual.src,
    concept.visualNarrative.conceptual.caption,
  );
  push(
    'Visión inmersiva',
    concept.visualNarrative.immersive.src,
    concept.visualNarrative.immersive.caption,
  );

  if (out.length === 0) {
    out.push({
      id: 'base',
      label: 'Ilustración',
      src: concept.illustration.src,
      caption: concept.illustration.alt,
    });
  }
  return out;
};

export const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
};

export const seededUnit = (value: string): number => (hashString(value) % 10000) / 10000;

/** PRNG determinista (mulberry32): misma semilla, misma secuencia. */
export const createRng = (seed: string) => {
  let state = hashString(seed) || 1;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    unit: next,
    range: (min: number, max: number) => min + next() * (max - min),
    int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
  };
};

export type Rng = ReturnType<typeof createRng>;
