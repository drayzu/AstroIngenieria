import { clamp, clamp01, smoothstep } from './roomShared';

/* Hábitats: la rueda que recorre la sala. Las obras van en una cubierta
   interior que pasa por el centro de la pantalla; el eje queda fuera, a la
   derecha. Un lienzo detrás del muro dibuja lo que hace legible la rueda:
   el casco por fuera de las obras, el mástil de cada obra que va al eje
   y el resplandor del cubo cuando está cerca.

   La rueda crece con la sala: cada obra trae su radio (de la ISS al
   Ringworld) y entre una y otra se interpola, así la curva se abre a medida
   que los hábitats son más grandes. Lo que va montado en la rueda está fijo
   a la sala (sube con el scroll como las obras); el lienzo solo se pinta
   mientras hay scroll. */

// Radio de la rueda en cada obra, en pantallas de alto: de la primera
// estación al penúltimo hábitat crece en escala geométrica; el último
// (el Ringworld) es casi una línea recta
const FIRST_RADIUS = 1.3;
const LAST_RADIUS = 5.5;
const FINAL_RADIUS = 16;
// En pantallas angostas la rueda es más grande: las obras ocupan todo el ancho
const NARROW = 1.8;

// Juntas del casco, cada tantos píxeles de sala
const MODULE_STEP = 90;

export interface WheelStop {
  at: number;
  radius: number;
}

/* Radio de cada obra según su centro en la sala (px) */
export const wheelStops = (centers: number[], viewport: number, narrow: boolean): WheelStop[] => {
  const scale = viewport * (narrow ? NARROW : 1);
  const last = centers.length - 1;
  return centers.map((at, index) => {
    const t = last > 1 ? Math.min(1, index / (last - 1)) : 0;
    const radius = index === last && last > 0 ? FINAL_RADIUS : FIRST_RADIUS * (LAST_RADIUS / FIRST_RADIUS) ** t;
    return { at, radius: radius * scale };
  });
};

/* Radio en un punto de la sala: entre dos obras crece en escala geométrica */
export const wheelRadius = (stops: WheelStop[], at: number) => {
  if (!stops.length) return 1;
  if (at <= stops[0].at) return stops[0].radius;
  for (let index = 1; index < stops.length; index++) {
    const next = stops[index];
    if (at > next.at) continue;
    const previous = stops[index - 1];
    const t = smoothstep(0, 1, (at - previous.at) / (next.at - previous.at || 1));
    return previous.radius * (next.radius / previous.radius) ** t;
  }
  return stops[stops.length - 1].radius;
};

/* Los radios se apagan al acercarse al último: el Ringworld no tiene */
export const wheelSpokes = (stops: WheelStop[], radius: number) => {
  if (stops.length < 2) return 1;
  const before = stops[stops.length - 2].radius;
  return 1 - smoothstep(before, before * 1.8, radius);
};

export interface Wheel {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  ratio: number;
  width: number;
  height: number;
  accent: string;
  glow: HTMLCanvasElement;
}

const rgb = (color: string) => {
  const hex = color.trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return '201, 168, 106';
  return [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(', ');
};

/* Ajusta el lienzo a la pantalla. left: borde izquierdo de su caja en pantalla */
export const sizeWheel = (canvas: HTMLCanvasElement, left: number, width: number, height: number, accent: string, previous: Wheel | null): Wheel | null => {
  const context = canvas.getContext('2d');
  if (!context) return null;
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  Object.assign(canvas.style, { left: `${-left}px`, width: `${width}px`, height: `${height}px` });
  const color = rgb(accent);
  let glow = previous?.glow;
  if (!glow || previous?.accent !== color) {
    // Resplandor del cubo: un sprite que se dibuja una vez
    glow = document.createElement('canvas');
    glow.width = glow.height = 256;
    const sprite = glow.getContext('2d');
    if (sprite) {
      const gradient = sprite.createRadialGradient(128, 128, 0, 128, 128, 128);
      gradient.addColorStop(0, `rgba(${color}, 0.42)`);
      gradient.addColorStop(0.18, `rgba(${color}, 0.16)`);
      gradient.addColorStop(0.5, `rgba(${color}, 0.05)`);
      gradient.addColorStop(1, `rgba(${color}, 0)`);
      sprite.fillStyle = gradient;
      sprite.fillRect(0, 0, 256, 256);
    }
  }
  return { canvas, context, ratio, width, height, accent: color, glow };
};

interface WheelFrame {
  // Punto de la sala que queda en el centro de la pantalla
  center: number;
  radius: number;
  // Distancia del casco a la cubierta de las obras (px)
  gap: number;
  // Cuánto se ven los mástiles (0 en el Ringworld)
  spokes: number;
  // Centro de cada obra en la sala: ahí va su mástil
  masts: number[];
}

export const drawWheel = (wheel: Wheel, { center, radius, gap, spokes, masts }: WheelFrame) => {
  const { context, ratio, width, height, accent, glow } = wheel;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, wheel.canvas.width, wheel.canvas.height);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const cx = width / 2 + radius;
  const cy = height / 2;
  const hull = radius + gap;
  const band = clamp(height * 0.06, 26, 46);
  // Lo montado en la rueda: su ángulo según su sitio en la sala
  const angleAt = (at: number) => Math.PI - (at - center) / radius;

  // El cubo brilla mientras está cerca del borde de la pantalla
  const beyond = cx - width;
  const glowSize = height * 0.75;
  if (beyond < glowSize) {
    context.globalAlpha = clamp01(1 - beyond / glowSize);
    context.drawImage(glow, cx - glowSize, cy - glowSize, glowSize * 2, glowSize * 2);
    context.globalAlpha = 1;
  }

  // Mástiles: cada obra cuelga del suyo, una viga doble que va del casco
  // al cubo pasando por su centro y gira con ella
  if (spokes > 0.01) {
    const reach = radius * 1.1;
    context.beginPath();
    for (const at of masts) {
      if (Math.abs(at - center) > reach) continue;
      const angle = angleAt(at);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const outer = hull - band;
      const inner = radius * 0.08;
      for (const side of [-3, 3]) {
        context.moveTo(cx + cos * outer - sin * side, cy + sin * outer + cos * side);
        context.lineTo(cx + cos * inner - sin * side, cy + sin * inner + cos * side);
      }
    }
    // Un halo ancho y la viga fina encima
    context.strokeStyle = `rgba(${accent}, ${(0.07 * spokes).toFixed(3)})`;
    context.lineWidth = 9;
    context.stroke();
    context.strokeStyle = `rgba(${accent}, ${(0.5 * spokes).toFixed(3)})`;
    context.lineWidth = 1;
    context.stroke();
  }

  // El casco: solo el arco que cabe en la pantalla
  const half = Math.asin(Math.min(1, (height / 2 + band * 2) / hull));
  const from = Math.PI - half;
  const to = Math.PI + half;
  context.beginPath();
  context.arc(cx, cy, hull, from, to);
  context.arc(cx, cy, hull - band, to, from, true);
  context.closePath();
  context.fillStyle = 'rgba(4, 8, 10, 0.86)';
  context.fill();

  // Piel exterior iluminada, borde interior en sombra y un riel por dentro
  const ring = (r: number, alpha: number, line: number) => {
    context.strokeStyle = `rgba(${accent}, ${alpha})`;
    context.lineWidth = line;
    context.beginPath();
    context.arc(cx, cy, r, from, to);
    context.stroke();
  };
  ring(hull, 0.62, 1.5);
  ring(hull - band, 0.28, 1);
  ring(hull - band - 12, 0.12, 1);

  // Juntas entre módulos: trazos finos a través del casco
  const span = (height / 2 + band * 2) * (radius / hull);
  context.strokeStyle = `rgba(${accent}, 0.2)`;
  context.lineWidth = 1;
  context.beginPath();
  for (let index = Math.floor((center - span) / MODULE_STEP); index <= Math.ceil((center + span) / MODULE_STEP); index++) {
    const angle = angleAt(index * MODULE_STEP);
    context.moveTo(cx + Math.cos(angle) * hull, cy + Math.sin(angle) * hull);
    context.lineTo(cx + Math.cos(angle) * (hull - band), cy + Math.sin(angle) * (hull - band));
  }
  context.stroke();
};
