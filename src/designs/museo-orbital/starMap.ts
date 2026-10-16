import type { Rgb } from './warpField';

/* Mapa estelar del índice: el recorrido del museo como una pequeña galaxia.
   La portada está en el centro y la ruta se abre en espiral, subiendo
   despacio, capítulo a capítulo hasta la vitrina y el archivo. Este módulo
   no dibuja: guarda la geometría, la cámara y el guion de cada gesto (abrir,
   señalar, cerrar, zambullirse). El worker lo usa para dibujar y el hilo
   principal para saber dónde quedó cada estrella bajo el puntero; como todo
   depende solo del reloj de época y de los mismos mensajes, los dos lados
   calculan exactamente lo mismo sin hablarse. */

export type Vec3 = [number, number, number];

// Región del mapa dentro de la ventana, en px CSS
export type MapRegion = { x: number; y: number; w: number; h: number };
export type MapView = { width: number; height: number; dpr: number; region: MapRegion };

/* La constelación del visitante: cuántas obras tiene cada punto del mapa
   (índice de punto: 0 portada, luego capítulos), las obras leídas en orden
   como [punto, lugar dentro del capítulo] y cuántas del final son nuevas */
export type MapConstellation = {
  counts: number[];
  path: [number, number][];
  fresh: number;
};

export type MapMessage =
  | {
    type: 'map-open';
    at: number;
    colors: Rgb[];
    here: number;
    reduced: boolean;
    view: MapView;
    constellation?: MapConstellation;
  }
  | { type: 'map-view'; view: MapView }
  | { type: 'map-focus'; index: number; at: number }
  | { type: 'map-close'; at: number };

// Portada + capítulos + vitrina; los uniformes del shader reservan este tope
export const MAP_MAX_POINTS = 16;
export const MAP_CLOSE_MS = 440;

/* ---------------- Geometría ---------------- */

const TURNS = 1.08;
// El plano de referencia queda por debajo de toda la ruta
export const MAP_PLANE = -0.78;
export const MAP_RINGS = [0.85, 1.7, 2.55];
export const MAP_DIAL = 2.95;

const spiral = (u: number): Vec3 => {
  const angle = 0.4 + u * TURNS * Math.PI * 2;
  const radius = 0.58 + 1.86 * Math.pow(u, 0.85);
  // Sube con la ruta y respira un poco, como un brazo de galaxia
  const height = -0.52 + 1.04 * u + 0.07 * Math.sin(u * Math.PI * 3.2);
  return [Math.cos(angle) * radius, height, Math.sin(angle) * radius];
};

/* Puntos a igual distancia sobre la espiral (medida en 3D) y la ruta entre
   ellos como polilínea fina; s es la fracción del recorrido (0..1) */
export const buildMapLayout = (count: number) => {
  const samples = 1600;
  const arcs = [0];
  let previous = spiral(0);
  for (let i = 1; i <= samples; i++) {
    const next = spiral(i / samples);
    arcs.push(arcs[i - 1] + Math.hypot(next[0] - previous[0], next[1] - previous[1], next[2] - previous[2]));
    previous = next;
  }
  const total = arcs[samples];
  const uAt = (s: number) => {
    const goal = s * total;
    let lo = 0;
    let hi = samples;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arcs[mid] < goal) lo = mid;
      else hi = mid;
    }
    const k = arcs[hi] > arcs[lo] ? (goal - arcs[lo]) / (arcs[hi] - arcs[lo]) : 0;
    return (lo + k) / samples;
  };
  const points: Vec3[] = [];
  for (let j = 0; j < count; j++) points.push(spiral(uAt(count > 1 ? j / (count - 1) : 0)));
  const route: { p: Vec3; s: number }[] = [];
  const steps = 26 * Math.max(1, count - 1);
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    route.push({ p: spiral(uAt(s)), s });
  }
  return { points, route, length: total };
};

/* ---------------- Cúmulos de obras ---------------- */

/* Cada capítulo lleva sus obras en un disco pequeño a su alrededor, en
   filotaxis (el ángulo áureo de un girasol): se reparten parejas sea cual
   sea su número. El disco se inclina un poco distinto en cada capítulo y gira
   despacio, las de adentro más rápido, como un cúmulo de verdad. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export const clusterRadius = (count: number) => 0.17 + 0.048 * Math.sqrt(Math.max(1, count));

export type WorkOrbit = { r: number; angle: number; y: number; tilt: number; twinkle: number };

export const workOrbit = (point: number, slot: number, count: number): WorkOrbit => {
  // Fuera del anillo de lectura de su estrella
  const inner = 0.165;
  const outer = clusterRadius(count);
  const r = count <= 1 ? 0.2 : inner + (outer - inner) * Math.sqrt((slot + 0.5) / count);
  // Cada capítulo empieza su espiral en otro ángulo
  const angle = slot * GOLDEN + point * 2.17;
  const hash = Math.sin((point * 97 + slot * 13) * 12.9898) * 43758.5453;
  const jitter = hash - Math.floor(hash);
  return {
    r,
    angle,
    y: (jitter - 0.5) * 0.045,
    tilt: Math.sin(point * 1.9) * 0.32,
    twinkle: jitter * Math.PI * 2,
  };
};

/* ---------------- Guion de la constelación ---------------- */

/* La línea del recorrido se traza después de que el mapa llega: lo ya visto
   de una pasada, y lo nuevo estrella por estrella, más despacio, con un
   destello en cada una. La posición del trazo va de -0.35 (nada) a N − 1 +
   0.35 (todo): la estrella k se enciende cuando el trazo pasa por k. */
export const TRAIL_START_MS = 640;
const TRAIL_TAIL_MS = 320;

export const trailPlan = (total: number, fresh: number) => {
  const nNew = Math.min(Math.max(0, fresh), total);
  const nOld = total - nNew;
  const oldMs = nOld > 0 ? Math.min(1500, Math.max(440, 280 + 75 * nOld)) : 0;
  const pause = nOld > 0 && nNew > 0 ? 280 : 0;
  const stepMs = Math.max(420, 780 - 70 * Math.max(0, nNew - 1));
  const newStart = TRAIL_START_MS + oldMs + pause;
  return {
    total,
    nOld,
    nNew,
    oldMs,
    stepMs,
    newStart,
    end: newStart + nNew * stepMs + TRAIL_TAIL_MS,
    // Cuándo (ms desde la apertura) se enciende la estrella nueva k
    igniteAt: (k: number) => newStart + (k - nOld + 1) * stepMs,
  };
};

export type TrailPlan = ReturnType<typeof trailPlan>;

const trailAt = (plan: TrailPlan, t: number) => {
  const { total, nOld, nNew, oldMs, stepMs, newStart } = plan;
  const none = -0.35;
  const full = total - 1 + 0.35;
  if (total === 0) return none;
  const u = t - TRAIL_START_MS;
  if (u < 0) return none;
  if (u < oldMs) return none + (nOld - 1 - none) * easeInOut(u / oldMs);
  const v = t - newStart;
  if (nNew === 0) return nOld - 1 + 0.35 * smooth(clamp01((u - oldMs) / TRAIL_TAIL_MS));
  if (v < 0) return nOld > 0 ? nOld - 1 : none;
  const step = Math.floor(v / stepMs);
  if (step >= nNew) return total - 1 + (full - (total - 1)) * smooth(clamp01((v - nNew * stepMs) / TRAIL_TAIL_MS));
  const to = nOld + step;
  const from = to === 0 ? none : to - 1;
  return from + (to - from) * easeInOut((v - step * stepMs) / stepMs);
};

/* ---------------- Matrices (columna mayor, como las pide WebGL) ---------------- */

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mixV = (a: Vec3, b: Vec3, k: number): Vec3 => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/* Vista mirando al objetivo y lente con el centro desplazado hacia la región
   del mapa (en px CSS desde el centro de la ventana, y hacia arriba) */
const viewProjection = (pose: Pose, view: MapView, out: Float32Array) => {
  const z = norm(sub(pose.eye, pose.target));
  const x = norm(cross([0, 1, 0], z));
  const y = cross(z, x);
  const hw = view.width / 2;
  const hh = view.height / 2;
  const sx = pose.focal / hw;
  const sy = pose.focal / hh;
  const ox = pose.shift[0] / hw;
  const oy = pose.shift[1] / hh;
  const near = 0.05;
  const far = 80;
  const a = -(far + near) / (far - near);
  const b = (-2 * far * near) / (far - near);
  const ex = -dot(x, pose.eye);
  const ey = -dot(y, pose.eye);
  const ez = -dot(z, pose.eye);
  // P (x' = sx·x − ox·z, y' = sy·y − oy·z, z' = a·z + b, w = −z) por V
  const rows = [
    [sx * x[0] - ox * z[0], sx * x[1] - ox * z[1], sx * x[2] - ox * z[2], sx * ex - ox * ez],
    [sy * y[0] - oy * z[0], sy * y[1] - oy * z[1], sy * y[2] - oy * z[2], sy * ey - oy * ez],
    [a * z[0], a * z[1], a * z[2], a * ez + b],
    [-z[0], -z[1], -z[2], -ez],
  ];
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = rows[r][c];
  return out;
};

/* ---------------- Guion ---------------- */

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const span = (value: number, from: number, to: number) => clamp01((value - from) / (to - from));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const DIST = 7.6;
const PITCH = 0.7;
const YAW0 = -0.5;
// Una vuelta completa cada cuatro minutos: se nota viva, no se nota girar
const SPIN = (Math.PI * 2) / 240000;
const ARRIVE_MS = 1100;
const REVEAL_FROM = 0;
const REVEAL_MS = 860;
const FOCUS_MS = 320;
const LEAN_MS = 1000;
// Exposición de las estelas del mapa (la cámara rápida las estira)
const SHUTTER_MS = 36;
// Radio horizontal que debe caber en la región
const MAP_RADIUS = 3.15;

type Pose = { eye: Vec3; target: Vec3; shift: [number, number]; focal: number };

type SceneState = {
  openAt: number;
  closeAt: number | null;
  diveAt: number | null;
  diveMs: number;
  diveIndex: number;
  reduced: boolean;
  colors: Rgb[];
  here: number;
  view: MapView;
  focal: number;
  shift: [number, number];
  points: Vec3[];
  // Señalado: cada punto pasa de su nivel de entonces al nuevo
  focusFrom: number[];
  focusTo: number[];
  focusAt: number;
  leanFrom: Vec3;
  leanFromK: number;
  leanTo: Vec3;
  leanToK: number;
  leanAt: number;
  constellation: MapConstellation | null;
  trail: TrailPlan;
  // Por punto: la estrella nueva que lo completa (su orden en el trazo), o -1
  completes: number[];
};

export type MapFrame = {
  count: number;
  viewProj: Float32Array;
  prevViewProj: Float32Array;
  // Distancia focal en px CSS
  focal: number;
  colors: Float32Array;
  // Por punto: encendido, señalado, "estás aquí", desvanecido de la zambullida
  points: Float32Array;
  alpha: number;
  lines: number;
  rings: number;
  ringScale: number;
  dust: number;
  labels: number;
  reveal: number;
  hereArc: number;
  veil: number;
  haze: number;
  hazeCenter: [number, number];
  hazeColor: Rgb;
  time: number;
  // Durante la zambullida: punto de fuga (px CSS desde el centro, y hacia abajo)
  vanish: [number, number] | null;
  dive: number;
  // La constelación (misma referencia mientras no se reabra), el trazo y su reloj
  constellation: MapConstellation | null;
  trail: number;
  trailClock: number;
  trailCount: number;
  // Por punto: fracción leída y destello al completarse
  progress: Float32Array;
};

const regionFit = (view: MapView) => {
  const { region } = view;
  // En pantallas angostas cabe la espiral y el dial del plano puede salirse
  const radius = region.w < 560 ? 2.62 : MAP_RADIUS;
  const focal = (Math.min(region.w * 0.5, region.h * 0.74) * DIST) / radius;
  const shift: [number, number] = [
    region.x + region.w / 2 - view.width / 2,
    view.height / 2 - (region.y + region.h / 2),
  ];
  return { focal, shift };
};

export const createMapScene = () => {
  let state: SceneState | null = null;
  let layout = buildMapLayout(11);
  const matrix = new Float32Array(16);
  const previous = new Float32Array(16);
  const probe = new Float32Array(16);
  const colorData = new Float32Array(MAP_MAX_POINTS * 3);
  const pointData = new Float32Array(MAP_MAX_POINTS * 4);
  const progressData = new Float32Array(MAP_MAX_POINTS * 2);

  const leanAt = (s: SceneState, now: number) => {
    const k = s.reduced ? 1 : smooth(span(now - s.leanAt, 0, LEAN_MS));
    return { v: mixV(s.leanFrom, s.leanTo, k), k: s.leanFromK + (s.leanToK - s.leanFromK) * k };
  };

  /* Mientras se encienden las estrellas nuevas, la cámara se acerca sola a
     la punta del trazo (al capítulo por el que pasa), salvo que el visitante
     esté señalando algo */
  const autoLeanAt = (s: SceneState, now: number) => {
    const plan = s.trail;
    if (!s.constellation || s.reduced || plan.nNew === 0) return null;
    const t = now - s.openAt;
    const from = plan.newStart - 500;
    const to = plan.end + 300;
    if (t <= from || t >= to + 1100) return null;
    const k = 0.8 * smooth(span(t, from, from + 900)) * (1 - smooth(span(t, to, to + 1100)));
    const { path } = s.constellation;
    const pen = Math.min(Math.max(trailAt(plan, t), Math.max(0, plan.nOld - 1)), path.length - 1);
    const i = Math.floor(pen);
    const a = s.points[path[i][0]] ?? [0, 0, 0];
    const b = s.points[path[Math.min(i + 1, path.length - 1)][0]] ?? a;
    return { v: mixV(a, b, easeInOut(pen - i)), k };
  };

  // La de quien señala manda; si no, la automática
  const effectiveLean = (s: SceneState, now: number) => {
    const user = leanAt(s, now);
    if (user.k > 0.001 || s.leanToK > 0) return user;
    return autoLeanAt(s, now) ?? user;
  };

  const focusAt = (s: SceneState, index: number, now: number) => {
    const k = smooth(span(now - s.focusAt, 0, s.reduced ? 120 : FOCUS_MS));
    return s.focusFrom[index] + (s.focusTo[index] - s.focusFrom[index]) * k;
  };

  const poseAt = (s: SceneState, now: number): Pose => {
    const t = now - s.openAt;
    const still = s.reduced;
    // Llegada: la cámara cae en órbita desde lejos y desde arriba, frenando
    const arrive = still ? 1 : 1 - (1 - span(t, 0, ARRIVE_MS)) ** 4;
    const yaw = YAW0 + (still ? 0 : t * SPIN) - (1 - arrive) * 0.85;
    let pitch = PITCH + (1 - arrive) * 0.42 + (still ? 0 : 0.035 * Math.sin(t / 8000));
    let dist = DIST * (1 + (1 - arrive) * 1.15);
    if (s.closeAt !== null && !still) {
      const c = easeInOut(span(now - s.closeAt, 0, MAP_CLOSE_MS));
      dist *= 1 + 0.32 * c;
      pitch += 0.12 * c;
    }
    let target: Vec3 = [0, 0, 0];
    let eye: Vec3 = [
      Math.cos(pitch) * Math.sin(yaw) * dist,
      Math.sin(pitch) * dist,
      Math.cos(pitch) * Math.cos(yaw) * dist,
    ];
    // Señalar acerca la cámara a la estrella sin moverla en pantalla: avanza
    // por la recta que las une y sigue mirando hacia el mismo lado, así la
    // estrella queda bajo el puntero y el mapa crece a su alrededor
    const lean = still ? null : effectiveLean(s, now);
    if (lean && lean.k > 0.0001) {
      const pull = 0.22 * lean.k;
      const offset: Vec3 = [(lean.v[0] - eye[0]) * pull, (lean.v[1] - eye[1]) * pull, (lean.v[2] - eye[2]) * pull];
      eye = [eye[0] + offset[0], eye[1] + offset[1], eye[2] + offset[2]];
      target = offset;
    }
    let shift: [number, number] = [s.shift[0], s.shift[1]];
    if (s.diveAt !== null) {
      // Zambullida: la mirada se clava en la estrella y la cámara acelera hacia ella
      const d = span(now - s.diveAt, 0, s.diveMs);
      const star = s.points[s.diveIndex] ?? [0, 0, 0];
      const aim = easeInOut(span(d, 0, 0.6));
      target = mixV(target, star, aim);
      // Acercamiento exponencial: la estrella crece a ritmo parejo hasta
      // atravesarla, en vez de saltar encima en el último instante
      eye = mixV(star, eye, Math.exp(-4.2 * d * d));
      shift = [shift[0] * (1 - aim), shift[1] * (1 - aim)];
    }
    return { eye, target, shift, focal: s.focal };
  };

  const handle = (message: MapMessage) => {
    if (message.type === 'map-open') {
      const count = Math.min(MAP_MAX_POINTS, message.colors.length);
      if (layout.points.length !== count) layout = buildMapLayout(count);
      const fit = regionFit(message.view);
      // Sin lecturas igual hay constelación: el polvo de las obras por encender
      const constellation = message.constellation?.counts.some((works) => works > 0) ? message.constellation : null;
      const trail = trailPlan(constellation?.path.length ?? 0, message.reduced ? 0 : constellation?.fresh ?? 0);
      // Qué estrella nueva completa cada capítulo (para su destello)
      const completes = new Array(count).fill(-1);
      if (constellation) {
        const read = new Array(count).fill(0);
        constellation.path.forEach(([point], k) => {
          if (point >= count) return;
          read[point] += 1;
          if (read[point] === constellation.counts[point] && k >= trail.nOld) completes[point] = k;
        });
      }
      state = {
        openAt: message.at,
        closeAt: null,
        diveAt: null,
        diveMs: 1,
        diveIndex: -1,
        reduced: message.reduced,
        colors: message.colors.slice(0, count),
        here: message.here,
        view: message.view,
        focal: fit.focal,
        shift: fit.shift,
        points: layout.points,
        focusFrom: new Array(count).fill(0),
        focusTo: new Array(count).fill(0),
        focusAt: message.at,
        leanFrom: [0, 0, 0],
        leanFromK: 0,
        leanTo: [0, 0, 0],
        leanToK: 0,
        leanAt: message.at,
        constellation,
        trail,
        completes,
      };
      return;
    }
    if (!state) return;
    if (message.type === 'map-view') {
      const fit = regionFit(message.view);
      state.view = message.view;
      state.focal = fit.focal;
      state.shift = fit.shift;
    } else if (message.type === 'map-focus') {
      const s = state;
      const at = message.at;
      s.focusFrom = s.focusFrom.map((_, i) => focusAt(s, i, at));
      s.focusTo = s.focusTo.map((_, i) => (i === message.index ? 1 : 0));
      s.focusAt = at;
      const lean = effectiveLean(s, at);
      s.leanFrom = lean.v;
      s.leanFromK = lean.k;
      const point = s.points[message.index];
      s.leanTo = point ? [point[0], point[1], point[2]] : [0, 0, 0];
      s.leanToK = point ? 1 : 0;
      s.leanAt = at;
    } else if (message.type === 'map-close') {
      if (state.closeAt === null) state.closeAt = message.at;
    }
  };

  // La zambullida la ordena el salto (mismo reloj que el hiperespacio)
  const dive = (index: number, at: number, ms: number) => {
    if (!state || index < 0 || index >= state.points.length) return;
    state.diveAt = at;
    state.diveMs = ms;
    state.diveIndex = index;
  };

  const sample = (now: number): MapFrame | null => {
    const s = state;
    if (!s) return null;
    const t = now - s.openAt;
    let closing = 0;
    if (s.closeAt !== null) {
      const c = now - s.closeAt;
      if (c >= MAP_CLOSE_MS) {
        state = null;
        return null;
      }
      closing = c / MAP_CLOSE_MS;
    }
    let d = -1;
    if (s.diveAt !== null) {
      const k = (now - s.diveAt) / s.diveMs;
      if (k >= 1) {
        state = null;
        return null;
      }
      d = clamp01(k);
    }
    const still = s.reduced;
    const count = s.points.length;
    const pose = poseAt(s, now);
    viewProjection(pose, s.view, matrix);
    viewProjection(poseAt(s, now - SHUTTER_MS), s.view, previous);

    const reveal = still ? 1 : smooth(span(t, REVEAL_FROM, REVEAL_FROM + REVEAL_MS));
    const appear = still ? smooth(span(t, 0, 220)) : 1;
    const diving = d >= 0 ? d : 0;
    const fadeOthers = 1 - smooth(span(diving, 0.3, 0.8));
    // La estrella elegida se funde al final en el brillo del túnel
    const fadeChosen = 1 - smooth(span(diving, 0.8, 1));
    for (let j = 0; j < count; j++) {
      const at = count > 1 ? j / (count - 1) : 0;
      // Ventanas recortadas a [0, 1]: el último punto también termina de encenderse
      const ignite = smooth(span(reveal, Math.min(at - 0.012, 0.95), Math.min(at + 0.05, 1))) * appear;
      const here = j === s.here ? smooth(span(reveal, Math.min(at + 0.03, 0.96), Math.min(at + 0.13, 1))) : 0;
      pointData[j * 4] = ignite;
      // La estrella elegida se señala sola al empezar la zambullida
      const chosen = j === s.diveIndex ? smooth(span(diving, 0, 0.3)) : 0;
      pointData[j * 4 + 1] = Math.max(focusAt(s, j, now), chosen);
      pointData[j * 4 + 2] = here * (1 - smooth(span(diving, 0, 0.2)));
      pointData[j * 4 + 3] = j === s.diveIndex ? fadeChosen : fadeOthers;
      const color = s.colors[j];
      colorData[j * 3] = color[0] / 255;
      colorData[j * 3 + 1] = color[1] / 255;
      colorData[j * 3 + 2] = color[2] / 255;
    }

    const leave = closing > 0 ? 1 - smooth(span(closing, 0, 0.62)) : 1;
    const veil = closing > 0
      ? 1 - easeInOut(span(closing, 0.18, 1))
      : still ? smooth(span(t, 0, 200)) : easeOut(span(t, 0, 320));
    const baseHaze = s.colors[Math.max(0, s.here)] ?? [201, 168, 106];
    const diveHaze = d >= 0 ? s.colors[s.diveIndex] ?? baseHaze : baseHaze;
    const tone = smooth(span(diving, 0, 0.5));
    const hazeColor: Rgb = [
      baseHaze[0] + (diveHaze[0] - baseHaze[0]) * tone,
      baseHaze[1] + (diveHaze[1] - baseHaze[1]) * tone,
      baseHaze[2] + (diveHaze[2] - baseHaze[2]) * tone,
    ];
    // El trazo de la constelación y lo leído de cada capítulo a su paso
    const trail = still ? s.trail.total - 1 + 0.35 : trailAt(s.trail, t);
    progressData.fill(0);
    if (s.constellation) {
      const { counts, path } = s.constellation;
      path.forEach(([point], k) => {
        if (point >= count) return;
        progressData[point * 2] += clamp01((trail - k + 0.12) / 0.3) / Math.max(1, counts[point] ?? 1);
      });
      for (let j = 0; j < count; j++) {
        const k = s.completes[j];
        if (k < 0) continue;
        const age = t - s.trail.igniteAt(k);
        progressData[j * 2 + 1] = age >= 0 && age < 1800 ? 1 - age / 1800 : 0;
      }
    }
    let vanish: [number, number] | null = null;
    if (d >= 0) {
      const p = s.points[s.diveIndex];
      const at = projectWith(matrix, p, s.view);
      vanish = at ? [at.x - s.view.width / 2, at.y - s.view.height / 2] : [0, 0];
    }
    return {
      count,
      viewProj: matrix,
      prevViewProj: previous,
      focal: s.focal,
      colors: colorData,
      points: pointData,
      alpha: leave * appear,
      lines: leave * appear * (1 - smooth(span(diving, 0.25, 0.75))),
      rings: (still ? appear : smooth(span(t, 0, 420))) * leave * (1 - smooth(span(diving, 0.05, 0.55))),
      ringScale: still ? 1 : 0.7 + 0.3 * easeOut(span(t, 0, 1050)),
      dust: (still ? appear : smooth(span(t, 0, 380))) * leave * (1 - smooth(span(diving, 0.6, 1))),
      labels: (still ? appear : 1) * (closing > 0 ? 1 - smooth(span(closing, 0, 0.4)) : 1) * (1 - smooth(span(diving, 0, 0.22))),
      reveal,
      hereArc: count > 1 ? Math.max(0, s.here) / (count - 1) : 0,
      veil: d >= 0 ? 1 : veil,
      haze: (still ? appear : smooth(span(t, 0, 800))) * leave * (1 - smooth(span(diving, 0.2, 0.85))),
      hazeCenter: [pose.shift[0], -pose.shift[1]],
      hazeColor,
      time: still ? 0 : t / 1000,
      vanish,
      dive: d,
      constellation: s.constellation,
      trail,
      trailClock: still ? 1e6 : t,
      trailCount: s.trail.total,
      progress: progressData,
    };
  };

  /* Dónde está ahora un punto en la ventana (px CSS), o null si quedó
     detrás de la cámara */
  const locate = (index: number, now: number) => {
    const s = state;
    if (!s || s.closeAt !== null || s.diveAt !== null) return null;
    const point = s.points[index];
    if (!point) return null;
    return projectWith(viewProjection(poseAt(s, now), s.view, probe), point, s.view);
  };

  return {
    handle,
    dive,
    sample,
    locate,
    // Quieto: movimiento reducido y ya sin fundidos en curso
    isStill: (now: number) => Boolean(
      state?.reduced && state.closeAt === null && now - state.openAt > 260 && now - state.focusAt > 160,
    ),
    get count() {
      return state?.points.length ?? 0;
    },
  };
};

const projectWith = (m: Float32Array, p: Vec3, view: MapView) => {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  if (w <= 0.05) return null;
  return { x: (x / w + 1) * 0.5 * view.width, y: (1 - y / w) * 0.5 * view.height, depth: w };
};

export type MapScene = ReturnType<typeof createMapScene>;
