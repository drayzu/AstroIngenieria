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
import type { AstroChapter, AstroConcept, SourceRef } from '../../types';
import { Grain } from '../shared/Grain';
import { useScrollLock } from '../shared/useScrollLock';
import { MuseumCursor } from './MuseumCursor';
import { StudioRoom } from './StudioRoom';
import { StarfieldCanvas } from './StarfieldCanvas';
import { DistortOverlay } from './DistortOverlay';
import './museoOrbital.css';

const totalWorks = chapters.reduce((sum, chapter) => sum + chapter.concepts.length, 0);
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const VITRINE_CAP = 5;
const VITRINE_KEY = 'mo-vitrine';

const resolveChapter = (concept: AstroConcept): AstroChapter =>
  chapters.find((chapter) => chapter.id === concept.chapterId) ?? chapters[0];

const conceptFromHash = (): AstroConcept | null => {
  const match = window.location.hash.match(/^#obra-(.+)$/);
  return match ? conceptById.get(match[1]) ?? null : null;
};

const loadVitrine = (): string[] => {
  try {
    const raw = window.localStorage.getItem(VITRINE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => conceptById.has(id)).slice(0, VITRINE_CAP) : [];
  } catch {
    return [];
  }
};

const scrollToId = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/* ---------------- Hilo de descenso ---------------- */

const THREAD_PATH = 'M 62 0 C 18 70, 104 130, 54 205 C 12 272, 98 330, 46 410 L 44 436';

const DescentThread = () => {
  const reduced = useReducedMotion();
  return (
    <button
      type="button"
      className="mo-thread"
      data-cursor-label="Descender"
      onClick={() => scrollToId('sala-intro')}
    >
      <svg viewBox="0 0 110 440" fill="none" aria-hidden="true">
        <path className="mo-thread-base" d={THREAD_PATH} />
        {!reduced && (
          <>
            <path className="mo-thread-glint" d={THREAD_PATH} />
            <circle className="mo-thread-star" r="3.2">
              <animateMotion dur="7s" repeatCount="indefinite" path={THREAD_PATH} />
            </circle>
          </>
        )}
      </svg>
      <span className="mo-thread-tip">desciende</span>
    </button>
  );
};

/* ---------------- Contador animado ---------------- */

const Counter = ({ to }: { to: number }) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 650;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <b className="mo-counter">{value}</b>;
};

/* ---------------- Hero con título magnético ---------------- */

const Hero = () => {
  const reduced = useReducedMotion();
  const letters = useMemo(() => 'ASTROINGENIERÍA'.split(''), []);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (reduced || !window.matchMedia('(pointer: fine)').matches) return;

    const mouse = { x: -9999, y: -9999 };
    const motion2d = { x: -9999, y: -9999, t: 0, speed: 0 };
    const states = letters.map(() => ({ x: 0, y: 0, w: 520 }));
    const glint = { index: -1, t0: 0 };
    let raf = 0;
    let clock = 0;

    const onMove = (event: MouseEvent) => {
      const now = performance.now();
      if (motion2d.t > 0) {
        const dt = Math.max(8, now - motion2d.t);
        const inst = (Math.hypot(event.clientX - motion2d.x, event.clientY - motion2d.y) / dt) * 1000;
        motion2d.speed = motion2d.speed * 0.7 + inst * 0.3;
      }
      motion2d.x = event.clientX;
      motion2d.y = event.clientY;
      motion2d.t = now;
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };

    const loop = () => {
      clock += 0.016;
      if (clock - glint.t0 > 4.4) {
        glint.index = Math.floor(Math.random() * letters.length);
        glint.t0 = clock;
      }
      const glintP = (clock - glint.t0) / 0.85;
      const calm = Math.max(0.25, 1 - motion2d.speed / 1100);

      letterRefs.current.forEach((el, index) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = mouse.x - cx;
        const dy = mouse.y - cy;
        const dist = Math.hypot(dx, dy);
        const radius = 170;
        const force = (dist < radius ? 1 - dist / radius : 0) * calm;
        const eased = force * force * (3 - 2 * force);

        const targetX = (dx / (dist || 1)) * eased * 9;
        const targetY = (dy / (dist || 1)) * eased * 6.5;
        let targetW = 520 + eased * 170;
        let lift = 0;
        if (index === glint.index && glintP < 1) {
          const spark = Math.sin(Math.PI * glintP);
          targetW += spark * 190;
          lift = -spark * 7;
        }

        const state = states[index];
        state.x += (targetX - state.x) * 0.09;
        state.y += (targetY + lift - state.y) * 0.09;
        state.w += (targetW - state.w) * 0.12;

        el.style.transform = `translate(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px)`;
        el.style.fontVariationSettings = `'opsz' 144, 'wght' ${Math.round(state.w)}`;
      });
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduced, letters]);

  const trackSpotlight = (event: ReactMouseEvent<HTMLElement>) => {
    if (reduced) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--sx', `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty('--sy', `${event.clientY - rect.top}px`);
  };

  return (
    <section className="mo-hero mo-layer" onMouseMove={trackSpotlight}>
      <motion.div
        className="mo-hero-bg"
        style={{ backgroundImage: `url(${chapters[1].visual?.heroImage})` }}
        initial={{ scale: 1.22, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: reduced ? 0 : 3, ease: EASE_OUT }}
      />
      <div className="mo-hero-scrim" />
      <div className="mo-hero-spot" aria-hidden="true" />
      <DescentThread />

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
                  ref={(el) => {
                    letterRefs.current[index] = el;
                  }}
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
          Nueve salas convertidas en <Counter to={chapters.length} /> puertas. <Counter to={totalWorks} /> obras
          esperando. Un recorrido desde la primera estación orbital hasta civilizaciones capaces
          de mover estrellas.
        </motion.p>

        <motion.button
          type="button"
          className="mo-hero-cta mo-orbital"
          data-cursor-label="Descender"
          onClick={() => scrollToId('sala-intro')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduced ? 0 : 2.1, duration: 1 }}
        >
          <i className="mo-orbit a" aria-hidden="true" />
          <i className="mo-orbit b" aria-hidden="true" />
          Descender a la Sala 00
          <span aria-hidden="true">↓</span>
        </motion.button>

        <motion.span
          className="mo-sky-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduced ? 0 : 2.8, duration: 1 }}
        >
          ESPACIO · estrella fugaz&ensp;—&ensp;CLIC · chispas y constelación
        </motion.span>
      </div>
    </section>
  );
};

const Marquee = () => {
  const phrase = `COLECCIÓN PERMANENTE · ${chapters.length} SALAS · ${totalWorks} OBRAS · ENTRADA LIBRE · `;
  return (
    <div className="mo-marquee mo-layer" aria-hidden="true">
      <div className="mo-marquee-track">
        <span>{phrase.repeat(3)}</span>
        <span>{phrase.repeat(3)}</span>
      </div>
    </div>
  );
};

/* ---------------- Índice de salas ---------------- */

const HallIndex = ({ activeId }: { activeId: string | null }) => (
  <nav className="mo-halls mo-layer" aria-label="Salas de la exposición">
    {chapters.map((chapter) => (
      <button
        key={chapter.id}
        type="button"
        className={`mo-hall-chip${activeId === chapter.id ? ' is-active' : ''}`}
        style={{ '--accent': chapter.color } as CSSProperties}
        onClick={() => scrollToId(`sala-${chapter.id}`)}
      >
        <b>{chapter.number}</b>
        {chapter.title}
      </button>
    ))}
    <button type="button" className="mo-hall-chip is-extra" onClick={() => scrollToId('vitrina')}>
      <b>✦</b>
      Vitrina
    </button>
    <button type="button" className="mo-hall-chip is-extra" onClick={() => scrollToId('archivo')}>
      <b>§</b>
      Archivo
    </button>
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

/* ---------------- Reveals por palabras ---------------- */

const RevealWords = ({ text }: { text: string }) => {
  const reduced = useReducedMotion();
  const words = useMemo(() => text.split(' '), [text]);
  return (
    <span className="mo-words">
      {words.map((word, index) => (
        <span className="mo-word-box" key={`${word}-${index}`}>
          <motion.span
            className="mo-word"
            initial={{ y: reduced ? '0%' : '114%' }}
            whileInView={{ y: '0%' }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: index * 0.055, duration: 0.85, ease: EASE_OUT }}
          >
            {word}
            {index < words.length - 1 ? '\u00A0' : ''}
          </motion.span>
        </span>
      ))}
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
  const [hovered, setHovered] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const tilt = (event: ReactMouseEvent<HTMLElement>) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    target.style.setProperty('--rx', `${(-py * 4.5).toFixed(2)}deg`);
    target.style.setProperty('--ry', `${(px * 5.5).toFixed(2)}deg`);
    imgRef.current?.style.setProperty('translate', `${(-px * 10).toFixed(1)}px, ${(-py * 10).toFixed(1)}px`);
  };
  const untilt = (event: ReactMouseEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--rx', '0deg');
    event.currentTarget.style.setProperty('--ry', '0deg');
    imgRef.current?.style.setProperty('translate', '0px, 0px');
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
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={(event) => {
          untilt(event);
          setHovered(false);
        }}
        onClick={() => onSelect(concept)}
      >
        <figure className="mo-frame">
          <div className="mo-frame-mask">
            <motion.img
              ref={imgRef}
              layoutId={enableFlight ? `obra-${concept.id}` : undefined}
              src={concept.illustration.src}
              alt={concept.illustration.alt}
              loading="lazy"
            />
            {featured && <DistortOverlay imageRef={imgRef} active={hovered} />}
          </div>
          <span className="mo-frame-glow" aria-hidden="true" />
        </figure>
        <div className="mo-obra-meta">
          <span className="mo-plate">
            N.º {String(plate).padStart(2, '0')}
            {concept.model3d ? ' · maqueta' : ''}
          </span>
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
      className="mo-sala mo-layer"
      ref={sectionRef}
      style={{ '--accent': chapter.color } as CSSProperties}
    >
      <header className="mo-sala-head">
        <SalaNo value={chapter.number} progress={fillProgress} reduced={Boolean(reduced)} />
        <div className="mo-sala-copy">
          <p className="mo-kicker">
            Sala {chapter.number} — {chapter.concepts.length} piezas
          </p>
          <h2>
            <RevealWords text={chapter.title} />
          </h2>
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

/* ---------------- Vitrina de contrastes ---------------- */

const Vitrina = ({
  ids,
  onRemove,
  onOpen,
}: {
  ids: string[];
  onRemove: (conceptId: string) => void;
  onOpen: (concept: AstroConcept) => void;
}) => {
  const obras = ids
    .map((id) => conceptById.get(id))
    .filter((item): item is AstroConcept => Boolean(item));

  return (
    <section id="vitrina" className="mo-vitrina mo-layer">
      <header className="mo-section-head">
        <p className="mo-kicker">Vitrina de contrastes</p>
        <h2>
          <RevealWords text="Obras seleccionadas" />
        </h2>
        <p className="mo-section-sub">
          Añade hasta {VITRINE_CAP} obras desde su sala de estudio para leerlas en paralelo.
        </p>
      </header>

      {obras.length === 0 ? (
        <p className="mo-vitrina-empty">
          La vitrina está vacía. Entra a cualquier obra y pulsa «Añadir a la vitrina de
          contrastes» para comenzar la comparación.
        </p>
      ) : (
        <div className="mo-vitrina-grid">
          {obras.map((concept, cardIndex) => {
            const chapter = resolveChapter(concept);
            return (
              <motion.article
                key={concept.id}
                className="mo-vitrina-card"
                style={{ '--accent': chapter.color } as CSSProperties}
                initial={{ opacity: 0, y: 34 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: Math.min(cardIndex * 0.06, 0.42), duration: 0.75, ease: EASE_OUT }}
              >
                <header>
                  <button
                    type="button"
                    className="mo-vitrina-title"
                    onClick={() => onOpen(concept)}
                    data-cursor-label="Abrir"
                  >
                    <span className="mo-plate">{chapter.number}·{concept.title}</span>
                    <h3>{concept.title}</h3>
                  </button>
                  <button
                    type="button"
                    className="mo-vitrina-remove"
                    onClick={() => onRemove(concept.id)}
                    aria-label={`Quitar ${concept.title} de la vitrina`}
                    data-cursor-label="Quitar"
                  >
                    ✕
                  </button>
                </header>
                <div className="mo-chip-row">
                  <span>{concept.category}</span>
                  <span>{scaleLabels[concept.scale]}</span>
                  <span>{plausibilityLabels[concept.plausibility]}</span>
                </div>
                <dl className="mo-metrics-v2">
                  {(
                    [
                      ['Energía', concept.metrics.energia],
                      ['Materiales', concept.metrics.materiales],
                      ['Madurez', concept.metrics.madurez],
                      ['Maravilla', concept.metrics.maravilla],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd aria-label={`${value} de 5`}>
                        {[1, 2, 3, 4, 5].map((cell) => (
                          <i key={cell} className={cell <= value ? 'is-on' : ''} />
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mo-vitrina-mechanism">{concept.mechanism}</p>
              </motion.article>
            );
          })}
        </div>
      )}
    </section>
  );
};

/* ---------------- Sala archivo ---------------- */

interface ArchiveSource extends SourceRef {
  count: number;
}

const buildArchive = (): ArchiveSource[] => {
  const map = new Map<string, ArchiveSource>();
  const push = (source: SourceRef) => {
    const current = map.get(source.url);
    map.set(source.url, { ...source, count: (current?.count ?? 0) + 1 });
  };
  chapters.forEach((chapter) => chapter.sources.forEach(push));
  chapters.forEach((chapter) => chapter.concepts.forEach((concept) => concept.sources?.forEach(push)));
  return [...map.values()];
};

const Archivo = ({ sources }: { sources: ArchiveSource[] }) => (
  <section id="archivo" className="mo-archivo mo-layer">
    <header className="mo-section-head">
      <p className="mo-kicker">Sala archivo</p>
      <h2>
        <RevealWords text="Fuentes de la colección" />
      </h2>
      <p className="mo-section-sub">
        Toda la documentación técnica citada en el museo: NASA, SETI y otros materiales de
        referencia.
      </p>
    </header>
    <ol className="mo-archivo-list">
      {sources.map((source, index) => (
        <motion.li
          key={source.url}
          initial={{ opacity: 0, x: -22 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-30px' }}
          transition={{ delay: Math.min(index * 0.035, 0.5), duration: 0.6, ease: EASE_OUT }}
        >
          <b>{String(index + 1).padStart(2, '0')}</b>
          <div>
            <span>{source.publisher}</span>
            <a href={source.url} target="_blank" rel="noreferrer" data-cursor-label="Leer">
              {source.title} ↗
            </a>
          </div>
          <i>
            citada en {source.count} {source.count === 1 ? 'ficha' : 'fichas'}
          </i>
        </motion.li>
      ))}
    </ol>
  </section>
);

/* ---------------- Menú persistente ---------------- */

const MenuOverlay = ({
  open,
  onClose,
  onGo,
}: {
  open: boolean;
  onClose: () => void;
  onGo: (targetId: string) => void;
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useScrollLock(open);

  if (!open) return null;

  return (
    <motion.div
      className="mo-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Índice del museo"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mo-menu-panel">
        <button
          ref={closeRef}
          type="button"
          className="mo-menu-close"
          onClick={onClose}
          data-cursor-label="Cerrar"
        >
          ✕ Cerrar índice
        </button>
        <p className="mo-kicker">Museo Orbital</p>
        <h2>Índice del recorrido</h2>
        <ol className="mo-menu-list">
          {chapters.map((chapter, index) => (
            <motion.li
              key={chapter.id}
              initial={{ opacity: 0, x: -26 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 + index * 0.04, duration: 0.5, ease: EASE_OUT }}
            >
              <button
                type="button"
                style={{ '--accent': chapter.color } as CSSProperties}
                onClick={() => onGo(`sala-${chapter.id}`)}
                data-cursor-label={`Sala ${chapter.number}`}
              >
                <b>{chapter.number}</b>
                <span>{chapter.title}</span>
                <i>{chapter.concepts.length}</i>
              </button>
            </motion.li>
          ))}
          <motion.li
            initial={{ opacity: 0, x: -26 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 + chapters.length * 0.04, duration: 0.5, ease: EASE_OUT }}
          >
            <button
              type="button"
              className="is-extra"
              onClick={() => onGo('vitrina')}
              data-cursor-label="Comparar"
            >
              <b>✦</b>
              <span>Vitrina de contrastes</span>
            </button>
          </motion.li>
          <motion.li
            initial={{ opacity: 0, x: -26 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 + chapters.length * 0.04, duration: 0.5, ease: EASE_OUT }}
          >
            <button
              type="button"
              className="is-extra"
              onClick={() => onGo('archivo')}
              data-cursor-label="Fuentes"
            >
              <b>§</b>
              <span>Sala archivo</span>
            </button>
          </motion.li>
        </ol>
      </div>
    </motion.div>
  );
};

/* ---------------- Principal ---------------- */

export default function MuseoOrbital() {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<AstroConcept | null>(() => conceptFromHash());
  const [activeHallId, setActiveHallId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [vitrineIds, setVitrineIds] = useState<string[]>(loadVitrine);
  const [flight, setFlight] = useState(false);
  const flightTimer = useRef(0);
  const prevHall = useRef<string | null>(null);

  useScrollLock(Boolean(active));

  const { scrollYProgress } = useScroll({ container: rootRef });
  const railScale = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.4 });
  const railStarTop = useTransform(railScale, [0, 1], ['2%', '98%']);

  const archiveSources = useMemo(buildArchive, []);

  const triggerFlight = () => {
    if (reduced) return;
    setFlight(true);
    window.clearTimeout(flightTimer.current);
    flightTimer.current = window.setTimeout(() => setFlight(false), 460);
  };

  useEffect(() => () => window.clearTimeout(flightTimer.current), []);

  useEffect(() => {
    try {
      window.localStorage.setItem(VITRINE_KEY, JSON.stringify(vitrineIds));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [vitrineIds]);

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
    if (reduced) return;
    const el = rootRef.current;
    if (!el) return;
    let last = el.scrollTop;
    let vel = 0;
    let raf = 0;
    const onScroll = () => {
      const top = el.scrollTop;
      vel = vel * 0.8 + (top - last) * 0.2;
      last = top;
    };
    const loop = () => {
      vel *= 0.9;
      const skew = Math.max(-5, Math.min(5, vel * 0.012));
      el.style.setProperty('--marquee-skew', `${skew.toFixed(2)}deg`);
      raf = requestAnimationFrame(loop);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  useEffect(() => {
    if (reduced || !window.matchMedia('(pointer: fine)').matches) return;
    const offsets = new WeakMap<Element, { x: number; y: number }>();
    const mouse = { x: -9999, y: -9999 };
    let raf = 0;
    let nodes: HTMLElement[] = [];
    let lastScan = 0;

    const onMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };

    const loop = (time: number) => {
      if (time - lastScan > 2200) {
        nodes = Array.from(
          document.querySelectorAll<HTMLElement>('.mo-obra.is-featured .mo-frame-mask'),
        );
        lastScan = time;
      }
      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        if (rect.bottom < -90 || rect.top > window.innerHeight + 90) continue;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = mouse.x - cx;
        const dy = mouse.y - cy;
        const dist = Math.hypot(dx, dy);
        const radius = Math.max(rect.width, rect.height) / 2 + 100;
        const force = dist < radius ? Math.pow(1 - dist / radius, 1.6) : 0;
        const state = offsets.get(node) ?? { x: 0, y: 0 };
        const tx = force > 0 ? (dx / (dist || 1)) * force * 7 : 0;
        const ty = force > 0 ? (dy / (dist || 1)) * force * 5 : 0;
        state.x += (tx - state.x) * 0.12;
        state.y += (ty - state.y) * 0.12;
        offsets.set(node, state);
        node.style.transform = `translate(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px)`;
      }
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

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

  useEffect(() => {
    if (!activeHallId) return;
    if (prevHall.current && prevHall.current !== activeHallId) {
      window.dispatchEvent(new CustomEvent('mo-comet'));
    }
    prevHall.current = activeHallId;
  }, [activeHallId]);

  const openConcept = (concept: AstroConcept) => {
    triggerFlight();
    setActive(concept);
  };

  const closeConcept = () => {
    triggerFlight();
    setActive(null);
  };

  const toggleVitrine = (conceptId: string) => {
    setVitrineIds((current) => {
      if (current.includes(conceptId)) {
        return current.filter((id) => id !== conceptId);
      }
      if (current.length >= VITRINE_CAP) {
        return current;
      }
      return [...current, conceptId];
    });
  };

  const goFromMenu = (targetId: string) => {
    setMenuOpen(false);
    window.setTimeout(() => scrollToId(targetId), 120);
  };

  let plateOffset = 0;
  const activeHall = chapters.find((chapter) => chapter.id === activeHallId);

  return (
    <div className="mo-root" ref={rootRef}>
      <StarfieldCanvas scrollRef={rootRef} dim={Boolean(active) || menuOpen} />
      <Grain opacity={0.06} blend="screen" zIndex={40} />
      <MuseumCursor />

      <button
        type="button"
        className="mo-index-button"
        onClick={() => setMenuOpen(true)}
        data-cursor-label="Índice"
      >
        Índice
      </button>

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

      <Vitrina
        ids={vitrineIds}
        onRemove={toggleVitrine}
        onOpen={openConcept}
      />

      <Archivo sources={archiveSources} />

      <footer className="mo-footer mo-layer">
        <blockquote>{chapters[0].sections[1]?.body}</blockquote>
        <p className="mo-footer-line">
          ASTROINGENIERÍA — EXPOSICIÓN PERMANENTE · MUSEO ORBITAL · MMXXVI
        </p>
      </footer>

      <aside className="mo-rail" aria-label="Progreso del recorrido">
        <div className="mo-rail-track">
          <motion.div className="mo-rail-fill" style={{ scaleY: railScale }} />
          <motion.i
            className="mo-rail-star"
            style={{ top: railStarTop }}
            aria-hidden="true"
          />
        </div>
        {chapters.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            title={chapter.title}
            className={activeHallId === chapter.id ? 'is-active' : ''}
            style={{ '--accent': chapter.color } as CSSProperties}
            onClick={() => scrollToId(`sala-${chapter.id}`)}
          />
        ))}
        <span className="mo-rail-label">
          {activeHall ? `Sala ${activeHall.number} — ${activeHall.title}` : ''}
        </span>
      </aside>

      <AnimatePresence>
        {menuOpen && (
          <MenuOverlay open={menuOpen} onClose={() => setMenuOpen(false)} onGo={goFromMenu} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {flight && (
          <motion.div
            key="bar-top"
            className="mo-letterbox is-top"
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {flight && (
          <motion.div
            key="bar-bottom"
            className="mo-letterbox is-bottom"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {flight && (
          <motion.div
            key="flash"
            className="mo-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.18, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, times: [0, 0.3, 1] }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {active && (
          <StudioRoom
            key="studio"
            concept={active}
            chapter={resolveChapter(active)}
            siblings={resolveChapter(active).concepts}
            enableFlight={!reduced}
            inVitrine={vitrineIds.includes(active.id)}
            onToggleVitrine={toggleVitrine}
            onClose={closeConcept}
            onSelect={openConcept}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
