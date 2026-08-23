import { useEffect, useRef, type RefObject } from 'react';

interface StarfieldProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  dim?: boolean;
}

interface Star {
  x: number;
  y: number;
  z: number;
  tint: number;
  phase: number;
  ox: number;
  oy: number;
}

interface Comet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  tint: number;
  curve: number;
  power?: number;
  hitTitle?: boolean;
  tintRGB?: RGB;
}

interface CometOptions {
  fromLeft?: boolean;
  big?: boolean;
  speed?: number;
  angle?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  sizeMul?: number;
  power?: number;
  tintRGB?: RGB;
}

interface Wave {
  x: number;
  y: number;
  r: number;
  alpha: number;
  delay: number;
  grow?: number;
  decay?: number;
  width?: number;
}

/* Burbuja de choque: disco aurora semitransparente cuyo color nace aleatorio
   y se suaviza hacia el extremo claro de la paleta al expandirse */
interface ShockBubble {
  x: number;
  y: number;
  r: number;
  alpha: number;
  age: number;
  tintT: number;
  grow?: number;
}

interface Flash {
  x: number;
  y: number;
  r: number;
  alpha: number;
}

interface SketchState {
  nodes: { x: number; y: number }[];
  lastAdd: number;
}

interface AmbientNode {
  ox: number;
  oy: number;
  phase: number;
}

/* Constelación ambiental: clúster autónomo que cubre el cielo de borde a borde.
   Deriva más lento que las estrellas (cielo profundo) y vive en ciclos:
   aparece, titila y se despide, renaciendo por el lado derecho. */
interface AmbientConstellation {
  x: number;
  y: number;
  nodes: AmbientNode[];
  edges: [number, number][];
  t0: number;
  dur: number;
  tint: RGB;
}

const TINTS = [
  [245, 241, 232],
  [201, 168, 106],
  [143, 208, 255],
];

type RGB = [number, number, number];

/* Paleta aurora de la estela del hero: violeta -> cian -> dorado -> blanco */
const AURORA: RGB[] = [
  [167, 139, 250],
  [96, 214, 255],
  [201, 168, 106],
  [255, 246, 228],
];

/* Tintes vivos para los proyectiles de la resortera */
const VIVID_TINTS: RGB[] = [
  [255, 92, 164],
  [96, 214, 255],
  [64, 224, 158],
  [255, 176, 84],
  [167, 139, 250],
  [142, 240, 255],
];

const sampleStops = (stops: RGB[], t: number): RGB => {
  const clamped = Math.min(0.999, Math.max(0, t));
  const scaled = clamped * (stops.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = stops[i];
  const b = stops[Math.min(stops.length - 1, i + 1)];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
};

const mixRGB = (a: RGB, b: RGB, f: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * f),
  Math.round(a[1] + (b[1] - a[1]) * f),
  Math.round(a[2] + (b[2] - a[2]) * f),
];

export const StarfieldCanvas = ({ scrollRef, dim = false }: StarfieldProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<HTMLCanvasElement>(null);
  const dimRef = useRef(dim);
  dimRef.current = dim;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let width = 0;
    let height = 0;
    let vscale = 1;
    let stars: Star[] = [];
    let comets: Comet[] = [];
    let waves: Wave[] = [];
    let bubbles: ShockBubble[] = [];
    let flashes: Flash[] = [];
    let sparkles: { x: number; y: number; vx: number; vy: number; life: number; tint: number; size: number; grav: number; rgb?: RGB }[] = [];
    let raf = 0;
    let time = 0;
    let scrollVel = 0;
    let lastScroll = scrollRef.current?.scrollTop ?? 0;
    let dimLevel = 0;
    let running = true;
    let nextComet = time + 4 + Math.random() * 5;
    let warpBoost = 0;
    let charge: { x: number; y: number; t0: number; dx: number; dy: number } | null = null;
    let sketch: SketchState | null = null;
    let ambient: AmbientConstellation[] = [];
    // El hero es zona sin constelaciones: puntero sobre él y su banda en viewport
    let overHero = false;
    // Sala de estudio abierta bajo el puntero: allí la estela usa capa superior
    let overStudio = false;
    let heroH = 0;
    // Rects (viewport) de las imágenes: sobre ellas solo se dejan ver las
    // constelaciones dibujadas con Mayús+clic; el resto se oculta tras la foto.
    type ImgRect = { x: number; y: number; w: number; h: number };
    let imgRects: ImgRect[] = [];
    let letterRects: ImgRect[] = [];
    let rectsDirty = true;
    let nextRectCheck = 0;
    let nextDirShot = 0;

    // Historial del puntero para la estela continua tipo cometa del hero
    const trail: { x: number; y: number; t: number }[] = [];

    // Capa frontal para meteoros y destellos: viajan por encima del museo
    const fxCtx = fxRef.current?.getContext('2d') ?? null;
    // Capa superior exclusiva de la estela aurora dentro de las salas de estudio
    const trailCtx = trailRef.current?.getContext('2d') ?? null;

    const mouse = { x: -9999, y: -9999, sx: -9999, sy: -9999 };

    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const seed = () => {
      const count = Math.round((width * height) / 5200);
      stars = Array.from({ length: Math.min(560, Math.max(180, count)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        z: 0.25 + Math.random() * 0.75,
        tint: Math.random() < 0.82 ? 0 : Math.random() < 0.5 ? 1 : 2,
        phase: Math.random() * Math.PI * 2,
        ox: 0,
        oy: 0,
      }));
    };

    const sizeCanvas = (target: HTMLCanvasElement | null) => {
      if (!target) return;
      target.width = Math.round(width * dpr);
      target.height = Math.round(height * dpr);
      // Caja CSS idéntica al espacio lógico de dibujo: sin esto, un canvas
      // fixed con inset:0 usa su tamaño intrínseco (backing) y con zoom o
      // dpr != 1 los efectos se dibujan desplazados respecto al puntero.
      target.style.width = `${width}px`;
      target.style.height = `${height}px`;
      target.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /* ---- Constelaciones ambientales ---- */

    const ambientCount = () => Math.min(9, Math.max(5, Math.round(width / 320)));

    const makeAmbientShape = () => {
      const count = 3 + Math.floor(Math.random() * 4);
      const nodes: AmbientNode[] = Array.from({ length: count }, () => {
        const ang = Math.random() * Math.PI * 2;
        const rad = 18 + Math.random() * 72;
        return {
          ox: Math.cos(ang) * rad,
          oy: Math.sin(ang) * rad * 0.72,
          phase: Math.random() * Math.PI * 2,
        };
      });
      // Cada nodo se une a sus 1-2 vecinos más cercanos, sin aristas repetidas
      const seen = new Set<string>();
      const edges: [number, number][] = [];
      const addEdge = (i: number, j: number) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) return;
        seen.add(key);
        edges.push(i < j ? [i, j] : [j, i]);
      };
      nodes.forEach((node, i) => {
        nodes
          .map((other, j) => ({ j, d: Math.hypot(node.ox - other.ox, node.oy - other.oy) }))
          .filter(({ j }) => j !== i)
          .sort((a, b) => a.d - b.d)
          .slice(0, Math.random() < 0.55 ? 2 : 1)
          .forEach(({ j }) => addEdge(i, j));
      });
      return { nodes, edges };
    };

    const spawnAmbient = (x: number, stagger = false) => {
      const shape = makeAmbientShape();
      // Tinte aurora propio: evita el extremo blanco de la paleta
      ambient.push({
        x,
        y: height * (0.06 + Math.random() * 0.66),
        ...shape,
        t0: stagger ? time - Math.random() * 8 : time,
        dur: 14 + Math.random() * 10,
        tint: sampleStops(AURORA, Math.random() * 0.8),
      });
    };

    // Columnas equidistantes con jitter: cobertura de borde a borde desde el arranque
    const seedAmbient = () => {
      ambient = [];
      const count = ambientCount();
      for (let i = 0; i < count; i += 1) {
        const x = ((i + 0.5) / count) * width + (Math.random() - 0.5) * (width / count) * 0.5;
        spawnAmbient(x, true);
      }
    };

    const refreshImgRects = () => {
      imgRects = Array.from(document.querySelectorAll('.mo-root img'), (img) => {
        const r = img.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      }).filter((r) => r.w > 4 && r.h > 4);
      letterRects = Array.from(document.querySelectorAll('.mo-hero-letterbox'), (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      }).filter((r) => r.w > 2 && r.h > 2);
    };

    const pointInImage = (x: number, y: number) => {
      for (const r of imgRects) {
        if (x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2) return true;
      }
      return false;
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      // Releer el dpr: cambia con el zoom de página y al mover la ventana
      // entre monitores con distinto DPI.
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      vscale = Math.min(width, height) / 900;
      // Altura del hero: define la banda del cielo sin constelaciones
      const heroEl = document.querySelector('.mo-hero');
      heroH = heroEl instanceof HTMLElement ? heroEl.offsetHeight : height;
      sizeCanvas(canvas);
      sizeCanvas(fxRef.current);
      sizeCanvas(trailRef.current);
      seed();
      seedAmbient();
      rectsDirty = true;
    };

    const onScroll = () => {
      const top = scrollRef.current?.scrollTop ?? 0;
      scrollVel = scrollVel * 0.82 + (top - lastScroll) * 0.18;
      lastScroll = top;
      rectsDirty = true;
    };

    const onMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      overHero = Boolean((event.target as HTMLElement | null)?.closest('.mo-hero'));
      overStudio = Boolean((event.target as HTMLElement | null)?.closest('.mo-studio'));
      if (mouse.sx < -999) {
        mouse.sx = mouse.x;
        mouse.sy = mouse.y;
      }
      // Arrastre de la resortera
      if (charge) {
        charge.dx = event.clientX;
        charge.dy = event.clientY;
      }
    };

    /* ---- Meteoros ---- */

    const spawnComet = (options?: CometOptions) => {
      const big = options?.big ?? false;
      const speed = (options?.speed ?? (big ? 8.5 + Math.random() * 3.5 : 6 + Math.random() * 5)) * vscale;
      let vx: number;
      let vy: number;
      if (options?.vx !== undefined && options?.vy !== undefined) {
        vx = options.vx * vscale;
        vy = options.vy * vscale;
      } else {
        const angleDeg = options?.angle ?? (18 + Math.random() * 16);
        const angle = (Math.PI / 180) * angleDeg;
        const fromLeft = options?.fromLeft ?? Math.random() < 0.5;
        vx = (fromLeft ? 1 : -1) * Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
      }
      comets.push({
        x: options?.x ?? (options?.fromLeft === false ? width + 40 : -40),
        y: options?.y ?? height * (0.05 + Math.random() * 0.55),
        vx,
        vy,
        life: 1,
        size:
          (big ? 3 + Math.random() : 1.7 + Math.random() * 1.1) *
          (0.75 + 0.25 * vscale) *
          (options?.sizeMul ?? 1),
        tint: big ? 1 : Math.random() < 0.55 ? 0 : Math.random() < 0.55 ? 1 : 2,
        curve: big ? 0.02 + Math.random() * 0.03 : (Math.random() - 0.35) * 0.05,
        power: options?.power,
        tintRGB: options?.tintRGB,
      });
    };

    const spawnSparkleBurst = (
      x: number,
      y: number,
      count: number,
      power: number,
    ) => {
      for (let s = 0; s < count; s += 1) {
        const ang = (Math.PI * 2 * s) / count + Math.random() * 0.5;
        const spd = (1.4 + Math.random() * (3.4 + power * 3)) * vscale;
        const ember = Math.random() < 0.24;
        sparkles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 1,
          tint: Math.random() < 0.55 ? 0 : Math.random() < 0.6 ? 1 : 2,
          size: ember ? 3 + Math.random() * 1.2 : 1.3 + Math.random() * 1.4,
          grav: ember ? 0.05 : 0.018,
        });
      }
      if (sparkles.length > 160) sparkles.splice(0, sparkles.length - 160);
    };

    /* ---- Lluvia dirigida por WASD ---- */

    const heldDirs = new Set<'up' | 'down' | 'left' | 'right'>();

    const spawnDirectionalComet = (dir: 'up' | 'down' | 'left' | 'right') => {
      const big = Math.random() < 0.22;
      const vivid = VIVID_TINTS[Math.floor(Math.random() * VIVID_TINTS.length)];
      const speed = ((big ? 8.5 : 5.5) + Math.random() * 4.5) * vscale;
      const jitter = (Math.random() - 0.5) * 3;
      const opts: CometOptions = {
        big,
        sizeMul: 0.8 + Math.random() * 0.45,
        tintRGB: vivid,
      };
      if (dir === 'left') {
        opts.x = width + 40;
        opts.y = height * (0.06 + Math.random() * 0.82);
        opts.vx = -speed;
        opts.vy = jitter;
      } else if (dir === 'right') {
        opts.x = -40;
        opts.y = height * (0.06 + Math.random() * 0.82);
        opts.vx = speed;
        opts.vy = jitter;
      } else if (dir === 'up') {
        opts.x = width * (0.08 + Math.random() * 0.84);
        opts.y = height + 40;
        opts.vx = jitter;
        opts.vy = -speed;
      } else {
        opts.x = width * (0.08 + Math.random() * 0.84);
        opts.y = -40;
        opts.vx = jitter;
        opts.vy = speed;
      }
      spawnComet(opts);
      // Gemela ocasional desfasada, con color propio
      if (Math.random() < 0.18) {
        const twinOpts: CometOptions = { ...opts };
        if (dir === 'left' || dir === 'right') {
          twinOpts.y = (opts.y ?? 0) + (Math.random() - 0.5) * 70;
        } else {
          twinOpts.x = (opts.x ?? 0) + (Math.random() - 0.5) * 70;
        }
        twinOpts.sizeMul = (opts.sizeMul ?? 1) * 0.75;
        twinOpts.tintRGB = VIVID_TINTS[Math.floor(Math.random() * VIVID_TINTS.length)];
        spawnComet(twinOpts);
      }
    };

    /* ---- Constelación dibujable ---- */

    const nearestStarPos = (x: number, y: number, maxDist: number) => {
      let bestX = x;
      let bestY = y;
      let bestD = maxDist;
      for (const star of stars) {
        const d = Math.hypot(star.x - x, star.y - y);
        if (d < bestD) {
          bestD = d;
          bestX = star.x;
          bestY = star.y;
        }
      }
      return { x: bestX, y: bestY };
    };

    const addSketchNode = (x: number, y: number) => {
      if (!sketch || time - sketch.lastAdd > 6) {
        sketch = { nodes: [], lastAdd: time };
      }
      if (sketch.nodes.length >= 16) return;
      sketch.nodes.push(nearestStarPos(x, y, 30));
      sketch.lastAdd = time;
    };

    /* ---- Interacción ---- */

    const onDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      const interactive = Boolean(target?.closest('button, a, input, textarea'));
      const x = event.clientX;
      const y = event.clientY;

      if (!interactive && event.shiftKey) {
        addSketchNode(x, y);
        return;
      }

      // Clic cargado tipo resortera: mantener presionado y arrastrar en
      // cualquier sala del museo (los controles interactivos quedan fuera)
      if (!interactive) {
        charge = { x, y, t0: time, dx: x, dy: y };
      }
    };

    const releaseCharge = () => {
      if (!charge) return;
      const power = Math.min(1, (time - charge.t0) / 1.1);
      const x = charge.x;
      const y = charge.y;

      // Vector de resortera: tirar hacia atrás lanza hacia adelante
      const px = x - charge.dx;
      const py = y - charge.dy;
      const pull = Math.hypot(px, py);

      charge = null;
      if (power < 0.06) return;

      // Explosión residual en el punto de origen: destello y chispas; la
      // burbuja de choque queda reservada para el release sin apuntar y para
      // los impactos del proyectil
      flashes.push({ x, y, r: 4, alpha: 0.2 + 0.3 * power });
      spawnSparkleBurst(x, y, Math.round(8 + 14 * power), power * 0.7);

      if (pull < 24) {
        // Sin arrastre: supernova sin proyectiles, solo onda de choque y chispas
        bubbles.push({
          x,
          y,
          r: 12,
          alpha: 0.26 + 0.34 * power,
          age: 0,
          tintT: Math.random() * 0.65,
          grow: 4.5 + 6 * power,
        });
        spawnSparkleBurst(x, y, Math.round(10 + 20 * power), power);
        return;
      }

      // Lanzamiento del meteorito en sentido contrario al arrastre
      const norm = pull || 1;
      const baseSpeed = Math.min(17, 5 + pull * 0.075);
      const speed = Math.max(2, baseSpeed * (0.4 + 0.6 * power));
      spawnComet({
        x,
        y,
        vx: (px / norm) * speed,
        vy: (py / norm) * speed,
        big: true,
        sizeMul: 0.6 + 0.4 * power,
        power,
        tintRGB: VIVID_TINTS[Math.floor(Math.random() * VIVID_TINTS.length)],
      });
    };

    const onUp = () => {
      releaseCharge();
    };

    const onWarp = () => {
      warpBoost = Math.min(34, warpBoost + 22);
    };

    /* Meteoros ambientales: eventos organicos de tiempo con patrones variados.
       Nacen por cualquier borde y viajan en cualquier direccion; el intervalo
       se sortea en cada emision para que nunca se sientan ligados al scroll */
    const spawnAmbientComet = () => {
      const roll = Math.random();
      const speed = (6 + Math.random() * 5) * vscale;
      const size = (1.5 + Math.random() * 1.3) * (0.75 + 0.25 * vscale);
      const tint = Math.random() < 0.7 ? 0 : Math.random() < 0.55 ? 1 : 2;
      const curve = (Math.random() - 0.4) * 0.05;
      // Descendente clasico o cruce profundo: entran por un lateral
      if (roll < 0.47 || roll >= 0.82) {
        const fromLeft = Math.random() < 0.5;
        const bigSlow = roll >= 0.92;
        const deepCross = roll >= 0.82 && roll < 0.92;
        const angleDeg = deepCross
          ? (Math.random() - 0.5) * 12
          : (18 + Math.random() * 16) * (Math.random() < 0.35 ? -1 : 1);
        const angle = (Math.PI / 180) * angleDeg;
        comets.push({
          x: fromLeft ? -40 : width + 40,
          y:
            deepCross || bigSlow
              ? height * (0.3 + Math.random() * 0.5)
              : height * (0.06 + Math.random() * 0.45),
          vx: (fromLeft ? 1 : -1) * Math.cos(angle) * speed * (bigSlow ? 0.75 : 1),
          vy: Math.sin(angle) * speed,
          life: 1,
          size: bigSlow ? size * 1.8 : size,
          tint,
          curve: bigSlow ? curve * 2.2 : curve,
        });
        return;
      }
      // Ascendente lateral: mitad inferior, diagonal hacia arriba
      if (roll < 0.77) {
        const fromLeft = Math.random() < 0.5;
        comets.push({
          x: fromLeft ? -40 : width + 40,
          y: height * (0.55 + Math.random() * 0.4),
          vx: (fromLeft ? 1 : -1) * Math.cos(0.42) * speed,
          vy: -Math.sin(0.42) * speed,
          life: 1,
          size,
          tint,
          curve,
        });
        return;
      }
      // Vertical ascendente desde el borde inferior cerca de los laterales
      const nearLeft = Math.random() < 0.5;
      comets.push({
        x: nearLeft ? width * (0.04 + Math.random() * 0.14) : width * (0.82 + Math.random() * 0.14),
        y: height + 40,
        vx: (nearLeft ? 1 : -1) * Math.random() * 1.6,
        vy: -speed * 1.05,
        life: 1,
        size,
        tint,
        curve,
      });
    };

    const onVisibility = () => {
      running = !document.hidden;
      if (running) {
        lastScroll = scrollRef.current?.scrollTop ?? 0;
        raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
      }
    };

    const frame = () => {
      if (!running) return;
      time += 0.016;
      scrollVel *= 0.92;
      warpBoost *= 0.93;
      const targetDim = dimRef.current ? 0.22 : 1;
      dimLevel += (targetDim - dimLevel) * 0.06;

      mouse.sx += (mouse.x - mouse.sx) * 0.055;
      mouse.sy += (mouse.y - mouse.sy) * 0.055;
      const parX = mouse.sx > -999 ? (mouse.sx / width - 0.5) * 2 : 0;
      const parY = mouse.sy > -999 ? (mouse.sy / height - 0.5) * 2 : 0;

      // Refresco de rects de imágenes: al hacer scroll/resize y de forma
      // periódica (las imágenes con parallax se desplazan unos píxeles)
      if (rectsDirty || time > nextRectCheck) {
        refreshImgRects();
        rectsDirty = false;
        nextRectCheck = time + 0.5;
      }

      // Meteoros organicos: un unico programador con intervalo variable en
      // toda la pagina, sin ninguna dependencia del scroll
      if (time > nextComet) {
        spawnAmbientComet();
        nextComet = time + 5 + Math.random() * 8;
      }

      // Lluvia WASD: un proyectil por direccion activa en cada tick
      if (heldDirs.size > 0 && time > nextDirShot) {
        for (const dir of heldDirs) spawnDirectionalComet(dir);
        nextDirShot = time + 0.12 + Math.random() * 0.06;
      }

      ctx.clearRect(0, 0, width, height);
      fxCtx?.clearRect(0, 0, width, height);
      trailCtx?.clearRect(0, 0, width, height);
      const warp = Math.min(40, Math.abs(scrollVel) * 0.055 + warpBoost);
      const dir = Math.sign(scrollVel) || 1;

      const drawn: { x: number; y: number; z: number }[] = [];

      /* ---- Capa trasera: estrellas ---- */
      for (const star of stars) {
        star.x -= 0.05 * star.z;
        star.y -= scrollVel * 0.045 * star.z;
        if (star.x < -60) star.x = width + 60;
        if (star.x > width + 60) star.x = -60;
        if (star.y < -80) star.y = height + 80;
        if (star.y > height + 80) star.y = -80;

        // Gravedad sutil del cursor: las estrellas cercanas se inclinan hacia él.
        // Usa la posición REAL del puntero (sin suavizar) para que el halo
        // gravitacional viva exactamente bajo el punto, nunca detrás.
        if (mouse.x > -999) {
          const gx = mouse.x - star.x;
          const gy = mouse.y - star.y;
          const gd = Math.hypot(gx, gy);
          const radiusG = 170;
          if (gd < radiusG && gd > 0.001) {
            const f = Math.pow(1 - gd / radiusG, 2) * 12;
            star.ox += ((gx / gd) * f - star.ox) * 0.09;
            star.oy += ((gy / gd) * f - star.oy) * 0.09;
          } else {
            star.ox *= 0.88;
            star.oy *= 0.88;
          }
        } else {
          star.ox *= 0.88;
          star.oy *= 0.88;
        }

        const px = star.x + star.ox + parX * star.z * 16;
        const py = star.y + star.oy + parY * star.z * 11;

        const [r, g, b] = TINTS[star.tint];
        const twinkle = 0.55 + 0.45 * Math.sin(time * (0.6 + star.z) + star.phase);
        const alpha = (0.16 + star.z * 0.5) * twinkle * dimLevel;
        const size = star.z * 1.5 + 0.3;

        if (warp > 1.2) {
          const len = warp * star.z * dir;
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = size * 0.9;
          ctx.beginPath();
          ctx.moveTo(px, py - len * 0.5);
          ctx.lineTo(px, py + len * 0.5);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }

        if (mouse.x > -999) {
          const dc = Math.hypot(px - mouse.x, py - mouse.y);
          if (dc < 230 && drawn.length < 26) drawn.push({ x: px, y: py, z: star.z });
        }
      }

      /* ---- Capa frontal: chispas, supernova, meteoros, ondas, carga, boceto ---- */
      if (fxCtx) {
        // Constelación del cursor: viaja por encima del museo para no lavarse
        // contra la nebulosa del hero (mismo lenguaje que el boceto shift+clic).
        // Sobre el hero se apaga: allí manda la estela fugaz del cursor.
        const degree = new Map<number, number>();

        if (drawn.length > 1 && dimLevel > 0.4 && !overHero) {
          // Misma paleta aurora que la estela: el matiz deriva con el tiempo
          const flow = sampleStops(AURORA, (time * 0.08) % 1);
          const flowLite = mixRGB(flow, [250, 244, 224], 0.6);
          for (let i = 0; i < drawn.length; i += 1) {
            for (let j = i + 1; j < drawn.length; j += 1) {
              if ((degree.get(i) ?? 0) >= 3 || (degree.get(j) ?? 0) >= 3) continue;
              const dx = drawn[i].x - drawn[j].x;
              const dy = drawn[i].y - drawn[j].y;
              const d = Math.hypot(dx, dy);
              if (d < 126) {
                const midX = (drawn[i].x + drawn[j].x) / 2;
                const midY = (drawn[i].y + drawn[j].y) / 2;
                if (pointInImage(midX, midY)) continue;
                degree.set(i, (degree.get(i) ?? 0) + 1);
                degree.set(j, (degree.get(j) ?? 0) + 1);
                const near = 1 - Math.min(1, Math.hypot(midX - mouse.x, midY - mouse.y) / 230);
                const lineAlpha = Math.min(1, 0.95 * (1 - d / 126) * near * dimLevel);
                fxCtx.lineCap = 'round';
                fxCtx.strokeStyle = `rgba(${flow[0]},${flow[1]},${flow[2]},${(lineAlpha * 0.42).toFixed(3)})`;
                fxCtx.lineWidth = 4.4;
                fxCtx.beginPath();
                fxCtx.moveTo(drawn[i].x, drawn[i].y);
                fxCtx.lineTo(drawn[j].x, drawn[j].y);
                fxCtx.stroke();
                fxCtx.strokeStyle = `rgba(${flowLite[0]},${flowLite[1]},${flowLite[2]},${lineAlpha.toFixed(3)})`;
                fxCtx.lineWidth = 2;
                fxCtx.beginPath();
                fxCtx.moveTo(drawn[i].x, drawn[i].y);
                fxCtx.lineTo(drawn[j].x, drawn[j].y);
                fxCtx.stroke();
              }
            }
          }
        }

        if (!overHero) {
          const glowTint = mixRGB(sampleStops(AURORA, (time * 0.08) % 1), [250, 244, 224], 0.3);
          for (const node of drawn) {
            if (pointInImage(node.x, node.y)) continue;
            const pulse = 0.75 + 0.25 * Math.sin(time * 2.2 + node.x);
            fxCtx.fillStyle = `rgba(${glowTint[0]},${glowTint[1]},${glowTint[2]},${(0.42 * pulse * dimLevel).toFixed(3)})`;
            fxCtx.beginPath();
            fxCtx.arc(node.x, node.y, node.z * 6.2, 0, Math.PI * 2);
            fxCtx.fill();
          }
        }

        // Constelaciones ambientales: presencia sutil de borde a borde.
        // Mueren en pantalla o salen por la izquierda y renacen a la derecha.
        // En la banda del hero se desvanecen: esa zona queda solo con estrellas.
        const wantedAmbient = ambientCount();
        ambient = ambient.filter((c) => time - c.t0 < c.dur && c.x > -140);
        while (ambient.length < wantedAmbient) {
          spawnAmbient(width + 60 + Math.random() * 120);
        }
        const heroBottom = heroH - (scrollRef.current?.scrollTop ?? 0);
        for (const c of ambient) {
          c.x -= 0.032;
          const age = time - c.t0;
          const heroFade = Math.max(0, Math.min(1, (c.y - heroBottom) / 140));
          const fade = Math.min(1, age / 2.2) * Math.min(1, (c.dur - age) / 2.6) * heroFade;
          if (fade <= 0.01) continue;
          // Eco magnético: el cursor aviva ligeramente la constelación cercana
          let boost = 1;
          if (mouse.x > -999) {
            const dc = Math.hypot(mouse.x - c.x, mouse.y - c.y);
            if (dc < 300) boost += 0.5 * (1 - dc / 300);
          }
          const alpha = Math.min(1, 0.3 * fade * boost * dimLevel);
          // Tinte aurora propio de esta constelación, aclarado en el trazo fino
          const tint = c.tint;
          const tintLite = mixRGB(tint, [250, 244, 224], 0.55);
          fxCtx.lineCap = 'round';
          for (const [a, b] of c.edges) {
            const ax = c.x + c.nodes[a].ox;
            const ay = c.y + c.nodes[a].oy;
            const bx = c.x + c.nodes[b].ox;
            const by = c.y + c.nodes[b].oy;
            if (pointInImage((ax + bx) / 2, (ay + by) / 2)) continue;
            fxCtx.strokeStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${(alpha * 0.45).toFixed(3)})`;
            fxCtx.lineWidth = 3;
            fxCtx.beginPath();
            fxCtx.moveTo(ax, ay);
            fxCtx.lineTo(bx, by);
            fxCtx.stroke();
            fxCtx.strokeStyle = `rgba(${tintLite[0]},${tintLite[1]},${tintLite[2]},${alpha.toFixed(3)})`;
            fxCtx.lineWidth = 1.2;
            fxCtx.beginPath();
            fxCtx.moveTo(ax, ay);
            fxCtx.lineTo(bx, by);
            fxCtx.stroke();
          }
          for (const node of c.nodes) {
            const nx = c.x + node.ox;
            const ny = c.y + node.oy;
            if (pointInImage(nx, ny)) continue;
            const twinkle = 0.7 + 0.3 * Math.sin(time * 1.6 + node.phase);
            const halo = fxCtx.createRadialGradient(nx, ny, 0, nx, ny, 9);
            halo.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${(alpha * twinkle * 0.55).toFixed(3)})`);
            halo.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},0)`);
            fxCtx.fillStyle = halo;
            fxCtx.beginPath();
            fxCtx.arc(nx, ny, 9, 0, Math.PI * 2);
            fxCtx.fill();
            fxCtx.fillStyle = `rgba(250,244,224,${Math.min(1, alpha * twinkle * 1.3).toFixed(3)})`;
            fxCtx.beginPath();
            fxCtx.arc(nx, ny, 1.6, 0, Math.PI * 2);
            fxCtx.fill();
          }
        }

        // Estela del cursor sobre el hero: cinta continua por segmentos con la
        // paleta aurora fluyendo a lo largo de la cola, cabeza brillante y
        // polvo de acento naciendo a media cola para no ensuciar el halo.
        // En las salas de estudio la misma cinta se dibuja en la capa superior,
        // exenta del modo dim para que luzca plena sobre el panel.
        if (mouse.x > -999) {
          const zone = overStudio ? 'studio' : overHero ? 'hero' : null;
          if (zone) {
            const lastPt = trail[trail.length - 1];
            if (!lastPt || Math.hypot(mouse.x - lastPt.x, mouse.y - lastPt.y) > 1.2) {
              trail.push({ x: mouse.x, y: mouse.y, t: time });
            }
          }
          while (trail.length > 0 && time - trail[0].t > 0.38) trail.shift();
          if (trail.length > 40) trail.splice(0, trail.length - 40);

          if (overHero && trail.length >= 6 && sparkles.length < 150) {
            const di = Math.floor(trail.length * 0.55);
            const da = trail[di - 1];
            const db = trail[di];
            if (Math.hypot(db.x - da.x, db.y - da.y) > 26) {
              sparkles.push({
                x: db.x + (Math.random() - 0.5) * 10,
                y: db.y + (Math.random() - 0.5) * 10,
                vx: -(db.x - da.x) * 0.02 + (Math.random() - 0.5) * 0.4,
                vy: -(db.y - da.y) * 0.02 + (Math.random() - 0.5) * 0.4,
                life: 0.85,
                tint: Math.random() < 0.6 ? 1 : 0,
                size: 1 + Math.random() * 1.4,
                grav: 0.008,
                rgb: sampleStops(AURORA, Math.random()),
              });
            }
          }

          if (trail.length > 3) {
            const inStudio = zone === 'studio';
            const target = inStudio ? trailCtx : fxCtx;
            if (target) {
              const level = inStudio ? Math.max(dimLevel, 0.85) : dimLevel;
              target.save();
              target.globalCompositeOperation = 'lighter';
              const n = trail.length;
              const drift = (time * 0.12) % 1;
              // Normales y semianchos por punto: comparten ambas pasadas de color
              const normals: { nx: number; ny: number; half: number }[] = [];
              for (let i = 0; i < n; i += 1) {
                const prevPt = trail[Math.max(0, i - 1)];
                const nextPt = trail[Math.min(n - 1, i + 1)];
                const dx = nextPt.x - prevPt.x;
                const dy = nextPt.y - prevPt.y;
                const len = Math.hypot(dx, dy) || 1;
                const k = i / (n - 1);
                normals.push({
                  nx: -dy / len,
                  ny: dx / len,
                  half: Math.max(0.3, 12 * Math.pow(k, 1.5) * vscale),
                });
              }
              const drawQuadPass = (widthScale: number, alphaBase: number) => {
                for (let i = 1; i < n; i += 1) {
                  const k = i / (n - 1);
                  const [r, g, b] = sampleStops(AURORA, (k + drift) % 1);
                  const alpha = alphaBase * level * (0.35 + 0.65 * k);
                  const a0 = normals[i - 1].half * widthScale;
                  const a1 = normals[i].half * widthScale;
                  target.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
                  target.beginPath();
                  target.moveTo(trail[i - 1].x + normals[i - 1].nx * a0, trail[i - 1].y + normals[i - 1].ny * a0);
                  target.lineTo(trail[i].x + normals[i].nx * a1, trail[i].y + normals[i].ny * a1);
                  target.lineTo(trail[i].x - normals[i].nx * a1, trail[i].y - normals[i].ny * a1);
                  target.lineTo(trail[i - 1].x - normals[i - 1].nx * a0, trail[i - 1].y - normals[i - 1].ny * a0);
                  target.closePath();
                  target.fill();
                }
              };
              drawQuadPass(1, 0.2);
              drawQuadPass(0.42, 0.5);
              const head = trail[n - 1];
              const haloR = 15 * vscale;
              const headHalo = target.createRadialGradient(head.x, head.y, 0, head.x, head.y, haloR);
              headHalo.addColorStop(0, `rgba(255,250,238,${(0.8 * level).toFixed(3)})`);
              headHalo.addColorStop(0.35, `rgba(232,208,160,${(0.35 * level).toFixed(3)})`);
              headHalo.addColorStop(1, 'rgba(232,208,160,0)');
              target.fillStyle = headHalo;
              target.beginPath();
              target.arc(head.x, head.y, haloR, 0, Math.PI * 2);
              target.fill();
              target.restore();
            }
          }
        }

        sparkles = sparkles.filter((sp) => sp.life > 0.02);
        for (const sp of sparkles) {
          sp.x += sp.vx;
          sp.y += sp.vy;
          sp.vx *= 0.965;
          sp.vy = sp.vy * 0.965 + sp.grav;
          sp.life -= sp.size > 2.6 ? 0.018 : 0.024;
          const [sr, sg, sb] = sp.rgb ?? TINTS[sp.tint];
          fxCtx.fillStyle = `rgba(${sr},${sg},${sb},${Math.min(1, sp.life * 1.15 * dimLevel).toFixed(3)})`;
          fxCtx.beginPath();
          fxCtx.arc(sp.x, sp.y, sp.size * sp.life + 0.5, 0, Math.PI * 2);
          fxCtx.fill();
        }

        flashes = flashes.filter((flash) => flash.alpha > 0.02);
        for (const flash of flashes) {
          flash.r += 3.4;
          flash.alpha *= 0.87;
          const gradient = fxCtx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, flash.r * 2.4);
          gradient.addColorStop(0, `rgba(255,250,235,${flash.alpha.toFixed(3)})`);
          gradient.addColorStop(0.45, `rgba(230,204,150,${(flash.alpha * 0.5).toFixed(3)})`);
          gradient.addColorStop(1, 'rgba(230,204,150,0)');
          fxCtx.fillStyle = gradient;
          fxCtx.beginPath();
          fxCtx.arc(flash.x, flash.y, flash.r * 2.4, 0, Math.PI * 2);
          fxCtx.fill();
        }

        if (time > nextComet) {
          spawnAmbientComet();
          nextComet = time + 6 + Math.random() * 6;
        }
        comets = comets.filter((comet) => comet.life > 0);
        for (const comet of comets) {
          const prevX = comet.x;
          comet.x += comet.vx;
          comet.y += comet.vy;
          comet.vy += comet.curve;
          comet.life -= comet.size > 2.4 ? 0.009 : 0.012;

          // Proyectil de resortera sobre el título del hero: un impacto por proyectil
          if (comet.power !== undefined && !comet.hitTitle && letterRects.length > 0) {
            for (const r of letterRects) {
              if (
                comet.x >= r.x - 8 &&
                comet.x <= r.x + r.w + 8 &&
                comet.y >= r.y - 8 &&
                comet.y <= r.y + r.h + 8
              ) {
                comet.hitTitle = true;
                window.dispatchEvent(
                  new CustomEvent('mo-title-hit', {
                    detail: { x: comet.x, y: comet.y, vx: comet.vx, vy: comet.vy },
                  }),
                );
                break;
              }
            }
          }

          // Impacto lateral del proyectil a máxima potencia: chispas contra el muro
          if (
            comet.power !== undefined &&
            comet.power >= 0.95 &&
            ((comet.vx < 0 && prevX > 0 && comet.x <= 0) ||
              (comet.vx > 0 && prevX < width && comet.x >= width))
          ) {
            const wallX = comet.vx < 0 ? 3 : width - 3;
            comet.x = wallX;
            flashes.push({ x: wallX, y: comet.y, r: 8, alpha: 0.75 });
            // Burbuja de choque con color aleatorio de la paleta
            bubbles.push({
              x: wallX,
              y: comet.y,
              r: 14,
              alpha: 0.55,
              age: 0,
              tintT: Math.random() * 0.65,
            });
            const inward = comet.vx < 0 ? 1 : -1;
            const burstN = Math.round(26 + comet.size * 6);
            for (let s = 0; s < burstN; s += 1) {
              const spd = (2 + Math.random() * 5.25) * vscale;
              sparkles.push({
                x: wallX,
                y: comet.y + (Math.random() - 0.5) * 14,
                vx: inward * (1.5 + Math.random() * 4.5) * vscale,
                vy: (Math.random() - 0.65) * spd,
                life: 1,
                tint: Math.random() < 0.5 ? 1 : 0,
                size: 1.2 + Math.random() * 1.8,
                grav: 0.03,
                rgb: comet.tintRGB,
              });
            }
            if (sparkles.length > 160) sparkles.splice(0, sparkles.length - 160);
            comet.life = 0;
          }

          if (comet.x < -140 || comet.x > width + 140 || comet.y < -140 || comet.y > height + 90) {
            comet.life = 0;
          }
          const tailLen = 9 + comet.size * 4.5;
          const tailX = comet.x - comet.vx * tailLen;
          const tailY = comet.y - comet.vy * tailLen;
          const [tr, tg, tb] = comet.tintRGB ?? TINTS[comet.tint];
          const gradient = fxCtx.createLinearGradient(comet.x, comet.y, tailX, tailY);
          gradient.addColorStop(0, `rgba(${tr},${tg},${tb},${0.95 * comet.life * dimLevel})`);
          gradient.addColorStop(1, 'rgba(245,241,232,0)');
          fxCtx.strokeStyle = gradient;
          fxCtx.lineWidth = comet.size * 1.6;
          fxCtx.lineCap = 'round';
          fxCtx.beginPath();
          fxCtx.moveTo(comet.x, comet.y);
          fxCtx.lineTo(tailX, tailY);
          fxCtx.stroke();
          fxCtx.fillStyle = `rgba(255,252,244,${comet.life * dimLevel})`;
          fxCtx.beginPath();
          fxCtx.arc(comet.x, comet.y, comet.size, 0, Math.PI * 2);
          fxCtx.fill();
          const [hr, hg, hb] = comet.tintRGB ?? [230, 204, 150];
          const halo = fxCtx.createRadialGradient(comet.x, comet.y, 0, comet.x, comet.y, comet.size * 7);
          halo.addColorStop(0, `rgba(${hr},${hg},${hb},${(comet.size > 2.4 ? 0.5 : 0.22) * comet.life * dimLevel})`);
          halo.addColorStop(1, `rgba(${hr},${hg},${hb},0)`);
          fxCtx.fillStyle = halo;
          fxCtx.beginPath();
          fxCtx.arc(comet.x, comet.y, comet.size * 7, 0, Math.PI * 2);
          fxCtx.fill();
        }

        // Burbujas de choque: disco semitransparente que nace de un color
        // aleatorio de la paleta y deriva suavizado hacia el extremo claro
        bubbles = bubbles.filter((b) => b.alpha > 0.02);
        for (const b of bubbles) {
          b.age += 0.016;
          b.r += b.grow ?? 8.5;
          b.alpha *= 0.954;
          const drift = Math.min(0.97, b.tintT + b.age * 0.15);
          const col = sampleStops(AURORA, drift);
          const lite = mixRGB(col, [250, 244, 224], 0.35);
          const grad = fxCtx.createRadialGradient(b.x, b.y, b.r * 0.12, b.x, b.y, b.r);
          grad.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${(b.alpha * 0.14).toFixed(3)})`);
          grad.addColorStop(0.6, `rgba(${col[0]},${col[1]},${col[2]},${Math.min(1, b.alpha * 0.78).toFixed(3)})`);
          grad.addColorStop(0.86, `rgba(${lite[0]},${lite[1]},${lite[2]},${Math.min(1, b.alpha).toFixed(3)})`);
          grad.addColorStop(1, `rgba(${lite[0]},${lite[1]},${lite[2]},0)`);
          fxCtx.fillStyle = grad;
          fxCtx.beginPath();
          fxCtx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          fxCtx.fill();
          fxCtx.strokeStyle = `rgba(${lite[0]},${lite[1]},${lite[2]},${(b.alpha * 0.75).toFixed(3)})`;
          fxCtx.lineWidth = 1.6;
          fxCtx.beginPath();
          fxCtx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          fxCtx.stroke();
        }

        waves = waves.filter((wave) => wave.alpha > 0.02);
        for (const wave of waves) {
          if (wave.delay > 0) {
            wave.delay -= 0.016;
            continue;
          }
          wave.r += wave.grow ?? 7;
          wave.alpha *= wave.decay ?? 0.94;
          if (wave.r <= 0) continue;
          const wBase = wave.width ?? 1.2;
          // Doble trazo: halo dorado ancho + nucleo crema brillante
          fxCtx.strokeStyle = `rgba(201,168,106,${(wave.alpha * 0.35 * dimLevel).toFixed(3)})`;
          fxCtx.lineWidth = wBase * 2.6;
          fxCtx.beginPath();
          fxCtx.arc(wave.x, wave.y, wave.r, 0, Math.PI * 2);
          fxCtx.stroke();
          fxCtx.strokeStyle = `rgba(245,235,205,${Math.min(1, wave.alpha * 0.85 * dimLevel).toFixed(3)})`;
          fxCtx.lineWidth = wBase;
          fxCtx.beginPath();
          fxCtx.arc(wave.x, wave.y, wave.r, 0, Math.PI * 2);
          fxCtx.stroke();
        }

        // Resortera: anillo de carga + línea de mira + trayectoria proyectada
        if (charge) {
          const p = Math.min(1, (time - charge.t0) / 1.1);
          const ringR = 24 + p * 12;
          const glow = 0.5 + 0.35 * p + (p >= 1 ? 0.15 * Math.sin(time * 9) : 0);
          fxCtx.strokeStyle = `rgba(230,204,158,${glow.toFixed(3)})`;
          fxCtx.lineWidth = 2.4;
          fxCtx.lineCap = 'round';
          fxCtx.beginPath();
          fxCtx.arc(charge.x, charge.y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
          fxCtx.stroke();
          fxCtx.strokeStyle = `rgba(245,241,232,${(0.16 * dimLevel).toFixed(3)})`;
          fxCtx.lineWidth = 1;
          fxCtx.beginPath();
          fxCtx.arc(charge.x, charge.y, ringR, 0, Math.PI * 2);
          fxCtx.stroke();

          const pullX = charge.x - charge.dx;
          const pullY = charge.y - charge.dy;
          const pullDist = Math.hypot(pullX, pullY);

          if (pullDist >= 6) {
            // Línea de arrastre punteada (hacia atrás)
            fxCtx.setLineDash([5, 7]);
            fxCtx.strokeStyle = `rgba(245,241,232,${(0.4 * dimLevel).toFixed(3)})`;
            fxCtx.lineWidth = 1.4;
            fxCtx.beginPath();
            fxCtx.moveTo(charge.x, charge.y);
            fxCtx.lineTo(charge.dx, charge.dy);
            fxCtx.stroke();

            // Trayectoria proyectada del lanzamiento (sentido contrario)
            const normP = pullDist || 1;
            const projLen = Math.min(260, (60 + pullDist * 1.5) * (0.45 + 0.55 * p));
            fxCtx.setLineDash([]);
            const grad = fxCtx.createLinearGradient(charge.x, charge.y, charge.x + (pullX / normP) * projLen, charge.y + (pullY / normP) * projLen);
            grad.addColorStop(0, `rgba(230,204,158,${(0.55 * dimLevel).toFixed(3)})`);
            grad.addColorStop(1, 'rgba(230,204,158,0)');
            fxCtx.strokeStyle = grad;
            fxCtx.lineWidth = 2.2;
            fxCtx.beginPath();
            fxCtx.moveTo(charge.x, charge.y);
            fxCtx.lineTo(charge.x + (pullX / normP) * projLen, charge.y + (pullY / normP) * projLen);
            fxCtx.stroke();
          } else {
            // Sin arrastre: partículas convergiendo al punto de carga
            if (sparkles.length < 150) {
              const ang = Math.random() * Math.PI * 2;
              const d = (70 + Math.random() * 50) * vscale;
              const spd = (1.6 + p * 1.6) * vscale;
              sparkles.push({
                x: charge.x + Math.cos(ang) * d,
                y: charge.y + Math.sin(ang) * d,
                vx: -Math.cos(ang) * spd,
                vy: -Math.sin(ang) * spd,
                life: 0.85,
                tint: 1,
                size: 1.4 + Math.random(),
                grav: 0,
              });
            }
          }
        }

        // Constelación dibujada: líneas aurora entre nodos, se desvanece sola
        if (sketch && sketch.nodes.length > 0) {
          const fade = Math.max(0, Math.min(1, 1 - (time - sketch.lastAdd - 4.5) / 1.5));
          if (fade <= 0) {
            sketch = null;
          } else {
            const flowS = sampleStops(AURORA, (time * 0.08) % 1);
            const flowSLite = mixRGB(flowS, [250, 244, 224], 0.6);
            fxCtx.lineCap = 'round';
            for (let i = 1; i < sketch.nodes.length; i += 1) {
              const a = sketch.nodes[i - 1];
              const b = sketch.nodes[i];
              fxCtx.strokeStyle = `rgba(${flowS[0]},${flowS[1]},${flowS[2]},${(0.4 * fade * dimLevel).toFixed(3)})`;
              fxCtx.lineWidth = 3.6;
              fxCtx.beginPath();
              fxCtx.moveTo(a.x, a.y);
              fxCtx.lineTo(b.x, b.y);
              fxCtx.stroke();
              fxCtx.strokeStyle = `rgba(${flowSLite[0]},${flowSLite[1]},${flowSLite[2]},${(0.85 * fade * dimLevel).toFixed(3)})`;
              fxCtx.lineWidth = 1.4;
              fxCtx.beginPath();
              fxCtx.moveTo(a.x, a.y);
              fxCtx.lineTo(b.x, b.y);
              fxCtx.stroke();
            }
            sketch.nodes.forEach((node, index) => {
              const twinkleN = 0.7 + 0.3 * Math.sin(time * 3 + index * 1.3);
              const haloS = fxCtx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 11);
              haloS.addColorStop(0, `rgba(${flowS[0]},${flowS[1]},${flowS[2]},${(0.5 * fade * twinkleN * dimLevel).toFixed(3)})`);
              haloS.addColorStop(1, `rgba(${flowS[0]},${flowS[1]},${flowS[2]},0)`);
              fxCtx.fillStyle = haloS;
              fxCtx.beginPath();
              fxCtx.arc(node.x, node.y, 11, 0, Math.PI * 2);
              fxCtx.fill();
              fxCtx.fillStyle = `rgba(255,250,238,${(fade * dimLevel).toFixed(3)})`;
              fxCtx.beginPath();
              fxCtx.arc(node.x, node.y, 2.4, 0, Math.PI * 2);
              fxCtx.fill();
            });
          }
        }
      }

      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener('resize', resize);
    const DIR_KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      KeyW: 'up',
      KeyS: 'down',
      KeyA: 'left',
      KeyD: 'right',
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        charge = null;
        sketch = null;
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea')) return;
      const dir = DIR_KEYS[event.code];
      if (dir && !event.repeat) heldDirs.add(dir);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const dir = DIR_KEYS[event.code];
      if (dir) heldDirs.delete(dir);
    };
    const onWinBlur = () => {
      onUp();
      heldDirs.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mo-warp', onWarp);

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('blur', onWinBlur);
    const scrollEl = scrollRef.current;
    scrollEl?.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mo-warp', onWarp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('blur', onWinBlur);
      scrollEl?.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [scrollRef]);

  return (
    <>
      <canvas ref={canvasRef} className="mo-starfield" aria-hidden="true" />
      <canvas ref={fxRef} className="mo-starfx" aria-hidden="true" />
      <canvas ref={trailRef} className="mo-trailfx" aria-hidden="true" />
    </>
  );
};
