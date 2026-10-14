import { clamp01, smoothstep } from './roomShared';
import { lookShift, lookTurn } from './lookAround';

/* Energía estelar: cruzamos un enjambre de Dyson hasta su estrella.

   De lejos, la estrella está envuelta en anillos de colectores que la
   orbitan; bajamos hasta el plano del anillo más cercano, que la cruza por
   delante, y vamos derecho hacia él a contraluz: sus placas son siluetas
   oscuras con el borde encendido y la estrella asoma entre ellas. Pasamos
   por la junta entre sus dos hileras y, ya adentro, viramos para volar a
   su lado: las placas pasan rozándonos y en cada espejo se desliza el
   reflejo de la estrella. Ese anillo aún está plegado; una ola lo
   despliega delante nuestro, cada placa destella al girar hacia el sol y
   la ola le da la vuelta a la estrella hasta cerrar el cinturón. Al final
   viramos hacia la estrella y la ventana se abre en su disco.

   El mundo se mide en radios de la estrella, que está en el origen. El
   anillo que cruzamos (A) está en el plano XZ, con su eje en y. */

type Range = [number, number];
type Vec3 = [number, number, number];

export const SWARM = {
  // La estrella y sus anillos crecen; bajamos al plano del anillo A
  arrive: [0.02, 0.085],
  // Derecho hacia el anillo, a contraluz, y por la junta entre sus hileras
  thread: [0.085, 0.128],
  // Viramos y volamos junto al anillo mientras la ola lo despliega
  skim: [0.128, 0.205],
  // Viramos hacia la estrella
  dive: [0.205, 0.245],
  // Y la ventana se abre en su disco
  open: [0.245, 0.29],
} satisfies Record<string, Range>;

const seg = (p: number, [from, to]: Range) => clamp01((p - from) / (to - from));
const ease = (t: number) => smoothstep(0, 1, t);
const seeded = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/* Curva por claves (p, valor): cúbica monótona, sin rebotes entre claves */
const keyed = (keys: [number, number][]) => {
  const slopes = keys.map((_, index) => {
    if (index === 0 || index === keys.length - 1) return 0;
    const [p0, v0] = keys[index - 1];
    const [p1, v1] = keys[index];
    const [p2, v2] = keys[index + 1];
    const before = (v1 - v0) / (p1 - p0);
    const after = (v2 - v1) / (p2 - p1);
    return before * after <= 0 ? 0 : (2 * before * after) / (before + after);
  });
  return (p: number) => {
    if (p <= keys[0][0]) return keys[0][1];
    const last = keys.length - 1;
    if (p >= keys[last][0]) return keys[last][1];
    let index = 0;
    while (p > keys[index + 1][0]) index++;
    const [p0, v0] = keys[index];
    const [p1, v1] = keys[index + 1];
    const span = p1 - p0;
    const t = (p - p0) / span;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * span * slopes[index]
      + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * span * slopes[index + 1];
  };
};

/* ---------------- La cámara ---------------- */

// Distancia a la estrella (en logaritmo: el acercamiento se siente parejo)
const DISTANCE = keyed([
  [0.02, Math.log(34)],
  [0.06, Math.log(11)],
  [0.095, Math.log(4.6)],
  [0.118, Math.log(3.32)],
  [0.135, Math.log(3.12)],
  [0.205, Math.log(3.1)],
  [0.245, Math.log(2.3)],
  [0.34, Math.log(2.05)],
]);
// Ángulo recorrido sobre el anillo A: quietos al acercarnos, después lo
// seguimos a ritmo parejo, cabalgando la ola que lo despliega
const ORBIT = keyed([
  [0.118, 0],
  [0.14, 0.07],
  [0.17, 0.75],
  [0.205, 1.55],
  [0.245, 1.72],
  [0.34, 1.8],
]);
// Altura sobre el plano del anillo A (ángulo visto desde la estrella)
const ELEVATION = keyed([
  [0.02, 0.34],
  [0.07, 0.15],
  [0.105, 0.012],
  [0.118, 0],
  [0.128, 0.004],
  [0.16, 0.075],
  [0.205, 0.085],
  [0.245, 0.2],
  [0.34, 0.22],
]);
// Cuánto apartamos la vista de la estrella (positivo: a la derecha)
const TURN = keyed([
  [0.118, 0],
  [0.152, 1.02],
  [0.205, 0.86],
  [0.245, 0],
]);
// Cabeceo sobre la línea a la estrella
const NOD = keyed([
  [0.118, 0],
  [0.15, -0.2],
  [0.205, -0.18],
  [0.245, 0],
]);
// Alabeo: nos ladeamos al virar
const BANK = keyed([
  [0.02, 0.1],
  [0.1, -0.04],
  [0.118, 0],
  [0.145, -0.42],
  [0.165, -0.24],
  [0.188, -0.4],
  [0.205, -0.3],
  [0.245, 0],
]);
// Distancia focal respecto al lado corto de la pantalla: angular al volar
// junto al anillo
const LENS = keyed([
  [0.02, 0.62],
  [0.1, 0.62],
  [0.122, 0.5],
  [0.14, 0.44],
  [0.205, 0.46],
  [0.245, 0.62],
]);

interface Camera {
  position: Vec3;
  right: Vec3;
  up: Vec3;
  forward: Vec3;
  focal: number;
}

const cameraAt = (p: number, width: number, height: number): Camera => {
  const short = Math.min(width, height);
  const distance = Math.exp(DISTANCE(p));
  const orbit = ORBIT(p);
  const elevation = ELEVATION(p);
  // Sobre el anillo A: e1 = (0, 0, -1), e2 = (-1, 0, 0)
  const flat = Math.cos(elevation) * distance;
  const position: Vec3 = [-flat * Math.sin(orbit), Math.sin(elevation) * distance, -flat * Math.cos(orbit)];
  // Hacia la estrella, y desde ahí giramos y cabeceamos
  const toStar: Vec3 = [-position[0] / distance, -position[1] / distance, -position[2] / distance];
  const horizontal = Math.hypot(toStar[0], toStar[2]) || 1;
  // En pantallas angostas giramos menos, para no perder la estrella de vista
  const across = (width / 2) / (LENS(p) * short);
  const turn = TURN(p) * Math.max(0.9, Math.min(1, Math.atan(0.62 * across) / Math.atan(0.62 * 1.82)));
  const yaw = Math.atan2(toStar[0], toStar[2]) - turn;
  const shake = Math.exp(-(((p - 0.119) / 0.006) ** 2)) + 0.35 * seg(p, [0.135, 0.15]) * (1 - seg(p, [0.2, 0.225]));
  const pitch = Math.atan2(toStar[1], horizontal) + NOD(p) + shake * 0.008 * Math.sin(p * 1300 + 1.3);
  const forward: Vec3 = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  // Derecha = adelante × arriba, y el alabeo la gira sobre el eje de la vista
  const flatRight: Vec3 = normalize([-forward[2], 0, forward[0]]);
  const flatUp = cross(flatRight, forward);
  // Rozando las placas, un temblor leve: se siente el vuelo
  const cruise = Math.exp(-(((p - 0.119) / 0.006) ** 2)) + 0.35 * seg(p, [0.135, 0.15]) * (1 - seg(p, [0.2, 0.225]));
  const bank = BANK(p) + cruise * (0.018 * Math.sin(p * 900) + 0.01 * Math.sin(p * 2300));
  const cos = Math.cos(bank);
  const sin = Math.sin(bank);
  const right: Vec3 = [
    flatRight[0] * cos + flatUp[0] * sin,
    flatRight[1] * cos + flatUp[1] * sin,
    flatRight[2] * cos + flatUp[2] * sin,
  ];
  const up: Vec3 = [
    flatUp[0] * cos - flatRight[0] * sin,
    flatUp[1] * cos - flatRight[1] * sin,
    flatUp[2] * cos - flatRight[2] * sin,
  ];
  // Y encima, la cabeza del visitante (mirar alrededor)
  const looked = lookTurn({ forward, right, down: [-up[0], -up[1], -up[2]] });
  return {
    position,
    right: looked.right as Vec3,
    up: [-looked.down[0], -looked.down[1], -looked.down[2]],
    forward: looked.forward as Vec3,
    focal: LENS(p) * short,
  };
};

// El lente (px): con él se sabe dónde queda la ventana al girar la cabeza
export const swarmFocal = (p: number, width: number, height: number) => LENS(p) * Math.min(width, height);

const normalize = ([x, y, z]: Vec3): Vec3 => {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// El alabeo, para que el cielo de la página gire con la cámara
export const swarmRoll = (p: number) => BANK(p);
// Cuánto tapa nuestro cielo al de la página
export const swarmSkyHidden = (p: number) => seg(p, [0.02, 0.05]);

/* ---------------- El enjambre ---------------- */

interface Ring {
  radius: number;
  axis: Vec3;
  e1: Vec3;
  e2: Vec3;
  // Giro orbital por unidad de progreso
  spin: number;
  // Placas: ancho a lo largo del anillo y alto a lo largo del eje
  width: number;
  height: number;
  plates: { angle: number; lift: number; tiltA: number; tiltB: number; wobble: number }[];
  // El anillo A se despliega con la ola
  folds: boolean;
}

const makeRing = (
  radius: number,
  inclination: number,
  node: number,
  spin: number,
  pitch: number,
  rows: number[],
  [width, height]: [number, number],
  seed: number,
  folds = false,
): Ring => {
  // La línea de nodos, en el plano XZ, y el eje inclinado sobre ella
  const e1: Vec3 = [-Math.sin(node), 0, -Math.cos(node)];
  const tilted = cross(e1, [0, 1, 0]);
  const axis: Vec3 = normalize([
    tilted[0] * Math.sin(inclination),
    Math.cos(inclination),
    tilted[2] * Math.sin(inclination),
  ]);
  const e2 = cross(axis, e1);
  const count = Math.round((Math.PI * 2 * radius) / pitch);
  const plates: Ring['plates'] = [];
  for (let column = 0; column < count; column++) {
    for (const lift of rows) {
      const index = plates.length + seed;
      plates.push({
        angle: ((column + (seeded(index + 11) - 0.5) * 0.12) / count) * Math.PI * 2,
        lift,
        tiltA: (seeded(index + 23) - 0.5) * 0.22,
        tiltB: (seeded(index + 37) - 0.5) * 0.22,
        wobble: seeded(index + 41) * Math.PI * 2,
      });
    }
  }
  return { radius, axis, e1, e2, spin, width, height, plates, folds };
};

const RINGS: Ring[] = [
  // A: el que cruzamos; cuatro hileras con una junta al medio
  makeRing(3.3, 0, 0, 0.35, 0.125, [-0.175, -0.075, 0.075, 0.175], [0.1, 0.085], 100, true),
  // Interior, muy inclinado: pasa por delante de la estrella
  makeRing(2.55, 1.05, 0.5, -0.8, 0.16, [0], [0.11, 0.11], 2000),
  // Exteriores, a contramano
  makeRing(4.1, -0.62, 2.1, 0.5, 0.2, [0], [0.14, 0.12], 3000),
  makeRing(4.7, 1.38, -0.9, -0.35, 0.22, [0], [0.15, 0.12], 4000),
];

// Polvo de colectores lejanos: anillos de puntos que dan el volumen del enjambre
const DUST = Array.from({ length: 7 }, (_, ring) => {
  const inclination = (seeded(ring + 5101) - 0.5) * 3;
  const node = seeded(ring + 5203) * Math.PI * 2;
  const e1: Vec3 = [-Math.sin(node), 0, -Math.cos(node)];
  const tilted = cross(e1, [0, 1, 0]);
  const axis = normalize([tilted[0] * Math.sin(inclination), Math.cos(inclination), tilted[2] * Math.sin(inclination)]);
  return {
    radius: 5.4 + ring * 0.55,
    e1,
    e2: cross(axis, e1),
    spin: (ring % 2 ? -1 : 1) * (0.2 + seeded(ring + 5309) * 0.3),
    count: 150 + ring * 24,
    phase: seeded(ring + 5407) * Math.PI * 2,
  };
});

// La ola despliega el anillo A: por delante del cruce está plegado. La ola
// nos alcanza, avanza un rato justo delante nuestro (las placas se abren y
// destellan a nuestro paso) y luego se adelanta y cierra el cinturón
const FOLD_FROM = 0.2;
const FOLD_TO = Math.PI * 2 - 0.35;
const WAVE_WIDTH = 0.3;
const waveFront = keyed([
  [0.148, FOLD_FROM - WAVE_WIDTH],
  [0.16, 0.9],
  [0.188, 1.62],
  [0.2, 3.4],
  [0.214, FOLD_TO + WAVE_WIDTH],
]);

/* ---------------- El cielo y la estrella ---------------- */

const SKY = Array.from({ length: 560 }, (_, index) => {
  const z = seeded(index + 7101) * 2 - 1;
  const angle = seeded(index + 7207) * Math.PI * 2;
  const ring = Math.sqrt(1 - z * z);
  const shine = seeded(index + 7307);
  return {
    direction: [ring * Math.cos(angle), z, ring * Math.sin(angle)] as Vec3,
    level: shine > 0.94 ? 2 : shine > 0.55 ? 0 : 1,
  };
});

// La estrella se pinta una sola vez: oscurecimiento al borde, granulación
// aplastada hacia el limbo y unas pocas manchas
let starTexture: HTMLCanvasElement | null = null;
const STAR_SIZE = 768;
const starImage = () => {
  if (starTexture) return starTexture;
  const canvas = document.createElement('canvas');
  canvas.width = STAR_SIZE;
  canvas.height = STAR_SIZE;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const r = STAR_SIZE / 2;
  const base = context.createRadialGradient(r, r, 0, r, r, r);
  base.addColorStop(0, 'rgb(255, 242, 206)');
  base.addColorStop(0.4, 'rgb(255, 222, 150)');
  base.addColorStop(0.72, 'rgb(255, 184, 92)');
  base.addColorStop(0.9, 'rgb(244, 134, 56)');
  base.addColorStop(1, 'rgb(206, 84, 30)');
  context.fillStyle = base;
  context.beginPath();
  context.arc(r, r, r, 0, Math.PI * 2);
  context.fill();
  context.save();
  context.clip();
  // Granos: celdas claras con bordes oscuros, más chatas cerca del limbo
  for (let index = 0; index < 11000; index++) {
    const radial = Math.sqrt(seeded(index + 8101)) * 0.995;
    const angle = seeded(index + 8209) * Math.PI * 2;
    const squash = Math.sqrt(Math.max(0.02, 1 - radial * radial));
    const size = (1.3 + seeded(index + 8311) * 2) * (STAR_SIZE / 640);
    const dark = seeded(index + 8419) > 0.5;
    context.fillStyle = dark ? 'rgba(170, 70, 20, 0.07)' : 'rgba(255, 252, 236, 0.09)';
    context.beginPath();
    context.ellipse(r + Math.cos(angle) * radial * r, r + Math.sin(angle) * radial * r, size * squash, size, angle, 0, Math.PI * 2);
    context.fill();
  }
  // Fáculas: manchas claras cerca del borde
  for (let index = 0; index < 60; index++) {
    const radial = 0.78 + seeded(index + 8501) * 0.2;
    const angle = seeded(index + 8603) * Math.PI * 2;
    const glow = context.createRadialGradient(
      r + Math.cos(angle) * radial * r, r + Math.sin(angle) * radial * r, 0,
      r + Math.cos(angle) * radial * r, r + Math.sin(angle) * radial * r, r * 0.06,
    );
    glow.addColorStop(0, 'rgba(255, 240, 200, 0.14)');
    glow.addColorStop(1, 'rgba(255, 240, 200, 0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, STAR_SIZE, STAR_SIZE);
  }
  // Manchas: un núcleo oscuro con penumbra
  [[0.42, 0.6, 1], [0.48, 0.66, 0.6], [0.3, 3.4, 0.8], [0.62, 4.6, 0.5]].forEach(([radial, angle, size]) => {
    const x = r + Math.cos(angle) * radial * r;
    const y = r + Math.sin(angle) * radial * r;
    const squash = Math.sqrt(1 - radial * radial);
    context.fillStyle = 'rgba(150, 64, 24, 0.55)';
    context.beginPath();
    context.ellipse(x, y, 9 * size * squash, 9 * size, angle, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(70, 24, 10, 0.85)';
    context.beginPath();
    context.ellipse(x, y, 4.5 * size * squash, 4.5 * size, angle, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
  starTexture = canvas;
  return canvas;
};

// Para pintar la estrella antes de que haga falta
export const prepareSwarm = () => {
  starImage();
};

// Protuberancias: arcos de plasma sobre el limbo (ángulo, ancho del pie, alto)
const PROMINENCES = Array.from({ length: 6 }, (_, index) => ({
  angle: seeded(index + 9101) * Math.PI * 2,
  foot: 0.04 + seeded(index + 9203) * 0.06,
  rise: 0.03 + seeded(index + 9307) * 0.06,
  lean: (seeded(index + 9403) - 0.5) * 0.6,
}));

/* ---------------- El cuadro ---------------- */

interface Plate {
  depth: number;
  // Esquinas ya proyectadas (x, y, x, y…)
  corners: number[];
  face: boolean;
  // Brillo de la cara, contraluz del dorso y destello
  light: number;
  corona: number;
  rim: number;
  glint: number;
  // Reflejo de la estrella (en pantalla) si cae sobre la placa
  mirror: [number, number, number] | null;
  size: number;
  box: [number, number, number, number];
  // Dirección de la grilla de celdas sobre la placa
  grid: number[] | null;
}

const NEAR = 0.012;

export const drawSwarm = (
  context: CanvasRenderingContext2D,
  p: number,
  width: number,
  height: number,
  // Radio de la ventana ya abierta (px), centrada en la pantalla
  opening: number,
) => {
  const camera = cameraAt(p, width, height);
  const { position: eye, right, up, forward, focal } = camera;
  const cx = width / 2;
  const cy = height / 2;

  // Del mundo a la cámara (x a la derecha, y arriba, z adelante)
  const view = (x: number, y: number, z: number, out: number[]) => {
    const dx = x - eye[0];
    const dy = y - eye[1];
    const dz = z - eye[2];
    out[0] = dx * right[0] + dy * right[1] + dz * right[2];
    out[1] = dx * up[0] + dy * up[1] + dz * up[2];
    out[2] = dx * forward[0] + dy * forward[1] + dz * forward[2];
  };
  const camPoint = [0, 0, 0];

  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
  context.fillStyle = '#04050a';
  context.fillRect(0, 0, width, height);

  // Nuestro cielo: gira con la cámara (el de la página queda tapado)
  {
    const stars = [new Path2D(), new Path2D(), new Path2D()];
    for (const { direction, level } of SKY) {
      const z = direction[0] * forward[0] + direction[1] * forward[1] + direction[2] * forward[2];
      if (z < 0.1) continue;
      const x = cx + (focal * (direction[0] * right[0] + direction[1] * right[1] + direction[2] * right[2])) / z;
      const y = cy - (focal * (direction[0] * up[0] + direction[1] * up[1] + direction[2] * up[2])) / z;
      if (x < -2 || x > width + 2 || y < -2 || y > height + 2) continue;
      const size = level === 2 ? 1.7 : 1.1;
      stars[level].rect(x - size / 2, y - size / 2, size, size);
    }
    ['rgba(214, 222, 255, 0.85)', 'rgba(214, 222, 255, 0.45)', 'rgba(255, 250, 238, 0.95)'].forEach((fill, level) => {
      context.fillStyle = fill;
      context.fill(stars[level]);
    });
  }

  // La estrella en pantalla
  view(0, 0, 0, camPoint);
  const starDepth = camPoint[2];
  const starDistance = Math.hypot(eye[0], eye[1], eye[2]);
  const starOnScreen = starDepth > NEAR;
  const sx = starOnScreen ? cx + (focal * camPoint[0]) / starDepth : 0;
  const sy = starOnScreen ? cy - (focal * camPoint[1]) / starDepth : 0;
  // El radio aparente de una esfera (más justo que radio / profundidad de cerca)
  const starRadius = starOnScreen ? (focal * Math.tan(Math.asin(Math.min(0.999, 1 / starDistance)))) * (starDistance / starDepth) : 0;

  /* ---- Las placas ---- */
  const time = p;
  const front = waveFront(p);
  const behindDots = { lit: new Path2D(), glint: new Path2D() };
  const frontDots = { lit: new Path2D(), glint: new Path2D(), dark: new Path2D() };
  const plates: Plate[] = [];
  // Las placas chicas no se ordenan: van en pocos trazos por capa
  const makeLayer = () => ({
    faces: Array.from({ length: 6 }, () => new Path2D()),
    glints: new Path2D(),
    edges: Array.from({ length: 4 }, () => new Path2D()),
    backs: new Path2D(),
    rims: Array.from({ length: 5 }, () => new Path2D()),
  });
  const smallBehind = makeLayer();
  const smallFront = makeLayer();
  const quad = (path: Path2D, corners: number[]) => {
    path.moveTo(corners[0], corners[1]);
    for (let index = 2; index < corners.length; index += 2) path.lineTo(corners[index], corners[index + 1]);
    path.closePath();
  };
  const corner = [0, 0, 0];
  const clipped: number[][] = [];
  const toEye = [0, 0, 0];

  for (const ring of RINGS) {
    const { radius, axis, e1, e2, width: plateWidth, height: plateHeight } = ring;
    for (const plate of ring.plates) {
      const angle = plate.angle + ring.spin * time;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      // Hacia afuera, a lo largo del anillo y el eje
      const outX = cos * e1[0] + sin * e2[0];
      const outY = cos * e1[1] + sin * e2[1];
      const outZ = cos * e1[2] + sin * e2[2];
      const tangentX = -sin * e1[0] + cos * e2[0];
      const tangentY = -sin * e1[1] + cos * e2[1];
      const tangentZ = -sin * e1[2] + cos * e2[2];
      const centerX = outX * radius + axis[0] * plate.lift;
      const centerY = outY * radius + axis[1] * plate.lift;
      const centerZ = outZ * radius + axis[2] * plate.lift;
      view(centerX, centerY, centerZ, camPoint);
      const depth = camPoint[2];
      if (depth < -0.4) continue;
      // Plegada, de canto a la estrella (mira hacia atrás en la órbita);
      // desplegada, hacia ella: gira sobre su eje como una persiana
      let fold = 0;
      if (ring.folds) {
        const local = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (local > FOLD_FROM && local < FOLD_TO) fold = 1 - ease((front - local) / WAVE_WIDTH);
      }
      const beta = (Math.PI / 2) * fold;
      const wobble = 0.05 * Math.sin(time * 40 + plate.wobble);
      const cb = Math.cos(beta);
      const sb = Math.sin(beta);
      // Normal: hacia adentro (−out), o hacia atrás (−tangente) si está plegada
      let nx = -outX * cb - tangentX * sb;
      let ny = -outY * cb - tangentY * sb;
      let nz = -outZ * cb - tangentZ * sb;
      let hx = axis[0];
      let hy = axis[1];
      let hz = axis[2];
      const tiltA = plate.tiltA + wobble;
      nx += tangentX * tiltA * cb + hx * plate.tiltB;
      ny += tangentY * tiltA * cb + hy * plate.tiltB;
      nz += tangentZ * tiltA * cb + hz * plate.tiltB;
      const nLength = Math.hypot(nx, ny, nz);
      nx /= nLength;
      ny /= nLength;
      nz /= nLength;
      // Rehace la base de la placa sobre la nueva normal
      const along = tangentX * nx + tangentY * ny + tangentZ * nz;
      let tx = tangentX - nx * along;
      let ty = tangentY - ny * along;
      let tz = tangentZ - nz * along;
      const tLength = Math.hypot(tx, ty, tz);
      tx /= tLength;
      ty /= tLength;
      tz /= tLength;
      hx = ny * tz - nz * ty;
      hy = nz * tx - nx * tz;
      hz = nx * ty - ny * tx;

      // Luz: hacia la estrella y hacia el ojo
      const distance = Math.hypot(centerX, centerY, centerZ);
      const lx = -centerX / distance;
      const ly = -centerY / distance;
      const lz = -centerZ / distance;
      toEye[0] = eye[0] - centerX;
      toEye[1] = eye[1] - centerY;
      toEye[2] = eye[2] - centerZ;
      const eyeDistance = Math.hypot(toEye[0], toEye[1], toEye[2]);
      const vx = toEye[0] / eyeDistance;
      const vy = toEye[1] / eyeDistance;
      const vz = toEye[2] / eyeDistance;
      const facing = nx * vx + ny * vy + nz * vz;
      const lit = Math.max(0, nx * lx + ny * ly + nz * lz);
      const face = facing > 0;
      // Destello: la cara refleja la estrella justo hacia nosotros
      let glint = 0;
      if (face && lit > 0) {
        const hx2 = lx + vx;
        const hy2 = ly + vy;
        const hz2 = lz + vz;
        const half = (nx * hx2 + ny * hy2 + nz * hz2) / (Math.hypot(hx2, hy2, hz2) || 1);
        glint = Math.exp(-(1 - half) / 0.0035);
      }
      // Qué tan cerca de la estrella cae lo que el espejo nos refleja: el
      // resplandor de la corona lo entibia antes de que entre el disco
      let corona = 0;
      if (face && lit > 0) {
        const twice = 2 * facing;
        const near = (twice * nx - vx) * lx + (twice * ny - vy) * ly + (twice * nz - vz) * lz;
        const span = Math.asin(Math.min(0.999, 1 / distance));
        const off = Math.acos(Math.max(-1, Math.min(1, near)));
        corona = Math.exp(-((off / (span * 2.4)) ** 2));
      }
      // Contraluz: la placa tapa la estrella o queda junto a ella
      let rim = 0;
      if (!face) {
        const starAway = Math.hypot(eye[0], eye[1], eye[2]);
        const toward = -(eye[0] * -vx + eye[1] * -vy + eye[2] * -vz) / starAway;
        const apart = Math.acos(Math.max(-1, Math.min(1, toward)));
        rim = Math.exp(-((apart / (Math.asin(Math.min(0.999, 1 / starAway)) * 1.8)) ** 2));
      }

      const size = depth > NEAR ? (focal * plateWidth) / depth : Infinity;
      const behind = depth > starDepth;
      if (size < 3.2) {
        // De lejos, un punto
        if (depth < NEAR) continue;
        const x = cx + (focal * camPoint[0]) / depth;
        const y = cy - (focal * camPoint[1]) / depth;
        if (x < -4 || x > width + 4 || y < -4 || y > height + 4) continue;
        const dot = Math.max(1, size * 0.55);
        if (face) {
          const target = behind ? behindDots : frontDots;
          (glint > 0.25 ? target.glint : target.lit).rect(x - dot / 2, y - dot / 2, dot, glint > 0.25 ? dot * 1.4 : dot);
        } else if (!behind) {
          frontDots.dark.rect(x - dot / 2 - 0.4, y - dot / 2 - 0.4, dot + 0.8, dot + 0.8);
        }
        continue;
      }

      // De cerca, la placa entera, recortada contra el plano cercano
      const halfW = plateWidth / 2;
      const halfH = plateHeight / 2;
      clipped.length = 0;
      const local: number[][] = [];
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        view(
          centerX + tx * a * halfW + hx * b * halfH,
          centerY + ty * a * halfW + hy * b * halfH,
          centerZ + tz * a * halfW + hz * b * halfH,
          corner,
        );
        local.push([corner[0], corner[1], corner[2]]);
      }
      for (let index = 0; index < 4; index++) {
        const a = local[index];
        const b = local[(index + 1) % 4];
        if (a[2] >= NEAR) clipped.push(a);
        if ((a[2] >= NEAR) !== (b[2] >= NEAR)) {
          const t = (NEAR - a[2]) / (b[2] - a[2]);
          clipped.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
        }
      }
      if (clipped.length < 3) continue;
      const corners: number[] = [];
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const [x, y, z] of clipped) {
        const px = cx + (focal * x) / z;
        const py = cy - (focal * y) / z;
        corners.push(px, py);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
      if (maxX < 0 || minX > width || maxY < 0 || minY > height) continue;
      if (size < 18) {
        const layer = behind ? smallBehind : smallFront;
        if (face) {
          // Una escama de luz: su cara iluminada, con borde solo al crecer
          const shine = Math.min(1, 0.12 + 0.5 * lit * (1 - smoothstep(8, 18, size)) + corona);
          quad(corona > 0.6 ? layer.glints : layer.faces[Math.min(5, Math.floor(shine * 6))], corners);
          const edge = Math.min(1, 0.2 + 0.4 * lit + corona) * smoothstep(6, 18, size);
          if (edge > 0.05) quad(layer.edges[Math.min(3, Math.floor(edge * 4))], corners);
        } else {
          quad(layer.backs, corners);
          quad(layer.rims[Math.min(4, Math.floor(rim * 5))], corners);
        }
        continue;
      }

      // El reflejo de la estrella: su imagen especular tras el plano de la placa
      let mirror: Plate['mirror'] = null;
      if (face && size > 14 && lit > 0.2) {
        const across = 2 * (centerX * nx + centerY * ny + centerZ * nz);
        const imageX = across * nx;
        const imageY = across * ny;
        const imageZ = across * nz;
        view(imageX, imageY, imageZ, corner);
        if (corner[2] > NEAR) {
          const mx = cx + (focal * corner[0]) / corner[2];
          const my = cy - (focal * corner[1]) / corner[2];
          const mr = focal / corner[2];
          if (mx + mr > minX && mx - mr < maxX && my + mr > minY && my - mr < maxY) mirror = [mx, my, mr];
        }
      }
      // La grilla de celdas: dos líneas a lo largo y tres de través
      let grid: number[] | null = null;
      if (size > 26 && clipped.length === 4 && local.every(([, , z]) => z >= NEAR)) {
        grid = [];
        const at = (a: number, b: number) => {
          view(
            centerX + tx * a * halfW + hx * b * halfH,
            centerY + ty * a * halfW + hy * b * halfH,
            centerZ + tz * a * halfW + hz * b * halfH,
            corner,
          );
          grid?.push(cx + (focal * corner[0]) / corner[2], cy - (focal * corner[1]) / corner[2]);
        };
        for (const a of [-0.5, 0, 0.5]) {
          at(a, -1);
          at(a, 1);
        }
        at(-1, 0);
        at(1, 0);
      }
      plates.push({ depth, corners, face, light: lit, corona, rim, glint, mirror, size, grid, box: [minX, minY, maxX, maxY] });
    }
  }

  // El polvo lejano del enjambre
  for (const dust of DUST) {
    for (let index = 0; index < dust.count; index++) {
      const angle = dust.phase + dust.spin * time + (index / dust.count) * Math.PI * 2;
      const cos = Math.cos(angle) * dust.radius;
      const sin = Math.sin(angle) * dust.radius;
      view(cos * dust.e1[0] + sin * dust.e2[0], cos * dust.e1[1] + sin * dust.e2[1], cos * dust.e1[2] + sin * dust.e2[2], camPoint);
      if (camPoint[2] < NEAR) continue;
      const x = cx + (focal * camPoint[0]) / camPoint[2];
      const y = cy - (focal * camPoint[1]) / camPoint[2];
      if (x < 0 || x > width || y < 0 || y > height) continue;
      const target = camPoint[2] > starDepth ? behindDots : frontDots;
      const sparkle = seeded(index * 7 + Math.floor(time * 300 + dust.phase * 10)) > 0.93;
      (sparkle ? target.glint : target.lit).rect(x - 0.5, y - 0.5, 1, 1);
    }
  }

  const drawDots = (dots: { lit: Path2D; glint: Path2D; dark?: Path2D }) => {
    if (dots.dark) {
      context.fillStyle = 'rgb(20, 10, 6)';
      context.fill(dots.dark);
    }
    context.fillStyle = 'rgba(249, 206, 120, 0.7)';
    context.fill(dots.lit);
    context.fillStyle = 'rgb(255, 246, 226)';
    context.fill(dots.glint);
  };

  plates.sort((a, b) => b.depth - a.depth);
  const drawPlate = (plate: Plate) => {
    const { corners } = plate;
    context.beginPath();
    context.moveTo(corners[0], corners[1]);
    for (let index = 2; index < corners.length; index += 2) context.lineTo(corners[index], corners[index + 1]);
    context.closePath();
    if (plate.face) {
      // Espejo: oscuro, con un velo dorado según la luz y el destello
      const warm = Math.min(1, 0.05 * plate.light + 0.9 * plate.corona ** 1.6 + 0.5 * plate.glint);
      const red = Math.round(11 + 244 * warm);
      const green = Math.round(14 + 160 * warm);
      const blue = Math.round(24 + 60 * warm);
      context.fillStyle = `rgb(${red}, ${green}, ${blue})`;
      context.fill();
      if (plate.mirror) {
        const [mx, my, rawRadius] = plate.mirror;
        const mr = rawRadius;
        context.save();
        context.clip();
        context.globalAlpha = 0.92;
        context.drawImage(starImage(), mx - mr, my - mr, mr * 2, mr * 2);
        context.restore();
        // El destello desborda la placa
        if (plate.corona > 0.5) {
          const [left, top, right, bottom] = plate.box;
          const fx = Math.min(right, Math.max(left, mx));
          const fy = Math.min(bottom, Math.max(top, my));
          const reach = Math.min(mr, plate.size) * 1.6;
          const flare = context.createRadialGradient(fx, fy, 0, fx, fy, reach);
          const strength = (plate.corona - 0.5) * 2;
          flare.addColorStop(0, `rgba(255, 244, 220, ${(0.5 * strength).toFixed(3)})`);
          flare.addColorStop(0.35, `rgba(255, 190, 110, ${(0.18 * strength).toFixed(3)})`);
          flare.addColorStop(1, 'rgba(255, 150, 80, 0)');
          context.globalCompositeOperation = 'lighter';
          context.fillStyle = flare;
          context.fillRect(fx - reach, fy - reach, reach * 2, reach * 2);
          context.globalCompositeOperation = 'source-over';
        }
        context.beginPath();
        context.moveTo(corners[0], corners[1]);
        for (let index = 2; index < corners.length; index += 2) context.lineTo(corners[index], corners[index + 1]);
        context.closePath();
      }
      context.globalAlpha = Math.min(1, 0.35 + 0.4 * plate.light + plate.corona);
      context.strokeStyle = 'rgb(255, 222, 160)';
      context.lineWidth = plate.size > 60 ? 1.4 : 0.9;
      context.stroke();
      if (plate.grid) {
        const { grid } = plate;
        context.globalAlpha = 0.28 + 0.3 * plate.glint;
        context.lineWidth = 0.7;
        context.beginPath();
        for (let index = 0; index < grid.length; index += 4) {
          context.moveTo(grid[index], grid[index + 1]);
          context.lineTo(grid[index + 2], grid[index + 3]);
        }
        context.stroke();
      }
      context.globalAlpha = 1;
    } else {
      // Dorso: una silueta oscura con el borde encendido a contraluz
      context.fillStyle = 'rgb(9, 8, 10)';
      context.fill();
      if (plate.rim > 0.3 && plate.size > 20) {
        context.globalAlpha = 0.3 * plate.rim;
        context.strokeStyle = 'rgb(255, 170, 90)';
        context.lineWidth = Math.min(10, plate.size * 0.05);
        context.stroke();
      }
      context.globalAlpha = 0.07 + 0.93 * plate.rim;
      context.strokeStyle = 'rgb(255, 222, 170)';
      context.lineWidth = plate.size > 60 ? 1.6 : 1;
      context.stroke();
      context.globalAlpha = 1;
    }
  };

  const drawLayer = (layer: ReturnType<typeof makeLayer>) => {
    context.fillStyle = 'rgb(9, 8, 10)';
    context.fill(layer.backs);
    context.lineWidth = 1;
    context.strokeStyle = 'rgb(255, 222, 170)';
    layer.rims.forEach((path, level) => {
      context.globalAlpha = 0.07 + 0.93 * (level / 4);
      context.stroke(path);
    });
    context.fillStyle = 'rgb(249, 206, 120)';
    layer.faces.forEach((path, level) => {
      context.globalAlpha = (level + 0.5) / 6;
      context.fill(path);
    });
    context.globalAlpha = 1;
    context.fillStyle = 'rgb(255, 246, 226)';
    context.fill(layer.glints);
    context.lineWidth = 0.8;
    context.strokeStyle = 'rgb(255, 222, 160)';
    layer.edges.forEach((path, level) => {
      context.globalAlpha = (level + 0.5) / 4;
      context.stroke(path);
    });
    context.globalAlpha = 1;
  };

  // Lo que queda detrás de la estrella, la estrella y lo de delante
  drawDots(behindDots);
  drawLayer(smallBehind);
  let index = 0;
  while (index < plates.length && plates[index].depth > starDepth) drawPlate(plates[index++]);

  if (starOnScreen && starRadius > 0.5) {
    // La corona: apretada y viva junto al borde, y un resplandor ancho que
    // tiñe el cielo. Las placas de delante la tapan
    const reach = starRadius * 4.5;
    const halo = context.createRadialGradient(sx, sy, starRadius * 0.96, sx, sy, reach);
    halo.addColorStop(0, 'rgba(255, 200, 130, 0.6)');
    halo.addColorStop(0.03, 'rgba(255, 170, 96, 0.34)');
    halo.addColorStop(0.11, 'rgba(255, 140, 76, 0.14)');
    halo.addColorStop(0.35, 'rgba(255, 120, 60, 0.05)');
    halo.addColorStop(1, 'rgba(255, 110, 50, 0)');
    context.fillStyle = halo;
    context.fillRect(sx - reach, sy - reach, reach * 2, reach * 2);
    context.save();
    context.translate(sx, sy);
    context.rotate(p * 1.2);
    context.drawImage(starImage(), -starRadius, -starRadius, starRadius * 2, starRadius * 2);
    // Las protuberancias giran con la estrella y laten despacio
    if (starRadius > 30) {
      const loops = new Path2D();
      for (const { angle, foot, rise, lean } of PROMINENCES) {
        const height = starRadius * rise * (0.75 + 0.25 * Math.sin(p * 60 + angle * 3));
        const from = angle - foot;
        const to = angle + foot;
        const top = angle + lean * foot;
        const reach = starRadius + height * 2;
        loops.moveTo(Math.cos(from) * starRadius * 0.99, Math.sin(from) * starRadius * 0.99);
        loops.bezierCurveTo(
          Math.cos(from) * reach, Math.sin(from) * reach,
          Math.cos(top) * reach, Math.sin(top) * reach,
          Math.cos(to) * starRadius * 0.99, Math.sin(to) * starRadius * 0.99,
        );
      }
      // Plasma difuso, sin trazo duro: dos pasadas anchas y tenues
      context.globalCompositeOperation = 'lighter';
      context.lineCap = 'round';
      context.strokeStyle = 'rgba(255, 110, 50, 0.1)';
      context.lineWidth = Math.max(3, starRadius * 0.06);
      context.stroke(loops);
      context.strokeStyle = 'rgba(255, 150, 80, 0.16)';
      context.lineWidth = Math.max(2, starRadius * 0.025);
      context.stroke(loops);
      context.lineCap = 'butt';
      context.globalCompositeOperation = 'source-over';
    }
    context.restore();
  }

  drawDots(frontDots);
  drawLayer(smallFront);
  while (index < plates.length) drawPlate(plates[index++]);

  // La ventana se recorta al final, borrando lo que quedó encima. Está en
  // la estrella, donde mira la cámara: la cabeza del visitante la corre
  const [windowX, windowY] = lookShift(focal);
  if (opening > 0.5) {
    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    context.arc(cx + windowX, cy + windowY, opening, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = 'source-over';
  }

  // El borde de la ventana: el aro de la estrella, que sigue a la ventana al cubrir
  const ring = 1 - seg(p, [0.42, 0.52]);
  if (opening > 0.5 && ring > 0) {
    context.globalCompositeOperation = 'lighter';
    context.beginPath();
    context.arc(cx + windowX, cy + windowY, opening, 0, Math.PI * 2);
    context.strokeStyle = `rgba(255, 190, 110, ${(0.18 * ring).toFixed(3)})`;
    context.lineWidth = 12;
    context.stroke();
    context.strokeStyle = `rgba(255, 244, 214, ${(0.9 * ring).toFixed(3)})`;
    context.lineWidth = 1.4;
    context.stroke();
    context.globalCompositeOperation = 'source-over';
  }
};

// Radio de la estrella en pantalla (px), para abrir la ventana en su disco
export const starRadius = (p: number, width: number, height: number) => {
  const { position: eye, forward, focal } = cameraAt(p, width, height);
  const depth = -(eye[0] * forward[0] + eye[1] * forward[1] + eye[2] * forward[2]);
  const distance = Math.hypot(eye[0], eye[1], eye[2]);
  if (depth < 0.05) return 0;
  return focal * Math.tan(Math.asin(Math.min(0.999, 1 / distance))) * (distance / depth);
};
