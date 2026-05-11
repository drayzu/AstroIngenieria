import { useRef, type CSSProperties, type PointerEvent } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, Play } from 'lucide-react';
import type { AstroChapter } from '../types';
import { useHomeCursor } from './HomeInteractionLayer';

interface InteractiveAstroHeroProps {
  chapter: AstroChapter;
  conceptCount: number;
}

const heroWords = ['Astro', 'ingenieria'];
const heroSlices = Array.from({ length: 9 }, (_, index) => index);

export function InteractiveAstroHero({ chapter, conceptCount }: InteractiveAstroHeroProps) {
  const heroRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { clearCursor, setCursor } = useHomeCursor();
  const visual = chapter.visual;
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const titleY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [0, -90]);
  const mediaScale = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [1, 1] : [1.08, 1.22]);
  const mediaOpacity = useTransform(scrollYProgress, [0, 0.76, 1], [1, 0.92, 0.28]);

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (shouldReduceMotion || !heroRef.current) {
      return;
    }

    const bounds = heroRef.current.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;

    heroRef.current.style.setProperty('--hero-mouse-x', x.toFixed(3));
    heroRef.current.style.setProperty('--hero-mouse-y', y.toFixed(3));
  };

  return (
    <section
      ref={heroRef}
      className="astro-hero"
      aria-labelledby="hero-title"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        clearCursor();
        heroRef.current?.style.setProperty('--hero-mouse-x', '0');
        heroRef.current?.style.setProperty('--hero-mouse-y', '0');
      }}
    >
      <motion.img
        className="astro-hero-media"
        src={visual?.heroImage}
        alt={visual?.visualFocus}
        style={{ opacity: mediaOpacity, scale: mediaScale }}
      />
      <div className="astro-hero-scrim" />
      <div className="astro-hero-grid" aria-hidden="true">
        {heroSlices.map((slice) => (
          <motion.i
            key={slice}
            style={{ '--tile-index': slice } as CSSProperties}
            initial={shouldReduceMotion ? false : { opacity: 0, scaleY: 0.65 }}
            animate={shouldReduceMotion ? undefined : { opacity: [0, 0.56, 0.22], scaleY: 1 }}
            transition={{ delay: slice * 0.04, duration: 0.9, ease: 'easeOut' }}
          />
        ))}
      </div>

      <motion.div className="astro-hero-copy" style={{ y: titleY }}>
        <motion.span
          className="astro-hero-kicker"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          {visual?.missionLabel}
        </motion.span>
        <h1 id="hero-title" aria-label="Astroingenieria">
          {heroWords.map((word, wordIndex) => (
            <span className="astro-hero-word" key={word}>
              {word.split('').map((letter, letterIndex) => (
                <motion.span
                  aria-hidden="true"
                  className={letterIndex % 5 === 0 ? 'is-italic' : ''}
                  key={`${word}-${letterIndex}`}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 86, rotate: letterIndex % 2 ? -4 : 4 }}
                  animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, rotate: 0 }}
                  transition={{
                    delay: 0.18 + wordIndex * 0.14 + letterIndex * 0.026,
                    duration: 0.78,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  {letter}
                </motion.span>
              ))}
            </span>
          ))}
        </h1>
        <motion.p
          initial={shouldReduceMotion ? false : { opacity: 0, y: 26 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.7, ease: 'easeOut' }}
        >
          Un atlas interactivo para explorar habitats, infraestructura orbital, energia estelar,
          propulsion, mundos modificados y civilizaciones cosmicas.
        </motion.p>
        <motion.div
          className="astro-hero-actions"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.88, duration: 0.62, ease: 'easeOut' }}
        >
          <a
            href="#missions"
            className="sx-button primary"
            onPointerEnter={() => setCursor('Explorar')}
            onPointerLeave={clearCursor}
          >
            <span>Explorar misiones</span>
            <Play aria-hidden="true" />
          </a>
          <a
            href="#compare"
            className="sx-button"
            onPointerEnter={() => setCursor('Comparar')}
            onPointerLeave={clearCursor}
          >
            <span>{conceptCount} conceptos</span>
            <ArrowDown aria-hidden="true" />
          </a>
        </motion.div>
      </motion.div>

      <motion.aside
        className="astro-hero-meta"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.72, ease: 'easeOut' }}
      >
        <span>Basado en escalas reales</span>
        <span>Disponible en orbita baja</span>
      </motion.aside>
    </section>
  );
}
