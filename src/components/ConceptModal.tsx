import { BarChart3, BookMarked, GitBranch, Layers3, X } from 'lucide-react';
import { plausibilityLabels, scaleLabels } from '../data/astroData';
import type { AstroConcept } from '../types';
import { IllustrationViewer } from './IllustrationViewer';
import { SourceList } from './SourceList';

interface ConceptModalProps {
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

export function ConceptModal({
  concept,
  allConcepts,
  isCompared,
  onClose,
  onOpenConcept,
  onToggleCompare,
}: ConceptModalProps) {
  const relatedConcepts = concept.related
    .map((id) => allConcepts.find((item) => item.id === id))
    .filter((item): item is AstroConcept => Boolean(item));

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="concept-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="concept-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar ficha">
          <X aria-hidden="true" />
        </button>

        <div className="modal-kicker">
          <span>{scaleLabels[concept.scale]}</span>
          <span>{plausibilityLabels[concept.plausibility]}</span>
          <span>{concept.category}</span>
        </div>
        <h2 id="concept-modal-title">{concept.title}</h2>
        <p className="modal-summary">{concept.summary}</p>

        <IllustrationViewer concept={concept} compared={isCompared} />

        <div className="modal-grid">
          <div className="modal-section">
            <h3>
              <BookMarked aria-hidden="true" />
              Idea clave
            </h3>
            <p>{concept.keyIdea}</p>
          </div>
          <div className="modal-section">
            <h3>
              <Layers3 aria-hidden="true" />
              Imagen mental
            </h3>
            <p>{concept.mentalImage}</p>
          </div>
          <div className="modal-section wide">
            <h3>Cómo funciona</h3>
            <p>{concept.mechanism}</p>
          </div>
        </div>

        <div className="pros-cons">
          <div>
            <h3>Ventajas</h3>
            <ul>
              {concept.advantages.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Dificultades</h3>
            <ul>
              {concept.difficulties.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="metric-panel">
          {(Object.keys(metricLabels) as Array<keyof AstroConcept['metrics']>).map((metric) => (
            <div className="metric-row" key={metric}>
              <span>{metricLabels[metric]}</span>
              <div className="metric-track" aria-hidden="true">
                <i style={{ width: `${concept.metrics[metric] * 20}%` }} />
              </div>
              <strong>{concept.metrics[metric]}/5</strong>
            </div>
          ))}
        </div>

        <div className="related-panel">
          <h3>
            <GitBranch aria-hidden="true" />
            Conceptos relacionados
          </h3>
          <div className="related-list">
            {relatedConcepts.map((related) => (
              <button type="button" key={related.id} onClick={() => onOpenConcept(related.id)}>
                {related.title}
              </button>
            ))}
          </div>
        </div>

        {concept.sources && concept.sources.length > 0 && (
          <div className="modal-sources">
            <h3>Fuentes para seguir</h3>
            <SourceList sources={concept.sources} compact />
          </div>
        )}

        <div className="visual-prompt">
          <h3>Prompt visual</h3>
          <p>{concept.illustration.prompt}</p>
          <span>{concept.illustration.credit}</span>
        </div>

        <button
          type="button"
          className={isCompared ? 'modal-compare is-active' : 'modal-compare'}
          onClick={() => onToggleCompare(concept.id)}
        >
          <BarChart3 aria-hidden="true" />
          {isCompared ? 'Quitar del comparador' : 'Agregar al comparador'}
        </button>
      </section>
    </div>
  );
}
