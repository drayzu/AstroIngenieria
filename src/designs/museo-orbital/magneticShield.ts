import { clamp01, smoothstep } from './roomShared';
import { lookShift, lookTurn } from './lookAround';

/* Ingeniería planetaria: un escudo magnético para Marte.

   Marte perdió su campo magnético y el viento solar le fue arrancando el
   aire. Viajamos con ese viento: estelas doradas que corren hacia un anillo
   con Marte detrás. El anillo se enciende, sus líneas de campo brotan de su
   centro y se abren en una burbuja, y delante se forma el frente de choque:
   el viento se dobla a su alrededor como el agua en una piedra. Lo cruzamos
   de golpe, el choque nos lanza hacia afuera y quedamos atrapados en una
   línea de campo, que recorremos en espiral sobre la burbuja, como las
   partículas cargadas. Al bajar por detrás Marte asoma; soltamos la línea y
   entramos a la calma de la sombra, donde el viento ya no llega. La ventana
   se abre en el disco de Marte.

   El mundo se mide en radios del anillo: y arriba, z hacia donde sopla el
   viento (del Sol a Marte). El anillo está en z = 0, de frente al viento, y
   el eje de su campo apunta al Sol. Todo el recorrido de la cámara va en un
   mismo plano que contiene ese eje. */

type Range = [number, number];
type Vec3 = [number, number, number];

export const SHIELD = {
  // Viajamos con el viento hacia el anillo, con Marte detrás
  approach: [0.02, 0.104],
  // El anillo se enciende: un pulso lo recorre por ambos lados
  ignite: [0.056, 0.07],
  // Las líneas de campo brotan de su centro y se abren en una burbuja
  bloom: [0.062, 0.097],
  // Delante se forma el frente de choque y el viento se dobla
  shock: [0.074, 0.1],
  // Lo cruzamos: destello, sacudón y el choque nos lanza hacia afuera
  impact: [0.103, 0.12],
  // Atrapados en una línea de campo, la recorremos en espiral sobre la burbuja
  ride: [0.104, 0.2],
  // Soltamos la línea y entramos a la calma de la sombra, rumbo a Marte
  calm: [0.2, 0.25],
  // La ventana se abre en el disco de Marte
  open: [0.25, 0.29],
} satisfies Record<string, Range>;

const seg = (p: number, [from, to]: Range) => clamp01((p - from) / (to - from));
const ease = (t: number) => smoothstep(0, 1, t);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const bump = (t: number) => Math.sin(Math.PI * clamp01(t));
const seeded = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};
const normalize = ([x, y, z]: Vec3): Vec3 => {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// Distancia focal respecto al lado corto de la pantalla
const FOCAL = 0.62;
const NEAR = 0.04;

/* ---------------- La burbuja ---------------- */

// Líneas de campo de un dipolo con el eje hacia el Sol: el viento aplasta
// el lado que lo mira y estira el de atrás en una cola
const FRONT = 0.62;
const TAIL = 3;
const fieldPoint = (shell: number, azimuth: number, theta: number, out: number[]) => {
  const sin = Math.sin(theta);
  const r = shell * sin * sin;
  const along = -r * Math.cos(theta);
  out[0] = r * sin * Math.cos(azimuth);
  out[1] = r * sin * Math.sin(azimuth);
  out[2] = along * (along < 0 ? FRONT : TAIL);
};

// La línea que recorremos: la más externa, arriba a la izquierda
const RIDE_SHELL = 4;
const RIDE_AZIMUTH = 1.95;
const OUT_X = Math.cos(RIDE_AZIMUTH);
const OUT_Y = Math.sin(RIDE_AZIMUTH);

const SHELLS = [2.3, 3.15, RIDE_SHELL];
const AZIMUTHS = 18;
const LINE_STEPS = 48;
const EDGE = 0.1;
// Cada línea guarda su forma para capa 1 (se escala con la capa) y cuándo
// brota: primero las internas y las del lado que nos mira
const RIBS = SHELLS.flatMap((shell, layer) =>
  Array.from({ length: AZIMUTHS }, (_, index) => {
    const azimuth = RIDE_AZIMUTH + (index / AZIMUTHS) * Math.PI * 2;
    const unit = new Float32Array((LINE_STEPS + 1) * 3);
    const point = [0, 0, 0];
    for (let step = 0; step <= LINE_STEPS; step++) {
      fieldPoint(1, azimuth, EDGE + ((Math.PI - 2 * EDGE) * step) / LINE_STEPS, point);
      unit.set(point, step * 3);
    }
    const around = Math.min(index, AZIMUTHS - index) / (AZIMUTHS / 2);
    return { shell, unit, delay: 0.22 * around + 0.16 * layer + 0.08 * seeded(layer * 31 + index + 5101) };
  }),
);
const GROW = 0.42;

// El haz de líneas vecinas a la nuestra, que nos rodea mientras la seguimos
const BUNDLE = Array.from({ length: 8 }, (_, index) => {
  const angle = (index / 8) * Math.PI * 2 + 0.3;
  return { shell: RIDE_SHELL + 0.42 * Math.cos(angle), azimuth: RIDE_AZIMUTH + (0.42 * Math.sin(angle)) / RIDE_SHELL };
});
// Otras partículas atrapadas: hélices que corren por esas líneas
const SPIRALS = Array.from({ length: 12 }, (_, index) => ({
  line: index % (BUNDLE.length + 1),
  phase: seeded(index + 5203),
  speed: 0.6 + seeded(index + 5309) * 0.9,
  turn: seeded(index + 5407) * Math.PI * 2,
}));

/* ---------------- El viento ---------------- */

// El frente de choque: un paraboloide delante de la burbuja
const SHOCK = { nose: 2.4, curve: 4.5, reach: 8.6 };
const shockZ = (rho: number, nose: number) => -nose + (rho * rho) / (2 * SHOCK.curve);

/* El obstáculo que ve el viento: cada estela conserva su caudal, así que a
   una distancia ρ0 del eje pasa a ρ² = ρ0² + D(z), con D el área que ocupa
   la burbuja (una nariz roma que detrás se vuelve un cilindro: la sombra) */
const BODY = { nose: 1.1, reach: 4.25, curve: 21.8, soft: 0.5 };
const deflection = (z: number) => {
  const x = (z + BODY.nose) / BODY.soft;
  const soft = BODY.soft * (x > 20 ? x : Math.log1p(Math.exp(x)));
  return BODY.reach ** 2 * (1 - Math.exp((-2 * BODY.curve * soft) / BODY.reach ** 2));
};

// Las partículas viven en un tramo alrededor de la cámara y al quedar atrás
// vuelven a aparecer adelante
const WIND_RANGE = 26;
const WIND_BEHIND = 3;
const WIND_SPEED = 160;
// Largo de cada estela, a lo largo de su línea de corriente
const FLOW = 2.4;
const WIND = Array.from({ length: 480 }, (_, index) => ({
  rho: 0.15 + 8 * Math.sqrt(seeded(index + 8101)),
  azimuth: seeded(index + 8203) * Math.PI * 2,
  lane: seeded(index + 8307) * WIND_RANGE,
  glow: seeded(index + 8409),
}));

/* ---------------- Marte y el cielo ---------------- */

const MARS = { center: [0, 0, 20] as Vec3, radius: 1.6 };
// Un punto de la superficie (latitud y longitud en grados) como normal; la
// longitud 0 mira hacia nosotros
const surface = (latitude: number, longitude: number): Vec3 => {
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), -Math.cos(lat) * Math.cos(lon)];
};
// Anillos de cada relieve (radio angular, rad)
const RELIEF: { center: Vec3; rings: number[]; path?: Path2D }[] = [
  // Olympus Mons y los tres volcanes de Tharsis
  { center: surface(18, -32), rings: [0.12, 0.08, 0.04] },
  { center: surface(11, -14), rings: [0.05, 0.025] },
  { center: surface(1, -10), rings: [0.05, 0.025] },
  { center: surface(-9, -6), rings: [0.05, 0.025] },
  // La cuenca Hellas, cerca del borde
  { center: surface(-42, 62), rings: [0.24, 0.17, 0.1] },
  // El gran escalón entre el norte bajo y el sur alto
  { center: surface(62, 20), rings: [0.55] },
];
const POLE = surface(84, 0);

const STARS = Array.from({ length: 460 }, (_, index) => {
  const z = seeded(index + 9101) * 2 - 1;
  const angle = seeded(index + 9203) * Math.PI * 2;
  const ring = Math.sqrt(1 - z * z);
  return { dir: [ring * Math.cos(angle), ring * Math.sin(angle), z] as Vec3, bright: seeded(index + 9307) > 0.86 };
});

/* ---------------- El recorrido ---------------- */

/* Un riel con la forma del vuelo, medido en largo: llegada en línea casi
   recta, la desviación del choque, la línea de campo y la bajada hacia
   Marte. Todo en el plano del azimut de la línea, así su normal hacia
   afuera de la burbuja queda siempre definida */
const LATCH = 0.8;
const RELEASE = 2;
const RAIL_STEP = 0.02;
const hermite = (from: Vec3, fromSlope: Vec3, to: Vec3, toSlope: Vec3, t: number): Vec3 => {
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return [0, 1, 2].map((axis) => h00 * from[axis] + h10 * fromSlope[axis] + h01 * to[axis] + h11 * toSlope[axis]) as Vec3;
};
const inPlane = (rho: number, z: number): Vec3 => [rho * OUT_X, rho * OUT_Y, z];
const ribTangent = (theta: number): Vec3 => {
  const before = [0, 0, 0];
  const after = [0, 0, 0];
  fieldPoint(RIDE_SHELL, RIDE_AZIMUTH, theta - 0.001, before);
  fieldPoint(RIDE_SHELL, RIDE_AZIMUTH, theta + 0.001, after);
  return normalize([after[0] - before[0], after[1] - before[1], after[2] - before[2]]);
};
const RAIL = (() => {
  const raw: [number, number, number, number][] = [];
  const stations: number[] = [];
  const push = ([x, y, z]: Vec3, theta = Number.NaN) => raw.push([x, y, z, theta]);
  const latch = [0, 0, 0];
  const release = [0, 0, 0];
  fieldPoint(RIDE_SHELL, RIDE_AZIMUTH, LATCH, latch);
  fieldPoint(RIDE_SHELL, RIDE_AZIMUTH, RELEASE, release);
  const start = inPlane(0.25, -44);
  const hit = inPlane(1.6, -2.6);
  const calm = inPlane(0.3, 15);
  const end = inPlane(0.3, 16);
  const chord = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];
  for (let step = 0; step <= 240; step++) {
    const t = step / 240;
    push([start[0] + (hit[0] - start[0]) * t, start[1] + (hit[1] - start[1]) * t, start[2] + (hit[2] - start[2]) * t]);
  }
  stations.push(raw.length - 1);
  const bend = chord(hit, latch);
  const into = normalize([hit[0] - start[0], hit[1] - start[1], hit[2] - start[2]]);
  for (let step = 1; step <= 120; step++) {
    push(hermite(hit, scale(into, bend), latch as Vec3, scale(ribTangent(LATCH), bend * 1.3), step / 120));
  }
  stations.push(raw.length - 1);
  for (let step = 1; step <= 400; step++) {
    const theta = LATCH + ((RELEASE - LATCH) * step) / 400;
    const point = [0, 0, 0];
    fieldPoint(RIDE_SHELL, RIDE_AZIMUTH, theta, point);
    push(point as Vec3, theta);
  }
  stations.push(raw.length - 1);
  const drop = chord(release, calm);
  for (let step = 1; step <= 200; step++) {
    push(hermite(release as Vec3, scale(ribTangent(RELEASE), drop), calm, [0, 0, drop], step / 200));
  }
  stations.push(raw.length - 1);
  for (let step = 1; step <= 40; step++) {
    push([calm[0], calm[1], calm[2] + ((end[2] - calm[2]) * step) / 40]);
  }

  // Largo acumulado y remuestreo parejo
  const length = [0];
  for (let index = 1; index < raw.length; index++) length.push(length[index - 1] + chord(raw[index], raw[index - 1]));
  const total = length[length.length - 1];
  const count = Math.ceil(total / RAIL_STEP) + 1;
  const points = new Float32Array(count * 3);
  const thetas = new Float32Array(count);
  let cursor = 1;
  for (let index = 0; index < count; index++) {
    const at = Math.min(total, index * RAIL_STEP);
    while (cursor < raw.length - 1 && length[cursor] < at) cursor++;
    const span = length[cursor] - length[cursor - 1] || 1;
    const t = clamp01((at - length[cursor - 1]) / span);
    const [ax, ay, az, aTheta] = raw[cursor - 1];
    const [bx, by, bz, bTheta] = raw[cursor];
    points[index * 3] = ax + (bx - ax) * t;
    points[index * 3 + 1] = ay + (by - ay) * t;
    points[index * 3 + 2] = az + (bz - az) * t;
    thetas[index] = Number.isNaN(aTheta) || Number.isNaN(bTheta) ? (Number.isNaN(aTheta) ? bTheta : aTheta) : aTheta + (bTheta - aTheta) * t;
  }
  return {
    points,
    thetas,
    total,
    // Dónde termina cada tramo: llegada, desviación, línea, bajada
    hit: length[stations[0]],
    latch: length[stations[1]],
    release: length[stations[2]],
    calm: length[stations[3]],
  };
})();

const railAt = (s: number, out: number[]) => {
  const at = Math.min(Math.max(s, 0), RAIL.total) / RAIL_STEP;
  const index = Math.min(Math.floor(at), RAIL.thetas.length - 2);
  const t = at - index;
  for (let axis = 0; axis < 3; axis++) {
    const a = RAIL.points[index * 3 + axis];
    out[axis] = a + (RAIL.points[(index + 1) * 3 + axis] - a) * t;
  }
};
// En qué ángulo de la línea de campo vamos (antes de engancharnos, el primero)
const railTheta = (s: number) => {
  if (s <= RAIL.latch) return LATCH;
  if (s >= RAIL.release) return RELEASE;
  return RAIL.thetas[Math.round(s / RAIL_STEP)];
};

/* Cuánto riel llevamos según el progreso: rápido al llegar, más lento
   mientras la burbuja se abre, un tirón al chocar, el paseo por la línea y
   la bajada hacia Marte. Interpolación monótona: nunca retrocede */
const S_KEYS: [number, number][] = [
  [0.02, 0],
  [0.045, RAIL.hit * 0.5],
  [0.065, RAIL.hit * 0.78],
  [0.085, RAIL.hit * 0.9],
  [0.098, RAIL.hit * 0.96],
  [0.104, RAIL.hit],
  [0.118, RAIL.latch],
  [0.2, RAIL.release],
  [0.25, RAIL.calm],
  [0.29, RAIL.total - 0.25],
  [0.56, RAIL.total],
];
const S_SLOPES = (() => {
  const count = S_KEYS.length;
  const delta = S_KEYS.slice(1).map(([p, s], index) => (s - S_KEYS[index][1]) / (p - S_KEYS[index][0]));
  const slopes = S_KEYS.map((_, index) => {
    if (index === 0) return delta[0];
    if (index === count - 1) return delta[count - 2];
    return delta[index - 1] * delta[index] <= 0 ? 0 : (delta[index - 1] + delta[index]) / 2;
  });
  delta.forEach((step, index) => {
    if (step === 0) {
      slopes[index] = 0;
      slopes[index + 1] = 0;
      return;
    }
    const a = slopes[index] / step;
    const b = slopes[index + 1] / step;
    const h = a * a + b * b;
    if (h > 9) {
      slopes[index] = (3 / Math.sqrt(h)) * a * step;
      slopes[index + 1] = (3 / Math.sqrt(h)) * b * step;
    }
  });
  return slopes;
})();
const railS = (p: number) => {
  if (p <= S_KEYS[0][0]) return 0;
  const next = S_KEYS.findIndex(([at]) => at > p);
  if (next < 0) return S_KEYS[S_KEYS.length - 1][1];
  const [from, a] = S_KEYS[next - 1];
  const [to, b] = S_KEYS[next];
  const span = to - from;
  const t = (p - from) / span;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * span * S_SLOPES[next - 1]
    + (-2 * t3 + 3 * t2) * b + (t3 - t2) * span * S_SLOPES[next];
};

/* ---------------- La cámara ---------------- */

// Vueltas de la espiral: el choque nos lanza girando y el giro se calma
// hasta soltar la línea (siempre vueltas enteras: terminamos derechos)
const TURNS = 2;
const spinAt = (p: number) => TURNS * Math.PI * 2 * (1 - (1 - seg(p, [SHIELD.ride[0], SHIELD.ride[1]])) ** 2.2);
// Radio de giro alrededor de la línea
const GYRO = 0.3;

const cameraAt = (p: number) => {
  const s = railS(p);
  const base = [0, 0, 0];
  const before = [0, 0, 0];
  const after = [0, 0, 0];
  railAt(s, base);
  railAt(s - 0.06, before);
  railAt(s + 0.06, after);
  const tangent = normalize([after[0] - before[0], after[1] - before[1], after[2] - before[2]]);
  // La normal del riel en su plano, hacia afuera de la burbuja
  const outward = tangent[0] * OUT_X + tangent[1] * OUT_Y;
  const normal: Vec3 = [tangent[2] * OUT_X, tangent[2] * OUT_Y, -outward];
  const binormal = cross(tangent, normal);
  const spin = spinAt(p);
  const radius = GYRO * ease(seg(p, [0.11, 0.126])) * (1 - ease(seg(p, [0.184, 0.2])));
  const cos = Math.cos(spin);
  const sin = Math.sin(spin);
  const eye: Vec3 = [0, 1, 2].map((axis) => base[axis] + radius * (cos * normal[axis] + sin * binormal[axis])) as Vec3;

  // Mira un poco adelante en el riel (más lejos al llegar) y al final, a Marte
  const target = [0, 0, 0];
  railAt(s + 3.2 - 2 * ease(seg(p, [0.09, 0.115])), target);
  const ahead = normalize([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
  const toMars = normalize([MARS.center[0] - eye[0], MARS.center[1] - eye[1], MARS.center[2] - eye[2]]);
  const aim = easeInOut(seg(p, [0.2, 0.248]));
  const forward = normalize([0, 1, 2].map((axis) => ahead[axis] + (toMars[axis] - ahead[axis]) * aim) as Vec3);

  // Arriba: el del mundo al llegar; luego la normal del riel, así la línea
  // queda siempre bajo nosotros mientras giramos, y al final otra vez el del mundo
  const bank = ease(seg(p, [0.03, 0.09])) * (1 - easeInOut(seg(p, [0.205, 0.248])));
  const reference = [normal[0] * bank, 1 - bank + normal[1] * bank, normal[2] * bank];
  const lean = reference[0] * forward[0] + reference[1] * forward[1] + reference[2] * forward[2];
  const up0 = normalize([reference[0] - lean * forward[0], reference[1] - lean * forward[1], reference[2] - lean * forward[2]]);
  const side = cross(forward, up0);
  // Llega ladeada y se endereza; después gira con la espiral
  const roll = spin - 0.3 * (1 - easeInOut(seg(p, [0.02, 0.075])));
  const up: Vec3 = [0, 1, 2].map((axis) => up0[axis] * Math.cos(roll) + side[axis] * Math.sin(roll)) as Vec3;
  const right = cross(up, forward);
  // Y encima, la cabeza del visitante (mirar alrededor)
  return lookTurn({ s, eye, forward, right, down: [-up[0], -up[1], -up[2]] as Vec3 });
};

// El lente (px): con él se sabe dónde queda la ventana al girar la cabeza
export const shieldFocal = (width: number, height: number) => FOCAL * Math.min(width, height);

// Temblor: el golpe del choque y un rumor mientras vamos en la línea
const shakeAt = (p: number): [number, number] => {
  const amount = 12 * bump(seg(p, [0.103, 0.124])) ** 0.7 + 1.6 * bump(seg(p, [0.118, 0.2]));
  return [amount * Math.sin(p * 1900) * Math.cos(p * 1130), amount * Math.cos(p * 1570) * Math.sin(p * 870)];
};

// Mientras el lienzo tapa el cielo, se apagan las constelaciones de la página
export const shieldSkyHidden = (p: number) => seg(p, [0.02, 0.05]);

// Radio de Marte en pantalla (px), ya centrado al abrirse la ventana
export const marsRadius = (p: number, width: number, height: number) => {
  const { eye } = cameraAt(p);
  const distance = Math.hypot(MARS.center[0] - eye[0], MARS.center[1] - eye[1], MARS.center[2] - eye[2]);
  return (FOCAL * Math.min(width, height) * MARS.radius) / Math.sqrt(Math.max(distance ** 2 - MARS.radius ** 2, 0.01));
};

/* ---------------- El cuadro ---------------- */

export const drawShield = (
  context: CanvasRenderingContext2D,
  p: number,
  width: number,
  height: number,
  [r, g, b]: number[],
  // Radio de la ventana ya abierta (px), centrada en la pantalla
  opening: number,
) => {
  const tint = (alpha: number, white: number) =>
    `rgba(${Math.round(r + (255 - r) * white)}, ${Math.round(g + (255 - g) * white)}, ${Math.round(b + (255 - b) * white)}, ${alpha.toFixed(3)})`;
  const { s, eye, forward, right, down } = cameraAt(p);
  const focal = FOCAL * Math.min(width, height);
  const [shakeX, shakeY] = shakeAt(p);
  const cx = width / 2 + shakeX;
  const cy = height / 2 + shakeY;
  const [ex, ey, ez] = eye;
  const [rx, ry, rz] = right;
  const [dx, dy, dz] = down;
  const [fx, fy, fz] = forward;

  // De un punto del mundo a coordenadas de cámara
  const view = (x: number, y: number, z: number, out: number[]) => {
    const vx = x - ex;
    const vy = y - ey;
    const vz = z - ez;
    out[0] = vx * rx + vy * ry + vz * rz;
    out[1] = vx * dx + vy * dy + vz * dz;
    out[2] = vx * fx + vy * fy + vz * fz;
  };
  // Un tramo entre dos puntos ya vistos, recortado donde cruza delante de la
  // cámara. Si sigue al anterior en el mismo trazo lo continúa sin cortar:
  // miles de tramos sueltos cuestan mucho más al pintar. Devuelve si terminó
  // a la vista, para poder continuarlo
  const segment = (path: Path2D, from: number[], to: number[], joined = false) => {
    let x0 = from[0];
    let y0 = from[1];
    let z0 = from[2];
    let x1 = to[0];
    let y1 = to[1];
    let z1 = to[2];
    if (z0 < NEAR && z1 < NEAR) return false;
    const cut = z0 < NEAR;
    const open = z1 >= NEAR;
    if (cut) {
      const t = (NEAR - z0) / (z1 - z0);
      x0 += (x1 - x0) * t;
      y0 += (y1 - y0) * t;
      z0 = NEAR;
    } else if (!open) {
      const t = (NEAR - z1) / (z0 - z1);
      x1 += (x0 - x1) * t;
      y1 += (y0 - y1) * t;
      z1 = NEAR;
    }
    if (!joined || cut) path.moveTo(cx + (focal * x0) / z0, cy + (focal * y0) / z0);
    path.lineTo(cx + (focal * x1) / z1, cy + (focal * y1) / z1);
    return open;
  };
  // El trazo que se viene continuando
  let pen: Path2D | null = null;
  const stroke = (path: Path2D, from: number[], to: number[]) => {
    pen = segment(path, from, to, pen === path) ? path : null;
  };
  const a = [0, 0, 0];
  const c = [0, 0, 0];
  const point = [0, 0, 0];
  const copy = (to: number[], from: number[]) => {
    to[0] = from[0];
    to[1] = from[1];
    to[2] = from[2];
  };

  // El fondo tapa el cielo de la página: aquí la cámara cabecea y rueda, y
  // las estrellas tienen que girar con ella
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = '#04060b';
  context.fillRect(0, 0, width, height);
  const stars = [new Path2D(), new Path2D()];
  for (const { dir, bright } of STARS) {
    const depth = dir[0] * fx + dir[1] * fy + dir[2] * fz;
    if (depth < 0.05) continue;
    const sx = cx + (focal * (dir[0] * rx + dir[1] * ry + dir[2] * rz)) / depth;
    const sy = cy + (focal * (dir[0] * dx + dir[1] * dy + dir[2] * dz)) / depth;
    if (sx < -2 || sx > width + 2 || sy < -2 || sy > height + 2) continue;
    const size = bright ? 1.7 : 1.1;
    stars[bright ? 1 : 0].rect(sx - size / 2, sy - size / 2, size, size);
  }
  context.fillStyle = 'rgba(220, 228, 255, 0.55)';
  context.fill(stars[0]);
  context.fillStyle = 'rgba(255, 250, 240, 0.95)';
  context.fill(stars[1]);

  context.lineCap = 'butt';

  // Marte: un disco oscuro que tapa el cielo, con el borde iluminado (el Sol
  // está a nuestra espalda), paralelos tenues y su casquete polar. Al final
  // su aire se espesa y se vuelve azul
  view(MARS.center[0], MARS.center[1], MARS.center[2], point);
  const marsDistance = Math.hypot(MARS.center[0] - ex, MARS.center[1] - ey, MARS.center[2] - ez);
  if (point[2] > MARS.radius) {
    const mx = cx + (focal * point[0]) / point[2];
    const my = cy + (focal * point[1]) / point[2];
    const radius = (focal * MARS.radius) / Math.sqrt(marsDistance ** 2 - MARS.radius ** 2);
    if (mx > -radius * 2 && mx < width + radius * 2 && my > -radius * 2 && my < height + radius * 2) {
      const face = context.createRadialGradient(mx, my, 0, mx, my, radius);
      face.addColorStop(0, 'rgb(46, 20, 13)');
      face.addColorStop(0.75, 'rgb(30, 12, 9)');
      face.addColorStop(1, 'rgb(16, 7, 6)');
      context.fillStyle = face;
      context.beginPath();
      context.arc(mx, my, radius, 0, Math.PI * 2);
      context.fill();

      // El relieve como curvas de nivel, igual que en la sala: los volcanes
      // de Tharsis, el valle Marineris, la cuenca Hellas y el casquete
      context.globalCompositeOperation = 'lighter';
      const relief = new Path2D();
      const cap = new Path2D();
      const toEye = [ex - MARS.center[0], ey - MARS.center[1], ez - MARS.center[2]];
      const onMars = (nx: number, ny: number, nz: number, path: Path2D, drawing: boolean) => {
        if (nx * toEye[0] + ny * toEye[1] + nz * toEye[2] <= 0) return false;
        view(MARS.center[0] + MARS.radius * nx, MARS.center[1] + MARS.radius * ny, MARS.center[2] + MARS.radius * nz, a);
        if (a[2] < NEAR) return false;
        const sx = cx + (focal * a[0]) / a[2];
        const sy = cy + (focal * a[1]) / a[2];
        if (drawing) path.lineTo(sx, sy);
        else path.moveTo(sx, sy);
        return true;
      };
      for (const { center, rings, path } of [...RELIEF, { center: POLE, rings: [0.2, 0.13], path: cap }]) {
        const [nx, ny, nz] = center;
        const u = normalize(cross(center, Math.abs(ny) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
        const w = cross(center, u);
        for (const ring of rings) {
          const lift = Math.cos(ring);
          const span = Math.sin(ring);
          let drawing = false;
          for (let step = 0; step <= 36; step++) {
            const angle = (step / 36) * Math.PI * 2;
            const cos = Math.cos(angle) * span;
            const sin = Math.sin(angle) * span;
            drawing = onMars(
              nx * lift + u[0] * cos + w[0] * sin,
              ny * lift + u[1] * cos + w[1] * sin,
              nz * lift + u[2] * cos + w[2] * sin,
              path ?? relief,
              drawing,
            );
          }
        }
      }
      // El valle: dos bordes casi paralelos que cruzan el ecuador
      for (const side of [-0.035, 0.035]) {
        let drawing = false;
        for (let step = 0; step <= 24; step++) {
          const t = step / 24;
          const latitude = -0.13 - 0.08 * t + side * (1 - 0.5 * Math.sin(Math.PI * t));
          const longitude = 0.08 + 0.72 * t;
          drawing = onMars(
            Math.cos(latitude) * Math.sin(longitude),
            Math.sin(latitude),
            -Math.cos(latitude) * Math.cos(longitude),
            relief,
            drawing,
          );
        }
      }
      context.lineWidth = 1;
      context.strokeStyle = 'rgba(236, 132, 88, 0.42)';
      context.stroke(relief);
      context.strokeStyle = 'rgba(255, 238, 226, 0.75)';
      context.stroke(cap);

      // El aire: un resplandor fino y rojizo que al final se espesa y se vuelve azul
      const breathe = ease(seg(p, [0.215, 0.27]));
      const air = [232 + (140 - 232) * breathe, 120 + (200 - 120) * breathe, 74 + (255 - 74) * breathe].map(Math.round);
      const glow = context.createRadialGradient(mx, my, radius * 0.96, mx, my, radius * (1.08 + 0.14 * breathe));
      glow.addColorStop(0, `rgba(${air[0]}, ${air[1]}, ${air[2]}, 0)`);
      glow.addColorStop(0.12, `rgba(${air[0]}, ${air[1]}, ${air[2]}, ${(0.3 + 0.25 * breathe).toFixed(3)})`);
      glow.addColorStop(1, `rgba(${air[0]}, ${air[1]}, ${air[2]}, 0)`);
      context.fillStyle = glow;
      context.beginPath();
      context.arc(mx, my, radius * (1.08 + 0.14 * breathe), 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(255, 168, 120, 0.85)';
      context.lineWidth = 1.3;
      context.beginPath();
      context.arc(mx, my, radius, 0, Math.PI * 2);
      context.stroke();
    }
  }
  context.globalCompositeOperation = 'lighter';

  // El frente de choque: brota de la burbuja y se planta delante; un
  // anillo brillante corre por él mientras se forma
  const form = ease(seg(p, SHIELD.shock));
  if (form > 0) {
    const nose = BODY.nose + (SHOCK.nose - BODY.nose) * form;
    const shell = [new Path2D(), new Path2D()];
    const curve = (rho: number, azimuth: number, out: number[]) =>
      view(rho * Math.cos(azimuth), rho * Math.sin(azimuth), shockZ(rho, nose), out);
    for (let line = 0; line < 20; line++) {
      const azimuth = (line / 20) * Math.PI * 2;
      curve(0, azimuth, a);
      pen = null;
      for (let step = 1; step <= 24; step++) {
        curve((SHOCK.reach * step) / 24, azimuth, c);
        stroke(shell[(a[2] + c[2]) / 2 < 6 ? 0 : 1], a, c);
        copy(a, c);
      }
    }
    for (const rho of [0.9, 2, 3.3, 4.8, 6.6, 8.6]) {
      curve(rho, 0, a);
      pen = null;
      for (let step = 1; step <= 64; step++) {
        curve(rho, (step / 64) * Math.PI * 2, c);
        stroke(shell[(a[2] + c[2]) / 2 < 6 ? 0 : 1], a, c);
        copy(a, c);
      }
    }
    context.lineWidth = 1;
    context.strokeStyle = `rgba(255, 196, 150, ${(0.26 * form).toFixed(3)})`;
    context.stroke(shell[0]);
    context.strokeStyle = `rgba(255, 196, 150, ${(0.13 * form).toFixed(3)})`;
    context.stroke(shell[1]);
    const ripple = seg(p, SHIELD.shock);
    if (ripple > 0 && ripple < 1) {
      const wave = new Path2D();
      const rho = SHOCK.reach * easeOut(ripple);
      curve(rho, 0, a);
      pen = null;
      for (let step = 1; step <= 72; step++) {
        curve(rho, (step / 72) * Math.PI * 2, c);
        stroke(wave, a, c);
        copy(a, c);
      }
      context.strokeStyle = `rgba(255, 232, 200, ${(0.85 * bump(ripple)).toFixed(3)})`;
      context.lineWidth = 2;
      context.stroke(wave);
    }
    // La nariz del frente arde: ahí se frena el viento
    view(0, 0, -nose, point);
    if (point[2] > NEAR) {
      const nx = cx + (focal * point[0]) / point[2];
      const ny = cy + (focal * point[1]) / point[2];
      const glow = Math.min(width, (focal * 2.2) / point[2]);
      const heat = context.createRadialGradient(nx, ny, 0, nx, ny, glow);
      heat.addColorStop(0, `rgba(255, 210, 160, ${(0.32 * form).toFixed(3)})`);
      heat.addColorStop(0.4, `rgba(255, 150, 100, ${(0.1 * form).toFixed(3)})`);
      heat.addColorStop(1, 'rgba(255, 120, 80, 0)');
      context.fillStyle = heat;
      context.fillRect(nx - glow, ny - glow, glow * 2, glow * 2);
    }
  }

  // Las líneas de campo: brotan del centro del anillo, se arquean hacia
  // afuera y vuelven por detrás. Por profundidad: las cercanas más gruesas
  const bloomFrom = SHIELD.bloom[0];
  const bloomSpan = SHIELD.bloom[1] - SHIELD.bloom[0];
  const ribs = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
  const tips = new Path2D();
  for (const rib of RIBS) {
    const grow = seg(p, [bloomFrom + bloomSpan * rib.delay, bloomFrom + bloomSpan * (rib.delay + GROW)]);
    if (grow <= 0) continue;
    const shell = rib.shell * (0.3 + 0.7 * easeOut(grow));
    const reach = easeOut(grow) * LINE_STEPS;
    const last = Math.ceil(reach);
    const unit = rib.unit;
    view(unit[0] * shell, unit[1] * shell, unit[2] * shell, a);
    pen = null;
    for (let step = 1; step <= last; step++) {
      const index = step * 3;
      // El último tramo crece de a poco
      const part = Math.min(1, reach - step + 1);
      const px = unit[index - 3] + (unit[index] - unit[index - 3]) * part;
      const py = unit[index - 2] + (unit[index + 1] - unit[index - 2]) * part;
      const pz = unit[index - 1] + (unit[index + 2] - unit[index - 1]) * part;
      view(px * shell, py * shell, pz * shell, c);
      const depth = (a[2] + c[2]) / 2;
      stroke(ribs[depth < 2.2 ? 0 : depth < 6 ? 1 : depth < 14 ? 2 : 3], a, c);
      copy(a, c);
    }
    // La punta que crece brilla
    if (grow < 1 && a[2] > NEAR) {
      const sx = cx + (focal * a[0]) / a[2];
      const sy = cy + (focal * a[1]) / a[2];
      tips.moveTo(sx + 2, sy);
      tips.arc(sx, sy, 2, 0, Math.PI * 2);
    }
  }
  [
    [0.85, 0.55, 1.8],
    [0.6, 0.4, 1],
    [0.45, 0.3, 0.8],
    [0.3, 0.2, 0.6],
  ].forEach(([alpha, white, lineWidth], index) => {
    context.strokeStyle = tint(alpha, white);
    context.lineWidth = lineWidth;
    context.stroke(ribs[index]);
  });
  context.fillStyle = tint(0.95, 0.75);
  context.fill(tips);

  // El anillo: dos aros con nodos. Apagado, el Sol lo ilumina desde nuestra
  // espalda; al encenderse, un pulso lo recorre desde arriba por ambos lados
  {
    const ignite = seg(p, SHIELD.ignite);
    const lit = new Path2D();
    const dim = new Path2D();
    const head = new Path2D();
    const STEPS = 96;
    for (const radius of [1, 0.92]) {
      for (let step = 0; step < STEPS; step++) {
        const from = (step / STEPS) * Math.PI * 2;
        const to = ((step + 1) / STEPS) * Math.PI * 2;
        view(radius * Math.cos(from), radius * Math.sin(from), 0, a);
        view(radius * Math.cos(to), radius * Math.sin(to), 0, c);
        // Distancia angular desde lo alto del anillo
        const middle = (from + to) / 2;
        const fromTop = Math.abs(Math.atan2(Math.sin(middle - Math.PI / 2), Math.cos(middle - Math.PI / 2))) / Math.PI;
        const reached = fromTop < ignite;
        segment(reached ? lit : dim, a, c);
        if (reached && ignite < 1 && fromTop > ignite - 0.06) segment(head, a, c);
      }
    }
    for (let node = 0; node < 12; node++) {
      const angle = (node / 12) * Math.PI * 2;
      view(0.88 * Math.cos(angle), 0.88 * Math.sin(angle), 0, a);
      view(1.04 * Math.cos(angle), 1.04 * Math.sin(angle), 0, c);
      segment(ignite > 0.99 ? lit : dim, a, c);
    }
    context.strokeStyle = 'rgba(255, 214, 160, 0.45)';
    context.lineWidth = 1;
    context.stroke(dim);
    const steady = ease(seg(p, [SHIELD.ignite[1] - 0.004, SHIELD.ignite[1] + 0.01]));
    context.strokeStyle = tint(0.16 + 0.1 * steady, 0.3);
    context.lineWidth = 9;
    context.stroke(lit);
    context.strokeStyle = tint(0.95, 0.55);
    context.lineWidth = 1.6;
    context.stroke(lit);
    context.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    context.lineWidth = 3;
    context.stroke(head);
  }

  // El viento: cada estela es un trecho de su línea de corriente, que se
  // abre alrededor de la burbuja; la punta brilla más que la cola. Tras el
  // choque, más caliente
  // En la sombra del escudo el viento se apaga: solo queda, tenue, el que
  // pasa por fuera
  const calm = 1 - 0.85 * ease(seg(p, [0.198, 0.228]));
  {
    const flow = WIND_SPEED * p;
    const nose = BODY.nose + (SHOCK.nose - BODY.nose) * form;
    const paths = Array.from({ length: 6 }, () => new Path2D());
    for (const particle of WIND) {
      const lap = (((particle.lane + flow - ez + WIND_BEHIND) % WIND_RANGE) + WIND_RANGE) % WIND_RANGE;
      const fade = smoothstep(0, 2, lap) * smoothstep(0, 5, WIND_RANGE - lap);
      if (fade <= 0) continue;
      const z = ez - WIND_BEHIND + lap;
      const cos = Math.cos(particle.azimuth);
      const sin = Math.sin(particle.azimuth);
      const spread = particle.rho * particle.rho;
      const rho = Math.sqrt(spread + form * deflection(z));
      view(rho * cos, rho * sin, z, c);
      if (c[2] < NEAR) continue;
      const light = calm * fade * (0.35 + 0.65 * particle.glow) * clamp01(1.25 - c[2] / 20);
      if (light < 0.04) continue;
      const path = paths[(form > 0.3 && z > shockZ(rho, nose) ? 3 : 0) + Math.min(2, Math.floor(light * 3))];
      pen = null;
      for (let step = 1; step <= 3; step++) {
        const back = z - (FLOW * step) / 3;
        const reach = Math.sqrt(spread + form * deflection(back));
        view(reach * cos, reach * sin, back, a);
        stroke(path, c, a);
        copy(c, a);
      }
    }
    // Trazos de un píxel o menos: se pintan como líneas finas, mucho más baratas
    paths.forEach((path, index) => {
      const level = (index % 3) + 1;
      context.strokeStyle = index < 3
        ? `rgba(255, 216, 160, ${(0.26 * level).toFixed(3)})`
        : `rgba(255, 190, 152, ${(0.3 * level).toFixed(3)})`;
      context.lineWidth = 0.75 + 0.125 * level;
      context.stroke(path);
    });
  }

  // La línea que seguimos y su haz: nos rodean de cerca mientras giramos.
  // Por ellas corren otras partículas atrapadas, en hélices
  const riding = ease(seg(p, [0.108, 0.122])) * (1 - ease(seg(p, [0.188, 0.204])));
  if (riding > 0) {
    const theta = railTheta(s);
    const strands = [new Path2D(), new Path2D(), new Path2D()];
    const lines = [{ shell: RIDE_SHELL, azimuth: RIDE_AZIMUTH }, ...BUNDLE];
    for (const line of lines) {
      fieldPoint(line.shell, line.azimuth, Math.max(EDGE, theta - 0.25), point);
      view(point[0], point[1], point[2], a);
      pen = null;
      for (let step = 1; step <= 60; step++) {
        fieldPoint(line.shell, line.azimuth, Math.max(EDGE, theta - 0.25 + step * 0.022), point);
        view(point[0], point[1], point[2], c);
        const depth = (a[2] + c[2]) / 2;
        stroke(strands[depth < 1.5 ? 0 : depth < 4 ? 1 : 2], a, c);
        copy(a, c);
      }
    }
    [
      [0.9, 0.6, 2.4],
      [0.65, 0.45, 1.5],
      [0.4, 0.35, 1],
    ].forEach(([alpha, white, lineWidth], index) => {
      context.strokeStyle = tint(alpha * riding, white);
      context.lineWidth = lineWidth;
      context.stroke(strands[index]);
    });

    const coils = new Path2D();
    const frame = [0, 0, 0];
    for (const spiral of SPIRALS) {
      const line = lines[spiral.line];
      const lead = theta + 0.14 + ((spiral.phase + p * spiral.speed * 9) % 1) * 0.7;
      let previous = false;
      pen = null;
      for (let step = 0; step < 30; step++) {
        const at = lead - step * 0.004;
        fieldPoint(line.shell, line.azimuth, at, point);
        fieldPoint(line.shell, line.azimuth, at + 0.002, frame);
        const tangent = normalize([frame[0] - point[0], frame[1] - point[1], frame[2] - point[2]]);
        const outX = Math.cos(line.azimuth);
        const outY = Math.sin(line.azimuth);
        const outward = tangent[0] * outX + tangent[1] * outY;
        const normal: Vec3 = [tangent[2] * outX, tangent[2] * outY, -outward];
        const binormal = cross(tangent, normal);
        const angle = spiral.turn + at * 60;
        const cos = Math.cos(angle) * 0.06;
        const sin = Math.sin(angle) * 0.06;
        view(
          point[0] + normal[0] * cos + binormal[0] * sin,
          point[1] + normal[1] * cos + binormal[1] * sin,
          point[2] + normal[2] * cos + binormal[2] * sin,
          c,
        );
        if (previous) stroke(coils, a, c);
        copy(a, c);
        previous = true;
      }
    }
    context.strokeStyle = `rgba(255, 222, 170, ${(0.6 * riding).toFixed(3)})`;
    context.lineWidth = 1;
    context.stroke(coils);
  }

  // El destello del choque
  const flash = bump(seg(p, [0.103, 0.111])) ** 3;
  if (flash > 0.01) {
    const blaze = context.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(width, height) / 2);
    blaze.addColorStop(0, `rgba(255, 255, 255, ${(0.85 * flash).toFixed(3)})`);
    blaze.addColorStop(0.45, `rgba(255, 244, 228, ${(0.45 * flash).toFixed(3)})`);
    blaze.addColorStop(1, `rgba(255, 226, 196, ${(0.2 * flash).toFixed(3)})`);
    context.fillStyle = blaze;
    context.fillRect(0, 0, width, height);
  }

  // La ventana se recorta al final, borrando lo que quedó encima. Está en
  // Marte, donde mira la cámara: la cabeza del visitante la corre
  const [windowX, windowY] = lookShift(focal);
  context.globalCompositeOperation = 'source-over';
  if (opening > 0.5) {
    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    context.arc(width / 2 + windowX, height / 2 + windowY, opening, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = 'source-over';
  }
  // El borde de la ventana: el aire nuevo de Marte, que la sigue al cubrir
  const ring = 1 - seg(p, [0.42, 0.52]);
  if (opening > 0.5 && ring > 0) {
    context.globalCompositeOperation = 'lighter';
    context.beginPath();
    context.arc(width / 2 + windowX, height / 2 + windowY, opening, 0, Math.PI * 2);
    context.strokeStyle = `rgba(150, 214, 255, ${(0.2 * ring).toFixed(3)})`;
    context.lineWidth = 12;
    context.stroke();
    context.strokeStyle = tint(0.9 * ring, 0.6);
    context.lineWidth = 1.4;
    context.stroke();
    context.globalCompositeOperation = 'source-over';
  }
};
