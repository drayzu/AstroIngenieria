import { clamp01 } from './roomShared';

/* Civilizaciones cósmicas: la escala de Kardashev en una sola toma.

   Empezamos a baja altura sobre una ciudad que enciende sus luces al
   anochecer, con la cámara mirando hacia adelante. Subimos sin cortes y la
   cámara se endereza hasta mirar hacia abajo: la ciudad se vuelve una mancha
   de luz en un planeta cuyas luces se extienden por todo su lado nocturno y
   un anillo de estaciones lo rodea (tipo I). Seguimos subiendo: el planeta es
   un punto en su órbita y su estrella se envuelve en un enjambre de
   colectores que se traga su luz (tipo II). Luego las estrellas vecinas
   corren hacia el centro y forman la galaxia, por la que la civilización se
   extiende sistema a sistema (tipo III). La cámara se inclina sobre ella y
   la ventana se abre en su núcleo.

   Todo en un lienzo. El mundo es un plano en unidades de galaxia (radio 1)
   y la cámara lo mira desde una altura que crece en escala logarítmica. */

type Range = [number, number];
type Point = [number, number];

export const KARDASHEV = {
  // Anochece y la ciudad enciende sus luces
  dusk: [0.02, 0.075],
  // Mientras sube, la cámara pasa de mirar adelante a mirar hacia abajo
  rise: [0.02, 0.09],
  // Tipo I: las luces cubren el planeta y nace el anillo de estaciones
  planet: [0.08, 0.14],
  ring: [0.11, 0.15],
  // Tipo II: el enjambre envuelve la estrella
  swarm: [0.158, 0.206],
  // Tipo III: la civilización se extiende por la galaxia
  spread: [0.2, 0.272],
  // La cámara se inclina sobre la galaxia ya formada
  tilt: [0.235, 0.29],
  open: [0.262, 0.312],
} satisfies Record<string, Range>;

const seg = (p: number, [from, to]: Range) => clamp01((p - from) / (to - from));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const smooth = (t: number) => t * t * (3 - 2 * t);
const seeded = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};
const gauss = (seed: number) =>
  Math.sqrt(-2 * Math.log(1 - seeded(seed) * 0.999)) * Math.cos(2 * Math.PI * seeded(seed + 0.5));

/* ---------------- El mundo ---------------- */

// Radio del planeta y de su órbita, en unidades de galaxia. No son las
// proporciones reales: las escalas se juntan para que el viaje quepa
const PLANET = 2.5e-6;
const ORBIT = 2.5e-4;
const STAR = 0.03 * ORBIT;

// Punto de un brazo espiral (dos brazos, radio ~1)
const spiral = (arm: number, t: number, jitter = 0, spread = 0): Point => {
  const angle = arm * Math.PI + t * Math.PI * 1.9 + jitter;
  const radius = 0.06 + 0.92 * t + spread;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
};
// Nuestra estrella, en un brazo, y el planeta respecto a ella
const HOME = spiral(0, 0.56);
const PLANET_ANGLE = 2.3;
const TO_STAR: Point = [-ORBIT * Math.cos(PLANET_ANGLE), -ORBIT * Math.sin(PLANET_ANGLE)];

/* La ciudad, en radios de planeta alrededor del punto que miramos: barrios
   con calles en cuadrícula (cada uno con su orientación), más densos en el
   centro, y autopistas que salen hacia afuera */
interface Light { x: number; y: number; tone: number; bright: number; order: number }
const CITY_RADIUS = 0.12;
const HIGHWAYS: Point[][] = [];
const DISTRICTS = [
  { x: 0, y: 0, angle: 0.3, spacing: 0.0026, radius: 0.03, count: 760 },
  { x: 0.036, y: -0.022, angle: 0.78, spacing: 0.0032, radius: 0.024, count: 360 },
  { x: -0.032, y: 0.03, angle: -0.12, spacing: 0.0032, radius: 0.024, count: 330 },
  { x: -0.064, y: -0.046, angle: 0.52, spacing: 0.0038, radius: 0.018, count: 170 },
  { x: 0.072, y: 0.052, angle: 1.05, spacing: 0.0038, radius: 0.017, count: 150 },
  { x: 0.016, y: 0.094, angle: 0.2, spacing: 0.0042, radius: 0.014, count: 110 },
  { x: -0.098, y: 0.018, angle: -0.42, spacing: 0.0042, radius: 0.014, count: 100 },
  { x: 0.1, y: -0.06, angle: 0.1, spacing: 0.0042, radius: 0.013, count: 90 },
];
const CITY: Light[] = (() => {
  const lights: Light[] = [];
  let seed = 9001;
  const random = () => seeded(seed++);
  const tone = () => (random() < 0.62 ? 0 : random() < 0.8 ? 1 : 2);
  const add = (x: number, y: number, bright: number) =>
    lights.push({ x, y, tone: tone(), bright, order: Math.hypot(x, y) / CITY_RADIUS + random() * 0.18 });
  DISTRICTS.forEach((district) => {
    const cos = Math.cos(district.angle);
    const sin = Math.sin(district.angle);
    for (let index = 0; index < district.count; index += 1) {
      const radius = district.radius * Math.abs(gauss(seed++)) * 0.9;
      const angle = random() * Math.PI * 2;
      let x = Math.cos(angle) * radius;
      let y = Math.sin(angle) * radius;
      // Sobre una calle: una de las dos coordenadas cae en la cuadrícula
      if (random() < 0.5) x = Math.round(x / district.spacing) * district.spacing;
      else y = Math.round(y / district.spacing) * district.spacing;
      add(district.x + x * cos - y * sin, district.y + x * sin + y * cos, 0.45 + random() * 0.55);
    }
  });
  // Autopistas: hilos de luz que salen del centro, un poco curvos
  for (let road = 0; road < 7; road += 1) {
    const heading = road * ((Math.PI * 2) / 7) + random() * 0.4;
    const bend = (random() - 0.5) * 1.2;
    const path: Point[] = [];
    for (let step = 0; step <= 60; step += 1) {
      const t = step / 60;
      const angle = heading + bend * t * t;
      const reach = 0.02 + t * 0.1;
      path.push([Math.cos(angle) * reach, Math.sin(angle) * reach]);
      add(path[step][0], path[step][1], 0.7 + random() * 0.3);
    }
    HIGHWAYS.push(path);
  }
  return lights;
})();

/* Las calles: la cuadrícula de cada barrio, en tramos que brillan más hacia
   su centro; cada cuarta calle es una avenida. Algunos tramos faltan
   (parques, terrenos baldíos) */
interface Street { ax: number; ay: number; bx: number; by: number; alpha: number; avenue: boolean; order: number }
const STREETS: Street[] = (() => {
  const streets: Street[] = [];
  let seed = 9501;
  const random = () => seeded(seed++);
  DISTRICTS.forEach((district) => {
    const reach = district.radius * 1.9;
    [district.angle, district.angle + Math.PI / 2].forEach((angle) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const lines = Math.floor(reach / district.spacing);
      for (let line = -lines; line <= lines; line += 1) {
        const offset = line * district.spacing;
        const half = Math.sqrt(reach * reach - offset * offset);
        const parts = 7;
        for (let part = 0; part < parts; part += 1) {
          if (random() < 0.14) continue;
          const from = -half + (2 * half * part) / parts;
          const to = from + (2 * half) / parts;
          const middle = Math.hypot(offset, (from + to) / 2) / reach;
          const alpha = Math.exp(-middle * middle * 2.6);
          if (alpha < 0.1) continue;
          // Del sistema del barrio al de la ciudad
          const place = (along: number): Point => [
            district.x + along * cos - offset * sin,
            district.y + along * sin + offset * cos,
          ];
          const [ax, ay] = place(from);
          const [bx, by] = place(to);
          // Cada barrio solo tiene calles en su terreno: donde manda otro,
          // la cuadrícula cambia de orientación en vez de cruzarse
          const mx = (ax + bx) / 2;
          const my = (ay + by) / 2;
          const own = Math.hypot(mx - district.x, my - district.y) / district.radius;
          if (DISTRICTS.some((other) => other !== district && Math.hypot(mx - other.x, my - other.y) / other.radius < own)) continue;
          streets.push({
            ax,
            ay,
            bx,
            by,
            alpha,
            avenue: line % 4 === 0,
            order: Math.hypot((ax + bx) / 2, (ay + by) / 2) / CITY_RADIUS + random() * 0.12,
          });
        }
      }
    });
  });
  return streets;
})();

// Autos: luces que corren por las autopistas (blancas de ida, rojas de vuelta)
const CARS = Array.from({ length: 150 }, (_, index) => ({
  road: index % HIGHWAYS.length,
  start: seeded(index + 9701),
  way: seeded(index + 9803) > 0.5 ? 1 : -1,
  speed: 9 + seeded(index + 9907) * 6,
}));
const roadPoint = (road: Point[], t: number): Point => {
  const at = (((t % 1) + 1) % 1) * (road.length - 1);
  const index = Math.floor(at);
  const mix = at - index;
  const [ax, ay] = road[index];
  const [bx, by] = road[Math.min(road.length - 1, index + 1)];
  return [ax + (bx - ax) * mix, ay + (by - ay) * mix];
};

/* Las luces del resto del planeta, como direcciones sobre su cara visible
   (z hacia la cámara): ciudades agrupadas sobre continentes y caminos que las
   unen. Se encienden en una ola que nace en nuestra ciudad */
interface LandLight { x: number; y: number; z: number; tone: number; bright: number; reach: number }
// La Tierra: dónde hay tierra, de Natural Earth (dominio público), en una
// grilla de 1,8° (200 × 100, un bit por punto)
const EARTH_W = 200;
const EARTH_H = 100;
const EARTH = (() => {
  const text = atob(
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAfgAAAAAAAAAAAAAAAAAAAAAAAAAAD//f///MAAAAAAAAAAAAAAAAAAAAAAAAAH/+f///8AAA8AAAAAB4AAAAAAA' +
  'AAAAAAASf8////+AAB4AAAAAAAwAAAAAAAAAAABhGJ8H////gAAAAAAAgAAfwAAAAAAAAAAABgF+AA///4AAAAAAGAAP/8AAcAAA' +
  'AAAAAfzNv8AH//8AAAAAAGAQf///4DAAAAAEAAA/w7/wA///AAAAMAAgd/////f/AAAAf/7/3+XOfAP//AAAA/4AAz/////////+' +
  'wH///////l8D/8AAAA//7f/3//////////n///////g/g/4B8AAfPj////////////8AP//////ODwH4AMAAfn/////////////+' +
  'AP//////AHAA8AAAAfz//////////////AD/3////wB4ABAAAAH8////////////w6AADgD///8Af4AAAABBvH//////////4AwA' +
  'ABgAP///4H/AAAAAYFj//////////4AeAAAAAB////z/8AAAAeBh//////////8APAAAAAAv///8//gAAAGx////////////8BgA' +
  'AAAAB//////4AAAAe////////////9AAAAAAAAP////+DAAAAB/////////////QAAAAAAAB/////x4AAAA/////////////gAAA' +
  'AAAAAf/////AAAAAH//7fn///////4AAAAAAAAH////9AAAAAB/n8Hz///////4QAAAAAAAB////+AAAAAH8M/Aef//////4MAAA' +
  'AAAAAf///+AAAAAB8A3//j//////8CAAAAAAAAH////AAAAAAfABn/4//////GAgAAAAAAAA////wAAAAADjwJ//f/////8wwAAA' +
  'AAAAAH///8AAAAAA/8AA///////+N8AAAAAAAAA///8AAAAAAf/AAf///////gwAAAAAAAAAH//+AAAAAAH/+eH///////8AAAAA' +
  'AAAAAA//xgAAAAAD/////v//////AAAAAAAAAAAL/AIAAAAAB/////5//////gAAAAAAAAAABfwDAAAAAA////7/D/////4AAAAA' +
  'AAAAAAL8AAAAAAAf////f7B////9AAAAAAAAAAAAfAMAAAAAH////z/4P///8AAAAAAAAAAAAHwwQAAAAB////+/+A/x/kAAAAAA' +
  'AAAAAAA+YBwAAAAf////n/AP4P6AAAAAAAAAAAAAD+AAAAAAH////9/AB8D/AQAAAAAAAAAAAAD8AAAAAD/////PgAeAPwEAAAAA' +
  'AAAAAAAAPAAAAAAf/////AAHgB+BgAAAAAAAAAAAAAwAAAAAH/////AAAwAXgEAAAAAAAAAAAAAEP8AAAA//////AAMAAgCAAAAA' +
  'AAAAAAAAA//gAAAH/////wAAgBAAwAAAAAAAAAAAAAB/8AAAA/////4AAAAIAEAAAAAAAAAAAAAAf/4AAAEB///+AAAAaBwAAAAA' +
  'AAAAAAAAAH//AAAAAH///AAAADw4AAAAAAAAAAAAAAD//wAAAAB///AAAAAcfAAAAAAAAAAAAAAB///AAAAAf//gAAAADHoEAAAA' +
  'AAAAAAAAAf//+AAAAH//4AAAAA57A+AAAAAAAAAAAAH///4AAAA//8AAAAAGAgH4gAAAAAAAAAAB////gAAAH//AAAAAAwAAfQAA' +
  'AAAAAAAAAP///4AAAB//wAAAAABgAHQAAAAAAAAAAAD///8AAAAf/8AAAAAAAAACAAAAAAAAAAAAf//+AAAAD//gAAAAAAAEAAAA' +
  'AAAAAAAAAH///gAAAB//4QAAAAAADxAAAAAAAAAAAAA///wAAAAf/+MAAAAAAH8YAAAAAAAAAAAAD//8AAAAP//PAAAAAAD/uAAA' +
  'AAAAAAAAAAf//AAAAB//DgAAAAAB//wAAAAAAAAAAAAH//wAAAAf/g4AAAAAB//+AAAAAAAAAAAAB//4AAAAD/8OAAAAAB///wAA' +
  'AAAAAAAAAAf/wAAAAA//DAAAAAAf//8AAAAAAAAAAAAH/4AAAAAP/AAAAAAAH///gAAAAAAAAAAAD/+AAAAAB/wAAAAAAB///4AA' +
  'AAAAAAAAAA//AAAAAAf4AAAAAAAP//+AAAAAAAAAAAAP/wAAAAAD+AAAAAAAD///gAAAAAAAAAAAD/4AAAAAA+AAAAAAAA+B/wAA' +
  'AAAAAAAAAA/wAAAAAAAAAAAAAAAAAH8AAAAAAAAAAAAf8AAAAAAAAAAAAAAAAAA+AAQAAAAAAAAAH+AAAAAAAAAAAAAAAAAABAAG' +
  'AAAAAAAAAB+AAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAfAAAAAAAAAAAAAAAAAAAEABgAAAAAAAAAHwAAAAAAAAAAAAAAAAAAAAAw' +
  'AAAAAAAAAD4AAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAA+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAADwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAMAAAAAAAAAA/wAf/////gAAAAAAAAAAAALgAAAAAAAA7//4f//////4AAAAAAAAAAAH8AAAACH/////8/////////A' +
  'AAAAAAAcIA/AAAAP////////////////4AAAAP/+H///gAAAH////////////////wAAAD//////+AAAD/////////////////4A' +
  'AAf//////8AAYP//////////////////AAAAP//////AIfAf////////////////+AAAAf///////4D///////////////////wA' +
  'AAH/////////////////////////////wAAAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
  );
  const bits = new Uint8Array(EARTH_W * EARTH_H);
  for (let index = 0; index < bits.length; index += 1) {
    bits[index] = (text.charCodeAt(index >> 3) >> (7 - (index & 7))) & 1;
  }
  return bits;
})();
// Cuánta tierra hay en un punto (0 a 1), suavizado entre los puntos de la grilla
const landAt = (lat: number, lon: number) => {
  const u = ((lon + 180) / 360) * EARTH_W - 0.5;
  const v = Math.min(EARTH_H - 1.001, Math.max(0, ((90 - lat) / 180) * EARTH_H - 0.5));
  const column = Math.floor(u);
  const row = Math.floor(v);
  const mx = u - column;
  const my = v - row;
  const at = (c: number, r: number) => EARTH[r * EARTH_W + (((c % EARTH_W) + EARTH_W) % EARTH_W)];
  return (
    (at(column, row) * (1 - mx) + at(column + 1, row) * mx) * (1 - my) +
    (at(column, row + 1) * (1 - mx) + at(column + 1, row + 1) * mx) * my
  );
};
// Nuestra ciudad, en el centro de Europa: desde arriba se ven Europa, el
// Mediterráneo, África y Asia, como en las fotos de la Tierra de noche
const CITY_LAT = 47 * (Math.PI / 180);
const CITY_LON = 9 * (Math.PI / 180);
// De la cara visible (x al este, y al sur, z hacia la cámara) a latitud y
// longitud (grados)
const earthPlace = (x: number, y: number, z: number) => {
  const sinLat = Math.sin(CITY_LAT);
  const cosLat = Math.cos(CITY_LAT);
  const sinLon = Math.sin(CITY_LON);
  const cosLon = Math.cos(CITY_LON);
  const ex = -x * sinLon + y * sinLat * cosLon + z * cosLat * cosLon;
  const ey = x * cosLon + y * sinLat * sinLon + z * cosLat * sinLon;
  const ez = -y * cosLat + z * sinLat;
  const length = Math.hypot(ex, ey, ez) || 1;
  return [Math.asin(ez / length) * (180 / Math.PI), Math.atan2(ey, ex) * (180 / Math.PI)];
};
// Sobre 0,1 es tierra; las costas quedan en una franja angosta sobre ese valor
const continent = (x: number, y: number, z: number) => {
  const [lat, lon] = earthPlace(x, y, z);
  return (landAt(lat, lon) - 0.5) * 0.15 + 0.1 + 0.006 * Math.sin(41 * x + 37 * y - 29 * z);
};
// Las ciudades no se reparten igual: pocas en los polos y en los desiertos
const crowded = (x: number, y: number, z: number) => {
  const [lat, lon] = earthPlace(x, y, z);
  if (Math.abs(lat) > 62) return 0.15;
  if (lat > 14 && lat < 31 && lon > -15 && lon < 32) return 0.12;
  if (lat > 38 && lat < 50 && lon > 75 && lon < 120) return 0.3;
  return 1;
};
const LAND: LandLight[] = (() => {
  const lights: LandLight[] = [];
  let seed = 8101;
  const random = () => seeded(seed++);
  const centers: number[][] = [];
  while (centers.length < 120 && seed < 60000) {
    const z = 0.06 + 0.94 * random();
    const angle = random() * Math.PI * 2;
    const side = Math.sqrt(1 - z * z);
    const x = side * Math.cos(angle);
    const y = side * Math.sin(angle);
    if (continent(x, y, z) > 0.1 && random() < crowded(x, y, z)) centers.push([x, y, z, 0.02 + 0.05 * random()]);
  }
  const push = (x: number, y: number, z: number, bright: number) => {
    const length = Math.hypot(x, y, z);
    if (z / length < 0.03) return;
    lights.push({
      x: x / length,
      y: y / length,
      z: z / length,
      tone: random() < 0.7 ? 0 : 1,
      bright,
      reach: Math.acos(z / length) + random() * 0.12,
    });
  };
  centers.forEach(([cx, cy, cz, spread]) => {
    const count = 20 + Math.floor(random() * 40);
    for (let index = 0; index < count; index += 1) {
      push(cx + gauss(seed++) * spread, cy + gauss(seed++) * spread, cz + gauss(seed++) * spread, 0.5 + random() * 0.5);
    }
  });
  // Las costas: ahí vive más gente, y sus luces dibujan la forma de la tierra
  let coast = 0;
  while (coast < 1500 && seed < 200000) {
    const z = 0.04 + 0.96 * random();
    const angle = random() * Math.PI * 2;
    const side = Math.sqrt(1 - z * z);
    const x = side * Math.cos(angle);
    const y = side * Math.sin(angle);
    const shore = continent(x, y, z) - 0.1;
    if (shore < 0 || shore > 0.035) continue;
    push(x, y, z, 0.45 + random() * 0.55);
    coast += 1;
  }
  // Pueblos sueltos tierra adentro
  let towns = 0;
  while (towns < 900 && seed < 400000) {
    const z = 0.04 + 0.96 * random();
    const angle = random() * Math.PI * 2;
    const side = Math.sqrt(1 - z * z);
    const x = side * Math.cos(angle);
    const y = side * Math.sin(angle);
    if (continent(x, y, z) < 0.12 || random() > crowded(x, y, z)) continue;
    push(x, y, z, 0.3 + random() * 0.4);
    towns += 1;
  }
  // Caminos entre ciudades vecinas
  centers.forEach((from, index) => {
    let best = -1;
    let gap = 0.7;
    centers.forEach((to, other) => {
      if (other === index) return;
      const distance = Math.hypot(from[0] - to[0], from[1] - to[1], from[2] - to[2]);
      if (distance < gap) {
        gap = distance;
        best = other;
      }
    });
    if (best < 0) return;
    const to = centers[best];
    for (let step = 1; step < 12; step += 1) {
      const t = step / 12;
      push(
        from[0] + (to[0] - from[0]) * t + (random() - 0.5) * 0.01,
        from[1] + (to[1] - from[1]) * t + (random() - 0.5) * 0.01,
        from[2] + (to[2] - from[2]) * t,
        0.3 + random() * 0.3,
      );
    }
  });
  return lights;
})();

/* El enjambre: colectores en órbitas inclinadas alrededor de la estrella,
   cada uno aparece en su turno y todos giran */
const SWARM_RINGS = Array.from({ length: 8 }, (_, index) => ({
  radius: ORBIT * (0.2 + 0.042 * index),
  tilt: (seeded(index + 4101) - 0.5) * 2.6,
  node: seeded(index + 4203) * Math.PI,
  speed: 14 / (0.2 + 0.042 * index) ** 1.5,
}));
const SWARM = Array.from({ length: 560 }, (_, index) => ({
  ring: index % SWARM_RINGS.length,
  angle: seeded(index + 4307) * Math.PI * 2,
  order: seeded(index + 4409),
}));

// Estrellas vecinas, a distancias repartidas en escala logarítmica: siempre
// hay algunas en cuadro mientras nos alejamos
const NEIGHBORS = Array.from({ length: 230 }, (_, index) => {
  const angle = seeded(index + 6101) * Math.PI * 2;
  const distance = 10 ** (-3.15 + 2.45 * seeded(index + 6203));
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    reach: distance,
    tone: seeded(index + 6307) > 0.75 ? 1 : seeded(index + 6307) < 0.2 ? 2 : 0,
    big: seeded(index + 6409) > 0.8,
    bright: 0.45 + 0.55 * seeded(index + 6503),
  };
});

// La galaxia: bulbo, brazos y un disco tenue
const GALAXY_STARS = Array.from({ length: 3600 }, (_, index) => {
  const kind = seeded(index + 5101);
  let x: number;
  let y: number;
  if (kind < 0.16) {
    const radius = 0.15 * Math.abs(gauss(index + 5203));
    const angle = seeded(index + 5307) * Math.PI * 2;
    x = Math.cos(angle) * radius;
    y = Math.sin(angle) * radius;
  } else if (kind < 0.9) {
    const t = seeded(index + 5401) ** 0.9;
    [x, y] = spiral(index % 2, t, gauss(index + 5503) * 0.14, gauss(index + 5607) * 0.03 * (1 + t));
  } else {
    const radius = Math.sqrt(seeded(index + 5701)) * 0.95;
    const angle = seeded(index + 5803) * Math.PI * 2;
    x = Math.cos(angle) * radius;
    y = Math.sin(angle) * radius;
  }
  return {
    x,
    y,
    big: seeded(index + 5903) > 0.84,
    bright: 0.35 + 0.65 * seeded(index + 6007),
    reach: Math.hypot(x - HOME[0], y - HOME[1]),
  };
});

/* Rutas de la expansión: cada sistema cuelga del ya alcanzado más cercano,
   como una red que se ramifica desde casa */
const COLONIES = (() => {
  const systems = Array.from({ length: 120 }, (_, index) => {
    const [x, y] = spiral(index % 2, 0.1 + seeded(index + 7001) * 0.85, gauss(index + 7103) * 0.18, gauss(index + 7207) * 0.03);
    return { x, y, reach: Math.hypot(x - HOME[0], y - HOME[1]) };
  }).sort((a, b) => a.reach - b.reach);
  return systems.map((system, index) => {
    let parent = { x: HOME[0], y: HOME[1], reach: 0 };
    let best = Math.hypot(system.x - HOME[0], system.y - HOME[1]);
    for (let other = 0; other < index; other += 1) {
      const gap = Math.hypot(system.x - systems[other].x, system.y - systems[other].y);
      if (gap < best) {
        best = gap;
        parent = systems[other];
      }
    }
    return { ...system, parent };
  });
})();

/* ---------------- La cámara ---------------- */

// Altura de la cámara (log10, en unidades de galaxia) a lo largo del viaje.
// Se detiene un poco en cada escala y entre ellas sube de golpe
const ZOOM: Point[] = [
  [0.02, -6.55],
  [0.075, -6.0],
  [0.1, -5.12],
  [0.14, -4.96],
  [0.168, -3.42],
  [0.206, -3.28],
  [0.262, 0.36],
  [0.31, 0.44],
  [0.6, 0.6],
];
// Pendientes por media armónica: la curva no se pasa de largo en las pausas
const ZOOM_SLOPES = ZOOM.map((_, index) => {
  if (index === 0) return 0;
  const slope = (a: number) => (ZOOM[a + 1][1] - ZOOM[a][1]) / (ZOOM[a + 1][0] - ZOOM[a][0]);
  if (index === ZOOM.length - 1) return slope(index - 1);
  const before = slope(index - 1);
  const after = slope(index);
  return before * after <= 0 ? 0 : 2 / (1 / before + 1 / after);
});
const logSpan = (p: number) => {
  if (p <= ZOOM[0][0]) return ZOOM[0][1];
  const last = ZOOM.length - 1;
  if (p >= ZOOM[last][0]) return ZOOM[last][1];
  let index = 0;
  while (ZOOM[index + 1][0] < p) index += 1;
  const [p0, y0] = ZOOM[index];
  const [p1, y1] = ZOOM[index + 1];
  const h = p1 - p0;
  const t = (p - p0) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * y0 +
    (t3 - 2 * t2 + t) * h * ZOOM_SLOPES[index] +
    (-2 * t3 + 3 * t2) * y1 +
    (t3 - t2) * h * ZOOM_SLOPES[index + 1]
  );
};

// Cuánto se apagan las constelaciones del fondo: del todo sobre la ciudad y
// junto al planeta; vuelven cuando llegamos a la estrella
export const kardashevSkyDim = (p: number) => 1 - seg(logSpan(p), [-4.5, -3.9]);

// Giro de la cámara (rad): al ras es mirar alrededor; desde arriba, ladearse
export const kardashevTurn = (p: number) =>
  -0.6 + 1.2 * easeInOut(seg(p, [0.02, 0.31])) + 0.3 * seg(p, [0.31, 0.6]);

interface Camera {
  span: number;
  turn: number;
  sinPitch: number;
  cosPitch: number;
  persp: number;
  // Dónde quedan el planeta, la estrella y el centro de la galaxia respecto
  // al punto que mira la cámara (sin restar números enormes)
  planet: Point;
  star: Point;
  core: Point;
}

const camera = (p: number): Camera => {
  const level = logSpan(p);
  // Lo que mira la cámara pasa del planeta a la estrella y de la estrella al
  // centro de la galaxia, siempre al ritmo de la altura: nunca se sale de cuadro
  const toStar = smooth(seg(level, [-4.1, -3.35]));
  const toCore = smooth(seg(level, [-1.4, 0.25]));
  const pitch = (34 + 56 * easeInOut(seg(p, KARDASHEV.rise)) - 38 * easeInOut(seg(p, KARDASHEV.tilt))) * (Math.PI / 180);
  return {
    span: 10 ** level,
    turn: kardashevTurn(p),
    sinPitch: Math.sin(pitch),
    cosPitch: Math.cos(pitch),
    persp: 1 - seg(p, [0.09, 0.2]),
    planet: [-TO_STAR[0] * toStar + HOME[0] * toCore, -TO_STAR[1] * toStar + HOME[1] * toCore],
    star: [TO_STAR[0] * (1 - toStar) + HOME[0] * toCore, TO_STAR[1] * (1 - toStar) + HOME[1] * toCore],
    core: [-HOME[0] * (1 - toCore) + TO_STAR[0] * (1 - toStar), -HOME[1] * (1 - toCore) + TO_STAR[1] * (1 - toStar)],
  };
};

// Proyección de un punto del plano (relativo a lo que mira la cámara) a la
// pantalla. Devuelve la escala en ese punto (px por unidad), o 0 si queda
// detrás de la cámara
const projector = (cam: Camera, width: number, height: number) => {
  const cx = width / 2;
  const cy = height / 2;
  const focal = Math.min(width, height);
  const cos = Math.cos(cam.turn);
  const sin = Math.sin(cam.turn);
  const lean = cam.cosPitch * cam.persp;
  return (x: number, y: number, out: number[]) => {
    const u = x * cos - y * sin;
    const v = x * sin + y * cos;
    const depth = cam.span - v * lean;
    if (depth < cam.span * 0.04) return 0;
    const scale = focal / depth;
    out[0] = cx + scale * u;
    out[1] = cy + scale * v * cam.sinPitch;
    return scale;
  };
};

/* ---------------- Pinceles ---------------- */

// Puntos de luz agrupados por color y brillo: un relleno por grupo
const LEVELS = 4;
const makeDots = () => {
  const paths: (Path2D | undefined)[] = [];
  return {
    add(key: number, x: number, y: number, size: number) {
      let path = paths[key];
      if (!path) paths[key] = path = new Path2D();
      path.rect(x - size / 2, y - size / 2, size, size);
    },
    fill(context: CanvasRenderingContext2D, style: (key: number) => string, alpha: number) {
      paths.forEach((path, key) => {
        if (!path) return;
        context.globalAlpha = (alpha * ((key % LEVELS) + 1)) / LEVELS;
        context.fillStyle = style(Math.floor(key / LEVELS));
        context.fill(path);
      });
    },
  };
};
const level = (alpha: number) => Math.min(LEVELS - 1, Math.round(alpha * LEVELS) - 1);

const LIGHT_TONES = ['rgb(255, 178, 96)', 'rgb(255, 236, 205)', 'rgb(196, 214, 255)'];
const STAR_TONES = ['rgb(236, 240, 255)', 'rgb(255, 222, 190)', 'rgb(190, 210, 255)'];

// Resplandores: un degradado pintado una vez y estirado con drawImage
const glowSprite = ([r, g, b]: number[]) => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
  gradient.addColorStop(0.2, `rgba(${r}, ${g}, ${b}, 0.55)`);
  gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.14)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return canvas;
};

// El gas de la galaxia, salvaje y habitada, pintado una vez
const GAS_EXTENT = 1.15;
const gasSprite = (gas: HTMLCanvasElement, core: HTMLCanvasElement, gasAlpha: number, coreAlpha: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const unit = 256 / GAS_EXTENT;
  context.translate(256, 256);
  context.globalCompositeOperation = 'lighter';
  for (let index = 0; index < 1600; index += 1) {
    const t = seeded(index + 3101);
    const [x, y] = spiral(index % 2, t, gauss(index + 3203) * 0.13, gauss(index + 3307) * 0.03);
    const size = (0.025 + 0.045 * seeded(index + 3409)) * unit * (0.7 + 0.6 * t);
    context.globalAlpha = gasAlpha;
    context.drawImage(gas, x * unit - size, y * unit - size, size * 2, size * 2);
  }
  context.globalAlpha = coreAlpha;
  context.drawImage(core, -0.42 * unit, -0.42 * unit, 0.84 * unit, 0.84 * unit);
  context.drawImage(core, -0.16 * unit, -0.16 * unit, 0.32 * unit, 0.32 * unit);
  return canvas;
};

/* El planeta de noche, pintado una vez: océanos y continentes en violeta
   tenue, como bajo la luna (los mismos continentes sobre los que se
   encienden las luces). El lado de día no se pinta: es un borde de luz */
const planetSprite = () => {
  const size = 384;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const image = context.createImageData(size, size);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const x = ((column + 0.5) / size) * 2 - 1;
      const y = ((row + 0.5) / size) * 2 - 1;
      const r2 = x * x + y * y;
      if (r2 > 1) continue;
      const z = Math.sqrt(1 - r2);
      const land = clamp01((continent(x, y, z) - 0.1) * 7 + 0.5);
      // Luz de luna: violeta tenue, más oscuro hacia el borde
      const moon = 0.5 + 0.5 * z;
      const at = (row * size + column) * 4;
      image.data[at] = (8 + 16 * land) * moon;
      image.data[at + 1] = (9 + 13 * land) * moon;
      image.data[at + 2] = (30 + 20 * land) * moon;
      // Borde suave
      image.data[at + 3] = 255 * clamp01((1 - Math.sqrt(r2)) * size * 0.5);
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
};

let sprites: {
  tint: string;
  warm: HTMLCanvasElement;
  white: HTMLCanvasElement;
  red: HTMLCanvasElement;
  accent: HTMLCanvasElement;
  wild: HTMLCanvasElement;
  lit: HTMLCanvasElement;
  mix: HTMLCanvasElement;
  planet: HTMLCanvasElement;
} | null = null;
const spritesFor = (tint: number[]) => {
  const key = tint.join(',');
  if (sprites?.tint === key) return sprites;
  const core = glowSprite([255, 226, 190]);
  sprites = {
    tint: key,
    warm: glowSprite([255, 170, 90]),
    white: glowSprite([255, 244, 222]),
    red: glowSprite([255, 86, 56]),
    accent: glowSprite(tint),
    wild: gasSprite(glowSprite([120, 140, 200]), core, 0.05, 0.5),
    lit: gasSprite(glowSprite(tint), core, 0.08, 0.8),
    mix: Object.assign(document.createElement('canvas'), { width: 512, height: 512 }),
    planet: planetSprite(),
  };
  return sprites;
};

/* ---------------- La toma ---------------- */

// El suelo cubre la pantalla mientras el planeta es más grande que esto
// (en diagonales): hasta que su borde está por entrar en cuadro. Después el
// planeta es un disco en el lienzo
const GROUND = 0.62;

/* El suelo bajo la ciudad: lo pintan capas CSS que solo se mueven y escalan
   (un relleno oscuro, la bruma del horizonte y el resplandor de la ciudad) */
export const kardashevGround = (p: number, width: number, height: number) => {
  const cam = camera(p);
  const point = [0, 0];
  projector(cam, width, height)(cam.planet[0], cam.planet[1], point);
  const planetPx = (PLANET * Math.min(width, height)) / cam.span;
  const cover = planetPx > Math.hypot(width, height) * GROUND ? 1 : 0;
  const cityFade = 1 - seg(Math.log10(cam.span), [-4.3, -3.85]);
  return {
    cover,
    haze: cover * (1 - easeInOut(seg(p, KARDASHEV.rise))),
    x: point[0] - width / 2,
    y: point[1] - height / 2,
    radius: CITY_RADIUS * planetPx * 1.3,
    squash: Math.max(0.05, cam.sinPitch),
    warmth: cover * Math.min(1, seg(p, KARDASHEV.dusk) * 1.2) * cityFade,
  };
};

export const drawKardashev = (
  context: CanvasRenderingContext2D,
  p: number,
  width: number,
  height: number,
  tint: number[],
  // Radio de la ventana abierta en el centro (px)
  opening: number,
) => {
  const [r, g, b] = tint;
  const art = spritesFor(tint);
  const cam = camera(p);
  const project = projector(cam, width, height);
  const altitude = Math.log10(cam.span);
  const focal = Math.min(width, height);
  const center = focal / cam.span;
  const diagonal = Math.hypot(width, height);
  const point = [0, 0];
  const onScreen = (margin: number) =>
    point[0] > -margin && point[0] < width + margin && point[1] > -margin && point[1] < height + margin;
  const lit = `rgb(${Math.round(r + (255 - r) * 0.35)}, ${Math.round(g + (255 - g) * 0.35)}, ${Math.round(b + (255 - b) * 0.35)})`;

  context.save();
  // La ventana: nada se dibuja sobre ella
  if (opening > 0.5) {
    context.beginPath();
    context.rect(-width, -height, width * 3, height * 3);
    context.arc(width / 2, height / 2, opening, 0, Math.PI * 2);
    context.clip('evenodd');
  }

  /* El suelo y el planeta */
  const planetScale = project(cam.planet[0], cam.planet[1], point);
  const [planetX, planetY] = point;
  const planetPx = PLANET * center;
  const cityFade = 1 - seg(altitude, [-4.3, -3.85]);
  // De qué lado viene la luz de la estrella, en pantalla
  const sunU = (TO_STAR[0] * Math.cos(cam.turn) - TO_STAR[1] * Math.sin(cam.turn)) / ORBIT;
  const sunV = (TO_STAR[0] * Math.sin(cam.turn) + TO_STAR[1] * Math.cos(cam.turn)) / ORBIT;
  const dusk = seg(p, KARDASHEV.dusk) * 1.2;
  const cityPx = CITY_RADIUS * planetPx;
  const glowX = cityPx * 1.3;
  // Mientras el suelo llena la pantalla, el suelo y el resplandor de la
  // ciudad son capas CSS (ver kardashevGround): no se repintan
  const onGround = planetPx > diagonal * GROUND;
  if (!onGround && planetScale && planetPx > 0.5) {
    // El planeta ya pintado, con su luz: gira con la cámara
    context.save();
    context.translate(planetX, planetY);
    context.rotate(cam.turn);
    context.drawImage(art.planet, -planetPx, -planetPx, planetPx * 2, planetPx * 2);
    context.restore();
    // La atmósfera: un halo azul por fuera del borde y un hilo nítido, más
    // brillante del lado de la estrella
    if (planetPx > 3) {
      // El halo en dos anillos que se apagan hacia afuera: solo pintan el borde
      context.strokeStyle = 'rgb(120, 165, 255)';
      [
        [1.022, 0.03, 0.07],
        [1.008, 0.012, 0.16],
      ].forEach(([at, wide, alpha]) => {
        context.beginPath();
        context.arc(planetX, planetY, planetPx * at, 0, Math.PI * 2);
        context.lineWidth = Math.max(1, planetPx * wide);
        context.globalAlpha = alpha;
        context.stroke();
      });
      const air = context.createLinearGradient(
        planetX - sunU * planetPx,
        planetY - sunV * planetPx,
        planetX + sunU * planetPx,
        planetY + sunV * planetPx,
      );
      air.addColorStop(0, 'rgba(110, 150, 255, 0.1)');
      air.addColorStop(0.55, 'rgba(120, 165, 255, 0.18)');
      air.addColorStop(0.85, 'rgba(170, 205, 255, 0.7)');
      air.addColorStop(1, 'rgba(235, 245, 255, 1)');
      context.strokeStyle = air;
      context.beginPath();
      context.arc(planetX, planetY, planetPx, 0, Math.PI * 2);
      context.lineWidth = 2.2;
      context.globalAlpha = 0.45;
      context.stroke();
      context.lineWidth = 1;
      context.globalAlpha = 1;
      context.stroke();
    }
  }

  /* Tipo 0 → I: las luces de la ciudad y del planeta */
  if (cityFade > 0 && planetScale) {
    const dots = makeDots();
    // El resplandor de la ciudad sobre el planeta, cuando no va en el suelo
    if (!onGround) {
      context.globalCompositeOperation = 'lighter';
      context.globalAlpha = 0.5 * Math.min(1, dusk) * cityFade;
      const glowY = glowX * cam.sinPitch;
      context.drawImage(art.warm, planetX - glowX, planetY - glowY, glowX * 2, glowY * 2);
      context.globalCompositeOperation = 'source-over';
    }
    // Calles y avenidas: se encienden desde el centro hacia afuera
    if (cityPx > 25) {
      const streets: Path2D[] = [];
      const avenues = new Path2D();
      const from = [0, 0];
      STREETS.forEach((street) => {
        const on = clamp01((dusk - street.order) * 6) * street.alpha;
        if (on < 0.25) return;
        if (!project(cam.planet[0] + street.ax * PLANET, cam.planet[1] + street.ay * PLANET, from)) return;
        if (!project(cam.planet[0] + street.bx * PLANET, cam.planet[1] + street.by * PLANET, point)) return;
        if (Math.max(from[0], point[0]) < -10 || Math.min(from[0], point[0]) > width + 10) return;
        if (Math.max(from[1], point[1]) < -10 || Math.min(from[1], point[1]) > height + 10) return;
        const path = street.avenue ? avenues : (streets[Math.min(3, Math.floor(on * 4))] ??= new Path2D());
        path.moveTo(from[0], from[1]);
        path.lineTo(point[0], point[1]);
      });
      const streetFade = cityFade * seg(cityPx, [25, 90]);
      context.lineCap = 'butt';
      context.lineWidth = 0.8;
      context.strokeStyle = 'rgb(255, 160, 80)';
      streets.forEach((path, key) => {
        context.globalAlpha = streetFade * 0.2 * (key + 1);
        context.stroke(path);
      });
      context.lineWidth = 1;
      context.strokeStyle = 'rgb(255, 196, 130)';
      context.globalAlpha = streetFade * 0.6;
      context.stroke(avenues);
      // Autopistas: un hilo ancho y tenue con uno fino y brillante encima
      const roads = new Path2D();
      HIGHWAYS.forEach((road) => {
        const shown = Math.floor(road.length * clamp01((dusk - 0.15) * 1.4));
        for (let step = 0; step < shown; step += 1) {
          if (!project(cam.planet[0] + road[step][0] * PLANET, cam.planet[1] + road[step][1] * PLANET, point)) break;
          if (step === 0) roads.moveTo(point[0], point[1]);
          else roads.lineTo(point[0], point[1]);
        }
      });
      context.lineWidth = 2.4;
      context.strokeStyle = 'rgb(255, 170, 90)';
      context.globalAlpha = streetFade * 0.18;
      context.stroke(roads);
      context.lineWidth = 0.9;
      context.strokeStyle = 'rgb(255, 226, 180)';
      context.globalAlpha = streetFade * 0.45;
      context.stroke(roads);
    }
    // De lejos la ciudad es una mancha: basta con una parte de sus luces
    const step = cityPx < 40 ? 4 : cityPx < 120 ? 2 : 1;
    for (let index = 0; index < CITY.length; index += step) {
      const light = CITY[index];
      const on = clamp01((dusk - light.order) * 7);
      if (on <= 0) continue;
      const scale = project(cam.planet[0] + light.x * PLANET, cam.planet[1] + light.y * PLANET, point);
      if (!scale || !onScreen(4)) continue;
      const key = level(on * light.bright);
      if (key < 0) continue;
      const size = Math.min(2.6, Math.max(0.8, (light.bright > 0.8 ? 1.7 : 1.1) * Math.sqrt(scale / center)));
      dots.add(light.tone * LEVELS + key, point[0], point[1], size);
    }
    // Autos en las autopistas, mientras la ciudad se ve de cerca
    if (cityPx > 300 && dusk > 0.6) {
      context.lineCap = 'round';
      context.lineWidth = 1.4;
      const ways: Path2D[] = [new Path2D(), new Path2D()];
      CARS.forEach((car) => {
        const road = HIGHWAYS[car.road];
        const [ax, ay] = roadPoint(road, car.start + car.way * p * car.speed);
        const [bx, by] = roadPoint(road, car.start + car.way * (p - 0.0009) * car.speed);
        if (Math.abs(ax - bx) > 0.05 || Math.abs(ay - by) > 0.05) return;
        if (!project(cam.planet[0] + ax * PLANET, cam.planet[1] + ay * PLANET, point) || !onScreen(4)) return;
        const [x1, y1] = point;
        if (!project(cam.planet[0] + bx * PLANET, cam.planet[1] + by * PLANET, point)) return;
        const path = ways[car.way > 0 ? 0 : 1];
        path.moveTo(x1, y1);
        path.lineTo(point[0], point[1]);
      });
      context.globalAlpha = cityFade * clamp01((dusk - 0.6) * 4) * 0.85;
      context.strokeStyle = 'rgb(255, 246, 228)';
      context.stroke(ways[0]);
      context.strokeStyle = 'rgb(255, 80, 64)';
      context.stroke(ways[1]);
    }
    // El resto del planeta: la ola de luces cruza el lado nocturno
    const wave = (Math.PI / 2 + 0.25) * easeInOut(seg(p, KARDASHEV.planet));
    if (wave > 0 && planetPx > 2) {
      const sunX = (TO_STAR[0] / ORBIT) * 0.72;
      const sunY = (TO_STAR[1] / ORBIT) * 0.72;
      LAND.forEach((light) => {
        const on = clamp01((wave - light.reach) * 9);
        if (on <= 0) return;
        // Solo en el lado de noche, apagándose hacia el terminador
        const night = clamp01((0.06 - (light.x * sunX + light.y * sunY - light.z * 0.69)) * 5);
        if (night <= 0) return;
        if (!project(cam.planet[0] + light.x * PLANET, cam.planet[1] + light.y * PLANET, point) || !onScreen(4)) return;
        const key = level(on * night * light.bright);
        if (key < 0) return;
        dots.add(light.tone * LEVELS + key, point[0], point[1], light.bright > 0.85 ? 1.6 : 1.1);
      });
    }
    dots.fill(context, (tone) => LIGHT_TONES[tone], cityFade);
    context.globalAlpha = 1;
  }

  // El anillo de estaciones alrededor del planeta
  const ringBuilt = easeInOut(seg(p, KARDASHEV.ring));
  const ringFade = ringBuilt * (1 - seg(altitude, [-4.2, -3.7]));
  if (ringFade > 0.01 && planetScale && planetPx > 2) {
    const ringPx = planetPx * 1.22;
    const sweep = ringBuilt * Math.PI * 2;
    const spin = cam.turn + p * 30;
    context.globalAlpha = ringFade * 0.35;
    context.strokeStyle = lit;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(planetX, planetY, ringPx, spin, spin + sweep);
    context.stroke();
    const stations = new Path2D();
    for (let index = 0; index < 90; index += 1) {
      const angle = (index / 90) * Math.PI * 2;
      if (angle > sweep) break;
      const x = planetX + Math.cos(spin + angle) * ringPx;
      const y = planetY + Math.sin(spin + angle) * ringPx;
      stations.rect(x - 0.9, y - 0.9, 1.8, 1.8);
    }
    context.globalAlpha = ringFade;
    context.fillStyle = 'rgb(255, 240, 255)';
    context.fill(stations);
  }

  /* Tipo II: la estrella y su enjambre */
  const systemFade = seg(altitude, [-4.4, -3.9]) * (1 - seg(altitude, [-2.0, -1.3]));
  if (systemFade > 0.01) {
    const starScale = project(cam.star[0], cam.star[1], point);
    const [starX, starY] = point;
    if (starScale && onScreen(diagonal)) {
      const built = easeInOut(seg(p, KARDASHEV.swarm));
      // La órbita del planeta y el planeta, ya un punto con sus luces
      context.globalAlpha = systemFade * 0.18;
      context.strokeStyle = 'rgb(220, 226, 255)';
      context.lineWidth = 1;
      context.beginPath();
      context.arc(starX, starY, ORBIT * center, 0, Math.PI * 2);
      context.stroke();
      context.globalCompositeOperation = 'lighter';
      context.globalAlpha = systemFade * 0.9;
      context.drawImage(art.warm, planetX - 7, planetY - 7, 14, 14);
      // Los colectores: los de atrás, la estrella y los de adelante
      const panels = [new Path2D(), new Path2D()];
      SWARM.forEach((panel) => {
        if (panel.order > built) return;
        const ring = SWARM_RINGS[panel.ring];
        const angle = panel.angle + p * ring.speed;
        const place = (at: number) => {
          const x = Math.cos(at) * ring.radius;
          const y = Math.sin(at) * ring.radius * Math.cos(ring.tilt);
          const cos = Math.cos(ring.node);
          const sin = Math.sin(ring.node);
          return [x * cos - y * sin, x * sin + y * cos];
        };
        const [ax, ay] = place(angle - 0.035);
        const [bx, by] = place(angle + 0.035);
        const front = Math.sin(angle) * Math.sin(ring.tilt) > 0 ? 1 : 0;
        if (!project(cam.star[0] + ax, cam.star[1] + ay, point)) return;
        const [x1, y1] = point;
        if (!project(cam.star[0] + bx, cam.star[1] + by, point)) return;
        panels[front].moveTo(x1, y1);
        panels[front].lineTo(point[0], point[1]);
      });
      context.globalCompositeOperation = 'source-over';
      context.lineCap = 'butt';
      context.lineWidth = 2.2;
      context.globalAlpha = systemFade * 0.5;
      context.strokeStyle = 'rgb(170, 96, 70)';
      context.stroke(panels[0]);
      // La estrella se apaga a medida que el enjambre se traga su luz y le
      // queda un brillo rojo, el calor que los colectores devuelven
      const starPx = Math.max(2, STAR * center);
      context.globalCompositeOperation = 'lighter';
      context.globalAlpha = systemFade * (1 - 0.8 * built);
      context.drawImage(art.white, starX - starPx * 7, starY - starPx * 7, starPx * 14, starPx * 14);
      context.globalAlpha = systemFade * built * 0.8;
      context.drawImage(art.red, starX - starPx * 9, starY - starPx * 9, starPx * 18, starPx * 18);
      context.globalAlpha = systemFade * (1 - 0.6 * built);
      context.fillStyle = 'rgb(255, 250, 238)';
      context.beginPath();
      context.arc(starX, starY, starPx, 0, Math.PI * 2);
      context.fill();
      context.globalCompositeOperation = 'source-over';
      context.globalAlpha = systemFade;
      context.strokeStyle = 'rgb(255, 214, 160)';
      context.stroke(panels[1]);
    }
  }

  /* Las estrellas vecinas: aparecen al alejarnos y corren hacia el centro */
  const reach = p < KARDASHEV.spread[0] ? 0 : 10 ** (-3.4 + 3.75 * smooth(seg(p, KARDASHEV.spread)));
  const neighborFade = seg(altitude, [-4.0, -3.5]) * (1 - seg(altitude, [-0.7, -0.2]));
  if (neighborFade > 0.01) {
    // Estelas: dónde estaba cada una un instante antes
    const before = p - 0.005;
    const rushing = altitude - logSpan(before) > 0.12;
    const earlier = rushing ? projector(camera(before), width, height) : null;
    const earlierStar = rushing ? camera(before).star : null;
    const dots = makeDots();
    const trails: Path2D[] = [new Path2D(), new Path2D()];
    NEIGHBORS.forEach((star) => {
      if (!project(cam.star[0] + star.x, cam.star[1] + star.y, point) || !onScreen(10)) return;
      const reached = star.reach < reach;
      const key = level(star.bright);
      if (key < 0) return;
      dots.add(((reached ? 3 : star.tone) * 2 + (star.big ? 1 : 0)) * LEVELS + key, point[0], point[1], star.big ? 1.8 : 1.2);
      if (earlier && earlierStar) {
        const [x1, y1] = point;
        if (!earlier(earlierStar[0] + star.x, earlierStar[1] + star.y, point)) return;
        trails[reached ? 1 : 0].moveTo(x1, y1);
        trails[reached ? 1 : 0].lineTo(point[0], point[1]);
      }
    });
    dots.fill(context, (key) => (Math.floor(key / 2) === 3 ? lit : STAR_TONES[Math.floor(key / 2)]), neighborFade);
    if (rushing) {
      context.lineCap = 'round';
      context.lineWidth = 1;
      context.globalAlpha = neighborFade * 0.55;
      context.strokeStyle = 'rgb(226, 232, 255)';
      context.stroke(trails[0]);
      context.strokeStyle = lit;
      context.stroke(trails[1]);
    }
  }

  /* Tipo III: la galaxia y la civilización que la recorre */
  const galaxyFade = seg(altitude, [-1.5, -0.5]);
  if (galaxyFade > 0.01) {
    const scale = center;
    const cos = Math.cos(cam.turn);
    const sin = Math.sin(cam.turn);
    // Matriz del plano de la galaxia a la pantalla (vista inclinada)
    const m00 = scale * cos;
    const m01 = -scale * sin;
    const m10 = scale * cam.sinPitch * sin;
    const m11 = scale * cam.sinPitch * cos;
    const unit = GAS_EXTENT / 256;
    const ox = cam.core[0] - GAS_EXTENT;
    const oy = cam.core[1] - GAS_EXTENT;
    context.save();
    context.transform(
      m00 * unit,
      m10 * unit,
      m01 * unit,
      m11 * unit,
      width / 2 + m00 * ox + m01 * oy,
      height / 2 + m10 * ox + m11 * oy,
    );
    // El gas llega después que las estrellas: de cerca sería una mancha
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = seg(altitude, [-0.9, -0.1]);
    context.drawImage(art.wild, 0, 0);
    // La galaxia habitada se revela tras el frente que sale de casa, con un
    // borde suave: se compone aparte, en el lienzo chico del gas
    const mixer = art.mix.getContext('2d');
    if (reach > 0 && mixer) {
      const hx = (HOME[0] + GAS_EXTENT) / unit;
      const hy = (HOME[1] + GAS_EXTENT) / unit;
      const front = mixer.createRadialGradient(hx, hy, 0, hx, hy, reach / unit);
      front.addColorStop(0, 'rgba(0, 0, 0, 1)');
      front.addColorStop(0.65, 'rgba(0, 0, 0, 1)');
      front.addColorStop(1, 'rgba(0, 0, 0, 0)');
      mixer.globalCompositeOperation = 'copy';
      mixer.drawImage(art.lit, 0, 0);
      mixer.globalCompositeOperation = 'destination-in';
      mixer.fillStyle = front;
      mixer.fillRect(0, 0, 512, 512);
      context.drawImage(art.mix, 0, 0);
    }
    context.restore();

    // Estrellas: frías hasta que llega la ola; en el frente destellan
    const dots = makeDots();
    GALAXY_STARS.forEach((star) => {
      if (!project(cam.core[0] + star.x, cam.core[1] + star.y, point) || !onScreen(4)) return;
      const state = star.reach > reach ? 0 : star.reach > reach * 0.82 ? 2 : 1;
      const key = level(star.bright * (state === 0 ? 0.75 : 1));
      if (key < 0) return;
      dots.add((state * 2 + (star.big ? 1 : 0)) * LEVELS + key, point[0], point[1], star.big ? 1.7 : 1.05);
    });
    dots.fill(
      context,
      (key) => {
        const state = Math.floor(key / 2);
        return state === 0 ? 'rgb(200, 212, 240)' : state === 1 ? lit : 'rgb(255, 255, 255)';
      },
      galaxyFade,
    );

    // Las rutas de la expansión, que crecen con el frente
    if (reach > 0) {
      const routes = new Path2D();
      COLONIES.forEach((colony) => {
        const grown = clamp01((reach - colony.parent.reach) / Math.max(1e-4, colony.reach - colony.parent.reach));
        if (grown <= 0) return;
        if (!project(cam.core[0] + colony.parent.x, cam.core[1] + colony.parent.y, point)) return;
        const [x1, y1] = point;
        const x = colony.parent.x + (colony.x - colony.parent.x) * grown;
        const y = colony.parent.y + (colony.y - colony.parent.y) * grown;
        if (!project(cam.core[0] + x, cam.core[1] + y, point)) return;
        routes.moveTo(x1, y1);
        routes.lineTo(point[0], point[1]);
      });
      context.globalAlpha = galaxyFade * 0.5;
      context.lineWidth = 0.8;
      context.strokeStyle = lit;
      context.stroke(routes);
    }
  }

  // Casa: un punto con su anillo, para no perderla de vista al alejarnos
  const homeFade = seg(altitude, [-2.6, -1.8]) * (1 - seg(p, KARDASHEV.open));
  if (homeFade > 0.01 && project(cam.star[0], cam.star[1], point) && onScreen(20)) {
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = homeFade;
    context.drawImage(art.accent, point[0] - 14, point[1] - 14, 28, 28);
    context.globalCompositeOperation = 'source-over';
    context.strokeStyle = lit;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(point[0], point[1], 9, 0, Math.PI * 2);
    context.stroke();
  }

  context.restore();

  // El borde de la ventana, un hilo de luz
  if (opening > 0.5) {
    context.globalAlpha = 0.8 * (1 - seg(p, [0.34, 0.45]));
    context.strokeStyle = lit;
    context.lineWidth = 1.2;
    context.beginPath();
    context.arc(width / 2, height / 2, opening, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
  }
};
