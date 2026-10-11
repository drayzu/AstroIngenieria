import { useEffect, useMemo, useRef } from 'react';
import { motion, useMotionValueEvent, useTransform, type MotionValue } from 'framer-motion';

/* Viajes de los portales: cada capítulo abre su ventana de una forma
   distinta, siempre con trazos finos de luz. Comparten el mismo guion:
   la ventana se abre (OPEN) y luego cubre la pantalla (COVER). */

export type JourneyKind =
  | 'collapse'
  | 'iris'
  | 'torus'
  | 'blueprint'
  | 'horizon'
  | 'dyson'
  | 'starburst'
  | 'tunnel'
  | 'galaxy'
  | 'radar';

export const JOURNEY_OPEN: [number, number] = [0.02, 0.29];
export const JOURNEY_COVER: [number, number] = [0.34, 0.56];

const JOURNEYS: Record<string, JourneyKind> = {
  // De la portada a la primera sala: la estrella vuelve a ser el punto de luz
  intro: 'collapse',
  habitats: 'torus',
  infrastructure: 'blueprint',
  planetary: 'horizon',
  energy: 'dyson',
  propulsion: 'tunnel',
  stellar: 'starburst',
  civilizations: 'galaxy',
  search: 'radar',
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

/* Colapso: la luz se condensa en un punto, el punto destella y recién
   entonces se abre la ventana, primero en vmin y luego cubriendo */
const COLLAPSE = { gather: [0.02, 0.15], flare: [0.13, 0.24], open: [0.2, 0.31] } satisfies Record<string, [number, number]>;
const collapseRadius = (p: number) => {
  if (p < COLLAPSE.open[0]) return '0px';
  const min = 30 * easeOut(seg(p, COLLAPSE.open));
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
    case 'collapse':
      return `circle(${collapseRadius(p)} at 50% 50%)`;
    default:
      return `circle(${irisRadius(p)} at 50% 50%)`;
  }
};

/* Intensidad del salto del cielo durante el viaje */
export const journeyWarp = (kind: JourneyKind) => (kind === 'tunnel' ? 2.2 : 1);

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

/* ---------------- Colapso: la luz se condensa en el punto de partida ---------------- */

const StarCollapse = ({ progress }: { progress: MotionValue<number> }) => {
  // Un resplandor tenue se recoge hacia el centro mientras nace el punto
  const gatherScale = useTransform(progress, (p) => 1 - 0.94 * easeInOut(seg(p, COLLAPSE.gather)));
  const gatherOpacity = useTransform(progress, [COLLAPSE.gather[0], COLLAPSE.gather[0] + 0.05, COLLAPSE.gather[1], COLLAPSE.flare[0] + 0.04], [0, 0.55, 0.9, 0]);
  const pointScale = useTransform(progress, [COLLAPSE.gather[0], COLLAPSE.gather[1]], [0, 1]);
  const pointOpacity = useTransform(progress, [COLLAPSE.gather[0], COLLAPSE.gather[0] + 0.06, COLLAPSE.open[0] + 0.02, COLLAPSE.open[1]], [0, 1, 1, 0]);
  // El punto destella con su destello anamórfico justo antes de abrirse
  const flareOpacity = useTransform(progress, [COLLAPSE.flare[0], COLLAPSE.flare[0] + 0.03, COLLAPSE.open[0] + 0.02, COLLAPSE.open[1]], [0, 1, 1, 0]);
  const flareScale = useTransform(progress, [COLLAPSE.flare[0], COLLAPSE.open[0], COLLAPSE.open[1]], [0.2, 1, 1.8]);
  const ringSize = useTransform(progress, (p) => `calc(2 * ${collapseRadius(p)})`);
  const ringOpacity = useTransform(progress, [COLLAPSE.open[0], COLLAPSE.open[0] + 0.03, JOURNEY_COVER[0], JOURNEY_COVER[0] + 0.12], [0, 1, 1, 0]);
  return (
    <span className="mo-journey-collapse" aria-hidden="true">
      <motion.span className="mo-journey-collapse-gather" style={{ scale: gatherScale, opacity: gatherOpacity }} />
      <motion.span className="mo-journey-collapse-flare" style={{ opacity: flareOpacity, scaleX: flareScale }} />
      <motion.span className="mo-journey-collapse-point" style={{ opacity: pointOpacity, scale: pointScale }} />
      <motion.span className="mo-journey-ring" style={{ width: ringSize, height: ringSize, opacity: ringOpacity }} />
    </span>
  );
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

/* ---------------- Enjambre de Dyson: colectores en órbitas inclinadas ---------------- */

const DYSON_ORBITS = [
  { tilt: -18, squash: 0.3, radius: 60, count: 10, speed: 1 },
  { tilt: 26, squash: 0.36, radius: 72, count: 12, speed: -0.72 },
  { tilt: 4, squash: 0.22, radius: 86, count: 9, speed: 0.5 },
];

const DysonSwarm = ({ progress }: { progress: MotionValue<number> }) => {
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const scale = useTransform(progress, [JOURNEY_OPEN[0], JOURNEY_OPEN[1], JOURNEY_COVER[1]], [0.18, 1, 2.3]);
  const opacity = useOverlayOpacity(progress, 0.13);

  // Cada colector recorre su elipse; los que pasan por detrás de la
  // estrella se apagan para dar profundidad
  const place = (p: number) => {
    let index = 0;
    for (const orbit of DYSON_ORBITS) {
      const tilt = (orbit.tilt * Math.PI) / 180;
      for (let k = 0; k < orbit.count; k += 1) {
        const dot = dotRefs.current[index];
        index += 1;
        if (!dot) continue;
        const theta = (k / orbit.count) * Math.PI * 2 + p * orbit.speed * Math.PI * 2.4;
        const x = Math.cos(theta) * orbit.radius;
        const y = Math.sin(theta) * orbit.radius * orbit.squash;
        dot.setAttribute('cx', (x * Math.cos(tilt) - y * Math.sin(tilt)).toFixed(2));
        dot.setAttribute('cy', (x * Math.sin(tilt) + y * Math.cos(tilt)).toFixed(2));
        dot.setAttribute('opacity', Math.sin(theta) > 0 ? '1' : '0.3');
      }
    }
  };
  useMotionValueEvent(progress, 'change', place);
  useEffect(() => place(progress.get()));

  let dotIndex = 0;
  return (
    <motion.svg className="mo-journey-dyson" viewBox="-100 -100 200 200" style={{ scale, opacity }} aria-hidden="true">
      {DYSON_ORBITS.map((orbit) => (
        <g key={orbit.tilt}>
          <ellipse rx={orbit.radius} ry={orbit.radius * orbit.squash} transform={`rotate(${orbit.tilt})`} />
          {Array.from({ length: orbit.count }, () => {
            const index = dotIndex;
            dotIndex += 1;
            return (
              <circle
                key={index}
                r={1.1}
                ref={(element) => {
                  dotRefs.current[index] = element;
                }}
              />
            );
          })}
        </g>
      ))}
    </motion.svg>
  );
};

/* ---------------- Hiperespacio: las estrellas se estiran en estelas ---------------- */

const WARP_STREAKS = Array.from({ length: 110 }, (_, index) => ({
  angle: seeded(index + 501) * Math.PI * 2,
  phase: seeded(index + 777),
  speed: 0.75 + seeded(index + 913) * 0.6,
  width: 0.12 + seeded(index + 1201) * 0.22,
}));

const WarpTunnel = ({ progress }: { progress: MotionValue<number> }) => {
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);

  // Al principio son estrellas que se alejan despacio del centro; con el
  // scroll el salto acelera y cada una se estira en una estela larga
  const place = (p: number) => {
    const envelope =
      seg(p, [JOURNEY_OPEN[0], JOURNEY_OPEN[0] + 0.06]) * (1 - seg(p, [JOURNEY_COVER[0], JOURNEY_COVER[0] + 0.14]));
    const jump = easeInOut(seg(p, [JOURNEY_OPEN[0] + 0.04, JOURNEY_COVER[0]]));
    // Las estelas nacen en el borde de la ventana: rodean la imagen sin cruzarla
    const vmin = Math.min(window.innerWidth, window.innerHeight) / 100;
    const vmax = Math.max(window.innerWidth, window.innerHeight) / 100;
    const unit = Math.min(150 * vmax, 2200) / 200;
    const windowMin = 0.7 + 29.3 * easeOut(seg(p, JOURNEY_OPEN));
    const windowMax = 76 * easeInOut(seg(p, JOURNEY_COVER));
    const inner = Math.max(10, (windowMin * vmin + windowMax * vmax) / unit + 2);
    WARP_STREAKS.forEach((streak, index) => {
      const line = lineRefs.current[index];
      if (!line) return;
      const travel = (streak.phase + p * streak.speed * (2.2 + jump * 3)) % 1;
      // Perspectiva: cerca del centro avanzan lento, en los bordes salen disparadas
      const near = inner + 140 * travel ** 2.4;
      const length = (0.6 + jump * 46) * (0.25 + travel) * streak.speed;
      const far = near + length;
      const cos = Math.cos(streak.angle);
      const sin = Math.sin(streak.angle);
      line.setAttribute('x1', (cos * near).toFixed(2));
      line.setAttribute('y1', (sin * near).toFixed(2));
      line.setAttribute('x2', (cos * far).toFixed(2));
      line.setAttribute('y2', (sin * far).toFixed(2));
      line.setAttribute('stroke-width', (streak.width * (0.5 + travel * 1.1)).toFixed(3));
      line.setAttribute('opacity', (Math.sin(Math.PI * travel) * envelope).toFixed(3));
    });
  };
  useMotionValueEvent(progress, 'change', place);
  useEffect(() => place(progress.get()));

  return (
    <svg className="mo-journey-tunnel" viewBox="-100 -100 200 200" aria-hidden="true">
      <defs>
        {/* Corrimiento Doppler: azul hacia donde vas, rojo en lo que queda atrás */}
        <radialGradient id="mo-warp-doppler" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="120">
          <stop offset="0.1" stopColor="#cfe6ff" stopOpacity="0" />
          <stop offset="0.22" stopColor="#e4f1ff" stopOpacity="0.95" />
          <stop offset="0.5" style={{ stopColor: 'var(--accent, #7aa7ff)' }} stopOpacity="0.9" />
          <stop offset="0.85" stopColor="#ff9a7a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff6a5a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {WARP_STREAKS.map((_, index) => (
        <line
          key={index}
          ref={(element) => {
            lineRefs.current[index] = element;
          }}
        />
      ))}
    </svg>
  );
};

/* ---------------- Radar: un barrido que escanea el cielo buscando señales ---------------- */

const RADAR_BLIPS = Array.from({ length: 7 }, (_, index) => ({
  angle: seeded(index + 13) * 360,
  distance: 32 + seeded(index + 44) * 16,
}));
const RADAR_TURNS = 2;

const RadarSweep = ({ progress }: { progress: MotionValue<number> }) => {
  const blipRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const rotate = useTransform(progress, [0, JOURNEY_COVER[1]], [0, 360 * RADAR_TURNS]);
  const scale = useTransform(progress, [JOURNEY_OPEN[0], JOURNEY_OPEN[1], JOURNEY_COVER[1]], [0.3, 1, 2.1]);
  const opacity = useOverlayOpacity(progress, 0.14);

  // Una señal se enciende cuando el barrido pasa por ella y se apaga después
  useMotionValueEvent(rotate, 'change', (angle) => {
    RADAR_BLIPS.forEach((blip, index) => {
      const behind = (((angle - blip.angle) % 360) + 360) % 360;
      const glow = behind < 70 ? 1 - behind / 70 : 0;
      const element = blipRefs.current[index];
      if (element) element.style.opacity = glow.toFixed(3);
    });
  });

  return (
    <motion.span className="mo-journey-radar" style={{ scale, opacity }} aria-hidden="true">
      <i className="is-range" />
      <i className="is-range is-far" />
      <motion.i className="is-sweep" style={{ rotate }} />
      {RADAR_BLIPS.map((blip, index) => (
        <span
          key={index}
          className="is-blip"
          style={{
            left: `${50 + Math.sin((blip.angle * Math.PI) / 180) * blip.distance}%`,
            top: `${50 - Math.cos((blip.angle * Math.PI) / 180) * blip.distance}%`,
          }}
          ref={(element) => {
            blipRefs.current[index] = element;
          }}
        />
      ))}
    </motion.span>
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
    case 'collapse':
      return <StarCollapse progress={progress} />;
    case 'torus':
      return <TorusRims progress={progress} />;
    case 'blueprint':
      return <BlueprintFrame progress={progress} />;
    case 'horizon':
      return <HorizonRim progress={progress} />;
    case 'dyson':
      return (
        <>
          <IrisRing progress={progress} />
          <DysonSwarm progress={progress} />
        </>
      );
    case 'starburst':
      return (
        <>
          <IrisRing progress={progress} />
          <Starburst progress={progress} />
        </>
      );
    case 'tunnel':
      return (
        <>
          <IrisRing progress={progress} />
          <WarpTunnel progress={progress} />
        </>
      );
    case 'galaxy':
      return <Galaxy progress={progress} />;
    case 'radar':
      return (
        <>
          <IrisRing progress={progress} />
          <RadarSweep progress={progress} />
        </>
      );
    default:
      return <IrisRing progress={progress} />;
  }
};
