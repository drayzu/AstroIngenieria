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
  useInView,
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

const scrollToId = (id: string) => {
  window.dispatchEvent(new CustomEvent('mo-warp'));
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  const boxRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const kickerRef = useRef<HTMLParagraphElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduced || !window.matchMedia('(pointer: fine)').matches) return;

    const mouse = { x: -9999, y: -9999 };
    const motion2d = { x: -9999, y: -9999, t: 0, speed: 0 };
    const states = letters.map(() => ({
      x: 0,
      y: 0,
      w: 520,
      ix: 0,
      iy: 0,
      ir: 0,
      ivx: 0,
      ivy: 0,
      ivr: 0,
      is: 0,
      ivs: 0,
    }));
    // Textos del hero que tambien reciben impactos (bloques completos)
    const extras: {
      el: HTMLElement | null;
      x: number;
      y: number;
      r: number;
      vx: number;
      vy: number;
      vr: number;
    }[] = [
      { el: kickerRef.current, x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0 },
      { el: subRef.current, x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0 },
      { el: hintRef.current, x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0 },
    ];
    const glint = { index: -1, t0: 0 };
    let waveT0 = -10;
    let raf = 0;
    let clock = 0;

    // Ola de peso que recorre el título con cada lluvia de meteoros
    const onShowerWave = () => {
      waveT0 = clock;
    };
    window.addEventListener('mo-shower', onShowerWave);

    // Impacto de proyectiles de la resortera sobre las letras del título:
    // impulso proporcional a la velocidad del meteoro, con caída por distancia
    const onTitleHit = (event: Event) => {
      const detail = (event as CustomEvent<{ x: number; y: number; vx: number; vy: number }>)
        .detail;
      if (!detail) return;
      const speed = Math.hypot(detail.vx, detail.vy);
      if (speed < 0.5) return;
      const radius = 150;
      const dirX = detail.vx / speed;
      const dirY = detail.vy / speed;
      boxRefs.current.forEach((el, index) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        // Distancia al RECTANGULO de la letra: un cruce por dentro de la caja
        // es golpe pleno aunque caiga lejos del centro (cajas de ~200px alto)
        const dxr = Math.max(rect.left - detail.x, 0, detail.x - rect.right);
        const dyr = Math.max(rect.top - detail.y, 0, detail.y - rect.bottom);
        const d = Math.hypot(dxr, dyr);
        if (d > radius) return;
        const state = states[index];
        if (!state) return;
        const f = Math.pow(1 - d / radius, 1.5);
        const kick = Math.min(420, (300 + speed * 10) * f);
        // Jitter explosivo: cada letra recibe el golpe desviado al azar y con
        // magnitud propia, para que la hilera estalle en direcciones distintas
        const jitterAng = (Math.random() - 0.5) * 0.7;
        const magMul = 0.75 + Math.random() * 0.6;
        state.ivx += (dirX * Math.cos(jitterAng) - dirY * Math.sin(jitterAng)) * kick * magMul;
        state.ivy += (dirX * Math.sin(jitterAng) + dirY * Math.cos(jitterAng)) * kick * magMul;
        // Golpe de escala: pulso de tamano que respira y se asienta
        state.ivs += 2.4 * f;
        const cross = dirX * ((cy - detail.y) / (d || 1)) - dirY * ((cx - detail.x) / (d || 1));
        state.ivr += cross * 3.5 * f;
      });
      // Bloques de texto (kicker, subtitulo, hints): empujon contenido
      for (const ex of extras) {
        const el = ex.el;
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const dxr = Math.max(rect.left - detail.x, 0, detail.x - rect.right);
        const dyr = Math.max(rect.top - detail.y, 0, detail.y - rect.bottom);
        const d = Math.hypot(dxr, dyr);
        const radiusX = 240;
        if (d > radiusX) continue;
        const cxr = rect.left + rect.width / 2;
        const cyr = rect.top + rect.height / 2;
        const f = Math.pow(1 - d / radiusX, 1.5);
        const kick = Math.min(120, (300 + speed * 10) * 0.45 * f);
        ex.vx += dirX * kick;
        ex.vy += dirY * kick;
        const cross = dirX * ((cyr - detail.y) / (d || 1)) - dirY * ((cxr - detail.x) / (d || 1));
        ex.vr += Math.max(-0.05, Math.min(0.05, cross * 0.9 * f));
      }
    };
    window.addEventListener('mo-title-hit', onTitleHit);

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
        const waveT = (clock - waveT0) / 1.15;
        if (waveT >= 0 && waveT < 1) {
          const front = waveT * (letters.length + 8) - 4;
          const distL = Math.abs(index - front);
          if (distL < 3.2) {
            const s = Math.cos((distL / 3.2) * Math.PI * 0.5);
            targetW += s * 240;
            lift += -s * 9;
          }
        }

        const state = states[index];
        state.x += (targetX - state.x) * 0.09;
        state.y += (targetY + lift - state.y) * 0.09;
        state.w += (targetW - state.w) * 0.12;

        el.style.transform = `translate(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px)`;
        el.style.fontVariationSettings = `'opsz' 144, 'wght' ${Math.round(state.w)}`;

        // Muelle subamortiguado: la caja de la letra recibe el golpe y vuelve
        const box = boxRefs.current[index];
        if (box) {
          state.ivx += (-140 * state.ix - 7 * state.ivx) * 0.016;
          state.ivy += (-140 * state.iy - 7 * state.ivy) * 0.016;
          state.ivr += (-140 * state.ir - 7 * state.ivr) * 0.016;
          state.ivs += (-170 * state.is - 8.5 * state.ivs) * 0.016;
          state.ix += state.ivx * 0.016;
          state.iy += state.ivy * 0.016;
          state.ir += state.ivr * 0.016;
          state.is += state.ivs * 0.016;
          const scl = Math.max(0.55, Math.min(1.45, 1 + state.is));
          if (
            Math.abs(state.ix) > 0.05 ||
            Math.abs(state.iy) > 0.05 ||
            Math.abs(state.ir) > 0.003 ||
            Math.abs(state.is) > 0.002
          ) {
            box.style.transform = `translate(${state.ix.toFixed(2)}px, ${state.iy.toFixed(2)}px) rotate(${state.ir.toFixed(3)}rad) scale(${scl.toFixed(3)})`;
          } else if (box.style.transform) {
            box.style.transform = '';
            state.ix = 0;
            state.iy = 0;
            state.ir = 0;
            state.ivx = 0;
            state.ivy = 0;
            state.ivr = 0;
            state.is = 0;
            state.ivs = 0;
          }
        }
      });

      // Muelles propios para los bloques de texto golpeados
      for (const ex of extras) {
        const el = ex.el;
        if (!el) continue;
        ex.vx += (-110 * ex.x - 7 * ex.vx) * 0.016;
        ex.vy += (-110 * ex.y - 7 * ex.vy) * 0.016;
        ex.vr += (-110 * ex.r - 7 * ex.vr) * 0.016;
        ex.x += ex.vx * 0.016;
        ex.y += ex.vy * 0.016;
        ex.r += ex.vr * 0.016;
        if (Math.abs(ex.x) > 0.08 || Math.abs(ex.y) > 0.08 || Math.abs(ex.r) > 0.004) {
          el.style.transform = `translate(${ex.x.toFixed(2)}px, ${ex.y.toFixed(2)}px) rotate(${ex.r.toFixed(4)}rad)`;
        } else if (el.style.transform) {
          el.style.transform = '';
          ex.x = 0;
          ex.y = 0;
          ex.r = 0;
          ex.vx = 0;
          ex.vy = 0;
          ex.vr = 0;
        }
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mo-shower', onShowerWave);
      window.removeEventListener('mo-title-hit', onTitleHit);
      cancelAnimationFrame(raf);
    };
  }, [reduced, letters]);

  const trackSpotlight = (event: ReactMouseEvent<HTMLElement>) => {
    if (reduced) return;
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    target.style.setProperty('--sx', `${event.clientX - rect.left}px`);
    target.style.setProperty('--sy', `${event.clientY - rect.top}px`);
    // Parallax sutil del cielo de fondo
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    target.style.setProperty('--hbx', `${(-px * 14).toFixed(1)}px`);
    target.style.setProperty('--hby', `${(-py * 10).toFixed(1)}px`);
  };

  return (
    <section className="mo-hero mo-layer" onMouseMove={trackSpotlight}>
      <motion.div
        className="mo-hero-bg"
        style={{ backgroundImage: `url(${chapters[1].visual?.heroImage})` }}
        initial={{ scale: 1.22, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.9 }}
        transition={{ duration: reduced ? 0 : 3, ease: EASE_OUT }}
      />
      <div className="mo-hero-scrim" />
      <div className="mo-hero-spot" aria-hidden="true" />

      <div className="mo-hero-copy">
        <motion.p
          ref={kickerRef}
          className="mo-kicker"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 0.5, duration: 0.9, ease: EASE_OUT }}
        >
          Exposición permanente — Atlas de astroingeniería
        </motion.p>

        <h1 className="mo-hero-title" aria-label="Astroingeniería">
          {letters.map((letter, index) => (
            <span
              className="mo-hero-letterbox"
              key={`${letter}-${index}`}
              aria-hidden="true"
              ref={(el) => {
                boxRefs.current[index] = el;
              }}
            >
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
          ref={subRef}
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
          ref={hintRef}
          className="mo-sky-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduced ? 0 : 2.8, duration: 1 }}
        >
          <kbd className="mo-sky-key">clic</kbd>
          mantén: supernova
          <i className="mo-sky-sep" aria-hidden="true" />
          <kbd className="mo-sky-key">mayús+clic</kbd>
          constelación
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
  // La visibilidad se observa sobre el CONTENEDOR: las palabras viven dentro
  // de cajas con overflow:hidden que las recortan al 114%, y un observer
  // sobre la palabra recortada nunca llegaría a dispararse.
  const containerRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(containerRef, { once: true, margin: '-40px' });
  const shown = Boolean(inView) || Boolean(reduced);
  return (
    <span className="mo-words" ref={containerRef}>
      {words.map((word, index) => (
        <span className="mo-word-box" key={`${word}-${index}`}>
          <motion.span
            className="mo-word"
            initial={{ y: '114%' }}
            animate={{ y: shown ? '0%' : '114%' }}
            transition={{ delay: shown ? index * 0.055 : 0, duration: 0.85, ease: EASE_OUT }}
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

  // Títulos de sala con peso tipográfico magnético, eco sutil del hero
  useEffect(() => {
    if (reduced || !window.matchMedia('(pointer: fine)').matches) return;
    const weights = new WeakMap<Element, number>();
    const mouse = { x: -9999, y: -9999 };
    let raf = 0;
    let nodes: HTMLElement[] = [];
    let lastScan = 0;

    const onMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };

    const loop = (time: number) => {
      if (time - lastScan > 2000) {
        nodes = Array.from(
          document.querySelectorAll<HTMLElement>('.mo-sala-copy h2 .mo-word'),
        );
        lastScan = time;
      }

      // Fase de lectura: medir una sola vez antes de escribir estilos
      const rects = nodes.map((node) => node.getBoundingClientRect());

      nodes.forEach((node, index) => {
        const rect = rects[index];
        if (rect.bottom < -80 || rect.top > window.innerHeight + 80) return;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(mouse.x - cx, mouse.y - cy);
        const radius = 200;
        const norm = dist < radius ? 1 - dist / radius : 0;
        const eased = norm * norm * (3 - 2 * norm);
        const current = weights.get(node) ?? 500;
        const next = current + (500 + eased * 180 - current) * 0.2;
        weights.set(node, next);
        // El peso se aplica vía font-weight: la Fraunces variable interpola
        // el eje wght sin depender de font-variation-settings.
        if (next < 501.5 && eased === 0) {
          if (node.style.fontWeight) node.style.fontWeight = '';
        } else {
          node.style.fontWeight = String(Math.round(next));
        }
      });
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
    <div
      className="mo-root"
      ref={rootRef}
      onClickCapture={(event) => {
        // Con Mayús presionado se dibujan constelaciones: ningún clic navega
        if (event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
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
        <blockquote>
          La naturaleza necesitó miles de millones de años para engendrar una
          mente capaz de comprenderla. Bastó una fracción de ese tiempo para que
          aquella mente aprendiera a crear otras. Y así, de un universo que
          nunca supo hacia dónde iba, nació algo capaz de elegir hacia dónde irá.
        </blockquote>
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
