import { allConcepts, chapters, conceptById } from './astroData';
import type { AstroConcept } from '../types';

export type ReadingContext = 'journey' | 'vitrine';
export const readingSequence = allConcepts;

/** Header, footer and keyboard navigation share the same ordered sequence. */
export function getReadingConnections(
  id: string,
  sequence: AstroConcept[] = readingSequence,
  context: ReadingContext = 'journey',
) {
  const concept = conceptById.get(id);
  const index = sequence.findIndex(item => item.id === id);
  const previous = index > 0 ? sequence[index - 1] : undefined;
  const next = index >= 0 ? sequence[index + 1] : undefined;
  const label = (direction: 'Anterior' | 'Siguiente', target?: AstroConcept) => {
    if (!target) return direction;
    if (context === 'vitrine') return `${direction} en la vitrina: ${target.title}`;
    if (target.chapterId !== concept?.chapterId) {
      const chapter = chapters.find(item => item.id === target.chapterId);
      return `${direction} capítulo: ${chapter?.title} — ${target.title}`;
    }
    return `${direction}: ${target.title}`;
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
