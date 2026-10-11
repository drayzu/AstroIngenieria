import { useCallback, useEffect, useRef, useState } from 'react';
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
  | 'signal';

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
  search: 'signal',
};

export const journeyFor = (chapterId: string): JourneyKind => JOURNEYS[chapterId] ?? 'iris';

/* Tramos que un viaje quiere vivir más despacio: el portal crece `extra`
   (en svh sobre los 300 de siempre) y ese scroll se gasta en su tramo.
   La señal alarga las vueltas de búsqueda del radar y el mensaje */
interface JourneyHold { range: [number, number]; extra: number }
const JOURNEY_HOLDS: Partial<Record<JourneyKind, JourneyHold[]>> = {
  signal: [
    { range: [0.03, 0.17], extra: 170 },
    { range: [0.18, 0.32], extra: 70 },
  ],
};
// Recorrido normal del portal: 300svh de alto menos la pantalla fija
const PORTAL_TRAVEL = 200;

export const journeyExtra = (kind: JourneyKind) =>
  (JOURNEY_HOLDS[kind] ?? []).reduce((total, hold) => total + hold.extra, 0);

// Del avance real del scroll al tiempo del guion, que estira solo los tramos lentos
export const journeyTime = (kind: JourneyKind, value: number) => {
  const holds = JOURNEY_HOLDS[kind];
  if (!holds) return value;
  const distance = value * (PORTAL_TRAVEL + journeyExtra(kind));
  let time = 0;
  let walked = 0;
  for (const { range: [from, to], extra } of holds) {
    const plain = (from - time) * PORTAL_TRAVEL;
    if (distance <= walked + plain) return time + (distance - walked) / PORTAL_TRAVEL;
    walked += plain;
    const slow = (to - from) * PORTAL_TRAVEL + extra;
    if (distance <= walked + slow) return from + ((distance - walked) / slow) * (to - from);
    walked += slow;
    time = to;
  }
  return time + (distance - walked) / PORTAL_TRAVEL;
};

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
interface RadiusParts { min: number; max: number }
const irisParts = (p: number, windowSize = 30): RadiusParts => ({
  min: 0.7 + (windowSize - 0.7) * easeOut(seg(p, JOURNEY_OPEN)),
  max: 76 * easeInOut(seg(p, JOURNEY_COVER)),
});
const cssRadius = ({ min, max }: RadiusParts) => `calc(${min.toFixed(3)}vmin + ${max.toFixed(3)}vmax)`;
const irisRadius = (p: number, windowSize = 30) => cssRadius(irisParts(p, windowSize));
// El mismo radio en píxeles, para dibujar justo sobre el borde del recorte
const toPx = ({ min, max }: RadiusParts) => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  return (min * Math.min(width, height) + max * Math.max(width, height)) / 100;
};

/* Enjambre de Dyson: los paneles se ensamblan alrededor de la estrella y
   solo después, con la luz ya capturada, se abre la ventana */
const DYSON = { gather: [0.02, 0.17], open: [0.15, 0.31] } satisfies Record<string, [number, number]>;
const dysonParts = (p: number): RadiusParts => ({
  min: 30 * easeOut(seg(p, DYSON.open)),
  max: 76 * easeInOut(seg(p, JOURNEY_COVER)),
});

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

/* Horizonte: primero un planeta entero que nace de un punto; luego caemos
   hacia él y su borde se aplana hasta volverse el horizonte. En píxeles,
   compartido por el recorte y el dibujo */
const HORIZON_APPROACH: [number, number] = [0.12, JOURNEY_OPEN[1]];
const planetCircle = (p: number, width: number, height: number) => {
  const vmin = Math.min(width, height) / 100;
  const vmax = Math.max(width, height) / 100;
  const big = HORIZON_R * vmax;
  if (p >= JOURNEY_OPEN[1]) {
    const { vh, vmax: lift } = horizonRise(p);
    return { r: big, cy: height + big - (vh * height) / 100 - lift * vmax };
  }
  const small = 13 * vmin * easeOut(seg(p, [JOURNEY_OPEN[0], 0.1]));
  const approach = easeInOut(seg(p, HORIZON_APPROACH));
  if (approach <= 0 || small <= 0) return { r: small, cy: height / 2 };
  // El tamaño crece en escala geométrica: se siente como caer, no como estirar
  const r = small * (big / small) ** approach;
  const top = height / 2 - small + (height * 0.56 - (height / 2 - small)) * approach;
  return { r, cy: top + r };
};

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
      const { r, cy } = planetCircle(p, window.innerWidth, window.innerHeight);
      return `circle(${r.toFixed(1)}px at 50% ${cy.toFixed(1)}px)`;
    }
    case 'galaxy': {
      // La ventana espera a que la galaxia quede de frente: se abre en su núcleo
      const min = 22 * easeOut(seg(p, GALAXY.window));
      const max = 76 * easeInOut(seg(p, JOURNEY_COVER));
      return `circle(${cssRadius({ min, max })} at 50% 50%)`;
    }
    case 'collapse':
      return `circle(${collapseRadius(p)} at 50% 50%)`;
    case 'dyson':
      return `circle(${cssRadius(dysonParts(p))} at 50% 50%)`;
    case 'signal':
      return `circle(${cssRadius(signalParts(p))} at 50% 50%)`;
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

/* Lienzo SVG del tamaño del escenario con el origen en el centro: los
   viajes dibujan en píxeles reales para coincidir con el recorte */
const useStageSvg = (progress: MotionValue<number>, draw: (p: number, width: number, height: number) => void) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const size = useRef({ width: 1, height: 1 });
  const run = useCallback((p: number) => draw(p, size.current.width, size.current.height), [draw]);
  useMotionValueEvent(progress, 'change', run);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      size.current = { width: svg.clientWidth || 1, height: svg.clientHeight || 1 };
      const { width, height } = size.current;
      svg.setAttribute('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`);
      run(progress.get());
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [progress, run]);
  return svgRef;
};

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

/* ---------------- Toroide: un hábitat que gira y se cruza por su centro ---------------- */

const TORUS_RIBS = 60;
const TORUS_SPOKES = 6;

const HabitatTorus = ({ progress }: { progress: MotionValue<number> }) => {
  const bandRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGEllipseElement>(null);
  const innerRef = useRef<SVGEllipseElement>(null);
  const outerRef = useRef<SVGEllipseElement>(null);
  const ribRefs = useRef<(SVGLineElement | null)[]>([]);
  const spokeRefs = useRef<(SVGLineElement | null)[]>([]);
  const opacity = useOverlayOpacity(progress, 0.14);

  // El hueco del anillo es la ventana: el borde interior coincide con el
  // recorte. Las costillas giran con el scroll y las de atrás se apagan
  const draw = useCallback((p: number) => {
    const rx = toPx(irisParts(p, 34));
    const tilt = torusTilt(p);
    const ry = rx * tilt;
    const ox = rx * 1.34;
    const oy = ox * tilt;
    const ellipse = (x: number, y: number, sweep: 0 | 1) =>
      `M ${x} 0 A ${x} ${y} 0 1 ${sweep} ${-x} 0 A ${x} ${y} 0 1 ${sweep} ${x} 0 Z`;
    bandRef.current?.setAttribute('d', `${ellipse(ox, oy, 0)} ${ellipse(rx, ry, 1)}`);
    for (const node of [glowRef.current, innerRef.current]) {
      node?.setAttribute('rx', rx.toFixed(1));
      node?.setAttribute('ry', ry.toFixed(1));
    }
    outerRef.current?.setAttribute('rx', ox.toFixed(1));
    outerRef.current?.setAttribute('ry', oy.toFixed(1));

    const spin = p * Math.PI * 2 * 1.3;
    ribRefs.current.forEach((rib, index) => {
      if (!rib) return;
      const angle = (index / TORUS_RIBS) * Math.PI * 2 + spin;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      rib.setAttribute('x1', (cos * rx).toFixed(1));
      rib.setAttribute('y1', (sin * ry).toFixed(1));
      rib.setAttribute('x2', (cos * ox).toFixed(1));
      rib.setAttribute('y2', (sin * oy).toFixed(1));
      // Abajo es el lado cercano: brilla; arriba queda en sombra
      rib.setAttribute('opacity', (sin > 0 ? 0.3 + 0.6 * sin : 0.14).toFixed(3));
    });
    // Los radios se ven mientras el anillo está de canto y se apartan al cruzarlo
    const spokes = 0.55 * (1 - seg(p, [0.12, 0.27]));
    spokeRefs.current.forEach((spoke, index) => {
      if (!spoke) return;
      const angle = (index / TORUS_SPOKES) * Math.PI * 2 + spin;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      spoke.setAttribute('x1', (cos * rx * 0.08).toFixed(1));
      spoke.setAttribute('y1', (sin * ry * 0.08).toFixed(1));
      spoke.setAttribute('x2', (cos * rx).toFixed(1));
      spoke.setAttribute('y2', (sin * ry).toFixed(1));
      spoke.setAttribute('opacity', (spokes * (sin > 0 ? 1 : 0.45)).toFixed(3));
    });
  }, []);
  const svgRef = useStageSvg(progress, draw);

  return (
    <motion.svg ref={svgRef} className="mo-journey-stage is-torus" style={{ opacity }} aria-hidden="true">
      <defs>
        <linearGradient id="mo-torus-band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--accent)' }} stopOpacity="0.04" />
          <stop offset="0.5" style={{ stopColor: 'var(--accent)' }} stopOpacity="0.1" />
          <stop offset="1" style={{ stopColor: 'var(--accent)' }} stopOpacity="0.34" />
        </linearGradient>
      </defs>
      <path ref={bandRef} className="is-band" fillRule="evenodd" />
      {Array.from({ length: TORUS_SPOKES }, (_, index) => (
        <line key={`s${index}`} className="is-spoke" ref={(element) => { spokeRefs.current[index] = element; }} />
      ))}
      {Array.from({ length: TORUS_RIBS }, (_, index) => (
        <line key={`r${index}`} className="is-rib" ref={(element) => { ribRefs.current[index] = element; }} />
      ))}
      <ellipse ref={outerRef} className="is-rim is-outer" />
      <ellipse ref={glowRef} className="is-glow" />
      <ellipse ref={innerRef} className="is-rim" />
    </motion.svg>
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

/* ---------------- Horizonte: del planeta entero a su superficie ---------------- */

const PLASMA_STREAKS = Array.from({ length: 70 }, (_, index) => ({
  angle: (seeded(index + 3301) - 0.5) * 1.9,
  phase: seeded(index + 3407),
  width: 0.8 + seeded(index + 3511) * 1.4,
}));

const HorizonRim = ({ progress }: { progress: MotionValue<number> }) => {
  const glowRef = useRef<SVGCircleElement>(null);
  const lineRef = useRef<SVGCircleElement>(null);
  const gleamRef = useRef<SVGCircleElement>(null);
  const shadeRef = useRef<SVGCircleElement>(null);
  const heatRefs = useRef<(SVGCircleElement | null)[]>([]);
  const plasmaRefs = useRef<(SVGLineElement | null)[]>([]);
  const planetMaskRef = useRef<SVGCircleElement>(null);
  const dustRef = useRef<SVGCircleElement>(null);
  const lushRef = useRef<SVGCircleElement>(null);
  const dustGradientRef = useRef<SVGRadialGradientElement>(null);
  const lushGradientRef = useRef<SVGRadialGradientElement>(null);
  const dustStopRef = useRef<SVGStopElement>(null);
  const lushStopRef = useRef<SVGStopElement>(null);
  const sunRef = useRef<SVGGElement>(null);
  const sunCoreRef = useRef<SVGCircleElement>(null);
  const gleamGradientRef = useRef<SVGRadialGradientElement>(null);
  const flareRef = useRef<SVGLineElement>(null);
  const flareGlowRef = useRef<SVGLineElement>(null);
  const flareGradientRef = useRef<SVGLinearGradientElement>(null);
  const opacity = useOverlayOpacity(progress, 0.12);

  // Se dibuja en píxeles reales sobre el mismo círculo que recorta la imagen
  const draw = useCallback((p: number, width: number, height: number) => {
    const planet = planetCircle(p, width, height);
    const r = Math.max(0.5, planet.r);
    const cy = planet.cy - height / 2;
    const base = Math.min(width, height);
    const approach = easeInOut(seg(p, HORIZON_APPROACH));
    for (const circle of [glowRef.current, lineRef.current, gleamRef.current, shadeRef.current, ...heatRefs.current]) {
      circle?.setAttribute('cy', cy.toFixed(1));
      circle?.setAttribute('r', r.toFixed(1));
    }
    planetMaskRef.current?.setAttribute('cy', cy.toFixed(1));
    planetMaskRef.current?.setAttribute('r', Math.max(0, r - 1).toFixed(1));
    // Visto desde lejos es una esfera: luz arriba a la izquierda y noche abajo
    shadeRef.current?.setAttribute('opacity', (1 - approach).toFixed(3));

    // Atmósfera: polvo fino y anaranjado que con la terraformación se vuelve
    // espeso y del color del capítulo
    const terraform = easeInOut(seg(p, [0.06, 0.27]));
    const atmospheres = [
      { circle: dustRef.current, gradient: dustGradientRef.current, stop: dustStopRef.current, depth: Math.min(base * 0.05, r * 0.16), alpha: 1 - terraform * 0.85 },
      { circle: lushRef.current, gradient: lushGradientRef.current, stop: lushStopRef.current, depth: Math.min(base * (0.03 + terraform * 0.11), r * 0.3), alpha: terraform },
    ];
    for (const { circle, gradient, stop, depth, alpha } of atmospheres) {
      circle?.setAttribute('cy', cy.toFixed(1));
      circle?.setAttribute('r', (r + depth).toFixed(1));
      circle?.setAttribute('opacity', alpha.toFixed(3));
      gradient?.setAttribute('cy', cy.toFixed(1));
      gradient?.setAttribute('r', (r + depth).toFixed(1));
      stop?.setAttribute('offset', (r / (r + depth)).toFixed(4));
    }

    // Entrada atmosférica: mientras caemos, el borde arde y el plasma pasa a
    // nuestro lado hacia afuera
    const entry = Math.sin(Math.PI * seg(p, [0.15, 0.285])) ** 1.4;
    heatRefs.current.forEach((heat, index) => {
      heat?.setAttribute('stroke-width', (base * (index === 0 ? 0.05 : 0.008)).toFixed(1));
      heat?.setAttribute('opacity', (entry * (index === 0 ? 0.32 : 0.9)).toFixed(3));
    });
    PLASMA_STREAKS.forEach((streak, index) => {
      const line = plasmaRefs.current[index];
      if (!line) return;
      // Nacen pegadas al borde ardiente y se desprenden hacia afuera
      const travel = (streak.phase + p * 14) % 1;
      const near = r + base * 0.16 * travel ** 1.3;
      const far = near + base * (0.015 + 0.06 * entry) * (1 - travel * 0.5);
      const sin = Math.sin(streak.angle);
      const cos = Math.cos(streak.angle);
      line.setAttribute('x1', (sin * near).toFixed(1));
      line.setAttribute('y1', (cy - cos * near).toFixed(1));
      line.setAttribute('x2', (sin * far).toFixed(1));
      line.setAttribute('y2', (cy - cos * far).toFixed(1));
      line.setAttribute('stroke-width', streak.width.toFixed(2));
      line.setAttribute('opacity', (entry * (1 - travel) ** 1.5).toFixed(3));
    });

    // El sol es del espacio: asoma tras el planeta pequeño y se apaga al
    // entrar en la atmósfera; al aterrizar solo queda el horizonte
    const daylight = 1 - seg(p, [0.13, 0.19]);
    const angle = Math.asin(Math.max(-0.9, (-0.17 * width) / Math.max(r, 1)));
    const sun = base * 0.03;
    const rise = -2.6 * sun + 3.1 * sun * easeOut(seg(p, [0.08, 0.2]));
    const distance = r + rise;
    sunCoreRef.current?.setAttribute('r', (sun * 7).toFixed(1));
    sunRef.current?.setAttribute('opacity', daylight.toFixed(3));
    sunRef.current?.setAttribute('transform', `translate(${(distance * Math.sin(angle)).toFixed(1)} ${(cy - distance * Math.cos(angle)).toFixed(1)})`);
    const dawn = seg(p, [0.11, 0.18]);
    const flare = Math.max(Math.exp(-((rise / (1.1 * sun)) ** 2)), 0.5 * dawn) * daylight;
    const limbX = r * Math.sin(angle);
    const limbY = cy - r * Math.cos(angle);
    // El destello corre a lo largo del borde, tangente a él
    // Con el planeta pequeño el destello es corto: crece con el horizonte
    const reach = Math.min(width * 0.42, r * 1.6);
    const tx = Math.cos(angle) * reach;
    const ty = Math.sin(angle) * reach;
    const ends = { x1: limbX - tx, y1: limbY - ty, x2: limbX + tx, y2: limbY + ty };
    for (const [key, value] of Object.entries(ends)) {
      flareRef.current?.setAttribute(key, value.toFixed(1));
      flareGlowRef.current?.setAttribute(key, value.toFixed(1));
      flareGradientRef.current?.setAttribute(key, value.toFixed(1));
    }
    flareRef.current?.setAttribute('opacity', flare.toFixed(3));
    flareGlowRef.current?.setAttribute('opacity', (flare * 0.6).toFixed(3));
    gleamGradientRef.current?.setAttribute('cx', limbX.toFixed(1));
    gleamGradientRef.current?.setAttribute('cy', limbY.toFixed(1));
    gleamGradientRef.current?.setAttribute('r', (width * 0.32).toFixed(1));
    gleamRef.current?.setAttribute('opacity', (dawn * daylight).toFixed(3));
  }, []);
  const svgRef = useStageSvg(progress, draw);

  return (
    <motion.svg ref={svgRef} className="mo-journey-stage is-horizon" style={{ opacity }} aria-hidden="true">
      <defs>
        {/* Solo el cielo: lo que queda tras el planeta no se ve */}
        <mask id="mo-horizon-sky" maskUnits="userSpaceOnUse" x="-8000" y="-8000" width="16000" height="16000">
          <rect x="-8000" y="-8000" width="16000" height="16000" fill="#fff" />
          <circle ref={planetMaskRef} cx="0" fill="#000" />
        </mask>
        <radialGradient id="mo-horizon-shade" cx="0.5" cy="0.5" r="0.5" fx="0.32" fy="0.28">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="0.55" stopColor="#000" stopOpacity="0.12" />
          <stop offset="0.86" stopColor="#020403" stopOpacity="0.62" />
          <stop offset="1" stopColor="#020403" stopOpacity="0.9" />
        </radialGradient>
        <radialGradient id="mo-horizon-dust" ref={dustGradientRef} gradientUnits="userSpaceOnUse" cx="0">
          <stop ref={dustStopRef} stopColor="#ff9466" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ff9466" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mo-horizon-lush" ref={lushGradientRef} gradientUnits="userSpaceOnUse" cx="0">
          <stop ref={lushStopRef} style={{ stopColor: 'var(--accent)' }} stopOpacity="0.55" />
          <stop offset="1" stopColor="#7fb8ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mo-horizon-sun">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.12" stopColor="#fff6dc" />
          <stop offset="0.3" stopColor="#ffe2a8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffd28a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mo-horizon-gleam" ref={gleamGradientRef} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="0.35" stopColor="#fff2d6" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff2d6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mo-horizon-flare" ref={flareGradientRef} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff6e6" stopOpacity="0" />
          <stop offset="0.42" stopColor="#fff6e6" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="0.58" stopColor="#fff6e6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff6e6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle ref={shadeRef} cx="0" className="is-shade" />
      <g mask="url(#mo-horizon-sky)">
        <circle ref={dustRef} cx="0" fill="url(#mo-horizon-dust)" />
        <circle ref={lushRef} cx="0" fill="url(#mo-horizon-lush)" />
        <g ref={sunRef}>
          <circle ref={sunCoreRef} className="is-sun" fill="url(#mo-horizon-sun)" />
        </g>
        {PLASMA_STREAKS.map((_, index) => (
          <line key={index} className="is-plasma" ref={(element) => { plasmaRefs.current[index] = element; }} />
        ))}
      </g>
      <circle ref={glowRef} cx="0" className="is-glow" />
      {[0, 1].map((index) => (
        <circle key={index} cx="0" className={`is-heat is-heat-${index}`} ref={(element) => { heatRefs.current[index] = element; }} />
      ))}
      <circle ref={lineRef} cx="0" className="is-line" />
      <circle ref={gleamRef} cx="0" className="is-gleam" />
      <line ref={flareGlowRef} className="is-flare is-soft" />
      <line ref={flareRef} className="is-flare" />
    </motion.svg>
  );
};

/* ---------------- Agujero negro: la ventana es el otro lado ---------------- */

const BlackHole = ({ progress }: { progress: MotionValue<number> }) => {
  const haloRef = useRef<SVGCircleElement>(null);
  const photonRef = useRef<SVGCircleElement>(null);
  const holeMaskRef = useRef<SVGCircleElement>(null);
  const backRefs = useRef<(SVGPathElement | null)[]>([]);
  const frontRefs = useRef<(SVGPathElement | null)[]>([]);
  const streakRefs = useRef<(SVGPathElement | null)[]>([]);
  const opacity = useOverlayOpacity(progress, 0.14);

  // Anillo de fotones en el borde de la ventana, la luz lensada del disco
  // abrazándolo y el disco de acreción cruzando por delante. Las capas de
  // distinto grosor y opacidad hacen de resplandor sin filtros costosos
  const draw = useCallback((p: number) => {
    const r = Math.max(1, toPx(irisParts(p)));
    haloRef.current?.setAttribute('r', (r * 1.7).toFixed(1));
    photonRef.current?.setAttribute('r', (r + 0.5).toFixed(1));
    holeMaskRef.current?.setAttribute('r', (r * 1.08).toFixed(1));
    const a = r * 2.6;
    const b = r * 0.3;
    // Mitad cercana (abajo) y mitad lejana (arriba, oculta tras el horizonte)
    const front = `M ${-a} 0 A ${a} ${b} 0 0 0 ${a} 0`;
    const back = `M ${-a} 0 A ${a} ${b} 0 0 1 ${a} 0`;
    [0.34, 0.15, 0.045].forEach((width, index) => {
      frontRefs.current[index]?.setAttribute('d', front);
      frontRefs.current[index]?.setAttribute('stroke-width', (r * width).toFixed(1));
      backRefs.current[index]?.setAttribute('d', back);
      backRefs.current[index]?.setAttribute('stroke-width', (r * width * 0.7).toFixed(1));
    });
    // El material gira: estrías finas que corren a distinta velocidad
    [
      { width: 0.018, dash: 0.34, gap: 0.12, speed: 22 },
      { width: 0.012, dash: 0.14, gap: 0.3, speed: 34 },
    ].forEach((streak, index) => {
      const path = streakRefs.current[index];
      if (!path) return;
      path.setAttribute('d', front);
      path.setAttribute('stroke-width', (r * streak.width).toFixed(1));
      path.setAttribute('stroke-dasharray', `${(r * streak.dash).toFixed(1)} ${(r * streak.gap).toFixed(1)}`);
      path.setAttribute('stroke-dashoffset', (-p * r * streak.speed).toFixed(1));
    });
  }, []);
  const svgRef = useStageSvg(progress, draw);

  return (
    <motion.svg ref={svgRef} className="mo-journey-stage is-blackhole" style={{ opacity }} aria-hidden="true">
      <defs>
        {/* Efecto Doppler: el lado que se acerca brilla más */}
        <linearGradient id="mo-bh-disk" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: 'var(--accent)' }} stopOpacity="0" />
          <stop offset="0.18" style={{ stopColor: 'var(--accent)' }} stopOpacity="0.6" />
          <stop offset="0.38" stopColor="#fff6e8" stopOpacity="1" />
          <stop offset="0.55" stopColor="#ffd9b4" stopOpacity="0.85" />
          <stop offset="0.75" style={{ stopColor: 'var(--accent)' }} stopOpacity="0.45" />
          <stop offset="1" style={{ stopColor: 'var(--accent)' }} stopOpacity="0" />
        </linearGradient>
        {/* Luz del disco curvada por la gravedad: un halo pegado al horizonte */}
        <radialGradient id="mo-bh-halo">
          <stop offset="0.57" style={{ stopColor: 'var(--accent)' }} stopOpacity="0" />
          <stop offset="0.6" stopColor="#fff2de" stopOpacity="0.95" />
          <stop offset="0.63" style={{ stopColor: 'var(--accent)' }} stopOpacity="0.6" />
          <stop offset="0.72" style={{ stopColor: 'var(--accent)' }} stopOpacity="0.18" />
          <stop offset="1" style={{ stopColor: 'var(--accent)' }} stopOpacity="0" />
        </radialGradient>
        <mask id="mo-bh-hole" maskUnits="userSpaceOnUse" x="-6000" y="-6000" width="12000" height="12000">
          <rect x="-6000" y="-6000" width="12000" height="12000" fill="#fff" />
          <circle ref={holeMaskRef} fill="#000" />
        </mask>
      </defs>
      <circle ref={haloRef} className="is-halo" />
      <g transform="rotate(-8)">
        <g mask="url(#mo-bh-hole)" className="is-back">
          {[0, 1, 2].map((index) => (
            <path key={index} className={`is-disk is-layer-${index}`} ref={(element) => { backRefs.current[index] = element; }} />
          ))}
        </g>
        <circle ref={photonRef} className="is-photon" />
        {[0, 1, 2].map((index) => (
          <path key={index} className={`is-disk is-layer-${index}`} ref={(element) => { frontRefs.current[index] = element; }} />
        ))}
        {[0, 1].map((index) => (
          <path key={index} className="is-streaks" ref={(element) => { streakRefs.current[index] = element; }} />
        ))}
      </g>
    </motion.svg>
  );
};

/* ---------------- Enjambre de Dyson: los paneles eclipsan la estrella ---------------- */

// Muchos planos orbitales con pocas placas cada uno: el enjambre se lee
// como una nube alrededor de la estrella, no como elipses punteadas
const SWARM_PANELS = Array.from({ length: 18 }, (_, orbitIndex) => {
  const tilt = seeded(orbitIndex + 21) * 180 - 90;
  const squash = 0.12 + seeded(orbitIndex + 57) * 0.8;
  const radius = 1.55 + seeded(orbitIndex + 83) * 1.1;
  const speed = (0.45 + seeded(orbitIndex + 119) * 0.7) * (orbitIndex % 2 ? -1 : 1);
  return Array.from({ length: 12 }, (_, index) => ({
    tilt,
    squash,
    radius,
    speed,
    phase: (index + seeded(orbitIndex * 97 + index) * 0.8) / 12,
    // Orden de llegada: las placas se ensamblan en desorden
    rank: seeded(orbitIndex * 131 + index + 7),
    glint: seeded(orbitIndex * 53 + index + 3) * Math.PI * 2,
  }));
}).flat();

const DysonEclipse = ({ progress }: { progress: MotionValue<number> }) => {
  const starRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);
  const heatRef = useRef<SVGCircleElement>(null);
  const panelRefs = useRef<(SVGLineElement | null)[]>([]);
  const states = useRef<string[]>([]);
  const ringSize = useTransform(progress, (p) => `calc(2 * ${cssRadius(dysonParts(p))})`);
  const ringOpacity = useTransform(progress, [DYSON.open[0], DYSON.open[0] + 0.03, JOURNEY_COVER[0], JOURNEY_COVER[0] + 0.12], [0, 1, 1, 0]);
  const opacity = useOverlayOpacity(progress, 0.14);

  const draw = useCallback((p: number, width: number, height: number) => {
    const star = Math.min(width, height) * 0.085;
    const opened = toPx(dysonParts(p));
    const opening = seg(p, DYSON.open);
    // La luz capturada: la estrella pierde brillo y queda el calor rojo
    const captured = easeInOut(seg(p, [0.05, 0.17]));
    starRef.current?.setAttribute('r', star.toFixed(1));
    starRef.current?.setAttribute('opacity', ((1 - 0.6 * captured) * (1 - opening)).toFixed(3));
    haloRef.current?.setAttribute('r', (star * 3.2).toFixed(1));
    haloRef.current?.setAttribute('opacity', ((1 - 0.75 * captured) * (1 - opening)).toFixed(3));
    heatRef.current?.setAttribute('r', (star * 2.4).toFixed(1));
    heatRef.current?.setAttribute('opacity', (captured * 0.85 * (1 - opening)).toFixed(3));

    const assembled = easeOut(seg(p, DYSON.gather));
    const unit = Math.max(star, opened * 0.52);
    // Lo que tapa a los paneles de atrás: la estrella y luego la ventana
    const occluder = Math.max(star * (1 - opening), opened);
    SWARM_PANELS.forEach((panel, index) => {
      const line = panelRefs.current[index];
      if (!line) return;
      let state = 'is-hidden';
      if (panel.rank < assembled) {
        const theta = panel.phase * Math.PI * 2 + p * panel.speed * Math.PI * 2.2;
        const radius = panel.radius * unit;
        const ex = Math.cos(theta) * radius;
        const ey = Math.sin(theta) * radius * panel.squash;
        const tilt = (panel.tilt * Math.PI) / 180;
        const x = ex * Math.cos(tilt) - ey * Math.sin(tilt);
        const y = ex * Math.sin(tilt) + ey * Math.cos(tilt);
        // Cada panel se orienta según su órbita: se lee como placa, no como punto
        const tx = -Math.sin(theta) * radius;
        const ty = Math.cos(theta) * radius * panel.squash;
        const dx = tx * Math.cos(tilt) - ty * Math.sin(tilt);
        const dy = tx * Math.sin(tilt) + ty * Math.cos(tilt);
        const length = Math.hypot(dx, dy) || 1;
        const half = star * 0.065;
        line.setAttribute('x1', (x - (dx / length) * half).toFixed(1));
        line.setAttribute('y1', (y - (dy / length) * half).toFixed(1));
        line.setAttribute('x2', (x + (dx / length) * half).toFixed(1));
        line.setAttribute('y2', (y + (dy / length) * half).toFixed(1));
        const front = Math.sin(theta) > 0;
        const inside = Math.hypot(x, y) < occluder;
        // Sobre la estrella las de delante son siluetas; sobre la imagen, nada
        const eclipse = opening < 0.25;
        state = front ? (inside ? (eclipse ? 'is-shadow' : 'is-hidden') : 'is-front') : inside ? 'is-hidden' : 'is-back';
        // Destello: cada placa refleja la luz al girar
        line.setAttribute('stroke-opacity', state === 'is-front' ? (0.45 + 0.55 * Math.abs(Math.cos(theta * 1.5 + panel.glint))).toFixed(3) : '1');
      }
      if (states.current[index] !== state) {
        states.current[index] = state;
        line.setAttribute('class', state);
      }
    });
  }, []);
  const svgRef = useStageSvg(progress, draw);

  return (
    <>
      <motion.svg ref={svgRef} className="mo-journey-stage is-dyson" style={{ opacity }} aria-hidden="true">
        <defs>
          <radialGradient id="mo-dyson-star">
            <stop offset="0" stopColor="#fffdf6" />
            <stop offset="0.55" stopColor="#fff1cc" />
            <stop offset="0.85" style={{ stopColor: 'var(--accent)' }} />
            <stop offset="1" style={{ stopColor: 'var(--accent)' }} stopOpacity="0.6" />
          </radialGradient>
          <radialGradient id="mo-dyson-halo">
            <stop offset="0" style={{ stopColor: 'var(--accent)' }} stopOpacity="0.5" />
            <stop offset="0.4" style={{ stopColor: 'var(--accent)' }} stopOpacity="0.14" />
            <stop offset="1" style={{ stopColor: 'var(--accent)' }} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mo-dyson-heat">
            <stop offset="0" stopColor="#ff6a3c" stopOpacity="0.55" />
            <stop offset="0.5" stopColor="#c8321e" stopOpacity="0.2" />
            <stop offset="1" stopColor="#8a1a12" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle ref={haloRef} fill="url(#mo-dyson-halo)" />
        <circle ref={heatRef} fill="url(#mo-dyson-heat)" />
        <circle ref={starRef} fill="url(#mo-dyson-star)" />
        {SWARM_PANELS.map((_, index) => (
          <line key={index} className="is-hidden" ref={(element) => { panelRefs.current[index] = element; }} />
        ))}
      </motion.svg>
      <motion.span className="mo-journey-ring" style={{ width: ringSize, height: ringSize, opacity: ringOpacity }} />
    </>
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

/* ---------------- Señal: un radar que escucha radio hasta encontrar a alguien ---------------- */

/* Guion de la señal: nuestra propia radio se escapa al espacio; luego un
   radar rodea la ventana y su barrido deja tras de sí el ruido del cielo,
   como el fósforo de una pantalla. En cada vuelta asoma un eco, cada vez
   más claro; en la última frena sobre él y lo fija, y del eco brota un
   mensaje de píxeles: el retrato de quien lo envía, un planeta vivo con un
   brote y un anillo. Se mece un momento y se descifra en el número del
   capítulo; el número real aparece sobre él, la ventana se abre detrás y
   el radar queda rodeándola */
const SIGNAL = {
  bubble: [0.02, 0.16],
  scope: [0.03, 0.09],
  search: [0.03, 0.17],
  lock: [0.16, 0.2],
  dim: [0.17, 0.24],
  fold: [0.185, 0.235],
  decode: [0.25, 0.29],
  open: [0.285, 0.33],
  reveal: [0.295, 0.33],
  scatter: [0.3, 0.42],
} satisfies Record<string, [number, number]>;
// Dónde está el eco: ángulo desde arriba en sentido horario y distancia al
// centro en fracciones del radar
const ECHO = { angle: 58, reach: 0.36 };
// Estela del barrido: los grados que tarda el fósforo en apagarse
const AFTERGLOW = 140;

const signalParts = (p: number): RadiusParts => ({
  min: 30 * easeOut(seg(p, SIGNAL.open)),
  max: 76 * easeInOut(seg(p, JOURNEY_COVER)),
});

/* Vueltas de búsqueda: en cada una el barrido pasa sobre un eco que destella
   y se apaga; en la última frena hasta detenerse sobre él y lo confirma */
const SEARCH_TURNS = 5;
const sweepAngle = (p: number) =>
  ECHO.angle - 360 * SEARCH_TURNS * (1 - seg(p, SIGNAL.search)) ** 1.6;

// El radar se acerca al aparecer y se agranda al cubrir, rodeando la ventana
const scopeScale = (p: number) =>
  p < JOURNEY_OPEN[1]
    ? 0.85 + 0.15 * easeOut(seg(p, [SIGNAL.scope[0], SIGNAL.bubble[1]]))
    : 1 + 1.1 * easeInOut(seg(p, [JOURNEY_OPEN[1], JOURNEY_COVER[1]]));
const scopeSize = (width: number, height: number) => Math.min(1.2 * Math.min(width, height), 1100);

/* Planeta vivo: un mundo pequeño con ojos, un brote que le crece encima y
   un anillo que pasa por detrás. Vida, pero no un alien.
   Unidades: el radio del dibujo (y crece hacia abajo, como en pantalla) */
const ellipseReach = (x: number, y: number, cx: number, cy: number, rx: number, ry: number, tilt: number) => {
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  const u = (x - cx) * c + (y - cy) * s;
  const v = -(x - cx) * s + (y - cy) * c;
  return Math.hypot(u / rx, v / ry);
};
const inPlanet = (x: number, y: number) => {
  const r = Math.hypot(x, y);
  // El planeta y sus ojos (el derecho apenas menor)
  if (r < 0.72 && r > 0.58) return true;
  if (Math.hypot(x + 0.23, y - 0.05) < 0.1 || Math.hypot(x - 0.2, y - 0.08) < 0.092) return true;
  // El brote: un tallo que se mece y dos hojas
  if (y < -0.6 && y > -1.15 && Math.abs(x - Math.sin((y + 0.6) * 4) * 0.06) < 0.042) return true;
  if (ellipseReach(x, y, -0.24, -1.09, 0.24, 0.11, 0.45) < 1) return true;
  if (ellipseReach(x, y, 0.24, -1.21, 0.26, 0.12, -0.45) < 1) return true;
  // Un anillo fino que pasa por detrás del planeta
  const ring = ellipseReach(x, y, 0, 0, 1.3, 0.5, -0.45);
  return Math.abs(ring - 1) < 0.04 && r > 0.8;
};
// Exactamente `count` puntos del planeta: busca el paso de la rejilla que
// da al menos esa cantidad y quita el sobrante de forma pareja
const samplePlanet = (count: number) => {
  const pointsAt = (step: number) => {
    const points: { x: number; y: number }[] = [];
    for (let y = -1.6; y <= 1.6; y += step) {
      for (let x = -1.6; x <= 1.6; x += step) if (inPlanet(x, y)) points.push({ x, y });
    }
    return points;
  };
  let low = 0.02;
  let high = 0.25;
  for (let i = 0; i < 18; i += 1) {
    const mid = (low + high) / 2;
    if (pointsAt(mid).length >= count) low = mid;
    else high = mid;
  }
  const points = pointsAt(low);
  const extra = points.length - count;
  const kept = extra > 0 ? points.filter((_, index) => Math.floor(((index + 1) * extra) / points.length) === Math.floor((index * extra) / points.length)) : points;
  return { step: low, points: kept.slice(0, count) };
};

/* El mensaje termina siendo el número del capítulo en píxeles: se pixela el
   mismo número que dibuja el portal (su tipografía, tamaño y lugar), así el
   mensaje descifrado calza con él y el número real puede aparecer encima.
   Cada píxel del número se empareja con uno del planeta, por ángulo */
interface GlyphCell { x: number; y: number; px: number; py: number }
interface PixelGlyph { cell: number; planetCell: number; center: { x: number; y: number }; cells: GlyphCell[] }
const pixelateNumber = (svg: SVGSVGElement, label: string): PixelGlyph | null => {
  const number = svg.closest('.mo-portal-stage')?.querySelector<HTMLElement>('.mo-portal-no');
  if (!number || !label) return null;
  const style = getComputedStyle(number);
  const fontSize = Number.parseFloat(style.fontSize);
  const width = number.offsetWidth;
  const height = number.offsetHeight;
  if (!fontSize || !width || !height) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  // Misma línea base que el texto en CSS: el interlineado se reparte arriba y abajo
  ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  const metrics = ctx.measureText(label);
  const ascent = metrics.fontBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent;
  ctx.fillText(label, 0, (height - (ascent + descent)) / 2 + ascent);
  const ink = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const inked = (x: number, y: number) => {
    const px = Math.floor(x);
    const py = Math.floor(y);
    return px >= 0 && py >= 0 && px < canvas.width && py < canvas.height && ink[(py * canvas.width + px) * 4 + 3] > 128;
  };
  // El escalado del número es desde su centro: el centro de su caja no cambia
  const box = number.getBoundingClientRect();
  const view = svg.getBoundingClientRect();
  const center = {
    x: box.left + box.width / 2 - (view.left + view.width / 2),
    y: box.top + box.height / 2 - (view.top + view.height / 2),
  };
  const cell = Math.max(5, fontSize / 26);
  const digits: { x: number; y: number }[] = [];
  const taps = [-0.3, 0, 0.3];
  for (let y = cell / 2; y < height; y += cell) {
    for (let x = cell / 2; x < width; x += cell) {
      // Una celda se enciende si la tinta cubre buena parte de ella
      let hits = 0;
      for (const oy of taps) for (const ox of taps) if (inked(x + ox * cell, y + oy * cell)) hits += 1;
      if (hits >= 4) digits.push({ x: center.x + x - width / 2, y: center.y + y - height / 2 });
    }
  }
  if (!digits.length) return null;

  // Ambos ordenados por ángulo desde el eco: el mensaje se escribe alrededor
  // del anillo empezando por donde llega la señal, y cada píxel viaja poco
  // al descifrarse
  const radius = fontSize * 0.3;
  // El planeta lleva más píxeles que el número para que su anillo salga
  // continuo; al descifrarse, varios convergen en la misma celda del número
  const planet = samplePlanet(Math.round(digits.length * 1.7));
  const echo = (ECHO.angle * Math.PI) / 180;
  const turn = (x: number, y: number) => (Math.atan2(x, -y) - echo + Math.PI * 4) % (Math.PI * 2);
  const byAngle = <T,>(items: T[], at: (item: T) => number) =>
    items.map((item) => ({ item, angle: at(item) })).sort((a, b) => a.angle - b.angle).map(({ item }) => item);
  const numberCells = byAngle(digits, (digit) => turn(digit.x - center.x, digit.y - center.y));
  const planetCells = byAngle(planet.points, (point) => turn(point.x, point.y));
  return {
    cell,
    planetCell: planet.step * radius,
    center,
    cells: planetCells.map((point, index) => ({
      ...numberCells[Math.floor((index * numberCells.length) / planetCells.length)],
      px: point.x * radius,
      py: point.y * radius,
    })),
  };
};

const hexRgb = (value: string): [number, number, number] => {
  const hex = value.replace('#', '');
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const number = Number.parseInt(full, 16);
  return Number.isNaN(number) || full.length !== 6
    ? [32, 214, 199]
    : [(number >> 16) & 255, (number >> 8) & 255, number & 255];
};

/* Pinta una vez el ruido del cielo en coordenadas polares: casi todo oscuro
   con motas brillantes, más denso hacia el borde, donde el radar oye más
   lejos. El barrido solo deja ver la parte por la que acaba de pasar */
const SCOPE_RES = 420;
const paintScopeNoise = (canvas: HTMLCanvasElement) => {
  canvas.width = SCOPE_RES;
  canvas.height = SCOPE_RES;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const [ar, ag, ab] = hexRgb(getComputedStyle(canvas).getPropertyValue('--accent').trim());
  const image = ctx.createImageData(SCOPE_RES, SCOPE_RES);
  let seed = 7001;
  const random = () => seeded(seed++);
  const half = SCOPE_RES / 2;
  for (let y = 0; y < SCOPE_RES; y += 1) {
    for (let x = 0; x < SCOPE_RES; x += 1) {
      const r = Math.hypot(x + 0.5 - half, y + 0.5 - half) / half;
      const index = (y * SCOPE_RES + x) * 4;
      const band = 0.06 + 0.08 * clamp01((r - 0.4) / 0.5);
      const t = Math.min(1, -Math.log(1 - random() * 0.999) * band);
      // De azul noche al color del capítulo y, en las motas, casi blanco
      const hot = Math.max(0, t - 0.6) / 0.4;
      image.data[index] = 4 + ar * t * (1 - hot) + 255 * hot;
      image.data[index + 1] = 8 + ag * t * (1 - hot) + 255 * hot;
      image.data[index + 2] = 20 + ab * t * (1 - hot) + 255 * hot;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
};

const RADIO_RINGS = 3;

const SignalSearch = ({ progress, label }: { progress: MotionValue<number>; label: string }) => {
  const scopeRef = useRef<HTMLSpanElement>(null);
  const noiseRef = useRef<HTMLCanvasElement>(null);
  const ringRefs = useRef<(SVGCircleElement | null)[]>([]);
  const earthRef = useRef<SVGCircleElement>(null);
  const echoRef = useRef<SVGCircleElement>(null);
  const echoGlowRef = useRef<SVGCircleElement>(null);
  const pulseRef = useRef<SVGCircleElement>(null);
  const bracketRef = useRef<SVGPathElement>(null);
  const pixelRefs = useRef<(SVGRectElement | null)[]>([]);
  const windowRef = useRef<SVGCircleElement>(null);
  const [glyph, setGlyph] = useState<PixelGlyph | null>(null);
  const glyphRef = useRef<PixelGlyph | null>(null);

  const sweep = useTransform(progress, sweepAngle);
  const scale = useTransform(progress, scopeScale);
  const scopeOpacity = useTransform(
    progress,
    [SIGNAL.scope[0], SIGNAL.scope[1], JOURNEY_COVER[0], JOURNEY_COVER[0] + 0.14],
    [0, 1, 1, 0],
  );
  // El ruido se apaga cuando el eco queda fijado: ya no hace falta buscar
  const noiseOpacity = useTransform(progress, [SIGNAL.dim[0], SIGNAL.dim[1]], [0.85, 0.25]);
  // Al quedar sobre el eco, el barrido se atenúa para no taparlo
  const sweepOpacity = useTransform(progress, [SIGNAL.lock[0], SIGNAL.lock[1] + 0.03], [1, 0.3]);
  const opacity = useOverlayOpacity(progress, 0.14);

  useEffect(() => {
    if (noiseRef.current) paintScopeNoise(noiseRef.current);
  }, []);

  const draw = useCallback((p: number, width: number, height: number) => {
    const angle = sweepAngle(p);
    // La estela de fósforo sigue al barrido
    scopeRef.current?.style.setProperty('--trail', `${(angle - AFTERGLOW).toFixed(2)}deg`);

    // I · Nuestra radio se escapa: una Tierra y burbujas que se alejan
    const bubble = seg(p, SIGNAL.bubble);
    const reach = Math.hypot(width, height) * 0.62;
    ringRefs.current.forEach((ring, index) => {
      if (!ring) return;
      const local = clamp01((bubble - index * 0.3) / 0.4);
      ring.setAttribute('r', (easeOut(local) * reach).toFixed(1));
      ring.setAttribute('opacity', (local > 0 ? (1 - local) * 0.8 : 0).toFixed(3));
    });
    earthRef.current?.setAttribute('opacity', (1 - seg(p, [SIGNAL.bubble[0] + 0.05, SIGNAL.bubble[1]])).toFixed(3));

    // II · El eco: asoma en cada vuelta y se confirma en la última
    const size = scopeSize(width, height) * scopeScale(p);
    const theta = (ECHO.angle * Math.PI) / 180;
    const echo = { x: Math.sin(theta) * ECHO.reach * size, y: -Math.cos(theta) * ECHO.reach * size };
    // En cada pasada destella, un poco más claro que la anterior, y se apaga
    // con la estela; en la última el barrido llega a él y queda encendido
    const lock = easeOut(seg(p, SIGNAL.lock));
    const gone = 1 - seg(p, [SIGNAL.fold[1] - 0.02, SIGNAL.open[1]]);
    const before = Math.max(0, ECHO.angle - angle);
    const toNext = before % 360;
    const since = toNext === 0 ? 0 : 360 - toNext;
    const passes = SEARCH_TURNS - Math.ceil(before / 360);
    const strength = (pass: number) => 0.3 + (0.4 * (pass - 1)) / Math.max(1, SEARCH_TURNS - 2);
    const fading = passes >= 1 && passes < SEARCH_TURNS
      ? (1 - clamp01(since / AFTERGLOW)) ** 2 * strength(passes)
      : 0;
    const rising = passes + 1 < SEARCH_TURNS ? seg(-toNext, [-30, 0]) ** 2 * strength(passes + 1) : 0;
    const arrival = seg(angle, [ECHO.angle - 30, ECHO.angle]) ** 2;
    const glow = Math.max(fading, rising, arrival, lock) * gone;
    for (const node of [echoRef.current, echoGlowRef.current]) {
      node?.setAttribute('cx', echo.x.toFixed(1));
      node?.setAttribute('cy', echo.y.toFixed(1));
    }
    echoRef.current?.setAttribute('opacity', glow.toFixed(3));
    echoRef.current?.setAttribute('r', (2.5 + 1.5 * lock).toFixed(2));
    echoGlowRef.current?.setAttribute('opacity', (glow * 0.8).toFixed(3));
    echoGlowRef.current?.setAttribute('r', (10 + 8 * lock).toFixed(1));
    // Fijado: corchetes que se cierran sobre el eco y pulsos que salen de él
    const box = 30 - 14 * lock;
    const arm = box * 0.45;
    const corner = (sx: number, sy: number) =>
      `M ${(echo.x + sx * box).toFixed(1)} ${(echo.y + sy * (box - arm)).toFixed(1)} ` +
      `L ${(echo.x + sx * box).toFixed(1)} ${(echo.y + sy * box).toFixed(1)} ` +
      `L ${(echo.x + sx * (box - arm)).toFixed(1)} ${(echo.y + sy * box).toFixed(1)}`;
    bracketRef.current?.setAttribute('d', [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)].join(' '));
    bracketRef.current?.setAttribute('opacity', (lock * gone).toFixed(3));
    const ripple = (p * 60) % 1;
    pulseRef.current?.setAttribute('cx', echo.x.toFixed(1));
    pulseRef.current?.setAttribute('cy', echo.y.toFixed(1));
    pulseRef.current?.setAttribute('r', (6 + ripple * 46).toFixed(1));
    pulseRef.current?.setAttribute('opacity', (lock * gone * (1 - ripple) * 0.7).toFixed(3));

    // III · Del eco brota el mensaje: un planeta vivo que se mece y luego
    // se descifra, píxel a píxel y en el sentido del barrido, en el número.
    // Cuando llega el número real los píxeles se disuelven hacia afuera
    const glyph = glyphRef.current;
    const cells = glyph?.cells ?? [];
    const cell = glyph?.cell ?? Math.min(width, height) * 0.02;
    const center = glyph?.center ?? { x: 0, y: 0 };
    const spin = ((10 * seg(p, [SIGNAL.fold[0], SIGNAL.decode[1]])) * Math.PI) / 180;
    const cos = Math.cos(spin);
    const sin = Math.sin(spin);
    const scatter = 1 + 1.6 * seg(p, SIGNAL.scatter) ** 2;
    const glyphOpacity = 1 - seg(p, SIGNAL.reveal);
    const planetSide = (glyph?.planetCell ?? cell) * 0.82;
    const count = cells.length;
    cells.forEach((target, index) => {
      const pixel = pixelRefs.current[index];
      if (!pixel) return;
      const along = (index + 0.5) / count;
      const leave = SIGNAL.fold[0] + along * 0.02;
      const local = easeInOut(seg(p, [leave, leave + 0.03]));
      if (local <= 0) {
        pixel.setAttribute('opacity', '0');
        return;
      }
      const planetX = center.x + target.px * cos - target.py * sin;
      const planetY = center.y + target.px * sin + target.py * cos;
      // Viajan en arco, como un chorro de datos que se curva hacia el dibujo
      const bend = Math.sin(local * Math.PI) * cell * 5;
      const dx = planetX - echo.x;
      const dy = planetY - echo.y;
      const length = Math.hypot(dx, dy) || 1;
      let x = echo.x + dx * local - (dy / length) * bend;
      let y = echo.y + dy * local + (dx / length) * bend;
      let side = 2.2 + (planetSide - 2.2) * local;
      // Descifrado: cada píxel salta a su lugar en el número, titubeando
      const start = SIGNAL.decode[0] + along * 0.015;
      const decode = easeInOut(seg(p, [start, start + 0.025]));
      if (decode > 0) {
        const toX = center.x + (target.x - center.x) * scatter;
        const toY = center.y + (target.y - center.y) * scatter;
        const shake = Math.sin(decode * Math.PI) * cell * 1.4;
        x = planetX + (toX - planetX) * decode + (seeded(index + 9001) - 0.5) * shake;
        y = planetY + (toY - planetY) * decode + (seeded(index + 9101) - 0.5) * shake;
        side = planetSide + (cell * 0.74 - planetSide) * decode;
      }
      pixel.setAttribute('x', (x - side / 2).toFixed(1));
      pixel.setAttribute('y', (y - side / 2).toFixed(1));
      pixel.setAttribute('width', side.toFixed(2));
      pixel.setAttribute('height', side.toFixed(2));
      pixel.setAttribute('opacity', glyphOpacity.toFixed(3));
    });

    // IV · Con el número armado, la ventana se abre tras él
    const radius = toPx(signalParts(p));
    windowRef.current?.setAttribute('r', radius.toFixed(1));
    windowRef.current?.setAttribute(
      'opacity',
      (radius > 1 ? 1 - seg(p, [JOURNEY_COVER[0], JOURNEY_COVER[0] + 0.12]) : 0).toFixed(3),
    );
  }, []);
  const svgRef = useStageSvg(progress, draw);

  // Pixela el número cuando la tipografía ya cargó, y de nuevo al cambiar el tamaño
  useEffect(() => {
    let cancelled = false;
    const measure = () => {
      const svg = svgRef.current;
      if (cancelled || !svg) return;
      const next = pixelateNumber(svg, label);
      glyphRef.current = next;
      setGlyph(next);
    };
    document.fonts.ready.then(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', measure);
    };
  }, [label, svgRef]);
  // Con los píxeles nuevos montados, se vuelven a ubicar
  useEffect(() => {
    const svg = svgRef.current;
    if (svg) draw(progress.get(), svg.clientWidth || 1, svg.clientHeight || 1);
  }, [glyph, draw, progress, svgRef]);

  return (
    <>
      <motion.span ref={scopeRef} className="mo-journey-scope" style={{ scale, opacity: scopeOpacity }} aria-hidden="true">
        <motion.canvas ref={noiseRef} style={{ opacity: noiseOpacity }} />
        <i className="is-range" />
        <i className="is-range is-far" />
        <motion.i className="is-sweep" style={{ rotate: sweep, opacity: sweepOpacity }} />
      </motion.span>
      <motion.svg ref={svgRef} className="mo-journey-stage is-signal" style={{ opacity }} aria-hidden="true">
        {Array.from({ length: RADIO_RINGS }, (_, index) => (
          <circle key={index} className="is-ring" r={0} opacity={0} ref={(element) => { ringRefs.current[index] = element; }} />
        ))}
        <circle ref={earthRef} className="is-earth" r={3.5} />
        <circle ref={pulseRef} className="is-pulse" r={0} opacity={0} />
        <circle ref={echoGlowRef} className="is-echo-glow" r={0} opacity={0} />
        <circle ref={echoRef} className="is-echo" r={0} opacity={0} />
        <path ref={bracketRef} className="is-bracket" opacity={0} />
        {glyph?.cells.map((_, index) => (
          <rect
            key={index}
            className="is-pixel"
            rx={1}
            opacity={0}
            ref={(element) => { pixelRefs.current[index] = element; }}
          />
        ))}
        <circle ref={windowRef} className="is-window" r={0} opacity={0} />
      </motion.svg>
    </>
  );
};

/* ---------------- Galaxia: una civilización que se extiende por la espiral ---------------- */

// Punto de un brazo espiral en el plano de la galaxia (unidades -100..100)
const spiralPoint = (arm: number, t: number, jitter: number, spread: number) => {
  const angle = arm * Math.PI + t * Math.PI * 1.75 + jitter * 0.3;
  const radius = 8 + t * 84 + spread * 6;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
};

/* Sistemas colonizados: la ola nace en un brazo exterior y cada sistema
   cuelga del vecino ya colonizado más cercano, como una red que se ramifica */
const COLONIES = (() => {
  const systems = Array.from({ length: 150 }, (_, index) => {
    const t = 0.14 + seeded(index + 2001) * 0.8;
    return spiralPoint(index % 2, t, seeded(index + 2203) - 0.5, seeded(index + 2411) - 0.5);
  });
  const origin = spiralPoint(0, 0.78, 0, 0);
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const ordered = systems
    .map((point) => ({ ...point, reach: distance(point, origin) }))
    .sort((a, b) => a.reach - b.reach);
  return ordered.map((point, index) => {
    let parent = origin;
    let best = Infinity;
    for (let k = 0; k < index; k += 1) {
      const gap = distance(point, ordered[k]);
      if (gap < best) {
        best = gap;
        parent = ordered[k];
      }
    }
    return { x: point.x, y: point.y, px: parent.x, py: parent.y, length: Math.max(0.1, distance(point, parent)), reach: point.reach };
  });
})();
// Donde nace la civilización, en fracciones del disco (para el frente de luz)
const COLONY_ORIGIN = (() => {
  const { x, y } = spiralPoint(0, 0.78, 0, 0);
  return { x: (x + 100) / 2, y: (y + 100) / 2 };
})();

/* Guion de la galaxia: aparece de canto, gira hasta quedar de frente
   mientras la civilización la enciende, y al final nos zambullimos en ella */
const GALAXY = {
  appear: [0.02, 0.07],
  turn: [0.04, 0.24],
  spread: [0.06, 0.31],
  window: [0.19, 0.3],
  dive: [0.27, 0.56],
  flybyOut: [0.33, 0.39],
} satisfies Record<string, [number, number]>;

/* Estrellas en primer plano que pasan volando durante la zambullida, cada
   una a su profundidad (z): las cercanas cruzan antes y más rápido */
const FLYBY = Array.from({ length: 70 }, (_, index) => {
  const angle = seeded(index + 3001) * Math.PI * 2;
  const radius = 6 + seeded(index + 3101) ** 0.7 * 64;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    z: 0.55 + seeded(index + 3203) * 1.1,
    warm: seeded(index + 3307) > 0.7,
  };
});

// Pinta la galaxia una sola vez: núcleo, polvo de estrellas, gas y cúmulos
// jóvenes. Salvaje es antes de la civilización: tenue, fría y sin el gas
// teñido; encendida es la galaxia ya habitada
const paintGalaxy = (canvas: HTMLCanvasElement, wild = false) => {
  const size = 1024;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const accent = getComputedStyle(canvas).getPropertyValue('--accent').trim() || '#c58cff';
  const unit = size / 200;
  ctx.translate(size / 2, size / 2);
  ctx.globalCompositeOperation = 'lighter';
  let seed = 1;
  const random = () => seeded(seed++);
  const glow = (x: number, y: number, radius: number, color: string, alpha: number) => {
    ctx.globalAlpha = alpha;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  };
  // Gas de los brazos: manchas amplias y tenues teñidas con el color del capítulo
  for (let i = 0; i < 520; i += 1) {
    const t = random();
    const { x, y } = spiralPoint(i % 2, t, (random() - 0.5) * 1.6, (random() - 0.5) * 2);
    glow(x * unit, y * unit, (6 + random() * 10) * unit * (0.6 + t * 0.6), wild ? '#6a7aa8' : accent, wild ? 0.012 : 0.032);
  }
  // Núcleo cálido
  glow(0, 0, 34 * unit, '#ffd9a8', wild ? 0.3 : 0.55);
  glow(0, 0, 12 * unit, '#fff4e2', wild ? 0.6 : 0.9);
  // Estrellas: muchas, finas, más densas en los brazos
  for (let i = 0; i < 5200; i += 1) {
    const t = random() ** 0.85;
    const { x, y } = spiralPoint(i % 2, t, (random() - 0.5) * 1.3, (random() - 0.5) * (1 + t * 2));
    ctx.globalAlpha = (0.25 + random() * 0.6) * (wild ? 0.5 : 1);
    ctx.fillStyle = wild ? '#cdd8f0' : random() < 0.7 ? '#dfe8ff' : random() < 0.5 ? '#fff1dc' : accent;
    const radius = (0.35 + random() ** 3 * 1.4) * (size / 1024);
    ctx.beginPath();
    ctx.arc(x * unit, y * unit, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cúmulos jóvenes: nudos rosados y azules a lo largo de los brazos
  for (let i = 0; i < 70; i += 1) {
    const { x, y } = spiralPoint(i % 2, 0.2 + random() * 0.75, (random() - 0.5) * 0.8, (random() - 0.5) * 0.8);
    glow(x * unit, y * unit, (1.5 + random() * 2.5) * unit, random() < 0.6 ? '#ff9ec8' : '#9cc4ff', wild ? 0.12 : 0.5);
  }
};

const Galaxy = ({ progress }: { progress: MotionValue<number> }) => {
  const wildRef = useRef<HTMLCanvasElement>(null);
  const litRef = useRef<HTMLCanvasElement>(null);
  const discRef = useRef<HTMLSpanElement>(null);
  const colonyRefs = useRef<(SVGCircleElement | null)[]>([]);
  const routeRefs = useRef<(SVGLineElement | null)[]>([]);
  const flybyRefs = useRef<(SVGLineElement | null)[]>([]);
  // Gira en 3D: de canto (una línea de luz) a casi de frente
  const tilt = useTransform(progress, GALAXY.turn, [0.05, 0.62], { ease: easeInOut });
  // Crece hasta llenar la vista y al final se acelera: caemos dentro de ella
  const scale = useTransform(
    progress,
    [GALAXY.appear[0], GALAXY.turn[1], GALAXY.dive[0], GALAXY.dive[1]],
    [0.5, 1, 1.08, 3.6],
    { ease: [easeOut, (t) => t, (t) => t ** 2.2] },
  );
  const rotate = useTransform(progress, [0, JOURNEY_COVER[1]], [-40, 60]);
  const opacity = useTransform(
    progress,
    [GALAXY.appear[0], GALAXY.appear[1], JOURNEY_COVER[0], JOURNEY_COVER[0] + 0.14],
    [0, 1, 1, 0],
  );
  // El núcleo abultado se ve redondo de canto y se funde en el disco de frente
  const bulge = useTransform(progress, [GALAXY.appear[0], GALAXY.appear[1], GALAXY.turn[1]], [0, 1, 0.25]);

  useEffect(() => {
    if (wildRef.current) paintGalaxy(wildRef.current, true);
    if (litRef.current) paintGalaxy(litRef.current);
    discRef.current?.style.setProperty('--ox', `${COLONY_ORIGIN.x}%`);
    discRef.current?.style.setProperty('--oy', `${COLONY_ORIGIN.y}%`);
  }, []);

  // La ola avanza con el scroll: cada sistema traza su ruta y se enciende, y
  // tras el frente la galaxia pasa de salvaje a habitada
  const spread = (p: number) => {
    const wave = easeInOut(seg(p, GALAXY.spread)) * (COLONIES.length + 4);
    COLONIES.forEach((colony, index) => {
      const local = clamp01((wave - index) / 4);
      const route = routeRefs.current[index];
      if (route) {
        route.setAttribute('stroke-dashoffset', (colony.length * (1 - local)).toFixed(2));
        route.setAttribute('opacity', local > 0 ? '1' : '0');
      }
      const star = colonyRefs.current[index];
      if (star) star.setAttribute('opacity', clamp01(local * 2 - 1).toFixed(3));
    });
    const front = wave <= 0 ? 0.1 : COLONIES[Math.min(COLONIES.length - 1, Math.floor(wave))].reach / 2 + 6;
    discRef.current?.style.setProperty('--lit', `${(wave >= COLONIES.length ? 140 : front).toFixed(2)}%`);
  };

  // Zambullida: las estrellas cercanas se abren hacia los bordes como estelas
  const fly = (p: number) => {
    const dive = seg(p, GALAXY.dive) ** 1.6;
    // Pasan durante la zambullida y se apagan antes de que entre el título
    const shown = seg(p, [GALAXY.dive[0], GALAXY.dive[0] + 0.04]) * (1 - seg(p, GALAXY.flybyOut));
    FLYBY.forEach((star, index) => {
      const line = flybyRefs.current[index];
      if (!line) return;
      const z = star.z - dive * 1.5;
      if (z <= 0.06 || shown <= 0) {
        line.setAttribute('opacity', '0');
        return;
      }
      const near = 0.55 / z;
      const tail = 0.55 / (z + 0.06 + dive * 0.25);
      line.setAttribute('x1', (star.x * tail).toFixed(2));
      line.setAttribute('y1', (star.y * tail).toFixed(2));
      line.setAttribute('x2', (star.x * near).toFixed(2));
      line.setAttribute('y2', (star.y * near).toFixed(2));
      line.setAttribute('stroke-width', Math.min(1.6, 0.18 / z).toFixed(3));
      line.setAttribute('opacity', (shown * clamp01((1.7 - z) * 1.4) * clamp01(z * 4)).toFixed(3));
    });
  };
  const paint = (p: number) => {
    spread(p);
    fly(p);
  };
  useMotionValueEvent(progress, 'change', paint);
  useEffect(() => paint(progress.get()));

  return (
    <span className="mo-journey-galaxy" aria-hidden="true">
      <motion.span className="mo-journey-galaxy-tilt" style={{ scaleY: tilt, opacity }}>
        <motion.span
          ref={discRef}
          className="mo-journey-galaxy-disc"
          style={{ scale, rotate }}
        >
          <canvas ref={wildRef} />
          <canvas ref={litRef} className="is-lit" />
          <svg viewBox="-100 -100 200 200">
            {COLONIES.map((colony, index) => (
              <line
                key={`r${index}`}
                className="is-route"
                x1={colony.px}
                y1={colony.py}
                x2={colony.x}
                y2={colony.y}
                strokeDasharray={colony.length}
                strokeDashoffset={colony.length}
                opacity={0}
                ref={(element) => { routeRefs.current[index] = element; }}
              />
            ))}
            {COLONIES.map((colony, index) => (
              <circle
                key={`c${index}`}
                className="is-colony"
                cx={colony.x}
                cy={colony.y}
                r={0.55}
                opacity={0}
                ref={(element) => { colonyRefs.current[index] = element; }}
              />
            ))}
          </svg>
        </motion.span>
      </motion.span>
      <motion.span className="mo-journey-galaxy-bulge" style={{ opacity: bulge }} />
      <svg className="mo-journey-galaxy-flyby" viewBox="-100 -100 200 200">
        {FLYBY.map((star, index) => (
          <line
            key={index}
            className={star.warm ? 'is-warm' : undefined}
            opacity={0}
            ref={(element) => { flybyRefs.current[index] = element; }}
          />
        ))}
      </svg>
    </span>
  );
};

/* Capa decorativa del viaje, encima de la imagen y bajo el número */
export const JourneyOverlay = ({
  kind,
  progress,
  label,
}: {
  kind: JourneyKind;
  progress: MotionValue<number>;
  label: string;
}) => {
  switch (kind) {
    case 'collapse':
      return <StarCollapse progress={progress} />;
    case 'torus':
      return <HabitatTorus progress={progress} />;
    case 'blueprint':
      return <BlueprintFrame progress={progress} />;
    case 'horizon':
      return <HorizonRim progress={progress} />;
    case 'dyson':
      return <DysonEclipse progress={progress} />;
    case 'starburst':
      return <BlackHole progress={progress} />;
    case 'tunnel':
      return (
        <>
          <IrisRing progress={progress} />
          <WarpTunnel progress={progress} />
        </>
      );
    case 'galaxy':
      return <Galaxy progress={progress} />;
    case 'signal':
      return <SignalSearch progress={progress} label={label} />;
    default:
      return <IrisRing progress={progress} />;
  }
};
