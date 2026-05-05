import { useMemo, useState } from 'react';
import { ArrowUpRight, BookOpen, Filter, GitBranch, Search } from 'lucide-react';
import { allConcepts, chapters, plausibilityLabels, scaleLabels } from './data/astroData';
import { ChapterFeature } from './components/ChapterFeature';
import { ComparisonMatrix } from './components/ComparisonMatrix';
import { ConceptGallery } from './components/ConceptGallery';
import { ConceptModal } from './components/ConceptModal';
import { MinimalHero } from './components/MinimalHero';
import { SourceList } from './components/SourceList';
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

  const filteredConcepts = useMemo(() => {
    const cleanQuery = normalize(query.trim());

    return allConcepts.filter((concept) => {
      const matchesChapter =
        activeChapterId === 'all' || concept.chapterId === activeChapterId;
      const matchesScale = activeScale === 'all' || concept.scale === activeScale;
      const matchesPlausibility =
        activePlausibility === 'all' || concept.plausibility === activePlausibility;
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
        matchesChapter &&
        matchesScale &&
        matchesPlausibility &&
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

  return (
    <div className="site-shell">
      <header className="topbar" aria-label="Navegación principal">
        <a className="brand-mark" href="#inicio" aria-label="Volver al inicio">
          <span />
          Astroingeniería
        </a>
        <nav className="topbar-links" aria-label="Secciones principales">
          <a href="#capitulos">Capítulos</a>
          <a href="#galeria">Galería</a>
          <a href="#comparador">Comparador</a>
          <a href="#fuentes">Fuentes</a>
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

      <main id="inicio">
        <MinimalHero concept={allConcepts.find((concept) => concept.id === 'oneill-cylinder') ?? allConcepts[0]} />

        <section id="capitulos" className="chapter-band" aria-labelledby="capitulos-title">
          <div className="section-heading">
            <span className="overline">Recorrido</span>
            <h2 id="capitulos-title">Capítulos como salas de museo</h2>
            <p>
              Cada sala empieza con una imagen grande, conceptos clave y una lectura visual
              pausada. El atlas conserva el contenido completo, pero reduce ruido visual.
            </p>
          </div>
          <div className="chapter-stack">
            {chapters.map((chapter) => (
              <ChapterFeature
                chapter={chapter}
                key={chapter.id}
                onOpenConcept={setSelectedConcept}
              />
            ))}
          </div>
        </section>

        <section id="atlas" className="filters-band" aria-labelledby="filtros-title">
          <div className="section-heading">
            <span className="overline">Búsqueda</span>
            <h2 id="filtros-title">Filtrar sin romper la contemplación</h2>
          </div>
          <div className="filter-toolbar">
            <label className="search-box">
              <Search aria-hidden="true" />
              <span className="sr-only">Buscar conceptos</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar Dyson, terraformación, Fermi, hábitat..."
              />
            </label>
            <div className="filter-group" aria-label="Filtro de capítulo">
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
                  {chapter.number}. {chapter.title}
                </button>
              ))}
            </div>
            <div className="filter-group" aria-label="Filtro de escala">
              <button
                type="button"
                className={activeScale === 'all' ? 'is-active' : ''}
                onClick={() => setActiveScale('all')}
              >
                Todas las escalas
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
            <div className="filter-group" aria-label="Filtro de plausibilidad">
              <button
                type="button"
                className={activePlausibility === 'all' ? 'is-active' : ''}
                onClick={() => setActivePlausibility('all')}
              >
                Toda madurez
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
        </section>

        <section id="galeria" className="gallery-band" aria-labelledby="galeria-title">
          <div className="section-heading split-heading">
            <div>
              <span className="overline">Galería interactiva</span>
              <h2 id="galeria-title">106 ilustraciones, una por concepto</h2>
            </div>
            <p>
              {filteredConcepts.length} conceptos visibles. Abre cualquier imagen para activar
              hotspots, capas, zoom y lectura detallada.
            </p>
          </div>
          <ConceptGallery concepts={filteredConcepts} onOpenConcept={setSelectedConcept} />
        </section>

        <section id="comparador" className="comparison-band" aria-labelledby="comparador-title">
          <div className="section-heading">
            <span className="overline">Comparador</span>
            <h2 id="comparador-title">Contrastar escalas, materiales y madurez</h2>
            <p>
              Marca conceptos desde el visor para compararlos. El estado de comparación también se
              refleja visualmente en las imágenes.
            </p>
          </div>
          <ComparisonMatrix
            concepts={allConcepts}
            comparisonIds={comparisonIds}
            onToggleConcept={toggleComparison}
            onOpenConcept={setSelectedConcept}
          />
        </section>

        <section id="fuentes" className="sources-band" aria-labelledby="fuentes-title">
          <div className="section-heading">
            <span className="overline">Fuentes</span>
            <h2 id="fuentes-title">Base documental y referencias</h2>
            <p>
              El contenido parte de <strong>AstroIngenieria.txt</strong>. La capa visual agrega
              assets generativos WebP y prompts listos para reemplazo por IA curada.
            </p>
          </div>
          <SourceList sources={sourceRefs} />
          <a className="repo-link" href="https://github.com/drayo00/AstroIngenieria" target="_blank" rel="noreferrer">
            Ver repositorio
            <ArrowUpRight aria-hidden="true" />
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <BookOpen aria-hidden="true" />
        <span>Atlas visual minimalista de astroingeniería.</span>
      </footer>

      {selectedConcept && (
        <ConceptModal
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
