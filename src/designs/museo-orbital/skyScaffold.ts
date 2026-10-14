import { clamp01, smoothstep } from './roomShared';
import { lookTurn } from './lookAround';

/* Introducción: la constelación era un andamio.

   Al bajar de la portada solo hay cielo. Unas estrellas se avivan y se unen
   con trazos finos, como una constelación. Pero no están en el infinito: son
   los nudos de un armazón geodésico enorme y estamos justo en su centro, así
   que se ven como el resto del cielo. Al acercarnos, la constelación crece
   y se desarma contra las estrellas de verdad, que no se mueven; sus trazos
   se vuelven vigas y desde ella crece el resto del armazón, con una chispa
   de soldadura en la punta de cada viga. Cada nudo enciende su luz de
   trabajo al cerrarse. Pasamos bajo la constelación y seguimos rozando el
   armazón por dentro, tras el frente de la obra, hasta mirar hacia arriba a
   la celda que se cierra justo cuando llegamos: ahí se abre la ventana.

   Todo en un lienzo, en 3D: la esfera tiene radio 1 y centro en el origen,
   donde empieza la cámara (mirando hacia +z, con el abajo en +y). Las vigas
   son las aristas de un poliedro de Goldberg: hexágonos y doce pentágonos. */

type Range = [number, number];
type Vec = [number, number, number];

export const SCAFFOLD = {
  // Las estrellas de la constelación se avivan y se unen una tras otra
  stars: [0.025, 0.06],
  trace: [0.045, 0.1],
  // Los trazos se vuelven vigas con cuerpo
  body: [0.09, 0.14],
  // La ola de vigas sale de la constelación y cubre casi toda la esfera
  grow: [0.1, 0.23],
  // La celda de la ventana espera su última viga, que se suelda al llegar
  // nosotros
  close: [0.228, 0.254],
  // Rozamos el armazón desde la constelación hasta la celda
  glide: [0.15, 0.278],
  // La ventana se enciende dentro de la celda
  open: [0.27, 0.3],
  // Seguimos entrando despacio mientras la ventana cubre
  push: [0.278, 0.56],
} satisfies Record<string, Range>;

const seg = (p: number, [from, to]: Range) => clamp01((p - from) / (to - from));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const seeded = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (...list: Vec[]): Vec => list.reduce<Vec>((sum, v) => [sum[0] + v[0], sum[1] + v[1], sum[2] + v[2]], [0, 0, 0]);
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const times = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const mix3 = (a: Vec, b: Vec, t: number): Vec => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: Vec): Vec => times(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const keyed = (p: number, keys: [number, number][]) => {
  if (p <= keys[0][0]) return keys[0][1];
  for (let index = 1; index < keys.length; index++) {
    const [at, value] = keys[index];
    const [before, previous] = keys[index - 1];
    if (p <= at) return mix(previous, value, easeInOut((p - before) / (at - before)));
  }
  return keys[keys.length - 1][1];
};

/* ---------------- El armazón ---------------- */

// Cuántas veces se parte cada cara del icosaedro: más, celdas más chicas
const FREQUENCY = 5;
const PHI = (1 + Math.sqrt(5)) / 2;
const ICOSAHEDRON: Vec[] = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
];
const FACES = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

/* La esfera geodésica de triángulos y su dual: un nudo en el centro de
   cada triángulo, una viga entre triángulos vecinos y una celda alrededor
   de cada vértice */
const buildFrame = () => {
  const corners: Vec[] = [];
  const corner = (v: Vec) => {
    const n = normalize(v);
    const found = corners.findIndex((c) => Math.abs(c[0] - n[0]) + Math.abs(c[1] - n[1]) + Math.abs(c[2] - n[2]) < 1e-6);
    if (found >= 0) return found;
    corners.push(n);
    return corners.length - 1;
  };
  const triangles: number[][] = [];
  for (const [ia, ib, ic] of FACES) {
    const [a, b, c] = [ICOSAHEDRON[ia], ICOSAHEDRON[ib], ICOSAHEDRON[ic]];
    const at = (i: number, j: number) => corner([
      a[0] + ((b[0] - a[0]) * i + (c[0] - a[0]) * j) / FREQUENCY,
      a[1] + ((b[1] - a[1]) * i + (c[1] - a[1]) * j) / FREQUENCY,
      a[2] + ((b[2] - a[2]) * i + (c[2] - a[2]) * j) / FREQUENCY,
    ]);
    for (let i = 0; i < FREQUENCY; i++) {
      for (let j = 0; i + j < FREQUENCY; j++) {
        triangles.push([at(i, j), at(i + 1, j), at(i, j + 1)]);
        if (i + j < FREQUENCY - 1) triangles.push([at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
      }
    }
  }
  const nodes = triangles.map(([a, b, c]) => normalize(add(corners[a], corners[b], corners[c])));
  const struts: [number, number][] = [];
  const neighbors: number[][] = nodes.map(() => []);
  const sides = new Map<string, number>();
  triangles.forEach((triangle, t) => {
    for (let k = 0; k < 3; k++) {
      const u = triangle[k];
      const v = triangle[(k + 1) % 3];
      const key = u < v ? `${u}-${v}` : `${v}-${u}`;
      const other = sides.get(key);
      if (other === undefined) {
        sides.set(key, t);
        continue;
      }
      struts.push([other, t]);
      neighbors[other].push(t);
      neighbors[t].push(other);
    }
  });
  const around: number[][] = corners.map(() => []);
  triangles.forEach((triangle, t) => triangle.forEach((v) => around[v].push(t)));
  const cells = corners.map((center, v) => {
    const helper: Vec = Math.abs(center[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = normalize(cross(helper, center));
    const w = cross(center, u);
    const angle = (t: number) => Math.atan2(dot(nodes[t], w), dot(nodes[t], u));
    return { center, ring: around[v].sort((a, b) => angle(a) - angle(b)) };
  });
  return { nodes, struts, neighbors, cells };
};
const FRAME = buildFrame();
const { nodes: NODES, struts: STRUTS, neighbors: NEIGHBORS } = FRAME;

/* La constelación: una W de nudos vecinos, un poco por encima del centro de
   la mirada inicial, con una cola que baja desde su mitad */
const nearest = (direction: Vec) => {
  let best = 0;
  NODES.forEach((node, index) => {
    if (dot(node, direction) > dot(NODES[best], direction)) best = index;
  });
  return best;
};
const walk = (from: number, heading: Vec, steps: number, taken: number[]) => {
  const path = [from];
  for (let step = 0; step < steps; step++) {
    const here = path[path.length - 1];
    let best = -1;
    let score = -Infinity;
    for (const next of NEIGHBORS[here]) {
      if (path.includes(next) || taken.includes(next)) continue;
      const value = dot(normalize(sub(NODES[next], NODES[here])), heading);
      if (value > score) {
        score = value;
        best = next;
      }
    }
    if (best < 0) break;
    path.push(best);
  }
  return path;
};
const STAR_PATH = walk(nearest(normalize([-0.2, -0.17, 1])), normalize([1, -0.25, 0]), 6, []);
const STAR_TAIL = walk(STAR_PATH[3], [0, 1, 0], 2, STAR_PATH);
const STAR_NODES = [...STAR_PATH, ...STAR_TAIL.slice(1)];
// Las vigas de la constelación, en el orden en que se trazan
const STAR_LINKS: [number, number][] = [
  ...STAR_PATH.slice(1).map((node, index): [number, number] => [STAR_PATH[index], node]),
  ...STAR_TAIL.slice(1).map((node, index): [number, number] => [STAR_TAIL[index], node]),
];
const STAR_CENTER = normalize(add(...STAR_NODES.map((node) => NODES[node])));

/* La celda de la ventana: un hexágono a unos 60° de la constelación, hacia
   abajo de la mirada inicial. El recorrido va de una a otra por el gran
   círculo que las une: `ARC_U` es la tangente en la constelación hacia la
   celda y `ARC_SIDE` el costado */
const TARGET = (() => {
  const below = normalize(sub([0, 1, 0], times(STAR_CENTER, STAR_CENTER[1])));
  const aim = normalize(add(times(STAR_CENTER, Math.cos(1.05)), times(below, Math.sin(1.05))));
  let best = FRAME.cells[0];
  for (const cell of FRAME.cells) {
    if (cell.ring.length === 6 && dot(cell.center, aim) > dot(best.center, aim)) best = cell;
  }
  return best;
})();
const ARC = Math.acos(dot(STAR_CENTER, TARGET.center));
const ARC_U = normalize(sub(TARGET.center, times(STAR_CENTER, dot(STAR_CENTER, TARGET.center))));
const ARC_SIDE = cross(STAR_CENTER, ARC_U);
// Un punto del recorrido y su tangente hacia la celda
const arcAt = (angle: number) => ({
  out: add(times(STAR_CENTER, Math.cos(angle)), times(ARC_U, Math.sin(angle))),
  ahead: add(times(STAR_CENTER, -Math.sin(angle)), times(ARC_U, Math.cos(angle))),
});

/* Cuándo crece cada viga: las de la constelación se trazan una tras otra;
   el resto, en una ola que sale de ella, nivel por nivel, cada vez más
   rápido, y nos lleva ventaja. Solo la celda de la ventana espera su
   última viga. La ola no llega a la otra punta: ahí queda un casquete a
   medio armar, con vigas que avanzan despacio */
const depth = NODES.map(() => Infinity);
STAR_NODES.forEach((node) => (depth[node] = 0));
{
  const queue = [...STAR_NODES];
  for (let head = 0; head < queue.length; head++) {
    const here = queue[head];
    for (const next of NEIGHBORS[here]) {
      if (depth[next] !== Infinity) continue;
      depth[next] = depth[here] + 1;
      queue.push(next);
    }
  }
}
const inRing = (node: number) => TARGET.ring.includes(node);
const RING_STRUTS = STRUTS.filter(([a, b]) => inRing(a) && inRing(b));
const CLOSE_LEVEL = Math.max(...RING_STRUTS.map(([a, b]) => Math.min(depth[a], depth[b])));
const LAST = RING_STRUTS.find(([a, b]) => Math.min(depth[a], depth[b]) === CLOSE_LEVEL) as [number, number];
const FRONTIER = Math.max(...depth) - 1;
const waveAt = (level: number) => SCAFFOLD.grow[0] + (SCAFFOLD.grow[1] - SCAFFOLD.grow[0]) * (level / FRONTIER) ** 0.75;
interface Beam { from: number; to: number; start: number; span: number; reach: number }
const BEAMS: Beam[] = STRUTS.flatMap(([a, b], index): Beam[] => {
  const traced = STAR_LINKS.findIndex(([u, v]) => (u === a && v === b) || (u === b && v === a));
  if (traced >= 0) {
    const [from, to] = STAR_LINKS[traced];
    const slot = (SCAFFOLD.trace[1] - SCAFFOLD.trace[0]) / STAR_LINKS.length;
    return [{ from, to, start: SCAFFOLD.trace[0] + traced * slot, span: slot * 1.25, reach: 1 }];
  }
  const [from, to] = depth[a] <= depth[b] ? [a, b] : [b, a];
  if (a === LAST[0] && b === LAST[1]) {
    return [{ from, to, start: SCAFFOLD.close[0], span: SCAFFOLD.close[1] - SCAFFOLD.close[0], reach: 1 }];
  }
  const level = depth[from];
  if (level >= FRONTIER) return [];
  const start = mix(waveAt(level), waveAt(level + 1), seeded(index + 51) * 0.7);
  const reach = level === FRONTIER - 1 ? 0.25 + seeded(index + 97) * 0.6 : 1;
  return [{ from, to, start, span: 0.012 + seeded(index + 73) * 0.006, reach }];
});
// Cuándo se completa cada nudo: lo alcanza la primera viga que llega
const LIT_AT = NODES.map((_, node) => (STAR_NODES.includes(node) ? SCAFFOLD.stars[0] : Infinity));
for (const { to, start, span, reach } of BEAMS) {
  if (reach >= 1) LIT_AT[to] = Math.min(LIT_AT[to], start + span);
}
// La última soldadura de la celda: ahí destella al cerrarse
const CLOSING = BEAMS.find(({ start }) => start === SCAFFOLD.close[0]) as Beam;
/* Los paneles del casco: una de cada tantas celdas ya cerradas recibe el
   suyo, que se despliega desde una de sus vigas. Ni la celda de la ventana
   ni sus vecinas: la ventana queda enmarcada por celosía abierta */
const NEXT_TO_TARGET = new Set(FRAME.cells.filter((cell) => cell.ring.filter(inRing).length === 2));
const PANELS_AT = FRAME.cells.flatMap((cell, index) => {
  if (cell === TARGET || NEXT_TO_TARGET.has(cell) || seeded(index + 601) > 0.34) return [];
  const closed = Math.max(...cell.ring.map((node) => LIT_AT[node]));
  if (!Number.isFinite(closed)) return [];
  return [{ cell, start: closed + 0.008 + seeded(index + 653) * 0.03 }];
});
// Uno de cada tantos nudos lleva una luz de trabajo; unos pocos, una baliza roja
const LAMPS = NODES.map((_, node) => {
  const roll = seeded(node + 211);
  return roll < 0.24 ? 1 : roll > 0.975 ? 2 : 0;
});

/* ---------------- El cielo ---------------- */

// Estrellas en el infinito: solo giran con la cámara. Tres brillos
const SKY = Array.from({ length: 560 }, (_, index) => {
  const z = seeded(index + 4107) * 2 - 1;
  const angle = seeded(index + 4201) * Math.PI * 2;
  const ring = Math.sqrt(1 - z * z);
  const shine = seeded(index + 4303);
  return {
    direction: [ring * Math.cos(angle), ring * Math.sin(angle), z] as Vec,
    level: shine > 0.93 ? 2 : shine > 0.55 ? 0 : 1,
  };
});
// De dónde viene la luz que enciende un canto de cada viga
const SUN = normalize([-0.55, -0.6, 0.45]);

/* ---------------- La cámara ---------------- */

const FOCAL = 0.62;
const NEAR = 0.012;
// Distancia final al centro de la celda, y cuánto más entra al cubrir
const END_GAP = 0.25;
const PUSH = 0.1;

/* Todo el recorrido se describe en el plano del arco: a qué ángulo vamos
   desde la constelación, a qué distancia del centro y cuánto levantamos la
   vista sobre la tangente (π/2 es mirar de frente al armazón). Primero nos
   acercamos a la constelación mirándola; luego bajamos la vista y pasamos
   bajo ella, rozamos el armazón con las vigas encima y al llegar miramos
   hacia arriba, a la celda */
const RADIUS: [number, number][] = [
  [0.085, 0],
  [0.17, 0.8],
  [0.205, 0.87],
  [0.235, 0.86],
  [SCAFFOLD.glide[1], 1 - END_GAP],
  [SCAFFOLD.push[1], 1 - END_GAP + PUSH],
];
const PITCH: [number, number][] = [
  [0.085, Math.PI / 2 - 0.12],
  [0.14, Math.PI / 2],
  [0.195, 0.14],
  [0.235, 0.24],
  [SCAFFOLD.glide[1], Math.PI / 2],
];
const placeAt = (p: number) => {
  const { out, ahead } = arcAt(ARC * easeInOut(seg(p, SCAFFOLD.glide)));
  const pitch = keyed(p, PITCH);
  // Un leve rodeo hacia un costado al acercarnos: la constelación se desarma
  const aside = 0.16 * Math.sin(Math.PI * seg(p, [0.085, 0.22]));
  return {
    eye: add(times(out, keyed(p, RADIUS)), times(ARC_SIDE, aside)),
    forward: add(times(ahead, Math.cos(pitch)), times(out, Math.sin(pitch))),
    up: sub(times(out, Math.cos(pitch)), times(ahead, Math.sin(pitch))),
  };
};
const basis = (forward: Vec, up: Vec) => {
  const right = normalize(cross(times(up, -1), forward));
  return { right, down: cross(forward, right) };
};
// El ladeo final deja la celda con dos lados horizontales, como una ventana
const LEVEL = (() => {
  const { eye, forward, up } = placeAt(SCAFFOLD.glide[1]);
  const { right, down } = basis(forward, up);
  let best = Infinity;
  for (const node of TARGET.ring) {
    const offset = sub(NODES[node], eye);
    const angle = Math.atan2(dot(offset, down), dot(offset, right));
    if (Math.abs(angle) < Math.abs(best)) best = angle;
  }
  return best;
})();
// Un ladeo suave al acercarnos, otro al otro lado al rozar el armazón y
// quedamos nivelados frente a la celda
export const scaffoldRoll = (p: number) =>
  keyed(p, [[0.085, 0], [0.13, 0.09], [0.2, -0.13], [0.245, 0.07], [SCAFFOLD.glide[1], LEVEL]]);

// La cámara del guion, con la cabeza del visitante girada encima (la
// ventana se calcula con esta misma cámara: siempre calza con el dibujo)
const cameraAt = (p: number) => {
  const { eye, forward, up } = placeAt(p);
  const { right: right0, down: down0 } = basis(forward, up);
  const roll = scaffoldRoll(p);
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  return lookTurn({
    eye,
    forward,
    right: [right0[0] * cos + down0[0] * sin, right0[1] * cos + down0[1] * sin, right0[2] * cos + down0[2] * sin] as Vec,
    down: [down0[0] * cos - right0[0] * sin, down0[1] * cos - right0[1] * sin, down0[2] * cos - right0[2] * sin] as Vec,
  });
};
type Camera = ReturnType<typeof cameraAt>;

const projector = (camera: Camera, width: number, height: number) => {
  const { eye, forward, right, down } = camera;
  const focal = FOCAL * Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;
  return (point: Vec): [number, number, number] | null => {
    const offset = sub(point, eye);
    const depth = dot(offset, forward);
    if (depth < NEAR) return null;
    return [cx + (focal * dot(offset, right)) / depth, cy + (focal * dot(offset, down)) / depth, depth];
  };
};

/* La ventana: la celda tal como la ve la cámara, un poco hacia adentro de
   sus vigas. Se enciende desde el centro y, al cubrir, cada vértice se
   aleja `cover` píxeles más (lo bastante para que los lados también
   salgan del cuadro). Puntos x, y seguidos, o null si aún está cerrada */
export const scaffoldWindow = (p: number, width: number, height: number, cover: number) => {
  const lit = easeOut(seg(p, SCAFFOLD.open));
  if (lit <= 0) return null;
  const project = projector(cameraAt(p), width, height);
  const corners = TARGET.ring.map((node) => project(NODES[node]));
  if (corners.some((corner) => !corner)) return null;
  const points = corners as [number, number, number][];
  const mx = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const my = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  return points.flatMap(([x, y]) => {
    const dx = x - mx;
    const dy = y - my;
    const reach = Math.hypot(dx, dy) || 1;
    const scale = (0.86 * lit * reach + cover / Math.cos(Math.PI / 6)) / reach;
    return [mx + dx * scale, my + dy * scale];
  });
};

/* Cuánto tapa nuestro cielo al de la página (y a las constelaciones de la
   capa de efectos, que van encima) */
export const scaffoldSkyHidden = (p: number) => seg(p, [0.02, 0.045]);

/* ---------------- Destellos ---------------- */

// Un halo suave pintado una sola vez y estampado: mucho más barato que un
// degradado por luz
const sprites = new Map<string, HTMLCanvasElement>();
const sprite = (rgb: string) => {
  const cached = sprites.get(rgb);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0, `rgba(${rgb}, 1)`);
    glow.addColorStop(0.18, `rgba(${rgb}, 0.45)`);
    glow.addColorStop(0.5, `rgba(${rgb}, 0.1)`);
    glow.addColorStop(1, `rgba(${rgb}, 0)`);
    context.fillStyle = glow;
    context.fillRect(0, 0, 64, 64);
  }
  sprites.set(rgb, canvas);
  return canvas;
};

// La luz de trabajo de un nudo al cerrarse: parpadea dos veces y queda
const flicker = (since: number) => {
  if (since < 0) return 0;
  if (since < 0.004) return 0.8;
  if (since < 0.007) return 0.1;
  if (since < 0.01) return 1;
  if (since < 0.012) return 0.35;
  return 1;
};

/* ---------------- El cuadro ---------------- */

// Las vigas son celosías de tres cordones: su radio y cuántos paños de
// diagonales llevan. De lejos, un perfil macizo del mismo ancho
const TRUSS = 0.0055;
const PANELS = 7;
const THICK = TRUSS * 0.85;
// Desde qué distancia se ven las diagonales (se funden con el perfil)
const DETAIL: Range = [0.6, 0.42];
const HUB = 0.0075;

export const drawScaffold = (
  context: CanvasRenderingContext2D,
  p: number,
  width: number,
  height: number,
  [r, g, b]: number[],
  // La ventana abierta (puntos x, y), que se borra del cuadro
  window: number[] | null,
) => {
  const tint = (alpha: number, white: number) =>
    `rgba(${Math.round(r + (255 - r) * white)}, ${Math.round(g + (255 - g) * white)}, ${Math.round(b + (255 - b) * white)}, ${alpha.toFixed(3)})`;
  const camera = cameraAt(p);
  const { eye, forward, right, down } = camera;
  const project = projector(camera, width, height);
  const focal = FOCAL * Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;

  /* El fondo y las estrellas de verdad, que solo giran con la cámara */
  context.fillStyle = '#04060b';
  context.fillRect(0, 0, width, height);
  const stars = [new Path2D(), new Path2D(), new Path2D()];
  for (const { direction, level } of SKY) {
    const ahead = dot(direction, forward);
    if (ahead < 0.1) continue;
    const x = cx + (focal * dot(direction, right)) / ahead;
    const y = cy + (focal * dot(direction, down)) / ahead;
    if (x < -4 || x > width + 4 || y < -4 || y > height + 4) continue;
    const size = level === 2 ? 1.7 : 1.1;
    stars[level].rect(x - size / 2, y - size / 2, size, size);
  }
  ['rgba(220, 228, 255, 0.85)', 'rgba(220, 228, 255, 0.5)', 'rgba(255, 252, 245, 0.95)'].forEach((fill, level) => {
    context.fillStyle = fill;
    context.fill(stars[level]);
  });

  /* Las vigas: cada una crece desde su nudo de partida. Primero son trazos
     finos de constelación y luego toman cuerpo. De lejos, un perfil oscuro
     que tapa lo de atrás, con un canto encendido y otro en sombra; de cerca,
     una celosía de tres cordones con sus diagonales, por la que se ve el
     cielo. Su grosor sigue la perspectiva */
  const body = easeInOut(seg(p, SCAFFOLD.body));
  const sunX = dot(SUN, right);
  const sunY = dot(SUN, down);
  const tips: [number, number, number][] = [];
  const profiles: number[][] = [];
  const trusses: { from: Vec; to: Vec; full: Vec; grown: number; near: number; distance: number }[] = [];
  const clipped = (a: Vec, c: Vec) => {
    let pa = project(a);
    let pc = project(c);
    if (!pa && !pc) return null;
    if (!pa || !pc) {
      const da = dot(sub(a, eye), forward);
      const dc = dot(sub(c, eye), forward);
      const cut = project(mix3(a, c, (NEAR * 1.01 - da) / (dc - da)));
      if (!cut) return null;
      if (!pa) pa = cut;
      else pc = cut;
    }
    return [...pa, ...(pc as number[])];
  };
  for (const { from, to, start, span, reach } of BEAMS) {
    // Las del borde avanzan muy despacio y quedan a medio poner
    const grown = reach < 1
      ? reach * easeOut(seg(p, [start, start + span * 6]))
      : easeInOut(seg(p, [start, start + span]));
    if (grown <= 0) continue;
    const a = NODES[from];
    const tip = mix3(a, NODES[to], grown);
    const middle = mix3(a, tip, 0.5);
    const distance = Math.hypot(...sub(middle, eye));
    if (dot(sub(middle, eye), forward) < -0.2) continue;
    const near = body * smoothstep(DETAIL[0], DETAIL[1], distance);
    if (near > 0) trusses.push({ from: a, to: tip, full: NODES[to], grown, near, distance });
    if (near < 1) {
      const line = clipped(a, tip);
      if (line) profiles.push([...line, 1 - near]);
    }
    if (grown < 1) {
      const spot = project(tip);
      if (spot) tips.push(spot);
    }
  }
  /* Los paneles del casco, un poco hacia adentro de sus vigas: salen de
     una viga como una persiana. Brillan más cuanto más de frente nos
     miran, así que al pasar bajo ellos se encienden y apagan */
  const panels: { shape: Path2D; seam: Path2D; depth: number; sheen: number }[] = [];
  for (const { cell, start } of PANELS_AT) {
    const open = easeOut(seg(p, [start, start + 0.014]));
    if (open <= 0) continue;
    const middle = times(add(...cell.ring.map((node) => NODES[node])), 1 / cell.ring.length);
    const inset = cell.ring.map((node) => mix3(middle, NODES[node], 0.86));
    // Cada vértice avanza desde la viga del primer lado, en perpendicular a ella
    const hinge = normalize(sub(inset[1], inset[0]));
    const corners = inset.map((point) => {
      const offset = sub(point, inset[0]);
      const along = times(hinge, dot(offset, hinge));
      return project(add(inset[0], along, times(sub(offset, along), open)));
    });
    if (corners.some((corner) => !corner)) continue;
    const points = corners as [number, number, number][];
    if (points.every(([x]) => x < 0) || points.every(([x]) => x > width) || points.every(([, y]) => y < 0) || points.every(([, y]) => y > height)) continue;
    const shape = new Path2D();
    points.forEach(([x, y], index) => (index ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    shape.closePath();
    // Una junta de lado a lado divide el panel
    const seam = new Path2D();
    const half = Math.floor(points.length / 2);
    seam.moveTo(points[0][0], points[0][1]);
    seam.lineTo(points[half][0], points[half][1]);
    const facing = -dot(normalize(sub(eye, middle)), normalize(middle));
    panels.push({ shape, seam, depth: points.reduce((sum, [, , d]) => sum + d, 0) / points.length, sheen: Math.max(0, facing) ** 5 });
  }

  // De lejos a cerca: lo cercano tapa a lo lejano
  profiles.sort((one, two) => two[2] + two[5] - (one[2] + one[5]));
  const traceGlow = 1 - body;
  const batches = [
    profiles.filter(([, , ad, , , bd]) => ad + bd > 1.4),
    profiles.filter(([, , ad, , , bd]) => ad + bd <= 1.4),
  ];
  batches.forEach((batch, far) => {
    for (const { shape, seam, depth: away, sheen } of panels) {
      if ((away > 0.7) !== (far === 0)) continue;
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = 'rgb(8, 10, 14)';
      context.fill(shape);
      context.globalCompositeOperation = 'lighter';
      context.fillStyle = tint(0.015 + 0.06 * sheen, 0.5);
      context.fill(shape);
      context.lineWidth = 1;
      context.strokeStyle = tint(0.32 + 0.4 * sheen, 0.5);
      context.stroke(shape);
      context.strokeStyle = tint(0.12 + 0.12 * sheen, 0.3);
      context.stroke(seam);
    }
    if (!batch.length) return;
    const shade = new Path2D();
    const lit = new Path2D();
    const dark = new Path2D();
    for (const [ax, ay, ad, bx, by, bd, alpha] of batch) {
      const length = Math.hypot(bx - ax, by - ay) || 1;
      let nx = -(by - ay) / length;
      let ny = (bx - ax) / length;
      if (nx * sunX + ny * sunY < 0) {
        nx = -nx;
        ny = -ny;
      }
      const wa = mix(0.5, Math.max(0.6, (focal * THICK) / ad), body) * alpha;
      const wb = mix(0.5, Math.max(0.6, (focal * THICK) / bd), body) * alpha;
      shade.moveTo(ax + nx * wa, ay + ny * wa);
      shade.lineTo(bx + nx * wb, by + ny * wb);
      shade.lineTo(bx - nx * wb, by - ny * wb);
      shade.lineTo(ax - nx * wa, ay - ny * wa);
      shade.closePath();
      lit.moveTo(ax + nx * wa, ay + ny * wa);
      lit.lineTo(bx + nx * wb, by + ny * wb);
      dark.moveTo(ax - nx * wa, ay - ny * wa);
      dark.lineTo(bx - nx * wb, by - ny * wb);
    }
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = `rgba(7, 9, 12, ${(0.95 * body).toFixed(3)})`;
    context.fill(shade);
    context.globalCompositeOperation = 'lighter';
    context.lineWidth = 1;
    context.strokeStyle = tint(0.14 + 0.1 * traceGlow, 0.15);
    context.stroke(dark);
    context.strokeStyle = tint(0.55 + 0.3 * traceGlow, 0.45);
    context.stroke(lit);
  });

  /* Las celosías de cerca: tres cordones a lo largo y, en cada cara, una
     diagonal por paño que va y viene. El cordón exterior mira al cielo */
  trusses.sort((one, two) => two.distance - one.distance);
  context.globalCompositeOperation = 'lighter';
  for (const { from, to, full, grown, near, distance } of trusses) {
    const axis = sub(full, from);
    const length = Math.hypot(...axis);
    const along = times(axis, 1 / length);
    const outward = normalize(add(from, full));
    const side = cross(along, outward);
    const offsets = [0, 1, 2].map((k) => {
      const angle = (k * Math.PI * 2) / 3;
      return add(times(outward, TRUSS * Math.cos(angle)), times(side, TRUSS * Math.sin(angle)));
    });
    const chords = new Path2D();
    const braces = new Path2D();
    const put = (path: Path2D, a: Vec, c: Vec) => {
      const line = clipped(a, c);
      if (!line) return;
      path.moveTo(line[0], line[1]);
      path.lineTo(line[3], line[4]);
    };
    offsets.forEach((offset) => put(chords, add(from, offset), add(to, offset)));
    const panels = Math.floor(grown * PANELS + 1e-6);
    for (let panel = 0; panel < panels; panel++) {
      const s0 = add(from, times(along, (length * panel) / PANELS));
      const s1 = add(from, times(along, (length * (panel + 1)) / PANELS));
      for (let k = 0; k < 3; k++) {
        const [one, two] = panel % 2 ? [offsets[(k + 1) % 3], offsets[k]] : [offsets[k], offsets[(k + 1) % 3]];
        put(braces, add(s0, one), add(s1, two));
      }
    }
    const thick = Math.min(3, Math.max(1, (focal * 0.0012) / distance));
    context.globalAlpha = near;
    context.lineWidth = thick;
    context.strokeStyle = tint(0.85, 0.5);
    context.stroke(chords);
    context.lineWidth = Math.max(0.8, thick * 0.6);
    context.strokeStyle = tint(0.5, 0.3);
    context.stroke(braces);
  }
  context.globalAlpha = 1;

  /* Los nudos: una placa oscura con borde y, al cerrarse, su luz de
     trabajo. Los de la constelación empiezan como estrellas que se avivan */
  const starsUp = easeInOut(seg(p, SCAFFOLD.stars));
  const plates = new Path2D();
  const points = new Path2D();
  const glows: [number, number, number, number, string][] = [];
  NODES.forEach((node, index) => {
    const since = p - LIT_AT[index];
    if (since < 0) return;
    const spot = project(node);
    if (!spot) return;
    const [x, y, d] = spot;
    if (x < -80 || x > width + 80 || y < -80 || y > height + 80) return;
    const starry = STAR_NODES.includes(index);
    const plate = ((focal * HUB) / d) * body;
    if (plate > 2) {
      plates.moveTo(x + plate, y);
      plates.arc(x, y, plate, 0, Math.PI * 2);
    }
    if (starry && body < 1) {
      // De estrella del montón a estrella brillante, con su halo
      glows.push([x, y, (6 + 10 * starsUp) * (1 - body * 0.6), (0.25 + 0.6 * starsUp) * (1 - body * 0.5), '255, 244, 222']);
      const size = 1.7 + starsUp * 0.8;
      points.rect(x - size / 2, y - size / 2, size, size);
      return;
    }
    const lamp = LAMPS[index];
    // Los de la constelación encienden la suya al volverse nudos
    const on = flicker(starry ? p - SCAFFOLD.body[1] : since);
    if (lamp === 1 && on > 0) {
      glows.push([x, y, Math.min(70, Math.max(5, (focal * 0.05) / d)), 0.55 * on, '255, 204, 130']);
    } else if (lamp === 2) {
      const blink = Math.sin(p * 900 + index) > 0.6 ? 1 : 0.15;
      glows.push([x, y, Math.min(40, Math.max(4, (focal * 0.03) / d)), 0.7 * blink * on, '255, 90, 70']);
    }
    const speck = Math.min(2.4, Math.max(0.7, plate * 0.3));
    points.rect(x - speck, y - speck, speck * 2, speck * 2);
  });
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = 'rgba(12, 14, 18, 0.96)';
  context.fill(plates);
  context.globalCompositeOperation = 'lighter';
  context.strokeStyle = tint(0.6, 0.45);
  context.lineWidth = 1;
  context.stroke(plates);
  context.fillStyle = 'rgba(255, 238, 205, 0.9)';
  context.fill(points);

  // Chispas de soldadura en la punta de las vigas que crecen
  context.fillStyle = 'rgba(255, 255, 255, 0.95)';
  for (const [x, y, d] of tips) {
    if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;
    glows.push([x, y, Math.min(46, Math.max(7, (focal * 0.025) / d)), 0.95, '255, 236, 200']);
    context.fillRect(x - 1, y - 1, 2, 2);
  }
  // La celda se cierra con un destello en su última soldadura
  const closed = CLOSING.start + CLOSING.span;
  const flash = p > closed ? 1 - seg(p, [closed, closed + 0.014]) : 0;
  const weld = flash > 0 ? project(NODES[CLOSING.to]) : null;
  if (weld) glows.push([weld[0], weld[1], Math.min(160, (focal * 0.09) / weld[2]), flash, '255, 240, 214']);
  for (const [x, y, radius, alpha, rgb] of glows) {
    if (alpha <= 0.01) continue;
    context.globalAlpha = Math.min(1, alpha);
    context.drawImage(sprite(rgb), x - radius, y - radius, radius * 2, radius * 2);
  }
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';

  /* La ventana: se borra del cuadro; un filo cálido marca su borde mientras
     se enciende */
  if (window) {
    const shape = new Path2D();
    for (let index = 0; index < window.length; index += 2) {
      if (index) shape.lineTo(window[index], window[index + 1]);
      else shape.moveTo(window[index], window[index + 1]);
    }
    shape.closePath();
    context.globalCompositeOperation = 'destination-out';
    context.fillStyle = '#000';
    context.fill(shape);
    context.globalCompositeOperation = 'lighter';
    const edge = 1 - seg(p, [SCAFFOLD.open[1], SCAFFOLD.open[1] + 0.06]);
    if (edge > 0) {
      context.strokeStyle = tint(0.8 * edge, 0.6);
      context.lineWidth = 1.5;
      context.stroke(shape);
    }
    context.globalCompositeOperation = 'source-over';
  }
};
