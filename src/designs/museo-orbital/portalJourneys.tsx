import { useCallback, useEffect, useRef } from 'react';
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
    case 'galaxy':
      return `circle(${irisRadius(p, 22)} at 50% 50%)`;
    case 'collapse':
      return `circle(${collapseRadius(p)} at 50% 50%)`;
    case 'dyson':
      return `circle(${cssRadius(dysonParts(p))} at 50% 50%)`;
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
    return { x: point.x, y: point.y, px: parent.x, py: parent.y, length: Math.max(0.1, distance(point, parent)) };
  });
})();

// Pinta la galaxia una sola vez: núcleo, polvo de estrellas, gas y cúmulos jóvenes
const paintGalaxy = (canvas: HTMLCanvasElement) => {
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
    glow(x * unit, y * unit, (6 + random() * 10) * unit * (0.6 + t * 0.6), accent, 0.032);
  }
  // Núcleo cálido
  glow(0, 0, 34 * unit, '#ffd9a8', 0.55);
  glow(0, 0, 12 * unit, '#fff4e2', 0.9);
  // Estrellas: muchas, finas, más densas en los brazos
  for (let i = 0; i < 5200; i += 1) {
    const t = random() ** 0.85;
    const { x, y } = spiralPoint(i % 2, t, (random() - 0.5) * 1.3, (random() - 0.5) * (1 + t * 2));
    ctx.globalAlpha = 0.25 + random() * 0.6;
    ctx.fillStyle = random() < 0.7 ? '#dfe8ff' : random() < 0.5 ? '#fff1dc' : accent;
    const radius = (0.35 + random() ** 3 * 1.4) * (size / 1024);
    ctx.beginPath();
    ctx.arc(x * unit, y * unit, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cúmulos jóvenes: nudos rosados y azules a lo largo de los brazos
  for (let i = 0; i < 70; i += 1) {
    const { x, y } = spiralPoint(i % 2, 0.2 + random() * 0.75, (random() - 0.5) * 0.8, (random() - 0.5) * 0.8);
    glow(x * unit, y * unit, (1.5 + random() * 2.5) * unit, random() < 0.6 ? '#ff9ec8' : '#9cc4ff', 0.5);
  }
};

const Galaxy = ({ progress }: { progress: MotionValue<number> }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colonyRefs = useRef<(SVGCircleElement | null)[]>([]);
  const routeRefs = useRef<(SVGLineElement | null)[]>([]);
  const scale = useTransform(progress, [JOURNEY_OPEN[0], JOURNEY_OPEN[1], JOURNEY_COVER[1]], [0.08, 1, 3]);
  const rotate = useTransform(progress, [0, JOURNEY_COVER[1]], [-40, 50]);
  const opacity = useOverlayOpacity(progress, 0.14);

  useEffect(() => {
    if (canvasRef.current) paintGalaxy(canvasRef.current);
  }, []);

  // La ola avanza con el scroll: cada sistema traza su ruta y se enciende
  const spread = (p: number) => {
    const wave = easeInOut(seg(p, [JOURNEY_OPEN[0] + 0.03, JOURNEY_COVER[0] - 0.02])) * (COLONIES.length + 4);
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
  };
  useMotionValueEvent(progress, 'change', spread);
  useEffect(() => spread(progress.get()));

  return (
    <span className="mo-journey-galaxy" aria-hidden="true">
      <motion.span className="mo-journey-galaxy-disc" style={{ scale, rotate, opacity }}>
        <canvas ref={canvasRef} />
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
    </span>
  );
};

/* Capa decorativa del viaje, encima de la imagen y bajo el número */
export const JourneyOverlay = ({ kind, progress }: { kind: JourneyKind; progress: MotionValue<number> }) => {
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
