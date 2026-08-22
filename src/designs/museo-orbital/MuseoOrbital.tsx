import '@fontsource-variable/fraunces';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { chapters, conceptById, plausibilityLabels, scaleLabels } from '../../data/astroData';
import type { AstroChapter, AstroConcept } from '../../types';
import { Grain } from '../shared/Grain';
import { useScrollLock } from '../shared/useScrollLock';
import { MuseumCursor } from './MuseumCursor';
import { StudioRoom } from './StudioRoom';
import './museoOrbital.css';

const totalWorks = chapters.reduce((sum, chapter) => sum + chapter.concepts.length, 0);
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const resolveChapter = (concept: AstroConcept): AstroChapter =>
  chapters.find((chapter) => chapter.id === concept.chapterId) ?? chapters[0];

const conceptFromHash = (): AstroConcept | null => {
  const match = window.location.hash.match(/^#obra-(.+)$/);
  return match ? conceptById.get(match[1]) ?? null : null;
};

/* ---------------- Chip de salida al atlas ---------------- */

const AtlasChip = () => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (window.location.pathname === base || window.location.pathname === `${base}/`) return null;
  return (
    <a
      className="mo-atlas-chip"
      href={import.meta.env.BASE_URL}
      data-cursor-label="Salir"
    >
      ← Atlas clásico
    </a>
  );
};

/* ---------------- Cursor + Hero ---------------- */

const Hero = () => {
  const reduced = useReducedMotion();
  const letters = useMemo(() => 'ASTROINGENIERÍA'.split(''), []);

  const trackSpotlight = (event: ReactMouseEvent<HTMLElement>) => {
    if (reduced) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--sx', `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty('--sy', `${event.clientY - rect.top}px`);
  };

  return (
    <section className="mo-hero" onMouseMove={trackSpotlight}>
      <motion.div
        className="mo-hero-bg"
        style={{ backgroundImage: `url(${chapters[1].visual?.heroImage})` }}
        initial={{ scale: 1.22, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: reduced ? 0 : 3, ease: EASE_OUT }}
      />
      <div className="mo-hero-scrim" />
      <div className="mo-hero-spot" aria-hidden="true" />

      <div className="mo-hero-copy">
        <motion.p
          className="mo-kicker"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 0.5, duration: 0.9, ease: EASE_OUT }}
        >
          Exposición permanente — Atlas de astroingeniería
        </motion.p>

        <h1 className="mo-hero-title" aria-label="Astroingeniería">
          {letters.map((letter, index) => (
            <span className="mo-hero-letterbox" key={`${letter}-${index}`} aria-hidden="true">
              <span className="mo-hero-hover">
                <motion.span
                  className="mo-hero-letter"
                  initial={{ y: '118%' }}
                  animate={{ y: '0%' }}
                  transition={{
                    delay: reduced ? 0 : 0.55 + index * 0.038,
                    duration: 1.1,
                    ease: EASE_OUT,
                  }}
                >
                  {letter}
                </motion.span>
              </span>
            </span>
          ))}
        </h1>

        <motion.div
          className="mo-hero-rule"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: reduced ? 0 : 1.4, duration: 1.6, ease: EASE_OUT }}
        />

        <motion.p
          className="mo-hero-sub"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 1.6, duration: 1, ease: EASE_OUT }}
        >
          Nueve salas. {totalWorks} obras. Un recorrido desde la primera estación orbital hasta
          civilizaciones capaces de mover estrellas.
        </motion.p>

        <motion.button
          type="button"
          className="mo-hero-cta"
          data-cursor-label="Descender"
          onClick={() =>
            document.getElementById('sala-intro')?.scrollIntoView({ behavior: 'smooth' })
          }
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduced ? 0 : 2.1, duration: 1 }}
        >
          Descender a la Sala 00
          <span aria-hidden="true">↓</span>
        </motion.button>
      </div>
    </section>
  );
};

const Marquee = () => {
  const phrase = `COLECCIÓN PERMANENTE · ${chapters.length} SALAS · ${totalWorks} OBRAS · ENTRADA LIBRE · `;
  return (
    <div className="mo-marquee" aria-hidden="true">
      <div className="mo-marquee-track">
        <span>{phrase.repeat(3)}</span>
        <span>{phrase.repeat(3)}</span>
      </div>
    </div>
  );
};

/* ---------------- Índice de salas ---------------- */

const HallIndex = ({ activeId }: { activeId: string | null }) => (
  <nav className="mo-halls" aria-label="Salas de la exposición">
    {chapters.map((chapter) => (
      <button
        key={chapter.id}
        type="button"
        className={`mo-hall-chip${activeId === chapter.id ? ' is-active' : ''}`}
        style={{ '--accent': chapter.color } as CSSProperties}
        onClick={() =>
          document
            .getElementById(`sala-${chapter.id}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      >
        <b>{chapter.number}</b>
        {chapter.title}
      </button>
    ))}
  </nav>
);

/* ---------------- Número monumental que se rellena ---------------- */

const SalaNo = ({
  value,
  progress,
  reduced,
}: {
  value: string;
  progress: MotionValue<number>;
  reduced: boolean;
}) => {
  const clip = useTransform(
    progress,
    [0.02, 0.6],
    ['inset(100% 0% 0% 0%)', 'inset(-15% -15% -15% -15%)'],
  );
  return (
    <span className="mo-sala-no" aria-hidden="true">
      <span className="mo-sala-no-outline">{value}</span>
      {reduced ? (
        <span className="mo-sala-no-fill">{value}</span>
      ) : (
        <motion.span className="mo-sala-no-fill" style={{ clipPath: clip }}>
          {value}
        </motion.span>
      )}
    </span>
  );
};

/* ---------------- Obra del muro ---------------- */

const Obra = ({
  concept,
  plate,
  featured,
  enableFlight,
  onSelect,
}: {
  concept: AstroConcept;
  plate: number;
  featured: boolean;
  enableFlight: boolean;
  onSelect: (concept: AstroConcept) => void;
}) => {
  const tilt = (event: ReactMouseEvent<HTMLElement>) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    target.style.setProperty('--rx', `${(-py * 4.5).toFixed(2)}deg`);
    target.style.setProperty('--ry', `${(px * 5.5).toFixed(2)}deg`);
  };
  const untilt = (event: ReactMouseEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--rx', '0deg');
    event.currentTarget.style.setProperty('--ry', '0deg');
  };

  return (
    <motion.article
      className={`mo-obra${featured ? ' is-featured' : ''}`}
      initial={{ opacity: 0, y: 60, rotateZ: plate % 2 === 0 ? -1.1 : 1.1 }}
      whileInView={{ opacity: 1, y: 0, rotateZ: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 1, ease: EASE_OUT }}
    >
      <button
        type="button"
        className="mo-obra-hit"
        data-cursor-label="Abrir sala de estudio"
        onMouseMove={tilt}
        onMouseLeave={untilt}
        onClick={() => onSelect(concept)}
      >
        <figure className="mo-frame">
          <div className="mo-frame-mask">
            <motion.img
              layoutId={enableFlight ? `obra-${concept.id}` : undefined}
              src={concept.illustration.src}
              alt={concept.illustration.alt}
              loading="lazy"
            />
          </div>
          <span className="mo-frame-shine" aria-hidden="true" />
          <span className="mo-frame-glow" aria-hidden="true" />
        </figure>
        <div className="mo-obra-meta">
          <span className="mo-plate">N.º {String(plate).padStart(2, '0')}</span>
          <h3>{concept.title}</h3>
          <p>
            {concept.category} · {scaleLabels[concept.scale]} ·{' '}
            {plausibilityLabels[concept.plausibility]}
          </p>
          <span className="mo-obra-cta">Entrar a la sala de estudio →</span>
        </div>
      </button>
    </motion.article>
  );
};

/* ---------------- Sala ---------------- */

const Sala = ({
  chapter,
  offset,
  enableFlight,
  onSelect,
}: {
  chapter: AstroChapter;
  offset: number;
  enableFlight: boolean;
  onSelect: (concept: AstroConcept) => void;
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const figureRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: fillProgress } = useScroll({
    target: sectionRef,
    offset: ['start 90%', 'start 32%'],
  });
  const { scrollYProgress: figureProgress } = useScroll({
    target: figureRef,
    offset: ['start end', 'end start'],
  });
  const imageY = useTransform(figureProgress, [0, 1], ['-9%', '9%']);
  const reduced = useReducedMotion();

  return (
    <section
      id={`sala-${chapter.id}`}
      className="mo-sala"
      ref={sectionRef}
      style={{ '--accent': chapter.color } as CSSProperties}
    >
      <header className="mo-sala-head">
        <SalaNo
          value={chapter.number}
          progress={fillProgress}
          reduced={Boolean(reduced)}
        />
        <div className="mo-sala-copy">
          <p className="mo-kicker">
            Sala {chapter.number} — {chapter.concepts.length} piezas
          </p>
          <h2>{chapter.title}</h2>
          <p className="mo-lede">{chapter.summary}</p>
          {chapter.sections.map((section) => (
            <details key={section.title} className="mo-sala-note">
              <summary>{section.title}</summary>
              <p>{section.body}</p>
            </details>
          ))}
        </div>
        <figure className="mo-sala-figure">
          <div ref={figureRef} className="mo-sala-figure-inner">
            <motion.img
              src={chapter.visual?.heroImage}
              alt={chapter.visual?.visualFocus ?? chapter.title}
              loading="lazy"
              style={reduced ? undefined : { y: imageY }}
            />
          </div>
          <figcaption>{chapter.visual?.visualFocus}</figcaption>
        </figure>
      </header>

      <div className="mo-wall">
        {chapter.concepts.map((concept, conceptIndex) => (
          <Obra
            key={concept.id}
            concept={concept}
            plate={offset + conceptIndex + 1}
            featured={conceptIndex % 5 === 0}
            enableFlight={enableFlight}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
};

/* ---------------- Principal ---------------- */

export default function MuseoOrbital() {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<AstroConcept | null>(() => conceptFromHash());
  const [activeHallId, setActiveHallId] = useState<string | null>(null);
  useScrollLock(Boolean(active));

  const { scrollYProgress } = useScroll({ container: rootRef });
  const railScale = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.4 });

  useEffect(() => {
    const hash = active ? `#obra-${active.id}` : '';
    const desired = hash || `${window.location.pathname}${window.location.search}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', desired);
    }
  }, [active]);

  useEffect(() => {
    const onHash = () => setActive(conceptFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveHallId(entry.target.id.replace('sala-', ''));
        });
      },
      { rootMargin: '-42% 0px -42% 0px' },
    );
    chapters.forEach((chapter) => {
      const element = document.getElementById(`sala-${chapter.id}`);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  const openConcept = (concept: AstroConcept) => setActive(concept);

  let plateOffset = 0;
  const activeHall = chapters.find((chapter) => chapter.id === activeHallId);

  return (
    <div className="mo-root" ref={rootRef}>
      <Grain opacity={0.06} blend="screen" zIndex={40} />
      <MuseumCursor />
      <AtlasChip />

      <Hero />
      <Marquee />
      <HallIndex activeId={activeHallId} />

      {chapters.map((chapter) => {
        const offset = plateOffset;
        plateOffset += chapter.concepts.length;
        return (
          <Sala
            key={chapter.id}
            chapter={chapter}
            offset={offset}
            enableFlight={!reduced}
            onSelect={openConcept}
          />
        );
      })}

      <footer className="mo-footer">
        <blockquote>{chapters[0].sections[1]?.body}</blockquote>
        <p className="mo-footer-line">
          ASTROINGENIERÍA — EXPOSICIÓN PERMANENTE · PLANTILLA MUSEO ORBITAL · MMXXVI
        </p>
      </footer>

      <aside className="mo-rail" aria-label="Progreso del recorrido">
        <div className="mo-rail-track">
          <motion.div className="mo-rail-fill" style={{ scaleY: railScale }} />
        </div>
        {chapters.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            title={chapter.title}
            className={activeHallId === chapter.id ? 'is-active' : ''}
            style={{ '--accent': chapter.color } as CSSProperties}
            onClick={() =>
              document
                .getElementById(`sala-${chapter.id}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          />
        ))}
        <span className="mo-rail-label">
          {activeHall ? `Sala ${activeHall.number} — ${activeHall.title}` : ''}
        </span>
      </aside>

      <AnimatePresence>
        {active && (
          <StudioRoom
            key="studio"
            concept={active}
            chapter={resolveChapter(active)}
            siblings={resolveChapter(active).concepts}
            enableFlight={!reduced}
            onClose={() => setActive(null)}
            onSelect={openConcept}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
