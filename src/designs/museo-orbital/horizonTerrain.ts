/* Suelo del planeta que se terraforma: un mapa de alturas procedural que se
   repite en horizontal, aplanado en vertical como visto de lejos, y pintado
   como una trama fina de puntos en tres capas que se funden con el avance:

   - barren: el desierto oxidado; el punto crece y brilla con la altura
   - water: los mares, planos y oscuros, que llenan las zonas bajas
   - life: la tierra firme en verde, con nieve en las cumbres

   Se genera una vez, por tramos para no trabar el scroll, y queda en caché. */

export const TERRAIN_WIDTH = 1024;
export const TERRAIN_HEIGHT = 240;
// El relieve se ve de lejos: lo que avanza hacia el fondo se comprime
const SQUASH = 0.42;
const DENSITY = 2;

// Nivel del mar y de la nieve en la escala de alturas
const SEA = 0.485;
const SNOW = 0.74;

export interface TerrainTiles {
  barren: string;
  water: string;
  life: string;
}

const hash = (x: number, y: number, seed: number) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
};

// Ruido de valor periódico en x: el mosaico empalma sin costura
const noise = (x: number, y: number, period: number, seed: number) => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const xa = ((x0 % period) + period) % period;
  const xb = (xa + 1) % period;
  const a = hash(xa, y0, seed);
  const b = hash(xb, y0, seed);
  const c = hash(xa, y0 + 1, seed);
  const d = hash(xb, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};

// Cede el hilo entre tramos; un mensaje no se frena como un temporizador
// cuando la pestaña queda en segundo plano
const tick = () => new Promise<void>((resolve) => {
  const channel = new MessageChannel();
  channel.port1.onmessage = () => resolve();
  channel.port2.postMessage(null);
});

// Promedio móvil separable; empalma en x y se recorta en y
const blur = async (map: Float32Array, radiusX: number, radiusY: number) => {
  const width = TERRAIN_WIDTH;
  const height = TERRAIN_HEIGHT;
  const row = new Float32Array(width);
  for (let y = 0; y < height; y++) {
    const offset = y * width;
    let sum = 0;
    for (let dx = -radiusX; dx <= radiusX; dx++) sum += map[offset + ((dx + width) % width)];
    for (let x = 0; x < width; x++) {
      row[x] = sum / (radiusX * 2 + 1);
      sum += map[offset + ((x + radiusX + 1) % width)] - map[offset + ((x - radiusX + width) % width)];
    }
    map.set(row, offset);
  }
  await tick();
  const column = new Float32Array(height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let sum = 0;
      let count = 0;
      for (let dy = Math.max(0, y - radiusY); dy <= Math.min(height - 1, y + radiusY); dy++) {
        sum += map[dy * width + x];
        count++;
      }
      column[y] = sum / count;
    }
    for (let y = 0; y < height; y++) map[y * width + x] = column[y];
  }
};

const heightmap = async () => {
  const width = TERRAIN_WIDTH;
  const height = TERRAIN_HEIGHT;
  const map = new Float32Array(width * height);
  const cells = 6;
  const scale = cells / width;
  for (let y = 0; y < height; y++) {
    const depth = y / SQUASH;
    for (let x = 0; x < width; x++) {
      let value = 0;
      let amplitude = 0.5;
      let frequency = 1;
      for (let octave = 0; octave < 4; octave++) {
        value += amplitude * noise(x * scale * frequency, depth * scale * frequency, cells * frequency, octave + 7);
        amplitude *= 0.5;
        frequency *= 2;
      }
      map[y * width + x] = value;
    }
    if (y % 40 === 39) await tick();
  }

  // Cráteres: cuenco hundido con un borde levantado, que empalman en x
  for (let index = 0; index < 14; index++) {
    const cx = hash(index, 1, 91) * width;
    const cy = hash(index, 2, 91) * height;
    const radius = 8 + hash(index, 3, 91) ** 3 * 52;
    const depth = 0.05 + hash(index, 4, 91) * 0.05;
    const reachX = Math.ceil(radius * 1.6);
    const reachY = Math.ceil(radius * 1.6 * SQUASH);
    for (let dy = -reachY; dy <= reachY; dy++) {
      const y = Math.round(cy) + dy;
      if (y < 0 || y >= height) continue;
      for (let dx = -reachX; dx <= reachX; dx++) {
        const x = (((Math.round(cx) + dx) % width) + width) % width;
        const r = Math.hypot(dx, dy / SQUASH) / radius;
        if (r > 1.6) continue;
        const bowl = r < 1 ? -depth * (1 - r * r) : 0;
        const rim = depth * 0.55 * Math.exp(-(((r - 1) / 0.18) ** 2));
        map[y * width + x] += bowl + rim;
      }
    }
  }
  // Suavizado: sin islotes de un par de píxeles ni puntas, las costas quedan
  // largas y tranquilas
  for (let pass = 0; pass < 2; pass++) {
    await blur(map, 5, 2);
  }
  return map;
};

const layer = () => {
  const canvas = document.createElement('canvas');
  canvas.width = TERRAIN_WIDTH * DENSITY;
  canvas.height = TERRAIN_HEIGHT * DENSITY;
  return { canvas, context: canvas.getContext('2d')! };
};

/* Rellena un lado de un nivel de altura a la resolución final, con un borde
   antialias de un píxel */
const fill = async (context: CanvasRenderingContext2D, map: Float32Array, color: number[], level: number, above: boolean) => {
  const width = TERRAIN_WIDTH;
  const height = TERRAIN_HEIGHT;
  const image = context.createImageData(width * DENSITY, height * DENSITY);
  for (let py = 0; py < height * DENSITY; py++) {
    const my = Math.min(height - 1.001, Math.max(0, (py + 0.5) / DENSITY));
    const y0 = Math.floor(my);
    const fy = my - y0;
    for (let px = 0; px < width * DENSITY; px++) {
      const mx = (px + 0.5) / DENSITY;
      const x0 = Math.floor(mx);
      const fx = mx - x0;
      const xa = (x0 + width) % width;
      const xb = (xa + 1) % width;
      const a = map[y0 * width + xa];
      const b = map[y0 * width + xb];
      const c = map[(y0 + 1) * width + xa];
      const d = map[(y0 + 1) * width + xb];
      const value = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
      // Antialias de un píxel: la pendiente local dice cuánto cambia por píxel
      const slope = (Math.abs(b - a) + Math.abs(c - a)) / DENSITY + 1e-5;
      const amount = Math.min(1, Math.max(0, 0.5 + ((above ? 1 : -1) * (value - level)) / slope));
      if (amount <= 0) continue;
      const out = (py * width * DENSITY + px) * 4;
      image.data[out] = color[0];
      image.data[out + 1] = color[1];
      image.data[out + 2] = color[2];
      image.data[out + 3] = color[3] * amount;
    }
    if (py % 60 === 59) await tick();
  }
  const scratch = document.createElement('canvas');
  scratch.width = width * DENSITY;
  scratch.height = height * DENSITY;
  scratch.getContext('2d')!.putImageData(image, 0, 0);
  context.drawImage(scratch, 0, 0);
};

const toUrl = (canvas: HTMLCanvasElement) => new Promise<string>((resolve) => {
  canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL()), 'image/png');
});

// Altura interpolada en cualquier punto del mosaico
const sample = (map: Float32Array, x: number, y: number) => {
  const width = TERRAIN_WIDTH;
  const my = Math.min(TERRAIN_HEIGHT - 1.001, Math.max(0, y));
  const y0 = Math.floor(my);
  const fy = my - y0;
  const x0 = Math.floor(x);
  const fx = x - x0;
  const xa = ((x0 % width) + width) % width;
  const xb = (xa + 1) % width;
  const a = map[y0 * width + xa];
  const b = map[y0 * width + xb];
  const c = map[(y0 + 1) * width + xa];
  const d = map[(y0 + 1) * width + xb];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};

const smooth = (from: number, to: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

const RUST = '232, 156, 108';
const GREEN = '156, 210, 136';
const SNOWY = '236, 242, 246';
const SEA_FILL = [9, 24, 40, 255];

/* La trama: puntos finos en tresbolillo. Cada fila reparte un número entero
   de puntos en el ancho del mosaico, así empalma sin costura */
const STEP = 4;
const RADIUS: [number, number] = [0.3, 0.85];
const ALPHA: [number, number] = [0.22, 0.7];
const TONES = 16;

/* Los puntos se agrupan por color y opacidad (redondeada a TONES pasos) y
   cada grupo se rellena de una sola vez */
const dots = () => {
  const groups = new Map<string, Path2D>();
  return {
    add(x: number, y: number, radius: number, color: string, alpha: number) {
      const key = `rgba(${color}, ${(Math.round(alpha * TONES) / TONES).toFixed(3)})`;
      let path = groups.get(key);
      if (!path) {
        path = new Path2D();
        groups.set(key, path);
      }
      path.moveTo((x + radius) * DENSITY, y * DENSITY);
      path.arc(x * DENSITY, y * DENSITY, radius * DENSITY, 0, Math.PI * 2);
    },
    paint(context: CanvasRenderingContext2D) {
      groups.forEach((path, color) => {
        context.fillStyle = color;
        context.fill(path);
      });
    },
  };
};

const paint = async (map: Float32Array) => {
  const barren = layer();
  const water = layer();
  const life = layer();
  // Los mares: planos y oscuros, sin puntos; la costa es donde la trama acaba
  await fill(water.context, map, SEA_FILL, SEA, false);

  const desert = dots();
  const land = dots();
  const count = Math.round(TERRAIN_WIDTH / STEP);
  const step = TERRAIN_WIDTH / count;
  const [low, high] = RADIUS;
  const [faint, bright] = ALPHA;
  for (let row = 0, y = step * 0.4; y < TERRAIN_HEIGHT; row++, y += step * 0.62) {
    const shift = row % 2 ? step / 2 : 0;
    for (let column = 0; column < count; column++) {
      const x = column * step + shift;
      const h = sample(map, x, y);
      // Desierto: el punto crece y se enciende con la altura
      const rise = smooth(0.25, 0.75, h);
      desert.add(x, y, low + (high - low) * rise, RUST, faint + (bright - faint) * rise);
      if (h < SEA) continue;
      // Tierra viva: hasta la costa tiene punto visible, así se lee entera
      const green = 0.35 + 0.65 * smooth(SEA, 0.7, h);
      land.add(x, y, low + (high - low) * green, h > SNOW ? SNOWY : GREEN, faint + (bright - faint) * green);
    }
  }
  desert.paint(barren.context);
  await tick();
  land.paint(life.context);

  const [barrenUrl, waterUrl, lifeUrl] = await Promise.all([barren, water, life].map((item) => toUrl(item.canvas)));
  return { barren: barrenUrl, water: waterUrl, life: lifeUrl };
};

let pending: Promise<TerrainTiles> | null = null;

export const terrainTiles = () => {
  pending ??= heightmap().then(paint);
  return pending;
};
