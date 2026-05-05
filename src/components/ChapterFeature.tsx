import type { AstroChapter, AstroConcept } from '../types';
import { IllustrationViewer } from './IllustrationViewer';

interface ChapterFeatureProps {
  chapter: AstroChapter;
  onOpenConcept: (concept: AstroConcept) => void;
}

export function ChapterFeature({ chapter, onOpenConcept }: ChapterFeatureProps) {
  const leadConcept = chapter.concepts[0];
  const featured = chapter.concepts.slice(0, 4);

  return (
    <article className="chapter-feature" id={`capitulo-${chapter.id}`}>
      <div className="chapter-feature-copy">
        <span className="overline">
          {chapter.number}. {chapter.title}
        </span>
        <h2>{chapter.summary}</h2>
        <p>{chapter.sections[0]?.body}</p>
        <div className="chapter-feature-actions">
          {featured.map((concept) => (
            <button type="button" key={concept.id} onClick={() => onOpenConcept(concept)}>
              {concept.title}
            </button>
          ))}
        </div>
      </div>
      {leadConcept && (
        <button
          type="button"
          className="chapter-feature-visual"
          onClick={() => onOpenConcept(leadConcept)}
        >
          <IllustrationViewer concept={leadConcept} compact />
        </button>
      )}
    </article>
  );
}
