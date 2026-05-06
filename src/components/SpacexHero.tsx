import { motion } from 'framer-motion';
import { ArrowDown, Play } from 'lucide-react';
import type { AstroChapter } from '../types';

interface SpacexHeroProps {
  chapter: AstroChapter;
  conceptCount: number;
}

export function SpacexHero({ chapter, conceptCount }: SpacexHeroProps) {
  const visual = chapter.visual;

  return (
    <section className="sx-hero" aria-labelledby="hero-title">
      <img className="sx-hero-media" src={visual?.heroImage} alt={visual?.visualFocus} />
      <div className="sx-scrim" />
      <motion.div
        className="sx-hero-copy"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        <span className="sx-kicker">{visual?.missionLabel}</span>
        <h1 id="hero-title">
          <span>Astro</span>
          <span>ingeniería</span>
        </h1>
        <p>
          Un atlas interactivo para explorar hábitats, infraestructura orbital, energía estelar,
          propulsión, mundos modificados y civilizaciones cósmicas.
        </p>
        <div className="sx-actions">
          <a href="#missions" className="sx-button primary">
            <span>Explorar misiones</span>
            <Play aria-hidden="true" />
          </a>
          <a href="#gallery" className="sx-button">
            <span>{conceptCount} conceptos</span>
            <ArrowDown aria-hidden="true" />
          </a>
        </div>
      </motion.div>
    </section>
  );
}
