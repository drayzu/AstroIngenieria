import { X } from 'lucide-react';
import { getChapterVisual, plausibilityLabels, scaleLabels } from '../data/astroData';
import type { AstroConcept } from '../types';
import { IllustrationViewer } from './IllustrationViewer';

interface DarkConceptModalProps {
  concept: AstroConcept;
  allConcepts: AstroConcept[];
  isCompared: boolean;
  onClose: () => void;
  onOpenConcept: (conceptId: string) => void;
  onToggleCompare: (conceptId: string) => void;
}

const metricLabels = {
  energia: 'Energía',
  materiales: 'Materiales',
  madurez: 'Madurez',
  maravilla: 'Maravilla',
} satisfies Record<keyof AstroConcept['metrics'], string>;

export function DarkConceptModal({
  concept,
  allConcepts,
  isCompared,
  onClose,
  onOpenConcept,
  onToggleCompare,
}: DarkConceptModalProps) {
  const visual = getChapterVisual(concept.chapterId);
  const relatedConcepts = concept.related
    .map((id) => allConcepts.find((item) => item.id === id))
    .filter((item): item is AstroConcept => Boolean(item));

  return (
    <div className="dark-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dark-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="concept-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar ficha">
          <X aria-hidden="true" />
        </button>
        <div className="dark-modal-head">
          <span className="sx-kicker">{visual.missionLabel}</span>
          <h2 id="concept-modal-title">{concept.title}</h2>
          <p>{concept.summary}</p>
          <div className="modal-tags">
            <span>{scaleLabels[concept.scale]}</span>
            <span>{plausibilityLabels[concept.plausibility]}</span>
            <span>{concept.category}</span>
          </div>
        </div>

        <IllustrationViewer concept={concept} compared={isCompared} imageOverride={visual.heroImage} />

        <div className="dark-modal-grid">
          <article>
            <h3>Mission brief</h3>
            <p>{concept.keyIdea}</p>
          </article>
          <article>
            <h3>Cómo funciona</h3>
            <p>{concept.mechanism}</p>
          </article>
          <article>
            <h3>Ventajas</h3>
            <ul>
              {concept.advantages.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article>
            <h3>Riesgos</h3>
            <ul>
              {concept.difficulties.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>

        <div className="dark-metrics">
          {(Object.keys(metricLabels) as Array<keyof AstroConcept['metrics']>).map((metric) => (
            <div key={metric}>
              <span>{metricLabels[metric]}</span>
              <i>
                <b style={{ width: `${concept.metrics[metric] * 20}%` }} />
              </i>
              <strong>{concept.metrics[metric]}/5</strong>
            </div>
          ))}
        </div>

        <div className="dark-related">
          {relatedConcepts.map((related) => (
            <button type="button" key={related.id} onClick={() => onOpenConcept(related.id)}>
              {related.title}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={isCompared ? 'sx-button primary modal-compare is-active' : 'sx-button modal-compare'}
          onClick={() => onToggleCompare(concept.id)}
        >
          <span>{isCompared ? 'Quitar del comparador' : 'Agregar al comparador'}</span>
        </button>
      </section>
    </div>
  );
}
