import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, BookOpen, Database, ScrollText } from 'lucide-react';
import { getChapterVisual, plausibilityLabels, scaleLabels, visualArchetypeLabels } from '../data/astroData';
import type { AstroChapter, AstroConcept, ConceptVisualNarrativeLayer, DossierEvidence } from '../types';
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

type ConceptTab = 'narrative' | 'longRead' | 'dossier';

const metricLabels = {
  energia: 'Energía',
  materiales: 'Materiales',
  madurez: 'Madurez',
  maravilla: 'Maravilla',
} satisfies Record<keyof AstroConcept['metrics'], string>;

const evidenceLabels = {
  fuente: 'Fuente',
  estimacion: 'Estimación',
  conceptual: 'Conceptual',
} satisfies Record<DossierEvidence, string>;

interface VisualNarrativeFigureProps {
  layer: ConceptVisualNarrativeLayer;
  className?: string;
}

function VisualNarrativeFigure({ layer, className }: VisualNarrativeFigureProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const canShowImage = Boolean(layer.src && failedSrc !== layer.src);

  useEffect(() => {
    setFailedSrc(null);
  }, [layer.src]);

  return (
    <figure className={['concept-visual-layer', `is-${layer.layer}`, className].filter(Boolean).join(' ')}>
      <div className="concept-visual-layer-head">
        <span>{layer.label}</span>
        <em>{layer.role}</em>
      </div>
      {canShowImage ? (
        <img
          src={layer.src}
          alt={layer.alt}
          loading="lazy"
          onError={() => setFailedSrc(layer.src ?? null)}
        />
      ) : (
        <div className="concept-visual-placeholder" role="img" aria-label={layer.alt}>
          <span>{layer.label} preparado</span>
          <p>{layer.caption}</p>
        </div>
      )}
      <figcaption>{layer.caption}</figcaption>
      {!canShowImage && (
        <details className="concept-visual-prompt">
          <summary>Prompt preparado</summary>
          <p>{layer.prompt}</p>
          <span>{layer.target}</span>
        </details>
      )}
    </figure>
  );
}

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
  const [activeTab, setActiveTab] = useState<ConceptTab>('narrative');
  const [imageMode, setImageMode] = useState<'exterior' | 'interior'>('exterior');
  const visual = getChapterVisual(concept.chapterId);
  const hasInterior = Boolean(concept.illustration.interior);
  const activeIllustration =
    imageMode === 'interior' && concept.illustration.interior
      ? concept.illustration.interior
      : concept.illustration;
  const viewingInterior = imageMode === 'interior' && hasInterior;
  const conceptIndex = Math.max(0, chapterConcepts.findIndex((item) => item.id === concept.id));
  const previousConcept = chapterConcepts[(conceptIndex - 1 + chapterConcepts.length) % chapterConcepts.length];
  const nextConcept = chapterConcepts[(conceptIndex + 1) % chapterConcepts.length];
  const relatedConcepts = concept.related
    .map((id) => allConcepts.find((item) => item.id === id))
    .filter((item): item is AstroConcept => Boolean(item));
  const sourceRefs = concept.sources ?? chapter.sources;

  useEffect(() => {
    setImageMode('exterior');
  }, [concept.id]);

  const renderVariantSwitch = () =>
    hasInterior ? (
      <div className="concept-variant-switch" role="group" aria-label={`Variantes visuales de ${concept.title}`}>
        <button
          type="button"
          className={imageMode === 'exterior' ? 'is-active' : ''}
          onClick={() => setImageMode('exterior')}
        >
          Exterior técnico
        </button>
        <button
          type="button"
          className={imageMode === 'interior' ? 'is-active' : ''}
          onClick={() => setImageMode('interior')}
        >
          Interior vivido
        </button>
      </div>
    ) : null;

  const renderReadingVisual = () => (
    <VisualNarrativeFigure layer={concept.visualNarrative.exterior} className="concept-reading-visual" />
  );

  const renderTechnicalVisual = () => (
    <div className="concept-study-visual">
      {renderVariantSwitch()}
      <IllustrationViewer
        concept={concept}
        compared={isCompared}
        imageOverride={activeIllustration.src}
        altOverride={activeIllustration.alt}
        hotspotsEnabled={!viewingInterior}
      />
    </div>
  );

  return (
    <>
      <section className="concept-study-hero" aria-labelledby="concept-study-title">
        <img
          className="concept-study-media"
          src={concept.visualNarrative.exterior.src}
          alt={concept.visualNarrative.exterior.alt}
        />
        <div className="concept-study-scrim" />
        <div className="concept-study-copy">
          <span className="sx-kicker">{visual.missionLabel}</span>
          <h1 id="concept-study-title">{concept.title}</h1>
          <p>{concept.narrative.lead}</p>
          <div className="modal-tags">
            <span>{scaleLabels[concept.scale]}</span>
            <span>{plausibilityLabels[concept.plausibility]}</span>
            <span>{concept.category}</span>
            <span>{visualArchetypeLabels[concept.visualArchetype]}</span>
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
          <button type="button" className="sx-button" onClick={() => onBackToMission(chapter)}>
            <span>Volver a {chapter.title}</span>
            <ArrowUpRight aria-hidden="true" />
          </button>
          <button type="button" className={isCompared ? 'sx-button primary' : 'sx-button'} onClick={() => onToggleCompare(concept.id)}>
            <BarChart3 aria-hidden="true" />
            <span>{isCompared ? 'Quitar del comparador' : 'Agregar al comparador'}</span>
          </button>
        </div>

        <div className="concept-study-layout">
          <div className="concept-study-tabs" role="tablist" aria-label={`Contenido de ${concept.title}`}>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'narrative'}
              className={activeTab === 'narrative' ? 'is-active' : ''}
              onClick={() => setActiveTab('narrative')}
            >
              <BookOpen aria-hidden="true" />
              <span>Lectura</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'longRead'}
              className={activeTab === 'longRead' ? 'is-active' : ''}
              onClick={() => setActiveTab('longRead')}
            >
              <ScrollText aria-hidden="true" />
              <span>Lectura completa</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'dossier'}
              className={activeTab === 'dossier' ? 'is-active' : ''}
              onClick={() => setActiveTab('dossier')}
            >
              <Database aria-hidden="true" />
              <span>Dossier técnico</span>
            </button>
          </div>

          {activeTab === 'narrative' ? (
            <div className="concept-narrative-layout" role="tabpanel">
              {renderReadingVisual()}
              <div className="concept-reading-flow">
                <article className="concept-narrative">
                  <span className="sx-kicker">Lectura guiada</span>
                  <h2>{concept.narrative.title}</h2>
                  <p className="concept-reading-lead">{concept.narrative.lead}</p>
                </article>

                <VisualNarrativeFigure
                  layer={concept.visualNarrative.conceptual}
                  className="concept-reading-support"
                />

                <div className="concept-reading-sections">
                  {concept.narrative.sections.map((section) => (
                    <section key={section.id} className="concept-reading-section">
                      <h3>{section.title}</h3>
                      {section.body.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </section>
                  ))}
                </div>

                <VisualNarrativeFigure
                  layer={concept.visualNarrative.immersive}
                  className="concept-reading-immersive"
                />

                <blockquote className="concept-reading-closing">{concept.narrative.closing}</blockquote>
              </div>
            </div>
          ) : activeTab === 'longRead' ? (
            <div className="concept-longread-layout" role="tabpanel">
              <aside className="concept-longread-aside" aria-label={`Índice de lectura completa de ${concept.title}`}>
                {renderReadingVisual()}
                <nav className="concept-longread-index" aria-label="Secciones de lectura completa">
                  <span className="sx-kicker">Índice</span>
                  {concept.longRead.sections.map((section) => (
                    <a key={section.id} href={`#longread-${section.id}`}>
                      {section.title}
                    </a>
                  ))}
                </nav>
              </aside>

              <article className="concept-longread-article">
                <header className="concept-longread-header">
                  <span className="sx-kicker">Lectura completa</span>
                  <h2>{concept.longRead.title}</h2>
                  <p>{concept.longRead.subtitle}</p>
                </header>

                <div className="concept-longread-sections">
                  {concept.longRead.sections.map((section) => (
                    <section key={section.id} id={`longread-${section.id}`} className="concept-longread-section">
                      <h3>{section.title}</h3>
                      {section.body.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                      {section.callout && (
                        <aside className="concept-longread-callout">
                          <strong>{section.callout.label}</strong>
                          <p>{section.callout.body}</p>
                        </aside>
                      )}
                    </section>
                  ))}
                </div>

                <blockquote className="concept-longread-closing">{concept.longRead.closing}</blockquote>

                <section className="concept-longread-takeaways" aria-labelledby="longread-takeaways-title">
                  <h3 id="longread-takeaways-title">Para llevarse</h3>
                  <ul>
                    {concept.longRead.takeaways.map((takeaway) => (
                      <li key={takeaway}>{takeaway}</li>
                    ))}
                  </ul>
                </section>
              </article>
            </div>
          ) : (
            <div className="concept-dossier-layout" role="tabpanel">
              <aside className="concept-dossier-rail" aria-label={`Resumen técnico de ${concept.title}`}>
                {renderTechnicalVisual()}
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
              </aside>

              <div className="concept-dossier-content">
                <div className="concept-dossier-grid">
                  {concept.dossier.map((section) => (
                    <section className="concept-dossier-section" key={section.id}>
                      <h2>{section.title}</h2>
                      <dl>
                        {section.items.map((item) => (
                          <div key={`${section.id}-${item.label}-${item.body}`}>
                            <dt>
                              <span>{item.label}</span>
                              <em>{evidenceLabels[item.evidence]}</em>
                            </dt>
                            <dd>{item.body}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ))}
                </div>

                {relatedConcepts.length > 0 && (
                  <div className="concept-related">
                    <span className="sx-kicker">Sistemas relacionados</span>
                    <div>
                      {relatedConcepts.map((related) => (
                        <button type="button" key={related.id} onClick={() => onNavigateConcept(related)}>
                          {related.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {sourceRefs.length > 0 && (
                  <div className="concept-dossier-sources">
                    <span className="sx-kicker">Fuentes / referencias</span>
                    <SourceList sources={sourceRefs} compact />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
