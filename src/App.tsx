import { useMemo, useState } from 'react';
import { ArrowUpRight, Filter, GitBranch, Search } from 'lucide-react';
import { allConcepts, chapters, plausibilityLabels, scaleLabels } from './data/astroData';
import { CinematicGallery } from './components/CinematicGallery';
import { ComparisonMatrix } from './components/ComparisonMatrix';
import { DarkConceptModal } from './components/DarkConceptModal';
import { MissionChapter } from './components/MissionChapter';
import { MissionSideNav } from './components/MissionSideNav';
import { SourceList } from './components/SourceList';
import { SpacexHero } from './components/SpacexHero';
import type { AstroConcept, AstroScale, Plausibility } from './types';

type FilterValue<T extends string> = 'all' | T;

const scaleOptions = Object.keys(scaleLabels) as AstroScale[];
const plausibilityOptions = Object.keys(plausibilityLabels) as Plausibility[];
const defaultComparisonIds = ['oneill-cylinder', 'dyson-swarm', 'mars-terraforming', 'caplan'];

const normalize = (value: string) =>
  value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

function App() {
  const [activeChapterId, setActiveChapterId] = useState<FilterValue<string>>('all');
  const [activeScale, setActiveScale] = useState<FilterValue<AstroScale>>('all');
  const [activePlausibility, setActivePlausibility] =
    useState<FilterValue<Plausibility>>('all');
  const [query, setQuery] = useState('');
  const [selectedConcept, setSelectedConcept] = useState<AstroConcept | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>(defaultComparisonIds);
  const [sideNavOpen, setSideNavOpen] = useState(false);

  const filteredConcepts = useMemo(() => {
    const cleanQuery = normalize(query.trim());

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
        (activeChapterId === 'all' || concept.chapterId === activeChapterId) &&
        (activeScale === 'all' || concept.scale === activeScale) &&
        (activePlausibility === 'all' || concept.plausibility === activePlausibility) &&
        (cleanQuery.length === 0 || searchable.includes(cleanQuery))
      );
    });
  }, [activeChapterId, activeScale, activePlausibility, query]);

  const sourceRefs = useMemo(() => {
    const byUrl = new Map<string, (typeof chapters)[number]['sources'][number]>();
    chapters.forEach((chapter) => chapter.sources.forEach((source) => byUrl.set(source.url, source)));
    allConcepts.forEach((concept) =>
      concept.sources?.forEach((source) => byUrl.set(source.url, source)),
    );
    return [...byUrl.values()];
  }, []);

  const activeChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === activeChapterId),
    [activeChapterId],
  );

  const toggleComparison = (conceptId: string) => {
    setComparisonIds((current) => {
      if (current.includes(conceptId)) {
        return current.filter((id) => id !== conceptId);
      }
      return [...current.slice(-4), conceptId];
    });
  };

  const openConceptById = (conceptId: string) => {
    const concept = allConcepts.find((item) => item.id === conceptId);
    if (concept) {
      setSelectedConcept(concept);
    }
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  const handleExploreChapter = (chapterId: string) => {
    setActiveChapterId(chapterId);
    setActiveScale('all');
    setActivePlausibility('all');
    setQuery('');
    window.requestAnimationFrame(() => scrollToSection('gallery'));
  };

  const handleGoMission = (chapterId: string) => {
    scrollToSection(`mission-${chapterId}`);
  };

  const handleGoGallery = () => {
    setActiveChapterId('all');
    setActiveScale('all');
    setActivePlausibility('all');
    setQuery('');
    setSideNavOpen(false);
    window.requestAnimationFrame(() => scrollToSection('gallery'));
  };

  return (
    <div className="sx-shell">
      <MissionSideNav
        chapters={chapters}
        isOpen={sideNavOpen}
        onToggle={() => setSideNavOpen((open) => !open)}
        onClose={() => setSideNavOpen(false)}
        onGoHome={() => {
          setSideNavOpen(false);
          scrollToSection('top');
        }}
        onGoGallery={handleGoGallery}
        onGoMission={handleGoMission}
      />
      <header className="sx-topbar" aria-label="Navegación principal">
        <a className="sx-brand" href="#top" aria-label="Volver al inicio">
          ASTROINGENIERÍA
        </a>
        <nav className="sx-nav" aria-label="Secciones principales">
          <a href="#missions">Misiones</a>
          <a href="#gallery">Conceptos</a>
          <a href="#compare">Comparador</a>
          <a href="#sources">Fuentes</a>
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
                onExploreChapter={handleExploreChapter}
              />
            ))}
          </div>
        </section>

        <section id="gallery" className="sx-section gallery-section" aria-labelledby="gallery-title">
          <div className="sx-section-head split">
            <div>
              <span className="sx-kicker">Payload</span>
              <h2 id="gallery-title">Conceptos del atlas</h2>
            </div>
            <p>
              {activeChapter
                ? `${filteredConcepts.length} conceptos de ${activeChapter.title}. Cada ficha usa la imagen IA de su misión y conserva sus hotspots técnicos.`
                : `${filteredConcepts.length} de ${allConcepts.length} conceptos visibles. Cada ficha usa la imagen IA de su misión y conserva sus hotspots técnicos.`}
            </p>
          </div>

          <div className="sx-filters">
            <label className="sx-search">
              <Search aria-hidden="true" />
              <span className="sr-only">Buscar conceptos</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar Dyson, Marte, Fermi, hábitat..."
              />
            </label>
            <div className="sx-filter-row" aria-label="Filtro de capítulo">
              <Filter aria-hidden="true" />
              <button
                type="button"
                className={activeChapterId === 'all' ? 'is-active' : ''}
                onClick={() => setActiveChapterId('all')}
              >
                Todo
              </button>
              {chapters.map((chapter) => (
                <button
                  type="button"
                  key={chapter.id}
                  className={activeChapterId === chapter.id ? 'is-active' : ''}
                  onClick={() => setActiveChapterId(chapter.id)}
                >
                  {chapter.title}
                </button>
              ))}
            </div>
            <div className="sx-filter-row" aria-label="Filtro de escala">
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

          <CinematicGallery concepts={filteredConcepts} onOpenConcept={setSelectedConcept} />
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
            onOpenConcept={setSelectedConcept}
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
      </main>

      {selectedConcept && (
        <DarkConceptModal
          concept={selectedConcept}
          allConcepts={allConcepts}
          isCompared={comparisonIds.includes(selectedConcept.id)}
          onClose={() => setSelectedConcept(null)}
          onOpenConcept={openConceptById}
          onToggleCompare={toggleComparison}
        />
      )}
    </div>
  );
}

export default App;
