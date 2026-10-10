import { useEffect, useMemo, useRef } from 'react';
import { motion, useMotionValueEvent, useTransform, type MotionValue } from 'framer-motion';

/* Viajes de los portales: cada capítulo abre su ventana de una forma
   distinta, siempre con trazos finos de luz. Comparten el mismo guion:
   la ventana se abre (OPEN) y luego cubre la pantalla (COVER). */

export type JourneyKind = 'iris' | 'torus' | 'blueprint' | 'horizon' | 'starburst' | 'hyperspace' | 'galaxy';

export const JOURNEY_OPEN: [number, number] = [0.02, 0.29];
export const JOURNEY_COVER: [number, number] = [0.34, 0.56];

const JOURNEYS: Record<string, JourneyKind> = {
  habitats: 'torus',
  infrastructure: 'blueprint',
  planetary: 'horizon',
  energy: 'starburst',
  propulsion: 'hyperspace',
  stellar: 'starburst',
  civilizations: 'galaxy',
  search: 'galaxy',
};

export const journeyFor = (chapterId: string): JourneyKind => JOURNEYS[chapterId] ?? 'iris';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const seg = (p: number, [from, to]: [number, number]) => clamp01((p - from) / (to - from));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

// Pseudoaleatorio estable: rayos, estelas y estrellas no cambian entre renders
const seeded = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* Radio del iris en dos tramos: ventana en vmin y luego cubrir en vmax */
const irisRadius = (p: number, windowSize = 30) => {
  const min = 0.7 + (windowSize - 0.7) * easeOut(seg(p, JOURNEY_OPEN));
  const max = 76 * easeInOut(seg(p, JOURNEY_COVER));
  return `calc(${min.toFixed(3)}vmin + ${max.toFixed(3)}vmax)`;
};

// El horizonte es un círculo enorme cuyo borde superior sube desde abajo
const HORIZON_R = 140;
const horizonRise = (p: number) => ({
  vh: 44 * easeOut(seg(p, JOURNEY_OPEN)) + 56 * easeInOut(seg(p, JOURNEY_COVER)),
  vmax: 12 * easeInOut(seg(p, JOURNEY_COVER)),
});

const torusTilt = (p: number) =>
  0.14 + 0.86 * easeInOut(seg(p, [JOURNEY_OPEN[0] + 0.04, JOURNEY_OPEN[1] + 0.06]));

const blueprintInset = (p: number) => {
  // Primero una línea de escaneo horizontal, luego la ventana se abre en alto
  const wide = easeOut(seg(p, [JOURNEY_OPEN[0], JOURNEY_OPEN[0] + 0.12]));
  const tall = easeOut(seg(p, [JOURNEY_OPEN[0] + 0.08, JOURNEY_OPEN[1]]));
  const cover = easeInOut(seg(p, JOURNEY_COVER));
  return {
    side: (50 - 32 * wide) * (1 - cover),
    top: (49.7 - 23.7 * tall) * (1 - cover),
  };
};

/* Recorte de la imagen del capítulo según el viaje */
export const journeyClip = (kind: JourneyKind, p: number): string => {
  switch (kind) {
    case 'torus': {
      const rx = irisRadius(p, 34);
      return `ellipse(${rx} calc(${rx} * ${torusTilt(p).toFixed(3)}) at 50% 50%)`;
    }
    case 'blueprint': {
      const { side, top } = blueprintInset(p);
      return `inset(${top.toFixed(2)}% ${side.toFixed(2)}% ${top.toFixed(2)}% ${side.toFixed(2)}%)`;
    }
    case 'horizon': {
      const { vh, vmax } = horizonRise(p);
      return `circle(${HORIZON_R}vmax at 50% calc(100% + ${HORIZON_R}vmax - ${vh.toFixed(2)}vh - ${vmax.toFixed(2)}vmax))`;
    }
    case 'galaxy':
      return `circle(${irisRadius(p, 22)} at 50% 50%)`;
    default:
      return `circle(${irisRadius(p)} at 50% 50%)`;
  }
};

/* Intensidad del salto del cielo durante el viaje */
export const journeyWarp = (kind: JourneyKind) => (kind === 'hyperspace' ? 2.2 : 1);

// Visible mientras se abre la ventana, desaparece al empezar a cubrir
const useOverlayOpacity = (progress: MotionValue<number>, fadeAfter = 0.13) =>
  useTransform(
    progress,
    [JOURNEY_OPEN[0], JOURNEY_OPEN[0] + 0.05, JOURNEY_COVER[0], JOURNEY_COVER[0] + fadeAfter],
    [0, 1, 1, 0],
  );

/* ---------------- Iris: el anillo clásico ---------------- */

const IrisRing = ({ progress }: { progress: MotionValue<number> }) => {
  const size = useTransform(progress, (p) => `calc(2 * ${irisRadius(p)})`);
  const opacity = useOverlayOpacity(progress);
  return <motion.span className="mo-journey-ring" style={{ width: size, height: size, opacity }} />;
};

/* ---------------- Toroide: un anillo de canto que gira hasta mirarte ---------------- */

const TorusRims = ({ progress }: { progress: MotionValue<number> }) => {
  const width = useTransform(progress, (p) => `calc(2 * ${irisRadius(p, 34)})`);
  const height = useTransform(progress, (p) => `calc(2 * ${irisRadius(p, 34)} * ${torusTilt(p).toFixed(3)})`);
  const opacity = useOverlayOpacity(progress);
  return (
    <>
      <motion.span className="mo-journey-ring is-torus" style={{ width, height, opacity }} />
      <motion.span className="mo-journey-ring is-torus-inner" style={{ width, height, opacity }} />
    </>
  );
};

/* ---------------- Plano: escaneo, marco con esquinas y retícula ---------------- */

const BlueprintFrame = ({ progress }: { progress: MotionValue<number> }) => {
  const top = useTransform(progress, (p) => `${blueprintInset(p).top.toFixed(2)}%`);
  const side = useTransform(progress, (p) => `${blueprintInset(p).side.toFixed(2)}%`);
  const gridOpacity = useTransform(
    progress,
    [JOURNEY_OPEN[0], JOURNEY_OPEN[0] + 0.08, JOURNEY_COVER[0], JOURNEY_COVER[0] + 0.1],
    [0, 0.55, 0.55, 0],
  );
  const frameOpacity = useOverlayOpacity(progress, 0.16);
  return (
    <>
      <motion.span className="mo-journey-grid" style={{ opacity: gridOpacity }} />
      <motion.span
        className="mo-journey-frame"
        style={{ top, bottom: top, left: side, right: side, opacity: frameOpacity }}
      />
    </>
  );
};

/* ---------------- Horizonte: el borde de un planeta que amanece ---------------- */

const HorizonRim = ({ progress }: { progress: MotionValue<number> }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const lineRef = useRef<SVGCircleElement>(null);
  const opacity = useOverlayOpacity(progress, 0.12);

  // Se dibuja en píxeles reales para que el arco coincida con el recorte
  const draw = (p: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const vmax = Math.max(window.innerWidth, window.innerHeight) / 100;
    const { vh, vmax: lift } = horizonRise(p);
    const r = HORIZON_R * vmax;
    const cy = height + r - (vh * window.innerHeight) / 100 - lift * vmax;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    for (const circle of [glowRef.current, lineRef.current]) {
      circle?.setAttribute('cx', `${width / 2}`);
      circle?.setAttribute('cy', `${cy}`);
      circle?.setAttribute('r', `${r}`);
    }
  };
  useMotionValueEvent(progress, 'change', draw);
  useEffect(() => {
    draw(progress.get());
    const onResize = () => draw(progress.get());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // draw solo lee refs y el progreso actual: basta con re-suscribir por progreso
  }, [progress]);

  return (
    <motion.svg ref={svgRef} className="mo-journey-horizon" style={{ opacity }} aria-hidden="true">
      <circle ref={glowRef} className="is-glow" fill="none" />
      <circle ref={lineRef} className="is-line" fill="none" />
    </motion.svg>
  );
};

/* ---------------- Estrella: rayos que crecen y un resplandor que deja entrar ---------------- */

const RAYS = Array.from({ length: 30 }, (_, index) => {
  const angle = (index / 30) * Math.PI * 2 + seeded(index) * 0.18;
  const length = 34 + seeded(index + 40) * 60;
  // Nacen en el borde de la ventana: rodean la imagen sin cruzarla
  return { angle, from: 46, to: 46 + length * 0.75, width: 0.18 + seeded(index + 80) * 0.22 };
});

const Starburst = ({ progress }: { progress: MotionValue<number> }) => {
  const scale = useTransform(progress, [JOURNEY_OPEN[0], JOURNEY_OPEN[1], JOURNEY_COVER[1]], [0.08, 1, 2.6]);
  const rotate = useTransform(progress, [0, JOURNEY_COVER[1]], [0, 38]);
  const opacity = useOverlayOpacity(progress, 0.12);
  const glare = useTransform(
    progress,
    [JOURNEY_COVER[0] - 0.02, JOURNEY_COVER[0] + 0.06, JOURNEY_COVER[0] + 0.17],
    [0, 0.8, 0],
  );
  return (
    <>
      <motion.svg className="mo-journey-burst" viewBox="-100 -100 200 200" style={{ scale, rotate, opacity }} aria-hidden="true">
        {RAYS.map((ray, index) => (
          <line
            key={index}
            x1={Math.cos(ray.angle) * ray.from}
            y1={Math.sin(ray.angle) * ray.from}
            x2={Math.cos(ray.angle) * ray.to}
            y2={Math.sin(ray.angle) * ray.to}
            strokeWidth={ray.width}
          />
        ))}
      </motion.svg>
      <motion.span className="mo-journey-glare" style={{ opacity: glare }} />
    </>
  );
};

/* ---------------- Hiperespacio: estelas que pasan de largo ---------------- */

const STREAKS = Array.from({ length: 46 }, (_, index) => {
  const angle = seeded(index + 7) * Math.PI * 2;
  const from = 44 + seeded(index + 21) * 34;
  return { angle, from, to: from + 12 + seeded(index + 55) * 34, width: 0.16 + seeded(index + 90) * 0.24 };
});

const Hyperspace = ({ progress }: { progress: MotionValue<number> }) => {
  const scale = useTransform(progress, [JOURNEY_OPEN[0], JOURNEY_OPEN[1], JOURNEY_COVER[1]], [0.25, 1.2, 3.6]);
  const opacity = useOverlayOpacity(progress, 0.15);
  return (
    <motion.svg className="mo-journey-streaks" viewBox="-100 -100 200 200" style={{ scale, opacity }} aria-hidden="true">
      {STREAKS.map((streak, index) => (
        <line
          key={index}
          x1={Math.cos(streak.angle) * streak.from}
          y1={Math.sin(streak.angle) * streak.from}
          x2={Math.cos(streak.angle) * streak.to}
          y2={Math.sin(streak.angle) * streak.to}
          strokeWidth={streak.width}
        />
      ))}
    </motion.svg>
  );
};

/* ---------------- Galaxia: una espiral de estrellas que se abre desde el núcleo ---------------- */

const Galaxy = ({ progress }: { progress: MotionValue<number> }) => {
  const stars = useMemo(
    () =>
      Array.from({ length: 170 }, (_, index) => {
        const arm = index % 2;
        const t = Math.floor(index / 2) / 85;
        const angle = arm * Math.PI + t * Math.PI * 3.3 + (seeded(index) - 0.5) * 0.5;
        const radius = 5 + t * 88 + (seeded(index + 300) - 0.5) * 9;
        return {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          r: 0.35 + seeded(index + 600) * 0.95 * (1 - t * 0.5),
          o: 0.35 + (1 - t) * 0.55 * seeded(index + 900),
        };
      }),
    [],
  );
  const scale = useTransform(progress, [JOURNEY_OPEN[0], JOURNEY_OPEN[1], JOURNEY_COVER[1]], [0.06, 1, 3]);
  const rotate = useTransform(progress, [0, JOURNEY_COVER[1]], [-30, 70]);
  const opacity = useOverlayOpacity(progress, 0.14);
  return (
    <span className="mo-journey-galaxy" aria-hidden="true">
      <motion.svg viewBox="-100 -100 200 200" style={{ scale, rotate, opacity }}>
        <circle className="is-core" r="12" />
        {stars.map((star, index) => (
          <circle key={index} cx={star.x} cy={star.y} r={star.r} opacity={star.o} />
        ))}
      </motion.svg>
    </span>
  );
};

/* Capa decorativa del viaje, encima de la imagen y bajo el número */
export const JourneyOverlay = ({ kind, progress }: { kind: JourneyKind; progress: MotionValue<number> }) => {
  switch (kind) {
    case 'torus':
      return <TorusRims progress={progress} />;
    case 'blueprint':
      return <BlueprintFrame progress={progress} />;
    case 'horizon':
      return <HorizonRim progress={progress} />;
    case 'starburst':
      return (
        <>
          <IrisRing progress={progress} />
          <Starburst progress={progress} />
        </>
      );
    case 'hyperspace':
      return (
        <>
          <IrisRing progress={progress} />
          <Hyperspace progress={progress} />
        </>
      );
    case 'galaxy':
      return <Galaxy progress={progress} />;
    default:
      return <IrisRing progress={progress} />;
  }
};
