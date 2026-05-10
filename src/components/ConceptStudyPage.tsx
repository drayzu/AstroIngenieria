import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, BookOpen, Database, ScrollText } from 'lucide-react';
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

type StudyTab = 'narrative' | 'longRead' | 'dossier';
type EvidenceLevel = 'base' | 'inferred' | 'frontier';

interface ReadingSection {
  id: string;
  title: string;
  body: string[];
  callout?: {
    label: string;
    body: string;
  };
}

interface DossierSection {
  id: string;
  title: string;
  items: Array<{
    label: string;
    body: string;
    evidence: EvidenceLevel;
  }>;
}

const metricLabels = {
  energia: 'Energía',
  materiales: 'Materiales',
  madurez: 'Madurez',
  maravilla: 'Maravilla',
} satisfies Record<keyof AstroConcept['metrics'], string>;

const evidenceLabels = {
  base: 'Base',
  inferred: 'Inferido',
  frontier: 'Frontera',
} satisfies Record<EvidenceLevel, string>;

const getNarrativeTitle = (concept: AstroConcept) => {
  if (concept.id === 'oneill-cylinder') {
    return 'Un paisaje construido dentro de una máquina';
  }

  return concept.keyIdea.replace(/\.$/, '');
};

const getNarrativeLead = (concept: AstroConcept) => {
  if (concept.id === 'oneill-cylinder') {
    return 'El cilindro de O Neill toma una idea casi imposible de sostener en la imaginación: construir no una estación, sino un mundo interior que gira para fabricar gravedad.';
  }

  return `${concept.title} se entiende mejor como una arquitectura de escala ${scaleLabels[concept.scale].toLocaleLowerCase('es')}: ${concept.summary}`;
};

const getReadingSections = (concept: AstroConcept): ReadingSection[] => [
  {
    id: 'idea',
    title: 'Idea central',
    body: [
      concept.keyIdea,
      `La imagen mental útil es esta: ${concept.mentalImage}`,
    ],
    callout: {
      label: 'Clave de lectura',
      body: concept.visualNotes,
    },
  },
  {
    id: 'mecanismo',
    title: 'Cómo funciona',
    body: [
      concept.mechanism,
      `Su promesa principal es ${concept.advantages[0]?.toLocaleLowerCase('es') ?? 'abrir una nueva forma de infraestructura espacial'}.`,
    ],
  },
  {
    id: 'limites',
    title: 'Dónde se vuelve difícil',
    body: [
      concept.difficulties[0] ?? 'La dificultad principal aparece al llevar la idea desde el esquema a una operación estable.',
      concept.difficulties[1] ?? 'También exige mantener energía, materiales y control ambiental dentro de márgenes muy estrechos.',
    ],
  },
];

const getDossier = (concept: AstroConcept): DossierSection[] => [
  {
    id: 'arquitectura',
    title: 'Arquitectura',
    items: [
      {
        label: 'Tipo',
        body: `${concept.category} de escala ${scaleLabels[concept.scale].toLocaleLowerCase('es')}.`,
        evidence: 'base',
      },
      {
        label: 'Principio',
        body: concept.mechanism,
        evidence: 'base',
      },
      {
        label: 'Lectura visual',
        body: concept.mentalImage,
        evidence: 'inferred',
      },
    ],
  },
  {
    id: 'viabilidad',
    title: 'Viabilidad',
    items: [
      {
        label: 'Madurez',
        body: `${plausibilityLabels[concept.plausibility]} con madurez ${concept.metrics.madurez}/5.`,
        evidence: 'base',
      },
      {
        label: 'Materiales',
        body: `${concept.metrics.materiales}/5 en exigencia material. ${concept.difficulties[0] ?? ''}`.trim(),
        evidence: 'inferred',
      },
      {
        label: 'Energía',
        body: `${concept.metrics.energia}/5 en demanda energética. ${concept.keyIdea}`,
        evidence: 'inferred',
      },
    ],
  },
  {
    id: 'operacion',
    title: 'Operación',
    items: [
      {
        label: 'Ventaja',
        body: concept.advantages[0] ?? concept.summary,
        evidence: 'base',
      },
      {
        label: 'Riesgo',
        body: concept.difficulties[1] ?? concept.difficulties[0] ?? 'La operación dependería de control y mantenimiento constantes.',
        evidence: concept.plausibility === 'actual' ? 'base' : 'frontier',
      },
      {
        label: 'Maravilla',
        body: `${concept.metrics.maravilla}/5: ${concept.visualNotes}`,
        evidence: 'inferred',
      },
    ],
  },
];

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
  const [activeTab, setActiveTab] = useState<StudyTab>('narrative');
  const visual = getChapterVisual(concept.chapterId);
  const studyImage = concept.chapterId === 'habitats' ? concept.illustration.src : visual.heroImage;
  const studyImageAlt = concept.chapterId === 'habitats' ? concept.illustration.alt : visual.visualFocus;
  const conceptIndex = Math.max(0, chapterConcepts.findIndex((item) => item.id === concept.id));
  const previousConcept = chapterConcepts[(conceptIndex - 1 + chapterConcepts.length) % chapterConcepts.length];
  const nextConcept = chapterConcepts[(conceptIndex + 1) % chapterConcepts.length];
  const relatedConcepts = concept.related
    .map((id) => allConcepts.find((item) => item.id === id))
    .filter((item): item is AstroConcept => Boolean(item));
  const readingSections = useMemo(() => getReadingSections(concept), [concept]);
  const dossier = useMemo(() => getDossier(concept), [concept]);
  const sourceRefs = concept.sources ?? [];
  const narrativeTitle = getNarrativeTitle(concept);
  const narrativeLead = getNarrativeLead(concept);

  const readingVisual = (
    <figure className="concept-reading-visual">
      <img src={studyImage} alt={studyImageAlt} />
      <figcaption>{concept.visualNotes}</figcaption>
    </figure>
  );

  return (
    <>
      <section className="concept-study-hero" aria-labelledby="concept-study-title">
        <img className="concept-study-media" src={studyImage} alt={studyImageAlt} />
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
          <button type="button" className="sx-button" onClick={() => onToggleCompare(concept.id)}>
            <BarChart3 aria-hidden="true" />
            <span>{isCompared ? 'Quitar del comparador' : 'Agregar al comparador'}</span>
          </button>
        </div>

        <div className="concept-study-layout">
          <div className="concept-study-tabs" role="tablist" aria-label={`Modos de estudio para ${concept.title}`}>
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

          {activeTab === 'narrative' && (
            <div className="concept-narrative-layout" role="tabpanel">
              {readingVisual}
              <div className="concept-reading-flow">
                <article className="concept-narrative">
                  <span className="sx-kicker">Lectura guiada</span>
                  <h2>{narrativeTitle}</h2>
                  <p className="concept-reading-lead">{narrativeLead}</p>
                </article>
                <div className="concept-reading-sections">
                  {readingSections.map((section) => (
                    <section className="concept-reading-section" key={section.id}>
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
                <blockquote className="concept-reading-closing">{concept.keyIdea}</blockquote>
              </div>
            </div>
          )}

          {activeTab === 'longRead' && (
            <div className="concept-longread-layout" role="tabpanel">
              <aside className="concept-longread-aside" aria-label={`Índice de lectura completa de ${concept.title}`}>
                {readingVisual}
                <nav className="concept-longread-index" aria-label="Secciones de lectura completa">
                  <span className="sx-kicker">Índice</span>
                  {readingSections.map((section) => (
                    <a href={`#longread-${section.id}`} key={section.id}>
                      {section.title}
                    </a>
                  ))}
                </nav>
              </aside>

              <article className="concept-longread-article">
                <header className="concept-longread-header">
                  <span className="sx-kicker">Lectura completa</span>
                  <h2>{concept.title}</h2>
                  <p>{narrativeLead}</p>
                </header>
                <div className="concept-longread-sections">
                  {readingSections.map((section) => (
                    <section id={`longread-${section.id}`} className="concept-longread-section" key={section.id}>
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
                <blockquote className="concept-longread-closing">{concept.mentalImage}</blockquote>
                <section className="concept-longread-takeaways" aria-labelledby="longread-takeaways-title">
                  <h3 id="longread-takeaways-title">Para llevarse</h3>
                  <ul>
                    {[...concept.advantages, ...concept.difficulties].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </article>
            </div>
          )}

          {activeTab === 'dossier' && (
            <div className="concept-dossier-layout" role="tabpanel">
              <aside className="concept-dossier-rail" aria-label={`Resumen técnico de ${concept.title}`}>
                <div className="concept-study-visual">
                  <IllustrationViewer
                    concept={concept}
                    compared={isCompared}
                    imageOverride={concept.chapterId === 'habitats' ? undefined : visual.heroImage}
                  />
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
              </aside>

              <div className="concept-dossier-content">
                <div className="concept-dossier-grid">
                  {dossier.map((section) => (
                    <section className="concept-dossier-section" key={section.id}>
                      <h2>{section.title}</h2>
                      <dl>
                        {section.items.map((item) => (
                          <div key={`${section.id}-${item.label}`}>
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

      {sourceRefs.length > 0 && (
        <section className="sx-section sources-section concept-sources" aria-labelledby="concept-sources-title">
          <div className="sx-section-head split">
            <div>
              <span className="sx-kicker">References</span>
              <h2 id="concept-sources-title">Fuentes del concepto</h2>
            </div>
            <p>Referencias específicas para profundizar este concepto.</p>
          </div>
          <SourceList sources={sourceRefs} />
        </section>
      )}
    </>
  );
}
