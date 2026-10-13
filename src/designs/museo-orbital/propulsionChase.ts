import { clamp01, smoothstep } from './roomShared';

/* Propulsión: una cámara de persecución sigue a la nave desde que enciende
   el motor hasta acercarse a la velocidad de la luz.

   La nave llega a la deriva desde atrás de la cámara, nos pasa por el lado
   y frena frente a nosotros; ahí enciende el motor (la cámara tiembla); la
   cámara la rodea, ladeándose en la curva, hasta quedar detrás, y las
   estrellas empiezan a pasar. Adelante crece un gigante gaseoso con
   anillos: la nave se lanza a rozarlo, pasa entre las nubes y los anillos
   con la cámara ladeada hasta que su borde queda como horizonte, y en lo
   más hondo enciende el motor a fondo (la honda gravitatoria). Al salir,
   una de sus lunas se nos viene encima: la nave la esquiva hacia el otro
   lado y la cámara se ladea de golpe al revés, como en un slalom. Cerca de la luz el cielo se aprieta hacia
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
  arrive: [0.02, 0.057],
  // Ya quieta, enciende el motor
  ignite: [0.057, 0.081],
  // La cámara la rodea hasta quedar detrás
  swing: [0.066, 0.13],
  // El gigante gaseoso: aparece adelante, crece y pasa rozándonos
  assist: [0.105, 0.2],
  // Cerca de la luz el cielo se aprieta en un anillo
  starbow: [0.205, 0.257],
  // La nave se adelanta hasta el punto de fuga y ahí se abre la ventana
  leap: [0.228, 0.265],
  open: [0.245, 0.31],
  // Al llegar frenamos y el anillo se suelta
  brake: [0.31, 0.5],
} satisfies Record<string, Range>;

const seg = (p: number, [from, to]: Range) => clamp01((p - from) / (to - from));
const ease = (t: number) => smoothstep(0, 1, t);
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
// El instante de la pasada más cercana al planeta, y a su luna
const PERIAPSIS = 0.16;
const MOON_PASS = 0.186;
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

/* El ladeo de la cámara: entra en la curva al rodear la nave y se endereza
   al quedar detrás; junto a la nave, un ladeo suave hacia ella. Y en medio,
   el tonel: la nave da una vuelta entera sobre su eje con la cámara amarrada
   a ella, así que en pantalla la nave sigue derecha y es el universo el que
   gira: el planeta pasa por encima y queda de suelo en lo más hondo */
export const chaseBank = (p: number) => cameraRoll(p) - 0.12 * alongside(p);
// El ladeo al rodear la nave: lo que la nave se inclina en pantalla
const swingLean = (p: number) => CAMERA.bank * bump(easeInOut(seg(p, CHASE.swing)));

/* Tramos lentos del portal (portalJourneys los usa tal cual): rodear la
   nave, la honda en el gigante gaseoso y el esquive de su luna (el tramo
   más largo), ir junto a la nave, acelerar y el salto. Cada uno crece
   `extra` svh sobre los 200 de recorrido normal */
export const CHASE_HOLDS: { range: Range; extra: number }[] = [
  { range: [0.03, 0.13], extra: 70 },
  // La luna tiene su propio tramo, más lento: se la ve venir de lejos
  { range: [0.13, 0.165], extra: 132 },
  { range: [0.165, 0.2], extra: 271 },
  { range: [0.2, 0.22], extra: 35 },
  { range: [0.22, 0.27], extra: 50 },
];
// Los svh de scroll recorridos hasta el instante p del guion
const scrolled = (p: number) => {
  let walked = 0;
  let time = 0;
  for (const { range: [from, to], extra } of CHASE_HOLDS) {
    if (p <= from) return walked + (p - time) * 200;
    walked += (from - time) * 200;
    const slow = (to - from) * 200 + extra;
    if (p <= to) return walked + ((p - from) / (to - from)) * slow;
    walked += slow;
    time = to;
  }
  return walked + (p - time) * 200;
};

/* El tonel, medido en scroll: mientras nos acercamos al planeta la cámara
   se ladea hacia él; al pasarlo, la honda nos lanza y el giro toma fuerza
   de a poco hasta completar la vuelta, y se asienta mientras la luna todavía
   es chica: así ella llega quieta en pantalla, sin cruzarse con la nave. La velocidad sube y baja
   siempre suave: se arma con su forma y se escala a la vuelta entera */
const ROLL: Range = [(CHASE.swing[0] + CHASE.swing[1]) / 2, 0.181];
const ROLL_FROM = scrolled(ROLL[0]);
const ROLL_LENGTH = scrolled(ROLL[1]) - ROLL_FROM;
const ROLL_PASS = scrolled(PERIAPSIS) - ROLL_FROM;
const rollPace = (x: number) =>
  smoothstep(0, 55, x)
  * (1 + 1.2 * smoothstep(ROLL_PASS - 10, ROLL_PASS + 50, x))
  * (1 - smoothstep(ROLL_LENGTH - 50, ROLL_LENGTH, x));
// Lo rodado, svh a svh
const ROLLED = (() => {
  const table = new Float32Array(Math.ceil(ROLL_LENGTH) + 2);
  for (let index = 1; index < table.length; index++) table[index] = table[index - 1] + rollPace(index - 0.5);
  return table.map((value) => value / table[table.length - 1]);
})();
/* La cámara no se endereza tras rodear la nave: guarda el ladeo y desde ahí
   sigue girando sin pausa hasta cerrar la vuelta. La nave sí se endereza por
   su cuenta, así que el tonel es lo que gira la cámara además de su ladeo */
function cameraRoll(p: number) {
  if (p < ROLL[0]) return swingLean(p);
  const x = Math.min(scrolled(p) - ROLL_FROM, ROLLED.length - 1.001);
  const index = Math.floor(x);
  const rolled = ROLLED[index] + (ROLLED[index + 1] - ROLLED[index]) * (x - index);
  return CAMERA.bank - (2 * Math.PI + CAMERA.bank) * rolled;
}
const barrelRoll = (p: number) => cameraRoll(p) - swingLean(p);

/* En formación: tras esquivar la luna la cámara se abre a la izquierda de
   la nave, un poco atrás, y vuela junto a ella mirando hacia delante, como
   un escolta; luego vuelve a quedar detrás para el salto */
const SIDE = {
  in: [0.19, 0.203] as Range,
  out: [0.211, 0.225] as Range,
  // A la izquierda y algo atrás de la nave, apenas más arriba
  yaw: -0.52,
  distance: 0.72,
  rise: 0.06,
  // Durante la toma la cámara le va ganando terreno, de a poco
  slide: [-0.1, 0.16] as Range,
  // Hacia dónde mira: un punto por delante de la proa
  aim: 0.35,
};
function alongside(p: number) {
  return easeInOut(seg(p, SIDE.in)) * (1 - easeInOut(seg(p, SIDE.out)));
}

// El esquive: la nave se corre a la derecha para dejar pasar la luna y la
// cámara la sigue con un instante de retraso
const shipSide = (p: number) => 0.3 * bump(easeInOut(seg(p, [0.172, 0.198])));
// Mientras pasamos junto al planeta y la luna, y vamos junto a la nave, se
// apagan las constelaciones de la página, que se dibujarían encima
export const chaseSkyHidden = (p: number) => smoothstep(0.13, 0.145, p) * (1 - smoothstep(0.222, 0.232, p));
const cameraSide = (p: number) => 0.22 * bump(easeInOut(seg(p, [0.175, 0.2])));

/* El lente: durante la honda la cámara juega con la distancia focal y con
   su distancia a la nave. Al acercarse al planeta, efecto vértigo: se aleja
   mientras cierra el zoom, la nave no cambia y el planeta se agiganta
   detrás. En lo más hondo, golpe a gran angular pegada a la nave. La luna
   se ve venir con teleobjetivo, comprimida tras la nave, y al pasar, otro
   golpe a gran angular. Cada clave: [progreso, zoom, distancia] */
const LENS: [number, number, number][] = [
  [0.125, 1, 1],
  [0.15, 1.75, 1.75],
  [0.158, 0.7, 0.85],
  [0.168, 0.95, 1],
  [0.178, 1.9, 2.2],
  [0.184, 0.68, 0.78],
  [0.196, 1, 1],
  // En formación, un poco más cerrado: la nave llena el costado del cuadro
  [0.206, 1.3, 1],
  [0.213, 1.3, 1],
  [0.224, 1, 1],
];
const lensAt = (p: number): [number, number] => {
  const next = LENS.findIndex(([at]) => at > p);
  if (next <= 0) return next === 0 ? [1, 1] : [LENS[LENS.length - 1][1], LENS[LENS.length - 1][2]];
  const [from, zoomA, distanceA] = LENS[next - 1];
  const [to, zoomB, distanceB] = LENS[next];
  const t = easeInOut((p - from) / (to - from));
  return [zoomA + (zoomB - zoomA) * t, distanceA + (distanceB - distanceA) * t];
};

const cameraAt = (p: number) => {
  const [, dolly] = lensAt(p);
  const align = easeInOut(seg(p, CHASE.swing));
  const side = alongside(p);
  const mix = (from: number, to: number) => from + (to - from) * side;
  const yaw = mix(CAMERA.yaw * (1 - align), SIDE.yaw);
  const rise = mix((CAMERA.rise[0] + (CAMERA.rise[1] - CAMERA.rise[0]) * align) * dolly, SIDE.rise);
  const distance = mix((CAMERA.distance[0] + (CAMERA.distance[1] - CAMERA.distance[0]) * align) * dolly, SIDE.distance);
  const slide = side * (SIDE.slide[0] + (SIDE.slide[1] - SIDE.slide[0]) * seg(p, [SIDE.in[0], SIDE.out[1]]));
  const eye: Vec3 = [distance * Math.sin(yaw) + cameraSide(p), -rise, -distance * Math.cos(yaw) + slide];
  // Al principio mira a la nave; ya detrás, mira hacia delante y la nave
  // queda bajo el punto de fuga. La mirada se suelta tarde: mientras la
  // rodea, la nave sigue al centro
  // Mientras la nave llega, la cámara la sigue con la mirada
  const look = normalize([-eye[0], -eye[1], 0.08 + 0.35 * Math.max(arrival(p), -1) - eye[2]]);
  const ahead = align * align;
  const behind = normalize([look[0] * (1 - ahead), look[1] * (1 - ahead), look[2] * (1 - ahead) + ahead]);
  // En formación mira hacia delante, apenas hacia la nave: la nave va al
  // costado del cuadro, con la proa hacia el punto de fuga
  const atShip = normalize([-eye[0], -eye[1], SIDE.aim - eye[2]]);
  // Al acercarnos al planeta la mirada se va apenas hacia él
  const gaze = 0.15 * bump(easeInOut(seg(p, [0.135, 0.166])));
  const toPlanet = normalize([PLANET.center[0], PLANET.center[1], 0]);
  // Y al pasar la luna, hacia ella: primero un lado y después el otro, en zigzag
  const glance = 0.3 * bump(easeInOut(seg(p, [0.172, 0.194])));
  const toMoon = normalize([MOON.center[0], MOON.center[1], 0]);
  const forward = normalize([
    behind[0] + (atShip[0] - behind[0]) * side + toPlanet[0] * gaze + toMoon[0] * glance,
    behind[1] + (atShip[1] - behind[1]) * side + toPlanet[1] * gaze + toMoon[1] * glance,
    behind[2] + (atShip[2] - behind[2]) * side,
  ]);
  const right = normalize(cross([0, 1, 0], forward));
  const down = cross(forward, right);
  const bank = chaseBank(p);
  const rolled = (angle: number) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      right: [right[0] * cos + down[0] * sin, right[1] * cos + down[1] * sin, right[2] * cos + down[2] * sin] as Vec3,
      down: [down[0] * cos - right[0] * sin, down[1] * cos - right[1] * sin, down[2] * cos - right[2] * sin] as Vec3,
    };
  };
  // La nave gira con la cámara en el tonel: para ella no cuenta
  const ship = rolled(bank - barrelRoll(p));
  return { eye, forward, ...rolled(bank), shipRight: ship.right, shipDown: ship.down };
};

// Cuánto se adelanta la nave a la cámara
const shipAhead = (p: number) =>
  arrival(p)
  // Al encender da un tirón y la cámara la alcanza
  + 0.22 * ease(seg(p, [0.06, 0.084])) * (1 - ease(seg(p, [0.084, 0.124])))
  // En lo más hondo de la pasada vuelve a dar un tirón
  + 0.4 * ease(seg(p, [PERIAPSIS - 0.006, PERIAPSIS + 0.006])) * (1 - ease(seg(p, [PERIAPSIS + 0.006, PERIAPSIS + 0.035])))
  // El salto: se aleja cada vez más rápido hacia el punto de fuga
  + CAMERA.distance[1] * (60 ** (seg(p, CHASE.leap) ** 2) - 1);

// Temblor de la cámara: el encendido y el rugido mientras acelera
const shakeAt = (p: number): [number, number] => {
  const amount = 7 * bump(seg(p, [0.057, 0.087]))
    // Las capas altas de la atmósfera sacuden la nave al rozar el planeta
    + 7 * bump(seg(p, [PERIAPSIS - 0.014, PERIAPSIS + 0.016]))
    // y la luna, al pasar a ras, da un golpe seco
    + 6 * bump(seg(p, [MOON_PASS - 0.005, MOON_PASS + 0.008]))
    + 2.2 * seg(p, [0.198, 0.23]) * (1 - seg(p, [0.23, 0.245]));
  return [
    amount * Math.sin(p * 1900) * Math.cos(p * 1130),
    amount * Math.cos(p * 1570) * Math.sin(p * 870),
  ];
};

/* ---------------- El cielo que pasa ---------------- */

// Velocidad por unidad de progreso: un arrastre suave al encender, luego
// acelera hasta el salto y frena al llegar
const speedAt = (p: number) => {
  const cruise = 22 * ease(seg(p, [0.06, 0.087]));
  // El planeta nos tira y en lo más hondo el motor empuja a fondo
  const fall = 60 * ease(seg(p, [0.13, PERIAPSIS])) + 110 * ease(seg(p, [PERIAPSIS - 0.004, PERIAPSIS + 0.01]));
  const burn = 520 * seg(p, [0.17, 0.27]) ** 2;
  return (cruise + fall + burn) * (1 - ease(seg(p, CHASE.brake)));
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

/* ---------------- El gigante gaseoso ---------------- */

// El planeta está puesto según el tonel: lo vemos asomar arriba y, al girar,
// pasa por encima hasta quedar bajo la nave justo en lo más hondo. Todo el
// sistema (posición, eje, anillos y luz) se gira junto alrededor de la ruta
// Ángulo en pantalla del planeta en lo más hondo: a la derecha y algo abajo,
// así se siente que lo pasamos por su izquierda
const PLANET_FLOOR = 0.15;
const PLANET_TURN = PLANET_FLOOR + barrelRoll(PERIAPSIS) - Math.atan2(25.2, 37.5);
const aroundRoute = ([x, y, z]: Vec3, angle = PLANET_TURN): Vec3 => [
  x * Math.cos(angle) - y * Math.sin(angle),
  x * Math.sin(angle) + y * Math.cos(angle),
  z,
];

// En largos de nave: el planeta es enorme y pasamos a unos pocos largos de
// sus nubes, entre el planeta y sus anillos
const PLANET = {
  radius: 40,
  center: aroundRoute([37.5, 25.2, 0]).slice(0, 2) as [number, number],
  // Rapidez al pasar (largos por unidad de progreso) y cuánto más rápido
  // parece llegar desde lejos: así crece de a poco y pasa de golpe
  speed: 6000,
  far: 7.2e6,
  appear: [0.1, 0.125] as Range,
};

// Eje del planeta: perpendicular a la dirección en que lo rozamos, así el
// plano de los anillos pasa justo por donde cruzamos, más adentro que ellos
const AXIS: Vec3 = aroundRoute(normalize([-0.554 * 0.9, 0.831 * 0.9, 0.44]));
const EQUATOR_A = normalize(cross(AXIS, [0, 0, 1]));
const EQUATOR_B = cross(AXIS, EQUATOR_A);
// De dónde viene la luz de la estrella: de arriba y de nuestro lado, así
// la cara que rozamos está de día y la sombra queda hacia abajo
const LIGHT: Vec3 = aroundRoute(normalize([-0.45, -0.85, 0.2]));

// Después de la pasada se aleja algo más despacio (la honda curva la
// trayectoria), pero pasa zumbando hacia atrás y sale de cuadro
// De lejos se ve bien corrido a un lado de la ruta, no en la punta de la nave,
// y al acercarse se va cerrando hasta rozarnos: la gravedad nos va curvando
// hacia él
const planetCenter = (p: number): Vec3 => {
  const s = PERIAPSIS - p;
  const aside = 1 + 2.2 * smoothstep(0, 0.035, s);
  return [
    PLANET.center[0] * aside,
    PLANET.center[1] * aside,
    PLANET.speed * s * (s < 0 ? 0.5 : 1) + PLANET.far * s ** 3,
  ];
};
const onPlanet = (center: Vec3, radius: number, latitude: number, longitude: number, lift = 0): Vec3 => {
  const ring = Math.cos(latitude) * radius;
  const up = Math.sin(latitude) * radius + lift;
  const cos = Math.cos(longitude);
  const sin = Math.sin(longitude);
  return [
    center[0] + ring * (cos * EQUATOR_A[0] + sin * EQUATOR_B[0]) + up * AXIS[0],
    center[1] + ring * (cos * EQUATOR_A[1] + sin * EQUATOR_B[1]) + up * AXIS[1],
    center[2] + ring * (cos * EQUATOR_A[2] + sin * EQUATOR_B[2]) + up * AXIS[2],
  ];
};

// Las bandas de nubes: paralelos más juntos cerca del ecuador, de brillo
// desparejo como las franjas de Júpiter
const BANDS = Array.from({ length: 19 }, (_, index) => {
  const t = (index + 0.5) / 19;
  return {
    latitude: Math.asin(2 * t - 1) * 0.94 + (seeded(index + 6101) - 0.5) * 0.05,
    glow: 0.35 + 0.65 * seeded(index + 6203),
    wave: seeded(index + 6307) * Math.PI * 2,
  };
});
// Los anillos (en radios del planeta), con la división oscura en medio
const RINGS = [1.34, 1.4, 1.47, 1.52, 1.58, 1.63, 1.69, 1.74, 1.8, 1.97, 2.03, 2.1, 2.15, 2.22].map((radius, index) => ({
  radius,
  glow: 0.3 + 0.7 * seeded(index + 6401),
}));
// Polvo de un anillo tenue, más adentro, que pasa rozando la cámara
const DUST = Array.from({ length: 520 }, (_, index) => ({
  radius: 1.1 + 0.2 * seeded(index + 6503),
  angle: (seeded(index + 6607) - 0.5) * 1.1,
  lift: (seeded(index + 6709) - 0.5) * 1.6,
  glow: seeded(index + 6811),
}));

interface View { eye: Vec3; forward: Vec3; right: Vec3; down: Vec3 }
type Tint = (alpha: number, white: number) => string;

/* Una esfera vista desde la cámara: proyecta tramos cortándolos en el plano
   cercano, sabe qué cara nos mira y qué tapa, y dibuja su disco (relleno de
   oscuro para tapar el cielo de atrás) con el borde encendido del lado de
   la luz */
const sphereView = (
  { eye, forward, right, down }: View,
  focal: number,
  cx: number,
  cy: number,
  center: Vec3,
  R: number,
  light: Vec3,
) => {
  const near = 0.2;
  const toView = ([x, y, z]: Vec3, out: number[]) => {
    const vx = x - eye[0];
    const vy = y - eye[1];
    const vz = z - eye[2];
    out[0] = vx * right[0] + vy * right[1] + vz * right[2];
    out[1] = vx * down[0] + vy * down[1] + vz * down[2];
    out[2] = vx * forward[0] + vy * forward[1] + vz * forward[2];
  };
  const a = [0, 0, 0];
  const c = [0, 0, 0];
  // Un tramo en 3D, cortado en el plano cercano
  const segment = (path: Path2D, from: Vec3, to: Vec3) => {
    toView(from, a);
    toView(to, c);
    if (a[2] < near && c[2] < near) return;
    if (a[2] < near || c[2] < near) {
      const t = (near - a[2]) / (c[2] - a[2]);
      const clipped = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, near];
      if (a[2] < near) a.splice(0, 3, ...clipped);
      else c.splice(0, 3, ...clipped);
    }
    path.moveTo(cx + (focal * a[0]) / a[2], cy + (focal * a[1]) / a[2]);
    path.lineTo(cx + (focal * c[0]) / c[2], cy + (focal * c[1]) / c[2]);
  };
  const toEye: Vec3 = [eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]];
  const distance = Math.hypot(...toEye);
  // Si un punto queda tapado por la esfera: el rayo hacia él la cruza antes
  const hidden = ([x, y, z]: Vec3) => {
    const dx = x - eye[0];
    const dy = y - eye[1];
    const dz = z - eye[2];
    const dd = dx * dx + dy * dy + dz * dz;
    const b = toEye[0] * dx + toEye[1] * dy + toEye[2] * dz;
    const disc = b * b - dd * (distance * distance - R * R);
    if (disc <= 0) return false;
    const t = (-b - Math.sqrt(disc)) / dd;
    return t > 0 && t < 0.999;
  };
  // Si un punto de la superficie mira a la cámara
  const facing = (point: Vec3) =>
    (point[0] - center[0]) * (eye[0] - point[0]) +
      (point[1] - center[1]) * (eye[1] - point[1]) +
      (point[2] - center[2]) * (eye[2] - point[2]) > 0;
  const lit = (point: Vec3) =>
    ((point[0] - center[0]) * light[0] + (point[1] - center[1]) * light[1] + (point[2] - center[2]) * light[2]) / R;

  const drawDisc = (context: CanvasRenderingContext2D, appear: number, tint: Tint, haze: number) => {
    // El círculo del horizonte visto desde la cámara
    const horizon = R * Math.sqrt(Math.max(0, 1 - (R / distance) ** 2));
    const toward: Vec3 = [toEye[0] / distance, toEye[1] / distance, toEye[2] / distance];
    const hub: Vec3 = [
      center[0] + (toward[0] * R * R) / distance,
      center[1] + (toward[1] * R * R) / distance,
      center[2] + (toward[2] * R * R) / distance,
    ];
    const u = normalize(cross(toward, Math.abs(toward[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    const w = cross(toward, u);
    const LIMB = 160;
    const rim = Array.from({ length: LIMB }, (_, step) => {
      const angle = (step / LIMB) * Math.PI * 2;
      const cos = Math.cos(angle) * horizon;
      const sin = Math.sin(angle) * horizon;
      const point: Vec3 = [hub[0] + cos * u[0] + sin * w[0], hub[1] + cos * u[1] + sin * w[1], hub[2] + cos * u[2] + sin * w[2]];
      const at = [0, 0, 0];
      toView(point, at);
      return { at, light: lit(point) };
    });
    // Recorte del polígono del horizonte contra el plano cercano
    const disc: number[][] = [];
    rim.forEach(({ at }, index) => {
      const next = rim[(index + 1) % LIMB].at;
      if (at[2] >= near) disc.push(at);
      if ((at[2] >= near) !== (next[2] >= near)) {
        const t = (near - at[2]) / (next[2] - at[2]);
        disc.push([at[0] + (next[0] - at[0]) * t, at[1] + (next[1] - at[1]) * t, near]);
      }
    });
    if (disc.length > 2) {
      const shape = new Path2D();
      disc.forEach(([x, y, z], index) => {
        const sx = cx + (focal * x) / z;
        const sy = cy + (focal * y) / z;
        if (index) shape.lineTo(sx, sy);
        else shape.moveTo(sx, sy);
      });
      shape.closePath();
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = `rgba(4, 6, 12, ${(0.96 * appear).toFixed(3)})`;
      context.fill(shape);
      context.globalCompositeOperation = 'lighter';
    }
    // El borde: un halo del lado iluminado
    const glowLimb = new Path2D();
    const faintLimb = new Path2D();
    rim.forEach(({ at, light: shade }, index) => {
      const next = rim[(index + 1) % LIMB].at;
      if (at[2] < near || next[2] < near) return;
      const path = shade > -0.1 ? glowLimb : faintLimb;
      path.moveTo(cx + (focal * at[0]) / at[2], cy + (focal * at[1]) / at[2]);
      path.lineTo(cx + (focal * next[0]) / next[2], cy + (focal * next[1]) / next[2]);
    });
    if (haze > 0) {
      context.strokeStyle = tint(0.12 * haze * appear, 0.4);
      context.lineWidth = 9;
      context.stroke(glowLimb);
    }
    context.strokeStyle = tint(0.85 * appear, 0.65);
    context.lineWidth = 1.4;
    context.stroke(glowLimb);
    context.strokeStyle = tint(0.22 * appear, 0.3);
    context.lineWidth = 1;
    context.stroke(faintLimb);
  };

  return { segment, hidden, facing, lit, toEye, drawDisc };
};

const drawPlanet = (context: CanvasRenderingContext2D, p: number, view: View, focal: number, cx: number, cy: number, tint: Tint) => {
  const appear = seg(p, PLANET.appear) * (1 - seg(p, [0.18, 0.195]));
  if (appear <= 0) return;
  const center = planetCenter(p);
  const R = PLANET.radius;
  const { segment, hidden, facing, lit, toEye, drawDisc } = sphereView(view, focal, cx, cy, center, R, LIGHT);
  drawDisc(context, appear, tint, 1);

  // Las bandas de nubes, solo en la cara que nos mira y más brillantes donde
  // les da la luz. Se agrupan por brillo para trazarlas de una vez
  const SHADES = 5;
  const bands = Array.from({ length: SHADES }, () => new Path2D());
  const STEPS = 120;
  const spin = p * 9;
  for (const band of BANDS) {
    let previous: Vec3 | null = null;
    for (let step = 0; step <= STEPS; step++) {
      const longitude = (step / STEPS) * Math.PI * 2 + spin;
      // Las franjas ondulan un poco, como corrientes
      const latitude = band.latitude + 0.012 * Math.sin(longitude * 5 + band.wave);
      const point = onPlanet(center, R, latitude, longitude);
      if (!facing(point)) {
        previous = null;
        continue;
      }
      if (previous) {
        const light = Math.max(0, lit(point) * 0.7 + 0.3) * band.glow;
        if (light > 0.04) segment(bands[Math.min(SHADES - 1, Math.floor(light * SHADES))], previous, point);
      }
      previous = point;
    }
  }
  context.lineWidth = 1;
  bands.forEach((path, shade) => {
    context.strokeStyle = tint((0.1 + 0.75 * ((shade + 0.5) / SHADES)) * appear, 0.5);
    context.stroke(path);
  });

  // Los anillos, cortados donde pasan detrás del planeta
  const ringPaths = Array.from({ length: 3 }, () => new Path2D());
  const RING_STEPS = 180;
  for (const ring of RINGS) {
    const path = ringPaths[Math.min(2, Math.floor(ring.glow * 3))];
    let previous: Vec3 | null = null;
    for (let step = 0; step <= RING_STEPS; step++) {
      const point = onPlanet(center, ring.radius * R, 0, (step / RING_STEPS) * Math.PI * 2);
      if (hidden(point)) {
        previous = null;
        continue;
      }
      if (previous) segment(path, previous, point);
      previous = point;
    }
  }
  ringPaths.forEach((path, index) => {
    context.strokeStyle = tint((0.12 + 0.18 * index) * appear, 0.55);
    context.lineWidth = 1;
    context.stroke(path);
  });

  // El polvo: granos que pasan como estelas junto a la cámara
  const close = bump(seg(p, [PERIAPSIS - 0.02, PERIAPSIS + 0.02]));
  if (close > 0) {
    const before = planetCenter(p - 0.0005);
    // Dónde está la cámara alrededor del planeta
    const home = Math.atan2(
      toEye[0] * EQUATOR_B[0] + toEye[1] * EQUATOR_B[1] + toEye[2] * EQUATOR_B[2],
      toEye[0] * EQUATOR_A[0] + toEye[1] * EQUATOR_A[1] + toEye[2] * EQUATOR_A[2],
    );
    const dust = new Path2D();
    const bright = new Path2D();
    for (const grain of DUST) {
      const longitude = home + grain.angle;
      const now = onPlanet(center, grain.radius * R, 0, longitude, grain.lift);
      const then = onPlanet(before, grain.radius * R, 0, longitude, grain.lift);
      segment(grain.glow > 0.8 ? bright : dust, then, now);
    }
    context.strokeStyle = tint(0.35 * close * appear, 0.6);
    context.lineWidth = 0.8;
    context.stroke(dust);
    context.strokeStyle = tint(0.75 * close * appear, 0.8);
    context.lineWidth = 1.3;
    context.stroke(bright);
  }
};

/* ---------------- La luna ---------------- */

// Al salir de la honda, una luna del gigante se nos viene encima por arriba
// a la izquierda: la nave la esquiva hacia el otro lado y pasa a ras de sus
// cráteres, entre las rocas que la rodean
const MOON = {
  radius: 5,
  // A la izquierda y abajo en pantalla al pasarla (según el tonel en ese
  // momento): la pasamos por su derecha y un poco por encima
  center: aroundRoute([-5.3, 3.4, 0], barrelRoll(MOON_PASS)).slice(0, 2) as [number, number],
  speed: 4200,
  far: 2.2e7,
  appear: [0.158, 0.168] as Range,
};
// Como el planeta: de lejos viene corrida a su lado y se va cerrando
const moonCenter = (p: number): Vec3 => {
  const s = MOON_PASS - p;
  const aside = 1 + 1.6 * smoothstep(0, 0.02, s);
  return [MOON.center[0] * aside, MOON.center[1] * aside, MOON.speed * s + MOON.far * s ** 3];
};
// La luz le llega de nuestro lado: vemos su cara de día y la sombra al fondo
const MOON_LIGHT: Vec3 = aroundRoute(normalize([0.55, 0.15, -0.8]), barrelRoll(MOON_PASS));
// Cráteres: dirección sobre la luna, tamaño y si tienen un pico central
const CRATERS = Array.from({ length: 90 }, (_, index) => {
  const z = seeded(index + 7101) * 2 - 1;
  const angle = seeded(index + 7203) * Math.PI * 2;
  const ring = Math.sqrt(1 - z * z);
  return {
    normal: [ring * Math.cos(angle), ring * Math.sin(angle), z] as Vec3,
    size: 0.05 + 0.3 * seeded(index + 7307) ** 2,
  };
});
// Rocas sueltas alrededor de la luna, que pasan como estelas
const ROCKS = Array.from({ length: 70 }, (_, index) => {
  const z = seeded(index + 7401) * 2 - 1;
  const angle = seeded(index + 7503) * Math.PI * 2;
  const ring = Math.sqrt(1 - z * z);
  const reach = 1.15 + 0.9 * seeded(index + 7607);
  return { at: [ring * Math.cos(angle) * reach, ring * Math.sin(angle) * reach, z * reach] as Vec3, glow: seeded(index + 7709) };
});

const drawMoon = (context: CanvasRenderingContext2D, p: number, view: View, focal: number, cx: number, cy: number, tint: Tint) => {
  const appear = seg(p, MOON.appear) * (1 - seg(p, [MOON_PASS + 0.012, MOON_PASS + 0.02]));
  if (appear <= 0) return;
  const center = moonCenter(p);
  const R = MOON.radius;
  const { segment, facing, lit, drawDisc } = sphereView(view, focal, cx, cy, center, R, MOON_LIGHT);
  drawDisc(context, appear, tint, 0.6);

  // Los cráteres: círculos sobre la superficie, del lado que nos mira
  const SHADES = 4;
  const rims = Array.from({ length: SHADES }, () => new Path2D());
  const STEPS = 22;
  for (const crater of CRATERS) {
    const n = crater.normal;
    const u = normalize(cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    const w = cross(n, u);
    const lift = Math.sqrt(1 - crater.size * crater.size);
    let previous: Vec3 | null = null;
    for (let step = 0; step <= STEPS; step++) {
      const angle = (step / STEPS) * Math.PI * 2;
      const cos = Math.cos(angle) * crater.size;
      const sin = Math.sin(angle) * crater.size;
      const point: Vec3 = [
        center[0] + R * (n[0] * lift + u[0] * cos + w[0] * sin),
        center[1] + R * (n[1] * lift + u[1] * cos + w[1] * sin),
        center[2] + R * (n[2] * lift + u[2] * cos + w[2] * sin),
      ];
      if (!facing(point)) {
        previous = null;
        continue;
      }
      const light = Math.max(0, lit(point) * 0.75 + 0.25);
      if (previous && light > 0.05) segment(rims[Math.min(SHADES - 1, Math.floor(light * SHADES))], previous, point);
      previous = point;
    }
  }
  context.lineWidth = 1;
  rims.forEach((path, shade) => {
    context.strokeStyle = tint((0.15 + 0.85 * ((shade + 0.5) / SHADES)) * appear, 0.55);
    context.stroke(path);
  });

  // Las rocas: estelas cortas de por dónde pasaron hace un instante
  const before = moonCenter(p - 0.00035);
  const rocks = new Path2D();
  const bright = new Path2D();
  for (const rock of ROCKS) {
    const now: Vec3 = [center[0] + rock.at[0] * R, center[1] + rock.at[1] * R, center[2] + rock.at[2] * R];
    const then: Vec3 = [before[0] + rock.at[0] * R, before[1] + rock.at[1] * R, before[2] + rock.at[2] * R];
    segment(rock.glow > 0.75 ? bright : rocks, then, now);
  }
  context.strokeStyle = tint(0.4 * appear, 0.6);
  context.lineWidth = 1;
  context.stroke(rocks);
  context.strokeStyle = tint(0.8 * appear, 0.8);
  context.lineWidth = 1.6;
  context.stroke(bright);
};

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
  const { eye, forward, right, down, shipRight, shipDown } = cameraAt(p);
  const focal = CAMERA.focal * lensAt(p)[0] * Math.min(width, height);
  const [shakeX, shakeY] = shakeAt(p);
  const cx = width / 2 + shakeX;
  const cy = height / 2 + shakeY;
  const appear = seg(p, [CHASE.arrive[0], CHASE.arrive[0] + 0.02]);

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

  drawPlanet(context, p, { eye, forward, right, down }, focal, cx, cy, tint);
  drawMoon(context, p, { eye, forward, right, down }, focal, cx, cy, tint);

  // La nave
  const ahead = shipAhead(p);
  const side = shipSide(p);
  const shipAlpha = appear * (1 - seg(p, [CHASE.leap[1] - 0.012, CHASE.leap[1]]));
  const a = [0, 0, 0];
  const c = [0, 0, 0];
  const view = ([x, y, z]: Vec3, out: number[]) => {
    const vx = x + side - eye[0];
    const vy = y - eye[1];
    const vz = z + ahead - eye[2];
    out[0] = vx * shipRight[0] + vy * shipRight[1] + vz * shipRight[2];
    out[1] = vx * shipDown[0] + vy * shipDown[1] + vz * shipDown[2];
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
  // Y el empujón a fondo en lo más hondo de la pasada
  const oberth = bump(seg(p, [PERIAPSIS - 0.008, PERIAPSIS + 0.018]));
  const flare = Math.max(bump(seg(p, [0.057, 0.078])), oberth);
  const burning = Math.max(thrust, flare) * appear * (1 - seg(p, [CHASE.leap[1] - 0.004, CHASE.leap[1] + 0.008]));
  if (burning > 0) {
    // El chorro iónico: un haz fino y largo que sale de la tobera y se
    // apaga hacia la punta, con dos hilos más tenues que se le juntan. Tiembla
    // con el avance y se alarga al encender y al acelerar
    const flicker = 0.92 + 0.08 * Math.sin(p * 2300) * Math.sin(p * 1370 + 1.3);
    // Nace corto y se estira de a poco mientras el motor toma fuerza
    const reach = ease(seg(p, [CHASE.ignite[0], CHASE.ignite[0] + 0.055]));
    const plume = (0.15 + 1.25 * reach + 0.4 * seg(p, [0.195, 0.24]) + 0.9 * oberth) * flicker;
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
      const length = Math.min(raw, mouth * 15 * (0.12 + 0.88 * reach) * (1 + 0.6 * oberth));
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
