import { lockSmoothScroll } from '../shared/smoothScroll';
import './obraFlight.css';

/* Entrar en el cuadro.

   Al abrir una obra, la cámara avanza hacia ella: la pared se agranda y se
   apaga, el marco (más cerca) pasa por los bordes de la pantalla y la imagen
   (más al fondo) crece más lento, descubre lo que el marco recortaba y se
   posa en la sala de estudio. Al cerrar, el mismo viaje hacia atrás: el
   marco vuelve a entrar desde los bordes y la obra se cuelga en su pared.

   Todo corre en el compositor:
   - la pared es la captura de la página que hace la View Transition (una
     textura: agrandarla no cuesta raster ni layout);
   - el marco y la imagen son una capa con nombre propio dentro de la
     transición, animada con WAAPI (transform y opacidad), así que un render
     largo de React a mitad del viaje no la frena.
   Sin View Transitions o con movimiento reducido, la sala se abre como antes. */

type Mat = number[];
type Pt = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };
type Track = [number, number][];

const FLIGHT_NAME = 'mo-obra-flight';
const ENTER_MS = 1100;
const EXIT_MS = 900;
const SAMPLES = 52;
// Giro de cámara (rad) en mitad del viaje: el paso de una mano, no un tirabuzón
const ROLL = 0.02;
// Cuánto más allá de "apenas cubrir la pantalla" llega el marco al final:
// más alto, antes cruza los bordes; cerca de 1, los cruza al posarse
const CLEAR = 1.7;

/* ---------- Álgebra de planos (homografías 3×3, por filas) ---------- */

const mul = (a: Mat, b: Mat): Mat => {
  const r = new Array<number>(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    }
  }
  return r;
};

const chain = (...ms: Mat[]) => ms.reduce((acc, m) => mul(acc, m));

const invert = (m: Mat): Mat => {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const k = 1 / (a * A + b * B + c * C);
  return [
    A * k, -(b * i - c * h) * k, (b * f - c * e) * k,
    B * k, (a * i - c * g) * k, -(a * f - c * d) * k,
    C * k, -(a * h - b * g) * k, (a * e - b * d) * k,
  ];
};

const translate = (x: number, y: number): Mat => [1, 0, x, 0, 1, y, 0, 0, 1];
const scale = (sx: number, sy = sx): Mat => [sx, 0, 0, 0, sy, 0, 0, 0, 1];
const scaleAbout = (sx: number, sy: number, c: Pt): Mat =>
  [sx, 0, c.x - sx * c.x, 0, sy, c.y - sy * c.y, 0, 0, 1];
const rotateAbout = (angle: number, c: Pt): Mat => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cos, -sin, c.x - cos * c.x + sin * c.y, sin, cos, c.y - sin * c.x - cos * c.y, 0, 0, 1];
};

const project = (m: Mat, x: number, y: number): Pt => {
  const w = m[6] * x + m[7] * y + m[8];
  return { x: (m[0] * x + m[1] * y + m[2]) / w, y: (m[3] * x + m[4] * y + m[5]) / w };
};

const corners = (m: Mat, r: Rect): Pt[] => [
  project(m, r.x, r.y), project(m, r.x + r.w, r.y),
  project(m, r.x + r.w, r.y + r.h), project(m, r.x, r.y + r.h),
];

const normalized = (m: Mat) => m.map(v => v / m[8]);

/* Plano de w×h cuyas esquinas caen en el cuadrilátero (tl, tr, br, bl) */
const rectToQuad = (w: number, h: number, q: Pt[]): Mat => {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;
  let g = 0;
  let h2 = 0;
  if (Math.abs(dx3) > 1e-6 || Math.abs(dy3) > 1e-6) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h2 = (dx1 * dy3 - dx3 * dy1) / den;
  }
  const square: Mat = [
    p1.x - p0.x + g * p1.x, p3.x - p0.x + h2 * p3.x, p0.x,
    p1.y - p0.y + g * p1.y, p3.y - p0.y + h2 * p3.y, p0.y,
    g, h2, 1,
  ];
  return mul(square, scale(1 / w, 1 / h));
};

const hasPerspective = (m: Mat) => {
  const n = normalized(m);
  return Math.abs(n[6]) > 1e-7 || Math.abs(n[7]) > 1e-7;
};

const toCss = (m: Mat, perspective = hasPerspective(m)) => {
  const n = normalized(m).map(v => (Math.abs(v) < 1e-12 ? 0 : v));
  if (!perspective) return `matrix(${n[0]},${n[3]},${n[1]},${n[4]},${n[2]},${n[5]})`;
  return `matrix3d(${n[0]},${n[3]},0,${n[6]},${n[1]},${n[4]},0,${n[7]},0,0,1,0,${n[2]},${n[5]},0,1)`;
};

/* ---------- Curvas ---------- */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, t: number) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};

const bezier = (x1: number, y1: number, x2: number, y2: number) => (t: number) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  let lo = 0;
  let hi = 1;
  let s = t;
  for (let i = 0; i < 30; i++) {
    const x = ((ax * s + bx) * s + cx) * s;
    if (Math.abs(x - t) < 1e-7) break;
    if (x < t) lo = s;
    else hi = s;
    s = (lo + hi) / 2;
  }
  return ((ay * s + by) * s + cy) * s;
};

// Entrada: arranca con calma, empuja y se posa largo, como un dolly
const ENTER_DOLLY = bezier(0.5, 0, 0.2, 1);
const ENTER_PAN = bezier(0.42, 0, 0.22, 1);
// Salida: retrocede con decisión y frena al colgarse otra vez en la pared
const EXIT_DOLLY = bezier(0.3, 0, 0.18, 1);
const EXIT_PAN = bezier(0.3, 0, 0.22, 1);

const sampleTrack = (tr: Track, t: number) => {
  if (t <= tr[0][0]) return tr[0][1];
  for (let i = 1; i < tr.length; i++) {
    if (t <= tr[i][0]) return lerp(tr[i - 1][1], tr[i][1], smooth(tr[i - 1][0], tr[i][0], t));
  }
  return tr[tr.length - 1][1];
};

/* ---------- Medición ---------- */

/* Esquinas reales en pantalla de la caja de relleno de un elemento, con
   todas las transformaciones de sus ancestros (pasillos en perspectiva,
   la rueda…): cuatro sondas de tamaño cero que se miden y se retiran */
const probeQuad = (el: HTMLElement) => {
  const w = el.clientWidth;
  const h = el.clientHeight;
  const probes = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => {
    const probe = document.createElement('i');
    probe.style.cssText =
      `position:absolute;left:${x}px;top:${y}px;width:0;height:0;margin:0;padding:0;border:0;display:block;pointer-events:none`;
    el.appendChild(probe);
    return probe;
  });
  const quad = probes.map((probe) => {
    const r = probe.getBoundingClientRect();
    return { x: r.left, y: r.top };
  });
  probes.forEach(probe => probe.remove());
  return { w, h, quad, H: rectToQuad(w, h, quad) };
};

const insideConvex = (q: Pt[], p: Pt) => {
  let sign = 0;
  for (let i = 0; i < q.length; i++) {
    const a = q[i];
    const b = q[(i + 1) % q.length];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (Math.abs(cross) < 1e-9) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
};

const visibleShare = (q: Pt[]) => {
  const xs = q.map(p => p.x);
  const ys = q.map(p => p.y);
  const area = Math.max(1, (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)));
  const w = Math.min(window.innerWidth, Math.max(...xs)) - Math.max(0, Math.min(...xs));
  const h = Math.min(window.innerHeight, Math.max(...ys)) - Math.max(0, Math.min(...ys));
  return (Math.max(0, w) * Math.max(0, h)) / area;
};

/* Rectángulo que ocupa una imagen con object-fit dentro de su caja */
const fitRect = (box: Rect, w: number, h: number, mode: 'cover' | 'contain'): Rect => {
  if (!(w > 0 && h > 0)) return box;
  const k = mode === 'cover' ? Math.max(box.w / w, box.h / h) : Math.min(box.w / w, box.h / h);
  return { x: box.x + (box.w - w * k) / 2, y: box.y + (box.h - h * k) / 2, w: w * k, h: h * k };
};

const parseTranslate = (value: string) => {
  if (!value || value === 'none') return { x: 0, y: 0 };
  const [x = '0', y = '0'] = value.split(/\s+/);
  return { x: parseFloat(x) || 0, y: parseFloat(y) || 0 };
};

export const obraFlightSupported = () =>
  typeof document !== 'undefined' &&
  typeof document.startViewTransition === 'function' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Lo que se ve de la obra en la pared en el instante del clic */
type Source = {
  frame: { w: number; h: number; H: Mat; bg: string; line: string };
  // la ventana del marco, en coordenadas del marco
  window: Rect;
  // la imagen visible (cover) como plano: local → pantalla
  image: { src: string; natural: { w: number; h: number }; G: Mat; size: { w: number; h: number } } | null;
  virtual: boolean;
};

const findCard = (conceptId: string, scope: 'journey' | 'vitrine') => {
  const id = CSS.escape(conceptId);
  const selector = scope === 'vitrine'
    ? `.mo-vitrina-card[data-concept-id="${id}"]`
    : `.mo-obra[data-concept-id="${id}"]`;
  let best: HTMLElement | null = null;
  let bestShare = 0.3;
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    const share = visibleShare([
      { x: r.left, y: r.top }, { x: r.right, y: r.top }, { x: r.right, y: r.bottom }, { x: r.left, y: r.bottom },
    ]);
    if (share > bestShare) {
      best = el;
      bestShare = share;
    }
  });
  return best as HTMLElement | null;
};

const measureSource = (card: HTMLElement): Source | null => {
  const frameEl = card.querySelector<HTMLElement>('.mo-frame') ?? (card.matches('.mo-vitrina-card') ? card : null);
  if (!frameEl) return null;
  const frame = probeQuad(frameEl);
  if (frame.w < 8 || frame.h < 8 || visibleShare(frame.quad) < 0.3) return null;
  const style = getComputedStyle(frameEl);
  const maskEl = frameEl.querySelector<HTMLElement>('.mo-frame-mask');
  const win: Rect = maskEl
    ? { x: maskEl.offsetLeft, y: maskEl.offsetTop, w: maskEl.clientWidth, h: maskEl.clientHeight }
    : { x: 0, y: 0, w: frame.w, h: frame.h };

  let image: Source['image'] = null;
  const zoomEl = maskEl?.querySelector<HTMLElement>('.mo-frame-zoom');
  // La alternativa que cicla con el hover queda encima de la principal
  const shown = zoomEl
    ? Array.from(zoomEl.querySelectorAll<HTMLImageElement>(':scope > img'))
      .filter(img => img.complete && img.naturalWidth > 1 && getComputedStyle(img).opacity !== '0')
      .pop()
    : undefined;
  if (zoomEl && shown && zoomEl.classList.contains('is-developed')) {
    const zoom = probeQuad(zoomEl);
    const shift = parseTranslate(getComputedStyle(shown).translate);
    const cover = fitRect({ x: shift.x, y: shift.y, w: zoom.w, h: zoom.h }, shown.naturalWidth, shown.naturalHeight, 'cover');
    image = {
      src: shown.currentSrc || shown.src,
      natural: { w: shown.naturalWidth, h: shown.naturalHeight },
      G: chain(zoom.H, translate(cover.x, cover.y)),
      size: { w: cover.w, h: cover.h },
    };
  }

  const bg = style.backgroundColor;
  return {
    frame: {
      w: frame.w,
      h: frame.h,
      H: frame.H,
      bg: bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#0d0d0c',
      line: style.borderTopColor || 'rgba(245, 241, 232, 0.13)',
    },
    window: win,
    image,
    virtual: false,
  };
};

/* Si la obra ya no está a la vista (se avanzó a otra sala de estudio), la
   cámara retrocede hacia un marco lejano en el centro que se desvanece */
const virtualSource = (image: Rect): Source => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Lejos: la obra se achica hasta volverse una estrella en el centro
  const w = Math.min(150, vw * 0.14);
  const h = (w * image.h) / Math.max(1, image.w);
  const pad = 10;
  return {
    frame: {
      w: w + pad * 2,
      h: h + pad * 2,
      H: translate((vw - w) / 2 - pad, (vh - h) / 2 - pad),
      bg: '#0d0d0c',
      line: 'rgba(245, 241, 232, 0.13)',
    },
    window: { x: pad, y: pad, w, h },
    image: null,
    virtual: true,
  };
};

type StudioImage = { rect: Rect; src: string | null; natural?: { w: number; h: number } };

/* La imagen de la sala de estudio: su rectángulo real (cover, 21:9) en pantalla */
const measureStudioImage = (fallbackNatural?: { w: number; h: number }): StudioImage | null => {
  const figure = document.querySelector<HTMLElement>('.mo-studio .mo-studio-figure');
  if (!figure) return null;
  const img = Array.from(figure.querySelectorAll<HTMLImageElement>('.mo-studio-zoomer img')).pop();
  if (img) {
    const r = img.getBoundingClientRect();
    const natural = img.naturalWidth > 1 ? { w: img.naturalWidth, h: img.naturalHeight } : fallbackNatural;
    const box = { x: r.left, y: r.top, w: r.width, h: r.height };
    return { rect: natural ? fitRect(box, natural.w, natural.h, 'cover') : box, src: img.currentSrc || img.src, natural };
  }
  const r = (figure.querySelector<HTMLElement>('.mo-image-pending') ?? figure).getBoundingClientRect();
  return { rect: { x: r.left, y: r.top, w: r.width, h: r.height }, src: null };
};

/* ---------- Estelas de velocidad (una textura que se dibuja una vez) ---------- */

let streakCache: { key: string; canvas: HTMLCanvasElement } | null = null;

const streakTexture = (size: number, accent: string) => {
  const key = `${size}|${accent}`;
  if (streakCache?.key === key) return streakCache.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const c = size / 2;
  let seed = 1013;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 220; i++) {
    const angle = rand() * Math.PI * 2;
    const r0 = c * (0.1 + Math.pow(rand(), 0.7) * 0.86);
    const length = r0 * (0.1 + rand() * 0.34);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x0 = c + cos * r0;
    const y0 = c + sin * r0;
    const tinted = rand() < 0.28;
    const alpha = 0.16 + rand() * 0.5;
    const gradient = ctx.createLinearGradient(x0, y0, c + cos * (r0 + length), c + sin * (r0 + length));
    gradient.addColorStop(0, 'rgba(245, 241, 232, 0)');
    gradient.addColorStop(1, tinted ? accent : `rgba(245, 241, 232, ${alpha.toFixed(3)})`);
    ctx.globalAlpha = tinted ? alpha + 0.15 : 1;
    ctx.strokeStyle = gradient;
    ctx.lineWidth = (0.5 + rand() * 1.3) * (0.55 + r0 / c);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(c + cos * (r0 + length), c + sin * (r0 + length));
    ctx.stroke();
  }
  streakCache = { key, canvas };
  return canvas;
};

/* ---------- El viaje ---------- */

type Geometry = {
  vw: number;
  vh: number;
  source: Source;
  target: Rect;
  imageRest: Mat; // plano de la imagen (con su tamaño final) sobre la pared
  imageFlat: Mat; // el mismo, sin inclinación
  imageCenter: Pt;
  c: Pt; // centro de la ventana: hacia ahí avanza la cámara
  zEnd: number;
  depth: number; // profundidad del marco (la imagen está en 1)
  residual: Pt;
  pan: Pt;
  rollSign: number;
  windowQuad: Pt[];
  screen: Pt[];
};

const buildGeometry = (source: Source, target: Rect): Geometry => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const { frame, window: win } = source;

  // Plano de la imagen con el tamaño que tendrá en la sala: nítida al final
  const imageRest = source.image
    ? chain(source.image.G, scale(source.image.size.w / target.w, source.image.size.h / target.h))
    : (() => {
      const fit = fitRect(win, target.w, target.h, 'cover');
      return chain(frame.H, translate(fit.x, fit.y), scale(fit.w / target.w, fit.h / target.h));
    })();

  const q = corners(imageRest, { x: 0, y: 0, w: target.w, h: target.h });
  const imageCenter = project(imageRest, target.w / 2, target.h / 2);
  const sx = (Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y) + Math.hypot(q[2].x - q[3].x, q[2].y - q[3].y)) / 2 / target.w;
  const sy = (Math.hypot(q[3].x - q[0].x, q[3].y - q[0].y) + Math.hypot(q[2].x - q[1].x, q[2].y - q[1].y)) / 2 / target.h;
  const imageFlat = chain(translate(imageCenter.x, imageCenter.y), scale(sx, sy), translate(-target.w / 2, -target.h / 2));

  // La cámara avanza por la recta que pasa por el centro de la ventana…
  const c = project(frame.H, win.x + win.w / 2, win.y + win.h / 2);
  const sCam = Math.max(1.22, Math.sqrt(1 / sx / sy));
  const residual = { x: 1 / sx / sCam, y: 1 / sy / sCam };
  const zEnd = 1 - 1 / sCam;
  // …y gira (sin paralaje) lo justo para dejar la imagen en su sitio
  const pan = {
    x: target.x + target.w / 2 - c.x - (imageCenter.x - c.x) * sCam,
    y: target.y + target.h / 2 - c.y - (imageCenter.y - c.y) * sCam,
  };

  // Profundidad del marco: lo bastante cerca para que su ventana deje atrás
  // toda la pantalla bastante antes de llegar
  const windowQuad = corners(frame.H, win);
  const margin = Math.max(vw, vh) * 0.05;
  const screen = [
    { x: -margin, y: -margin }, { x: vw + margin, y: -margin },
    { x: vw + margin, y: vh + margin }, { x: -margin, y: vh + margin },
  ];
  const covers = (k: number) => {
    const m = chain(translate(pan.x, pan.y), scaleAbout(k, k, c));
    const quad = windowQuad.map(p => project(m, p.x, p.y));
    return screen.every(p => insideConvex(quad, p));
  };
  let lo = 1;
  let hi = 600;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (covers(mid)) hi = mid;
    else lo = mid;
  }
  const kEnd = Math.max(hi * CLEAR, sCam * 1.6);
  const depth = (kEnd * zEnd) / (kEnd - 1);

  return {
    vw, vh, source, target, imageRest, imageFlat, imageCenter, c, zEnd, depth, residual, pan,
    rollSign: c.x < vw / 2 ? 1 : -1, windowQuad, screen,
  };
};

type Pose = { wall: Mat; frame: Mat; image: Mat; streak: Pt; streakScale: number; covered: boolean };

/* dolly: 0 en la pared, 1 en la sala. pan y untilt, igual */
const poseAt = (g: Geometry, dolly: number, pan: number, untilt: number): Pose => {
  const z = g.zEnd * dolly;
  const kFrame = g.depth / (g.depth - z);
  const kImage = 1 / (1 - z);
  const roll = rotateAbout(g.rollSign * ROLL * Math.sin(Math.PI * dolly), { x: g.vw / 2, y: g.vh / 2 });
  const panM = translate(g.pan.x * pan, g.pan.y * pan);
  const wall = chain(roll, panM, scaleAbout(kFrame, kFrame, g.c));
  const rest = normalized(g.imageRest);
  const flat = normalized(g.imageFlat);
  const plane = rest.map((v, i) => lerp(v, flat[i], untilt));
  const image = chain(
    roll, panM, scaleAbout(kImage, kImage, g.c),
    scaleAbout(lerp(1, g.residual.x, dolly), lerp(1, g.residual.y, dolly), g.imageCenter),
    plane,
  );
  const quad = g.windowQuad.map(p => project(wall, p.x, p.y));
  return {
    wall,
    frame: chain(wall, g.source.frame.H),
    image,
    streak: project(chain(roll, panM), g.c.x, g.c.y),
    streakScale: lerp(0.5, 2.9, dolly),
    covered: g.screen.every(p => insideConvex(quad, p)),
  };
};

type Layers = {
  root: HTMLDivElement;
  streaks: HTMLCanvasElement;
  streakSize: number;
  frame: HTMLDivElement;
  windowBg: HTMLDivElement;
  images: HTMLElement[];
  // la obra que no tiene pared a la que volver termina como una estrella
  star: HTMLElement | null;
};

const buildLayers = (g: Geometry, accent: string, startSrc: string | null, endSrc: string | null): Layers => {
  const root = document.createElement('div');
  root.className = 'mo-flight';
  root.setAttribute('aria-hidden', 'true');
  root.style.setProperty('view-transition-name', FLIGHT_NAME);
  root.style.setProperty('--accent', accent);

  const streakSize = Math.min(1600, Math.round(Math.hypot(g.vw, g.vh) * 0.75));
  const texture = streakTexture(streakSize, accent);
  const streaks = document.createElement('canvas');
  streaks.className = 'mo-flight-streaks';
  streaks.width = texture.width;
  streaks.height = texture.height;
  streaks.getContext('2d')?.drawImage(texture, 0, 0);
  streaks.style.width = `${streakSize}px`;
  streaks.style.height = `${streakSize}px`;

  const { frame: f, window: w } = g.source;
  const frame = document.createElement('div');
  frame.className = 'mo-flight-frame';
  frame.style.width = `${f.w}px`;
  frame.style.height = `${f.h}px`;
  // Solo el paspartú: un borde con el ancho de cada lado alrededor de la
  // ventana, que queda hueca para dejar ver lo que hay detrás al llegar
  frame.style.borderColor = f.bg;
  frame.style.borderWidth = [
    w.y, f.w - w.x - w.w, f.h - w.y - w.h, w.x,
  ].map(v => `${Math.max(0, v)}px`).join(' ');
  frame.style.setProperty('--frame-line', f.line);

  const win = document.createElement('div');
  win.className = 'mo-flight-window';
  win.style.left = `${w.x}px`;
  win.style.top = `${w.y}px`;
  win.style.width = `${w.w}px`;
  win.style.height = `${w.h}px`;
  const windowBg = document.createElement('div');
  windowBg.className = 'mo-flight-window-bg';
  win.append(windowBg);

  const makeImage = (src: string | null) => {
    let el: HTMLElement;
    const plate = src ? plates.get(src) ?? plateFromLoadedImage(src) : undefined;
    if (plate) {
      el = plate;
    } else if (src) {
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'sync';
      img.src = src;
      el = img;
    } else {
      el = document.createElement('div');
      el.className = 'mo-flight-pending';
    }
    el.classList.add('mo-flight-image');
    el.style.width = `${g.target.w}px`;
    el.style.height = `${g.target.h}px`;
    return el;
  };
  const images: HTMLElement[] = [];
  // Sin imagen en la pared (la vitrina) la de la sala aparece en el viaje
  if (startSrc || !endSrc) images.push(makeImage(startSrc));
  if (endSrc && endSrc !== startSrc) images.push(makeImage(endSrc));
  frame.append(win);
  root.append(streaks, frame, ...images);
  let star: HTMLElement | null = null;
  if (g.source.virtual) {
    star = document.createElement('i');
    star.className = 'mo-flight-star';
    star.style.left = `${g.target.x + g.target.w / 2}px`;
    star.style.top = `${g.target.y + g.target.h / 2}px`;
    root.append(star);
  }
  return { root, streaks, streakSize, frame, windowBg, images, star };
};

type Timeline = {
  duration: number;
  // del tiempo 0..1 a los parámetros de cámara (0 pared, 1 sala)
  dolly: (t: number) => number;
  pan: (t: number) => number;
  untilt: (t: number) => number;
  wall: { pseudo: string; opacity: Track };
  other: { pseudo: string; opacity: Track };
  windowBg: Track;
  streaks: Track;
  // la primera imagen se funde en la segunda (si son distintas)
  swap: Track;
  // opacidad sumada al marco (y a todo lo que lleva dentro): si la obra no
  // tiene pared a la que volver, se pierde en el fondo
  fade: Track;
  // opacidad de la imagen y la estrella en que se convierte (si la hay)
  imageFade?: Track;
  star?: { opacity: Track; scale: Track };
};

type Plan = { times: number[]; poses: Pose[]; frameMats: Mat[] };

const planFlight = (g: Geometry, tl: Timeline): Plan => {
  const times: number[] = [];
  const poses: Pose[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    times.push(t);
    poses.push(poseAt(g, tl.dolly(t), tl.pan(t), tl.untilt(t)));
  }
  // El marco se detiene apenas su ventana cubre toda la pantalla: de ahí en
  // adelante queda fuera de cuadro y no hace falta agrandarlo (ni rasterizarlo)
  const frameMats = poses.map(p => p.frame);
  if (tl.dolly(1) > tl.dolly(0)) {
    const first = poses.findIndex(p => p.covered);
    if (first >= 0) for (let i = first; i < poses.length; i++) frameMats[i] = poses[first].frame;
  } else {
    let last = -1;
    while (last + 1 < poses.length && poses[last + 1].covered) last++;
    if (last >= 0) for (let i = 0; i <= last; i++) frameMats[i] = poses[last].frame;
  }
  return { times, poses, frameMats };
};

/* La ventana del marco vista desde el plano de la imagen, como recorte */
const windowClip = (g: Geometry, frame: Mat, image: Mat) => {
  const { window: w } = g.source;
  const toImage = invert(image);
  const q = corners(chain(frame, translate(w.x, w.y)), { x: 0, y: 0, w: w.w, h: w.h })
    .map(p => project(toImage, p.x, p.y));
  const xs = q.map(p => p.x);
  const ys = q.map(p => p.y);
  const px = (v: number) => `${Math.max(-4000, v).toFixed(2)}px`;
  return `inset(${px(Math.min(...ys))} ${px(g.target.w - Math.max(...xs))} ${px(g.target.h - Math.max(...ys))} ${px(Math.min(...xs))})`;
};

/* Deja cada capa en su primer cuadro: la captura nueva sale de aquí */
const placeLayers = (g: Geometry, layers: Layers, plan: Plan) => {
  const frame = plan.frameMats[0];
  const image = plan.poses[0].image;
  layers.frame.style.transform = toCss(frame);
  layers.images.forEach((el) => {
    el.style.transform = toCss(image, true);
    el.style.clipPath = windowClip(g, frame, image);
  });
};

const animateLayers = (g: Geometry, layers: Layers, tl: Timeline, plan: Plan) => {
  const { times, poses, frameMats } = plan;
  const options: KeyframeAnimationOptions = { duration: tl.duration, easing: 'linear', fill: 'both' };
  const sampled = (tr: Track) => times.map(t => ({ offset: t, opacity: sampleTrack(tr, t) }));
  const matrices = (ms: Mat[]) => {
    const perspective = ms.some(hasPerspective);
    return ms.map((m, i) => ({ offset: times[i], transform: toCss(m, perspective) }));
  };

  // Solo transform y opacidad en modo replace: así todo corre en el
  // compositor (un composite 'add' obliga al hilo principal en cada cuadro)
  const doc = document.documentElement;
  const anims: Animation[] = [
    doc.animate(matrices(poses.map(p => p.wall)), { ...options, pseudoElement: tl.wall.pseudo }),
    doc.animate(sampled(tl.wall.opacity), { ...options, pseudoElement: tl.wall.pseudo }),
    doc.animate(sampled(tl.other.opacity), { ...options, pseudoElement: tl.other.pseudo }),
    layers.frame.animate(matrices(frameMats), options),
    layers.windowBg.animate(sampled(tl.windowBg), options),
  ];
  if (tl.fade.some(([, value]) => value !== 1)) anims.push(layers.frame.animate(sampled(tl.fade), options));

  // La imagen viaja fuera del marco (con su propia escala, que nunca pasa de
  // 1: así se rasteriza nítida) y la ventana la recorta con clip-path
  const imageFrames = poses.map((p, i) => ({
    offset: times[i],
    transform: toCss(p.image, true),
    clipPath: windowClip(g, frameMats[i], p.image),
  }));
  layers.images.forEach((el, index) => {
    anims.push(el.animate(imageFrames, options));
    if (index > 0) anims.push(el.animate(sampled(tl.swap), options));
    else if (tl.imageFade) anims.push(el.animate(sampled(tl.imageFade), options));
  });
  if (layers.star && tl.star) {
    const { opacity, scale: grow } = tl.star;
    anims.push(layers.star.animate(times.map(t => ({
      offset: t,
      opacity: sampleTrack(opacity, t),
      transform: `translate(-50%, -50%) scale(${sampleTrack(grow, t)})`,
    })), options));
  }

  const reach = Math.hypot(g.vw, g.vh) * 1.1 / layers.streakSize;
  const half = layers.streakSize / 2;
  anims.push(layers.streaks.animate(poses.map((p, i) => {
    const k = p.streakScale * reach;
    return { offset: times[i], transform: `translate(${p.streak.x - half * k}px, ${p.streak.y - half * k}px) scale(${k})` };
  }), options));
  anims.push(layers.streaks.animate(sampled(tl.streaks), options));
  return anims;
};

/* ---------- Orquestación ---------- */

let running = false;
let queued: (() => void) | null = null;

/* Mientras la cámara viaja, la sala de estudio deja para después lo que
   cuesta montar (el artículo): el hilo principal queda libre para el viaje */
export const isObraFlightRunning = () => running;
export const OBRA_LANDED_EVENT = 'mo-obra-landed';
const land = () => window.dispatchEvent(new Event(OBRA_LANDED_EVENT));

/* Placas: las imágenes del viaje, ya decodificadas y pintadas en un canvas.
   Una <img> que crece hasta el tamaño de la sala obliga a decodificar la
   ilustración a resolución completa y a subirla a la GPU a mitad del vuelo
   (~150 ms con el compositor parado). Un canvas ya es una textura: el
   compositor solo la estira. Se preparan fuera del hilo principal cuando
   el cursor se posa sobre una obra, así que al hacer clic suelen estar. */
const PLATE_SIDE = 1920;
const plates = new Map<string, HTMLCanvasElement>();
const plateJobs = new Map<string, Promise<void>>();

const makePlate = (src: string, naturalW: number) => {
  let job = plateJobs.get(src);
  if (job) return job;
  job = (async () => {
    const blob = await (await fetch(src)).blob();
    const side = Math.round(PLATE_SIDE * Math.min(2, Math.max(1, window.devicePixelRatio || 1)));
    const resizeWidth = naturalW > side ? side : undefined;
    const bitmap = await createImageBitmap(blob, resizeWidth ? { resizeWidth, resizeQuality: 'high' } : {});
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    bitmap.close();
    plates.set(src, canvas);
    // Que no se acumulen texturas: bastan las últimas obras miradas
    while (plates.size > 6) {
      const oldest = plates.keys().next().value as string;
      const old = plates.get(oldest);
      if (old && !old.isConnected) {
        old.width = 0;
        old.height = 0;
      }
      plates.delete(oldest);
      plateJobs.delete(oldest);
    }
  })().catch(() => {
    plateJobs.delete(src);
  });
  plateJobs.set(src, job);
  return job;
};

/* Si la placa no alcanzó a prepararse, se pinta ya desde la <img> cargada
   de la tarjeta o de la sala. Una <img> dentro del marco que se agranda se
   rasterizaría a su tamaño inicial y se vería pixelada al llegar. */
const plateFromLoadedImage = (src: string) => {
  const img = Array.from(document.images).find(
    el => (el.currentSrc || el.src) === src && el.complete && el.naturalWidth > 1,
  );
  if (!img) return undefined;
  const side = Math.round(PLATE_SIDE * Math.min(2, Math.max(1, window.devicePixelRatio || 1)));
  const k = Math.min(1, side / img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * k);
  canvas.height = Math.round(img.naturalHeight * k);
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
  plates.set(src, canvas);
  return canvas;
};

const preparePlates = (...items: ({ src: string; w: number } | null | undefined)[]) => {
  const jobs = items
    .filter((item): item is { src: string; w: number } => Boolean(item?.src))
    .map(item => makePlate(item.src, item.w));
  if (!jobs.length) return Promise.resolve();
  return Promise.race([
    Promise.all(jobs).then(() => undefined),
    new Promise<void>(resolve => window.setTimeout(resolve, 360)),
  ]);
};

const cardSources = (card: Element) =>
  Array.from(card.querySelectorAll<HTMLImageElement>('.mo-frame-zoom > img'))
    .filter(img => img.complete && img.naturalWidth > 1 && !img.src.startsWith('data:'))
    .map(img => ({ src: img.currentSrc || img.src, w: img.naturalWidth }));

let warmed = false;
/* Se instala una vez: la obra bajo el cursor (o bajo el dedo) prepara sus placas */
export const prewarmObraFlight = () => {
  if (warmed || !obraFlightSupported()) return () => {};
  warmed = true;
  const onPoint = (event: PointerEvent) => {
    const card = (event.target as Element | null)?.closest?.('.mo-obra');
    if (card) cardSources(card).forEach(item => void makePlate(item.src, item.w));
  };
  document.addEventListener('pointerover', onPoint, { passive: true });
  document.addEventListener('pointerdown', onPoint, { passive: true });
  return () => {
    warmed = false;
    document.removeEventListener('pointerover', onPoint);
    document.removeEventListener('pointerdown', onPoint);
  };
};

const begin = (mode: 'entering' | 'leaving') => {
  running = true;
  document.documentElement.classList.add('mo-obra-flying', `mo-obra-${mode}`);
  lockSmoothScroll('obra-flight', true);
};

const end = (layers: Layers | null) => {
  layers?.root.remove();
  document.documentElement.classList.remove('mo-obra-flying', 'mo-obra-entering', 'mo-obra-leaving');
  lockSmoothScroll('obra-flight', false);
  running = false;
  land();
  const next = queued;
  queued = null;
  next?.();
};

const accentOf = (el: Element | null) =>
  (el && getComputedStyle(el).getPropertyValue('--accent').trim()) || '#c9a86a';

const ENTER_TIMELINE: Timeline = {
  duration: ENTER_MS,
  dolly: ENTER_DOLLY,
  pan: ENTER_PAN,
  untilt: t => smooth(0.02, 0.5, t),
  // la pared sigue a la vista mientras se agranda y se apaga al salir de cuadro
  wall: { pseudo: '::view-transition-old(root)', opacity: [[0, 1], [0.42, 1], [0.62, 0]] },
  // la sala aparece detrás de la imagen apenas el marco pasó
  other: { pseudo: '::view-transition-new(root)', opacity: [[0, 0], [0.56, 0], [0.9, 1]] },
  windowBg: [[0, 1], [0.6, 1], [0.7, 0]],
  streaks: [[0, 0], [0.12, 0], [0.38, 0.95], [0.58, 0.4], [0.7, 0]],
  swap: [[0, 0], [0.3, 0], [0.56, 1]],
  fade: [[0, 1], [1, 1]],
};

const back = (curve: (t: number) => number) => (t: number) => 1 - curve(t);

const exitTimeline = (fadeAway: boolean): Timeline => ({
  duration: EXIT_MS,
  dolly: back(EXIT_DOLLY),
  pan: back(EXIT_PAN),
  untilt: t => 1 - smooth(0.5, 0.98, t),
  // la página vuelve desde detrás de la ventana del marco, que al principio
  // cubre toda la pantalla: el cambio de la sala a la página no se ve
  wall: { pseudo: '::view-transition-new(root)', opacity: [[0, 0], [0.13, 0], [0.16, 1]] },
  other: { pseudo: '::view-transition-old(root)', opacity: [[0, 1], [0.15, 1], [0.16, 0]] },
  windowBg: [[0, 0], [0.12, 1], [1, 1]],
  streaks: [[0, 0], [0.18, 0.7], [0.52, 0]],
  swap: [[0, 0], [0.4, 0], [0.82, 1]],
  // Sin pared a la que volver, la obra se aleja sin marco, se achica hasta
  // un punto de luz del color de su capítulo, destella y se funde en el cielo
  fade: fadeAway ? [[0, 1], [0.1, 1], [0.2, 0]] : [[0, 1], [1, 1]],
  ...(fadeAway ? {
    imageFade: [[0, 1], [0.6, 1], [0.8, 0]] as Track,
    star: {
      opacity: [[0, 0], [0.56, 0], [0.72, 1], [0.84, 1], [1, 0]] as Track,
      scale: [[0, 2.4], [0.56, 2.4], [0.74, 0.8], [0.8, 1.35], [1, 0.3]] as Track,
    },
  } : {}),
});

type FlightOptions = {
  conceptId: string;
  scope: 'journey' | 'vitrine';
  /* Monta o desmonta la sala de estudio de forma síncrona (flushSync) */
  commit: () => void;
};

type Prepared = { geometry: Geometry; layers: Layers; plan: Plan; timeline: Timeline };

const run = async (start: () => Promise<void>, transitionUpdate: () => Prepared | null) => {
  let prepared: Prepared | null = null;
  let anims: Animation[] = [];
  // Marcas de User Timing: el viaje se puede leer en el panel de rendimiento
  const mark = (name: string) => performance.mark(`mo-obra:${name}`).startTime;
  const timing = { asked: mark('asked'), update: 0, updated: 0, ready: 0 };
  try {
    await start();
    const transition = document.startViewTransition(() => {
      timing.update = mark('update');
      prepared = transitionUpdate();
      if (prepared) document.body.append(prepared.layers.root);
      timing.updated = mark('updated');
    });
    await transition.ready;
    timing.ready = mark('ready');
    const ready = prepared as Prepared | null;
    if (ready) {
      anims = animateLayers(ready.geometry, ready.layers, ready.timeline, ready.plan);
      if (import.meta.env.DEV) {
        (window as unknown as { __obraFlight?: unknown }).__obraFlight = { geometry: ready.geometry, plan: ready.plan, timing };
      }
      await Promise.all(anims.map(a => a.finished));
    }
    await transition.finished;
  } catch {
    // La transición se saltó (pestaña oculta, otra transición…): el cambio
    // de la sala ya se aplicó y solo falta limpiar
  } finally {
    end((prepared as Prepared | null)?.layers ?? null);
    // Con fill las animaciones de los seudoelementos seguirían vivas y se
    // aplicarían a la próxima transición
    anims.forEach(a => a.cancel());
  }
};

/* Devuelve false si no hay viaje posible: quien llama abre la sala como siempre */
export const flyIntoObra = ({ conceptId, scope, commit }: FlightOptions): boolean => {
  if (running || !obraFlightSupported()) return false;
  const card = findCard(conceptId, scope);
  const source = card ? measureSource(card) : null;
  if (!card || !source) return false;
  const startSrc = source.image?.src ?? null;
  const accent = accentOf(card);

  // La sala abre con la imagen principal de la obra: también se prepara
  const sources = cardSources(card);
  begin('entering');
  void run(() => preparePlates(...sources), () => {
    commit();
    const studio = measureStudioImage(source.image?.natural);
    if (!studio || studio.rect.w < 4) return null;
    const geometry = buildGeometry(source, studio.rect);
    const layers = buildLayers(geometry, accent, startSrc, studio.src);
    const plan = planFlight(geometry, ENTER_TIMELINE);
    placeLayers(geometry, layers, plan);
    return { geometry, layers, plan, timeline: ENTER_TIMELINE };
  });
  return true;
};

export const flyOutOfObra = ({ conceptId, scope, commit }: FlightOptions): boolean => {
  if (!obraFlightSupported()) return false;
  if (running) {
    // Cerrar a mitad de un viaje: se cierra apenas la cámara se posa
    queued = () => {
      if (!flyOutOfObra({ conceptId, scope, commit })) commit();
    };
    return true;
  }
  const studio = measureStudioImage();
  if (!studio || studio.rect.w < 4) return false;
  // Si leyó hacia abajo, la imagen vuelve desde arriba, sin cruzar media página
  const rect = { ...studio.rect, y: Math.max(studio.rect.y, -studio.rect.h * 0.9) };
  const card = findCard(conceptId, scope);
  const source = (card && measureSource(card)) || virtualSource(rect);
  const endSrc = source.image?.src ?? null;
  const accent = accentOf(card ?? document.querySelector('.mo-studio-panel'));
  const timeline = exitTimeline(source.virtual);

  begin('leaving');
  void run(() => preparePlates(
    studio.src ? { src: studio.src, w: studio.natural?.w ?? PLATE_SIDE * 2 } : null,
    endSrc ? { src: endSrc, w: source.image?.natural.w ?? PLATE_SIDE * 2 } : null,
  ), () => {
    const studioEl = document.querySelector<HTMLElement>('.mo-studio');
    commit();
    // Sale de escena sin su fundido: la cámara ya se lleva la imagen
    if (studioEl) studioEl.style.visibility = 'hidden';
    const geometry = buildGeometry(source, rect);
    const layers = buildLayers(geometry, accent, studio.src, endSrc);
    const plan = planFlight(geometry, timeline);
    placeLayers(geometry, layers, plan);
    return { geometry, layers, plan, timeline };
  });
  return true;
};

/* Anterior / siguiente dentro de la sala de estudio: la cámara se desplaza
   de lado, como caminando por una galería. Una sala sale en perspectiva y la
   otra llega desde el costado. Son dos capturas animadas por CSS. */
export const panStudio = (direction: 1 | -1, commit: () => void): boolean => {
  if (running || !obraFlightSupported() || !document.querySelector('.mo-studio-panel')) return false;
  running = true;
  const doc = document.documentElement;
  doc.classList.add('mo-studio-panning', direction > 0 ? 'mo-pan-next' : 'mo-pan-prev');
  lockSmoothScroll('obra-flight', true);
  const transition = document.startViewTransition(commit);
  transition.finished.catch(() => undefined).finally(() => {
    doc.classList.remove('mo-studio-panning', 'mo-pan-next', 'mo-pan-prev');
    lockSmoothScroll('obra-flight', false);
    running = false;
    land();
    const next = queued;
    queued = null;
    next?.();
  });
  return true;
};
