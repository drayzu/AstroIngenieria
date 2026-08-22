import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { chapters } from '../../data/astroData';
import { Grain } from '../shared/Grain';
import { createRng } from '../shared/conceptImages';
import { ERAS, buildTimeline, type TimedEvent } from './eraModel';
import './cronografia.css';

/**
 * Cronografía — el scroll como máquina del tiempo por el futuro cósmico
 * (10 → 10¹⁰⁰ años, escala logarítmica). Los conceptos nacen como eventos de
 * su época y el cielo del fondo envejece: densidad, color y brillo estelar
 * decaen con los exponentes hasta la página casi en blanco.
 */

const chapterTitle = new Map(chapters.map((chapter) => [chapter.id, chapter.title]));

const formatExp = (value: number) => value.toFixed(1).replace('.', ',');

interface SkyStar {
  x: number;
  y: number;
  r: number;
  alpha: number;
  tw: number;
  z: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const segment = (value: number, from: number, to: number) => clamp01((value - from) / (to - from));

/** Densidad estelar, calidez de color y brillo en función del año (log). */
const skyFactors = (logYear: number) => ({
  density:
    logYear < 9
      ? 1
      : logYear < 11
        ? lerp(1, 0.75, segment(logYear, 9, 11))
        : logYear < 14
          ? lerp(0.75, 0.4, segment(logYear, 11, 14))
          : logYear < 30
            ? lerp(0.4, 0.12, segment(logYear, 14, 30))
            : logYear < 60
              ? lerp(0.12, 0.03, segment(logYear, 30, 60))
              : lerp(0.03, 0.01, segment(logYear, 60, 100)),
  warmth:
    logYear < 9 ? 0 : logYear < 14 ? lerp(0, 0.6, segment(logYear, 9, 14)) : lerp(0.6, 1, segment(logYear, 14, 40)),
  brightness:
    logYear < 12 ? 1 : logYear < 40 ? lerp(1, 0.35, segment(logYear, 12, 40)) : lerp(0.35, 0.08, segment(logYear, 40, 100)),
});

export default function Cronografia() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLCanvasElement>(null);
  const eraRefs = useRef<(HTMLElement | null)[]>([]);
  const [hud, setHud] = useState({ exp: 1, eraId: ERAS[0].id });

  const reducedMotion = useReducedMotion();

  const timeline = useMemo(
    () => buildTimeline(chapters.flatMap((chapter) => chapter.concepts)),
    [],
  );
  const eventsByEra = useMemo(() => {
    const map = new Map<number, TimedEvent[]>();
    timeline.forEach((event) => {
      const bucket = map.get(event.eraIndex) ?? [];
      bucket.push(event);
      map.set(event.eraIndex, bucket);
    });
    return map;
  }, [timeline]);

  const stars = useMemo<SkyStar[]>(
    () =>
      Array.from({ length: 300 }, (_, i) => {
        const rng = createRng(`cielo-${i}`);
        return {
          x: rng.unit(),
          y: rng.unit(),
          r: 0.4 + rng.unit() * 1.4,
          alpha: 0.25 + rng.unit() * 0.75,
          tw: rng.range(0, Math.PI * 2),
          z: 0.3 + rng.unit() * 0.7,
        };
      }),
    [],
  );

  /* HUD + cielo: derivados del scroll */
  useEffect(() => {
    const scroll = scrollRef.current;
    const sky = skyRef.current;
    if (!scroll || !sky) {
      return;
    }
    const context = sky.getContext('2d');
    if (!context) {
      return;
    }

    let lastExp = -1;
    const resize = () => {
      sky.width = Math.floor(scroll.clientWidth * 0.75);
      sky.height = Math.floor(scroll.clientHeight * 0.75);
      lastExp = -1;
      draw(lastExp, 0);
    };

    const draw = (logYear: number, time: number) => {
      const w = sky.width;
      const h = sky.height;
      const { density, warmth, brightness } = skyFactors(logYear);
      const bg = Math.pow(clamp01(1 - warmth * 0.6), 1);
      context.clearRect(0, 0, w, h);
      context.fillStyle = `rgb(${Math.round(lerp(5, 7, bg))}, ${Math.round(lerp(6, 4, bg))}, ${Math.round(lerp(12, 9, bg))})`;
      context.fillRect(0, 0, w, h);

      const cr = Math.round(lerp(205, 255, warmth));
      const cg = Math.round(lerp(220, 150, warmth));
      const cb = Math.round(lerp(255, 92, warmth));

      const visible = Math.round(stars.length * density);
      for (let i = 0; i < visible; i += 1) {
        const star = stars[i];
        const twinkle = reducedMotion ? 0.9 : 0.6 + 0.4 * Math.sin(star.tw + time * 0.0012 * star.z);
        context.globalAlpha = star.alpha * brightness * twinkle;
        context.fillStyle = `rgb(${cr}, ${cg}, ${cb})`;
        context.beginPath();
        context.arc(star.x * w, star.y * h, star.r * star.z, 0, Math.PI * 2);
        context.fill();
      }

      if (logYear >= 14 && logYear < 60) {
        const glow = segment(logYear, 14, 20) * (1 - segment(logYear, 40, 60));
        context.globalAlpha = 0.5 * glow;
        const gx = w * 0.72;
        const gy = h * 0.26;
        const gradient = context.createRadialGradient(gx, gy, 0, gx, gy, 90);
        gradient.addColorStop(0, 'rgba(150, 130, 255, 0.7)');
        gradient.addColorStop(0.4, 'rgba(90, 70, 200, 0.24)');
        gradient.addColorStop(1, 'rgba(20, 14, 40, 0)');
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(gx, gy, 90, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    let raf = 0;
    resize();
    window.addEventListener('resize', resize);

    const animate = (time: number) => {
      draw(lastExp < 0 ? 1 : lastExp, time);
      raf = requestAnimationFrame(animate);
    };
    if (!reducedMotion) {
      raf = requestAnimationFrame(animate);
    }

    let queued = false;
    const onScroll = () => {
      if (queued) {
        return;
      }
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const probe = scroll.scrollTop + scroll.clientHeight * 0.38;
        let eraIndex = 0;
        for (let i = 0; i < ERAS.length; i += 1) {
          const element = eraRefs.current[i];
          if (element && element.offsetTop <= probe) {
            eraIndex = i;
          }
        }
        const current = eraRefs.current[eraIndex];
        const next = eraRefs.current[eraIndex + 1];
        const era = ERAS[eraIndex];
        let t = 0;
        if (current) {
          const top = current.offsetTop;
          const bottom = next ? next.offsetTop : scroll.scrollHeight;
          t = clamp01((probe - top) / Math.max(bottom - top, 1));
        }
        const logYear = lerp(era.from, era.to, t);
        if (Math.abs(logYear - lastExp) > 0.05) {
          lastExp = logYear;
          if (reducedMotion) {
            draw(logYear, 0);
          }
          setHud({ exp: logYear, eraId: era.id });
        }
      });
    };
    scroll.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      scroll.removeEventListener('scroll', onScroll);
    };
  }, [stars, reducedMotion]);

  const hudEra = ERAS.find((era) => era.id === hud.eraId) ?? ERAS[0];

  return (
    <div className="cr-root">
      <Grain opacity={0.05} blend="screen" zIndex={30} />
      <canvas ref={skyRef} className="cr-sky" aria-hidden="true" />

      <div className="cr-hud" role="status" aria-label="Año actual del viaje">
        <span className="cr-hud-year">
          AÑO 10<sup>{formatExp(hud.exp)}</sup>
        </span>
        <span className="cr-hud-era" style={{ '--cr-accent': hudEra.accent } as CSSProperties}>
          {hudEra.num} · {hudEra.name}
        </span>
      </div>

      <div className="cr-scroll" ref={scrollRef}>
        <header className="cr-hero">
          <p className="cr-hero-kicker">LA FORJA · PLANTILLA 03</p>
          <h1 className="cr-hero-title">Cronografía</h1>
          <p className="cr-hero-sub">
            El atlas recorre su propio futuro: cada concepto vive en la época en
            que podría existir, desde los próximos diez años hasta el 10¹⁰⁰.
          </p>
          <p className="cr-hero-meta">
            <span>DESDE 10¹ AÑOS</span>
            <span className="cr-hero-arrow">↓</span>
            <span>HASTA 10¹⁰⁰ AÑOS</span>
          </p>
        </header>

        {ERAS.map((era, index) => {
          const events = eventsByEra.get(index) ?? [];
          return (
            <section
              key={era.id}
              className="cr-era"
              ref={(element) => {
                eraRefs.current[index] = element;
              }}
              style={{ '--cr-accent': era.accent } as CSSProperties}
              aria-label={`${era.name} (${era.tagline})`}
            >
              <header className="cr-era-head">
                <span className="cr-era-num" aria-hidden="true">
                  {era.num}
                </span>
                <div className="cr-era-heading">
                  <p className="cr-era-tag">{era.tagline}</p>
                  <h2 className="cr-era-name">{era.name}</h2>
                  <p className="cr-era-desc">{era.description}</p>
                </div>
              </header>

              <ol className="cr-events">
                {events.map(({ concept, logYear }) => (
                  <motion.li
                    key={concept.id}
                    className="cr-event"
                    initial={reducedMotion ? false : { opacity: 0, y: 26 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-8% 0px' }}
                    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <span className="cr-event-year">
                      10<sup>{logYear.toFixed(1).replace('.', ',')}</sup>
                    </span>
                    <span className="cr-event-node" aria-hidden="true" />
                    <article className="cr-event-card">
                      <h3 className="cr-event-title">{concept.title}</h3>
                      <p className="cr-event-chapter">{chapterTitle.get(concept.chapterId)}</p>
                      <p className="cr-event-summary">{concept.summary}</p>
                      <p className="cr-event-foot">
                        <span>{concept.scale.toUpperCase()}</span>
                        <span>{concept.plausibility.toUpperCase()}</span>
                        <span className="cr-event-dies">
                          VIGENTE HASTA 10<sup>{era.to}</sup>
                        </span>
                      </p>
                    </article>
                  </motion.li>
                ))}
              </ol>
            </section>
          );
        })}

        <footer className="cr-fin">
          <p className="cr-fin-exp">
            10<sup>100</sup>
          </p>
          <h2 className="cr-fin-title">Fin del archivo</h2>
          <p className="cr-fin-text">
            Ya no hay gradiente, ni movimiento, ni páginas por escribir. La
            astroingeniería termina donde el tiempo deja de importar.
          </p>
          <button
            type="button"
            className="cr-fin-back"
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })}
          >
            ⟲ Volver al presente
          </button>
        </footer>
      </div>
    </div>
  );
}
