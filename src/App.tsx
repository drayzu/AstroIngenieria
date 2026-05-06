import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Filter, GitBranch, Search } from 'lucide-react';
import { allConcepts, chapters, plausibilityLabels, scaleLabels } from './data/astroData';
import { CinematicGallery } from './components/CinematicGallery';
import { ConceptStudyPage } from './components/ConceptStudyPage';
import { ComparisonMatrix } from './components/ComparisonMatrix';
import { MissionChapter } from './components/MissionChapter';
import { MissionSideNav } from './components/MissionSideNav';
import { SourceList } from './components/SourceList';
import { SpacexHero } from './components/SpacexHero';
import type { AstroChapter, AstroConcept, AstroScale, Plausibility } from './types';

type FilterValue<T extends string> = 'all' | T;
type AppRoute =
  | { page: 'home' }
  | { page: 'mission'; chapterId: string }
  | { page: 'concept'; conceptId: string };

const scaleOptions = Object.keys(scaleLabels) as AstroScale[];
const plausibilityOptions = Object.keys(plausibilityLabels) as Plausibility[];
const defaultComparisonIds = ['oneill-cylinder', 'dyson-swarm', 'mars-terraforming', 'caplan'];

const chapterRoutes: Record<string, string> = {
  intro: 'Introduccion',
  habitats: 'Habitats',
  infrastructure: 'Infraestructura',
  energy: 'Energia',
  propulsion: 'Propulsion',
  planetary: 'Planetaria',
  stellar: 'Estelar',
  civilizations: 'Civilizaciones',
  complements: 'Complementarios',
};

const routeToChapterId = Object.fromEntries(
  Object.entries(chapterRoutes).map(([chapterId, route]) => [route.toLocaleLowerCase('es'), chapterId]),
) as Record<string, string>;

const getConceptSlug = (concept: AstroConcept) =>
  concept.id
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toLocaleUpperCase('es')}${part.slice(1)}`)
    .join('-');

const routeToConceptId = Object.fromEntries(
  allConcepts.map((concept) => [getConceptSlug(concept).toLocaleLowerCase('es'), concept.id]),
) as Record<string, string>;

const normalize = (value: string) =>
  value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const normalizeBase = () => import.meta.env.BASE_URL.replace(/\/$/, '');

const getRouteFromLocation = (): AppRoute => {
  const base = normalizeBase();
  const pathname = decodeURIComponent(window.location.pathname);
  const localPath = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  const [chapterSegment, conceptSegment] = localPath
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .map((segment) => segment.toLocaleLowerCase('es'));
  const chapterId = routeToChapterId[chapterSegment];
  const conceptId = conceptSegment ? routeToConceptId[conceptSegment] : null;

  if (conceptId) {
    return { page: 'concept', conceptId };
  }
  return chapterId ? { page: 'mission', chapterId } : { page: 'home' };
};

const getChapterUrl = (chapter: AstroChapter) => `${import.meta.env.BASE_URL}${chapterRoutes[chapter.id]}`;
const getConceptUrl = (concept: AstroConcept) => {
  const chapter = chapters.find((item) => item.id === concept.chapterId) ?? chapters[0];
  return `${getChapterUrl(chapter)}/${getConceptSlug(concept)}`;
};

function App() {
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromLocation());
  const [activeScale, setActiveScale] = useState<FilterValue<AstroScale>>('all');
  const [activePlausibility, setActivePlausibility] =
    useState<FilterValue<Plausibility>>('all');
  const [query, setQuery] = useState('');
  const [comparisonIds, setComparisonIds] = useState<string[]>(defaultComparisonIds);
  const [sideNavOpen, setSideNavOpen] = useState(false);
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  const activeConcept = route.page === 'concept'
    ? allConcepts.find((concept) => concept.id === route.conceptId) ?? null
    : null;
  const activeChapter = route.page === 'mission'
    ? chapters.find((chapter) => chapter.id === route.chapterId) ?? chapters[0]
    : activeConcept
      ? chapters.find((chapter) => chapter.id === activeConcept.chapterId) ?? chapters[0]
      : null;

  const missionConcepts = useMemo(() => {
    const cleanQuery = normalize(query.trim());

    if (!activeChapter) {
      return [];
    }

    return allConcepts.filter((concept) => {
      const searchable = normalize(
        [
          concept.title,
          concept.category,
          concept.summary,
          concept.keyIdea,
          concept.mentalImage,
          concept.mechanism,
          concept.visualNotes,
        ].join(' '),
      );

      return (
        concept.chapterId === activeChapter.id &&
        (activeScale === 'all' || concept.scale === activeScale) &&
        (activePlausibility === 'all' || concept.plausibility === activePlausibility) &&
        (cleanQuery.length === 0 || searchable.includes(cleanQuery))
      );
    });
  }, [activeChapter, activeScale, activePlausibility, query]);

  const sourceRefs = useMemo(() => {
    const byUrl = new Map<string, (typeof chapters)[number]['sources'][number]>();
    chapters.forEach((chapter) => chapter.sources.forEach((source) => byUrl.set(source.url, source)));
    allConcepts.forEach((concept) =>
      concept.sources?.forEach((source) => byUrl.set(source.url, source)),
    );
    return [...byUrl.values()];
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRoute(getRouteFromLocation());
      setSideNavOpen(false);
      setPendingScrollId('top');
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (route.page !== 'concept' || !activeConcept) {
      return;
    }

    const canonicalUrl = getConceptUrl(activeConcept);
    if (window.location.pathname !== canonicalUrl) {
      window.history.replaceState(null, '', canonicalUrl);
    }
  }, [activeConcept, route]);

  useEffect(() => {
    if (!pendingScrollId) {
      return;
    }

    window.requestAnimationFrame(() => {
      scrollToSection(pendingScrollId);
      setPendingScrollId(null);
    });
  }, [pendingScrollId, route]);

  const resetMissionFilters = () => {
    setActiveScale('all');
    setActivePlausibility('all');
    setQuery('');
  };

  const pushRoute = (nextRoute: AppRoute, url: string, scrollId = 'top') => {
    window.history.pushState(null, '', url);
    setRoute(nextRoute);
    setSideNavOpen(false);
    setPendingScrollId(scrollId);
  };

  const navigateHome = (scrollId = 'top') => {
    resetMissionFilters();
    pushRoute({ page: 'home' }, import.meta.env.BASE_URL, scrollId);
  };

  const navigateChapter = (chapter: AstroChapter, scrollId = 'top') => {
    resetMissionFilters();
    pushRoute({ page: 'mission', chapterId: chapter.id }, getChapterUrl(chapter), scrollId);
  };

  const navigateConcept = (concept: AstroConcept) => {
    resetMissionFilters();
    pushRoute({ page: 'concept', conceptId: concept.id }, getConceptUrl(concept));
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  const toggleComparison = (conceptId: string) => {
    setComparisonIds((current) => {
      if (current.includes(conceptId)) {
        return current.filter((id) => id !== conceptId);
      }
      return [...current.slice(-4), conceptId];
    });
  };

  const handleSideMission = (chapter: AstroChapter) => {
    if (route.page === 'home') {
      setSideNavOpen(false);
      scrollToSection(`mission-${chapter.id}`);
      return;
    }

    navigateChapter(chapter);
  };

  const handleSideConcepts = () => {
    if (route.page === 'mission') {
      setSideNavOpen(false);
      scrollToSection('mission-concepts');
      return;
    }

    if (route.page === 'concept' && activeChapter) {
      navigateChapter(activeChapter, 'mission-concepts');
      return;
    }

    navigateChapter(chapters[0], 'mission-concepts');
  };

  const renderHome = () => (
    <>
      <SpacexHero chapter={chapters[0]} conceptCount={allConcepts.length} />

      <section id="missions" className="sx-section mission-section" aria-labelledby="missions-title">
        <div className="sx-section-head">
          <span className="sx-kicker">Flight plan</span>
          <h2 id="missions-title">Nueve misiones para entender la astroingeniería</h2>
        </div>
        <div className="mission-stack">
          {chapters.map((chapter, index) => (
            <MissionChapter
              key={chapter.id}
              chapter={chapter}
              index={index}
              onExploreChapter={navigateChapter}
            />
          ))}
        </div>
      </section>

      <section id="compare" className="sx-section compare-section" aria-labelledby="compare-title">
        <div className="sx-section-head">
          <span className="sx-kicker">Telemetry</span>
          <h2 id="compare-title">Comparar arquitectura, energía y madurez</h2>
          <p>Un resumen técnico para contrastar ideas sin perder el contexto visual.</p>
        </div>
        <ComparisonMatrix
          concepts={allConcepts}
          comparisonIds={comparisonIds}
          onToggleConcept={toggleComparison}
          onSelectConcept={navigateConcept}
        />
      </section>

      <section id="sources" className="sx-section sources-section" aria-labelledby="sources-title">
        <div className="sx-section-head split">
          <div>
            <span className="sx-kicker">References</span>
            <h2 id="sources-title">Fuentes y documentación</h2>
          </div>
          <p>
            El contenido parte del TXT original y se apoya en referencias técnicas para mantener
            el atlas visual conectado con fuentes reales.
          </p>
        </div>
        <SourceList sources={sourceRefs} />
        <a className="sx-button source-link" href="https://github.com/drayo00/AstroIngenieria" target="_blank" rel="noreferrer">
          <span>Ver repositorio</span>
          <ArrowUpRight aria-hidden="true" />
        </a>
      </section>
    </>
  );

  const renderMissionPage = (chapter: AstroChapter) => {
    const chapterIndex = chapters.findIndex((item) => item.id === chapter.id);
    const previousChapter = chapters[(chapterIndex - 1 + chapters.length) % chapters.length];
    const nextChapter = chapters[(chapterIndex + 1) % chapters.length];

    return (
      <>
        <section className="mission-study-hero" id="mission-study-top" aria-labelledby="mission-study-title">
          <img className="mission-study-media" src={chapter.visual?.heroImage} alt={chapter.visual?.visualFocus} />
          <div className="mission-study-scrim" />
          <div className="mission-study-copy">
            <span className="sx-kicker">{chapter.visual?.missionLabel}</span>
            <h1 id="mission-study-title">{chapter.title}</h1>
            <p>{chapter.summary}</p>
            <p>{chapter.visual?.visualFocus}</p>
            <div className="mission-actions">
              <button type="button" className="sx-button primary" onClick={() => scrollToSection('mission-concepts')}>
                <span>Estudiar conceptos</span>
                <ArrowUpRight aria-hidden="true" />
              </button>
              <button type="button" className="sx-button" onClick={() => navigateHome('missions')}>
                <span>Volver a misiones</span>
              </button>
            </div>
          </div>
        </section>

        <section id="mission-concepts" className="sx-section gallery-section mission-study-section" aria-labelledby="mission-concepts-title">
          <div className="sx-section-head split">
            <div>
              <span className="sx-kicker">Study module</span>
              <h2 id="mission-concepts-title">{chapter.title}</h2>
            </div>
            <p>
              {missionConcepts.length} de {chapter.concepts.length} conceptos visibles. Esta ruta encapsula el
              tema para estudiar sin mezclar otras misiones.
            </p>
          </div>

          <div className="mission-route-controls">
            <button type="button" className="sx-button" onClick={() => navigateChapter(previousChapter)}>
              <ArrowLeft aria-hidden="true" />
              <span>Misión anterior</span>
            </button>
            <button type="button" className="sx-button" onClick={() => navigateChapter(nextChapter)}>
              <span>Siguiente misión</span>
              <ArrowRight aria-hidden="true" />
            </button>
          </div>

          <div className="sx-filters">
            <label className="sx-search">
              <Search aria-hidden="true" />
              <span className="sr-only">Buscar conceptos en esta misión</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Buscar en ${chapter.title}...`}
              />
            </label>
            <div className="sx-filter-row" aria-label="Filtro de escala">
              <Filter aria-hidden="true" />
              <button
                type="button"
                className={activeScale === 'all' ? 'is-active' : ''}
                onClick={() => setActiveScale('all')}
              >
                Escalas
              </button>
              {scaleOptions.map((scale) => (
                <button
                  type="button"
                  key={scale}
                  className={activeScale === scale ? 'is-active' : ''}
                  onClick={() => setActiveScale(scale)}
                >
                  {scaleLabels[scale]}
                </button>
              ))}
            </div>
            <div className="sx-filter-row" aria-label="Filtro de plausibilidad">
              <button
                type="button"
                className={activePlausibility === 'all' ? 'is-active' : ''}
                onClick={() => setActivePlausibility('all')}
              >
                Madurez
              </button>
              {plausibilityOptions.map((plausibility) => (
                <button
                  type="button"
                  key={plausibility}
                  className={activePlausibility === plausibility ? 'is-active' : ''}
                  onClick={() => setActivePlausibility(plausibility)}
                >
                  {plausibilityLabels[plausibility]}
                </button>
              ))}
            </div>
          </div>

          <CinematicGallery concepts={missionConcepts} onSelectConcept={navigateConcept} />
        </section>

        <section className="sx-section sources-section mission-study-sources" aria-labelledby="mission-sources-title">
          <div className="sx-section-head split">
            <div>
              <span className="sx-kicker">References</span>
              <h2 id="mission-sources-title">Fuentes de la misión</h2>
            </div>
            <p>Referencias principales para estudiar este bloque con contexto técnico.</p>
          </div>
          <SourceList sources={chapter.sources} />
        </section>
      </>
    );
  };

  const renderConceptPage = (concept: AstroConcept) => {
    const chapter = chapters.find((item) => item.id === concept.chapterId) ?? chapters[0];
    const chapterConcepts = allConcepts.filter((item) => item.chapterId === chapter.id);

    return (
      <ConceptStudyPage
        concept={concept}
        chapter={chapter}
        chapterConcepts={chapterConcepts}
        allConcepts={allConcepts}
        isCompared={comparisonIds.includes(concept.id)}
        onBackToMission={(targetChapter) => navigateChapter(targetChapter, 'mission-concepts')}
        onNavigateConcept={navigateConcept}
        onToggleCompare={toggleComparison}
      />
    );
  };

  return (
    <div className="sx-shell">
      <MissionSideNav
        chapters={chapters}
        isOpen={sideNavOpen}
        onToggle={() => setSideNavOpen((open) => !open)}
        onClose={() => setSideNavOpen(false)}
        onGoHome={() => navigateHome()}
        onGoGallery={handleSideConcepts}
        onGoMission={handleSideMission}
      />
      <header className="sx-topbar" aria-label="Navegación principal">
        <button className="sx-brand" type="button" onClick={() => navigateHome()} aria-label="Volver al inicio">
          ASTROINGENIERÍA
        </button>
        <nav className="sx-nav" aria-label="Secciones principales">
          <button type="button" onClick={() => navigateHome('missions')}>Misiones</button>
          <button type="button" onClick={handleSideConcepts}>Conceptos</button>
          <button type="button" onClick={() => navigateHome('compare')}>Comparador</button>
          <button type="button" onClick={() => navigateHome('sources')}>Fuentes</button>
          <a
            href="https://github.com/drayo00/AstroIngenieria"
            target="_blank"
            rel="noreferrer"
            aria-label="Repositorio en GitHub"
          >
            <GitBranch aria-hidden="true" />
          </a>
        </nav>
      </header>

      <main id="top">
        {activeConcept
          ? renderConceptPage(activeConcept)
          : activeChapter
            ? renderMissionPage(activeChapter)
            : renderHome()}
      </main>
    </div>
  );
}

export default App;
