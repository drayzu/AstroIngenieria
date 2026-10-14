import { clamp01, smoothstep } from './roomShared';
import { lookShift, lookTurn } from './lookAround';

/* Hábitats espaciales: sobrevuelo y atraque en una rueda que gira.

   Llegamos rápido hasta rozar el borde del anillo: pasa enorme sobre la
   cámara, girando, con sus ventanas encendidas. La cámara se aleja y lo
   rodea hasta quedar en su eje, frente al cubo; ahí iguala su giro (el
   hábitat se queda quieto y el cielo rueda). Una mira de atraque marca la
   escotilla mientras nos acercamos; entramos por ella a un túnel de
   anillos que pasan rozando y al fondo se abre la ventana.

   Todo en un lienzo, en 3D: el anillo tiene radio 1 en el plano z = 0 y su
   eje es z; el cubo y la escotilla miran hacia +z, de donde llegamos. */

type Range = [number, number];
type Vec3 = [number, number, number];

export const HABITAT = {
  // Llegamos hasta rozar el borde y lo seguimos un trecho
  arrive: [0.02, 0.07],
  drift: [0.02, 0.11],
  // Nos alejamos y lo rodeamos hasta su eje
  swing: [0.085, 0.19],
  // Igualamos su giro
  match: [0.15, 0.215],
  // La mira de atraque y el acercamiento a la escotilla
  sight: [0.17, 0.26],
  // Un transbordador se suelta de la escotilla y pasa a nuestro lado
  shuttle: [0.165, 0.235],
  approach: [0.2, 0.25],
  // El túnel y la ventana al fondo
  tunnel: [0.245, 0.315],
  open: [0.262, 0.29],
} satisfies Record<string, Range>;

const seg = (p: number, [from, to]: Range) => clamp01((p - from) / (to - from));
const ease = (t: number) => smoothstep(0, 1, t);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
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
const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/* ---------------- El hábitat ---------------- */

const TUBE = 0.085;
const HUB = 0.12;
const HUB_BACK = -0.16;
const HUB_FRONT = 0.2;
// La escotilla, al frente del cubo, y el túnel que sigue hacia adentro
const PORT = 0.062;
const PORT_Z = 0.24;
const TUNNEL_END = -0.62;
// Pocos radios y gruesos: tubos habitados, no varillas de bicicleta
const SPOKES = 3;
const SPOKE = 0.034;
// Las alas solares, en un mástil detrás del cubo, más anchas que el anillo
const MAST_Z = -0.5;
const WING_FROM = 0.034;
const WING_TO = 1.5;
const WING = 0.13;
// El espejo, al fondo del mástil: algo inclinado, no gira con la rueda
// y devuelve el sol hacia los ventanales
const MIRROR_Z = -1.25;
const MIRROR = 0.92;
const MIRROR_TILT = 0.44;
const MAST = 0.03;
// El transbordador: largo y radio del casco
const SHIP = 0.075;
const SHIP_WIDE = 0.016;
// Vueltas de la rueda por unidad de avance
const TURNS = 3;
// El sol: de qué lado viene la luz
const SUN = normalize([0.55, -0.5, 0.67]);

// Cuánto giró la rueda y cuánto rodamos nosotros para acompañarla: la
// igualación sube en rampa y después rodamos con ella
const wheelSpin = (p: number) => p * TURNS * Math.PI * 2;
export const habitatRoll = (p: number) => {
  const [from, to] = HABITAT.match;
  if (p <= from) return 0;
  const ramp = p <= to ? (p - from) ** 2 / (2 * (to - from)) : (to - from) / 2 + (p - to);
  return ramp * TURNS * Math.PI * 2;
};

/* ---------------- La cámara ---------------- */

const FOCAL = 0.62;
// Dónde va el ojo sobre el eje mientras se acerca y cruza el túnel
const axisDepth = (p: number) => {
  const approach = easeInOut(seg(p, HABITAT.approach));
  const tunnel = seg(p, HABITAT.tunnel) ** 1.6;
  const after = easeOut(seg(p, [HABITAT.tunnel[1], 0.42]));
  return 3 - 2.5 * approach - 0.98 * tunnel - 0.08 * after;
};

const cameraAt = (p: number) => {
  // Por dentro del anillo, rozando su piso, un poco por encima de los
  // radios (que pasan barriendo bajo nosotros). Bajamos desde el centro y
  // seguimos el anillo un trecho
  const arrive = easeOut(seg(p, HABITAT.arrive));
  const along = 1.35 - 0.5 * ease(seg(p, HABITAT.drift));
  const reach = 0.42 + 0.41 * arrive;
  const lift = 0.7 - 0.6 * arrive;
  const rim: Vec3 = [reach * Math.cos(along), reach * Math.sin(along), lift];
  // Mira por delante a lo largo del anillo, que sube y se arquea en el cielo
  const ahead = along - 1.25;
  // Un poco hacia un costado del plano: el arco cruza el cuadro en diagonal
  const rimTarget: Vec3 = [Math.cos(ahead) * 0.95, Math.sin(ahead) * 0.95, -0.38];
  // Rodeamos hacia el eje en una curva que sale hacia afuera y adelante
  const swing = easeInOut(seg(p, HABITAT.swing));
  const bend: Vec3 = [0.5 * Math.cos(along), 0.5 * Math.sin(along), 1.9];
  const onAxis: Vec3 = [0, 0, axisDepth(p)];
  const a = mix3(rim, bend, swing);
  const b = mix3(bend, onAxis, swing);
  const eye = mix3(a, b, swing);
  // La mirada se suelta antes que el cuerpo: primero giramos la cabeza
  const look = mix3(rimTarget, [0, 0, -1], ease(seg(p, [HABITAT.swing[0], HABITAT.swing[1] - 0.025])));
  const forward = normalize([look[0] - eye[0], look[1] - eye[1], look[2] - eye[2]]);
  // Dentro del anillo, el abajo es el piso (hacia afuera de la rueda); en
  // el eje, el abajo es fijo y el giro lo da el rodar
  const downRim: Vec3 = [Math.cos(along), Math.sin(along), 0];
  const down0 = normalize(mix3(downRim, [0, 1, 0], ease(swing)));
  const right0 = normalize(cross(down0, forward));
  const below = cross(forward, right0);
  // Ladeados mientras rozamos el anillo; nos enderezamos al ir al eje
  const roll = habitatRoll(p) + 0.32 * (1 - ease(swing));
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  // Y encima, la cabeza del visitante (mirar alrededor)
  return lookTurn({
    eye,
    forward,
    right: [right0[0] * cos + below[0] * sin, right0[1] * cos + below[1] * sin, right0[2] * cos + below[2] * sin] as Vec3,
    down: [below[0] * cos - right0[0] * sin, below[1] * cos - right0[1] * sin, below[2] * cos - right0[2] * sin] as Vec3,
  });
};

// El lente (px): con él se sabe dónde queda la ventana al girar la cabeza
export const habitatFocal = (width: number, height: number) => FOCAL * Math.min(width, height);

/* Radio de la ventana en píxeles: es el fondo del túnel, visto desde donde
   va la cámara. Se enciende como una luz al final del túnel */
export const habitatWindow = (p: number, width: number, height: number) => {
  const lit = easeOut(seg(p, HABITAT.open));
  if (lit <= 0) return 0;
  const distance = Math.max(0.02, axisDepth(p) - TUNNEL_END);
  return ((FOCAL * Math.min(width, height) * PORT) / distance) * lit;
};

/* Cuánto se apaga la capa de efectos (meteoros, constelaciones del
   cursor) que va por encima: nada afuera, todo dentro del túnel, y vuelve
   cuando la ventana ya cubrió el cuadro */
export const habitatSkyHidden = (p: number) => {
  const enter = smoothstep(0.9, 0.36, axisDepth(p));
  return enter * (1 - seg(p, [0.34, 0.45]));
};

/* ---------------- El cielo ---------------- */

const SKY = Array.from({ length: 520 }, (_, index) => {
  const z = seeded(index + 8101) * 2 - 1;
  const angle = seeded(index + 8203) * Math.PI * 2;
  const side = Math.sqrt(1 - z * z);
  return { x: side * Math.cos(angle), y: side * Math.sin(angle), z, glow: seeded(index + 8307) };
});

/* ---------------- El cuadro ---------------- */

const NEAR = 0.02;
const THETA_STEPS = 96;
const PHI_STEPS = 12;
const RIBS = 40;
const LANES = 6;

export const drawHabitat = (
  context: CanvasRenderingContext2D,
  p: number,
  width: number,
  height: number,
  [r, g, b]: number[],
  // Radio de la ventana abierta (px), centrada
  opening: number,
) => {
  const tint = (alpha: number, white: number) =>
    `rgba(${Math.round(r + (255 - r) * white)}, ${Math.round(g + (255 - g) * white)}, ${Math.round(b + (255 - b) * white)}, ${alpha.toFixed(3)})`;
  const camera = cameraAt(p);
  const { eye, forward, right, down } = camera;
  const focal = FOCAL * Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const spin = wheelSpin(p);

  // Del mundo a la cámara (x derecha, y abajo, z profundidad)
  const toView = (x: number, y: number, z: number, out: number[]) => {
    const vx = x - eye[0];
    const vy = y - eye[1];
    const vz = z - eye[2];
    out[0] = vx * right[0] + vy * right[1] + vz * right[2];
    out[1] = vx * down[0] + vy * down[1] + vz * down[2];
    out[2] = vx * forward[0] + vy * forward[1] + vz * forward[2];
  };
  const a = [0, 0, 0];
  const c = [0, 0, 0];
  const line = (path: Path2D, ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
    toView(ax, ay, az, a);
    toView(bx, by, bz, c);
    if (a[2] < NEAR && c[2] < NEAR) return;
    if (a[2] < NEAR || c[2] < NEAR) {
      const t = (NEAR - a[2]) / (c[2] - a[2]);
      const clipped = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, NEAR];
      if (a[2] < NEAR) a.splice(0, 3, ...clipped);
      else c.splice(0, 3, ...clipped);
    }
    path.moveTo(cx + (focal * a[0]) / a[2], cy + (focal * a[1]) / a[2]);
    path.lineTo(cx + (focal * c[0]) / c[2], cy + (focal * c[1]) / c[2]);
  };

  // La ventana está en el fondo del túnel: donde mira la cámara del guion,
  // corrida por la cabeza del visitante
  const [windowX, windowY] = lookShift(focal);
  context.save();
  if (opening > 0.5) {
    context.beginPath();
    context.rect(-width, -height, width * 3, height * 3);
    context.arc(cx + windowX, cy + windowY, opening, 0, Math.PI * 2);
    context.clip('evenodd');
  }

  /* El cielo: gira con la cámara; mientras la cámara gira rápido, las
     estrellas se barren en trazos */
  const before = cameraAt(Math.max(0, p - 0.0025));
  const appear = seg(p, [HABITAT.arrive[0], HABITAT.arrive[0] + 0.03]);
  const starTone = [new Path2D(), new Path2D()];
  for (const star of SKY) {
    const depth = star.x * forward[0] + star.y * forward[1] + star.z * forward[2];
    if (depth < 0.1) continue;
    const sx = cx + (focal * (star.x * right[0] + star.y * right[1] + star.z * right[2])) / depth;
    const sy = cy + (focal * (star.x * down[0] + star.y * down[1] + star.z * down[2])) / depth;
    if (sx < -20 || sx > width + 20 || sy < -20 || sy > height + 20) continue;
    const pastDepth = star.x * before.forward[0] + star.y * before.forward[1] + star.z * before.forward[2];
    const path = starTone[star.glow > 0.6 ? 1 : 0];
    if (pastDepth > 0.1) {
      const px = cx + (focal * (star.x * before.right[0] + star.y * before.right[1] + star.z * before.right[2])) / pastDepth;
      const py = cy + (focal * (star.x * before.down[0] + star.y * before.down[1] + star.z * before.down[2])) / pastDepth;
      if (Math.hypot(px - sx, py - sy) < 200) {
        path.moveTo(px, py);
        path.lineTo(sx + 0.01, sy);
        continue;
      }
    }
    path.moveTo(sx - 0.01, sy);
    path.lineTo(sx + 0.01, sy);
  }
  context.globalCompositeOperation = 'lighter';
  context.lineCap = 'round';
  context.strokeStyle = `rgba(232, 240, 255, ${(0.45 * appear).toFixed(3)})`;
  context.lineWidth = 1;
  context.stroke(starTone[0]);
  context.strokeStyle = `rgba(244, 248, 255, ${(0.85 * appear).toFixed(3)})`;
  context.lineWidth = 1.6;
  context.stroke(starTone[1]);

  /* Las alas solares: un mástil sale del cubo hacia atrás y de él dos
     paneles que asoman por fuera del anillo. Rompen la silueta de rueda */
  const quad = (path: Path2D, corners: number[][]) => {
    const points: number[] = [];
    for (const [x, y, z] of corners) {
      toView(x, y, z, a);
      if (a[2] < NEAR) return;
      points.push(cx + (focal * a[0]) / a[2], cy + (focal * a[1]) / a[2]);
    }
    path.moveTo(points[0], points[1]);
    for (let index = 2; index < points.length; index += 2) path.lineTo(points[index], points[index + 1]);
    path.closePath();
  };
  /* El espejo: un disco inclinado de facetas, al fondo. Brilla más cuanto
     mejor nos devuelve el sol */
  const mirrorU: Vec3 = [1, 0, 0];
  const mirrorV: Vec3 = [0, Math.cos(MIRROR_TILT), -Math.sin(MIRROR_TILT)];
  const mirrorN = cross(mirrorU, mirrorV);
  const onMirror = (radius: number, angle: number): Vec3 => [
    MIRROR * radius * (Math.cos(angle) * mirrorU[0] + Math.sin(angle) * mirrorV[0]),
    MIRROR * radius * (Math.cos(angle) * mirrorU[1] + Math.sin(angle) * mirrorV[1]),
    MIRROR_Z + MIRROR * radius * (Math.cos(angle) * mirrorU[2] + Math.sin(angle) * mirrorV[2]),
  ];
  const mirrorDisc = new Path2D();
  const mirrorLines = new Path2D();
  quad(mirrorDisc, Array.from({ length: 48 }, (_, side) => onMirror(1, (side / 48) * Math.PI * 2)));
  for (const radius of [0.3, 0.55, 0.78]) {
    for (let side = 0; side < 48; side++) line(mirrorLines, ...onMirror(radius, (side / 48) * Math.PI * 2), ...onMirror(radius, ((side + 1) / 48) * Math.PI * 2));
  }
  for (let facet = 0; facet < 12; facet++) line(mirrorLines, ...onMirror(0.3, (facet / 12) * Math.PI * 2), ...onMirror(1, (facet / 12) * Math.PI * 2));
  // El collar donde el mástil se clava en el espejo
  const collar = new Path2D();
  quad(collar, Array.from({ length: 24 }, (_, side) => onMirror(0.1, (side / 24) * Math.PI * 2)));
  const toEye = normalize([eye[0], eye[1], eye[2] - MIRROR_Z]);
  const lean = SUN[0] * mirrorN[0] + SUN[1] * mirrorN[1] + SUN[2] * mirrorN[2];
  const bounce: Vec3 = [2 * lean * mirrorN[0] - SUN[0], 2 * lean * mirrorN[1] - SUN[1], 2 * lean * mirrorN[2] - SUN[2]];
  const sheen = Math.max(0, bounce[0] * toEye[0] + bounce[1] * toEye[1] + bounce[2] * toEye[2]) ** 6;
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = `rgba(10, 18, 24, ${(0.9 * appear).toFixed(3)})`;
  context.fill(mirrorDisc);
  context.globalCompositeOperation = 'lighter';
  context.fillStyle = `rgba(200, 225, 240, ${((0.09 + 0.3 * sheen) * appear).toFixed(3)})`;
  context.fill(mirrorDisc);
  context.lineWidth = 1;
  context.strokeStyle = tint(0.4 * appear, 0.55);
  context.stroke(mirrorLines);
  context.lineWidth = 1.4;
  context.strokeStyle = tint((0.6 + 0.4 * sheen) * appear, 0.75);
  context.stroke(mirrorDisc);
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = `rgba(3, 7, 9, ${(0.95 * appear).toFixed(3)})`;
  context.fill(collar);
  context.globalCompositeOperation = 'lighter';
  context.lineWidth = 1;
  context.strokeStyle = tint(0.55 * appear, 0.6);
  context.stroke(collar);

  /* El mástil: un tubo macizo del cubo al centro del espejo. En cada
     tramo, su silueta mira a la cámara */
  const mast = new Path2D();
  const mastEdges = new Path2D();
  const MAST_STEPS = 12;
  for (let step = 0; step < MAST_STEPS; step++) {
    const z0 = HUB_BACK + ((MIRROR_Z - HUB_BACK) * step) / MAST_STEPS;
    const z1 = HUB_BACK + ((MIRROR_Z - HUB_BACK) * (step + 1)) / MAST_STEPS;
    const zm = (z0 + z1) / 2;
    const side = normalize([-eye[1], eye[0], 0]);
    const toward = Math.hypot(eye[0], eye[1]) > 1e-4 ? side : ([1, 0, 0] as Vec3);
    const at = (sign: number, z: number) => [toward[0] * MAST * sign, toward[1] * MAST * sign, z];
    quad(mast, [at(-1, z0), at(-1, z1), at(1, z1), at(1, z0)]);
    for (const sign of [-1, 1]) line(mastEdges, ...(at(sign, z0) as Vec3), ...(at(sign, z1) as Vec3));
    // Juntas cada tantos tramos
    if (step % 3 === 0) line(mastEdges, ...(at(-1, zm) as Vec3), ...(at(1, zm) as Vec3));
  }
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = `rgba(3, 7, 9, ${(0.95 * appear).toFixed(3)})`;
  context.fill(mast);
  context.globalCompositeOperation = 'lighter';
  context.strokeStyle = tint(0.45 * appear, 0.45);
  context.stroke(mastEdges);

  const wings = new Path2D();
  const cells = new Path2D();
  for (const side of [0, 1]) {
    const theta = spin + side * Math.PI;
    const dx = Math.cos(theta);
    const dy = Math.sin(theta);
    const at = (r: number, w: number) => [dx * r - dy * w, dy * r + dx * w, MAST_Z];
    quad(wings, [at(WING_FROM, -WING), at(WING_TO, -WING), at(WING_TO, WING), at(WING_FROM, WING)]);
    for (let cell = 0; cell <= 16; cell++) {
      const r = WING_FROM + ((WING_TO - WING_FROM) * cell) / 16;
      line(cells, ...(at(r, -WING) as Vec3), ...(at(r, WING) as Vec3));
    }
    for (const w of [-WING, -WING / 3, WING / 3, WING]) line(cells, ...(at(WING_FROM, w) as Vec3), ...(at(WING_TO, w) as Vec3));
  }
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = `rgba(8, 20, 30, ${(0.94 * appear).toFixed(3)})`;
  context.fill(wings);
  context.globalCompositeOperation = 'lighter';
  context.lineWidth = 1;
  context.strokeStyle = tint(0.38 * appear, 0.3);
  context.stroke(cells);

  /* El anillo. Primero el cuerpo: una piel oscura de caras que nos miran,
     para tapar las estrellas de atrás */
  const visible = appear;
  const grid: number[][] = [];
  for (let i = 0; i <= THETA_STEPS; i++) {
    const theta = spin + (i / THETA_STEPS) * Math.PI * 2;
    const row: number[] = [];
    for (let j = 0; j <= PHI_STEPS; j++) {
      const phi = (j / PHI_STEPS) * Math.PI * 2;
      const ring = 1 + TUBE * Math.cos(phi);
      row.push(ring * Math.cos(theta), ring * Math.sin(theta), TUBE * Math.sin(phi));
    }
    grid.push(row);
  }
  const facing = (theta: number, phi: number, x: number, y: number, z: number) => {
    const nx = Math.cos(phi) * Math.cos(theta);
    const ny = Math.cos(phi) * Math.sin(theta);
    const nz = Math.sin(phi);
    return { look: nx * (eye[0] - x) + ny * (eye[1] - y) + nz * (eye[2] - z), sun: nx * SUN[0] + ny * SUN[1] + nz * SUN[2] };
  };
  const skin = new Path2D();
  const corner = [0, 0, 0];
  for (let i = 0; i < THETA_STEPS; i++) {
    for (let j = 0; j < PHI_STEPS; j++) {
      const theta = spin + ((i + 0.5) / THETA_STEPS) * Math.PI * 2;
      const phi = ((j + 0.5) / PHI_STEPS) * Math.PI * 2;
      const [x, y, z] = [grid[i][j * 3], grid[i][j * 3 + 1], grid[i][j * 3 + 2]];
      if (facing(theta, phi, x, y, z).look <= 0) continue;
      const quad = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      let ok = true;
      const points: number[] = [];
      for (const [qi, qj] of quad) {
        toView(grid[qi][qj * 3], grid[qi][qj * 3 + 1], grid[qi][qj * 3 + 2], corner);
        if (corner[2] < NEAR) {
          ok = false;
          break;
        }
        points.push(cx + (focal * corner[0]) / corner[2], cy + (focal * corner[1]) / corner[2]);
      }
      if (!ok) continue;
      skin.moveTo(points[0], points[1]);
      skin.lineTo(points[2], points[3]);
      skin.lineTo(points[4], points[5]);
      skin.lineTo(points[6], points[7]);
      skin.closePath();
    }
  }
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = `rgba(3, 7, 9, ${(0.88 * visible).toFixed(3)})`;
  context.fill(skin);

  // Las líneas del anillo, en cuatro niveles de luz; lo de espaldas no se ve
  const LEVELS = [0.1, 0.22, 0.4, 0.65];
  const lanes = LEVELS.map(() => new Path2D());
  const ribs = LEVELS.map(() => new Path2D());
  const put = (levels: Path2D[], theta0: number, phi0: number, theta1: number, phi1: number) => {
    const ring0 = 1 + TUBE * Math.cos(phi0);
    const ring1 = 1 + TUBE * Math.cos(phi1);
    const x0 = ring0 * Math.cos(theta0);
    const y0 = ring0 * Math.sin(theta0);
    const z0 = TUBE * Math.sin(phi0);
    const view = facing((theta0 + theta1) / 2, (phi0 + phi1) / 2, x0, y0, z0);
    if (view.look <= 0) return;
    const level = Math.min(LEVELS.length - 1, Math.floor(Math.max(0, 0.15 + view.sun) * LEVELS.length * 0.85));
    line(levels[level], x0, y0, z0, ring1 * Math.cos(theta1), ring1 * Math.sin(theta1), TUBE * Math.sin(phi1));
  };
  for (let lane = 0; lane < LANES; lane++) {
    const phi = ((lane + 0.5) / LANES) * Math.PI * 2;
    for (let i = 0; i < THETA_STEPS; i++) {
      put(lanes, spin + (i / THETA_STEPS) * Math.PI * 2, phi, spin + ((i + 1) / THETA_STEPS) * Math.PI * 2, phi);
    }
  }
  for (let rib = 0; rib < RIBS; rib++) {
    const theta = spin + (rib / RIBS) * Math.PI * 2;
    for (let j = 0; j < 16; j++) put(ribs, theta, (j / 16) * Math.PI * 2, theta, ((j + 1) / 16) * Math.PI * 2);
  }
  context.globalCompositeOperation = 'lighter';
  context.lineWidth = 1;
  lanes.forEach((path, index) => {
    context.strokeStyle = tint(LEVELS[index] * 1.1 * visible, (index / LEVELS.length) * 0.5);
    context.stroke(path);
  });
  ribs.forEach((path, index) => {
    context.strokeStyle = tint(LEVELS[index] * 0.75 * visible, (index / LEVELS.length) * 0.4);
    context.stroke(path);
  });

  /* Ventanales: franjas de luz cálida sobre la piel del anillo, en
     paneles entre costilla y costilla. Son caras en perspectiva, así que
     de cerca se ven anchas y de lejos se afinan en una línea de luz */
  const panel = (path: Path2D, theta0: number, theta1: number, phi0: number, phi1: number) => {
    const points: number[] = [];
    for (const [theta, phi] of [[theta0, phi0], [theta1, phi0], [theta1, phi1], [theta0, phi1]]) {
      const ring = 1 + TUBE * Math.cos(phi) * 1.004;
      toView(ring * Math.cos(theta), ring * Math.sin(theta), TUBE * Math.sin(phi) * 1.004, a);
      if (a[2] < NEAR) return;
      points.push(cx + (focal * a[0]) / a[2], cy + (focal * a[1]) / a[2]);
    }
    path.moveTo(points[0], points[1]);
    path.lineTo(points[2], points[3]);
    path.lineTo(points[4], points[5]);
    path.lineTo(points[6], points[7]);
    path.closePath();
  };
  const glass = new Path2D();
  const core = new Path2D();
  const halo = new Path2D();
  // Una franja ancha mirando al cubo y dos finas por fuera
  for (const [phi, half] of [[Math.PI, 0.2], [0.5, 0.07], [-0.5, 0.07]]) {
    for (let rib = 0; rib < RIBS; rib++) {
      const from = spin + ((rib + 0.12) / RIBS) * Math.PI * 2;
      const to = spin + ((rib + 0.88) / RIBS) * Math.PI * 2;
      const mid = (from + to) / 2;
      const ring = 1 + TUBE * Math.cos(phi);
      if (facing(mid, phi, ring * Math.cos(mid), ring * Math.sin(mid), TUBE * Math.sin(phi)).look <= 0) continue;
      // Cada panel en tres tramos, para que siga la curva del anillo
      for (let part = 0; part < 3; part++) {
        const t0 = from + ((to - from) * part) / 3;
        const t1 = from + ((to - from) * (part + 1)) / 3;
        panel(glass, t0, t1, phi - half, phi + half);
        panel(core, t0, t1, phi - half * 0.28, phi + half * 0.28);
        panel(halo, t0, t1, phi - half * 2.4, phi + half * 2.4);
      }
    }
  }
  context.fillStyle = `rgba(255, 186, 110, ${(0.045 * visible).toFixed(3)})`;
  context.fill(halo);
  context.fillStyle = `rgba(255, 200, 140, ${(0.14 * visible).toFixed(3)})`;
  context.fill(glass);
  context.fillStyle = `rgba(255, 228, 190, ${(0.5 * visible).toFixed(3)})`;
  context.fill(core);

  /* Los radios, el cubo y la escotilla */
  const frame = new Path2D();
  const bright = new Path2D();
  /* Los radios: tubos con su silueta oscura, dos bordes y una franja de
     ventanal del lado que nos mira */
  const tubes = new Path2D();
  const tubeGlass = new Path2D();
  const tubeCore = new Path2D();
  const STEPS = 14;
  for (let spoke = 0; spoke < SPOKES; spoke++) {
    const theta = spin + (spoke / SPOKES) * Math.PI * 2 + Math.PI / SPOKES;
    const d: Vec3 = [Math.cos(theta), Math.sin(theta), 0];
    // En cada punto del eje: hacia el ojo (n) y de costado (side)
    const frameAt = (r: number) => {
      const point: Vec3 = [d[0] * r, d[1] * r, 0];
      const v: Vec3 = [eye[0] - point[0], eye[1] - point[1], eye[2] - point[2]];
      const along = v[0] * d[0] + v[1] * d[1];
      const n = normalize([v[0] - along * d[0], v[1] - along * d[1], v[2]]);
      return { point, n, side: cross(d, n) };
    };
    const at = (r: number, n: number, side: number) => {
      const { point, n: toEye, side: across } = frameAt(r);
      return [0, 1, 2].map((k) => point[k] + (toEye[k] * n + across[k] * side) * SPOKE);
    };
    for (let step = 0; step < STEPS; step++) {
      const r0 = HUB + ((1 - TUBE - HUB) * step) / STEPS;
      const r1 = HUB + ((1 - TUBE - HUB) * (step + 1)) / STEPS;
      quad(tubes, [at(r0, 0, -1), at(r1, 0, -1), at(r1, 0, 1), at(r0, 0, 1)]);
      // La franja, sobre la cara que nos mira, en paneles con junta
      const g0 = r0 + (r1 - r0) * 0.1;
      const g1 = r1 - (r1 - r0) * 0.1;
      quad(tubeGlass, [at(g0, 0.94, -0.34), at(g1, 0.94, -0.34), at(g1, 0.94, 0.34), at(g0, 0.94, 0.34)]);
      quad(tubeCore, [at(g0, 1, -0.1), at(g1, 1, -0.1), at(g1, 1, 0.1), at(g0, 1, 0.1)]);
      for (const side of [-1, 1]) line(frame, ...(at(r0, 0, side) as Vec3), ...(at(r1, 0, side) as Vec3));
    }
  }
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = `rgba(3, 7, 9, ${(0.94 * visible).toFixed(3)})`;
  context.fill(tubes);
  context.globalCompositeOperation = 'lighter';
  context.fillStyle = `rgba(255, 200, 140, ${(0.12 * visible).toFixed(3)})`;
  context.fill(tubeGlass);
  context.fillStyle = `rgba(255, 228, 190, ${(0.45 * visible).toFixed(3)})`;
  context.fill(tubeCore);
  const circle = (path: Path2D, radius: number, z: number, sides = 32, turn = spin) => {
    for (let side = 0; side < sides; side++) {
      const from = turn + (side / sides) * Math.PI * 2;
      const to = turn + ((side + 1) / sides) * Math.PI * 2;
      line(path, radius * Math.cos(from), radius * Math.sin(from), z, radius * Math.cos(to), radius * Math.sin(to), z);
    }
  };
  circle(frame, HUB, HUB_BACK);
  circle(frame, HUB, HUB_FRONT);
  for (let edge = 0; edge < 12; edge++) {
    const angle = spin + (edge / 12) * Math.PI * 2;
    line(frame, HUB * Math.cos(angle), HUB * Math.sin(angle), HUB_BACK, HUB * Math.cos(angle), HUB * Math.sin(angle), HUB_FRONT);
  }
  // El collar de la escotilla
  circle(bright, PORT, PORT_Z, 40);
  circle(frame, PORT * 1.35, HUB_FRONT + 0.012, 40);
  for (let edge = 0; edge < 8; edge++) {
    const angle = spin + (edge / 8) * Math.PI * 2;
    line(frame, PORT * Math.cos(angle), PORT * Math.sin(angle), HUB_FRONT, PORT * Math.cos(angle), PORT * Math.sin(angle), PORT_Z);
  }
  /* El manto del cubo: las caras que nos miran tapan el mástil, el espejo
     y el arranque de los radios; una franja de ventanal le da la vuelta */
  const mantle = new Path2D();
  const mantleGlass = new Path2D();
  const mantleCore = new Path2D();
  const HUB_SIDES = 36;
  for (let side = 0; side < HUB_SIDES; side++) {
    const from = spin + (side / HUB_SIDES) * Math.PI * 2;
    const to = spin + ((side + 1) / HUB_SIDES) * Math.PI * 2;
    const mid = (from + to) / 2;
    const look = Math.cos(mid) * (eye[0] - HUB * Math.cos(mid)) + Math.sin(mid) * (eye[1] - HUB * Math.sin(mid));
    if (look <= 0) continue;
    const at = (angle: number, z: number, radius = HUB) => [radius * Math.cos(angle), radius * Math.sin(angle), z];
    quad(mantle, [at(from, HUB_BACK), at(to, HUB_BACK), at(to, HUB_FRONT), at(from, HUB_FRONT)]);
    if (side % 3 === 2) continue;
    const band = (HUB_FRONT + HUB_BACK) / 2;
    quad(mantleGlass, [at(from, band - 0.05, HUB * 1.01), at(to, band - 0.05, HUB * 1.01), at(to, band + 0.05, HUB * 1.01), at(from, band + 0.05, HUB * 1.01)]);
    quad(mantleCore, [at(from, band - 0.014, HUB * 1.01), at(to, band - 0.014, HUB * 1.01), at(to, band + 0.014, HUB * 1.01), at(from, band + 0.014, HUB * 1.01)]);
  }
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = `rgba(3, 7, 9, ${(0.95 * visible).toFixed(3)})`;
  context.fill(mantle);
  context.globalCompositeOperation = 'lighter';
  context.fillStyle = `rgba(255, 200, 140, ${(0.12 * visible).toFixed(3)})`;
  context.fill(mantleGlass);
  context.fillStyle = `rgba(255, 228, 190, ${(0.45 * visible).toFixed(3)})`;
  context.fill(mantleCore);
  // La tapa del cubo tapa lo que hay detrás (menos la escotilla)
  if (eye[2] > HUB_FRONT) {
    const cap = new Path2D();
    let ok = true;
    for (const radius of [HUB, PORT]) {
      for (let side = 0; side <= 40; side++) {
        const angle = (side / 40) * Math.PI * 2 * (radius === HUB ? 1 : -1);
        toView(radius * Math.cos(angle), radius * Math.sin(angle), radius === HUB ? HUB_FRONT : PORT_Z, a);
        if (a[2] < NEAR) ok = false;
        const sx = cx + (focal * a[0]) / a[2];
        const sy = cy + (focal * a[1]) / a[2];
        if (side === 0) cap.moveTo(sx, sy);
        else cap.lineTo(sx, sy);
      }
      cap.closePath();
    }
    if (ok) {
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = `rgba(3, 7, 9, ${(0.92 * visible).toFixed(3)})`;
      context.fill(cap, 'evenodd');
    }
  }
  context.globalCompositeOperation = 'lighter';
  context.strokeStyle = tint(0.32 * visible, 0.35);
  context.stroke(frame);
  context.lineWidth = 1.4;
  context.strokeStyle = tint(0.9 * visible, 0.7);
  context.stroke(bright);

  /* El túnel: anillos dentro del cubo, que solo se ven por la escotilla
     cuando estamos en el eje. Al cruzarlo pasan rozando */
  const inside = seg(p, [HABITAT.swing[1] - 0.01, HABITAT.swing[1] + 0.02]);
  if (inside > 0) {
    /* La pared del túnel es opaca: por la escotilla solo se ve su
       interior oscuro, y una vez adentro tapa todo el cuadro (menos la
       ventana del fondo, que ya quedó fuera del recorte) */
    const wall = new Path2D();
    let crossed = false;
    for (let side = 0; side <= 48; side++) {
      const angle = (side / 48) * Math.PI * 2;
      toView(PORT * Math.cos(angle), PORT * Math.sin(angle), PORT_Z, a);
      if (a[2] < NEAR) {
        crossed = true;
        break;
      }
      const sx = cx + (focal * a[0]) / a[2];
      const sy = cy + (focal * a[1]) / a[2];
      if (side === 0) wall.moveTo(sx, sy);
      else wall.lineTo(sx, sy);
    }
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = `rgba(3, 7, 9, ${(0.97 * inside).toFixed(3)})`;
    if (crossed) context.fillRect(0, 0, width, height);
    else context.fill(wall);
    context.globalCompositeOperation = 'lighter';
    const rings = new Path2D();
    for (let z = PORT_Z - 0.05; z > TUNNEL_END; z -= 0.055) circle(rings, PORT * 0.96, z, 32);
    /* Cuatro rieles de luz a lo largo de la pared: fugan hacia el fondo
       y, al entrar, pasan por los bordes del cuadro y se apagan al rozarnos */
    const rails = [new Path2D(), new Path2D()];
    const railGlow = [new Path2D(), new Path2D()];
    const strip = (paths: Path2D[], angle: number, half: number, z0: number, z1: number) => {
      const points: number[] = [];
      let depth = 0;
      for (const [turn, z] of [[angle - half, z0], [angle + half, z0], [angle + half, z1], [angle - half, z1]]) {
        toView(PORT * 0.93 * Math.cos(turn), PORT * 0.93 * Math.sin(turn), z, a);
        if (a[2] < NEAR) return;
        depth += a[2] / 4;
        points.push(cx + (focal * a[0]) / a[2], cy + (focal * a[1]) / a[2]);
      }
      const path = paths[depth < 0.09 ? 0 : 1];
      path.moveTo(points[0], points[1]);
      path.lineTo(points[2], points[3]);
      path.lineTo(points[4], points[5]);
      path.lineTo(points[6], points[7]);
      path.closePath();
    };
    for (let rail = 0; rail < 4; rail++) {
      const angle = spin + (rail / 4) * Math.PI * 2 + Math.PI / 4;
      // En tramos cortos, para que lo que queda delante se siga viendo
      for (let z = PORT_Z - 0.03; z > TUNNEL_END; z -= 0.04) {
        strip(rails, angle, 0.012, z, Math.max(TUNNEL_END, z - 0.04));
        strip(railGlow, angle, 0.06, z, Math.max(TUNNEL_END, z - 0.04));
      }
    }
    context.lineWidth = 1;
    context.strokeStyle = tint(0.45 * inside, 0.45);
    context.stroke(rings);
    for (const [index, near] of [0.3, 1].entries()) {
      context.fillStyle = `rgba(255, 200, 140, ${(0.05 * near * inside).toFixed(3)})`;
      context.fill(railGlow[index]);
      context.fillStyle = `rgba(255, 232, 200, ${(0.6 * near * inside).toFixed(3)})`;
      context.fill(rails[index]);
    }
  }

  /* El transbordador: se suelta de la escotilla, sale derecho por el eje
     y se abre hacia un costado para pasar junto a nosotros */
  const leave = seg(p, HABITAT.shuttle);
  if (leave > 0 && leave < 1) {
    const t = leave ** 1.7;
    const b0: Vec3 = [0, 0, PORT_Z + SHIP * 0.6];
    const b1: Vec3 = [0, 0, 1.3];
    const b2: Vec3 = [0.62, -0.34, 4.4];
    const along = (k: number): Vec3 => mix3(mix3(b0, b1, k), mix3(b1, b2, k), k);
    const at = along(t);
    const next = along(Math.min(1, t + 0.01));
    const f = normalize([next[0] - at[0], next[1] - at[1], next[2] - at[2]]);
    const s0 = normalize(cross(f, [0, 1, 0]));
    const u0 = cross(s0, f);
    const point = (x: number, angle: number, radius: number): Vec3 => [0, 1, 2].map(
      (k) => at[k] + f[k] * x + (s0[k] * Math.cos(angle) + u0[k] * Math.sin(angle)) * radius,
    ) as Vec3;
    const SIDES = 6;
    const back = -SHIP / 2;
    const shoulder = SHIP * 0.22;
    const hull = new Path2D();
    const edges = new Path2D();
    const portholes = new Path2D();
    const faces = (corners: Vec3[]) => {
      const mid = corners.reduce((sum, c) => [sum[0] + c[0] / corners.length, sum[1] + c[1] / corners.length, sum[2] + c[2] / corners.length], [0, 0, 0]);
      // Hacia afuera del eje del casco
      const off: Vec3 = [mid[0] - at[0], mid[1] - at[1], mid[2] - at[2]];
      const lengthwise = off[0] * f[0] + off[1] * f[1] + off[2] * f[2];
      const normal = normalize([off[0] - f[0] * lengthwise, off[1] - f[1] * lengthwise, off[2] - f[2] * lengthwise]);
      return normal[0] * (eye[0] - mid[0]) + normal[1] * (eye[1] - mid[1]) + normal[2] * (eye[2] - mid[2]) > 0;
    };
    for (let side = 0; side < SIDES; side++) {
      const a0 = (side / SIDES) * Math.PI * 2;
      const a1 = ((side + 1) / SIDES) * Math.PI * 2;
      const body = [point(back, a0, SHIP_WIDE), point(shoulder, a0, SHIP_WIDE), point(shoulder, a1, SHIP_WIDE), point(back, a1, SHIP_WIDE)];
      const nose = [point(shoulder, a0, SHIP_WIDE), point(SHIP / 2, 0, 0), point(shoulder, a1, SHIP_WIDE)];
      quad(hull, body);
      quad(hull, nose);
      line(edges, ...point(back, a0, SHIP_WIDE), ...point(shoulder, a0, SHIP_WIDE));
      line(edges, ...point(shoulder, a0, SHIP_WIDE), ...point(SHIP / 2, 0, 0));
      line(edges, ...point(back, a0, SHIP_WIDE), ...point(back, a1, SHIP_WIDE));
      line(edges, ...point(shoulder, a0, SHIP_WIDE), ...point(shoulder, a1, SHIP_WIDE));
      // La franja de ventanal, en las caras que nos miran
      if (faces(body)) {
        const am = (a0 + a1) / 2;
        quad(portholes, [point(back * 0.7, am - 0.3, SHIP_WIDE * 1.02), point(shoulder * 0.8, am - 0.3, SHIP_WIDE * 1.02), point(shoulder * 0.8, am + 0.3, SHIP_WIDE * 1.02), point(back * 0.7, am + 0.3, SHIP_WIDE * 1.02)]);
      }
    }
    // El motor: una llama corta que se enciende al alejarse del cubo
    const burn = seg(leave, [0.12, 0.3]) * (0.7 + 0.3 * Math.sin(p * 4000));
    const plume = new Path2D();
    quad(plume, [point(back, Math.PI / 2, SHIP_WIDE * 0.7), point(back - SHIP * 0.9, 0, 0), point(back, -Math.PI / 2, SHIP_WIDE * 0.7)]);
    quad(plume, [point(back, 0, SHIP_WIDE * 0.7), point(back - SHIP * 0.9, 0, 0), point(back, Math.PI, SHIP_WIDE * 0.7)]);
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = 'rgba(4, 9, 12, 0.96)';
    context.fill(hull);
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = `rgba(150, 220, 255, ${(0.35 * burn).toFixed(3)})`;
    context.fill(plume);
    context.lineWidth = 1;
    context.strokeStyle = tint(0.6, 0.55);
    context.stroke(edges);
    context.fillStyle = 'rgba(255, 224, 180, 0.55)';
    context.fill(portholes);
  }

  /* La mira de atraque: un círculo con marcas alrededor de la escotilla y
     dos marcas de horizonte que se nivelan cuando igualamos el giro */
  const sight = seg(p, [HABITAT.sight[0], HABITAT.sight[0] + 0.02]) * (1 - seg(p, [HABITAT.sight[1] - 0.02, HABITAT.sight[1]]));
  if (sight > 0.01) {
    toView(0, 0, PORT_Z, a);
    const portPx = a[2] > NEAR ? (focal * PORT) / a[2] : width;
    const radius = Math.max(46, portPx * 1.6);
    const mismatch = (spin - habitatRoll(p)) % Math.PI;
    const level = Math.max(0, 1 - habitatRoll(p) / (habitatRoll(HABITAT.match[1]) || 1));
    const tilt = mismatch * level;
    const hud = new Path2D();
    hud.arc(cx, cy, radius, 0, Math.PI * 2);
    for (let corner = 0; corner < 4; corner++) {
      const angle = Math.PI / 4 + (corner * Math.PI) / 2;
      const reach = radius * 1.32;
      const x = cx + Math.cos(angle) * reach;
      const y = cy + Math.sin(angle) * reach;
      const sx = Math.sign(Math.cos(angle));
      const sy = Math.sign(Math.sin(angle));
      hud.moveTo(x - sx * 14, y);
      hud.lineTo(x, y);
      hud.lineTo(x, y - sy * 14);
    }
    for (const side of [-1, 1]) {
      const inner = radius * 1.08;
      const outer = radius * 1.08 + 26;
      hud.moveTo(cx + side * inner * Math.cos(tilt), cy + side * inner * Math.sin(tilt));
      hud.lineTo(cx + side * outer * Math.cos(tilt), cy + side * outer * Math.sin(tilt));
    }
    hud.moveTo(cx - 6, cy);
    hud.lineTo(cx + 6, cy);
    hud.moveTo(cx, cy - 6);
    hud.lineTo(cx, cy + 6);
    context.lineWidth = 1;
    context.strokeStyle = tint(0.55 * sight, 0.5);
    context.stroke(hud);
  }

  context.restore();

  // El borde de la ventana al fondo del túnel
  if (opening > 0.5) {
    context.globalCompositeOperation = 'lighter';
    context.strokeStyle = tint(0.8 * (1 - seg(p, [0.34, 0.45])), 0.6);
    context.lineWidth = 1.3;
    context.beginPath();
    context.arc(cx + windowX, cy + windowY, opening, 0, Math.PI * 2);
    context.stroke();
  }
  context.globalCompositeOperation = 'source-over';
};
