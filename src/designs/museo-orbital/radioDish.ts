import { lookRolled, lookTurn } from './lookAround';

/* Radiotelescopio: la entrada del capítulo 9 en primera persona. Miramos
   la Vía Láctea y bajamos la vista a un observatorio: llegamos a ras de
   suelo por unos rieles que vienen de un costado, con el arreglo de perfil,
   y la vía dobla, ladeándonos, hasta enfilar uno de sus brazos: un pasillo
   entre dos filas de antenas
   iguales que nos miran. Al fondo, la antena principal alza la vista
   primero y la ola rueda por el pasillo hacia nosotros: una tras otra, las
   antenas giran por encima del cénit hasta apuntar todas al mismo punto
   del cielo. Pasamos bajo la principal, la vemos a contraluz contra la
   galaxia y quedamos tras su plato,
   mirando a través de él; sus anillos se ven concéntricos y su borde se
   vuelve el radar */

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const seg = (p: number, [from, to]: [number, number]) => clamp01((p - from) / (to - from));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const seeded = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
// Normal aproximada (suma de uniformes): para el ancho de la Vía Láctea
const gauss = (seed: number) => (seeded(seed) + seeded(seed + 1) + seeded(seed + 2) - 1.5) * 1.15;

export const DISH = {
  // Miramos la Vía Láctea y bajamos la vista a los rieles
  look: [0.026, 0.042],
  // Avanzamos por los rieles: la curva y el pasillo hasta el pie de la
  // antena principal
  dolly: [0.022, 0.084],
  // La principal alza la vista primero, mientras doblamos
  slew: [0.04, 0.051],
  // Y la ola rueda por el brazo hacia nosotros
  wave: [0.045, 0.058],
  // Pasamos bajo ella y alzamos la vista hasta quedar tras su plato
  fly: [0.062, 0.088],
  // El plato se apaga y su borde se vuelve el radar
  handoff: [0.078, 0.095],
} satisfies Record<string, [number, number]>;

type Vec = [number, number, number];
type Point = [number, number];
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Vec): Vec => scale(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const lerp = (a: Vec, b: Vec, t: number): Vec => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const length = (a: Vec) => Math.hypot(a[0], a[1], a[2]);
const UP: Vec = [0, 1, 0];

/* Todas las antenas miran igual: hacia nosotros pero de tres cuartos (de
   frente serían discos planos y sus monturas, rayas), y giran por encima del
   cénit, de mirar 14° sobre el horizonte a 130° (50° hacia el otro lado) */
const AZIMUTH = (215 * Math.PI) / 180;
const HEADING: Vec = [Math.sin(AZIMUTH), 0, Math.cos(AZIMUTH)];
const AXLE: Vec = [Math.cos(AZIMUTH), 0, -Math.sin(AZIMUTH)];
const facing = (elevation: number): Vec => {
  const e = (elevation * Math.PI) / 180;
  return add(scale(HEADING, Math.cos(e)), [0, Math.sin(e), 0]);
};
// Gira una dirección en torno a la vertical (suma al azimut)
const yawed = ([x, y, z]: Vec, angle: number): Vec => [
  x * Math.cos(angle) + z * Math.sin(angle),
  y,
  -x * Math.sin(angle) + z * Math.cos(angle),
];
const REST = 14;
const PARK = 130;
const AIM = facing(PARK);
const elevationAt = (p: number, [from, to]: [number, number]) => mix(REST, PARK, easeInOut(seg(p, [from, to])));

// La antena principal: eje de elevación sobre la montura, plato profundo;
// es la gigante del arreglo
const MAIN = 1.3;
const RIM = 1.6;
const FOCAL = 0.85;
const DEPTH = (r: number) => (r * r) / (4 * FOCAL);
const AXIS: Vec = [0, 2.4, 0];
const VERTEX_OFFSET = 0.25;

/* El arreglo: el brazo por el que vamos, con una fila a cada lado de los
   rieles, y los otros dos brazos de la Y, que se abren tras la principal.
   La ola parte en la principal y se reparte por los tres brazos */
const SMALL = 0.62;
const ROW_X = 3.5;
const START_Z = -44;
const SLEW_SPAN = 0.011;
const waveAt = (z: number) => mix(DISH.wave[0], DISH.wave[1], seg(z, [0, START_Z]));
const ARM_Z = Array.from({ length: 8 }, (_, k) => -6.5 - 4.8 * k);
const BRANCH = [-1, 1].map((side): Vec => [side * Math.sin(Math.PI / 3), 0, Math.cos(Math.PI / 3)]);
const STATIONS = [
  ...ARM_Z.flatMap((z) => [-1, 1].map((side) => ({ at: [side * ROW_X, 0, z] as Vec, start: waveAt(z) }))),
  ...BRANCH.flatMap((direction) =>
    [8, 13.5, 19.5, 26, 33, 41].map((reach) => ({
      at: scale(direction, reach),
      start: DISH.wave[0] + 0.0004 * reach,
    })),
  ),
];

/* El suelo: los rieles de los tres brazos, con sus durmientes, y un desvío
   corto hasta cada antena del nuestro. Va en tramos cortos para que se
   apaguen con la distancia */
const GAUGE = 0.3;
/* La curva por la que llegamos al brazo: un arco que termina en la entrada
   del pasillo mirando hacia la principal. La cámara va un poco a la
   izquierda de los rieles, como en el pasillo */
const START_X = -0.9;
const CURVE_RADIUS = 14;
const CURVE_ANGLE = (100 * Math.PI) / 180;
const curvePoint = (angle: number, offset: number, y: number): Vec => [
  offset + CURVE_RADIUS * (1 - Math.cos(angle)),
  y,
  START_Z - CURVE_RADIUS * Math.sin(angle),
];
// Hacia dónde avanzamos en un punto del arco (el ángulo baja hasta 0)
const curveHeading = (angle: number): Vec => [-Math.sin(angle), 0, Math.cos(angle)];
// El riel circular sobre el que gira la principal: pasa bajo sus cuatro pies
const TURNTABLE = 1.7;
const GROUND: [Vec, Vec][] = (() => {
  const lines: [Vec, Vec][] = [];
  const track = (from: Vec, to: Vec, sleepers: boolean, gauge = GAUGE) => {
    const along = sub(to, from);
    const span = length(along);
    const direction = scale(along, 1 / span);
    const across = scale(unit(cross(UP, direction)), gauge);
    const chunks = Math.ceil(span / 3);
    for (let chunk = 0; chunk < chunks; chunk++) {
      const a = add(from, scale(along, chunk / chunks));
      const b = add(from, scale(along, (chunk + 1) / chunks));
      lines.push([add(a, across), add(b, across)]);
      if (gauge) lines.push([sub(a, across), sub(b, across)]);
    }
    if (!sleepers) return;
    for (let step = 0.6; step < span; step += 1.1) {
      const at = add(from, scale(direction, step));
      lines.push([add(at, scale(across, 1.7)), sub(at, scale(across, 1.7))]);
    }
  };
  // La curva y la recta por la que llega
  const steps = 24;
  for (let step = 0; step < steps; step++) {
    track(
      curvePoint((CURVE_ANGLE * (step + 1)) / steps, 0, 0),
      curvePoint((CURVE_ANGLE * step) / steps, 0, 0),
      true,
    );
  }
  const entry = curvePoint(CURVE_ANGLE, 0, 0);
  track(sub(entry, scale(curveHeading(CURVE_ANGLE), 45)), entry, true);
  const turntable = TURNTABLE * MAIN;
  track([0, 0, -80], [0, 0, -turntable], true);
  BRANCH.forEach((direction) => track(scale(direction, turntable), scale(direction, 50), true));
  ARM_Z.forEach((z) =>
    [-1, 1].forEach((side) => track([side * GAUGE, 0, z], [side * (ROW_X - 0.45), 0, z], false, 0)),
  );
  for (let step = 0; step < 40; step++) {
    const a = (step / 40) * Math.PI * 2;
    const b = ((step + 1) / 40) * Math.PI * 2;
    lines.push([
      [Math.cos(a) * turntable, 0, Math.sin(a) * turntable],
      [Math.cos(b) * turntable, 0, Math.sin(b) * turntable],
    ]);
  }
  return lines;
})();

/* El cielo: estrellas y la Vía Láctea en direcciones fijas, para que se
   muevan con la cámara al bajar y subir la vista */
const SKY_STARS = Array.from({ length: 800 }, (_, index) => {
  const y = 0.02 + seeded(index + 6101) * 0.98;
  const angle = seeded(index + 6203) * Math.PI * 2;
  const side = Math.sqrt(1 - y * y);
  return {
    direction: [side * Math.sin(angle), y, side * Math.cos(angle)] as Vec,
    level: Math.min(2, Math.floor(seeded(index + 6307) ** 2.2 * 3)),
    big: seeded(index + 6409) > 0.86,
  };
});
// La banda cruza en diagonal el cielo hacia donde apuntan las antenas: al
// final se ve a través del plato
const SKY_TURN = AZIMUTH - Math.PI;
const BAND_CENTER = yawed(unit([-1, 6.5, 8.2]), SKY_TURN);
const BAND_POLE = unit(cross(BAND_CENTER, yawed(unit([-6, 9, 2]), SKY_TURN)));
const BAND_SIDE = cross(BAND_POLE, BAND_CENTER);
const bandDirection = (longitude: number, latitude: number): Vec =>
  add(
    scale(add(scale(BAND_CENTER, Math.cos(longitude)), scale(BAND_SIDE, Math.sin(longitude))), Math.cos(latitude)),
    scale(BAND_POLE, Math.sin(latitude)),
  );
const bulge = (longitude: number) => Math.exp(-((Math.atan2(Math.sin(longitude), Math.cos(longitude)) / 0.55) ** 2));
const BAND_DUST = Array.from({ length: 1700 }, (_, index) => {
  const longitude = seeded(index + 7101) * Math.PI * 2;
  const near = bulge(longitude);
  return {
    direction: bandDirection(longitude, gauss(index * 3 + 7203) * (0.09 + 0.08 * near)),
    level: Math.min(2, Math.floor((seeded(index + 7307) * (0.6 + 0.8 * near)) * 2.4)),
  };
});
// Cerros lejanos alrededor: alturas de unas pocas ondas suaves
const ridgeHeight = (angle: number) =>
  7 + 4 * Math.sin(angle * 3 + 1.2) + 2.6 * Math.sin(angle * 7 + 0.4) + 1.1 * Math.sin(angle * 17 + 2.1);
const RIDGE_DISTANCE = 160;

/* La cámara: a la altura de los ojos sobre los rieles, un poco corrida a
   la izquierda para que las filas no queden en espejo; termina centrada */
const EYE = 0.8;
const START: Vec = [START_X, EYE, START_Z];
const SKY_GAZE = yawed(unit([0.3, 1.7, 1]), SKY_TURN * 0.6);
// Mirando por el pasillo, un poco hacia arriba: el horizonte queda bajo y
// manda el cielo
const PITCH = (10 * Math.PI) / 180;
const MAIN_TARGET: Vec = [0, AXIS[1] * MAIN + 0.3, 0];
const BANK = 5;
// Ladeo al doblar: nos inclinamos hacia el lado de la curva
const CURVE_BANK = 9;
/* Qué parte del viaje es curva: la que le toca por largo frente al pasillo,
   para que la velocidad no salte al pasar de una a otro. LEAD es el primer
   punto de control del pasillo, que mantiene esa velocidad al salir */
const CORRIDOR_LENGTH = 42;
const CURVE_SHARE = (CURVE_RADIUS * CURVE_ANGLE) / (CURVE_RADIUS * CURVE_ANGLE + CORRIDOR_LENGTH);
const LEAD = CORRIDOR_LENGTH / 3;
const travelAt = (p: number) => easeInOut(seg(p, DISH.dolly));
const bezier = (a: Vec, b: Vec, c: Vec, d: Vec, t: number): Vec => {
  const s = 1 - t;
  return add(add(scale(a, s * s * s), scale(b, 3 * s * s * t)), add(scale(c, 3 * s * t * t), scale(d, t * t * t)));
};

/* La cámara del viaje. `rimRadius` es el radio en pantalla que debe tener
   el borde del plato al final: el del radar */
const dishCamera = (p: number, focal: number, rimRadius: number) => {
  const vertex = add(scale(AXIS, MAIN), scale(AIM, VERTEX_OFFSET * MAIN));
  // Tras el plato, a la distancia en que su borde mide lo mismo que el radar
  const back = (focal * RIM * MAIN) / Math.max(rimRadius, 1) - DEPTH(RIM) * MAIN;
  const end = sub(vertex, scale(AIM, back));
  const travel = travelAt(p);
  // Primero el arco y luego el pasillo, que sale a la misma velocidad
  const bend = Math.min(1, travel / CURVE_SHARE);
  const angle = CURVE_ANGLE * (1 - bend);
  const position =
    travel < CURVE_SHARE
      ? curvePoint(angle, START_X, EYE)
      : bezier(START, add(START, [0, 0, LEAD]), [0, EYE * 0.9, -10], end, (travel - CURVE_SHARE) / (1 - CURVE_SHARE));
  // La mirada: del cielo a la vía, un poco hacia dentro de la curva; al
  // enfilar el pasillo, hacia la principal (nunca más bajo que el cabeceo
  // fijo), que al acercarnos sube sola por la antena; al final, hacia donde
  // apunta la antena
  const pitched = ([x, , z]: Vec, pitch: number): Vec => {
    const flat = Math.hypot(x, z) || 1;
    return [(x / flat) * Math.cos(pitch), Math.sin(pitch), (z / flat) * Math.cos(pitch)];
  };
  const track = pitched(curveHeading(Math.max(0, angle - 0.35)), PITCH);
  const toMain = sub(MAIN_TARGET, position);
  const corridor = pitched(toMain, Math.max(PITCH, Math.atan2(toMain[1], Math.hypot(toMain[0], toMain[2]))));
  const ahead = unit(lerp(track, corridor, easeInOut(seg(travel, [CURVE_SHARE * 0.6, CURVE_SHARE * 1.15]))));
  const look = easeInOut(seg(p, DISH.look));
  const along = easeInOut(seg(p, [mix(DISH.fly[0], DISH.fly[1], 0.35), DISH.fly[1]]));
  const forward = unit(lerp(lerp(SKY_GAZE, ahead, look), AIM, along));
  return { position, forward, roll: dishRoll(p), vertex };
};

export const dishRoll = (p: number) => {
  const travel = travelAt(p);
  const curve = CURVE_BANK * Math.sin(Math.PI * Math.min(1, travel / CURVE_SHARE));
  const corridor = BANK * Math.sin(Math.PI * seg(travel, [CURVE_SHARE, 1]));
  return (-(curve + corridor) * Math.PI) / 180;
};
// Cuánto tapa nuestro cielo al de fondo: entra al comenzar, mientras aún
// miramos arriba, y se va con el radar
const sceneIn = (p: number) => easeInOut(seg(p, [0.02, 0.04]));
export const dishSkyCover = (p: number) => sceneIn(p) * (1 - seg(p, DISH.handoff));

// Un resplandor suave ya pintado, que solo se estampa (un degradado por
// cuadro y por mancha sería caro)
const sprites = new Map<string, HTMLCanvasElement>();
const glowSprite = (color: string) => {
  let sprite = sprites.get(color);
  if (sprite) return sprite;
  sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  const context = sprite.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  sprites.set(color, sprite);
  return sprite;
};

// La envolvente convexa de unos puntos en pantalla: la silueta del plato
const convexHull = (points: Point[]) => {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const chain = (list: Point[]) => {
    const out: Point[] = [];
    list.forEach((point) => {
      while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], point) <= 0) out.pop();
      out.push(point);
    });
    out.pop();
    return out;
  };
  return [...chain(sorted), ...chain(sorted.reverse())];
};

/* Lo que va en capas CSS (solo se mueven): el resplandor de la Vía Láctea,
   desde el centro de la pantalla, y el del cielo sobre los cerros */
export interface DishLayers {
  band: { x: number; y: number; angle: number; scale: number; opacity: number } | null;
  haze: { y: number; roll: number; opacity: number } | null;
}

// Cómo se pinta una antena: opacidades de cada parte y si su borde brilla
interface Ink {
  rim: number;
  mesh: number;
  legs: number;
  mount: number;
  fill: number;
  width: number;
  glow: number;
}

/* Dibuja la escena; nada fuera del tramo de entrada */
// El lente (px): con él se sabe dónde queda el plato al girar la cabeza
export const dishFocal = (width: number, height: number) => 0.9 * Math.min(width, height);

export const drawDish = (
  context: CanvasRenderingContext2D,
  p: number,
  width: number,
  height: number,
  [r, g, b]: number[],
  rimRadius: number,
): DishLayers => {
  const layers: DishLayers = { band: null, haze: null };
  if (p < 0.02 || p > DISH.handoff[1]) return layers;
  const focal = dishFocal(width, height);
  const { position, forward: gaze, roll, vertex } = dishCamera(p, focal, rimRadius);
  const level = unit(cross(UP, gaze));
  // Y encima, la cabeza del visitante (mirar alrededor). La cámara rueda la
  // imagen después de proyectar: el giro de cabeza va en los ejes de la
  // pantalla ya rodada
  const looked = lookTurn({ forward: gaze, right: level, down: scale(cross(gaze, level), -1) }, lookRolled(roll));
  const forward = looked.forward as Vec;
  const right = looked.right as Vec;
  const up = scale(looked.down as Vec, -1);
  const cx = width / 2;
  const cy = height / 2;
  const cosRoll = Math.cos(roll);
  const sinRoll = Math.sin(roll);
  const NEAR = 0.05;
  const toCamera = (point: Vec): Vec => {
    const d = sub(point, position);
    return [dot(d, right), dot(d, up), dot(d, forward)];
  };
  // Una dirección (a distancia infinita): solo importa hacia dónde miramos
  const directionToCamera = (direction: Vec): Vec => [dot(direction, right), dot(direction, up), dot(direction, forward)];
  const toScreen = ([x, y, z]: Vec): Point => {
    const sx = (focal * x) / z;
    const sy = (-focal * y) / z;
    return [cx + sx * cosRoll - sy * sinRoll, cy + sx * sinRoll + sy * cosRoll];
  };
  const project = (point: Vec): Point | null => {
    const local = toCamera(point);
    return local[2] < NEAR ? null : toScreen(local);
  };
  const onScreen = (x: number, y: number, margin: number) =>
    x > -margin && x < width + margin && y > -margin && y < height + margin;
  // Un tramo recortado contra el plano cercano (la cámara pasa cerca)
  const segment = (path: Path2D, from: Vec, to: Vec) => {
    let a = toCamera(from);
    let c = toCamera(to);
    if (a[2] < NEAR && c[2] < NEAR) return;
    if (a[2] < NEAR) a = lerp(a, c, (NEAR - a[2]) / (c[2] - a[2]));
    else if (c[2] < NEAR) c = lerp(c, a, (NEAR - c[2]) / (a[2] - c[2]));
    const [x1, y1] = toScreen(a);
    const [x2, y2] = toScreen(c);
    path.moveTo(x1, y1);
    path.lineTo(x2, y2);
  };
  const polyline = (path: Path2D, points: Vec[]) => {
    for (let index = 1; index < points.length; index++) segment(path, points[index - 1], points[index]);
  };

  const handoff = seg(p, DISH.handoff);
  const fadeIn = sceneIn(p);
  const scene = fadeIn * (1 - handoff);
  const color = (alpha: number, white: number) =>
    `rgba(${Math.round(r + (255 - r) * white)}, ${Math.round(g + (255 - g) * white)}, ${Math.round(b + (255 - b) * white)}, ${alpha.toFixed(3)})`;

  // I · El cielo: estrellas, polvo de la Vía Láctea y su resplandor
  const cover = dishSkyCover(p);
  if (cover > 0.01) {
    const levels = [new Path2D(), new Path2D(), new Path2D()];
    const stamp = (direction: Vec, level: number, size: number) => {
      const local = directionToCamera(direction);
      if (local[2] < 0.05) return;
      const [x, y] = toScreen(local);
      if (!onScreen(x, y, 4)) return;
      levels[level].rect(x - size / 2, y - size / 2, size, size);
    };
    // El resplandor de la banda va aparte, en CSS: aquí solo se ubica
    const middle = directionToCamera(BAND_CENTER);
    const ahead = directionToCamera(bandDirection(0.2, 0));
    if (middle[2] > 0.15 && ahead[2] > 0.15) {
      const [mx, my] = toScreen(middle);
      const [ax, ay] = toScreen(ahead);
      layers.band = {
        x: mx - cx,
        y: my - cy,
        angle: Math.atan2(ay - my, ax - mx),
        scale: Math.min(2, Math.max(0.6, focal / 729 / middle[2])),
        opacity: cover,
      };
    }
    BAND_DUST.forEach((dust) => stamp(dust.direction, dust.level, 1));
    SKY_STARS.forEach((star) => stamp(star.direction, star.level, star.big ? 1.8 : 1.1));
    ['rgba(232, 222, 255, 0.35)', 'rgba(240, 234, 255, 0.6)', 'rgba(255, 252, 255, 0.95)'].forEach((fill, level) => {
      context.globalAlpha = cover;
      context.fillStyle = fill;
      context.fill(levels[level]);
    });
  }

  // II · El suelo: cerros lejanos que tapan el cielo bajo el horizonte, con
  // un resplandor tenue sobre ellos
  const yaw = Math.atan2(forward[0], forward[2]);
  const ridge: Point[] = [];
  // Solo lo que cae en el cuadro: cerca de los bordes de la vista la
  // proyección se dispara y el relleno taparía el cielo
  const reach = Math.atan(Math.hypot(width, height) / 2 / focal) + 0.15;
  for (let step = -40; step <= 40; step++) {
    const angle = yaw + (step / 40) * reach;
    const local = toCamera([
      position[0] + Math.sin(angle) * RIDGE_DISTANCE,
      ridgeHeight(angle),
      position[2] + Math.cos(angle) * RIDGE_DISTANCE,
    ]);
    if (local[2] > RIDGE_DISTANCE * 0.25) ridge.push(toScreen(local));
  }
  if (ridge.length > 1 && scene > 0.01) {
    const span = Math.hypot(width, height) * 2;
    const downX = -sinRoll * span;
    const downY = cosRoll * span;
    const [firstX, firstY] = ridge[0];
    const [lastX, lastY] = ridge[ridge.length - 1];
    const outline = () => {
      context.beginPath();
      ridge.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
    };
    // El resplandor sobre los cerros va aparte, en CSS: aquí solo se ubica
    // (baja hasta tras el cerro más bajo: el llano translúcido lo deja ver
    // apenas, sin una franja oscura entre el resplandor y el filo)
    const ridgeTop = Math.min(...ridge.map(([, y]) => y));
    layers.haze = { y: Math.max(...ridge.map(([, y]) => y)) + height * 0.04, roll, opacity: scene };
    // El llano: oscurece de a poco hacia abajo, sin un corte duro
    context.globalAlpha = scene;
    outline();
    context.lineTo(lastX + downX, lastY + downY);
    context.lineTo(firstX + downX, firstY + downY);
    context.closePath();
    const top = ridgeTop;
    const land = context.createLinearGradient(0, top, 0, top + height * 0.45);
    land.addColorStop(0, 'rgba(26, 14, 38, 0.3)');
    land.addColorStop(0.4, 'rgba(15, 8, 23, 0.68)');
    land.addColorStop(1, 'rgba(9, 5, 15, 0.85)');
    context.fillStyle = land;
    context.fill();
    outline();
    context.strokeStyle = color(0.16, 0.35);
    context.lineWidth = 1;
    context.stroke();
  }

  // Los rieles y durmientes: más tenues mientras más lejos
  if (scene > 0.01) {
    const fogs = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    GROUND.forEach(([from, to]) => {
      const distance = length(sub(lerp(from, to, 0.5), position));
      if (distance > 60) return;
      segment(fogs[Math.min(3, Math.floor(distance / 9))], from, to);
    });
    context.lineCap = 'round';
    context.lineWidth = 0.8;
    [0.42, 0.28, 0.17, 0.09].forEach((alpha, index) => {
      context.globalAlpha = scene;
      context.strokeStyle = color(alpha, 0.35);
      context.stroke(fogs[index]);
    });
  }

  /* Una antena: silueta oscura que tapa lo que queda detrás, con sus
     líneas encima. Lo que está al otro lado del plato (las patas del foco
     si lo vemos por detrás, la montura si lo vemos de frente) se dibuja
     antes que la silueta, que lo tapa */
  const antenna = (at: Vec, size: number, elevation: number, main: boolean, ink: Ink) => {
    const pointed = facing(elevation);
    const w = cross(pointed, AXLE);
    const axis = add(at, scale(AXIS, size));
    const v0 = add(axis, scale(pointed, VERTEX_OFFSET * size));
    const local = (radius: number, angle: number, depth = DEPTH(radius)): Vec =>
      add(
        v0,
        add(
          add(scale(AXLE, Math.cos(angle) * radius * size), scale(w, Math.sin(angle) * radius * size)),
          scale(pointed, depth * size),
        ),
      );
    const ring = (radius: number, steps: number) =>
      Array.from({ length: steps + 1 }, (_, step) => local(radius, (step / steps) * Math.PI * 2));
    const seen = dot(sub(position, v0), pointed) > 0;

    // La silueta: la envolvente del plato en pantalla
    const outline: Point[] = [];
    let whole = true;
    [RIM, RIM * 0.7, RIM * 0.4, 0].forEach((radius) => {
      const steps = radius ? 24 : 1;
      for (let step = 0; step < steps && whole; step++) {
        const point = project(local(radius, (step / steps) * Math.PI * 2));
        if (point) outline.push(point);
        else whole = false;
      }
    });

    const plate = new Path2D();
    const rim = new Path2D();
    const legs = new Path2D();
    const back = new Path2D();
    const mount = new Path2D();
    const rings = main ? 6 : 2;
    for (let index = 1; index < rings; index++) polyline(plate, ring((RIM * index) / rings, main ? 64 : 20));
    polyline(rim, ring(RIM, main ? 64 : 28));
    const ribs = main ? 16 : 8;
    const ribSteps = main ? 6 : 2;
    for (let rib = 0; rib < ribs; rib++) {
      const angle = (rib / ribs) * Math.PI * 2;
      polyline(plate, Array.from({ length: ribSteps + 1 }, (_, step) => local(RIM * (0.12 + (0.88 * step) / ribSteps), angle)));
    }
    // El foco y sus patas: cuatro en la principal, que se vuelven la cruz
    // del radar, y un trípode en las demás (una cruz las tacharía)
    const focus = add(v0, scale(pointed, FOCAL * size));
    const legCount = main ? 4 : 3;
    for (let leg = 0; leg < legCount; leg++) {
      const angle = main ? Math.PI / 4 + (leg * Math.PI) / 2 : Math.PI / 2 + (leg * Math.PI * 2) / 3;
      segment(legs, local(RIM * 0.97, angle), focus);
    }
    if (main) {
      const box = 0.07;
      const corners = [0, 1, 2, 3].map((corner) => {
        const angle = Math.PI / 4 + (corner * Math.PI) / 2;
        return add(focus, add(scale(AXLE, Math.cos(angle) * box), scale(w, Math.sin(angle) * box)));
      });
      polyline(legs, [...corners, corners[0]]);
    }
    // La armadura de atrás: del centro trasero a los nervios
    const hub = sub(v0, scale(pointed, 0.4 * size));
    const struts = main ? 8 : 6;
    for (let strut = 0; strut < struts; strut++) {
      const angle = (strut / struts) * Math.PI * 2;
      segment(back, hub, local(RIM, angle));
      if (main) segment(back, hub, local(RIM * 0.5, angle + Math.PI / 8));
    }

    if (main) {
      // Dos torres en A, anchas abajo, que sostienen el eje y ruedan sobre
      // el riel circular; las vigas de la base las unen
      const heading = HEADING;
      const reach = (TURNTABLE / Math.SQRT2) * size;
      const [left, right] = [-1, 1].map((side) => {
        const bearing = add(axis, scale(AXLE, side * 0.75 * size));
        const foot = add(at, scale(AXLE, side * reach));
        const front = add(foot, scale(heading, reach));
        const rear = sub(foot, scale(heading, reach));
        const frontMid = lerp(front, bearing, 0.5);
        const rearMid = lerp(rear, bearing, 0.5);
        polyline(mount, [front, bearing, rear, front]);
        segment(mount, frontMid, rearMid);
        segment(mount, front, rearMid);
        segment(mount, rear, frontMid);
        return { front, rear, frontMid, rearMid };
      });
      segment(mount, left.front, right.front);
      segment(mount, left.rear, right.rear);
    } else {
      // Un pedestal redondo (su silueta siempre de frente a la cámara) y la
      // horquilla en U, corta, que sostiene el plato por los lados
      const toward = sub(at, position);
      const side = unit([toward[2], 0, -toward[0]]);
      const top = add(at, [0, 1.85 * size, 0]);
      const baseHalf = scale(side, 0.32 * size);
      const topHalf = scale(side, 0.2 * size);
      polyline(mount, [sub(at, baseHalf), sub(top, topHalf), add(top, topHalf), add(at, baseHalf), sub(at, baseHalf)]);
      const yoke = scale(AXLE, 0.5 * size);
      polyline(mount, [sub(axis, yoke), sub(top, yoke), add(top, yoke), add(axis, yoke)]);
    }

    const near = (focal * RIM * size) / Math.max(0.1, length(sub(axis, position)));
    const thick = ink.width * Math.min(1.7, Math.max(0.8, 0.75 + near / 120));
    // Los anillos de adentro aparecen al acercarse: de lejos serían un muaré
    const detail = clamp01((near - 10) / 60);
    context.lineCap = 'round';
    const stroke = (path: Path2D, alpha: number, white: number, lineWidth: number) => {
      if (alpha <= 0.005) return;
      context.globalAlpha = 1;
      context.strokeStyle = color(alpha, white);
      context.lineWidth = lineWidth;
      context.stroke(path);
    };
    const drawMount = () => stroke(mount, ink.mount, 0.45, thick * 0.9);
    const drawLegs = () => {
      if (ink.glow > 0) stroke(legs, ink.legs * 0.2 * ink.glow, 0.4, 4);
      stroke(legs, ink.legs, 0.55, thick * mix(0.75, 1.3, ink.glow));
    };
    if (seen) drawMount();
    else drawLegs();
    if (whole && ink.fill > 0.005) {
      const shape = convexHull(outline);
      context.beginPath();
      shape.forEach(([x, y], index) => (index ? context.lineTo(x, y) : context.moveTo(x, y)));
      context.closePath();
      context.globalAlpha = ink.fill;
      context.fillStyle = 'rgb(9, 5, 16)';
      context.fill();
    }
    stroke(plate, ink.mesh * detail, 0.4, thick * 0.8);
    if (!seen) stroke(back, ink.mesh * (0.4 + 0.6 * detail), 0.4, thick * 0.8);
    if (ink.glow > 0) stroke(rim, 0.18 * ink.glow * ink.rim, 0.4, 5);
    stroke(rim, ink.rim, mix(0.5, 0.6, ink.glow), thick * mix(1.1, 1.3, ink.glow));
    if (seen) drawLegs();
    else drawMount();
  };

  // III · Las antenas, de la más lejana a la más cercana: cada silueta tapa
  // lo que tiene detrás
  if (fadeIn > 0.01) {
    // La principal: la malla se apaga primero; el borde y las patas al final,
    // cuando llega el radar. Su silueta se aclara al ponernos tras ella, para
    // mirar el cielo a través del plato
    const lineUp = seg(p, [mix(DISH.fly[0], DISH.fly[1], 0.5), DISH.fly[1]]);
    const mainInk: Ink = {
      rim: 0.9 * fadeIn * (1 - seg(handoff, [0.5, 1])),
      mesh: 0.42 * fadeIn * (1 - handoff) ** 1.5,
      legs: mix(0.5, 0.9, lineUp) * fadeIn * (1 - seg(handoff, [0.5, 1])),
      // La montura queda bajo nosotros al ponernos tras el plato: se apaga antes
      mount: 0.7 * fadeIn * (1 - seg(p, [DISH.fly[0] + 0.004, DISH.fly[0] + 0.014])),
      fill: 0.94 * fadeIn * (1 - seg(p, [DISH.fly[0] + 0.008, DISH.handoff[0] + 0.002])),
      width: 1.1,
      glow: 0.4 + 0.6 * lineUp,
    };
    const dishes = [
      ...STATIONS.map(({ at, start }) => ({
        at,
        size: SMALL,
        elevation: elevationAt(p, [start, start + SLEW_SPAN]),
        main: false,
      })),
      { at: [0, 0, 0] as Vec, size: MAIN, elevation: elevationAt(p, DISH.slew), main: true },
    ]
      .map((dish) => ({ ...dish, distance: length(sub(add(dish.at, scale(AXIS, dish.size)), position)) }))
      .sort((a, c) => c.distance - a.distance);
    dishes.forEach(({ at, size, elevation, main, distance }) => {
      if (main) {
        antenna(at, size, elevation, true, mainInk);
        return;
      }
      // Las que quedan fuera del cuadro ni se arman
      const center = toCamera(add(at, scale(AXIS, size)));
      if (center[2] < NEAR) return;
      const [sx, sy] = toScreen(center);
      if (!onScreen(sx, sy, (focal * 2.2 * size) / center[2])) return;
      // La bruma: las lejanas más tenues
      const fog = scene * Math.max(0.25, Math.min(1, 1.2 - distance / 50));
      antenna(at, size, elevation, false, {
        rim: 0.8 * fog,
        mesh: 0.5 * fog,
        legs: 0.55 * fog,
        mount: 0.6 * fog,
        fill: 0.9 * scene * (0.55 + 0.45 * fog),
        width: 1,
        glow: 0,
      });
    });
  }
  context.globalAlpha = 1;

  // Un destello en el foco cuando la antena queda apuntando: empieza a escuchar
  const listen = Math.sin(Math.PI * seg(p, [DISH.fly[1] - 0.015, DISH.handoff[1]]));
  if (listen > 0.01) {
    const focus = toCamera(add(vertex, scale(AIM, FOCAL * MAIN)));
    if (focus[2] > NEAR) {
      const [fx, fy] = toScreen(focus);
      context.globalAlpha = listen;
      context.drawImage(glowSprite(color(0.9, 0.85)), fx - 26, fy - 26, 52, 52);
      context.globalAlpha = 1;
    }
  }
  return layers;
};
