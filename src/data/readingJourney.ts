import { allConcepts } from './astroData';
import { getCatalog } from '../i18n/catalog';
import { translate, type Locale } from '../i18n/messages';
import type { AstroConcept } from '../types';

export type ReadingContext = 'journey' | 'vitrine';
export const readingSequence = allConcepts;

/** Header, footer and keyboard navigation share the same ordered sequence. */
export function getReadingConnections(
  id: string,
  sequence: AstroConcept[] = readingSequence,
  context: ReadingContext = 'journey',
  locale: Locale = 'es',
) {
  const { chapters, conceptById } = getCatalog(locale);
  const concept = conceptById.get(id);
  const index = sequence.findIndex(item => item.id === id);
  const previous = index > 0 ? sequence[index - 1] : undefined;
  const next = index >= 0 ? sequence[index + 1] : undefined;
  const label = (direction: 'Anterior' | 'Siguiente', target?: AstroConcept) => {
    const translatedDirection = translate(direction, locale);
    if (!target) return translatedDirection;
    if (context === 'vitrine') return translate('{0} en la vitrina: {1}', locale, translatedDirection, target.title);
    if (target.chapterId !== concept?.chapterId) {
      const chapter = chapters.find(item => item.id === target.chapterId);
      return translate('{0} capítulo: {1} — {2}', locale, translatedDirection, chapter?.title ?? '', target.title);
    }
    return `${translatedDirection}: ${target.title}`;
  };
  const related = [...new Set(concept?.related ?? [])]
    .filter(candidate => candidate !== id && candidate !== previous?.id && candidate !== next?.id)
    .flatMap(candidate => {
      const item = conceptById.get(candidate);
      return item ? [item] : [];
    })
    .slice(0, 3);
  return {
    index, total: sequence.length, previous, next, related,
    previousLabel: label('Anterior', previous), nextLabel: label('Siguiente', next),
  };
}
