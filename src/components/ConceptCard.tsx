import { BarChart3, Eye, Link2 } from 'lucide-react';
import { plausibilityLabels, scaleLabels } from '../data/astroData';
import type { AstroConcept } from '../types';

interface ConceptCardProps {
  concept: AstroConcept;
  isCompared: boolean;
  onOpen: (concept: AstroConcept) => void;
  onToggleCompare: (conceptId: string) => void;
}

export function ConceptCard({
  concept,
  isCompared,
  onOpen,
  onToggleCompare,
}: ConceptCardProps) {
  return (
    <article className="concept-card">
      <div className="concept-card-header">
        <span>{concept.category}</span>
        <span>{plausibilityLabels[concept.plausibility]}</span>
      </div>
      <h3>{concept.title}</h3>
      <p>{concept.summary}</p>
      <div className="concept-tags">
        <span>{scaleLabels[concept.scale]}</span>
        <span>
          <Link2 aria-hidden="true" />
          {concept.related.length} conexiones
        </span>
      </div>
      <div className="concept-actions">
        <button type="button" onClick={() => onOpen(concept)}>
          <Eye aria-hidden="true" />
          Ver ficha
        </button>
        <button
          type="button"
          className={isCompared ? 'is-active' : ''}
          onClick={() => onToggleCompare(concept.id)}
        >
          <BarChart3 aria-hidden="true" />
          {isCompared ? 'Comparando' : 'Comparar'}
        </button>
      </div>
    </article>
  );
}
