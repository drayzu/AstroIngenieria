import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { getChapterVisual, plausibilityLabels, scaleLabels } from '../data/astroData';
import type { AstroChapter, AstroConcept } from '../types';
import { IllustrationViewer } from './IllustrationViewer';
import { SourceList } from './SourceList';

interface ConceptStudyPageProps {
  concept: AstroConcept;
  chapter: AstroChapter;
  chapterConcepts: AstroConcept[];
  allConcepts: AstroConcept[];
  isCompared: boolean;
  onBackToMission: (chapter: AstroChapter) => void;
  onNavigateConcept: (concept: AstroConcept) => void;
  onToggleCompare: (conceptId: string) => void;
}

const metricLabels = {
  energia: 'Energía',
  materiales: 'Materiales',
  madurez: 'Madurez',
  maravilla: 'Maravilla',
} satisfies Record<keyof AstroConcept['metrics'], string>;

export function ConceptStudyPage({
  concept,
  chapter,
  chapterConcepts,
  allConcepts,
  isCompared,
  onBackToMission,
  onNavigateConcept,
  onToggleCompare,
}: ConceptStudyPageProps) {
  const visual = getChapterVisual(concept.chapterId);
  const conceptIndex = Math.max(0, chapterConcepts.findIndex((item) => item.id === concept.id));
  const previousConcept = chapterConcepts[(conceptIndex - 1 + chapterConcepts.length) % chapterConcepts.length];
  const nextConcept = chapterConcepts[(conceptIndex + 1) % chapterConcepts.length];
  const relatedConcepts = concept.related
    .map((id) => allConcepts.find((item) => item.id === id))
    .filter((item): item is AstroConcept => Boolean(item));

  return (
    <>
      <section className="concept-study-hero" aria-labelledby="concept-study-title">
        <img className="concept-study-media" src={visual.heroImage} alt={visual.visualFocus} />
        <div className="concept-study-scrim" />
        <div className="concept-study-copy">
          <span className="sx-kicker">{visual.missionLabel}</span>
          <h1 id="concept-study-title">{concept.title}</h1>
          <p>{concept.summary}</p>
          <div className="modal-tags">
            <span>{scaleLabels[concept.scale]}</span>
            <span>{plausibilityLabels[concept.plausibility]}</span>
            <span>{concept.category}</span>
          </div>
          <div className="mission-actions">
            <button type="button" className="sx-button primary" onClick={() => onBackToMission(chapter)}>
              <span>Volver a {chapter.title}</span>
              <ArrowUpRight aria-hidden="true" />
            </button>
            <button type="button" className="sx-button" onClick={() => onToggleCompare(concept.id)}>
              <span>{isCompared ? 'Quitar del comparador' : 'Agregar al comparador'}</span>
            </button>
          </div>
        </div>
      </section>

      <section className="sx-section concept-study-section" aria-label={`Estudio de ${concept.title}`}>
        <div className="concept-route-controls">
          <button type="button" className="sx-button" onClick={() => onNavigateConcept(previousConcept)}>
            <ArrowLeft aria-hidden="true" />
            <span>Concepto anterior</span>
          </button>
          <button type="button" className="sx-button" onClick={() => onNavigateConcept(nextConcept)}>
            <span>Siguiente concepto</span>
            <ArrowRight aria-hidden="true" />
          </button>
        </div>

        <div className="concept-study-layout">
          <div className="concept-study-visual">
            <IllustrationViewer concept={concept} compared={isCompared} imageOverride={visual.heroImage} />
          </div>

          <div className="concept-study-grid">
            <article>
              <h2>Idea clave</h2>
              <p>{concept.keyIdea}</p>
            </article>
            <article>
              <h2>Cómo funciona</h2>
              <p>{concept.mechanism}</p>
            </article>
            <article>
              <h2>Qué mirar</h2>
              <p>{concept.visualNotes}</p>
            </article>
            <article>
              <h2>Imagen mental</h2>
              <p>{concept.mentalImage}</p>
            </article>
            <article>
              <h2>Ventajas</h2>
              <ul>
                {concept.advantages.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article>
              <h2>Dificultades</h2>
              <ul>
                {concept.difficulties.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>

          <div className="dark-metrics concept-metrics">
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

          {relatedConcepts.length > 0 && (
            <div className="concept-related">
              <span className="sx-kicker">Related systems</span>
              <div>
                {relatedConcepts.map((related) => (
                  <button type="button" key={related.id} onClick={() => onNavigateConcept(related)}>
                    {related.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {concept.sources && concept.sources.length > 0 && (
        <section className="sx-section sources-section concept-sources" aria-labelledby="concept-sources-title">
          <div className="sx-section-head split">
            <div>
              <span className="sx-kicker">References</span>
              <h2 id="concept-sources-title">Fuentes del concepto</h2>
            </div>
            <p>Referencias específicas para profundizar este concepto.</p>
          </div>
          <SourceList sources={concept.sources} />
        </section>
      )}
    </>
  );
}
