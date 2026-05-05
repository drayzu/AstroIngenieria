import { Eye } from 'lucide-react';
import { plausibilityLabels, scaleLabels } from '../data/astroData';
import type { AstroConcept } from '../types';

interface ConceptGalleryProps {
  concepts: AstroConcept[];
  onOpenConcept: (concept: AstroConcept) => void;
}

export function ConceptGallery({ concepts, onOpenConcept }: ConceptGalleryProps) {
  return (
    <div className="concept-gallery">
      {concepts.map((concept) => (
        <article className="gallery-item" key={concept.id}>
          <button type="button" onClick={() => onOpenConcept(concept)}>
            <img src={concept.illustration.src} alt={concept.illustration.alt} loading="lazy" />
            <span className="gallery-hover">
              <Eye aria-hidden="true" />
              Abrir visor
            </span>
          </button>
          <div className="gallery-caption">
            <span>
              {scaleLabels[concept.scale]} / {plausibilityLabels[concept.plausibility]}
            </span>
            <h3>{concept.title}</h3>
            <p>{concept.visualNotes}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
