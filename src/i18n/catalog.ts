import { chapters as spanishChapters } from '../data/astroData';
import type { AstroChapter, AstroConcept } from '../types';
import englishCopy from './catalog.en.json';
import type { Locale } from './messages';

type Copy = { [key: string]: string | Copy | (string | Copy)[] };
function overlay<T>(original: T, copy: Copy): T {
  const result = { ...original } as Record<string, unknown>;
  for (const [key, text] of Object.entries(copy)) {
    const source = result[key];
    result[key] = Array.isArray(text) ? text.map((item, index) => typeof item === 'string' ? item : overlay((source as unknown[])[index], item))
      : typeof text === 'object' ? overlay(source, text) : text;
  }
  return result as T;
}

const translations = englishCopy as { chapters: Record<string, Copy>; concepts: Record<string, Copy> };
const englishChapters = spanishChapters.map(chapter => ({
  ...overlay(chapter, translations.chapters[chapter.id]),
  concepts: chapter.concepts.map(concept => overlay(concept, translations.concepts[concept.id])),
}));
function catalog(chapters: AstroChapter[]) {
  const allConcepts = chapters.flatMap(chapter => chapter.concepts);
  return { chapters, allConcepts, conceptById: new Map<string, AstroConcept>(allConcepts.map(concept => [concept.id, concept])) };
}
const catalogs = { es: catalog(spanishChapters), en: catalog(englishChapters) };
export const getCatalog = (locale: Locale = 'es') => catalogs[locale];
