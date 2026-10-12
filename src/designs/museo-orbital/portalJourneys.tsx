import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useTransform, type MotionValue } from 'framer-motion';
import { HOLE, drawHole, holeCenter, holeGlow, holeRadius, holeRoll } from './blackHoleFall';
import { drawHabitat, habitatRoll, habitatSkyHidden, habitatWindow } from './habitatFlyby';
import { CHASE, chaseBank, drawChase } from './propulsionChase';
import { KARDASHEV, drawKardashev, kardashevGround, kardashevSkyDim, kardashevTurn } from './kardashevZoom';
import { skyDrift } from './roomShared';
import { drawTug } from './tileAssembly';

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
  // El astillero: la imagen se arma al fondo del dique
  blueprint: [{ range: [0.12, 0.28], extra: 70 }],
  // El atraque: rozar el anillo, rodearlo hasta su eje, igualar el giro y
  // entrar por el túnel del cubo
  torus: [
    { range: [0.03, 0.2], extra: 90 },
    { range: [0.2, 0.29], extra: 60 },
  ],
  // La caída: acercarse al agujero negro, rodearlo y zambullirse
  starburst: [{ range: [0.03, 0.27], extra: 80 }],
  // Kardashev: subir de la ciudad al planeta, a la estrella y a la galaxia
  galaxy: [{ range: [0.03, 0.27], extra: 110 }],
  // La persecución: rodear la nave, acelerar y el salto
  tunnel: [{ range: [0.03, 0.27], extra: 80 }],
  // La reentrada: girar hacia el planeta, arder, nivelarse y cruzar las nubes
  // con un tramo propio y más lento para las nubes
  horizon: [
    { range: [0.03, 0.235], extra: 55 },
    { range: [0.235, 0.3], extra: 90 },
  ],
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

/* Agujero negro: la ventana se abre dentro de la sombra y, al cubrir, la
   sombra crece con ella */
const holeParts = (p: number, width: number, height: number) => {
  const radius = holeRadius(p, width, height) + toPx({ min: 0, max: 76 * easeInOut(seg(p, JOURNEY_COVER)) });
  return { radius, opening: radius * easeOut(seg(p, HOLE.open)) };
};

/* Kardashev: la ventana se abre en el núcleo de la galaxia ya habitada */
const kardashevParts = (p: number): RadiusParts => ({
  min: 20 * easeOut(seg(p, KARDASHEV.open)),
  max: 76 * easeInOut(seg(p, JOURNEY_COVER)),
});

/* Propulsión: la ventana se abre donde la nave se pierde en el punto de fuga */
const chaseParts = (p: number): RadiusParts => ({
  min: 30 * easeOut(seg(p, CHASE.open)),
  max: 76 * easeInOut(seg(p, JOURNEY_COVER)),
});

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

/* Reentrada: la cámara llega ladeada y gira hacia el planeta, que entra
   desde abajo a la izquierda. Al entrar en la atmósfera tiembla, el fuego
   la envuelve y se nivela con un vaivén de cápsula; al final cruzamos las
   nubes. Todo termina quieto y nivelado antes de que la ventana cubra */
const REENTRY = {
  turn: [0.02, 0.19],
  bank: [0.02, 0.15],
  level: [0.17, 0.262],
  settle: [0.24, JOURNEY_OPEN[1]],
  clouds: [0.235, 0.3],
} satisfies Record<string, [number, number]>;
// El fuego de la entrada: crece, llega al máximo y se apaga al nivelarnos
const reentryHeat = (p: number) => Math.sin(Math.PI * seg(p, [0.15, 0.285])) ** 1.4;
const reentryCamera = (p: number, width: number, height: number) => {
  const turn = easeInOut(seg(p, REENTRY.turn));
  const shake = reentryHeat(p) ** 2;
  // Grados: de un leve ladeo a la derecha a uno marcado a la izquierda, que
  // se endereza al entrar y se pasa un poco antes de quedar quieto
  const degrees =
    (8 - 30 * easeInOut(seg(p, REENTRY.bank))) * (1 - easeInOut(seg(p, REENTRY.level))) +
    3 * Math.sin(Math.PI * seg(p, REENTRY.settle)) +
    0.6 * shake * Math.sin(p * 900);
  return {
    roll: (degrees * Math.PI) / 180,
    panX: -0.3 * width * (1 - turn),
    panY: 0.22 * height * (1 - turn),
    shakeX: (6 * shake * (Math.sin(p * 700) + 0.6 * Math.sin(p * 1650 + 1.7))) / 1.6,
    shakeY: (6 * shake * (Math.sin(p * 820 + 0.6) + 0.6 * Math.sin(p * 1430 + 2.9))) / 1.6,
  };
};
type ReentryCamera = ReturnType<typeof reentryCamera>;
// Un punto del mundo (desde el centro de la pantalla) tal como lo ve la cámara
const reentryPlace = ({ roll, panX, panY, shakeX, shakeY }: ReentryCamera, x: number, y: number) => {
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  return [shakeX + cos * (x + panX) - sin * (y + panY), shakeY + sin * (x + panX) + cos * (y + panY)];
};

/* La imagen del capítulo se mueve con el mundo: en la reentrada rueda y
   tiembla junto al planeta. Los demás viajes la dejan quieta */
const STILL_IMAGE = { x: 0, y: 0, rotate: 0 };
export const journeyImageCamera = (kind: JourneyKind, p: number) => {
  if (kind !== 'horizon' || p >= JOURNEY_OPEN[1]) return STILL_IMAGE;
  const camera = reentryCamera(p, window.innerWidth, window.innerHeight);
  const [x, y] = reentryPlace(camera, 0, 0);
  return { x, y, rotate: (camera.roll * 180) / Math.PI };
};

/* Obra en el espacio: un túnel de andamios se traza solo frente a nosotros
   y gira hasta quedar de frente; al fondo, la flota trae las teselas de la
   imagen y las grúas pórtico las bajan a su lugar. Con la obra terminada
   entramos por el túnel hasta ella. En píxeles, compartido por el recorte y
   el dibujo */
const YARD = {
  frame: [0.02, 0.12],
  align: [0.03, 0.14],
  approach: [0.07, 0.14],
  build: [0.13, 0.28],
  dive: [0.27, JOURNEY_COVER[1]],
} satisfies Record<string, [number, number]>;
// En sus unidades: el hueco de la imagen (1.6 x 0.9), el ancho de las
// columnas del andamio a su alrededor, el largo del túnel, en cuántos
// tramos se divide y cuántos pisos tiene
const YARD_W = 0.8;
const YARD_H = 0.45;
const YARD_MARGIN = 0.14;
const YARD_DEPTH = 1.4;
const YARD_BAYS = 4;
const YARD_LEVELS = 4;
// Distancia de la cámara a la imagen: mientras el andamio se construye,
// frente a él, mientras se arma la imagen y al final (ya dentro, con la
// imagen cubriendo la pantalla)
const YARD_FAR = 5.2;
const YARD_NEAR = 3.3;
const YARD_PUSH = 3;
const YARD_END = 0.55;
// Las grúas torre del techo: medio ancho del mástil, sus tramos, largo de
// la pluma (y en cuántos paños de celosía) y de la contrapluma
const YARD_TOWER = { mast: 0.035, sections: 8, jib: 1.05, panels: 10, counter: 0.3 };
// Dónde se paran (x, fondo), cuánto se alzan y hacia qué lado tienden la
// pluma: cada una baja las teselas de una mitad de la imagen
const YARD_CRANES = [
  { x: -0.68, z: 0.25, height: 0.5, side: 1 },
  { x: 0.68, z: -0.15, height: 0.62, side: -1 },
];
// Giro de la pluma sobre el mástil (rad), que va y viene con el scroll
const craneSlew = (p: number, index: number) => 0.42 * Math.sin(p * 26 + index * 1.9);
// La grilla de la imagen y cuánto tarda cada tesela en llegar
const YARD_COLS = 12;
const YARD_ROWS = 7;
const YARD_FLIGHT = 0.04;

const yardParts = (p: number, width: number, height: number) => {
  const align = easeInOut(seg(p, YARD.align));
  const back = YARD_FAR * (YARD_NEAR / YARD_FAR) ** easeInOut(seg(p, YARD.approach))
    * (YARD_PUSH / YARD_NEAR) ** easeInOut(seg(p, YARD.build))
    * (YARD_END / YARD_PUSH) ** easeInOut(seg(p, YARD.dive));
  const scale = Math.min(width, height);
  const cx = width / 2 - (1 - align) * width * 0.1;
  // La obra va un poco más abajo para que entren las grúas del techo; al
  // entrar vuelve al centro
  const cy = height / 2 + (1 - align) * height * 0.04 + height * 0.13 * (1 - easeInOut(seg(p, YARD.dive)));
  return {
    scale,
    back,
    cx,
    cy,
    yaw: 0.65 * (1 - align),
    pitch: -0.22 * (1 - align),
    // El fondo del dique ya de frente: ahí se arma la imagen
    window: {
      left: cx - (scale * YARD_W) / back,
      top: cy - (scale * YARD_H) / back,
      width: (2 * scale * YARD_W) / back,
      height: (2 * scale * YARD_H) / back,
    },
  };
};

// Cada tesela: cuándo despega (del centro hacia afuera), de qué lado llega,
// a qué altura y con cuánto arco; una de cada tres viene remolcada
const YARD_TILES = Array.from({ length: YARD_COLS * YARD_ROWS }, (_, index) => {
  const col = index % YARD_COLS;
  const row = Math.floor(index / YARD_COLS);
  const spread = Math.hypot(
    (col - (YARD_COLS - 1) / 2) / ((YARD_COLS - 1) / 2),
    ((row - (YARD_ROWS - 1) / 2) / ((YARD_ROWS - 1) / 2)) * 0.6,
  ) / Math.hypot(1, 0.6);
  const order = Math.min(1, spread * 0.85 + seeded(index + 401) * 0.15);
  const launch = YARD.build[0] + order * (YARD.build[1] - YARD.build[0] - YARD_FLIGHT);
  return {
    col,
    row,
    launch,
    side: col < YARD_COLS / 2 ? -1 : 1,
    height: seeded(index + 607) - 0.5,
    arc: (seeded(index + 811) - 0.5) * 0.35,
    spin: (seeded(index + 503) - 0.5) * 3.2,
    tug: index % 3 === 1 ? Math.floor(index / 3) % 3 : -1,
  };
});

const yardFlight = (tile: (typeof YARD_TILES)[number], p: number) => seg(p, [tile.launch, tile.launch + YARD_FLIGHT]);

/* Recorte de la imagen: solo las teselas que ya calzaron (por filas, en
   tramos seguidos); con todas puestas, el fondo entero del dique */
const yardClip = (p: number) => {
  const { window: box } = yardParts(p, window.innerWidth, window.innerHeight);
  const cellWidth = box.width / YARD_COLS;
  const cellHeight = box.height / YARD_ROWS;
  const rect = (left: number, top: number, right: number, bottom: number) =>
    `M ${left.toFixed(1)} ${top.toFixed(1)} H ${right.toFixed(1)} V ${bottom.toFixed(1)} H ${left.toFixed(1)} Z`;
  if (p >= YARD.build[1]) return `path('${rect(box.left, box.top, box.left + box.width, box.top + box.height)}')`;
  const parts: string[] = [];
  for (let row = 0; row < YARD_ROWS; row++) {
    let start = -1;
    for (let col = 0; col <= YARD_COLS; col++) {
      const landed = col < YARD_COLS && yardFlight(YARD_TILES[row * YARD_COLS + col], p) >= 1;
      if (landed && start < 0) start = col;
      if (!landed && start >= 0) {
        // Medio píxel de más para que no se vean juntas
        parts.push(rect(
          box.left + start * cellWidth - 0.5,
          box.top + row * cellHeight - 0.5,
          box.left + col * cellWidth + 0.5,
          box.top + (row + 1) * cellHeight + 0.5,
        ));
        start = -1;
      }
    }
  }
  return parts.length ? `path('${parts.join(' ')}')` : 'inset(50%)';
};

/* Recorte de la imagen del capítulo según el viaje */
export const journeyClip = (kind: JourneyKind, p: number): string => {
  switch (kind) {
    case 'torus': {
      // La ventana es el fondo del túnel del cubo, al centro
      const opening = habitatWindow(p, window.innerWidth, window.innerHeight);
      const cover = toPx({ min: 0, max: 76 * easeInOut(seg(p, JOURNEY_COVER)) });
      return `circle(${(opening > 0 ? opening + cover : 0).toFixed(1)}px at 50% 50%)`;
    }
    case 'blueprint':
      return yardClip(p);
    case 'horizon': {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const { r, cy } = planetCircle(p, width, height);
      if (p >= JOURNEY_OPEN[1]) return `circle(${r.toFixed(1)}px at 50% ${cy.toFixed(1)}px)`;
      const [x, y] = reentryPlace(reentryCamera(p, width, height), 0, cy - height / 2);
      return `circle(${r.toFixed(1)}px at calc(50% + ${x.toFixed(1)}px) calc(50% + ${y.toFixed(1)}px))`;
    }
    case 'galaxy':
      return `circle(${cssRadius(kardashevParts(p))} at 50% 50%)`;
    case 'collapse':
      return `circle(${collapseRadius(p)} at 50% 50%)`;
    case 'dyson':
      return `circle(${cssRadius(dysonParts(p))} at 50% 50%)`;
    case 'starburst':
      return `circle(${holeParts(p, window.innerWidth, window.innerHeight).opening.toFixed(1)}px at 50% 50%)`;
    case 'tunnel':
      return `circle(${cssRadius(chaseParts(p))} at 50% 50%)`;
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

/* ---------------- Atraque: sobrevuelo, igualar el giro y el túnel del cubo ---------------- */

const accentRgb = (element: Element | null) => {
  const value = element ? getComputedStyle(element).getPropertyValue('--accent').trim() : '';
  const hex = value.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return [32, 214, 199];
  return [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16));
};

const HabitatDock = ({ progress }: { progress: MotionValue<number> }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ width: 1, height: 1, ratio: 1 });
  const tint = useRef<number[]>([32, 214, 199]);
  const lastRoll = useRef(Number.NaN);
  const opacity = useTransform(
    progress,
    [JOURNEY_OPEN[0], JOURNEY_OPEN[0] + 0.03, JOURNEY_COVER[0] + 0.08, JOURNEY_COVER[0] + 0.18],
    [0, 1, 1, 0],
  );

  const draw = useCallback((p: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const { width, height, ratio } = size.current;

    // Lo que rodamos para igualar el giro lo rueda el cielo al revés
    const roll = habitatRoll(p);
    const delta = roll - lastRoll.current;
    if (Math.abs(delta) < 1) {
      skyDrift.spin.x = width / 2;
      skyDrift.spin.y = height / 2;
      skyDrift.spin.depth = 0;
      skyDrift.spin.angle -= delta;
    }
    lastRoll.current = roll;

    // Dentro del túnel no hay cielo: se apagan los meteoros y las
    // constelaciones de la capa de efectos, que va por encima de los portales
    const fx = document.querySelector<HTMLElement>('.mo-starfx');
    if (fx) {
      const hidden = p > JOURNEY_OPEN[0] && p < JOURNEY_COVER[1] ? habitatSkyHidden(p) : 0;
      fx.style.opacity = hidden > 0 ? (1 - hidden).toFixed(3) : '';
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (p > JOURNEY_COVER[0] + 0.18 || p < JOURNEY_OPEN[0]) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const opening = habitatWindow(p, width, height);
    const cover = toPx({ min: 0, max: 76 * easeInOut(seg(p, JOURNEY_COVER)) });
    drawHabitat(context, p, width, height, tint.current, opening > 0 ? opening + cover : 0);
  }, []);

  useMotionValueEvent(progress, 'change', draw);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    tint.current = accentRgb(canvas);
    const measure = () => {
      const width = canvas.clientWidth || 1;
      const height = canvas.clientHeight || 1;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      size.current = { width, height, ratio };
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      draw(progress.get());
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      const fx = document.querySelector<HTMLElement>('.mo-starfx');
      if (fx) fx.style.opacity = '';
    };
  }, [progress, draw]);

  return <motion.canvas ref={canvasRef} className="mo-journey-stage is-dock" style={{ opacity }} aria-hidden="true" />;
};

/* ---------------- Astillero: el dique de vigas y la imagen que se arma al fondo ---------------- */

/* El dique como un dibujo de líneas finas en perspectiva: la boca, el fondo,
   las cuadernas de cada tramo y las diagonales del enrejado. Al fondo, la
   grilla vacía de la imagen; las teselas llegan volando desde fuera de la
   pantalla (algunas remolcadas) y, al calzar, el recorte deja ver la imagen
   real en su lugar: el lienzo solo dibuja lo que vuela */

// Escala de la imagen del portal (la misma que le da SalaPortal) para que
// cada tesela en vuelo muestre justo el trozo que tapará
const portalImageScale = (p: number) => {
  const stops: [number, number][] = [[JOURNEY_OPEN[0], 1.45], [JOURNEY_COVER[0], 1.15], [JOURNEY_COVER[1], 1.07], [0.88, 1]];
  if (p <= stops[0][0]) return stops[0][1];
  for (let index = 1; index < stops.length; index++) {
    const [at, value] = stops[index];
    const [before, previous] = stops[index - 1];
    if (p <= at) return previous + (value - previous) * ((p - before) / (at - before));
  }
  return 1;
};

const Shipyard = ({ progress, image }: { progress: MotionValue<number>; image?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ width: 1, height: 1, ratio: 1 });
  const tint = useRef<number[]>([32, 214, 199]);
  const picture = useRef<HTMLImageElement | null>(null);
  const opacity = useTransform(
    progress,
    [JOURNEY_OPEN[0], JOURNEY_OPEN[0] + 0.03, JOURNEY_COVER[0], JOURNEY_COVER[0] + 0.16],
    [0, 1, 1, 0],
  );

  const draw = useCallback((p: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const { width, height, ratio } = size.current;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (p > JOURNEY_COVER[0] + 0.16 || p < JOURNEY_OPEN[0]) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const { scale, back, cx, cy, yaw, pitch, window: box } = yardParts(p, width, height);
    const [r, g, b] = tint.current;
    const color = (alpha: number, white: number) =>
      `rgba(${Math.round(r + (255 - r) * white)}, ${Math.round(g + (255 - g) * white)}, ${Math.round(b + (255 - b) * white)}, ${alpha.toFixed(3)})`;

    // Del dique a la pantalla: gira sobre su centro y la cámara mira por su
    // eje desde `back` delante del fondo. Lo que queda detrás de la cámara
    // (al entrar) se recorta en un plano cercano
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const camera = -YARD_DEPTH / 2 + back;
    const view = (x: number, y: number, z: number) => {
      const x1 = x * cosYaw + z * sinYaw;
      const z1 = -x * sinYaw + z * cosYaw;
      const y2 = y * cosPitch - z1 * sinPitch;
      const z2 = y * sinPitch + z1 * cosPitch;
      return [x1, y2, camera - z2] as const;
    };
    const NEAR = 0.04;
    // Las vigas tienen cuerpo: se guardan sus extremos en pantalla (con su
    // profundidad, para el grosor) y se pintan juntas al final
    const solids = new Map<Path2D, number[][]>();
    const segment = (path: Path2D, a: readonly number[], b2: readonly number[]) => {
      let [ax, ay, ad] = view(a[0], a[1], a[2]);
      let [bx, by, bd] = view(b2[0], b2[1], b2[2]);
      if (ad < NEAR && bd < NEAR) return;
      if (ad < NEAR || bd < NEAR) {
        const t = (NEAR - ad) / (bd - ad);
        const x = ax + (bx - ax) * t;
        const y = ay + (by - ay) * t;
        if (ad < NEAR) [ax, ay, ad] = [x, y, NEAR];
        else [bx, by, bd] = [x, y, NEAR];
      }
      const list = solids.get(path) ?? [];
      list.push([cx + (scale * ax) / ad, cy + (scale * ay) / ad, ad, cx + (scale * bx) / bd, cy + (scale * by) / bd, bd]);
      solids.set(path, list);
    };

    // El andamio se traza solo: cada viga crece desde su arranque según su
    // turno (de la boca al fondo: montantes, travesaños, largueros,
    // diagonales y al final las grúas)
    const built = seg(p, YARD.frame);
    const grow = (order: number) => easeInOut(seg(built, [order * 0.72, order * 0.72 + 0.28]));
    const frame = new Path2D();
    const bracing = new Path2D();
    const beam = (path: Path2D, a: number[], b2: number[], order: number): void => {
      const t = grow(order);
      if (t <= 0) return;
      segment(path, a, [a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t, a[2] + (b2[2] - a[2]) * t]);
    };
    const outerW = YARD_W + YARD_MARGIN;
    const outerH = YARD_H + YARD_MARGIN;
    const front = -YARD_DEPTH / 2 + YARD_DEPTH;
    const rear = -YARD_DEPTH / 2;
    // El andamio es un túnel: marcos repetidos de la boca hasta la imagen,
    // cada uno con sus columnas a los lados y sus travesaños arriba y abajo
    const planes = Array.from({ length: YARD_BAYS + 1 }, (_, bay) => front - (bay / YARD_BAYS) * YARD_DEPTH);
    const columns = [-outerW, -YARD_W, YARD_W, outerW];
    const levelY = (level: number) => outerH - (level / YARD_LEVELS) * outerH * 2;
    planes.forEach((z, bay) => {
      const delay = (bay / YARD_BAYS) * 0.25;
      // Montantes que suben desde abajo
      columns.forEach((x, index) => beam(frame, [x, outerH, z], [x, -outerH, z], delay + index * 0.03));
      for (let level = 0; level <= YARD_LEVELS; level++) {
        // Arriba y abajo cruzan todo el ancho; en medio, solo las columnas
        const spans = level === 0 || level === YARD_LEVELS ? [[-outerW, outerW]] : [[-outerW, -YARD_W], [YARD_W, outerW]];
        for (const [from, to] of spans) beam(level % YARD_LEVELS ? bracing : frame, [from, levelY(level), z], [to, levelY(level), z], delay + 0.15);
      }
      if (bay === YARD_BAYS) return;
      // Largueros hacia el fondo y diagonales en las caras que miran al túnel
      const next = planes[bay + 1];
      for (let level = 0; level <= YARD_LEVELS; level++) {
        for (const x of columns) beam(level % YARD_LEVELS ? bracing : frame, [x, levelY(level), z], [x, levelY(level), next], delay + 0.25);
      }
      for (let level = 0; level < YARD_LEVELS; level++) {
        const flip = (bay + level) % 2;
        for (const x of [-YARD_W, YARD_W]) {
          beam(bracing, [x, levelY(level), flip ? z : next], [x, levelY(level + 1), flip ? next : z], delay + 0.4);
        }
      }
    });
    // Pisos: plataformas macizas a lo largo del túnel en cada nivel de las
    // columnas. Lo que queda detrás de la cámara se recorta
    const plates: { points: number[][]; alpha: number }[] = [];
    for (let level = 1; level < YARD_LEVELS; level++) {
      const y = levelY(level);
      const t = grow(0.3 + (level / YARD_LEVELS) * 0.25);
      if (t <= 0) continue;
      for (const [from, to] of [[-outerW, -YARD_W], [YARD_W, outerW]]) {
        const depth = front - (front - rear) * t;
        const corners = [[from, y, front], [to, y, front], [to, y, depth], [from, y, depth]].map(([x, py, z]) => view(x, py, z));
        const clipped: (readonly number[])[] = [];
        corners.forEach((point, index) => {
          const other = corners[(index + 1) % corners.length];
          if (point[2] >= NEAR) clipped.push(point);
          if ((point[2] >= NEAR) !== (other[2] >= NEAR)) {
            const k = (NEAR - point[2]) / (other[2] - point[2]);
            clipped.push([point[0] + (other[0] - point[0]) * k, point[1] + (other[1] - point[1]) * k, NEAR]);
          }
        });
        if (clipped.length < 3) continue;
        plates.push({ points: clipped.map(([x, py, d]) => [cx + (scale * x) / d, cy + (scale * py) / d]), alpha: 1 });
      }
    }

    // Grúas torre sobre el techo del andamio, como en un edificio en obra:
    // el mástil enrejado con su cabina, la pluma en celosía tendida sobre la
    // boca hacia el otro lado, la contrapluma con su contrapeso y los
    // tirantes. Son las que bajan las teselas (más abajo, sus cables)
    const blocks: number[][][] = [];
    const block = (corners: number[][]) => {
      const points = corners.map(([x, y, z]) => view(x, y, z));
      if (points.some(([, , d]) => d < NEAR)) return;
      blocks.push(points.map(([x, y, d]) => [cx + (scale * x) / d, cy + (scale * y) / d]));
    };
    const { mast, sections } = YARD_TOWER;
    YARD_CRANES.forEach((crane, index) => {
      const { x: towerX, z: towerZ, side } = crane;
      const base = -outerH;
      const towerTop = -outerH - crane.height;
      const delay = index * 0.05;
      // El pie: una zapata sobre el techo del andamio
      if (grow(0.55 + delay) > 0) {
        block([
          [towerX - mast * 2.2, base, towerZ + mast],
          [towerX + mast * 2.2, base, towerZ + mast],
          [towerX + mast * 2.2, base - 0.02, towerZ + mast],
          [towerX - mast * 2.2, base - 0.02, towerZ + mast],
        ]);
      }
      // El mástil: cuatro cordones, peldaños en cada tramo y diagonales
      const corners = [[-mast, -mast], [mast, -mast], [mast, mast], [-mast, mast]];
      corners.forEach(([dx, dz], corner) => beam(frame, [towerX + dx, base, towerZ + dz], [towerX + dx, towerTop, towerZ + dz], 0.55 + delay + corner * 0.02));
      for (let level = 0; level < sections; level++) {
        const low = base - (level / sections) * (base - towerTop);
        const high = base - ((level + 1) / sections) * (base - towerTop);
        const order = 0.58 + delay + (level / sections) * 0.15;
        const flip = level % 2 ? 1 : -1;
        beam(bracing, [towerX - mast, high, towerZ + mast], [towerX + mast, high, towerZ + mast], order);
        beam(bracing, [towerX - mast * flip, low, towerZ + mast], [towerX + mast * flip, high, towerZ + mast], order);
      }
      // La corona de giro, arriba del mástil
      if (grow(0.72 + delay) > 0) {
        block([
          [towerX - mast * 1.6, towerTop + 0.022, towerZ + mast],
          [towerX + mast * 1.6, towerTop + 0.022, towerZ + mast],
          [towerX + mast * 1.6, towerTop, towerZ + mast],
          [towerX - mast * 1.6, towerTop, towerZ + mast],
        ]);
      }

      // Todo lo de arriba gira sobre el mástil, de ida y vuelta
      const slew = craneSlew(p, index);
      const dirX = side * Math.cos(slew);
      const dirZ = Math.sin(slew);
      const along = (length: number, y: number) => [towerX + dirX * length, y, towerZ + dirZ * length];
      const { jib, counter, panels } = YARD_TOWER;
      const deck = towerTop - 0.005;
      const chord = towerTop - 0.065;
      const order = 0.75 + delay;
      // Pluma en celosía: el cordón de abajo recto, el de arriba baja hacia
      // la punta, y diagonales entre ambos
      const upper = (length: number) => chord + (deck - 0.02 - chord) * (length / jib);
      beam(frame, along(0, deck), along(jib, deck), order);
      beam(frame, along(0, chord), along(jib, upper(jib)), order);
      beam(frame, along(jib, deck), along(jib, upper(jib)), order + 0.04);
      for (let panel = 0; panel < panels; panel++) {
        const a = (panel / panels) * jib;
        const b2 = ((panel + 1) / panels) * jib;
        beam(bracing, along(a, panel % 2 ? upper(a) : deck), along(b2, panel % 2 ? deck : upper(b2)), order + 0.04);
      }
      // Contrapluma, más corta y robusta
      beam(frame, along(0, deck), along(-counter, deck), order);
      beam(frame, along(0, chord + 0.02), along(-counter, deck - 0.03), order);
      for (let panel = 0; panel < 3; panel++) {
        beam(bracing, along((-panel / 3) * counter, panel % 2 ? deck - 0.03 : deck), along((-(panel + 1) / 3) * counter, panel % 2 ? deck : deck - 0.03), order + 0.04);
      }
      // La torreta en A y los tirantes hacia la pluma y la contrapluma
      const peak = towerTop - 0.22;
      beam(frame, along(-0.04, chord), along(0, peak), order + 0.02);
      beam(frame, along(0.04, chord), along(0, peak), order + 0.02);
      beam(bracing, along(0, peak), along(jib * 0.45, upper(jib * 0.45)), order + 0.06);
      beam(bracing, along(0, peak), along(jib * 0.85, upper(jib * 0.85)), order + 0.06);
      beam(bracing, along(0, peak), along(-counter, deck - 0.03), order + 0.06);
      if (grow(order + 0.08) >= 1) {
        // La cabina junto a la raíz de la pluma
        const cabin = [along(0.03, deck), along(0.13, deck)];
        block([
          [cabin[0][0], deck + 0.005, cabin[0][2]],
          [cabin[1][0], deck + 0.005, cabin[1][2]],
          [cabin[1][0], deck + 0.07, cabin[1][2]],
          [cabin[0][0], deck + 0.07, cabin[0][2]],
        ]);
        // El contrapeso: un solo bloque al final de la contrapluma
        const from = along(-counter * 0.6, deck);
        const to = along(-counter, deck);
        block([
          [from[0], deck + 0.005, from[2]],
          [to[0], deck + 0.005, to[2]],
          [to[0], deck + 0.06, to[2]],
          [from[0], deck + 0.06, from[2]],
        ]);
      }
    });

    context.lineCap = 'round';
    context.globalCompositeOperation = 'lighter';
    context.globalCompositeOperation = 'source-over';
    // Los pisos: una placa oscura con su canto encendido
    plates.forEach(({ points, alpha }) => {
      context.beginPath();
      points.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
      context.closePath();
      context.fillStyle = `rgba(8, 12, 10, ${(0.85 * alpha).toFixed(3)})`;
      context.fill();
      context.strokeStyle = color(0.35 * alpha, 0.3);
      context.lineWidth = 0.8;
      context.stroke();
    });
    // Bloques macizos de las grúas: cabinas, contrapesos y las piezas que cuelgan
    blocks.forEach((points) => {
      context.beginPath();
      points.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
      context.closePath();
      context.fillStyle = 'rgba(10, 15, 12, 0.96)';
      context.fill();
      context.strokeStyle = color(0.7, 0.45);
      context.lineWidth = 1;
      context.stroke();
    });
    // Cada viga como un perfil macizo: cuerpo oscuro que tapa lo de atrás,
    // el canto que mira al sol (arriba a la derecha) encendido y el otro en
    // sombra. Su grosor sigue la perspectiva
    const solid = (path: Path2D, thick: number, light: number) => {
      const shade = new Path2D();
      const lit = new Path2D();
      const dark = new Path2D();
      (solids.get(path) ?? []).forEach(([ax, ay, ad, bx, by, bd]) => {
        const length = Math.hypot(bx - ax, by - ay) || 1;
        let nx = -(by - ay) / length;
        let ny = (bx - ax) / length;
        if (nx * 0.6 - ny * 0.8 < 0) {
          nx = -nx;
          ny = -ny;
        }
        const wa = Math.max(0.7, (scale * thick) / ad);
        const wb = Math.max(0.7, (scale * thick) / bd);
        shade.moveTo(ax + nx * wa, ay + ny * wa);
        shade.lineTo(bx + nx * wb, by + ny * wb);
        shade.lineTo(bx - nx * wb, by - ny * wb);
        shade.lineTo(ax - nx * wa, ay - ny * wa);
        shade.closePath();
        lit.moveTo(ax + nx * wa, ay + ny * wa);
        lit.lineTo(bx + nx * wb, by + ny * wb);
        dark.moveTo(ax - nx * wa, ay - ny * wa);
        dark.lineTo(bx - nx * wb, by - ny * wb);
      });
      context.fillStyle = 'rgba(6, 10, 9, 0.94)';
      context.fill(shade);
      context.lineWidth = 1;
      context.strokeStyle = color(0.16 * light, 0.1);
      context.stroke(dark);
      context.strokeStyle = color(0.85 * light, 0.5);
      context.stroke(lit);
    };
    solid(bracing, 0.01, 0.55);
    solid(frame, 0.03, 1);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'lighter';

    // Las grúas bajan las teselas: el carro corre por la pluma hasta quedar
    // sobre la tesela que llega y su cable la acompaña el último tramo
    if (built >= 1) {
      const hoists = new Path2D();
      YARD_TILES.forEach((tile) => {
        const flight = yardFlight(tile, p);
        if (flight < 0.55 || flight >= 1) return;
        const tx = box.left + (tile.col + 0.5) * (box.width / YARD_COLS);
        const ty = box.top + (tile.row + 0.5) * (box.height / YARD_ROWS);
        // El carro se pone sobre la tesela, a lo largo de la pluma girada
        const which = tile.col < YARD_COLS / 2 ? 0 : 1;
        const crane = YARD_CRANES[which];
        const slew = craneSlew(p, which);
        const dirX = crane.side * Math.cos(slew);
        const reach = Math.max(0.1, Math.min(YARD_TOWER.jib, (((tx - cx) * back) / scale - crane.x) / dirX));
        const [hx, hy, hd] = view(crane.x + dirX * reach, -YARD_H - YARD_MARGIN - crane.height, crane.z + Math.sin(slew) * reach);
        if (hd <= NEAR) return;
        const trolleyX = cx + (scale * hx) / hd;
        const trolleyY = cy + (scale * hy) / hd;
        const t = easeInOut((flight - 0.55) / 0.45);
        const [x, y] = [trolleyX + (tx - trolleyX) * t, trolleyY + (ty - trolleyY) * t];
        hoists.moveTo(trolleyX, trolleyY);
        hoists.lineTo(x, y);
        hoists.rect(trolleyX - 3, trolleyY - 2, 6, 4);
      });
      context.lineWidth = 1;
      context.strokeStyle = color(0.6, 0.6);
      context.stroke(hoists);
    }

    // El fondo ya de frente: la grilla de lo que falta por armar
    const building = seg(p, [YARD.build[0] - 0.02, YARD.build[0]]) * (1 - seg(p, [YARD.build[1], YARD.build[1] + 0.02]));
    const cellWidth = box.width / YARD_COLS;
    const cellHeight = box.height / YARD_ROWS;
    if (building > 0) {
      const empty = new Path2D();
      YARD_TILES.forEach((tile) => {
        if (yardFlight(tile, p) >= 1) return;
        empty.rect(box.left + tile.col * cellWidth, box.top + tile.row * cellHeight, cellWidth, cellHeight);
      });
      context.lineWidth = 0.6;
      context.strokeStyle = color(0.14 * building, 0.2);
      context.stroke(empty);
    }

    // Las teselas en vuelo y sus remolcadores. Cada una muestra el trozo de
    // la imagen que va a tapar, como se verá al calzar
    context.globalCompositeOperation = 'source-over';
    const photo = picture.current;
    const ready = Boolean(photo?.complete && photo.naturalWidth > 1);
    const zoom = portalImageScale(p);
    const fit = ready && photo ? Math.max(width / photo.naturalWidth, height / photo.naturalHeight) : 1;
    const toImage = (x: number, y: number) => {
      const u = width / 2 + (x - width / 2) / zoom;
      const v = height / 2 + (y - height / 2) / zoom;
      return [(u - (width - (photo?.naturalWidth ?? 0) * fit) / 2) / fit, (v - (height - (photo?.naturalHeight ?? 0) * fit) / 2) / fit];
    };
    const lead = Math.max(cellWidth, cellHeight) * 0.6 + 12;
    YARD_TILES.forEach((tile) => {
      const flight = yardFlight(tile, p);
      const away = tile.tug >= 0 ? seg(p, [tile.launch + YARD_FLIGHT, tile.launch + YARD_FLIGHT + 0.03]) : 1;
      if (flight <= 0 || (flight >= 1 && away >= 1)) return;
      const targetX = box.left + (tile.col + 0.5) * cellWidth;
      const targetY = box.top + (tile.row + 0.5) * cellHeight;
      const startX = tile.side < 0 ? -cellWidth * 2 : width + cellWidth * 2;
      const startY = cy + tile.height * height * 0.9;
      const along = (t: number) => {
        const eased = easeInOut(t);
        return [
          startX + (targetX - startX) * eased,
          startY + (targetY - startY) * eased + Math.sin(Math.PI * t) * tile.arc * height,
        ] as const;
      };
      const [x, y] = along(flight);
      if (flight < 1) {
        const grow = easeInOut(flight);
        context.setTransform(ratio, 0, 0, ratio, x * ratio, y * ratio);
        context.rotate(tile.spin * (1 - grow));
        context.scale(0.5 + 0.5 * grow, 0.5 + 0.5 * grow);
        const halfWidth = cellWidth / 2 + 0.25;
        const halfHeight = cellHeight / 2 + 0.25;
        if (ready && photo) {
          const [sx, sy] = toImage(targetX - halfWidth, targetY - halfHeight);
          const [ex, ey] = toImage(targetX + halfWidth, targetY + halfHeight);
          context.drawImage(photo, sx, sy, ex - sx, ey - sy, -halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);
        } else {
          context.fillStyle = '#12161a';
          context.fillRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);
        }
        // Un filo de luz que se apaga al calzar
        context.lineWidth = 1;
        context.strokeStyle = color(0.75 * (1 - grow), 0.6);
        context.strokeRect(-halfWidth + 0.5, -halfHeight + 0.5, halfWidth * 2 - 1, halfHeight * 2 - 1);
      }
      if (tile.tug < 0) return;
      // El remolcador va delante de su tesela; al soltarla sigue de largo y se apaga
      const [aheadX, aheadY] = along(Math.min(1, flight + 0.03));
      let headingX = aheadX - x;
      let headingY = aheadY - y;
      if (Math.hypot(headingX, headingY) < 0.5) {
        headingX = targetX - startX;
        headingY = targetY - startY;
      }
      const length = Math.hypot(headingX, headingY) || 1;
      const dx = headingX / length;
      const dy = headingY / length;
      const drift = away * away * Math.max(width, height) * 0.5;
      const tugX = x + dx * (lead + drift) - dy * drift * 0.4 * tile.side;
      const tugY = y + dy * (lead + drift) + dx * drift * 0.4 * tile.side;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (flight < 1) {
        context.strokeStyle = 'rgba(255, 240, 222, 0.45)';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(tugX - dx * 14, tugY - dy * 14);
        context.lineTo(x, y);
        context.stroke();
      }
      context.setTransform(ratio, 0, 0, ratio, tugX * ratio, tugY * ratio);
      context.rotate(Math.atan2(dy, dx));
      context.globalAlpha = 1 - away;
      drawTug(context, tile.tug);
      context.globalAlpha = 1;
    });

    // Soldadura: al calzar, cada tesela suelta un destello y unas chispas
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.globalCompositeOperation = 'lighter';
    YARD_TILES.forEach((tile, index) => {
      const weld = seg(p, [tile.launch + YARD_FLIGHT, tile.launch + YARD_FLIGHT + 0.014]);
      if (weld <= 0 || weld >= 1) return;
      const x = box.left + (tile.col + 0.5) * cellWidth;
      const y = box.top + (tile.row + 0.5) * cellHeight;
      const glow = 1 - weld;
      const halo = context.createRadialGradient(x, y, 0, x, y, cellWidth * 0.6);
      halo.addColorStop(0, `rgba(255, 244, 220, ${(0.55 * glow).toFixed(3)})`);
      halo.addColorStop(0.2, `rgba(255, 190, 120, ${(0.18 * glow).toFixed(3)})`);
      halo.addColorStop(1, 'rgba(255, 150, 80, 0)');
      context.fillStyle = halo;
      context.fillRect(x - cellWidth, y - cellWidth, cellWidth * 2, cellWidth * 2);
      context.strokeStyle = `rgba(255, 214, 160, ${(0.9 * glow).toFixed(3)})`;
      context.lineWidth = 1;
      context.beginPath();
      for (let spark = 0; spark < 5; spark++) {
        const angle = seeded(index * 13 + spark) * Math.PI * 2;
        const reach = cellWidth * (0.3 + 0.9 * weld) * (0.6 + seeded(index * 7 + spark) * 0.6);
        const sx = x + Math.cos(angle) * reach;
        // Caen un poco, como chispas
        const sy = y + Math.sin(angle) * reach + weld * weld * cellHeight * 0.6;
        context.moveTo(sx, sy);
        context.lineTo(sx - Math.cos(angle) * 4, sy - Math.sin(angle) * 4);
      }
      context.stroke();
    });
    context.globalCompositeOperation = 'source-over';

    // El marco del fondo: un borde nítido con halo alrededor de la imagen
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (yaw < 0.01) {
      context.globalCompositeOperation = 'lighter';
      context.strokeStyle = color(0.12, 0.2);
      context.lineWidth = 10;
      context.strokeRect(box.left, box.top, box.width, box.height);
      context.strokeStyle = color(0.85, 0.6);
      context.lineWidth = 1.2;
      context.strokeRect(box.left, box.top, box.width, box.height);
      context.globalCompositeOperation = 'source-over';
    }
  }, []);

  useMotionValueEvent(progress, 'change', draw);
  useEffect(() => {
    if (!image) return;
    const photo = new Image();
    photo.decoding = 'async';
    photo.src = image;
    picture.current = photo;
    photo.onload = () => draw(progress.get());
    return () => {
      photo.onload = null;
    };
  }, [image, progress, draw]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    tint.current = accentRgb(canvas);
    const measure = () => {
      const width = canvas.clientWidth || 1;
      const height = canvas.clientHeight || 1;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      size.current = { width, height, ratio };
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      draw(progress.get());
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [progress, draw]);

  return <motion.canvas ref={canvasRef} className="mo-journey-stage is-yard" style={{ opacity }} aria-hidden="true" />;
};

/* ---------------- Horizonte: del planeta entero a su superficie ---------------- */

const PLASMA_STREAKS = Array.from({ length: 70 }, (_, index) => ({
  angle: (seeded(index + 3301) - 0.5) * 1.9,
  phase: seeded(index + 3407),
  width: 0.8 + seeded(index + 3511) * 1.4,
}));
// El plasma que pasa junto a la cápsula, por los bordes de la pantalla
const EDGE_STREAKS = Array.from({ length: 56 }, (_, index) => ({
  angle: seeded(index + 3613) * Math.PI * 2,
  phase: seeded(index + 3719),
  width: 0.8 + seeded(index + 3821) * 1.8,
}));
// Las nubes del final: nacen cerca del horizonte y pasan a nuestro lado,
// más por abajo que por arriba, unas tras otras
// (a un lado y al otro, para que no se amontonen en el centro)
const CLOUDS = Array.from({ length: 16 }, (_, index) => ({
  dx: (index % 2 ? 1 : -1) * (0.45 + seeded(index + 3923) * 1.3),
  dy: -0.25 + seeded(index + 4231) * 0.85,
  start: (index / 16) * 0.5 + seeded(index + 4027) * 0.06,
  size: 0.8 + seeded(index + 4129) * 0.6,
}));

const HorizonRim = ({ progress }: { progress: MotionValue<number> }) => {
  const worldRef = useRef<SVGGElement>(null);
  const edgeRefs = useRef<(SVGLineElement | null)[]>([]);
  const fireRef = useRef<HTMLDivElement>(null);
  const cloudRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lastRoll = useRef(Number.NaN);
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

    // La cámara: el mundo rueda, gira hacia el planeta y tiembla; el cielo
    // de fondo rueda con él
    const camera = reentryCamera(p, width, height);
    const degrees = (camera.roll * 180) / Math.PI;
    worldRef.current?.setAttribute(
      'transform',
      `translate(${camera.shakeX.toFixed(2)} ${camera.shakeY.toFixed(2)}) rotate(${degrees.toFixed(3)}) translate(${camera.panX.toFixed(1)} ${camera.panY.toFixed(1)})`,
    );
    const delta = camera.roll - lastRoll.current;
    if (Math.abs(delta) < 1) {
      skyDrift.spin.x = width / 2;
      skyDrift.spin.y = height / 2;
      skyDrift.spin.depth = 0;
      skyDrift.spin.angle += delta;
    }
    lastRoll.current = camera.roll;

    // Dentro del fuego: el borde de la pantalla arde y el plasma corre hacia
    // afuera por los costados. Va pegado a la cámara, no al mundo
    const heat = reentryHeat(p);
    const fire = fireRef.current;
    if (fire) {
      fire.style.opacity = (heat * (0.88 + 0.12 * Math.sin(p * 520))).toFixed(3);
      fire.style.visibility = heat > 0.005 ? 'visible' : 'hidden';
    }
    const corner = Math.hypot(width, height) / 2;
    EDGE_STREAKS.forEach((streak, index) => {
      const line = edgeRefs.current[index];
      if (!line) return;
      const travel = (streak.phase + p * 16) % 1;
      const near = corner * (0.5 + 0.55 * travel);
      const far = near + corner * (0.05 + 0.18 * heat) * (0.4 + travel);
      const cos = Math.cos(streak.angle);
      const sin = Math.sin(streak.angle);
      line.setAttribute('x1', (cos * near).toFixed(1));
      line.setAttribute('y1', (sin * near).toFixed(1));
      line.setAttribute('x2', (cos * far).toFixed(1));
      line.setAttribute('y2', (sin * far).toFixed(1));
      line.setAttribute('stroke-width', streak.width.toFixed(2));
      line.setAttribute('opacity', (0.8 * heat * travel ** 1.2).toFixed(3));
    });

    // Las nubes: cada una se acerca desde el horizonte (su distancia al punto
    // de fuga y su tamaño crecen como 1/z) y se desvanece al pasarnos
    const crossing = seg(p, REENTRY.clouds);
    CLOUDS.forEach((cloud, index) => {
      const puff = cloudRefs.current[index];
      if (!puff) return;
      const t = seg(crossing, [cloud.start, cloud.start + 0.5]);
      if (t <= 0 || t >= 1) {
        puff.style.visibility = 'hidden';
        return;
      }
      const z = 0.7 - 0.6 * t;
      const spread = (base * 0.14) / z;
      const [x, y] = reentryPlace(camera, cloud.dx * spread, height * 0.06 + cloud.dy * spread);
      puff.style.visibility = 'visible';
      puff.style.opacity = (0.45 * Math.sin(Math.PI * t) ** 1.1).toFixed(3);
      puff.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${degrees.toFixed(2)}deg) scale(${((base * 0.0014 * cloud.size) / z).toFixed(3)})`;
    });
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
    const entry = heat;
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
    <>
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
        <g ref={worldRef}>
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
        </g>
        {EDGE_STREAKS.map((_, index) => (
          <line key={index} className="is-edge" ref={(element) => { edgeRefs.current[index] = element; }} />
        ))}
      </motion.svg>
      {CLOUDS.map((_, index) => (
        <div key={index} className="mo-reentry-cloud" ref={(element) => { cloudRefs.current[index] = element; }} aria-hidden="true" />
      ))}
      <div ref={fireRef} className="mo-reentry-fire" aria-hidden="true" />
    </>
  );
};

/* ---------------- Agujero negro: caemos al otro lado ---------------- */

const BlackHole = ({ progress }: { progress: MotionValue<number> }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const size = useRef({ width: 1, height: 1, ratio: 1 });
  const tint = useRef<number[]>([255, 122, 89]);
  const lastRoll = useRef(Number.NaN);
  const opacity = useTransform(
    progress,
    [JOURNEY_OPEN[0], JOURNEY_OPEN[0] + 0.03, JOURNEY_COVER[0] + 0.08, JOURNEY_COVER[0] + 0.18],
    [0, 1, 1, 0],
  );

  const draw = useCallback((p: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const { width, height, ratio } = size.current;

    // El cielo de fondo gira con la cámara, alrededor del agujero
    const roll = holeRoll(p);
    const delta = roll - lastRoll.current;
    if (Math.abs(delta) < 1) {
      const [shiftX, shiftY] = holeCenter(p, width, height);
      skyDrift.spin.x = width / 2 + shiftX;
      skyDrift.spin.y = height / 2 + shiftY;
      skyDrift.spin.depth = 0;
      skyDrift.spin.angle -= delta;
    }
    lastRoll.current = roll;

    const { radius, opening } = holeParts(p, width, height);
    // El resplandor del gas caliente va aparte, en CSS: solo se mueve y se
    // escala, sin repintar un degradado enorme en cada cuadro
    const glow = glowRef.current;
    if (glow) {
      const [shiftX, shiftY] = holeCenter(p, width, height);
      glow.style.transform = `translate(${shiftX.toFixed(1)}px, ${shiftY.toFixed(1)}px) scale(${((radius * 6.8) / 200).toFixed(3)})`;
      const shine = holeGlow(p);
      glow.style.opacity = shine.toFixed(3);
      // Apagado, ni siquiera se compone
      glow.style.visibility = shine > 0.005 ? 'visible' : 'hidden';
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (p > JOURNEY_COVER[0] + 0.18 || p < JOURNEY_OPEN[0]) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawHole(context, p, width, height, tint.current, radius, opening);
  }, []);

  useMotionValueEvent(progress, 'change', draw);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    tint.current = accentRgb(canvas);
    const measure = () => {
      const width = canvas.clientWidth || 1;
      const height = canvas.clientHeight || 1;
      // Resolución normal, sin la doble de las pantallas densas: la caída
      // mueve muchos trazos largos y en movimiento no se nota
      const ratio = 1;
      size.current = { width, height, ratio };
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      draw(progress.get());
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [progress, draw]);

  return (
    <>
      <div ref={glowRef} className="mo-hole-glow" aria-hidden="true" />
      <motion.canvas ref={canvasRef} className="mo-journey-stage is-blackhole" style={{ opacity }} aria-hidden="true" />
    </>
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

/* ---------------- Propulsión: seguimos a la nave hasta la luz ---------------- */

const PropulsionChase = ({ progress }: { progress: MotionValue<number> }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ width: 1, height: 1, ratio: 1 });
  const tint = useRef<number[]>([84, 160, 255]);
  const lastBank = useRef(Number.NaN);
  const opacity = useTransform(
    progress,
    [JOURNEY_OPEN[0], JOURNEY_OPEN[0] + 0.03, JOURNEY_COVER[0] + 0.08, JOURNEY_COVER[0] + 0.18],
    [0, 1, 1, 0],
  );

  const draw = useCallback((p: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const { width, height, ratio } = size.current;

    // El cielo se ladea con la cámara en la curva
    const bank = chaseBank(p);
    const delta = bank - lastBank.current;
    if (Math.abs(delta) < 1) {
      skyDrift.spin.x = width / 2;
      skyDrift.spin.y = height / 2;
      skyDrift.spin.depth = 0;
      skyDrift.spin.angle -= delta;
    }
    lastBank.current = bank;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (p > JOURNEY_COVER[0] + 0.18 || p < JOURNEY_OPEN[0]) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const opening = seg(p, CHASE.open) > 0 ? toPx(chaseParts(p)) : 0;
    drawChase(context, p, width, height, tint.current, opening);
  }, []);

  useMotionValueEvent(progress, 'change', draw);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    tint.current = accentRgb(canvas);
    const measure = () => {
      const width = canvas.clientWidth || 1;
      const height = canvas.clientHeight || 1;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      size.current = { width, height, ratio };
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      draw(progress.get());
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [progress, draw]);

  return <motion.canvas ref={canvasRef} className="mo-journey-stage is-chase" style={{ opacity }} aria-hidden="true" />;
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

/* ---------------- Civilizaciones: la escala de Kardashev en una toma ---------------- */

const KardashevZoom = ({ progress }: { progress: MotionValue<number> }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const groundRef = useRef<HTMLDivElement>(null);
  const hazeRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const size = useRef({ width: 1, height: 1, ratio: 1 });
  const tint = useRef<number[]>([240, 92, 255]);
  const lastTurn = useRef(Number.NaN);
  const opacity = useTransform(
    progress,
    [JOURNEY_OPEN[0], JOURNEY_OPEN[0] + 0.03, JOURNEY_COVER[0] + 0.08, JOURNEY_COVER[0] + 0.18],
    [0, 1, 1, 0],
  );

  const draw = useCallback((p: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const { width, height, ratio } = size.current;

    // El cielo de fondo gira con la cámara
    const turn = kardashevTurn(p);
    const delta = turn - lastTurn.current;
    if (Math.abs(delta) < 1) {
      skyDrift.spin.x = width / 2;
      skyDrift.spin.y = height / 2;
      skyDrift.spin.depth = 0;
      skyDrift.spin.angle -= delta;
    }
    lastTurn.current = turn;

    // Sobre la ciudad no hay cielo: se apagan las constelaciones y los
    // meteoros de la capa de efectos, que va por encima de los portales
    const fx = document.querySelector<HTMLElement>('.mo-starfx');
    if (fx) {
      const dim = p > JOURNEY_OPEN[0] && p < JOURNEY_COVER[0] ? kardashevSkyDim(p) : 0;
      fx.style.opacity = dim > 0 ? (1 - dim).toFixed(3) : '';
    }

    // El suelo y el resplandor de la ciudad: capas que solo se mueven
    const ground = kardashevGround(p, width, height);
    if (groundRef.current) groundRef.current.style.opacity = String(ground.cover);
    if (hazeRef.current) hazeRef.current.style.opacity = ground.haze.toFixed(3);
    const glow = glowRef.current;
    if (glow) {
      glow.style.opacity = ground.warmth.toFixed(3);
      glow.style.visibility = ground.warmth > 0.005 ? 'visible' : 'hidden';
      glow.style.transform = `translate(${ground.x.toFixed(1)}px, ${ground.y.toFixed(1)}px) scale(${(ground.radius / 100).toFixed(3)}, ${((ground.radius * ground.squash) / 100).toFixed(3)})`;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (p > JOURNEY_COVER[0] + 0.18 || p < JOURNEY_OPEN[0]) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const opening = seg(p, KARDASHEV.open) > 0 ? toPx(kardashevParts(p)) : 0;
    drawKardashev(context, p, width, height, tint.current, opening);
  }, []);

  useMotionValueEvent(progress, 'change', draw);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    tint.current = accentRgb(canvas);
    const measure = () => {
      const width = canvas.clientWidth || 1;
      const height = canvas.clientHeight || 1;
      // Resolución normal: el viaje mueve miles de luces y en movimiento
      // la doble resolución no se nota
      const ratio = 1;
      size.current = { width, height, ratio };
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      draw(progress.get());
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      const fx = document.querySelector<HTMLElement>('.mo-starfx');
      if (fx) fx.style.opacity = '';
    };
  }, [progress, draw]);

  return (
    <motion.div className="mo-journey-stage is-kardashev" style={{ opacity }} aria-hidden="true">
      <div ref={groundRef} className="mo-kardashev-ground" />
      <div ref={hazeRef} className="mo-kardashev-haze" />
      <div ref={glowRef} className="mo-kardashev-glow" />
      <canvas ref={canvasRef} />
    </motion.div>
  );
};

/* Capa decorativa del viaje, encima de la imagen y bajo el número */
export const JourneyOverlay = ({
  kind,
  progress,
  label,
  image,
}: {
  kind: JourneyKind;
  progress: MotionValue<number>;
  label: string;
  // La imagen del capítulo, para los viajes que la dibujan por partes
  image?: string;
}) => {
  switch (kind) {
    case 'collapse':
      return <StarCollapse progress={progress} />;
    case 'torus':
      return <HabitatDock progress={progress} />;
    case 'blueprint':
      return <Shipyard progress={progress} image={image} />;
    case 'horizon':
      return <HorizonRim progress={progress} />;
    case 'dyson':
      return <DysonEclipse progress={progress} />;
    case 'starburst':
      return <BlackHole progress={progress} />;
    case 'tunnel':
      return <PropulsionChase progress={progress} />;
    case 'galaxy':
      return <KardashevZoom progress={progress} />;
    case 'signal':
      return <SignalSearch progress={progress} label={label} />;
    default:
      return <IrisRing progress={progress} />;
  }
};
