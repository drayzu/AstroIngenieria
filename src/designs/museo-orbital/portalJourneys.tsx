import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelFrame, frame, motion, useTransform, type MotionValue } from 'framer-motion';
import { HOLE, holeCenter, holeFocal, holeRadius, holeRoll, holeSkyHidden, paintHole, prepareHole } from './blackHoleFall';
import { SWARM, drawSwarm, prepareSwarm, starRadius, swarmFocal, swarmRoll, swarmSkyHidden } from './dysonSwarm';
import { drawHabitat, habitatFocal, habitatRoll, habitatSkyHidden, habitatWindow } from './habitatFlyby';
import { CHASE, CHASE_HOLDS, chaseBank, chaseFocal, chaseSkyHidden, drawChase } from './propulsionChase';
import { KARDASHEV, drawKardashev, kardashevFocal, kardashevGround, kardashevSkyDim, kardashevTurn, prepareKardashev } from './kardashevZoom';
import { DISH, dishFocal, dishRoll, dishSkyCover, drawDish } from './radioDish';
import { SHIELD, drawShield, marsRadius, shieldFocal, shieldSkyHidden } from './magneticShield';
import { skyCovers, skyDrift } from './roomShared';
import { lookMoving, lookShift, onLook } from './lookAround';
import { drawShipyard, yardClip, yardFocal, yardRoll, yardSkyHidden } from './orbitalShipyard';
import { drawScaffold, scaffoldRoll, scaffoldSkyHidden, scaffoldWindow } from './skyScaffold';

/* Viajes de los portales: cada capítulo abre su ventana de una forma
   distinta, siempre con trazos finos de luz. Comparten el mismo guion:
   la ventana se abre (OPEN) y luego cubre la pantalla (COVER). */

export type JourneyKind =
  | 'scaffold'
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
  // De la portada a la primera sala: la constelación era un andamio
  intro: 'scaffold',
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
  // El andamio: la constelación, el paralaje, la ola de vigas y la celda
  scaffold: [{ range: [0.03, 0.27], extra: 70 }],
  // El astillero: la imagen se arma al fondo del dique
  // y antes, bajar la vista sobre la Tierra y rodear el dique
  blueprint: [
    { range: [0.02, 0.12], extra: 60 },
    { range: [0.12, 0.28], extra: 70 },
  ],
  // El atraque: rozar el anillo, rodearlo hasta su eje, igualar el giro y
  // entrar por el túnel del cubo
  torus: [
    { range: [0.03, 0.2], extra: 90 },
    { range: [0.2, 0.29], extra: 60 },
  ],
  // El enjambre: acercarse a la estrella, cruzar el anillo a contraluz,
  // volar junto a él mientras la ola lo despliega (el tramo más largo) y
  // virar hacia la estrella
  dyson: [
    { range: [0.02, 0.085], extra: 50 },
    { range: [0.085, 0.128], extra: 70 },
    { range: [0.128, 0.205], extra: 210 },
    { range: [0.205, 0.27], extra: 30 },
  ],
  // La caída: llegar al agujero negro y volar rasante sobre su disco (el
  // tramo más largo), y zambullirse en el remolino
  starburst: [
    { range: [0.03, 0.2], extra: 170 },
    { range: [0.2, 0.27], extra: 70 },
  ],
  // Kardashev: subir de la ciudad al planeta, a la estrella y a la galaxia
  galaxy: [{ range: [0.03, 0.27], extra: 110 }],
  // La persecución: los tramos viven junto a su guion, que los usa para
  // rodar la cámara a ritmo parejo de scroll
  tunnel: CHASE_HOLDS,
  // El escudo: llegar con el viento mientras la burbuja se abre, el choque y
  // la espiral sobre la línea de campo (el tramo más largo) y la calma
  horizon: [
    { range: [0.03, 0.104], extra: 90 },
    { range: [0.104, 0.2], extra: 170 },
    { range: [0.2, 0.29], extra: 50 },
  ],
  // La antena: bajar la vista, avanzar por los rieles entre la ola de
  // antenas y quedar tras la principal
  signal: [
    { range: [0.02, 0.09], extra: 210 },
    { range: [0.09, 0.17], extra: 140 },
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

/* Mientras el lienzo opaco del viaje cubre la pantalla entera (ya encendido
   y antes de que la ventana cubra), el cielo de la página descansa */
const coverSky = (key: object, p: number) => {
  if (p > JOURNEY_OPEN[0] + 0.03 && p < JOURNEY_COVER[0]) skyCovers.add(key);
  else skyCovers.delete(key);
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

/* Energía: la ventana se abre en el disco de la estrella y, al cubrir, crece con él */
const sunParts = (p: number, width: number, height: number) => {
  const opening = starRadius(p, width, height) * easeOut(seg(p, SWARM.open));
  return opening > 0 ? opening + toPx({ min: 0, max: 76 * easeInOut(seg(p, JOURNEY_COVER)) }) : 0;
};

/* Planetaria: la ventana se abre en el disco de Marte y, al cubrir, crece con él */
const marsParts = (p: number, width: number, height: number) => {
  const opening = marsRadius(p, width, height) * easeOut(seg(p, SHIELD.open));
  return opening > 0 ? opening + toPx({ min: 0, max: 76 * easeInOut(seg(p, JOURNEY_COVER)) }) : 0;
};

/* Lente de cada viaje (px): con ella se sabe dónde queda su ventana cuando
   el visitante gira la cabeza. La ventana se abre en lo que la cámara mira */
const journeyFocal = (kind: JourneyKind, p: number, width: number, height: number) => {
  switch (kind) {
    case 'torus':
      return habitatFocal(width, height);
    case 'horizon':
      return shieldFocal(width, height);
    case 'dyson':
      return swarmFocal(p, width, height);
    case 'starburst':
      return holeFocal(p, width, height);
    case 'tunnel':
      return chaseFocal(p, width, height);
    case 'galaxy':
      return kardashevFocal(width, height);
    case 'signal':
      return dishFocal(width, height);
    case 'blueprint':
      return yardFocal(width, height);
    default:
      // El andamio y el iris: el lente de la página
      return 0.62 * Math.min(width, height);
  }
};

// Cuánto se corre la ventana del viaje con la mirada (px desde el centro)
export const journeyShift = (kind: JourneyKind, p: number) =>
  lookShift(journeyFocal(kind, p, window.innerWidth, window.innerHeight));

// Un recorte circular centrado en la pantalla, corrido por la mirada. Aún
// cerrado no se mueve: así no cambia de estilo en cada cuadro por nada
const circleAt = (kind: JourneyKind, p: number, radius: string, open: boolean) => {
  const [x, y] = open ? journeyShift(kind, p) : [0, 0];
  const center = !x && !y ? '50% 50%' : `calc(50% + ${x.toFixed(1)}px) calc(50% + ${y.toFixed(1)}px)`;
  return `circle(${radius} at ${center})`;
};
const pxCircle = (kind: JourneyKind, p: number, radius: number) =>
  circleAt(kind, p, `${radius.toFixed(1)}px`, radius > 0);
const partsCircle = (kind: JourneyKind, p: number, parts: RadiusParts) =>
  circleAt(kind, p, cssRadius(parts), parts.min + parts.max > 0);

/* Recorte de la imagen del capítulo según el viaje */
export const journeyClip = (kind: JourneyKind, p: number): string => {
  switch (kind) {
    case 'torus': {
      // La ventana es el fondo del túnel del cubo, al centro
      const opening = habitatWindow(p, window.innerWidth, window.innerHeight);
      const cover = toPx({ min: 0, max: 76 * easeInOut(seg(p, JOURNEY_COVER)) });
      return pxCircle(kind, p, opening > 0 ? opening + cover : 0);
    }
    case 'blueprint':
      return yardClip(p, window.innerWidth, window.innerHeight);
    case 'horizon':
      return pxCircle(kind, p, marsParts(p, window.innerWidth, window.innerHeight));
    case 'galaxy':
      return partsCircle(kind, p, kardashevParts(p));
    case 'scaffold': {
      // La ventana es la primera celda del armazón
      const cover = toPx({ min: 0, max: 76 * easeInOut(seg(p, JOURNEY_COVER)) });
      const corners = scaffoldWindow(p, window.innerWidth, window.innerHeight, cover);
      if (!corners) return 'circle(0px at 50% 50%)';
      const points = [];
      for (let index = 0; index < corners.length; index += 2) points.push(`${corners[index].toFixed(1)}px ${corners[index + 1].toFixed(1)}px`);
      return `polygon(${points.join(', ')})`;
    }
    case 'dyson':
      return pxCircle(kind, p, sunParts(p, window.innerWidth, window.innerHeight));
    case 'starburst':
      return pxCircle(kind, p, holeParts(p, window.innerWidth, window.innerHeight).opening);
    case 'tunnel':
      return partsCircle(kind, p, chaseParts(p));
    case 'signal':
      return partsCircle(kind, p, signalParts(p));
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

/* Dibuja el viaje como mucho una vez por cuadro, en el paso de pintura de
   framer: si en el mismo cuadro cambian el scroll y la mirada, sale un solo
   dibujo con los dos al día. Con el scroll quieto, mirar alrededor también
   lo vuelve a dibujar, pero solo al portal que está en pantalla y solo
   mientras la mirada se mueve */
export const journeyOnStage = (p: number) => p > JOURNEY_OPEN[0] && p < JOURNEY_COVER[1];
const useJourneyDraw = (progress: MotionValue<number>, draw: (p: number) => void) => {
  useEffect(() => {
    let queued = false;
    let drawnAt = Number.NaN;
    const run = () => {
      queued = false;
      drawnAt = progress.get();
      draw(drawnAt);
    };
    const queue = () => {
      if (queued) return;
      queued = true;
      frame.render(run);
    };
    const offProgress = progress.on('change', queue);
    // Si con el scroll quieto los cuadros llegan tarde (la GPU no da abasto
    // con este viaje), lo que se redibuja solo por la mirada pasa a uno de
    // cada dos cuadros hasta que la mirada se detiene
    let lastTick = 0;
    let late = 0;
    let half = false;
    let beat = 0;
    const offLook = onLook(() => {
      const p = progress.get();
      if (!journeyOnStage(p)) return;
      if (!lookMoving()) {
        // Quieta: el último cuadro siempre se dibuja
        lastTick = 0;
        late = 0;
        half = false;
        queue();
        return;
      }
      const now = performance.now();
      if (lastTick) late = now - lastTick > 24 ? late + 1 : Math.max(0, late - 0.25);
      lastTick = now;
      if (late >= 3) half = true;
      if (half && p === drawnAt && beat++ % 2) return;
      queue();
    });
    return () => {
      offProgress();
      offLook();
      cancelFrame(run);
    };
  }, [progress, draw]);
};

/* Lienzo SVG del tamaño del escenario con el origen en el centro: los
   viajes dibujan en píxeles reales para coincidir con el recorte */
const useStageSvg = (progress: MotionValue<number>, draw: (p: number, width: number, height: number) => void) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const size = useRef({ width: 1, height: 1 });
  const run = useCallback((p: number) => draw(p, size.current.width, size.current.height), [draw]);
  useJourneyDraw(progress, run);
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

  useJourneyDraw(progress, draw);
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

/* ---------------- Andamio: la constelación que era un armazón ---------------- */

const SkyScaffold = ({ progress }: { progress: MotionValue<number> }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ width: 1, height: 1, ratio: 1 });
  const tint = useRef<number[]>([249, 214, 110]);
  const lastRoll = useRef(Number.NaN);
  const opacity = useTransform(
    progress,
    [JOURNEY_OPEN[0], JOURNEY_OPEN[0] + 0.025, JOURNEY_COVER[0] + 0.08, JOURNEY_COVER[0] + 0.18],
    [0, 1, 1, 0],
  );

  const draw = useCallback((p: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const { width, height, ratio } = size.current;

    // El cielo de fondo rueda con la cámara
    const roll = scaffoldRoll(p);
    const delta = roll - lastRoll.current;
    if (Math.abs(delta) < 1) {
      skyDrift.spin.x = width / 2;
      skyDrift.spin.y = height / 2;
      skyDrift.spin.depth = 0;
      skyDrift.spin.angle -= delta;
    }
    lastRoll.current = roll;

    // Las constelaciones de las capas de efectos van encima (en el teléfono
    // también la de estelas): se apagan para no confundirse con la nuestra
    const hidden = p > JOURNEY_OPEN[0] && p < JOURNEY_COVER[0] + 0.18
      ? scaffoldSkyHidden(p) * (1 - seg(p, [JOURNEY_COVER[0], JOURNEY_COVER[0] + 0.18]))
      : 0;
    document.querySelectorAll<HTMLElement>('.mo-starfx, .mo-trailfx').forEach((fx) => {
      fx.style.opacity = hidden > 0 ? (1 - hidden).toFixed(3) : '';
    });

    coverSky(canvasRef, p);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (p > JOURNEY_COVER[0] + 0.18 || p < JOURNEY_OPEN[0]) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const cover = toPx({ min: 0, max: 76 * easeInOut(seg(p, JOURNEY_COVER)) });
    drawScaffold(context, p, width, height, tint.current, scaffoldWindow(p, width, height, cover));
  }, []);

  useJourneyDraw(progress, draw);
  useEffect(() => () => {
    skyCovers.delete(canvasRef);
  }, []);
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
      document.querySelectorAll<HTMLElement>('.mo-starfx, .mo-trailfx').forEach((fx) => {
        fx.style.opacity = '';
      });
    };
  }, [progress, draw]);

  return <motion.canvas ref={canvasRef} className="mo-journey-stage is-scaffold" style={{ opacity }} aria-hidden="true" />;
};

/* ---------------- Astillero: el dique de vigas y la imagen que se arma al fondo ---------------- */

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
  const lastRoll = useRef(Number.NaN);
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

    // El cielo de fondo rueda con la cámara
    const roll = yardRoll(p);
    const delta = roll - lastRoll.current;
    if (Math.abs(delta) < 1) {
      skyDrift.spin.x = width / 2;
      skyDrift.spin.y = height / 2;
      skyDrift.spin.depth = 0;
      skyDrift.spin.angle += delta;
    }
    lastRoll.current = roll;

    // Las constelaciones de la capa de efectos van encima: se apagan para
    // no cruzar la Tierra
    const fx = document.querySelector<HTMLElement>('.mo-starfx');
    if (fx) {
      const hidden = p > JOURNEY_OPEN[0] && p < JOURNEY_COVER[0] + 0.16
        ? yardSkyHidden(p) * (1 - seg(p, [JOURNEY_COVER[0], JOURNEY_COVER[0] + 0.16]))
        : 0;
      fx.style.opacity = hidden > 0 ? (1 - hidden).toFixed(3) : '';
    }

    coverSky(canvasRef, p);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (p > JOURNEY_COVER[0] + 0.16 || p < JOURNEY_OPEN[0]) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawShipyard(context, p, { width, height, ratio, tint: tint.current, photo: picture.current, zoom: portalImageScale(p) });
  }, []);

  useJourneyDraw(progress, draw);
  useEffect(() => () => {
    skyCovers.delete(canvasRef);
  }, []);
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
    return () => {
      window.removeEventListener('resize', measure);
      const fx = document.querySelector<HTMLElement>('.mo-starfx');
      if (fx) fx.style.opacity = '';
    };
  }, [progress, draw]);

  return <motion.canvas ref={canvasRef} className="mo-journey-stage is-yard" style={{ opacity }} aria-hidden="true" />;
};

/* ---------------- Planetaria: el escudo magnético de Marte ---------------- */

const MagneticShield = ({ progress }: { progress: MotionValue<number> }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ width: 1, height: 1, ratio: 1 });
  const tint = useRef<number[]>([158, 230, 111]);
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

    // El lienzo tapa el cielo de la página, porque la cámara cabecea y rueda;
    // las constelaciones de la capa de efectos van encima y se apagan
    const fx = document.querySelector<HTMLElement>('.mo-starfx');
    if (fx) {
      const hidden = p > JOURNEY_OPEN[0] && p < JOURNEY_COVER[0] + 0.18
        ? shieldSkyHidden(p) * (1 - seg(p, [JOURNEY_COVER[0] + 0.08, JOURNEY_COVER[0] + 0.18]))
        : 0;
      fx.style.opacity = hidden > 0 ? (1 - hidden).toFixed(3) : '';
    }

    coverSky(canvasRef, p);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (p > JOURNEY_COVER[0] + 0.18 || p < JOURNEY_OPEN[0]) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawShield(context, p, width, height, tint.current, marsParts(p, width, height));
  }, []);

  useJourneyDraw(progress, draw);
  useEffect(() => () => {
    skyCovers.delete(canvasRef);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    tint.current = accentRgb(canvas);
    const measure = () => {
      const width = canvas.clientWidth || 1;
      const height = canvas.clientHeight || 1;
      // Resolución normal, sin la doble de las pantallas densas: miles de
      // trazos finos en movimiento cuestan el doble y no se nota la diferencia
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

  return <motion.canvas ref={canvasRef} className="mo-journey-stage is-shield" style={{ opacity }} aria-hidden="true" />;
};

/* ---------------- Agujero negro: caemos al otro lado ---------------- */

// Píxeles reales por píxel CSS del agujero: se ajusta a lo que aguanta el
// equipo y se recuerda para la próxima pasada
let holeResolution = 0;

const BlackHole = ({ progress }: { progress: MotionValue<number> }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const opacity = useTransform(
    progress,
    [JOURNEY_OPEN[0], JOURNEY_OPEN[0] + 0.03, JOURNEY_COVER[0] + 0.08, JOURNEY_COVER[0] + 0.18],
    [0, 1, 1, 0],
  );

  /* El shader dibuja en cada cuadro mientras el viaje está a la vista: el
     gas sigue girando con el scroll quieto. Con el scroll quieto basta la
     mitad de los cuadros */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let lastRoll = Number.NaN;
    let lastP = Number.NaN;
    let lastMove = 0;
    let lastFrame = 0;
    let beat = 0;
    // Baja sola si los cuadros se atrasan (en pocos cuadros, para que no se
    // note) y vuelve de a poco si sobra tiempo
    const best = Math.min(1, 0.75 * Math.max(1, window.devicePixelRatio || 1));
    if (!holeResolution) holeResolution = best;
    let late = 0;
    let early = 0;
    const tick = (now: number) => {
      frame = 0;
      const p = progress.get();
      const active = p > JOURNEY_OPEN[0] && p < JOURNEY_COVER[0] + 0.18;
      // Las constelaciones de la capa de efectos, que va por encima de los
      // portales, quedarían planas sobre el cielo curvado
      const fx = document.querySelector<HTMLElement>('.mo-starfx');
      if (fx) {
        const hidden = active ? holeSkyHidden(p) : 0;
        fx.style.opacity = hidden > 0 ? (1 - hidden).toFixed(3) : '';
      }
      if (!active) {
        lastFrame = 0;
        return;
      }
      frame = requestAnimationFrame(tick);
      // Mirar alrededor también es moverse: el agujero sigue a cuadro entero
      if (p !== lastP || lookMoving()) lastMove = now;
      lastP = p;
      if (now - lastMove > 1200 && beat++ % 2) return;

      const width = canvas.clientWidth || 1;
      const height = canvas.clientHeight || 1;
      // El cielo de la página, debajo, gira con la cámara alrededor del agujero
      const roll = holeRoll(p);
      if (Math.abs(roll - lastRoll) < 1) {
        const [shiftX, shiftY] = holeCenter(p, width, height);
        skyDrift.spin.x = width / 2 + shiftX;
        skyDrift.spin.y = height / 2 + shiftY;
        skyDrift.spin.depth = 0;
        skyDrift.spin.angle -= roll - lastRoll;
      }
      lastRoll = roll;

      if (lastFrame && now - lastMove < 1200) {
        const gap = now - lastFrame;
        late = gap > 40 ? late + 2 : gap > 24 ? late + 1 : 0;
        early = gap < 18 ? early + 1 : 0;
        if (late >= 4 && holeResolution > 0.35) {
          holeResolution = Math.max(0.35, holeResolution * 0.8);
          late = 0;
        } else if (early > 180 && holeResolution < best) {
          holeResolution = Math.min(best, holeResolution * 1.08);
          early = 0;
        }
      }
      lastFrame = now;
      const { radius, opening } = holeParts(p, width, height);
      paintHole(canvas, { p, time: now / 1000, width, height, resolution: holeResolution, radius, opening });
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const unsubscribe = progress.on('change', wake);
    wake();
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => prepareHole(canvas), { timeout: 6000 })
      : window.setTimeout(() => prepareHole(canvas), 3000);
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      const fx = document.querySelector<HTMLElement>('.mo-starfx');
      if (fx) fx.style.opacity = '';
    };
  }, [progress]);

  return <motion.canvas ref={canvasRef} className="mo-journey-stage is-blackhole" style={{ opacity }} aria-hidden="true" />;
};

/* ---------------- Energía: cruzamos el enjambre de Dyson hasta su estrella ---------------- */

const DysonSwarm = ({ progress }: { progress: MotionValue<number> }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ width: 1, height: 1, ratio: 1 });
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

    // El cielo de fondo se ladea con la cámara
    const roll = swarmRoll(p);
    const delta = roll - lastRoll.current;
    if (Math.abs(delta) < 1) {
      skyDrift.spin.x = width / 2;
      skyDrift.spin.y = height / 2;
      skyDrift.spin.depth = 0;
      skyDrift.spin.angle += delta;
    }
    lastRoll.current = roll;

    // Nuestro cielo gira con la cámara: las constelaciones de la capa de
    // efectos, que va encima, se apagan mientras dura
    const fx = document.querySelector<HTMLElement>('.mo-starfx');
    if (fx) {
      const hidden = p > JOURNEY_OPEN[0] && p < JOURNEY_COVER[0] + 0.18
        ? swarmSkyHidden(p) * (1 - seg(p, [JOURNEY_COVER[0] + 0.08, JOURNEY_COVER[0] + 0.18]))
        : 0;
      fx.style.opacity = hidden > 0 ? (1 - hidden).toFixed(3) : '';
    }

    coverSky(canvasRef, p);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (p > JOURNEY_COVER[0] + 0.18 || p < JOURNEY_OPEN[0]) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawSwarm(context, p, width, height, sunParts(p, width, height));
  }, []);

  useJourneyDraw(progress, draw);
  useEffect(() => () => {
    skyCovers.delete(canvasRef);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const measure = () => {
      const width = canvas.clientWidth || 1;
      const height = canvas.clientHeight || 1;
      // Resolución normal, sin la doble de las pantallas densas: las placas
      // pasan rápido y en movimiento no se nota
      const ratio = 1;
      size.current = { width, height, ratio };
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      draw(progress.get());
    };
    measure();
    window.addEventListener('resize', measure);
    // La estrella se pinta una sola vez, en un rato libre: no en el primer
    // cuadro del viaje
    const idle = window.requestIdleCallback?.(prepareSwarm) ?? window.setTimeout(prepareSwarm, 200);
    return () => {
      window.removeEventListener('resize', measure);
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      const fx = document.querySelector<HTMLElement>('.mo-starfx');
      if (fx) fx.style.opacity = '';
    };
  }, [progress, draw]);

  return <motion.canvas ref={canvasRef} className="mo-journey-stage is-swarm" style={{ opacity }} aria-hidden="true" />;
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

    // El cielo se ladea con la cámara en la curva y en la vuelta entera.
    // Aunque el scroll salte, se aplica todo el giro: así el cielo de la
    // página termina la vuelta junto con la cámara
    const bank = chaseBank(p);
    const delta = bank - lastBank.current;
    if (Number.isFinite(delta)) {
      skyDrift.spin.x = width / 2;
      skyDrift.spin.y = height / 2;
      skyDrift.spin.depth = 0;
      skyDrift.spin.angle -= delta;
    }
    lastBank.current = bank;

    const fx = document.querySelector<HTMLElement>('.mo-starfx');
    if (fx) {
      const hidden = p > JOURNEY_OPEN[0] && p < JOURNEY_COVER[1] ? chaseSkyHidden(p) : 0;
      fx.style.opacity = hidden > 0 ? (1 - hidden).toFixed(3) : '';
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (p > JOURNEY_COVER[0] + 0.18 || p < JOURNEY_OPEN[0]) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const opening = seg(p, CHASE.open) > 0 ? toPx(chaseParts(p)) : 0;
    drawChase(context, p, width, height, tint.current, opening);
  }, []);

  useJourneyDraw(progress, draw);
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

/* Guion de la señal: bajamos la vista del cielo a un radiotelescopio, lo
   seguimos mientras apunta arriba y quedamos tras su plato; su borde se
   vuelve el radar, que lanza sus pulsos y escucha. El barrido deja tras de
   sí el ruido del cielo,
   como el fósforo de una pantalla. En cada vuelta asoma un eco, cada vez
   más claro; en la última frena sobre él y lo fija, y del eco brota un
   mensaje de píxeles: el retrato de quien lo envía, un planeta vivo con un
   brote y un anillo. Se mece un momento y se descifra en el número del
   capítulo; el número real aparece sobre él, la ventana se abre detrás y
   el radar queda rodeándola */
const SIGNAL = {
  bubble: [0.08, 0.16],
  scope: [DISH.handoff[0], DISH.handoff[1]],
  search: [0.08, 0.17],
  lock: [0.16, 0.2],
  dim: [0.17, 0.24],
  fold: [0.185, 0.235],
  // Ya armado, el planeta guiña un ojo antes de descifrarse
  wink: [0.236, 0.25],
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
// El ojo derecho, el que guiña
const RIGHT_EYE = { x: 0.2, y: 0.08, reach: 0.12 };
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
interface GlyphCell { x: number; y: number; px: number; py: number; eye: boolean }
interface PixelGlyph { cell: number; planetCell: number; eyeY: number; center: { x: number; y: number }; cells: GlyphCell[] }
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
    eyeY: RIGHT_EYE.y * radius,
    center,
    cells: planetCells.map((point, index) => ({
      ...numberCells[Math.floor((index * numberCells.length) / planetCells.length)],
      px: point.x * radius,
      py: point.y * radius,
      eye: Math.hypot(point.x - RIGHT_EYE.x, point.y - RIGHT_EYE.y) < RIGHT_EYE.reach,
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
  const dishRef = useRef<HTMLCanvasElement>(null);
  const dishSkyRef = useRef<HTMLDivElement>(null);
  const dishBandRef = useRef<HTMLDivElement>(null);
  const dishHazeRef = useRef<HTMLDivElement>(null);
  const dishSize = useRef({ width: 1, height: 1, ratio: 1 });
  const dishTint = useRef<number[]>([240, 92, 255]);
  const lastRoll = useRef(Number.NaN);
  const echoRef = useRef<SVGCircleElement>(null);
  const echoGlowRef = useRef<SVGCircleElement>(null);
  const pulseRef = useRef<SVGCircleElement>(null);
  const bracketRef = useRef<SVGPathElement>(null);
  const pixelRefs = useRef<(SVGRectElement | null)[]>([]);
  const windowRef = useRef<SVGCircleElement>(null);
  const [glyph, setGlyph] = useState<PixelGlyph | null>(null);
  const glyphRef = useRef<PixelGlyph | null>(null);
  const lookOffset = useRef('');

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
    // La cabeza del visitante (mirar alrededor) corre el radar y el mensaje
    // junto con el plato que reemplazan
    const [lookX, lookY] = journeyShift('signal', p);
    const offset = `${lookX.toFixed(1)}px ${lookY.toFixed(1)}px`;
    if (offset !== lookOffset.current) {
      lookOffset.current = offset;
      scopeRef.current?.style.setProperty('translate', `calc(-50% + ${lookX.toFixed(1)}px) calc(-50% + ${lookY.toFixed(1)}px)`);
      ringRefs.current[0]?.ownerSVGElement?.style.setProperty('translate', offset);
    }
    const angle = sweepAngle(p);
    // La estela de fósforo sigue al barrido
    scopeRef.current?.style.setProperty('--trail', `${(angle - AFTERGLOW).toFixed(2)}deg`);

    // 0 · La antena: la seguimos con la mirada hasta quedar tras su plato,
    // cuyo borde mide lo mismo que el radar que lo reemplaza. El cielo de
    // fondo se ladea con la cámara
    const roll = dishRoll(p);
    const turned = roll - lastRoll.current;
    if (Math.abs(turned) < 1) {
      skyDrift.spin.x = width / 2;
      skyDrift.spin.y = height / 2;
      skyDrift.spin.depth = 0;
      skyDrift.spin.angle += turned;
    }
    lastRoll.current = roll;
    // Mientras estamos en el observatorio el cielo es el nuestro, que se
    // mueve con la cámara: el de fondo y sus constelaciones se tapan
    const cover = dishSkyCover(p);
    const sky = dishSkyRef.current;
    if (sky) {
      sky.style.opacity = cover.toFixed(3);
      sky.style.visibility = cover > 0.005 ? 'visible' : 'hidden';
    }
    const fx = document.querySelector<HTMLElement>('.mo-starfx');
    if (fx) fx.style.opacity = cover > 0 ? (1 - cover).toFixed(3) : '';
    const canvas = dishRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) {
      const { ratio } = dishSize.current;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const rim = 0.44 * scopeSize(width, height) * scopeScale(p);
      const { band, haze } = drawDish(context, p, width, height, dishTint.current, rim);
      // El resplandor de la Vía Láctea y el del horizonte: solo se mueven
      const bandLayer = dishBandRef.current;
      if (bandLayer) {
        bandLayer.style.visibility = band ? 'visible' : 'hidden';
        if (band) {
          bandLayer.style.opacity = band.opacity.toFixed(3);
          bandLayer.style.transform = `translate(${band.x.toFixed(1)}px, ${band.y.toFixed(1)}px) rotate(${band.angle.toFixed(4)}rad) scale(${band.scale.toFixed(3)})`;
        }
      }
      const hazeLayer = dishHazeRef.current;
      if (hazeLayer) {
        hazeLayer.style.visibility = haze ? 'visible' : 'hidden';
        if (haze) {
          hazeLayer.style.opacity = haze.opacity.toFixed(3);
          hazeLayer.style.transform = `translateY(${haze.y.toFixed(1)}px) rotate(${haze.roll.toFixed(4)}rad)`;
        }
      }
    }

    // I · El radar lanza sus pulsos: burbujas que se alejan desde la antena
    const bubble = seg(p, SIGNAL.bubble);
    const reach = Math.hypot(width, height) * 0.62;
    ringRefs.current.forEach((ring, index) => {
      if (!ring) return;
      const local = clamp01((bubble - index * 0.3) / 0.4);
      ring.setAttribute('r', (easeOut(local) * reach).toFixed(1));
      ring.setAttribute('opacity', (local > 0 ? (1 - local) * 0.8 : 0).toFixed(3));
    });

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
    // El guiño: los píxeles del ojo derecho se juntan en una raya y vuelven
    const blink = 1 - 0.88 * Math.sin(Math.PI * seg(p, SIGNAL.wink)) ** 0.6;
    const eyeY = glyph?.eyeY ?? 0;
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
      const py = target.eye ? eyeY + (target.py - eyeY) * blink : target.py;
      const planetX = center.x + target.px * cos - py * sin;
      const planetY = center.y + target.px * sin + py * cos;
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
  // El lienzo de la antena, del tamaño del escenario
  useEffect(() => {
    const canvas = dishRef.current;
    if (!canvas) return;
    dishTint.current = accentRgb(canvas);
    const measure = () => {
      const width = canvas.clientWidth || 1;
      const height = canvas.clientHeight || 1;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.25);
      dishSize.current = { width, height, ratio };
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      draw(progress.get(), width, height);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [draw, progress]);

  return (
    <>
      <div ref={dishSkyRef} className="mo-dish-sky" aria-hidden="true" />
      <div ref={dishBandRef} className="mo-dish-band" aria-hidden="true" />
      <div ref={dishHazeRef} className="mo-dish-haze" aria-hidden="true" />
      <canvas ref={dishRef} className="mo-journey-stage is-dish" aria-hidden="true" />
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

  useJourneyDraw(progress, draw);
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
    // El planeta, los gases y los resplandores se pintan en ratos libres,
    // mucho antes de llegar: el primer cuadro del viaje no paga por ellos
    const cancelPrepare = prepareKardashev(tint.current);
    return () => {
      cancelPrepare();
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
    case 'scaffold':
      return <SkyScaffold progress={progress} />;
    case 'torus':
      return <HabitatDock progress={progress} />;
    case 'blueprint':
      return <Shipyard progress={progress} image={image} />;
    case 'horizon':
      return <MagneticShield progress={progress} />;
    case 'dyson':
      return <DysonSwarm progress={progress} />;
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
