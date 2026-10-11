import { clamp01 } from './roomShared';

/* Industria: el armado de cada obra. Mientras una obra se arma, un lienzo
   (canvas) encima de ella dibuja las teselas de su imagen que llegan desde
   fuera de la pantalla, cada una en su arco, y los remolcadores que traen
   algunas. Todo va en un solo lienzo: decenas de piezas en movimiento sin
   capas ni estilos que recalcular. Al terminar, el lienzo se desvanece sobre
   la imagen real (es el mismo dibujo) y se retira.

   El lienzo va dentro de la obra, así se mueve con el scroll sin desfase;
   cubre la ventana del marco, el borde derecho de la pantalla (de donde
   salen las teselas) y lo que alcanzan sus arcos arriba y abajo. */

const seeded = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

// Grilla de la ventana 21:9 (casi cuadradas)
const COLS = 10;
const ROWS = 5;
// Una de cada tantas teselas llega remolcada
const DRONE_EVERY = 3;

// Lo propio de cada tesela, igual en todas las obras
const TILES = Array.from({ length: COLS * ROWS }, (_, index) => ({
  col: index % COLS,
  row: Math.floor(index / COLS),
  spin: ((seeded(index + 401) - 0.5) * 240 * Math.PI) / 180,
  // Salen de fuera de la pantalla
  ox: 40 + seeded(index + 607) * 260,
  tug: index % DRONE_EVERY === 1 ? Math.floor(index / DRONE_EVERY) % 3 : -1,
  // Al soltar su tesela, el remolcador gira hacia un lado y vuelve
  turn: (seeded(index + 919) > 0.5 ? 1 : -1) * (0.6 + seeded(index + 929) * 0.8),
  noise: [seeded(index + 301), seeded(index + 811), seeded(index + 503), seeded(index + 709)],
}));

/* La coreografía de cada obra: en qué orden se llena la grilla, cómo vuela
   la flota y a qué altura entra. Cada obra combina una distinta y siempre
   se arma igual */
type Order = (col: number, row: number, noise: number) => number;

const centerCol = (COLS - 1) / 2;
const centerRow = (ROWS - 1) / 2;
const ORDERS: Order[] = [
  // Barrido de izquierda a derecha
  (col) => col / (COLS - 1),
  // Desde el centro hacia afuera
  (col, row) => Math.hypot((col - centerCol) / centerCol, (row - centerRow) / centerRow * 0.6) / Math.hypot(1, 0.6),
  // Espiral desde el centro
  (col, row) => {
    const dx = (col - centerCol) / centerCol;
    const dy = (row - centerRow) / centerRow;
    const ring = Math.max(Math.abs(dx), Math.abs(dy));
    const turn = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2);
    return clamp01((ring * 3 + turn) / 4);
  },
  // Por filas, de arriba abajo
  (col, row) => (row + col / COLS) / ROWS,
  // Telar: columna a columna, alternando arriba y abajo
  (col, row) => (col + (col % 2 ? ROWS - 1 - row : row) / ROWS) / COLS,
  // Dispersa
  (_col, _row, noise) => noise,
];

interface Style {
  // Cuánto se reparte la salida, cuánto desorden, duración del vuelo y arco
  spread: number;
  jitter: number;
  flight: [number, number];
  arc: number;
  // En formación, cada tesela entra a la altura de su fila
  convoy: boolean;
}

const STYLES: Style[] = [
  // Arcos sueltos
  { spread: 1.1, jitter: 0.5, flight: [1.5, 0.9], arc: 260, convoy: false },
  // Convoy ordenado
  { spread: 1.7, jitter: 0.08, flight: [1.7, 0.15], arc: 30, convoy: true },
  // Ráfaga
  { spread: 0.5, jitter: 0.3, flight: [1.0, 0.5], arc: 420, convoy: false },
];

// Altura de entrada (fracción de pantalla respecto al centro) y cuánto se abre
const ENTRIES: [number, number][] = [[0, 0.8], [-0.28, 0.4], [0.28, 0.4]];

// De qué lado de la pantalla llega la flota: derecha, izquierda o ambos
// (cada mitad de la grilla desde su lado más cercano)
const SIDES = ['right', 'left', 'both'] as const;

interface Flight {
  launch: number;
  flight: number;
  arc: number;
  oy: number;
  // 1: entra por la derecha; -1: por la izquierda
  side: number;
}

interface Plan {
  flights: Flight[];
  end: number;
  left: boolean;
  right: boolean;
}

const plans = new Map<number, Plan>();

const planFor = (variant: number) => {
  let plan = plans.get(variant);
  if (plan) return plan;
  const order = ORDERS[variant % ORDERS.length];
  const style = STYLES[(variant + Math.floor(variant / ORDERS.length)) % STYLES.length];
  const [height, open] = ENTRIES[(variant * 2) % ENTRIES.length];
  const sides = SIDES[(variant * 2 + Math.floor(variant / 3)) % SIDES.length];
  const flights = TILES.map((tile) => {
    const [launchNoise, flightNoise, arcNoise, heightNoise] = tile.noise;
    return {
      launch: order(tile.col, tile.row, launchNoise) * style.spread + launchNoise * style.jitter,
      flight: style.flight[0] + flightNoise * style.flight[1],
      arc: (arcNoise - 0.5) * style.arc,
      oy: style.convoy
        ? height + (tile.row / (ROWS - 1) - 0.5) * open * 0.5
        : height + (heightNoise - 0.5) * open,
      side: sides === 'both' ? (tile.col < COLS / 2 ? -1 : 1) : sides === 'left' ? -1 : 1,
    };
  });
  const landed = Math.max(...flights.map((flight) => flight.launch + flight.flight));
  plan = { flights, end: landed + Math.max(COOL, LEAVE), left: sides !== 'right', right: sides !== 'left' };
  plans.set(variant, plan);
  return plan;
};

// Al calzar, la tesela se enfría; el remolcador se suelta y se va
const COOL = 0.7;
const LEAVE = 1.6;

/* Desde que la obra asoma hasta que el lienzo ya no hace falta (s) */
export const assemblyEnd = (variant: number) => planFor(variant).end;
/* Por qué lados de la pantalla llega la flota de una obra */
export const assemblySides = (variant: number) => planFor(variant);
/* Lo más que puede tardar cualquier obra */
export const ASSEMBLY_MAX = 6;

// Acelera al salir y frena al llegar
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const HOT = 'rgba(255, 148, 80, 0.3)';
const HOT_EDGE = 'rgba(255, 226, 190, 0.9)';
const HOT_GLOW = 'rgba(255, 148, 80, 0.4)';

/* Los remolcadores, en el lienzo de 40 x 30 de su diseño: miran hacia -x
   (se dibujan espejados para que miren hacia donde vuelan) */
interface TugModel {
  hull: Path2D;
  strut?: Path2D;
  seam?: Path2D;
  exhaust: Path2D;
  engines: Path2D;
}

const engines = (points: [number, number, number][]) => {
  const path = new Path2D();
  points.forEach(([x, y, r]) => {
    path.moveTo(x + r, y);
    path.arc(x, y, r, 0, Math.PI * 2);
  });
  return path;
};

let tugs: TugModel[] | null = null;
const tugModels = () => tugs ??= [
  // Doble casco
  {
    hull: new Path2D('M13 10.5 L16 8.5 H28 V12.5 H16 Z M13 19.5 L16 17.5 H28 V21.5 H16 Z'),
    strut: new Path2D('M19 12 H21.4 V18 H19 Z'),
    exhaust: new Path2D('M28 10.5 H36 M28 19.5 H36'),
    engines: engines([[28, 10.5, 1.5], [28, 19.5, 1.5]]),
  },
  // Con aletas
  {
    hull: new Path2D('M12 15 L17 10.5 H28 V19.5 H17 Z'),
    strut: new Path2D('M21 10.5 L24 5 H27 L25 10.5 Z M21 19.5 L24 25 H27 L25 19.5 Z'),
    exhaust: new Path2D('M28 12.5 H36 M28 17.5 H36'),
    engines: engines([[28, 12.5, 1.6], [28, 17.5, 1.6]]),
  },
  // Pesado, tres motores
  {
    hull: new Path2D('M11 15 L19 9.5 H28 V20.5 H19 Z'),
    seam: new Path2D('M19 9.5 V20.5'),
    exhaust: new Path2D('M28 11.5 H35 M28 15 H37 M28 18.5 H35'),
    engines: engines([[28, 11.5, 1.3], [28, 15, 1.6], [28, 18.5, 1.3]]),
  },
];

// Luz de los remolcadores: un sprite que se dibuja una vez
let glow: HTMLCanvasElement | null = null;
const glowSprite = () => {
  if (glow) return glow;
  glow = document.createElement('canvas');
  glow.width = glow.height = 48;
  const context = glow.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(24, 24, 0, 24, 24, 24);
    gradient.addColorStop(0, 'rgba(255, 214, 180, 0.55)');
    gradient.addColorStop(1, 'rgba(255, 148, 80, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 48, 48);
  }
  return glow;
};

// Las imágenes de las obras, decodificadas una vez
const images = new Map<string, HTMLImageElement>();
const imageFor = (src: string | undefined) => {
  if (!src) return null;
  let image = images.get(src);
  if (!image) {
    image = new Image();
    image.decoding = 'async';
    image.src = src;
    images.set(src, image);
  }
  return image;
};

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Assembly {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  ratio: number;
  // Esquina de la ventana dentro del lienzo (el lienzo cubre todo el ancho
  // de la pantalla: la flota puede llegar por cualquier lado)
  padLeft: number;
  padTop: number;
  width: number;
  height: number;
  opening: Box;
  image: HTMLImageElement | null;
  flights: Flight[];
}

/* Monta el lienzo sobre la obra. itemLeft: borde izquierdo de la obra en
   pantalla; screenWidth y viewport: tamaño de la pantalla */
export const startAssembly = (
  root: HTMLElement,
  opening: Box,
  itemLeft: number,
  screenWidth: number,
  viewport: number,
  src: string | undefined,
  variant: number,
): Assembly | null => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;
  const padLeft = Math.max(0, Math.floor(itemLeft + opening.left));
  const padTop = Math.round(viewport * 0.85);
  const width = Math.max(opening.width + padLeft, Math.floor(screenWidth));
  const height = Math.round(opening.height + padTop * 2);
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.className = 'mo-assembly-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  Object.assign(canvas.style, {
    left: `${opening.left - padLeft}px`,
    top: `${opening.top - padTop}px`,
    width: `${width}px`,
    height: `${height}px`,
  });
  root.appendChild(canvas);
  return { canvas, context, ratio, padLeft, padTop, width, height, opening, image: imageFor(src), flights: planFor(variant).flights };
};

/* Retira el lienzo: se desvanece sobre la imagen real y se quita */
export const endAssembly = (assembly: Assembly | null | undefined, fade = true) => {
  if (!assembly) return;
  const { canvas } = assembly;
  if (!fade) {
    canvas.remove();
    return;
  }
  canvas.classList.add('is-done');
  window.setTimeout(() => canvas.remove(), 400);
};

/* Pinta el armado. elapsed: s desde que la obra asomó; right, left, ay: de
   dónde salen las teselas (los bordes de la pantalla, a media altura)
   respecto a la esquina de la ventana */
export const drawAssembly = (assembly: Assembly, elapsed: number, right: number, left: number, ay: number, viewport: number) => {
  const { context, ratio, padLeft, padTop, opening, image, flights } = assembly;
  const tileWidth = opening.width / COLS;
  const tileHeight = opening.height / ROWS;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, assembly.canvas.width, assembly.canvas.height);

  // La imagen como la muestra el marco (cubre la ventana)
  const ready = Boolean(image?.complete && image.naturalWidth > 1);
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = 1;
  let sourceHeight = 1;
  if (ready && image) {
    const fit = Math.max(opening.width / image.naturalWidth, opening.height / image.naturalHeight);
    sourceWidth = opening.width / fit / COLS;
    sourceHeight = opening.height / fit / ROWS;
    sourceX = (image.naturalWidth - (opening.width / fit)) / 2;
    sourceY = (image.naturalHeight - (opening.height / fit)) / 2;
  }


  for (let index = 0; index < TILES.length; index++) {
    const tile = TILES[index];
    const { launch, flight, arc, oy, side } = flights[index];
    const progress = clamp01((elapsed - launch) / flight);
    if (progress <= 0) continue;
    const startX = (side > 0 ? right + tile.ox : left - tile.ox) - (tile.col + 0.5) * tileWidth;
    const startY = ay + oy * viewport - (tile.row + 0.5) * tileHeight;
    const along = (t: number) => {
      const left = 1 - easeInOut(t);
      return [startX * left, startY * left + arc * Math.sin(Math.PI * t)] as const;
    };
    const [x, y] = along(progress);
    const eased = easeInOut(progress);
    const scale = 0.45 + 0.55 * eased;
    const centerX = padLeft + (tile.col + 0.5) * tileWidth + x;
    const centerY = padTop + (tile.row + 0.5) * tileHeight + y;
    // Al rojo en vuelo; al calzar se enfría
    const since = elapsed - launch - flight;
    const heat = progress < 1 ? 1 : clamp01(1 - since / COOL);

    context.setTransform(ratio * scale, 0, 0, ratio * scale, centerX * ratio, centerY * ratio);
    if (progress < 1) context.rotate(tile.spin * (1 - eased));
    // Medio píxel de más para que no se vean juntas al calzar
    const halfWidth = tileWidth / 2 + 0.25;
    const halfHeight = tileHeight / 2 + 0.25;
    if (ready && image) {
      context.drawImage(
        image,
        sourceX + tile.col * sourceWidth,
        sourceY + tile.row * sourceHeight,
        sourceWidth,
        sourceHeight,
        -halfWidth,
        -halfHeight,
        halfWidth * 2,
        halfHeight * 2,
      );
    } else {
      context.fillStyle = '#1d2126';
      context.fillRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);
    }
    if (heat > 0) {
      context.globalAlpha = heat;
      context.fillStyle = HOT;
      context.fillRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);
      context.lineWidth = 3 / scale;
      context.strokeStyle = HOT_GLOW;
      context.strokeRect(-halfWidth + 1.5, -halfHeight + 1.5, halfWidth * 2 - 3, halfHeight * 2 - 3);
      context.lineWidth = 1 / scale;
      context.strokeStyle = HOT_EDGE;
      context.strokeRect(-halfWidth + 0.5, -halfHeight + 0.5, halfWidth * 2 - 1, halfHeight * 2 - 1);
      context.globalAlpha = 1;
    }

    if (tile.tug < 0) continue;
    // El remolcador va delante de su tesela, mirando hacia donde vuela; al
    // dejarla sigue un poco por inercia, gira hacia un lado y vuelve
    // acelerando por donde vino
    const [aheadX, aheadY] = along(Math.min(1, progress + 0.03));
    let headingX = aheadX - x;
    let headingY = aheadY - y;
    if (Math.hypot(headingX, headingY) < 0.5) {
      headingX = -startX;
      headingY = -startY;
    }
    const length = Math.hypot(headingX, headingY) || 1;
    const lead = Math.max(tileWidth, tileHeight) * 0.6 * scale + 12;
    const away = progress < 1 ? 0 : clamp01(since / LEAVE);
    if (away >= 1) continue;
    let droneX = centerX + (headingX / length) * lead;
    let droneY = centerY + (headingY / length) * lead;
    if (away > 0) {
      // Curva de regreso: sale hacia adelante, se abre hacia su lado y
      // termina de vuelta en el punto de partida, fuera de la pantalla
      const forwardX = headingX / length;
      const forwardY = headingY / length;
      const bendX = droneX + forwardX * 70 - forwardY * 110 * tile.turn;
      const bendY = droneY + forwardY * 70 + forwardX * 110 * tile.turn;
      const endX = centerX + startX;
      const endY = centerY + startY;
      const u = away * away;
      const fromX = droneX;
      const fromY = droneY;
      droneX = (1 - u) * (1 - u) * fromX + 2 * (1 - u) * u * bendX + u * u * endX;
      droneY = (1 - u) * (1 - u) * fromY + 2 * (1 - u) * u * bendY + u * u * endY;
      headingX = 2 * (1 - u) * (bendX - fromX) + 2 * u * (endX - bendX);
      headingY = 2 * (1 - u) * (bendY - fromY) + 2 * u * (endY - bendY);
    }
    if (away <= 0) {
      // El cable, desde la popa hasta la tesela
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.strokeStyle = 'rgba(255, 240, 222, 0.45)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(droneX - (headingX / length) * 14, droneY - (headingY / length) * 14);
      context.lineTo(centerX, centerY);
      context.stroke();
    }
    const angle = Math.atan2(headingY, headingX);
    context.setTransform(ratio, 0, 0, ratio, droneX * ratio, droneY * ratio);
    context.rotate(angle);
    // Se apaga al final, ya lejos
    context.globalAlpha = 1 - clamp01((away - 0.7) / 0.3);
    drawTug(context, tile.tug);
    context.globalAlpha = 1;
  }
};

/* Un remolcador con su luz, ya colocado (la transformación del lienzo lo
   pone en su sitio, mirando hacia +x) */
export const drawTug = (context: CanvasRenderingContext2D, model: number) => {
  context.drawImage(glowSprite(), -18, -18, 36, 36);
  context.scale(-0.9, 0.9);
  context.translate(-20, -15);
  const tug = tugModels()[model % 3];
  context.lineCap = 'round';
  context.strokeStyle = 'rgba(255, 178, 122, 0.7)';
  context.lineWidth = 1.6;
  context.stroke(tug.exhaust);
  if (tug.strut) {
    context.fillStyle = '#aab3bf';
    context.fill(tug.strut);
  }
  context.fillStyle = '#e9eef5';
  context.fill(tug.hull);
  if (tug.seam) {
    context.strokeStyle = '#9aa3ae';
    context.lineWidth = 0.8;
    context.stroke(tug.seam);
  }
  context.fillStyle = '#ffcf9e';
  context.fill(tug.engines);
};
