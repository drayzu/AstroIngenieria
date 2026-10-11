import { clamp01, smoothstep } from './roomShared';

/* Propulsión: una cámara de persecución sigue a la nave desde que enciende
   el motor hasta acercarse a la velocidad de la luz.

   La nave llega a la deriva desde atrás de la cámara, nos pasa por el lado
   y frena frente a nosotros; ahí enciende el motor (la cámara tiembla); la
   cámara la rodea, ladeándose en la curva, hasta quedar detrás, y las
   estrellas empiezan a pasar. Cerca de la luz el cielo se aprieta hacia
   delante (aberración) y se tiñe por el corrimiento Doppler: azul hacia
   donde vamos, rojo lo que queda atrás; solo se ve el anillo intermedio.
   La nave se adelanta hasta el punto de fuga y ahí, donde se apaga, se abre
   la ventana; al llegar frenamos y el anillo se suelta hacia afuera.

   Todo se dibuja en un lienzo con la escena en 3D: la nave en largos de
   nave (de la tobera, z = -0.5, a la proa, z = 0.5) y el cielo alrededor
   de la cámara. */

type Range = [number, number];
type Vec3 = [number, number, number];

export const CHASE = {
  // La nave llega a la deriva, con el motor apagado: nos pasa por el lado
  // desde atrás de la cámara y frena frente a nosotros
  arrive: [0.02, 0.08],
  // Ya quieta, enciende el motor
  ignite: [0.08, 0.12],
  // La cámara la rodea hasta quedar detrás
  swing: [0.095, 0.2],
  // Cerca de la luz el cielo se aprieta en un anillo
  starbow: [0.12, 0.25],
  // La nave se adelanta hasta el punto de fuga y ahí se abre la ventana
  leap: [0.2, 0.265],
  open: [0.245, 0.31],
  // Al llegar frenamos y el anillo se suelta
  brake: [0.31, 0.5],
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

/* ---------------- La nave, en trazos ---------------- */

type Segment = [Vec3, Vec3];

const SHIP = (() => {
  // Casco: lo que da la silueta. Detalle: el enrejado y las aletas
  const hull: Segment[] = [];
  const detail: Segment[] = [];
  const around = (radius: number, angle: number, z: number): Vec3 => [radius * Math.cos(angle), radius * Math.sin(angle), z];
  const ring = (list: Segment[], z: number, radius: number, sides = 16) => {
    for (let side = 0; side < sides; side++) {
      const from = (side / sides) * Math.PI * 2;
      const to = ((side + 1) / sides) * Math.PI * 2;
      list.push([around(radius, from, z), around(radius, to, z)]);
    }
  };
  // Generatrices de una pieza de revolución, de un anillo al siguiente
  const lathe = (list: Segment[], [z0, r0]: Range, [z1, r1]: Range, count: number) => {
    for (let line = 0; line < count; line++) {
      const angle = (line / count) * Math.PI * 2;
      list.push([around(r0, angle, z0), around(r1, angle, z1)]);
    }
  };

  // La tobera: una campana abierta hacia atrás
  ring(hull, -0.5, 0.075);
  ring(detail, -0.455, 0.052, 14);
  ring(hull, -0.41, 0.028, 12);
  lathe(hull, [-0.5, 0.075], [-0.455, 0.052], 10);
  lathe(hull, [-0.455, 0.052], [-0.41, 0.028], 10);
  // El reactor y su escudo de sombra, un cono que protege al resto
  ring(hull, -0.41, 0.036, 12);
  ring(hull, -0.35, 0.036, 12);
  lathe(hull, [-0.41, 0.036], [-0.35, 0.036], 6);
  lathe(hull, [-0.35, 0.036], [-0.32, 0.062], 12);
  ring(hull, -0.32, 0.062, 18);
  // La espina: una celosía de cuatro largueros con diagonales alternadas
  const half = 0.02;
  const corners: [number, number][] = [[half, half], [-half, half], [-half, -half], [half, -half]];
  const spine: Range = [-0.32, 0.3];
  const bays = 10;
  corners.forEach(([x, y]) => hull.push([[x, y, spine[0]], [x, y, spine[1]]]));
  for (let bay = 0; bay <= bays; bay++) {
    const z = spine[0] + (bay / bays) * (spine[1] - spine[0]);
    const next = z + (spine[1] - spine[0]) / bays;
    corners.forEach(([x, y], index) => {
      const [nx, ny] = corners[(index + 1) % 4];
      detail.push([[x, y, z], [nx, ny, z]]);
      if (bay === bays) return;
      const flip = (bay + index) % 2;
      detail.push([[x, y, flip ? z : next], [nx, ny, flip ? next : z]]);
    });
  }
  // Radiadores: dos alas finas barridas hacia atrás a lo largo de la espina
  const inner: Range = [-0.28, 0.04];
  const outer: Range = [-0.23, -0.07];
  const reach: Range = [0.022, 0.21];
  for (const side of [-1, 1]) {
    const at = (distance: number, z: number): Vec3 => [side * distance, 0, z];
    hull.push(
      [at(reach[0], inner[1]), at(reach[1], outer[1])],
      [at(reach[1], outer[1]), at(reach[1], outer[0])],
      [at(reach[1], outer[0]), at(reach[0], inner[0])],
    );
    for (let line = 1; line <= 6; line++) {
      const t = line / 7;
      detail.push([
        at(reach[0], inner[0] + (inner[1] - inner[0]) * t),
        at(reach[1], outer[0] + (outer[1] - outer[0]) * t),
      ]);
    }
  }
  // Un módulo de carga sobre la espina
  ring(hull, 0.09, 0.042, 14);
  ring(hull, 0.19, 0.042, 14);
  lathe(hull, [0.09, 0.042], [0.19, 0.042], 8);
  // El módulo de mando y la proa: una ojiva clásica que termina en punta
  lathe(hull, [0.3, 0.024], [0.32, 0.048], 8);
  ring(hull, 0.32, 0.048, 16);
  ring(hull, 0.37, 0.048, 16);
  lathe(hull, [0.32, 0.048], [0.37, 0.048], 8);
  const nose: Range[] = [[0.37, 0.048], [0.41, 0.042], [0.445, 0.03], [0.475, 0.015], [0.5, 0]];
  nose.slice(1, -1).forEach(([z, radius]) => ring(detail, z, radius, 14));
  for (let step = 1; step < nose.length; step++) lathe(hull, nose[step - 1], nose[step], 8);
  return { hull, detail };
})();

/* ---------------- La cámara ---------------- */

// La llegada: la nave viene desde atrás de la cámara (fuera de cuadro) y
// frena frente a nosotros; devuelve cuánto le falta (en largos de nave)
const arrival = (p: number) => -2.6 * (1 - easeOut(seg(p, CHASE.arrive)));

const CAMERA = {
  // Distancia detrás de la nave (en largos de nave) y altura, al empezar y
  // al quedar detrás
  distance: [0.95, 1.3] as Range,
  rise: [0.36, 0.2] as Range,
  // Empieza girada hacia el costado izquierdo: la proa apunta a la
  // izquierda, como la nave de la imagen
  yaw: -1.1,
  // Cuánto se ladea en la curva (rad)
  bank: 0.2,
  // Distancia focal respecto al lado corto de la pantalla
  focal: 0.62,
};

// El ladeo de la cámara: entra en la curva y se endereza al quedar detrás
export const chaseBank = (p: number) => CAMERA.bank * bump(seg(p, CHASE.swing));

const cameraAt = (p: number) => {
  const align = easeInOut(seg(p, CHASE.swing));
  const yaw = CAMERA.yaw * (1 - align);
  const rise = CAMERA.rise[0] + (CAMERA.rise[1] - CAMERA.rise[0]) * align;
  const distance = CAMERA.distance[0] + (CAMERA.distance[1] - CAMERA.distance[0]) * align;
  const eye: Vec3 = [distance * Math.sin(yaw), -rise, -distance * Math.cos(yaw)];
  // Al principio mira a la nave; ya detrás, mira hacia delante y la nave
  // queda bajo el punto de fuga. La mirada se suelta tarde: mientras la
  // rodea, la nave sigue al centro
  // Mientras la nave llega, la cámara la sigue con la mirada
  const look = normalize([-eye[0], -eye[1], 0.08 + 0.35 * Math.max(arrival(p), -1) - eye[2]]);
  const ahead = align * align;
  const forward = normalize([look[0] * (1 - ahead), look[1] * (1 - ahead), look[2] * (1 - ahead) + ahead]);
  const right = normalize(cross([0, 1, 0], forward));
  const down = cross(forward, right);
  const bank = chaseBank(p);
  const cos = Math.cos(bank);
  const sin = Math.sin(bank);
  return {
    eye,
    forward,
    right: [right[0] * cos + down[0] * sin, right[1] * cos + down[1] * sin, right[2] * cos + down[2] * sin] as Vec3,
    down: [down[0] * cos - right[0] * sin, down[1] * cos - right[1] * sin, down[2] * cos - right[2] * sin] as Vec3,
  };
};

// Cuánto se adelanta la nave a la cámara
const shipAhead = (p: number) =>
  arrival(p)
  // Al encender da un tirón y la cámara la alcanza
  + 0.22 * ease(seg(p, [0.085, 0.125])) * (1 - ease(seg(p, [0.125, 0.19])))
  // El salto: se aleja cada vez más rápido hacia el punto de fuga
  + CAMERA.distance[1] * (60 ** (seg(p, CHASE.leap) ** 2) - 1);

// Temblor de la cámara: el encendido y el rugido mientras acelera
const shakeAt = (p: number): [number, number] => {
  const amount = 7 * bump(seg(p, [0.08, 0.13])) + 2.2 * seg(p, [0.14, 0.22]) * (1 - seg(p, [0.22, 0.245]));
  return [
    amount * Math.sin(p * 1900) * Math.cos(p * 1130),
    amount * Math.cos(p * 1570) * Math.sin(p * 870),
  ];
};

/* ---------------- El cielo que pasa ---------------- */

// Velocidad por unidad de progreso: un arrastre suave al encender, luego
// acelera hasta el salto y frena al llegar
const speedAt = (p: number) => {
  const cruise = 22 * ease(seg(p, [0.085, 0.13]));
  const burn = 520 * seg(p, [0.11, 0.27]) ** 2;
  return (cruise + burn) * (1 - ease(seg(p, CHASE.brake)));
};
// Distancia recorrida: la integral de la velocidad, tabulada una vez
const TRAVEL_STEP = 0.0005;
const TRAVEL = (() => {
  const table = new Float32Array(1201);
  for (let index = 1; index < table.length; index++) {
    table[index] = table[index - 1] + speedAt(index * TRAVEL_STEP) * TRAVEL_STEP;
  }
  return table;
})();
const travelAt = (p: number) => {
  const at = Math.min(Math.max(p, 0) / TRAVEL_STEP, TRAVEL.length - 1.001);
  const index = Math.floor(at);
  return TRAVEL[index] + (TRAVEL[index + 1] - TRAVEL[index]) * (at - index);
};

// Las estrellas viven en una caja alrededor de la cámara, fuera de un tubo
// alrededor del eje (ninguna pasa rozándonos); al quedar atrás vuelven a
// aparecer adelante
const SKY_RANGE = 4.8;
const SKY_BEHIND = 2.2;
const SKY = Array.from({ length: 420 }, (_, index) => {
  const angle = seeded(index + 4101) * Math.PI * 2;
  const radius = 0.14 + Math.sqrt(seeded(index + 4203)) * 1.1;
  return {
    x: radius * Math.cos(angle),
    y: radius * Math.sin(angle),
    z: seeded(index + 4307) * SKY_RANGE,
    glow: seeded(index + 4409),
  };
});

// Corrimiento Doppler: rojo lo que se aleja, azul lo que viene
const DOPPLER_STOPS: [number, Vec3][] = [
  [-1, [255, 88, 70]],
  [-0.45, [255, 170, 124]],
  [0, [236, 242, 255]],
  [0.5, [138, 188, 255]],
  [1, [150, 118, 255]],
];
const DOPPLER_STEPS = 12;
const DOPPLER = Array.from({ length: DOPPLER_STEPS + 1 }, (_, index) => {
  const t = -1 + (2 * index) / DOPPLER_STEPS;
  const next = DOPPLER_STOPS.findIndex(([at]) => at >= t);
  const [toAt, to] = DOPPLER_STOPS[Math.max(1, next)];
  const [fromAt, from] = DOPPLER_STOPS[Math.max(0, next - 1)];
  const mix = toAt === fromAt ? 0 : (t - fromAt) / (toAt - fromAt);
  const [r, g, b] = from.map((value, channel) => Math.round(value + (to[channel] - value) * mix));
  return `rgb(${r}, ${g}, ${b})`;
});

// Las estelas del chorro: de qué lado del haz van, su fase y su rapidez
const EXHAUST = Array.from({ length: 22 }, (_, index) => ({
  side: (seeded(index + 5101) - 0.5) * 2,
  phase: seeded(index + 5203),
  speed: 0.6 + seeded(index + 5309) * 0.8,
}));

/* ---------------- El cuadro ---------------- */

const NEAR = 0.03;

export const drawChase = (
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
  const { eye, forward, right, down } = cameraAt(p);
  const focal = CAMERA.focal * Math.min(width, height);
  const [shakeX, shakeY] = shakeAt(p);
  const cx = width / 2 + shakeX;
  const cy = height / 2 + shakeY;
  const appear = seg(p, [CHASE.arrive[0], CHASE.arrive[0] + 0.03]);

  context.globalCompositeOperation = 'lighter';
  context.lineCap = 'round';

  // El cielo. Cada estrella se ve desde la cámara, corrida por la aberración
  // hacia donde vamos; su estela es por dónde pasó hace un instante
  const travel = travelAt(p);
  const trail = Math.min(1.1, speedAt(p) * 0.0017);
  const beta = 0.985 * easeInOut(seg(p, CHASE.starbow)) * (1 - easeInOut(seg(p, CHASE.brake)));
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  const head = [0, 0];
  const tail = [0, 0];
  // Devuelve el factor Doppler, o 0 si la estrella queda detrás de la cámara
  const sky = (x: number, y: number, z: number, out: number[]) => {
    const cosine = z / Math.hypot(x, y, z);
    const seen = (cosine + beta) / (1 + beta * cosine);
    const sine = Math.sqrt(Math.max(0, 1 - seen * seen));
    const side = Math.hypot(x, y) || 1;
    const ox = (x / side) * sine;
    const oy = (y / side) * sine;
    const depth = ox * forward[0] + oy * forward[1] + seen * forward[2];
    if (depth < 0.06) return 0;
    let sx = (focal * (ox * right[0] + oy * right[1] + seen * right[2])) / depth;
    let sy = (focal * (ox * down[0] + oy * down[1] + seen * down[2])) / depth;
    // Con la ventana abierta el cielo se corre hacia afuera: el anillo la
    // rodea sin cruzarla
    if (opening > 0) {
      const radial = Math.hypot(sx, sy) || 1;
      const grow = (radial + opening) / radial;
      sx *= grow;
      sy *= grow;
    }
    out[0] = cx + sx;
    out[1] = cy + sy;
    return 1 / (gamma * (1 - beta * seen));
  };
  for (const star of SKY) {
    const lap = (((star.z - travel) % SKY_RANGE) + SKY_RANGE) % SKY_RANGE;
    const fade = smoothstep(0, 0.25, lap) * smoothstep(0, 0.25, SKY_RANGE - lap);
    if (fade <= 0) continue;
    const z = lap - SKY_BEHIND;
    const doppler = sky(star.x, star.y, z, head);
    if (!doppler) continue;
    // Solo el anillo intermedio cae en lo visible: lo de adelante se va al
    // ultravioleta y lo de atrás al infrarrojo
    const shift = Math.log(doppler);
    const alpha = appear * fade * Math.exp(-(shift * shift) / 0.9) * (0.35 + 0.65 * star.glow);
    if (alpha < 0.02) continue;
    const streak = trail > 0.002 && sky(star.x, star.y, z + trail, tail);
    const tone = Math.round(((Math.max(-1, Math.min(1, shift / 0.8)) + 1) / 2) * DOPPLER_STEPS);
    context.globalAlpha = Math.min(1, alpha);
    context.strokeStyle = DOPPLER[tone];
    context.lineWidth = 0.7 + star.glow * 1.1;
    context.beginPath();
    context.moveTo(streak ? tail[0] : head[0] - 0.01, streak ? tail[1] : head[1]);
    context.lineTo(head[0], head[1]);
    context.stroke();
  }
  context.globalAlpha = 1;

  // La nave
  const ahead = shipAhead(p);
  const shipAlpha = appear * (1 - seg(p, [CHASE.leap[1] - 0.012, CHASE.leap[1]]));
  const a = [0, 0, 0];
  const c = [0, 0, 0];
  const view = ([x, y, z]: Vec3, out: number[]) => {
    const vx = x - eye[0];
    const vy = y - eye[1];
    const vz = z + ahead - eye[2];
    out[0] = vx * right[0] + vy * right[1] + vz * right[2];
    out[1] = vx * down[0] + vy * down[1] + vz * down[2];
    out[2] = vx * forward[0] + vy * forward[1] + vz * forward[2];
  };
  const line = (path: Path2D, from: Vec3, to: Vec3) => {
    view(from, a);
    view(to, c);
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
  if (shipAlpha > 0.01) {
    const hull = new Path2D();
    const detail = new Path2D();
    SHIP.hull.forEach(([from, to]) => line(hull, from, to));
    SHIP.detail.forEach(([from, to]) => line(detail, from, to));
    context.strokeStyle = tint(0.05 * shipAlpha, 0.3);
    context.lineWidth = 5;
    context.stroke(hull);
    context.strokeStyle = tint(0.62 * shipAlpha, 0.55);
    context.lineWidth = 1;
    context.stroke(hull);
    context.strokeStyle = tint(0.26 * shipAlpha, 0.35);
    context.lineWidth = 0.7;
    context.stroke(detail);
  }

  // El motor: un destello al encender, el chorro y el núcleo, que es lo
  // último que vemos de la nave al saltar
  const thrust = ease(seg(p, CHASE.ignite));
  const flare = bump(seg(p, [0.08, 0.11]));
  const burning = Math.max(thrust, flare) * appear * (1 - seg(p, [CHASE.leap[1] - 0.004, CHASE.leap[1] + 0.008]));
  if (burning > 0) {
    // El chorro iónico: un haz fino y largo que sale de la tobera y se
    // apaga hacia la punta, con dos hilos más tenues que se le juntan. Tiembla
    // con el avance y se alarga al encender y al acelerar
    const flicker = 0.92 + 0.08 * Math.sin(p * 2300) * Math.sin(p * 1370 + 1.3);
    // Nace corto y se estira de a poco mientras el motor toma fuerza
    const reach = ease(seg(p, [CHASE.ignite[0], CHASE.ignite[0] + 0.09]));
    const plume = (0.15 + 1.25 * reach + 0.4 * seg(p, [0.14, 0.24])) * flicker;
    view([0, 0, -0.5], a);
    view([0, 0, -0.5 - plume], c);
    if (a[2] > NEAR) {
      // Si la punta queda detrás de la cámara, se corta en el plano cercano
      if (c[2] < NEAR) {
        const t = (NEAR - a[2]) / (c[2] - a[2]);
        c.splice(0, 3, a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, NEAR);
      }
      const nx = cx + (focal * a[0]) / a[2];
      const ny = cy + (focal * a[1]) / a[2];
      const mouth = Math.max(2, (focal * 0.066) / a[2]);
      // Hacia la cámara la perspectiva lo estiraría hasta el borde: se acota
      // a unas cuantas bocas de largo
      const rawX = cx + (focal * c[0]) / c[2] - nx;
      const rawY = cy + (focal * c[1]) / c[2] - ny;
      const raw = Math.hypot(rawX, rawY) || 1;
      const length = Math.min(raw, mouth * 15 * (0.12 + 0.88 * reach));
      const ux = rawX / raw;
      const uy = rawY / raw;
      const heat = burning * shipAlpha;
      const beam = (offset: number, reach: number, widthPx: number, alpha: number) => {
        const ex = nx + ux * length * reach;
        const ey = ny + uy * length * reach;
        const gradient = context.createLinearGradient(nx, ny, ex, ey);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${(alpha * heat).toFixed(3)})`);
        gradient.addColorStop(0.15, tint(0.9 * alpha * heat, 0.7));
        gradient.addColorStop(1, tint(0, 0.4));
        context.strokeStyle = gradient;
        context.lineWidth = widthPx;
        context.beginPath();
        context.moveTo(nx - uy * offset, ny + ux * offset);
        context.lineTo(ex - uy * offset * 0.3, ey + ux * offset * 0.3);
        context.stroke();
      };
      context.lineCap = 'round';
      // Cuerpo: un halo ancho y tenue detrás del haz le da grosor
      beam(0, 0.85, mouth * 1.8, 0.2);
      beam(0, 0.9, mouth * 0.9, 0.38);
      // Estelas: trazos finos alrededor del haz que corren hacia atrás con
      // el avance y se abren y apagan al alejarse de la tobera
      const flow = travelAt(p) * 0.35 + p * 40;
      for (const streak of EXHAUST) {
        const run = (streak.phase + flow * streak.speed) % 1;
        const from = run * 0.85;
        const to = Math.min(1, from + 0.12 + 0.18 * streak.speed);
        const spread = mouth * streak.side * (0.3 + 0.8 * run);
        const sx = nx + ux * length * from - uy * spread;
        const sy = ny + uy * length * from + ux * spread;
        const ex = nx + ux * length * to - uy * spread * 1.15;
        const ey = ny + uy * length * to + ux * spread * 1.15;
        context.strokeStyle = tint(0.7 * (1 - run) * heat, 0.65);
        context.lineWidth = 0.8 + (1 - run) * 1.2;
        context.beginPath();
        context.moveTo(sx, sy);
        context.lineTo(ex, ey);
        context.stroke();
      }
      beam(0, 1, Math.max(2.2, mouth * 0.32), 1);
      beam(mouth * 0.35, 0.7, 1, 0.5);
      beam(-mouth * 0.35, 0.7, 1, 0.5);
    }

    view([0, 0, -0.49], a);
    if (a[2] > NEAR) {
      const px = cx + (focal * a[0]) / a[2];
      const py = cy + (focal * a[1]) / a[2];
      // Un núcleo chico e intenso con un halo corto; de lejos sigue siendo
      // un punto que brilla
      const size = Math.max(1.4, (focal * 0.018) / a[2]) * (1 + 0.8 * flare);
      const core = context.createRadialGradient(px, py, 0, px, py, size * 4);
      core.addColorStop(0, `rgba(255, 255, 255, ${burning.toFixed(3)})`);
      core.addColorStop(0.2, `rgba(255, 255, 255, ${(0.85 * burning).toFixed(3)})`);
      core.addColorStop(0.42, tint(0.3 * burning, 0.55));
      core.addColorStop(1, tint(0, 0.3));
      context.fillStyle = core;
      context.beginPath();
      context.arc(px, py, size * 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  // Donde la nave se apaga, un destello: de ahí se abre la ventana
  const flash = bump(seg(p, [CHASE.leap[1] - 0.02, CHASE.open[0] + 0.045]));
  if (flash > 0) {
    const radius = Math.min(width, height) * (0.08 + 0.2 * flash);
    const burst = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, radius);
    burst.addColorStop(0, `rgba(255, 255, 255, ${(0.9 * flash).toFixed(3)})`);
    burst.addColorStop(0.25, tint(0.45 * flash, 0.5));
    burst.addColorStop(1, tint(0, 0.2));
    context.fillStyle = burst;
    context.beginPath();
    context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    context.fill();
  }

  // El borde de la ventana
  const ring = 1 - seg(p, [0.42, 0.52]);
  if (opening > 0.5 && ring > 0) {
    context.beginPath();
    context.arc(width / 2, height / 2, opening, 0, Math.PI * 2);
    context.strokeStyle = tint(0.14 * ring, 0.2);
    context.lineWidth = 10;
    context.stroke();
    context.strokeStyle = tint(0.85 * ring, 0.55);
    context.lineWidth = 1.2;
    context.stroke();
  }
  context.globalCompositeOperation = 'source-over';
};
