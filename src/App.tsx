import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Filter,
  GitBranch,
  Layers3,
  Search,
  Sparkles,
} from 'lucide-react';
import { chapters, allConcepts, defaultComparisonIds, featuredConceptIds } from './data/astroData';
import { ChapterExplorer } from './components/ChapterExplorer';
import { ComparisonMatrix } from './components/ComparisonMatrix';
import { ConceptModal } from './components/ConceptModal';
import { CosmicHero } from './components/CosmicHero';
import { ScaleNavigator } from './components/ScaleNavigator';
import { SourceList } from './components/SourceList';
import type { CSSProperties } from 'react';
import type { AstroConcept, AstroScale, Plausibility } from './types';
import { plausibilityLabels, scaleLabels } from './data/astroData';

type FilterValue<T extends string> = 'all' | T;

const scaleOptions = Object.keys(scaleLabels) as AstroScale[];
const plausibilityOptions = Object.keys(plausibilityLabels) as Plausibility[];

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

  const featuredConcepts = useMemo(
    () =>
      featuredConceptIds
        .map((id) => allConcepts.find((concept) => concept.id === id))
        .filter((concept): concept is AstroConcept => Boolean(concept)),
    [],
  );

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
          concept.advantages.join(' '),
          concept.difficulties.join(' '),
        ].join(' '),
      );
      const matchesQuery = cleanQuery.length === 0 || searchable.includes(cleanQuery);

      return matchesChapter && matchesScale && matchesPlausibility && matchesQuery;
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
      return [...current.slice(-5), conceptId];
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
          <Sparkles aria-hidden="true" />
          <span>Astroingeniería</span>
        </a>
        <nav className="topbar-links" aria-label="Secciones principales">
          <a href="#atlas">Atlas</a>
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

      <main>
        <CosmicHero
          concepts={featuredConcepts}
          selectedScale={activeScale}
          onScaleSelect={setActiveScale}
          onOpenConcept={setSelectedConcept}
        />

        <section className="atlas-overview" aria-label="Ruta general">
          <div className="section-heading">
            <span className="eyebrow">Ruta general</span>
            <h2>De vivir en órbita a pensar civilizaciones galácticas</h2>
            <p>
              El atlas convierte el documento base en una experiencia exploratoria:
              capítulos, fichas, escalas, plausibilidad, relaciones y visualizaciones.
            </p>
          </div>
          <div className="route-strip" role="list" aria-label="Capítulos del atlas">
            {chapters.slice(0, 8).map((chapter) => (
              <button
                className="route-node"
                type="button"
                key={chapter.id}
                onClick={() => {
                  setActiveChapterId(chapter.id);
                  document.getElementById('atlas')?.scrollIntoView({ behavior: 'smooth' });
                }}
                style={{ '--node-color': chapter.color } as CSSProperties}
              >
                <span>{chapter.number}</span>
                <strong>{chapter.title}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="filters-band" aria-labelledby="filtros-title">
          <div className="section-heading compact">
            <span className="eyebrow">Exploración</span>
            <h2 id="filtros-title">Filtra el atlas por escala, madurez o concepto</h2>
          </div>

          <div className="filter-toolbar">
            <label className="search-box">
              <Search aria-hidden="true" />
              <span className="sr-only">Buscar conceptos</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar Dyson, terraformación, propulsión, Fermi..."
              />
            </label>

            <div className="filter-group" aria-label="Filtro de escala">
              <Filter aria-hidden="true" />
              <button
                type="button"
                className={activeScale === 'all' ? 'is-active' : ''}
                onClick={() => setActiveScale('all')}
              >
                Todas
              </button>
              {scaleOptions.map((scale) => (
                <button
                  key={scale}
                  type="button"
                  className={activeScale === scale ? 'is-active' : ''}
                  onClick={() => setActiveScale(scale)}
                >
                  {scaleLabels[scale]}
                </button>
              ))}
            </div>

            <div className="filter-group" aria-label="Filtro de plausibilidad">
              <Layers3 aria-hidden="true" />
              <button
                type="button"
                className={activePlausibility === 'all' ? 'is-active' : ''}
                onClick={() => setActivePlausibility('all')}
              >
                Todo
              </button>
              {plausibilityOptions.map((plausibility) => (
                <button
                  key={plausibility}
                  type="button"
                  className={activePlausibility === plausibility ? 'is-active' : ''}
                  onClick={() => setActivePlausibility(plausibility)}
                >
                  {plausibilityLabels[plausibility]}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="atlas" className="atlas-band" aria-labelledby="atlas-title">
          <div className="section-heading">
            <span className="eyebrow">Atlas interactivo</span>
            <h2 id="atlas-title">Capítulos, conceptos y relaciones</h2>
            <p>
              {filteredConcepts.length} conceptos visibles de {allConcepts.length}. Cada ficha
              resume qué es, cómo funciona, por qué importa y qué problemas abre.
            </p>
          </div>

          <ScaleNavigator selectedScale={activeScale} onSelectScale={setActiveScale} />

          <ChapterExplorer
            chapters={chapters}
            activeChapterId={activeChapterId}
            filteredConcepts={filteredConcepts}
            comparisonIds={comparisonIds}
            onChapterChange={setActiveChapterId}
            onOpenConcept={setSelectedConcept}
            onToggleCompare={toggleComparison}
          />
        </section>

        <section id="comparador" className="comparison-band" aria-labelledby="comparador-title">
          <div className="section-heading">
            <span className="eyebrow">Modo comparar</span>
            <h2 id="comparador-title">La misma escala no significa la misma dificultad</h2>
            <p>
              Contrasta conceptos por energía, materiales, madurez y capacidad de maravillar.
              La comparación es cualitativa, pensada para estudiar sin perder contexto.
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
            <span className="eyebrow">Referencias</span>
            <h2 id="fuentes-title">Base documental y puntos de partida</h2>
            <p>
              La estructura sale de <strong>AstroIngenieria.txt</strong>. Estas fuentes agregan
              anclajes técnicos para hábitats, energía, propulsión, ISRU, exoplanetas y SETI.
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
        <span>
          Atlas narrativo en español para contemplar, aprender y comparar ideas de
          astroingeniería.
        </span>
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
