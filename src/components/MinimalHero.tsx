import { ArrowDown, Images, Search } from 'lucide-react';
import type { AstroConcept } from '../types';
import { IllustrationViewer } from './IllustrationViewer';

interface MinimalHeroProps {
  concept: AstroConcept;
}

export function MinimalHero({ concept }: MinimalHeroProps) {
  return (
    <section className="minimal-hero" aria-labelledby="hero-title">
      <div className="hero-figure">
        <img
          src={`${import.meta.env.BASE_URL}illustrations/hero.webp`}
          alt="Ilustración minimalista de astroingeniería"
        />
      </div>
      <div className="minimal-hero-copy">
        <span className="overline">Museo interactivo de astroingeniería</span>
        <h1 id="hero-title">Astroingeniería</h1>
        <p>
          Un atlas visual para contemplar hábitats espaciales, infraestructura orbital,
          energía estelar, propulsión, terraformación, motores de estrellas y civilizaciones
          cósmicas.
        </p>
        <div className="hero-actions">
          <a href="#galeria">
            <Images aria-hidden="true" />
            Ver galería
          </a>
          <a href="#atlas">
            <Search aria-hidden="true" />
            Explorar conceptos
          </a>
          <a href="#atlas" className="quiet-action">
            Bajar
            <ArrowDown aria-hidden="true" />
          </a>
        </div>
      </div>
      <div className="hero-demo" aria-label="Ejemplo de interacción visual">
        <IllustrationViewer concept={concept} compact />
      </div>
    </section>
  );
}
