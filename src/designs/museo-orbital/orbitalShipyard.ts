import { drawTug } from './tileAssembly';
import { lookView, lookWarp, readLook } from './lookAround';

/* Astillero orbital: la entrada del capítulo 3. Miramos las estrellas y
   bajamos la vista: abajo asoma la Tierra de noche y, contra ella, un dique
   de cuadernas (costillas octogonales en celosía) que se traza solo. Las
   grúas no tienen "arriba": una sobre el dique, otra colgando debajo y otra
   acostada en el costado. La cámara se nivela frente a la boca, la flota
   trae las teselas de la imagen (los remolcadores frenan con sus toberas)
   y las grúas las bajan a su lugar. A mitad del armado amanece: el sol
   asoma por el borde de la Tierra y una ola de luz recorre las vigas. Con
   la obra terminada entramos por el dique hasta ella */

type Vec = readonly [number, number, number];
type Range = [number, number];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const seg = (p: number, [from, to]: Range) => clamp01((p - from) / (to - from));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const seeded = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
// Valor por tramos suaves entre puntos [p, valor]
const keyed = (p: number, keys: [number, number][]) => {
  if (p <= keys[0][0]) return keys[0][1];
  for (let index = 1; index < keys.length; index++) {
    const [at, value] = keys[index];
    const [before, previous] = keys[index - 1];
    if (p <= at) return mix(previous, value, easeInOut((p - before) / (at - before)));
  }
  return keys[keys.length - 1][1];
};

export const YARD = {
  // El dique se traza solo mientras la cámara baja la vista y lo rodea
  frame: [0.02, 0.12],
  align: [0.03, 0.14],
  approach: [0.07, 0.14],
  build: [0.13, 0.28],
  // Amanecer orbital: el sol sale por el borde de la Tierra y su luz
  // recorre el dique de izquierda a derecha
  rise: [0.15, 0.2],
  sweep: [0.16, 0.235],
  // Luego sigue subiendo, parejo, hasta que entramos
  climb: [0.18, 0.34],
  // Hasta el final de COVER en portalJourneys
  dive: [0.27, 0.56],
} satisfies Record<string, Range>;

// En sus unidades: medio ancho y medio alto del hueco de la imagen (1.6 x
// 0.9), el largo del dique y en cuántos tramos se divide
const YARD_W = 0.8;
const YARD_H = 0.45;
const YARD_DEPTH = 0.9;
const YARD_BAYS = 3;
// Distancia de la cámara a la imagen: mientras el dique se traza, frente a
// él, mientras se arma la imagen y al final (ya dentro)
const YARD_FAR = 5.2;
const YARD_NEAR = 3.3;
const YARD_PUSH = 3;
const YARD_END = 0.55;
// La cuaderna: un octágono alargado que abraza la imagen (medio ancho,
// medio alto y dónde empiezan los chaflanes a 45°) y su canto
const RIB = { w: 0.98, h: 0.62, cw: 0.74, ch: 0.38 };
const RIB_DEPTH = 0.08;
// Cuánto baja el horizonte (rad): la Tierra queda al pie de la obra
const EARTH_DIP = 0.22;
// El sol, a la izquierda: su rumbo (rad) y cuánto sube al amanecer
const SUN_AZIMUTH = -0.62;
// Ciudades en el lado de noche: racimos de luces como direcciones bajo el
// horizonte (rumbo, cuánto bajo él); se apiñan hacia el borde, como el
// suelo visto de canto
const CITY_LIGHTS = Array.from({ length: 34 }, (_, cluster) => {
  const azimuth = -1.5 + seeded(cluster + 2101) * 3;
  const depth = 0.004 + 0.32 * seeded(cluster + 2203) ** 2;
  const count = 3 + Math.floor(seeded(cluster + 2309) * 9);
  return Array.from({ length: count }, (_, index) => {
    const seed = cluster * 31 + index;
    return {
      azimuth: azimuth + (seeded(seed + 2411) - 0.5) * 0.09,
      dip: EARTH_DIP + depth * (0.85 + seeded(seed + 2503) * 0.3),
      bright: 0.35 + seeded(seed + 2609) * 0.65,
    };
  });
}).flat();
// Nuestro cielo: estrellas repartidas en toda la esfera, que giran con la
// cámara (el de la página queda tapado). Tres brillos: tenue, medio y grande
const SKY_STARS = Array.from({ length: 520 }, (_, index) => {
  const z = seeded(index + 2707) * 2 - 1;
  const angle = seeded(index + 2801) * Math.PI * 2;
  const ring = Math.sqrt(1 - z * z);
  const shine = seeded(index + 2903);
  return {
    direction: [ring * Math.cos(angle), z, ring * Math.sin(angle)] as Vec,
    level: shine > 0.93 ? 2 : shine > 0.55 ? 0 : 1,
  };
});
// Franjas de nubes bajo el borde (desde y hasta, en unidades de pantalla
// bajo el horizonte): muy aplastadas junto al borde y más altas hacia
// nosotros. Se solapan un poco y cada una usa la textura entera, cuyas
// manchas no tocan sus bordes, así que no se ven cortes
const CLOUD_STRIPS: [number, number][] = [
  [-0.005, 0.06],
  [0.035, 0.2],
  [0.14, 0.6],
];
// La textura de nubes se pinta una sola vez: manchas suaves y alargadas,
// en grupos, que empalman a los lados para repetirse sin costura
let clouds: HTMLCanvasElement | null = null;
const cloudTexture = () => {
  if (clouds) return clouds;
  clouds = document.createElement('canvas');
  clouds.width = 1024;
  clouds.height = 256;
  const context = clouds.getContext('2d');
  if (context) {
    for (let group = 0; group < 26; group++) {
      const gx = seeded(group + 3011) * 1024;
      const gy = seeded(group + 3109) * 256;
      for (let index = 0; index < 9; index++) {
        const seed = group * 17 + index;
        const x = gx + (seeded(seed + 3203) - 0.5) * 160;
        const radius = 8 + seeded(seed + 3407) ** 2 * 34;
        const y = Math.min(254 - radius, Math.max(radius + 2, gy + (seeded(seed + 3301) - 0.5) * 40));
        const alpha = 0.18 + seeded(seed + 3511) * 0.3;
        for (const wrap of [-1024, 0, 1024]) {
          const blob = context.createRadialGradient(x + wrap, y, 0, x + wrap, y, radius);
          blob.addColorStop(0, `rgba(236, 242, 250, ${alpha.toFixed(3)})`);
          blob.addColorStop(1, 'rgba(236, 242, 250, 0)');
          context.setTransform(2.4, 0, 0, 1, -(x + wrap) * 1.4, 0);
          context.fillStyle = blob;
          context.fillRect(x + wrap - radius, y - radius, radius * 2, radius * 2);
        }
      }
    }
  }
  return clouds;
};

// Las grúas: dónde se apoyan, hacia dónde crece el mástil (lejos del
// dique), hacia dónde tienden la pluma, su alto y el largo de la pluma.
// Cada una baja las teselas de una zona de la imagen
interface Crane { base: Vec; up: Vec; axis: Vec; height: number; jib: number }
const CRANES: Crane[] = [
  // Sobre el dique, con la pluma hacia la derecha: la mitad de arriba
  { base: [-0.7, -(RIB.h + RIB_DEPTH), 0], up: [0, -1, 0], axis: [1, 0, 0], height: 0.5, jib: 1.3 },
  // Colgando debajo, boca abajo, con la pluma hacia la izquierda: la de abajo
  { base: [0.5, RIB.h + RIB_DEPTH, -0.3], up: [0, 1, 0], axis: [-1, 0, 0], height: 0.42, jib: 1.3 },
  // Acostada en el costado derecho, con la pluma hacia arriba: las columnas de la derecha
  { base: [RIB.w + RIB_DEPTH, 0.3, 0.3], up: [1, 0, 0], axis: [0, -1, 0], height: 0.32, jib: 1.05 },
];
const DEPTH_AXIS: Vec = [0, 0, 1];
// Una nave de servicio llega y atraca de punta en el costado izquierdo de
// la boca: dónde atraca, su largo, el radio de su casco y cuándo llega. Se
// dibuja como el transbordador del capítulo 2: casco hexagonal oscuro,
// aristas finas y una franja de ventanas
const CAPSULE = {
  port: [-(RIB.w + RIB_DEPTH), 0.16, YARD_DEPTH / 2 - 0.08] as Vec,
  length: 0.17,
  width: 0.03,
  arrive: [0.05, 0.13] as Range,
};
// Medio ancho del mástil, sus tramos, paños de la pluma y largo de la contrapluma
const TOWER = { mast: 0.035, sections: 8, panels: 10, counter: 0.3 };
// Giro de la pluma sobre el mástil (rad), que va y viene con el scroll
const craneSlew = (p: number, index: number) => 0.42 * Math.sin(p * 26 + index * 1.9);

// La grilla de la imagen y cuánto tarda cada tesela en llegar
const YARD_COLS = 12;
const YARD_ROWS = 7;
const YARD_FLIGHT = 0.04;
const craneFor = (col: number, row: number) => (col >= 9 ? 2 : row <= 3 ? 0 : 1);

export const yardParts = (p: number, width: number, height: number) => {
  const align = easeInOut(seg(p, YARD.align));
  const dive = easeInOut(seg(p, YARD.dive));
  const back = YARD_FAR * (YARD_NEAR / YARD_FAR) ** easeInOut(seg(p, YARD.approach))
    * (YARD_PUSH / YARD_NEAR) ** easeInOut(seg(p, YARD.build))
    * (YARD_END / YARD_PUSH) ** dive;
  const scale = Math.min(width, height);
  const cx = width / 2 - (1 - align) * width * 0.1;
  // La obra va un poco más abajo para que entre la grúa de arriba; al entrar
  // vuelve al centro
  const cy = height / 2 + height * 0.05 * (1 - dive);
  return {
    scale,
    back,
    cx,
    cy,
    yaw: 0.75 * (1 - align),
    // Primero miramos hacia arriba (la Tierra queda bajo la pantalla), luego
    // bajamos la vista sobre el dique y la Tierra, y al final de frente
    pitch: keyed(p, [[0.02, 0.3], [0.075, -0.42], [YARD.align[1], 0]]),
    // La cámara se inclina al bajar la vista y se endereza frente a la boca
    roll: keyed(p, [[0.02, 0.16], [0.08, -0.24], [YARD.align[1], 0]]),
    // El fondo del dique ya de frente: ahí se arma la imagen
    window: {
      left: cx - (scale * YARD_W) / back,
      top: cy - (scale * YARD_H) / back,
      width: (2 * scale * YARD_W) / back,
      height: (2 * scale * YARD_H) / back,
    },
  };
};

// El lente (px): con él se sabe dónde queda la obra al girar la cabeza
export const yardFocal = (width: number, height: number) => Math.min(width, height);

// Lo que rueda la cámara: el cielo de fondo gira con ella
export const yardRoll = (p: number) => keyed(p, [[0.02, 0.16], [0.08, -0.24], [YARD.align[1], 0]]);
// Cuánto tapa nuestro cielo al de la página (y a las constelaciones de la
// capa de efectos, que van encima y no deben cruzar la Tierra)
export const yardSkyHidden = (p: number) => seg(p, [0.02, 0.05]);

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
    crane: craneFor(col, row),
    // Dónde calza, en las unidades del dique
    world: [
      -YARD_W + ((col + 0.5) / YARD_COLS) * YARD_W * 2,
      -YARD_H + ((row + 0.5) / YARD_ROWS) * YARD_H * 2,
      -YARD_DEPTH / 2,
    ] as Vec,
  };
});

const yardFlight = (tile: (typeof YARD_TILES)[number], p: number) => seg(p, [tile.launch, tile.launch + YARD_FLIGHT]);

/* Recorte de la imagen: solo las teselas que ya calzaron (por filas, en
   tramos seguidos); con todas puestas, el fondo entero del dique */
export const yardClip = (p: number, width: number, height: number) => {
  const { window: box, cx, cy, scale } = yardParts(p, width, height);
  const cellWidth = box.width / YARD_COLS;
  const cellHeight = box.height / YARD_ROWS;
  // Con la cabeza del visitante girada, cada rectángulo es el cuadrilátero
  // que se ve (la misma homografía con que se dibuja el dique)
  const look = readLook();
  const point = [0, 0, 0];
  const corner = (x: number, y: number) => {
    lookWarp(x, y, cx, cy, scale, point, look);
    return `${point[0].toFixed(1)} ${point[1].toFixed(1)}`;
  };
  const rect = (left: number, top: number, right: number, bottom: number) => look.yaw || look.pitch
    ? `M ${corner(left, top)} L ${corner(right, top)} L ${corner(right, bottom)} L ${corner(left, bottom)} Z`
    : `M ${left.toFixed(1)} ${top.toFixed(1)} H ${right.toFixed(1)} V ${bottom.toFixed(1)} H ${left.toFixed(1)} Z`;
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

// Contorno de una cuaderna a `grow` por fuera del hueco interior; los
// chaflanes son de 45°, así que sus esquinas corren tan(22.5°) por unidad
const ribOutline = (grow: number): [number, number][] => {
  const w = RIB.w + grow;
  const h = RIB.h + grow;
  const cw = RIB.cw + grow * 0.414;
  const ch = RIB.ch + grow * 0.414;
  return [[-cw, -h], [cw, -h], [w, -ch], [w, ch], [cw, h], [-cw, h], [-w, ch], [-w, -ch]];
};
const RIB_INNER = ribOutline(0);
const RIB_OUTER = ribOutline(RIB_DEPTH);

const add = (...vectors: Vec[]): Vec => [
  vectors.reduce((sum, v) => sum + v[0], 0),
  vectors.reduce((sum, v) => sum + v[1], 0),
  vectors.reduce((sum, v) => sum + v[2], 0),
];
const times = (v: Vec, k: number): Vec => [v[0] * k, v[1] * k, v[2] * k];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export interface YardFrame {
  width: number;
  height: number;
  ratio: number;
  tint: number[];
  photo: HTMLImageElement | null;
  // Escala con que SalaPortal muestra la imagen, para que cada tesela en
  // vuelo lleve justo el trozo que tapará
  zoom: number;
}

export const drawShipyard = (context: CanvasRenderingContext2D, p: number, frame: YardFrame) => {
  const { width, height, ratio, tint, photo } = frame;
  const { scale, back, cx, cy, yaw, pitch, roll, window: box } = yardParts(p, width, height);
  const [r, g, b] = tint;
  const color = (alpha: number, white: number) =>
    `rgba(${Math.round(r + (255 - r) * white)}, ${Math.round(g + (255 - g) * white)}, ${Math.round(b + (255 - b) * white)}, ${alpha.toFixed(3)})`;

  // Del dique a la pantalla: gira sobre su centro (rumbo y cabeceo), la
  // cámara mira por su eje desde `back` delante del fondo y rueda. Lo que
  // queda detrás de la cámara (al entrar) se recorta en un plano cercano
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const cosRoll = Math.cos(roll);
  const sinRoll = Math.sin(roll);
  const turn = (x: number, y: number, z: number) => {
    const x1 = x * cosYaw + z * sinYaw;
    const z1 = -x * sinYaw + z * cosYaw;
    const y2 = y * cosPitch - z1 * sinPitch;
    const z2 = y * sinPitch + z1 * cosPitch;
    return [x1 * cosRoll - y2 * sinRoll, x1 * sinRoll + y2 * cosRoll, z2] as const;
  };
  const camera = -YARD_DEPTH / 2 + back;
  // La cabeza del visitante (mirar alrededor): el dique gira de verdad en 3D
  // y lo que se dibuja sobre la pantalla (el hueco de la obra, las teselas
  // en vuelo) se lleva con la misma homografía
  const look = readLook();
  const looking = look.yaw !== 0 || look.pitch !== 0;
  const turned = [0, 0, 0];
  const view = (x: number, y: number, z: number) => {
    const [x1, y1, z1] = turn(x, y, z);
    if (!looking) return [x1, y1, camera - z1] as const;
    lookView(x1, y1, camera - z1, turned, look);
    return [turned[0], turned[1], turned[2]] as const;
  };
  const warp = (x: number, y: number): [number, number] => {
    if (!looking) return [x, y];
    lookWarp(x, y, cx, cy, scale, turned, look);
    return [turned[0], turned[1]];
  };
  const quad = (path: CanvasRenderingContext2D | Path2D, left: number, top: number, right: number, bottom: number) => {
    path.moveTo(...warp(left, top));
    path.lineTo(...warp(right, top));
    path.lineTo(...warp(right, bottom));
    path.lineTo(...warp(left, bottom));
    path.closePath();
  };
  const NEAR = 0.04;
  const screen = (point: Vec) => {
    const [x, y, d] = view(point[0], point[1], point[2]);
    return d < NEAR ? null : ([cx + (scale * x) / d, cy + (scale * y) / d] as const);
  };
  // Lo lejano (la Tierra, el sol) solo gira con la cámara
  const sky = (dir: Vec, ahead = 0.02) => {
    let [x, y, z] = turn(dir[0], dir[1], dir[2]);
    if (looking) {
      lookView(x, y, -z, turned, look);
      [x, y, z] = [turned[0], turned[1], -turned[2]];
    }
    return -z < ahead ? null : ([cx + (scale * x) / -z, cy + (scale * y) / -z] as const);
  };

  /* ---- La Tierra y el sol ---- */
  const rise = easeInOut(seg(p, YARD.rise));
  // Ya fuera, el sol sigue subiendo (y corriéndose un poco) mientras dura
  // la obra: el tiempo avanza con la construcción
  const climb = seg(p, YARD.climb);
  const sunElevation = -EARTH_DIP - 0.07 + 0.2 * rise + 0.2 * climb;
  const sunAzimuth = SUN_AZIMUTH + 0.12 * climb;
  const sunDir: Vec = [
    Math.sin(sunAzimuth) * Math.cos(sunElevation),
    -Math.sin(sunElevation),
    -Math.cos(sunAzimuth) * Math.cos(sunElevation),
  ];
  const sun = sky(sunDir) ?? ([-width, cy] as const);
  // Hacia dónde queda la Tierra en pantalla (para cerrar su silueta)
  const [downX, downY] = turn(0, 1, 0);
  const downLength = Math.hypot(downX, downY) || 1;
  const down = [downX / downLength, downY / downLength];

  const ahead = (azimuth: number, dip: number): Vec => [Math.sin(azimuth) * Math.cos(dip), Math.sin(dip), -Math.cos(azimuth) * Math.cos(dip)];
  // El borde de la Tierra: el círculo de direcciones `EARTH_DIP` bajo el
  // horizonte, hasta donde la cámara lo ve
  const limb: (readonly [number, number])[] = [];
  for (let index = 0; index <= 160; index++) {
    // Hasta casi el costado de la cámara: los extremos quedan muy fuera de
    // la pantalla y el cierre de la silueta no se ve
    const point = sky(ahead(-2.4 + (4.8 * index) / 160, EARTH_DIP), 0.05);
    if (point) limb.push(point);
  }
  const showEarth = limb.length > 1;
  if (showEarth) {
    const far = Math.max(width, height) * 4;
    const earth = new Path2D();
    limb.forEach(([x, y], index) => (index ? earth.lineTo(x, y) : earth.moveTo(x, y)));
    const [lastX, lastY] = limb[limb.length - 1];
    const [firstX, firstY] = limb[0];
    earth.lineTo(lastX + down[0] * far, lastY + down[1] * far);
    earth.lineTo(firstX + down[0] * far, firstY + down[1] * far);
    earth.closePath();
    context.fillStyle = '#03070c';
    context.fill(earth);
    // Nubes: una textura ya pintada, tendida bajo el borde en franjas que se
    // aplastan hacia el horizonte. Corren despacio (vamos en órbita) y más
    // rápido las de cerca; de noche apenas se ven
    const anchor = sky(ahead(0, EARTH_DIP));
    const beside = sky(ahead(0.08, EARTH_DIP));
    if (anchor && beside) {
      const texture = cloudTexture();
      const angle = Math.atan2(beside[1] - anchor[1], beside[0] - anchor[0]);
      const span = scale * 3;
      const drift = (yaw * 1.4 + p * 3) * scale;
      context.globalCompositeOperation = 'source-atop';
      context.globalAlpha = 0.12 + 0.6 * rise;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.translate(anchor[0], anchor[1]);
      context.rotate(angle);
      CLOUD_STRIPS.forEach(([from, to], strip) => {
        const shift = (((drift * (1 + strip * 0.7) + strip * span * 0.37) % span) + span) % span;
        for (const tile of [-1, 0, 1]) {
          context.drawImage(
            texture,
            tile * span - shift - span / 2, from * scale, span, (to - from) * scale,
          );
        }
      });
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.globalAlpha = 1;
    }
    context.globalCompositeOperation = 'source-atop';
    // El lado de noche: lejos del sol, la Tierra (y sus nubes) a oscuras;
    // cerca de él, la luz del día la baña
    if (rise > 0) {
      const night = context.createRadialGradient(sun[0], sun[1], scale * 0.35, sun[0], sun[1], scale * 1.5);
      night.addColorStop(0, 'rgba(3, 7, 12, 0)');
      night.addColorStop(1, `rgba(3, 7, 12, ${(0.85 * rise).toFixed(3)})`);
      context.fillStyle = night;
      context.fill(earth);
      const day = context.createRadialGradient(sun[0], sun[1], 0, sun[0], sun[1], scale * 1.3);
      day.addColorStop(0, `rgba(96, 140, 190, ${(0.5 * rise).toFixed(3)})`);
      day.addColorStop(0.3, `rgba(40, 72, 112, ${(0.3 * rise).toFixed(3)})`);
      day.addColorStop(1, 'rgba(10, 20, 34, 0)');
      context.fillStyle = day;
      context.fill(earth);
    }
    context.globalCompositeOperation = 'source-over';
    // Las ciudades: se apagan cerca del sol cuando amanece
    const cities = [new Path2D(), new Path2D()];
    CITY_LIGHTS.forEach(({ azimuth, dip, bright }) => {
      const spot = sky(ahead(azimuth, dip), 0.16);
      if (!spot) return;
      if (rise > 0 && Math.hypot(spot[0] - sun[0], spot[1] - sun[1]) < scale * 1.2 * rise) return;
      cities[bright > 0.75 ? 1 : 0].rect(spot[0] - 0.6, spot[1] - 0.6, 1.2, 1.2);
    });
    context.fillStyle = 'rgba(255, 196, 120, 0.4)';
    context.fill(cities[0]);
    context.fillStyle = 'rgba(255, 220, 160, 0.85)';
    context.fill(cities[1]);
  }

  // Lo de detrás de la Tierra va debajo de lo ya pintado: el sol (bajo el
  // borde solo asoma su resplandor; al salir, entero), las estrellas, que
  // giran con la cámara, y el fondo, que tapa el cielo de la página
  context.globalCompositeOperation = 'destination-over';
  const glowRadius = scale * 0.5;
  const sunGlow = context.createRadialGradient(sun[0], sun[1], 0, sun[0], sun[1], glowRadius);
  const shine = 0.18 + 0.82 * rise;
  sunGlow.addColorStop(0, `rgba(255, 246, 228, ${(0.95 * shine).toFixed(3)})`);
  sunGlow.addColorStop(0.04, `rgba(255, 226, 180, ${(0.6 * shine).toFixed(3)})`);
  sunGlow.addColorStop(0.25, `rgba(255, 170, 110, ${(0.14 * shine).toFixed(3)})`);
  sunGlow.addColorStop(1, 'rgba(255, 140, 90, 0)');
  context.fillStyle = sunGlow;
  context.fillRect(sun[0] - glowRadius, sun[1] - glowRadius, glowRadius * 2, glowRadius * 2);
  const stars = [new Path2D(), new Path2D(), new Path2D()];
  SKY_STARS.forEach(({ direction, level }) => {
    const spot = sky(direction, 0.1);
    if (!spot || spot[0] < -4 || spot[0] > width + 4 || spot[1] < -4 || spot[1] > height + 4) return;
    const size = level === 2 ? 1.7 : 1.1;
    stars[level].rect(spot[0] - size / 2, spot[1] - size / 2, size, size);
  });
  ['rgba(220, 228, 255, 0.95)', 'rgba(220, 228, 255, 0.6)', 'rgba(255, 252, 245, 0.95)'].forEach((fill, level) => {
    context.fillStyle = fill;
    context.fill(stars[level]);
  });
  context.fillStyle = '#04060b';
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = 'source-over';

  if (showEarth) {
    // La atmósfera: un filo fino sobre el borde, azul de noche y dorado
    // junto al sol cuando amanece
    const air = new Path2D();
    limb.forEach(([x, y], index) => (index ? air.lineTo(x, y) : air.moveTo(x, y)));
    const band = context.createLinearGradient(sun[0] - scale * 0.2, 0, sun[0] + scale * 1.6, 0);
    band.addColorStop(0, `rgba(255, 196, 130, ${(0.15 + 0.85 * rise).toFixed(3)})`);
    band.addColorStop(0.18, `rgba(150, 196, 255, ${(0.45 + 0.4 * rise).toFixed(3)})`);
    band.addColorStop(1, `rgba(90, 140, 230, ${(0.35 + 0.25 * rise).toFixed(3)})`);
    context.globalCompositeOperation = 'lighter';
    context.strokeStyle = band;
    context.lineJoin = 'round';
    for (const [lineWidth, alpha] of [[16, 0.06], [6, 0.16], [2, 0.5], [0.8, 0.9]]) {
      context.globalAlpha = alpha;
      context.lineWidth = lineWidth;
      context.stroke(air);
    }
    context.globalAlpha = 1;
    // El destello del sol al cruzar el borde, tendido sobre el horizonte
    const flare = Math.sin(Math.PI * clamp01(rise * 1.15));
    if (flare > 0.01) {
      const reach = width * 0.55;
      const streak = context.createLinearGradient(sun[0] - reach, 0, sun[0] + reach, 0);
      streak.addColorStop(0, 'rgba(255, 220, 170, 0)');
      streak.addColorStop(0.5, `rgba(255, 236, 205, ${(0.7 * flare).toFixed(3)})`);
      streak.addColorStop(1, 'rgba(255, 220, 170, 0)');
      context.strokeStyle = streak;
      context.lineWidth = 1.2;
      context.beginPath();
      context.moveTo(sun[0] - reach, sun[1]);
      context.lineTo(sun[0] + reach, sun[1]);
      context.stroke();
    }
    context.globalCompositeOperation = 'source-over';
  }
  // Por el hueco de la imagen no se ve la Tierra: ahí va la obra
  if (p >= YARD.build[0] - 0.02) {
    context.globalCompositeOperation = 'destination-out';
    context.fillStyle = '#000';
    context.beginPath();
    quad(context, box.left, box.top, box.left + box.width, box.top + box.height);
    context.fill();
    context.globalCompositeOperation = 'source-over';
  }

  /* ---- El dique ---- */
  // Las vigas tienen cuerpo: se guardan sus extremos en pantalla (con su
  // profundidad, para el grosor) y se pintan juntas al final
  const frameBeams: number[][] = [];
  const braceBeams: number[][] = [];
  const segment = (list: number[][], a: Vec, b2: Vec) => {
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
    list.push([cx + (scale * ax) / ad, cy + (scale * ay) / ad, ad, cx + (scale * bx) / bd, cy + (scale * by) / bd, bd]);
  };
  // Cada viga crece desde su arranque según su turno (de la boca al fondo:
  // cuadernas, largueros, celosía y al final las grúas)
  const built = seg(p, YARD.frame);
  const grow = (order: number) => easeInOut(seg(built, [order * 0.72, order * 0.72 + 0.28]));
  const beam = (list: number[][], a: Vec, b2: Vec, order: number) => {
    const t = grow(order);
    if (t <= 0) return;
    segment(list, a, [a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t, a[2] + (b2[2] - a[2]) * t]);
  };

  const front = YARD_DEPTH / 2;
  const rear = -YARD_DEPTH / 2;
  const planes = Array.from({ length: YARD_BAYS + 1 }, (_, bay) => front - (bay / YARD_BAYS) * YARD_DEPTH);
  const at = ([x, y]: [number, number], z: number): Vec => [x, y, z];
  const lerp2 = (a: [number, number], b2: [number, number], t: number): [number, number] => [mix(a[0], b2[0], t), mix(a[1], b2[1], t)];
  planes.forEach((z, bay) => {
    const delay = (bay / YARD_BAYS) * 0.25;
    for (let edge = 0; edge < 8; edge++) {
      const next = (edge + 1) % 8;
      const order = delay + edge * 0.012;
      // Los dos cantos de la cuaderna
      beam(frameBeams, at(RIB_INNER[edge], z), at(RIB_INNER[next], z), order);
      beam(frameBeams, at(RIB_OUTER[edge], z), at(RIB_OUTER[next], z), order);
      // Celosía entre ambos cantos: más paños en los lados largos
      const panels = edge % 2 ? 2 : 4;
      for (let panel = 0; panel < panels; panel++) {
        const from = lerp2(RIB_INNER[edge], RIB_INNER[next], panel / panels);
        const to = lerp2(RIB_OUTER[edge], RIB_OUTER[next], (panel + 1) / panels);
        beam(braceBeams, at(from, z), at(to, z), order + 0.1);
      }
      if (bay === YARD_BAYS) continue;
      // Largueros hacia el fondo y una diagonal por cara del forro
      const behind = planes[bay + 1];
      beam(frameBeams, at(RIB_OUTER[edge], z), at(RIB_OUTER[edge], behind), delay + 0.25);
      beam(braceBeams, at(RIB_INNER[edge], z), at(RIB_INNER[edge], behind), delay + 0.27);
      const flip = (bay + edge) % 2;
      beam(braceBeams, at(RIB_OUTER[flip ? edge : next], z), at(RIB_OUTER[flip ? next : edge], behind), delay + 0.35);
    }
  });
  // El marco de la obra al fondo, tensado a la última cuaderna
  const windowCorners: [number, number][] = [[-YARD_W, -YARD_H], [YARD_W, -YARD_H], [YARD_W, YARD_H], [-YARD_W, YARD_H]];
  windowCorners.forEach((corner, index) => {
    beam(frameBeams, at(corner, rear), at(windowCorners[(index + 1) % 4], rear), 0.45 + index * 0.02);
    // Tensores de cada esquina a su chaflán y del centro de cada lado al de la cuaderna
    beam(braceBeams, at(corner, rear), at(lerp2(RIB_INNER[index * 2 + 1], RIB_INNER[(index * 2 + 2) % 8], 0.5), rear), 0.5);
    beam(braceBeams, at(lerp2(corner, windowCorners[(index + 1) % 4], 0.5), rear), at(lerp2(RIB_INNER[index * 2], RIB_INNER[index * 2 + 1], 0.5), rear), 0.5);
  });

  // Las grúas: el mástil enrejado con su corona, la pluma en celosía (gira
  // sobre el mástil), la contrapluma con su contrapeso, la torreta en A,
  // los tirantes y la cabina. Cada una crece desde su apoyo en el dique
  const blocks: (readonly [number, number])[][] = [];
  const block = (corners: Vec[]) => {
    const points = corners.map(screen);
    if (points.every((point) => point)) blocks.push(points as (readonly [number, number])[]);
  };
  const lights: { point: Vec; rgb: string; size: number }[] = [];
  const { mast, sections, panels, counter } = TOWER;
  const craneFrames = CRANES.map((crane, index) => {
    const { base, up, axis, height: tall, jib } = crane;
    const slew = craneSlew(p, index);
    const dir = add(times(axis, Math.cos(slew)), times(DEPTH_AXIS, Math.sin(slew)));
    // Un punto de la grúa: `along` por la pluma, `rise` mástil arriba
    const L = (along: number, lift: number) => add(base, times(up, lift), times(dir, along));
    const M = (dx: number, dz: number, lift: number) => add(base, times(axis, dx), times(DEPTH_AXIS, dz), times(up, lift));
    const delay = 0.55 + index * 0.05;
    if (grow(delay) > 0) {
      // La zapata sobre el dique
      block([M(-mast * 2.2, mast, 0), M(mast * 2.2, mast, 0), M(mast * 2.2, mast, 0.02), M(-mast * 2.2, mast, 0.02)]);
    }
    // El mástil: cuatro cordones, peldaños en cada tramo y diagonales
    [[-mast, -mast], [mast, -mast], [mast, mast], [-mast, mast]].forEach(([dx, dz], corner) =>
      beam(frameBeams, M(dx, dz, 0), M(dx, dz, tall), delay + corner * 0.02));
    for (let level = 0; level < sections; level++) {
      const low = (level / sections) * tall;
      const high = ((level + 1) / sections) * tall;
      const order = delay + 0.03 + (level / sections) * 0.15;
      const flip = level % 2 ? 1 : -1;
      beam(braceBeams, M(-mast, mast, high), M(mast, mast, high), order);
      beam(braceBeams, M(-mast * flip, mast, low), M(mast * flip, mast, high), order);
    }
    if (grow(delay + 0.17) > 0) {
      // La corona de giro, arriba del mástil
      block([M(-mast * 1.6, mast, tall - 0.022), M(mast * 1.6, mast, tall - 0.022), M(mast * 1.6, mast, tall), M(-mast * 1.6, mast, tall)]);
    }
    const deck = tall + 0.005;
    const chord = tall + 0.065;
    const order = delay + 0.2;
    // Pluma en celosía: el cordón de abajo recto, el de arriba baja hacia la
    // punta, y diagonales entre ambos
    const upper = (length: number) => chord - 0.04 * (length / jib);
    beam(frameBeams, L(0, deck), L(jib, deck), order);
    beam(frameBeams, L(0, chord), L(jib, upper(jib)), order);
    beam(frameBeams, L(jib, deck), L(jib, upper(jib)), order + 0.04);
    for (let panel = 0; panel < panels; panel++) {
      const a = (panel / panels) * jib;
      const b2 = ((panel + 1) / panels) * jib;
      beam(braceBeams, L(a, panel % 2 ? upper(a) : deck), L(b2, panel % 2 ? deck : upper(b2)), order + 0.04);
    }
    // Contrapluma, más corta y robusta
    beam(frameBeams, L(0, deck), L(-counter, deck), order);
    beam(frameBeams, L(0, chord - 0.02), L(-counter, deck + 0.03), order);
    for (let panel = 0; panel < 3; panel++) {
      beam(braceBeams, L((-panel / 3) * counter, panel % 2 ? deck + 0.03 : deck), L((-(panel + 1) / 3) * counter, panel % 2 ? deck : deck + 0.03), order + 0.04);
    }
    // La torreta en A y los tirantes hacia la pluma y la contrapluma
    const peak = tall + 0.22;
    beam(frameBeams, L(-0.04, chord), L(0, peak), order + 0.02);
    beam(frameBeams, L(0.04, chord), L(0, peak), order + 0.02);
    beam(braceBeams, L(0, peak), L(jib * 0.45, upper(jib * 0.45)), order + 0.06);
    beam(braceBeams, L(0, peak), L(jib * 0.85, upper(jib * 0.85)), order + 0.06);
    beam(braceBeams, L(0, peak), L(-counter, deck + 0.03), order + 0.06);
    if (grow(order + 0.08) >= 1) {
      // La cabina junto a la raíz de la pluma y el contrapeso al final de la contrapluma
      block([L(0.03, deck - 0.005), L(0.13, deck - 0.005), L(0.13, deck - 0.07), L(0.03, deck - 0.07)]);
      block([L(-counter * 0.6, deck - 0.005), L(-counter, deck - 0.005), L(-counter, deck - 0.06), L(-counter * 0.6, deck - 0.06)]);
      // Luz blanca en la punta de la pluma
      lights.push({ point: L(jib, deck), rgb: '255, 250, 240', size: 1.3 });
    }
    return { base, up, axis, dir, deck, jib };
  });

  // Luces de navegación: roja a babor, verde a estribor, en la boca y en el fondo
  if (grow(0.6) >= 1) {
    for (const z of [front, rear]) {
      lights.push({ point: [-(RIB.w + RIB_DEPTH), 0, z], rgb: '255, 86, 70', size: 1.6 });
      lights.push({ point: [RIB.w + RIB_DEPTH, 0, z], rgb: '90, 255, 150', size: 1.6 });
    }
  }

  // Proyectores en los chaflanes de la segunda cuaderna, apuntando a la obra
  const lamps = grow(0.85);
  if (lamps > 0) {
    context.globalCompositeOperation = 'lighter';
    const lampZ = planes[1];
    [[1, 2], [3, 4], [5, 6], [7, 0]].forEach(([from, to], index) => {
      const spot = lerp2(RIB_INNER[from], RIB_INNER[to], 0.5);
      const lamp = screen(at(spot, lampZ));
      const target = screen([spot[0] * 0.42, spot[1] * 0.42, rear]);
      if (!lamp || !target) return;
      const length = Math.hypot(target[0] - lamp[0], target[1] - lamp[1]) || 1;
      const nx = -(target[1] - lamp[1]) / length;
      const ny = (target[0] - lamp[0]) / length;
      const spread = length * 0.42;
      const cone = context.createLinearGradient(lamp[0], lamp[1], target[0], target[1]);
      cone.addColorStop(0, `rgba(255, 238, 210, ${(0.2 * lamps).toFixed(3)})`);
      cone.addColorStop(1, 'rgba(255, 238, 210, 0)');
      context.fillStyle = cone;
      context.beginPath();
      context.moveTo(lamp[0], lamp[1]);
      context.lineTo(target[0] + nx * spread, target[1] + ny * spread);
      context.lineTo(target[0] - nx * spread, target[1] - ny * spread);
      context.closePath();
      context.fill();
      lights.push({ point: at(spot, lampZ), rgb: '255, 238, 210', size: 1.2 + (index % 2) * 0.3 });
    });
    context.globalCompositeOperation = 'source-over';
  }

  // Bloques macizos de las grúas: zapatas, coronas, cabinas y contrapesos
  context.lineCap = 'round';
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

  // Cada viga como un perfil macizo: cuerpo oscuro que tapa lo de atrás, un
  // canto encendido y el otro en sombra. De noche las alumbra la Tierra
  // desde abajo; al amanecer, una ola de sol las recorre desde la izquierda
  // (con un filo dorado al frente de la ola). Su grosor sigue la perspectiva
  // La ola es ancha y gradual: en cada viga la luz de la Tierra se apaga
  // mientras la del sol se enciende en el canto opuesto, sin saltos
  const DAWN_BAND = Math.max(180, width * 0.32);
  const DAWN_STEPS = 10;
  const sweep = seg(p, YARD.sweep);
  const dawn = sweep > 0 ? mix(Math.min(sun[0], 0) - 80, width + 120 + DAWN_BAND, easeInOut(sweep)) : -Infinity;
  const solid = (list: number[][], thick: number, light: number) => {
    const shade = new Path2D();
    const dark = new Path2D();
    const earthLit = Array.from({ length: DAWN_STEPS + 1 }, () => new Path2D());
    const sunLit = Array.from({ length: DAWN_STEPS + 1 }, () => new Path2D());
    list.forEach(([ax, ay, ad, bx, by, bd]) => {
      const length = Math.hypot(bx - ax, by - ay) || 1;
      const nx = -(by - ay) / length;
      const ny = (bx - ax) / length;
      const mx = (ax + bx) / 2;
      const step = Math.round(easeInOut(clamp01((dawn - mx) / DAWN_BAND)) * DAWN_STEPS);
      // De qué lado da cada luz
      const earthSide = nx * down[0] + ny * down[1] < 0 ? -1 : 1;
      const sunSide = nx * (sun[0] - mx) + ny * (sun[1] - (ay + by) / 2) < 0 ? -1 : 1;
      const wa = Math.max(0.7, (scale * thick) / ad);
      const wb = Math.max(0.7, (scale * thick) / bd);
      shade.moveTo(ax + nx * wa, ay + ny * wa);
      shade.lineTo(bx + nx * wb, by + ny * wb);
      shade.lineTo(bx - nx * wb, by - ny * wb);
      shade.lineTo(ax - nx * wa, ay - ny * wa);
      shade.closePath();
      const edge = (path: Path2D, side: number) => {
        path.moveTo(ax + side * nx * wa, ay + side * ny * wa);
        path.lineTo(bx + side * nx * wb, by + side * ny * wb);
      };
      if (step < DAWN_STEPS) edge(earthLit[step], earthSide);
      if (step > 0) edge(sunLit[step], sunSide);
      edge(dark, step * 2 < DAWN_STEPS ? -earthSide : -sunSide);
    });
    context.fillStyle = 'rgba(6, 10, 9, 0.94)';
    context.fill(shade);
    context.lineWidth = 1;
    context.strokeStyle = color(0.16 * light, 0.1);
    context.stroke(dark);
    for (let step = 0; step <= DAWN_STEPS; step++) {
      const day = step / DAWN_STEPS;
      if (day < 1) {
        context.strokeStyle = color(0.72 * light * (1 - day), 0.35);
        context.stroke(earthLit[step]);
      }
      if (day > 0) {
        context.strokeStyle = color(0.95 * light * day, 0.72);
        context.stroke(sunLit[step]);
        // El filo dorado va al frente de la ola
        context.strokeStyle = `rgba(255, 190, 120, ${(0.8 * light * Math.sin(Math.PI * day)).toFixed(3)})`;
        context.stroke(sunLit[step]);
      }
    }
  };
  solid(braceBeams, 0.01, 0.55);
  solid(frameBeams, 0.028, 1);

  // La nave de servicio: llega por fuera, frena con sus toberas y atraca de
  // punta en la boca. Un prisma hexagonal a lo largo de -x: collar de
  // atraque, proa en punta, casco, popa que se angosta y dos alas finas
  const capsuleIn = easeInOut(seg(p, CAPSULE.arrive));
  if (capsuleIn > 0) {
    const out = (1 - capsuleIn) * 2.2;
    const dock: Vec = [CAPSULE.port[0] - out, CAPSULE.port[1] - out * 0.25, CAPSULE.port[2] + out * 0.4];
    const { length: shipLength, width: radius } = CAPSULE;
    const point = (t: number, angle: number, wide: number): Vec => [
      dock[0] - t * shipLength,
      dock[1] + Math.sin(angle) * wide * radius,
      dock[2] + Math.cos(angle) * wide * radius,
    ];
    // Dónde está la cámara en el sistema del dique, para saber qué caras nos miran
    const reach = camera;
    const eye: Vec = [-reach * cosPitch * sinYaw, reach * sinPitch, reach * cosPitch * cosYaw];
    // Secciones del casco: (posición a lo largo, radio)
    const rings: [number, number][] = [[0, 0.42], [0.1, 0.42], [0.3, 1], [0.86, 1], [1, 0.68]];
    const SIDES = 6;
    const hull = new Path2D();
    const edges = new Path2D();
    const windows = new Path2D();
    const quad = (path: Path2D, corners: Vec[]) => {
      const points = corners.map(screen);
      if (points.some((point2) => !point2)) return;
      points.forEach((point2, index) => (index ? path.lineTo(point2![0], point2![1]) : path.moveTo(point2![0], point2![1])));
      path.closePath();
    };
    const edge = (a: Vec, b2: Vec) => {
      const from = screen(a);
      const to = screen(b2);
      if (!from || !to) return;
      edges.moveTo(from[0], from[1]);
      edges.lineTo(to[0], to[1]);
    };
    for (let side = 0; side < SIDES; side++) {
      const a0 = (side / SIDES) * Math.PI * 2;
      const a1 = ((side + 1) / SIDES) * Math.PI * 2;
      for (let ring = 0; ring < rings.length - 1; ring++) {
        const [t0, w0] = rings[ring];
        const [t1, w1] = rings[ring + 1];
        quad(hull, [point(t0, a0, w0), point(t1, a0, w1), point(t1, a1, w1), point(t0, a1, w0)]);
        edge(point(t0, a0, w0), point(t1, a0, w1));
      }
      rings.forEach(([t, w]) => edge(point(t, a0, w), point(t, a1, w)));
      // La franja de ventanas, en las caras del casco que nos miran
      const middle = (a0 + a1) / 2;
      const face = point(0.5, middle, 1);
      const normal = [0, Math.sin(middle), Math.cos(middle)];
      const facing = normal[1] * (eye[1] - face[1]) + normal[2] * (eye[2] - face[2]) > 0;
      if (facing) quad(windows, [point(0.36, middle - 0.3, 1.02), point(0.52, middle - 0.3, 1.02), point(0.52, middle + 0.3, 1.02), point(0.36, middle + 0.3, 1.02)]);
    }
    // Dos alas finas a los costados, en el plano del casco
    for (const side of [-1, 1]) {
      const wing: Vec[] = [point(0.6, (side * Math.PI) / 2, 1), point(0.76, (side * Math.PI) / 2, 1), point(0.76, (side * Math.PI) / 2, 4.2), point(0.6, (side * Math.PI) / 2, 4.2)];
      quad(hull, wing);
      wing.forEach((corner, index) => edge(corner, wing[(index + 1) % 4]));
      edge(point(0.68, (side * Math.PI) / 2, 1), point(0.68, (side * Math.PI) / 2, 4.2));
    }
    context.fillStyle = 'rgba(4, 9, 12, 0.96)';
    context.fill(hull);
    context.lineWidth = 1;
    context.strokeStyle = color(0.6, 0.55);
    context.stroke(edges);
    context.fillStyle = 'rgba(255, 224, 180, 0.55)';
    context.fill(windows);
    if (capsuleIn < 1) {
      // Mientras se acerca, frena: dos chorros fríos hacia delante, hacia el dique
      const brake = Math.sin(Math.PI * capsuleIn);
      const jets = new Path2D();
      for (const angle of [Math.PI / 2, -Math.PI / 2]) {
        const from = screen(point(0.3, angle, 1));
        const to = screen(point(0.3 - 0.9 * brake, angle, 1.6));
        if (!from || !to) continue;
        jets.moveTo(from[0], from[1]);
        jets.lineTo(to[0], to[1]);
      }
      context.globalCompositeOperation = 'lighter';
      context.strokeStyle = `rgba(150, 220, 255, ${(0.6 * brake).toFixed(3)})`;
      context.stroke(jets);
      context.globalCompositeOperation = 'source-over';
    }
  }

  // Las luces: un punto y su halo
  context.globalCompositeOperation = 'lighter';
  lights.forEach(({ point, rgb, size }) => {
    const spot = screen(point);
    if (!spot) return;
    context.fillStyle = `rgba(${rgb}, 0.22)`;
    context.beginPath();
    context.arc(spot[0], spot[1], size * 3.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = `rgba(${rgb}, 0.95)`;
    context.beginPath();
    context.arc(spot[0], spot[1], size, 0, Math.PI * 2);
    context.fill();
  });

  // Las grúas bajan las teselas: el carro corre por la pluma hasta quedar a
  // la altura de la tesela que llega y su cable la acompaña el último tramo
  const cellWidth = box.width / YARD_COLS;
  const cellHeight = box.height / YARD_ROWS;
  if (built >= 1) {
    const hoists = new Path2D();
    YARD_TILES.forEach((tile) => {
      const flight = yardFlight(tile, p);
      if (flight < 0.55 || flight >= 1) return;
      const [tx, ty] = warp(box.left + (tile.col + 0.5) * cellWidth, box.top + (tile.row + 0.5) * cellHeight);
      const { base, up, axis, dir, deck, jib } = craneFrames[tile.crane];
      const reach = Math.max(0.1, Math.min(jib, (dot(tile.world, axis) - dot(base, axis)) / dot(dir, axis)));
      const trolley = screen(add(base, times(up, deck), times(dir, reach)));
      if (!trolley) return;
      const t = easeInOut((flight - 0.55) / 0.45);
      hoists.moveTo(trolley[0], trolley[1]);
      hoists.lineTo(mix(trolley[0], tx, t), mix(trolley[1], ty, t));
      hoists.rect(trolley[0] - 3, trolley[1] - 2, 6, 4);
    });
    context.lineWidth = 1;
    context.strokeStyle = color(0.6, 0.6);
    context.stroke(hoists);
  }

  // El fondo ya de frente: la grilla de lo que falta por armar
  const building = seg(p, [YARD.build[0] - 0.02, YARD.build[0]]) * (1 - seg(p, [YARD.build[1], YARD.build[1] + 0.02]));
  if (building > 0) {
    const empty = new Path2D();
    YARD_TILES.forEach((tile) => {
      if (yardFlight(tile, p) >= 1) return;
      const left = box.left + tile.col * cellWidth;
      const top = box.top + tile.row * cellHeight;
      quad(empty, left, top, left + cellWidth, top + cellHeight);
    });
    context.lineWidth = 0.6;
    context.strokeStyle = color(0.14 * building, 0.2);
    context.stroke(empty);
  }

  // Las teselas en vuelo y sus remolcadores. Cada una muestra el trozo de
  // la imagen que va a tapar, como se verá al calzar
  context.globalCompositeOperation = 'source-over';
  const ready = Boolean(photo?.complete && photo.naturalWidth > 1);
  const fit = ready && photo ? Math.max(width / photo.naturalWidth, height / photo.naturalHeight) : 1;
  const toImage = (x: number, y: number) => {
    const u = width / 2 + (x - width / 2) / frame.zoom;
    const v = height / 2 + (y - height / 2) / frame.zoom;
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
    const [x, y] = warp(...along(flight));
    if (flight < 1) {
      const settle = easeInOut(flight);
      context.setTransform(ratio, 0, 0, ratio, x * ratio, y * ratio);
      context.rotate(tile.spin * (1 - settle));
      context.scale(0.5 + 0.5 * settle, 0.5 + 0.5 * settle);
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
      context.strokeStyle = color(0.75 * (1 - settle), 0.6);
      context.strokeRect(-halfWidth + 0.5, -halfHeight + 0.5, halfWidth * 2 - 1, halfHeight * 2 - 1);
    }
    if (tile.tug < 0) return;
    // El remolcador va delante de su tesela; al soltarla sigue de largo y se apaga
    const [aheadX, aheadY] = warp(...along(Math.min(1, flight + 0.03)));
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
      // Al acercarse frena: dos chorros fríos de las toberas de proa
      const brake = Math.sin(Math.PI * seg(flight, [0.6, 0.97]));
      if (brake > 0.02) {
        context.globalCompositeOperation = 'lighter';
        context.strokeStyle = `rgba(190, 222, 255, ${(0.8 * brake).toFixed(3)})`;
        context.lineWidth = 1.3;
        context.beginPath();
        for (const sideways of [-4, 4]) {
          const fromX = tugX + dx * 10 - dy * sideways;
          const fromY = tugY + dy * 10 + dx * sideways;
          context.moveTo(fromX, fromY);
          context.lineTo(fromX + (dx - dy * sideways * 0.05) * 18 * brake, fromY + (dy + dx * sideways * 0.05) * 18 * brake);
        }
        context.stroke();
        context.globalCompositeOperation = 'source-over';
      }
    }
    context.setTransform(ratio, 0, 0, ratio, tugX * ratio, tugY * ratio);
    context.rotate(Math.atan2(dy, dx));
    context.globalAlpha = 1 - away;
    drawTug(context, tile.tug);
    context.globalAlpha = 1;
  });

  // Soldadura: al calzar, cada tesela suelta un destello y unas chispas que
  // salen en línea recta (aquí nada cae)
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.globalCompositeOperation = 'lighter';
  YARD_TILES.forEach((tile, index) => {
    const weld = seg(p, [tile.launch + YARD_FLIGHT, tile.launch + YARD_FLIGHT + 0.014]);
    if (weld <= 0 || weld >= 1) return;
    const [x, y] = warp(box.left + (tile.col + 0.5) * cellWidth, box.top + (tile.row + 0.5) * cellHeight);
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
    for (let spark = 0; spark < 6; spark++) {
      const angle = seeded(index * 13 + spark) * Math.PI * 2;
      const reach = cellWidth * (0.3 + 1.3 * weld) * (0.6 + seeded(index * 7 + spark) * 0.6);
      const tail = 3 + 7 * weld;
      const sx = x + Math.cos(angle) * reach;
      const sy = y + Math.sin(angle) * reach;
      context.moveTo(sx, sy);
      context.lineTo(sx - Math.cos(angle) * tail, sy - Math.sin(angle) * tail);
    }
    context.stroke();
  });

  // El marco del fondo: un borde nítido con halo alrededor de la imagen
  if (yaw < 0.01) {
    context.beginPath();
    quad(context, box.left, box.top, box.left + box.width, box.top + box.height);
    context.strokeStyle = color(0.12, 0.2);
    context.lineWidth = 10;
    context.stroke();
    context.strokeStyle = color(0.85, 0.6);
    context.lineWidth = 1.2;
    context.stroke();
  }
  context.globalCompositeOperation = 'source-over';
};
