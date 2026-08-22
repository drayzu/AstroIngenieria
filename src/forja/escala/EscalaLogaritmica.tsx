import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { chapters, plausibilityLabels, scaleLabels } from '../../data/astroData';
import type { AstroConcept, AstroScale } from '../../types';
import { Grain } from '../shared/Grain';
import { createRng, seededUnit } from '../shared/conceptImages';
import './escalaLogaritmica.css';

/**
 * Órdenes de Magnitud — la rueda del ratón como nave por 27 órdenes de
 * magnitud (1 m → 10²⁷ m). Cada concepto vive a su escala real; el motor de
 * zoom es logarítmico y suavizado con un rAF propio que actualiza el mundo por
 * transform directo (sin re-render de React por frame).
 */

const MIN_LOG = 0;
const MAX_LOG = 27;
const PX_PER_DECADE = 340;

const BAND_CENTER: Record<AstroScale, number> = {
  nave: 2.1,
  habitat: 3.6,
  orbital: 7.3,
  planetaria: 8.05,
  estelar: 11.1,
  galactica: 21.2,
};

const BAND_SPREAD: Record<AstroScale, number> = {
  nave: 0.7,
  habitat: 1.35,
  orbital: 0.8,
  planetaria: 0.75,
  estelar: 0.9,
  galactica: 0.9,
};

interface Milestone {
  log: number;
  label: string;
}

const MILESTONES: Milestone[] = [
  { log: 0.23, label: 'Ser humano · 1,7 m' },
  { log: 2.04, label: 'ISS · 109 m' },
  { log: 2.92, label: 'Burj Khalifa · 828 m' },
  { log: 4.32, label: 'Manhattan · 21 km' },
  { log: 7.11, label: 'Tierra · 12.742 km' },
  { log: 9.15, label: 'Sol · 1,4 M km' },
  { log: 11.17, label: '1 UA · 150 M km' },
  { log: 12.95, label: 'Órbita de Neptuno' },
  { log: 15.98, label: '1 año luz' },
  { log: 16.61, label: 'Alfa Centauri' },
  { log: 21.0, label: 'Vía Láctea · 100 mil al' },
  { log: 22.98, label: 'Grupo Local' },
  { log: 26.94, label: 'Universo observable' },
];

interface Pin {
  concept: AstroConcept;
  log: number;
  x: number;
  level: number;
  down: boolean;
  accent: string;
}

const buildPins = (concepts: AstroConcept[]): Pin[] =>
  concepts
    .map((concept) => {
      const rng = createRng(`${concept.id}::eje`);
      const log =
        BAND_CENTER[concept.scale] + (seededUnit(`${concept.id}::pos`) - 0.5) * 2 * BAND_SPREAD[concept.scale];
      return {
        concept,
        log,
        x: log * PX_PER_DECADE,
        level: rng.int(0, 2),
        down: rng.unit() > 0.5,
        accent: chapters.find((chapter) => chapter.id === concept.chapterId)?.color ?? '#f9d66e',
      };
    })
    .sort((a, b) => a.log - b.log);

const LEVEL_OFFSETS = [64, 116, 168];

export default function EscalaLogaritmica() {
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const exponentRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const pins = useMemo(() => buildPins(
    chapters.flatMap((chapter) => chapter.concepts),
  ), []);

  const targetLog = useRef(BAND_CENTER.habitat);
  const currentLog = useRef(BAND_CENTER.habitat);
  const focusedRef = useRef<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>('oneill-cylinder');
  const [hintVisible, setHintVisible] = useState(true);

  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const jumpTo = (log: number) => {
    targetLog.current = Math.min(MAX_LOG, Math.max(MIN_LOG, log));
  };

  useEffect(() => {
    const stage = stageRef.current;
    const world = worldRef.current;
    const canvas = canvasRef.current;
    if (!stage || !world || !canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    let width = stage.clientWidth;
    let height = stage.clientHeight;

    const stars = Array.from({ length: 240 }, (_, i) => {
      const rng = createRng(`estrella-${i}`);
      return {
        x: rng.unit(),
        y: rng.unit(),
        z: 0.25 + rng.unit() * 0.75,
        r: 0.4 + rng.unit() * 1.3,
        tw: rng.range(0, Math.PI * 2),
      };
    });

    const resize = () => {
      width = stage.clientWidth;
      height = stage.clientHeight;
      canvas.width = Math.floor(width * 0.75);
      canvas.height = Math.floor(height * 0.75);
    };
    resize();
    window.addEventListener('resize', resize);

    const drawStars = (velocity: number) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;
      for (const star of stars) {
        const parallax = currentLog.current * 46 * star.z;
        const sx = ((star.x * w - parallax) % w + w) % w;
        const sy = star.y * h;
        const twinkle = reducedMotion ? 0.8 : 0.55 + 0.45 * Math.sin(star.tw + performance.now() * 0.0011 * star.z);
        const streak = reducedMotion ? 0 : Math.min(Math.abs(velocity) * 10 * star.z, 90);
        context.globalAlpha = (0.18 + star.z * 0.5) * twinkle;
        if (streak > 1.5) {
          context.strokeStyle = velocity > 0 ? '#f9d66e' : '#7fb4e8';
          context.lineWidth = star.r * 0.8;
          context.beginPath();
          context.moveTo(sx, sy);
          context.lineTo(sx - Math.sign(velocity) * streak, sy);
          context.stroke();
        } else {
          context.fillStyle = '#dfe9f5';
          context.beginPath();
          context.arc(sx, sy, star.r * star.z, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
    };

    let raf = 0;
    let last = performance.now();
    let lastLog = currentLog.current;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (reducedMotion) {
        currentLog.current = targetLog.current;
      } else {
        const blend = 1 - Math.exp(-dt * 3.4);
        currentLog.current += (targetLog.current - currentLog.current) * blend;
      }
      const velocity = (currentLog.current - lastLog) / Math.max(dt, 0.001);
      lastLog = currentLog.current;

      world.style.transform = `translate3d(${(width / 2 - currentLog.current * PX_PER_DECADE).toFixed(1)}px, 0, 0)`;

      if (exponentRef.current) {
        exponentRef.current.textContent = currentLog.current.toFixed(1);
      }
      if (progressRef.current) {
        progressRef.current.style.left = `${(currentLog.current / MAX_LOG) * 100}%`;
      }

      drawStars(velocity);

      const nearest = pins.reduce((best, pin) =>
        Math.abs(pin.log - currentLog.current) < Math.abs(best.log - currentLog.current) ? pin : best,
      );
      const focused = Math.abs(nearest.log - currentLog.current) < 1.1 ? nearest.concept.id : null;
      if (focused !== focusedRef.current) {
        focusedRef.current = focused;
        setFocusedId(focused);
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const step = event.deltaMode === 1 ? 0.9 : 0.34;
      jumpTo(targetLog.current + Math.sign(event.deltaY) * step);
      setHintVisible(false);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });

    let dragging = false;
    let dragX = 0;
    const onPointerDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest('button, a')) {
        return;
      }
      dragging = true;
      dragX = event.clientX;
      stage.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }
      const dx = event.clientX - dragX;
      dragX = event.clientX;
      jumpTo(targetLog.current - dx / PX_PER_DECADE);
      setHintVisible(false);
    };
    const onPointerUp = () => {
      dragging = false;
    };
    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointercancel', onPointerUp);
    };
  }, [pins, reducedMotion]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        jumpTo(targetLog.current + 0.9);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        jumpTo(targetLog.current - 0.9);
      } else if (event.key === 'PageDown' || event.key === 'PageUp') {
        const direction = event.key === 'PageDown' ? 1 : -1;
        const next = pins.find(
          (pin) => direction * (pin.log - targetLog.current) > 0.35,
        );
        if (next) {
          jumpTo(next.log);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pins]);

  const focused = pins.find((pin) => pin.concept.id === focusedId);
  const focusedChapter = focused
    ? chapters.find((chapter) => chapter.id === focused.concept.chapterId)
    : undefined;

  const worldWidth = MAX_LOG * PX_PER_DECADE + PX_PER_DECADE * 2;

  return (
    <div className="om-root">
      <Grain opacity={0.05} blend="screen" zIndex={30} />
      <canvas ref={canvasRef} className="om-stars" aria-hidden="true" />

      <div className="om-readout" aria-live="off">
        <p className="om-readout-label">ESCALA ACTUAL</p>
        <p className="om-readout-value">
          10<sup ref={exponentRef}>3,6</sup> m
        </p>
        <div className="om-progress" aria-hidden="true">
          <div ref={progressRef} className="om-progress-cursor" />
        </div>
        <p className="om-readout-hint">
          {hintVisible
            ? 'Gira la rueda o arrastra para viajar · ↑↓PgUp/PgDn saltan entre conceptos'
            : '1 metro ——— 10²⁷ metros'}
        </p>
      </div>

      <div className="om-stage" ref={stageRef} role="application" aria-label="Viaje por órdenes de magnitud">
        <div className="om-world" ref={worldRef} style={{ width: worldWidth }}>
          <div className="om-axis" aria-hidden="true" />
          {Array.from({ length: MAX_LOG + 1 }, (_, log) => (
            <div
              key={log}
              className="om-decade"
              style={{ left: log * PX_PER_DECADE }}
              aria-hidden="true"
            >
              <span className="om-decade-tick" />
              <span className="om-decade-label">
                10<sup>{log}</sup>
              </span>
            </div>
          ))}
          {MILESTONES.map((milestone) => (
            <button
              key={milestone.label}
              type="button"
              className="om-milestone"
              style={{ left: milestone.log * PX_PER_DECADE }}
              onClick={() => jumpTo(milestone.log)}
            >
              <span className="om-milestone-diamond" aria-hidden="true" />
              <span className="om-milestone-label">{milestone.label}</span>
            </button>
          ))}
          {pins.map(({ concept, log, level, down, accent }) => (
            <button
              key={concept.id}
              type="button"
              className={
                concept.id === focusedId
                  ? 'om-pin is-focused'
                  : 'om-pin'
              }
              style={
                {
                  left: log * PX_PER_DECADE,
                  '--om-offset': down
                    ? `${LEVEL_OFFSETS[level] + 34}px`
                    : `-${LEVEL_OFFSETS[level] + 34}px`,
                  '--om-accent': accent,
                } as CSSProperties
              }
              onClick={() => jumpTo(log)}
            >
              <span className="om-pin-stem" aria-hidden="true" />
              <span className="om-pin-node" aria-hidden="true" />
              <span className="om-pin-chip">
                <span className="om-pin-scale">{scaleLabels[concept.scale]}</span>
                <span className="om-pin-title">{concept.title}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="om-bands" aria-label="Saltos de escala">
        {(Object.keys(BAND_CENTER) as AstroScale[]).map((scale) => {
          const count = pins.filter((pin) => pin.concept.scale === scale).length;
          return (
            <button
              key={scale}
              type="button"
              className={focused?.concept.scale === scale ? 'om-band is-active' : 'om-band'}
              onClick={() => jumpTo(BAND_CENTER[scale])}
            >
              <span className="om-band-name">{scaleLabels[scale]}</span>
              <span className="om-band-exp">
                10<sup>{BAND_CENTER[scale].toFixed(1)}</sup>
              </span>
              <span className="om-band-count">{count}</span>
            </button>
          );
        })}
      </div>

      <aside className="om-dossier">
        {focused && focusedChapter ? (
          <>
            <p className="om-dossier-kicker" style={{ color: focused.accent } as CSSProperties}>
              {focusedChapter.title.toUpperCase()}
            </p>
            <h2 className="om-dossier-title">{focused.concept.title}</h2>
            <div className="om-dossier-tags">
              <span className="om-tag">{scaleLabels[focused.concept.scale]}</span>
              <span className="om-tag">{plausibilityLabels[focused.concept.plausibility]}</span>
              <span className="om-tag om-tag-log">
                10<sup>{focused.log.toFixed(1)}</sup> m
              </span>
            </div>
            <p className="om-dossier-summary">{focused.concept.summary}</p>
            <p className="om-dossier-idea">
              <span>IDEA CLAVE</span>
              {focused.concept.keyIdea}
            </p>
            <div className="om-dossier-metrics">
              {(
                [
                  ['ENERGÍA', focused.concept.metrics.energia],
                  ['MATERIALES', focused.concept.metrics.materiales],
                  ['MADUREZ', focused.concept.metrics.madurez],
                  ['MARAVILLA', focused.concept.metrics.maravilla],
                ] as [string, number][]
              ).map(([label, value]) => (
                <div key={label} className="om-metric">
                  <span className="om-metric-label">{label}</span>
                  <span className="om-metric-track">
                    {Array.from({ length: 5 }, (_, i) => (
                      <i key={i} className={i < value ? 'is-on' : ''} />
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="om-dossier-empty">
            <p className="om-dossier-kicker">ZONA VACÍA</p>
            <p className="om-dossier-empty-text">
              Entre escalas no hay nada: solo el vacío que la astroingeniería
              intenta cruzar. Sigue viajando hasta el próximo concepto.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
