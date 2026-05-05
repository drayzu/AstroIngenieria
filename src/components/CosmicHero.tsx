import { lazy, Suspense } from 'react';
import { ArrowDown, Atom, Compass, Telescope } from 'lucide-react';
import { scaleLabels } from '../data/astroData';
import type { AstroConcept, AstroScale } from '../types';

const ThreeScene = lazy(() =>
  import('./ThreeScene').then((module) => ({ default: module.ThreeScene })),
);

interface CosmicHeroProps {
  concepts: AstroConcept[];
  selectedScale: 'all' | AstroScale;
  onScaleSelect: (scale: 'all' | AstroScale) => void;
  onOpenConcept: (concept: AstroConcept) => void;
}

const scaleOrder = Object.keys(scaleLabels) as AstroScale[];

export function CosmicHero({
  concepts,
  selectedScale,
  onScaleSelect,
  onOpenConcept,
}: CosmicHeroProps) {
  return (
    <section id="inicio" className="hero-section" aria-labelledby="hero-title">
      <Suspense
        fallback={
          <div className="three-scene scene-fallback" aria-hidden="true">
            <div />
          </div>
        }
      >
        <ThreeScene />
      </Suspense>
      <div className="hero-content">
        <div className="hero-copy">
          <span className="eyebrow">Atlas narrativo interactivo</span>
          <h1 id="hero-title">Astroingeniería</h1>
          <p>
            Una experiencia para apreciar, contemplar y entender cómo una civilización podría
            construir hábitats, infraestructura orbital, energía estelar, mundos terraformados,
            motores de estrellas y señales detectables en la galaxia.
          </p>
          <div className="hero-actions" aria-label="Acciones principales">
            <a className="primary-action" href="#atlas">
              Explorar atlas
              <ArrowDown aria-hidden="true" />
            </a>
            <a className="secondary-action" href="#comparador">
              Comparar conceptos
              <Compass aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="hero-instruments" aria-label="Controles de exploración inicial">
          <div className="instrument-header">
            <Telescope aria-hidden="true" />
            <span>Escala de observación</span>
          </div>
          <div className="scale-dial">
            <button
              type="button"
              className={selectedScale === 'all' ? 'is-active' : ''}
              onClick={() => onScaleSelect('all')}
            >
              Todas
            </button>
            {scaleOrder.map((scale) => (
              <button
                type="button"
                key={scale}
                className={selectedScale === scale ? 'is-active' : ''}
                onClick={() => onScaleSelect(scale)}
              >
                {scaleLabels[scale]}
              </button>
            ))}
          </div>

          <div className="featured-rail" aria-label="Conceptos destacados">
            {concepts.map((concept) => (
              <button type="button" key={concept.id} onClick={() => onOpenConcept(concept)}>
                <Atom aria-hidden="true" />
                <span>{concept.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
