import { useEffect, useRef, type RefObject } from 'react';
import {
  PLAYGROUND_ARRIVAL_END_MS,
  PLAYGROUND_ARRIVAL_START_MS,
  PLAYGROUND_DEPARTURE_END_MS,
  PLAYGROUND_DEPARTURE_START_MS,
} from './playgroundTiming';

export interface PlaygroundProgress {
  destroyed: number;
  total: number;
  phase: 'active' | 'complete';
}

interface StarfieldProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  museumKeyboardVelocityRef?: RefObject<number>;
  dim?: boolean;
  playground?: boolean;
  playgroundScene?: 'museum' | 'arriving' | 'active' | 'departing';
  playgroundRunId?: number;
  playgroundPhase?: PlaygroundProgress['phase'];
  onPlaygroundProgress?: (progress: PlaygroundProgress) => void;
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

type EffectLayer = 'museum' | 'studio';
type PlaygroundWeaponAffinity = 'charged' | 'rapid';
type PlayerProjectileKind = PlaygroundWeaponAffinity;

interface ViewRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PageTextRect extends ViewRect {
  element: HTMLElement;
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
  tintRGB?: RGB;
  layer?: EffectLayer;
  hitLetterIndices?: Set<number>;
  hitPgLetterIndices?: Set<number>;
  hitSketchSegments?: Set<string>;
  hitTextElements?: Set<HTMLElement>;
  hitPlaygroundLetterIds?: Set<number>;
  tailAge?: number;
  launchPower?: number;
  bounceCount?: number;
  lateralBounces?: number;
  labMirror?: boolean;
  labWarpAt?: number;
  labCaptured?: { x: number; y: number; t0: number } | null;
  seed?: number;
  spin?: number;
  spinAngle?: number;
  heat?: number;
  damageSpent?: number;
  projectileKind?: PlayerProjectileKind;
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
  layer?: EffectLayer;
  curve?: number;
  projectileKind?: PlayerProjectileKind;
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
  rgb?: RGB;
  layer?: EffectLayer;
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
  layer?: EffectLayer;
}

interface Flash {
  x: number;
  y: number;
  r: number;
  alpha: number;
  rgb?: RGB;
  layer?: EffectLayer;
}

interface SketchState {
  id: number;
  nodes: { x: number; y: number }[];
  lastAdd: number;
  layer: EffectLayer;
  segmentCharges: number[];
  chargedSegments: Set<number>;
  segmentContacts: Set<number>[];
  segmentTriggeredAt: number[];
  armed?: number;
}

/* Punto de energía viajando por la constelación tras una supernova */
interface ConductionDot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  layer: EffectLayer;
}

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  tint: number;
  size: number;
  grav: number;
  rgb?: RGB;
  layer?: EffectLayer;
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

interface PlaygroundLetter {
  id: number;
  character: string;
  worldU: number;
  worldV: number;
  destinationU: number;
  destinationV: number;
  roamVX: number;
  roamVY: number;
  cruiseSpeed: number;
  acceleration: number;
  profile: 'drift' | 'orbit' | 'pause' | 'wander';
  curve: number;
  nextWaypoint: number;
  pauseUntil: number;
  rngState: number;
  floatRadiusX: number;
  floatRadiusY: number;
  floatRateX: number;
  floatRateY: number;
  offsetX: number;
  offsetY: number;
  vx: number;
  vy: number;
  affinity: PlaygroundWeaponAffinity;
  maxHp: number;
  hp: number;
  slowedUntil: number;
  previousScreenX?: number;
  previousScreenY?: number;
  phase: number;
  nextEvade: number;
  nextPointerEvade: number;
  nextDart: number;
  threatenedUntil: number;
  destroyed: boolean;
  deathX?: number;
  deathY?: number;
  destroyedAt?: number;
}

interface ComboLabel {
  x: number;
  y: number;
  multiplier: number;
  life: number;
}

interface WarpDetail {
  strength?: number;
  direction?: -1 | 1;
  durationMs?: number;
  travelSpeed?: number;
}

interface ScriptedWarp {
  startedAt: number;
  durationMs: number;
  peakVelocity: number;
  direction: -1 | 1;
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

const PAGE_TEXT_TARGET_SELECTOR = [
  '.mo-sala .mo-sala-no',
  '.mo-sala-copy > .mo-kicker',
  '.mo-sala-copy > h2',
  '.mo-sala-copy > .mo-lede',
  '.mo-sala-note > summary',
  '.mo-sala-note > p',
  '.mo-sala-figure > figcaption',
  '.mo-obra-meta > .mo-plate',
  '.mo-obra-meta > h3',
  '.mo-obra-meta > p',
  '.mo-obra-meta > .mo-obra-cta',
  '.mo-vitrina > .mo-section-head > .mo-kicker',
  '.mo-vitrina > .mo-section-head > h2',
  '.mo-vitrina > .mo-section-head > .mo-section-sub',
  '.mo-vitrina > .mo-vitrina-empty',
  '.mo-vitrina-title > .mo-plate',
  '.mo-vitrina-title > h3',
  '.mo-vitrina-card > .mo-chip-row',
  '.mo-vitrina-card > .mo-metrics-v2 > div',
  '.mo-vitrina-card > .mo-vitrina-mechanism',
  '.mo-archivo > .mo-section-head > .mo-kicker',
  '.mo-archivo > .mo-section-head > h2',
  '.mo-archivo > .mo-section-head > .mo-section-sub',
  '.mo-archivo-list > li > b',
  '.mo-archivo-list > li > div',
  '.mo-archivo-list > li > i',
  '.mo-footer > blockquote',
  '.mo-footer > .mo-footer-line',
  '.mo-studio-brief > .mo-kicker',
  '.mo-studio-brief > h2',
  '.mo-studio-brief > .mo-chip-row > span',
  '.mo-studio .mo-reader-kicker',
  '.mo-studio .mo-reader-standfirst',
  '.mo-studio .mo-reader > p',
  '.mo-studio .mo-reader-section > h3',
  '.mo-studio .mo-reader-section > p',
  '.mo-studio .mo-callout',
  '.mo-studio .mo-takeaways article',
  '.mo-studio .mo-dossier-section > h3',
  '.mo-studio .mo-dossier-section dd',
  '.mo-studio .mo-dossier-foot h4',
  '.mo-studio .mo-dossier-foot li',
  '.mo-studio .mo-final-quote',
].join(',');

/* Tintes vivos para los proyectiles de la resortera */
const VIVID_TINTS: RGB[] = [
  [255, 92, 164],
  [96, 214, 255],
  [64, 224, 158],
  [255, 176, 84],
  [167, 139, 250],
  [142, 240, 255],
];

const PLAYGROUND_WORD = 'ASTROINGENIERÍA';
const PLAYGROUND_LETTER_HP = 60;
const PLAYGROUND_RAPID_LETTER_HP = 120;
const PLAYGROUND_BASE_DAMAGE = 20;
const PLAYGROUND_RAPID_FIRE_EXPERIMENT = true;
const PLAYGROUND_RAPID_FIRE_INTERVAL = 1 / 9;
const PLAYGROUND_RAPID_DAMAGE = 3;
const PLAYGROUND_SEGMENT_CHARGE_HITS = 10;
const PLAYGROUND_SLOW_FACTOR = 0.45;
const PLAYGROUND_SLOW_DURATION = 5;
const PLAYGROUND_RAPID_TINT: RGB = [188, 232, 255];
const PLAYGROUND_CHARGED_TINT: RGB = [255, 176, 84];
const PLAYGROUND_FIELD_U = 1.78;
const PLAYGROUND_FIELD_V = 1.18;
const PLAYGROUND_PROFILES: PlaygroundLetter['profile'][] = ['drift', 'orbit', 'pause', 'wander'];
/* Diseño "brasa" para el proyectil de clic+arrastre: esquirla poligonal
   irregular con grietas incandescentes y estela de ceniza. false = diseño
   clásico (núcleo circular + cinta degradada). Un flag, dos looks. */
const EMBER_METEORITE_DESIGN = true;
/* Sales minerales: como en las llamas de laboratorio, cada esquirla arde
   con un matiz distinto (cobre verdoso, sal azulada, violeta de potasio...)
   siempre sobre cuerpo de roca cálida — variedad sin verosimilitud falsa. */
const EMBER_SALTS: RGB[] = [
  [255, 176, 84],
  [255, 128, 96],
  [255, 210, 120],
  [150, 232, 190],
  [150, 196, 255],
  [205, 160, 255],
];
const PULSAR_ORBIT_RX = 62;
const PULSAR_ORBIT_RY = 44;
const PULSAR_ORBIT_SPIN = 1.5;
const PULSAR_RING_PRECESSION = 0.35;
const PULSAR_RETURN_SPEED = 800;
const PULSAR_RETURN_MIN = 0.3;
const PULSAR_RETURN_MAX = 1;

const smoothstep = (value: number) => {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
};

/* Ruido determinista por semilla: silueta única por esquirla */
const emberWobble = (seed: number, vertex: number) => {
  const value = Math.sin(seed * 127.1 + vertex * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

export const playgroundBounceMultiplier = (bounceCount: number) =>
  bounceCount <= 0 ? 1 : Math.min(25, bounceCount * 5);

export const playgroundDamageBudget = (launchPower: number, bounceCount: number) =>
  PLAYGROUND_BASE_DAMAGE * Math.max(0, Math.min(1, launchPower)) * playgroundBounceMultiplier(bounceCount);

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

/* Espacio toroidal del playground: coordenada envuelta a un rango [0, span) y,
   para objetos extensos (constelaciones), la instancia cuyo centro queda más
   cerca del centro de pantalla, de modo que nunca se partan por la costura */
const wrapSpan = (value: number, span: number) => ((value % span) + span) % span;

const wrapNearest = (value: number, span: number, center: number) => {
  const wrapped = wrapSpan(value, span);
  if (wrapped - center > span / 2) return wrapped - span;
  if (center - wrapped > span / 2) return wrapped + span;
  return wrapped;
};

const pointInRect = (x: number, y: number, rect: ViewRect) =>
  x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;

const segmentRectEntry = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rect: ViewRect,
  padding = 0,
) => {
  const left = rect.x - padding;
  const right = rect.x + rect.w + padding;
  const top = rect.y - padding;
  const bottom = rect.y + rect.h + padding;
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tMin = 0;
  let tMax = 1;

  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-8) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > tMax) return false;
      if (t > tMin) tMin = t;
    } else {
      if (t < tMin) return false;
      if (t < tMax) tMax = t;
    }
    return true;
  };

  if (
    !clip(-dx, x0 - left) ||
    !clip(dx, right - x0) ||
    !clip(-dy, y0 - top) ||
    !clip(dy, bottom - y0)
  ) {
    return null;
  }
  return Math.max(0, Math.min(1, tMin));
};

const closestPointOnSegment = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) => {
  const dx = bx - ax;
  const dy = by - ay;
  const denom = dx * dx + dy * dy;
  const t = denom > 1e-8 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / denom)) : 0;
  const x = ax + dx * t;
  const y = ay + dy * t;
  return { x, y, t, dist2: (px - x) ** 2 + (py - y) ** 2 };
};

const segmentIntersection = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
) => {
  const rx = bx - ax;
  const ry = by - ay;
  const sx = dx - cx;
  const sy = dy - cy;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-8) return null;
  const qx = cx - ax;
  const qy = cy - ay;
  const t = (qx * sy - qy * sx) / denom;
  const u = (qx * ry - qy * rx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: ax + rx * t, y: ay + ry * t, t };
};

const sweptSegmentHit = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  radius: number,
) => {
  const crossing = segmentIntersection(x0, y0, x1, y1, ax, ay, bx, by);
  if (crossing) {
    let nx = -(by - ay);
    let ny = bx - ax;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    if ((x1 - x0) * nx + (y1 - y0) * ny > 0) {
      nx *= -1;
      ny *= -1;
    }
    return { ...crossing, nx, ny };
  }

  const candidates: { x: number; y: number; sx: number; sy: number; t: number; dist2: number }[] = [];
  const fromStart = closestPointOnSegment(x0, y0, ax, ay, bx, by);
  candidates.push({ x: x0, y: y0, sx: fromStart.x, sy: fromStart.y, t: 0, dist2: fromStart.dist2 });
  const fromEnd = closestPointOnSegment(x1, y1, ax, ay, bx, by);
  candidates.push({ x: x1, y: y1, sx: fromEnd.x, sy: fromEnd.y, t: 1, dist2: fromEnd.dist2 });
  for (const [sx, sy] of [[ax, ay], [bx, by]] as const) {
    const onMotion = closestPointOnSegment(sx, sy, x0, y0, x1, y1);
    candidates.push({ x: onMotion.x, y: onMotion.y, sx, sy, t: onMotion.t, dist2: onMotion.dist2 });
  }
  const hit = candidates.sort((a, b) => a.dist2 - b.dist2 || a.t - b.t)[0];
  if (!hit || hit.dist2 > radius * radius) return null;
  let nx = hit.x - hit.sx;
  let ny = hit.y - hit.sy;
  let nl = Math.hypot(nx, ny);
  if (nl < 1e-6) {
    nx = -(by - ay);
    ny = bx - ax;
    nl = Math.hypot(nx, ny) || 1;
  }
  nx /= nl;
  ny /= nl;
  if ((x1 - x0) * nx + (y1 - y0) * ny > 0) {
    nx *= -1;
    ny *= -1;
  }
  return { x: hit.x, y: hit.y, t: hit.t, nx, ny };
};

export const StarfieldCanvas = ({
  scrollRef,
  museumKeyboardVelocityRef,
  dim = false,
  playground = false,
  playgroundScene = 'museum',
  playgroundRunId = 0,
  playgroundPhase: requestedPlaygroundPhase = 'active',
  onPlaygroundProgress,
}: StarfieldProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<HTMLCanvasElement>(null);
  const dimRef = useRef(dim);
  dimRef.current = dim;
  const playgroundRef = useRef(playground);
  playgroundRef.current = playground;
  const playgroundSceneRef = useRef(playgroundScene);
  playgroundSceneRef.current = playgroundScene;
  const playgroundRunIdRef = useRef(playgroundRunId);
  playgroundRunIdRef.current = playgroundRunId;
  const requestedPlaygroundPhaseRef = useRef(requestedPlaygroundPhase);
  requestedPlaygroundPhaseRef.current = requestedPlaygroundPhase;
  const onPlaygroundProgressRef = useRef(onPlaygroundProgress);
  onPlaygroundProgressRef.current = onPlaygroundProgress;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const rapidFireAvailable =
      PLAYGROUND_RAPID_FIRE_EXPERIMENT &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const scrollEl = scrollRef.current;

    let width = 0;
    let height = 0;
    let vscale = 1;
    let stars: Star[] = [];
    let comets: Comet[] = [];
    let waves: Wave[] = [];
    let bubbles: ShockBubble[] = [];
    let flashes: Flash[] = [];
    let sparkles: Sparkle[] = [];
    let conductions: ConductionDot[] = [];

    /* ==== SANDBOX LAB: escena secreta de experimentación (mantén ← 2s) ====
       Objetos de prueba invocables con teclas; costo cero fuera de ella. */
    let sandboxActive = false;
    let sandboxChargeT0: number | null = null;
    let sandboxTimeScale = 1;
    let labQHeld = false;
    let labEHeld = false;
    let labFps = 60;
    let lastFrameNow = 0;
    /* Primera generación de experimentos (enjambre, pozos, espejo): el código
       queda vivo pero fuera del teclado — SANDBOX_CLASSIC_EXPERIMENTS en true
       los recupera sin tocar nada más. */
    const SANDBOX_CLASSIC_EXPERIMENTS = false;
    /* Diseño "Gargantua" del agujero negro: sombra pura + anillo de fotones
       con doppler beaming + disco de acreción térmico + luz doblada por el
       lente. false = diseño clásico (disco azul + anillo simple). */
    const LAB_BLACKHOLE_V2 = true;
    interface LabHole {
      x: number;
      y: number;
      born: number;
    }
    interface LabWell {
      x: number;
      y: number;
      strength: number;
    }
    interface LabDummy {
      x: number;
      y: number;
      vx: number;
      vy: number;
      warpAt?: number;
    }
    interface LabSwarm {
      x: number;
      y: number;
      vx: number;
      vy: number;
      hue: number;
    }
    interface LabEmitter {
      x: number;
      y: number;
      born: number;
      angle: number;
      nextShot: number;
    }
    interface LabRing {
      x: number;
      y: number;
      born: number;
      tilt: number;
      particles: {
        ang: number;
        rad: number;
        speed: number;
        size: number;
        tint: number;
        kick: number;
        kickAng: number;
      }[];
    }
    interface LabBinary {
      x: number;
      y: number;
      born: number;
      phase: number;
      nextFlare: number;
    }
    interface LabWormhole {
      ax: number;
      ay: number;
      bx: number;
      by: number;
      born: number;
    }
    const labHoles: LabHole[] = [];
    const labWells: LabWell[] = [];
    const labDummies: LabDummy[] = [];
    const labSwarm: LabSwarm[] = [];
    const labEmitters: LabEmitter[] = [];
    const labRings: LabRing[] = [];
    const labBinaries: LabBinary[] = [];
    const labWormholes: LabWormhole[] = [];
    let raf = 0;
    let time = 0;
    // Paso de simulación real (limitado): en equipos lentos los relojes y
    // fases avanzan a tiempo real en vez de ir a camara lenta.
    let dt = 0.016;
    let scrollVel = 0;
    let lastScroll = scrollRef.current?.scrollTop ?? 0;
    let dimLevel = 0;
    let running = true;
    let nextComet = time + 4 + Math.random() * 5;
    let warpBoost = 0;
    let warpDirection: -1 | 1 = 1;
    let scriptedWarp: ScriptedWarp | null = null;
    // Cámara libre del playground: posición y velocidad en espacio infinito.
    // Fuera del playground queda quieta (velocidad amortiguada a cero).
    let camX = 0;
    let camY = 0;
    let camVX = 0;
    let camVY = 0;
    let charge: { x: number; y: number; t0: number; dx: number; dy: number; layer: EffectLayer } | null = null;
    const museumRoot = scrollEl?.closest<HTMLElement>('.mo-root') ?? null;
    const setCatapultDragging = (dragging: boolean) => {
      museumRoot?.classList.toggle('is-catapult-dragging', dragging);
    };
    const clearCharge = () => {
      charge = null;
      setCatapultDragging(false);
    };
    let sketch: SketchState | null = null;
    let rapidFireHeld = false;
    let nextRapidFireAt = 0;
    let pulsarAngle = 0;
    let pulsarRingAngle = Math.PI * 0.25;
    let pulsarPhase: 'orbit' | 'firing' | 'returning' = 'orbit';
    let pulsarAnchorX = 0;
    let pulsarAnchorY = 0;
    let pulsarPhaseAt = 0;
    let pulsarReturnStart = 0;
    let pulsarReturnDuration = 0;
    let pulsarOrbitX = 0;
    let pulsarOrbitY = 0;
    let pulsarOrbitReady = false;
    let nextSketchId = 1;
    let ambient: AmbientConstellation[] = [];
    let playgroundTargets: PlaygroundLetter[] = [];
    let playgroundPhase: PlaygroundProgress['phase'] = 'active';
    let activePlaygroundRunId = -1;
    let comboLabels: ComboLabel[] = [];
    const clearSketch = () => {
      sketch = null;
    };
    // El hero es zona sin constelaciones de cursor: allí manda la estela
    let overHero = false;
    // Sala de estudio abierta bajo el puntero: allí la estela usa capa superior
    let overStudio = false;
    let heroH = 0;
    // Rects (viewport) de las imágenes: sobre ellas solo se dejan ver las
    // constelaciones dibujadas con Mayús+clic; el resto se oculta tras la foto.
    let imgRects: ViewRect[] = [];
    let letterRects: ViewRect[] = [];
    let pgLetterRects: ViewRect[] = [];
    let textRects: PageTextRect[] = [];
    let studioRect: ViewRect | null = null;
    let rectsDirty = true;
    let nextRectCheck = 0;
    const visibleTextTargets = new Set<HTMLElement>();
    const observedTextTargets = new Set<HTMLElement>();
    const textObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const element = entry.target as HTMLElement;
          if (entry.isIntersecting) visibleTextTargets.add(element);
          else visibleTextTargets.delete(element);
        });
        rectsDirty = true;
      },
      { root: scrollEl, rootMargin: '160px 80px' },
    );

    const syncTextTargets = () => {
      if (!scrollEl) return;
      const nextTargets = new Set(
        Array.from(scrollEl.querySelectorAll<HTMLElement>(PAGE_TEXT_TARGET_SELECTOR)),
      );
      observedTextTargets.forEach((element) => {
        if (nextTargets.has(element)) return;
        textObserver.unobserve(element);
        observedTextTargets.delete(element);
        visibleTextTargets.delete(element);
      });
      nextTargets.forEach((element) => {
        if (observedTextTargets.has(element)) return;
        observedTextTargets.add(element);
        textObserver.observe(element);
      });
      rectsDirty = true;
    };

    // Historial del puntero para la estela continua tipo cometa del hero
    const trail: { x: number; y: number; t: number }[] = [];

    // Capa frontal para meteoros y destellos: viajan por encima del museo
    const fxCtx = fxRef.current?.getContext('2d') ?? null;
    // Capa superior exclusiva de la estela aurora dentro de las salas de estudio
    const trailCtx = trailRef.current?.getContext('2d') ?? null;

    const mouse = { x: -9999, y: -9999, sx: -9999, sy: -9999 };

    const notifyPlaygroundProgress = () => {
      const destroyed = playgroundTargets.filter((target) => target.destroyed).length;
      onPlaygroundProgressRef.current?.({
        destroyed,
        total: PLAYGROUND_WORD.length,
        phase: playgroundPhase,
      });
    };

    const seededRandom = (seedValue: number) => {
      let state = (seedValue || 1) >>> 0;
      return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
      };
    };

    const nextLetterRandom = (target: PlaygroundLetter) => {
      target.rngState = (target.rngState * 1664525 + 1013904223) >>> 0;
      return target.rngState / 4294967296;
    };

    const chooseLetterWaypoint = (target: PlaygroundLetter) => {
      const distanceRange =
        target.profile === 'drift'
          ? [0.42, 0.72]
          : target.profile === 'wander'
            ? [0.3, 0.58]
            : [0.36, 0.7];
      let nextU = target.worldU;
      let nextV = target.worldV;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const angle = nextLetterRandom(target) * Math.PI * 2;
        const distance = distanceRange[0] + nextLetterRandom(target) * (distanceRange[1] - distanceRange[0]);
        const candidateU = Math.max(-PLAYGROUND_FIELD_U, Math.min(PLAYGROUND_FIELD_U, target.worldU + Math.cos(angle) * distance));
        const candidateV = Math.max(-PLAYGROUND_FIELD_V, Math.min(PLAYGROUND_FIELD_V, target.worldV + Math.sin(angle) * distance));
        const isClear = playgroundTargets.every(
          (other) =>
            other === target ||
            Math.hypot(candidateU - other.worldU, candidateV - other.worldV) > 0.24,
        );
        nextU = candidateU;
        nextV = candidateV;
        if (isClear && Math.hypot(nextU - target.worldU, nextV - target.worldV) > 0.22) break;
      }
      target.destinationU = nextU;
      target.destinationV = nextV;
      target.pauseUntil = time;
      const travelWindow = target.profile === 'wander' ? 6 : target.profile === 'drift' ? 13 : 9;
      target.nextWaypoint = time + travelWindow + nextLetterRandom(target) * 5;
    };

    const beginPlaygroundRun = (runId: number) => {
      const random = seededRandom(runId + 92821);
      const slots = Array.from({ length: PLAYGROUND_WORD.length }, (_, index) => {
        const column = index % 5;
        const row = Math.floor(index / 5);
        return {
          u: (column - 2) * 0.8 + (random() - 0.5) * 0.22,
          v: (row - 1) * 0.86 + (random() - 0.5) * 0.2,
        };
      });
      for (let index = slots.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [slots[index], slots[swapIndex]] = [slots[swapIndex], slots[index]];
      }
      const affinities: PlaygroundWeaponAffinity[] = Array.from(
        { length: PLAYGROUND_WORD.length },
        (_, index) => (rapidFireAvailable && index < 8 ? 'rapid' : 'charged'),
      );
      for (let index = affinities.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [affinities[index], affinities[swapIndex]] = [affinities[swapIndex], affinities[index]];
      }
      playgroundTargets = PLAYGROUND_WORD.split('').map((character, index) => {
        const affinity = affinities[index];
        const movementScale = rapidFireAvailable ? 7 : 1;
        const maxHp = affinity === 'rapid' ? PLAYGROUND_RAPID_LETTER_HP : PLAYGROUND_LETTER_HP;
        return {
          id: index,
          character,
          worldU: slots[index].u,
          worldV: slots[index].v,
          destinationU: slots[index].u,
          destinationV: slots[index].v,
          roamVX: 0,
          roamVY: 0,
          cruiseSpeed: (0.02 + random() * 0.017) * movementScale,
          acceleration: (0.016 + random() * 0.014) * movementScale,
          profile: PLAYGROUND_PROFILES[index % PLAYGROUND_PROFILES.length],
          curve: 0.3 + random() * 0.85,
          nextWaypoint: 0,
          pauseUntil: 0,
          rngState: (((runId + 1) * 2654435761 + (index + 11) * 2246822519) >>> 0) || 1,
          floatRadiusX: 3 + random() * 9,
          floatRadiusY: 3 + random() * 8,
          floatRateX: 0.18 + random() * 0.24,
          floatRateY: 0.16 + random() * 0.22,
          offsetX: 0,
          offsetY: 0,
          vx: 0,
          vy: 0,
          affinity,
          maxHp,
          hp: maxHp,
          slowedUntil: 0,
          phase: random() * Math.PI * 2,
          nextEvade: 0,
          nextPointerEvade: 0,
          nextDart: 0,
          threatenedUntil: 0,
          destroyed: false,
        };
      });
      playgroundTargets.forEach((target) => chooseLetterWaypoint(target));
      playgroundPhase = 'active';
      activePlaygroundRunId = runId;
      // La W usada para confirmar la entrada no se hereda como impulso de cámara:
      // hay que soltarla y pulsarla de nuevo ya dentro del minijuego.
      heldDirs.clear();
      heldMovementCodes.clear();
      boostedWasdCodes.clear();
      lastWasdDown.clear();
      boostLatched = false;
      shiftHeld = false;
      camX = 0;
      camY = 0;
      camVX = 0;
      camVY = 0;
      clearCharge();
      sketch = null;
      rapidFireHeld = false;
      resetPulsarPet();
      nextRapidFireAt = time;
      comboLabels = [];
      comets = comets.filter((comet) => comet.launchPower === undefined);
      notifyPlaygroundProgress();
    };

    const playgroundFontSize = () => Math.max(58, Math.min(116, Math.min(width, height) * 0.14));

    const playgroundLetterCenter = (target: PlaygroundLetter) => ({
      x:
        width / 2 +
        target.worldU * width +
        target.offsetX +
        Math.cos(time * target.floatRateX + target.phase) * target.floatRadiusX * Math.max(0.65, vscale) -
        camX,
      y:
        height / 2 +
        target.worldV * height +
        target.offsetY +
        Math.sin(time * target.floatRateY + target.phase * 1.37) * target.floatRadiusY * Math.max(0.65, vscale) -
        camY,
    });

    const playgroundLetterRect = (target: PlaygroundLetter): ViewRect => {
      const center = playgroundLetterCenter(target);
      const fontSize = playgroundFontSize();
      const glyphWidth = Math.max(fontSize * 0.58, fontSize * (target.character === 'I' || target.character === 'Í' ? 0.38 : 0.68));
      return {
        x: center.x - glyphWidth / 2 - 12,
        y: center.y - fontSize * 0.58,
        w: glyphWidth + 24,
        h: fontSize * 1.16,
      };
    };

    /* ---- Calidad adaptativa: si el equipo no llega a ~44fps de forma
       sostenida se baja el DPR del canvas y luego la densidad de estrellas.
       En equipos potentes no cambia nada; en débiles mantiene fluidez ---- */
    let qualityStage = 0;
    let lowFpsSince: number | null = null;
    let dprCap = 1.5;
    let starDensity = 1;

    let dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const seed = () => {
      const count = Math.round(((width * height) / 5200) * starDensity);
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

    const discardStudioEffects = () => {
      if (charge?.layer === 'studio') clearCharge();
      if (sketch?.layer === 'studio') clearSketch();
      comets = comets.filter((item) => item.layer !== 'studio');
      waves = waves.filter((item) => item.layer !== 'studio');
      bubbles = bubbles.filter((item) => item.layer !== 'studio');
      flashes = flashes.filter((item) => item.layer !== 'studio');
      sparkles = sparkles.filter((item) => item.layer !== 'studio');
      trail.length = 0;
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
      pgLetterRects = Array.from(document.querySelectorAll('.mo-pg-letter'), (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      }).filter((r) => r.w > 2 && r.h > 2);
      textRects = Array.from(visibleTextTargets, (element) => {
        const r = element.getBoundingClientRect();
        return { element, x: r.left, y: r.top, w: r.width, h: r.height };
      }).filter(
        (r) =>
          r.element.isConnected &&
          r.element.getClientRects().length > 0 &&
          r.w > 2 &&
          r.h > 2 &&
          r.y + r.h >= -160 &&
          r.y <= height + 160,
      );
      const panel = document.querySelector<HTMLElement>('.mo-studio-panel');
      if (panel) {
        const r = panel.getBoundingClientRect();
        studioRect = { x: r.left, y: r.top, w: r.width, h: r.height };
      } else {
        if (studioRect) discardStudioEffects();
        studioRect = null;
      }
    };

    const pointInImage = (x: number, y: number) => {
      if (playgroundSceneRef.current !== 'museum') return false;
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
      dpr = Math.min(window.devicePixelRatio || 1, dprCap);
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

    const onMove = (event: PointerEvent) => {
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
        curve:
          options?.curve ??
          (big ? 0.02 + Math.random() * 0.03 : (Math.random() - 0.35) * 0.05),
        power: options?.power,
        launchPower: options?.power,
        tintRGB: options?.tintRGB,
        seed: options?.power === undefined ? undefined : Math.random(),
        spin: options?.power === undefined ? undefined : (Math.random() - 0.5) * 0.05,
        spinAngle: 0,
        heat: options?.power === undefined ? undefined : 0,
        layer: options?.layer ?? 'museum',
        hitLetterIndices: options?.power === undefined ? undefined : new Set<number>(),
        hitPgLetterIndices: options?.power === undefined ? undefined : new Set<number>(),
        hitSketchSegments: options?.power === undefined ? undefined : new Set<string>(),
        hitTextElements: options?.power === undefined ? undefined : new Set<HTMLElement>(),
        hitPlaygroundLetterIds: options?.power === undefined ? undefined : new Set<number>(),
        bounceCount: options?.power === undefined ? undefined : 0,
        lateralBounces: options?.power === undefined ? undefined : 0,
        damageSpent: options?.power === undefined ? undefined : 0,
        projectileKind:
          options?.projectileKind ?? (options?.power === undefined ? undefined : 'charged'),
      });
    };

    const spawnSparkleBurst = (
      x: number,
      y: number,
      count: number,
      power: number,
      layer: EffectLayer = 'museum',
      rgb?: RGB,
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
          rgb,
          layer,
        });
      }
      if (sparkles.length > 160) sparkles.splice(0, sparkles.length - 160);
    };

    const effectContext = (layer: EffectLayer | undefined) =>
      layer === 'studio' ? (trailCtx ?? fxCtx) : fxCtx;

    const effectOpacity = (layer: EffectLayer | undefined) =>
      layer === 'studio' ? Math.max(dimLevel, 0.9) : dimLevel;

    const spawnWallImpact = (
      comet: Comet,
      x: number,
      y: number,
      inwardX: number,
      inwardY: number,
    ) => {
      const layer = comet.layer ?? 'museum';
      const intensity = Math.max(0.15, comet.launchPower ?? comet.power ?? 1);
      flashes.push({ x, y, r: 5 + intensity * 5, alpha: 0.35 + intensity * 0.4, layer });
      bubbles.push({
        x,
        y,
        r: 10 + intensity * 4,
        alpha: 0.25 + intensity * 0.3,
        age: 0,
        tintT: Math.random() * 0.65,
        layer,
      });
      const tangentX = -inwardY;
      const tangentY = inwardX;
      const burstN = Math.round(10 + intensity * 16 + comet.size * 5);
      for (let s = 0; s < burstN; s += 1) {
        const inwardSpeed = (1.5 + Math.random() * 4.5) * vscale;
        const tangentSpeed = (Math.random() - 0.5) * (4 + Math.random() * 4) * vscale;
        sparkles.push({
          x: x + tangentX * (Math.random() - 0.5) * 14,
          y: y + tangentY * (Math.random() - 0.5) * 14,
          vx: inwardX * inwardSpeed + tangentX * tangentSpeed,
          vy: inwardY * inwardSpeed + tangentY * tangentSpeed,
          life: 1,
          tint: Math.random() < 0.5 ? 1 : 0,
          size: 1.2 + Math.random() * 1.8,
          grav: 0.03,
          rgb: comet.tintRGB,
          layer,
        });
      }
      if (sparkles.length > 160) sparkles.splice(0, sparkles.length - 160);
      comet.x = x;
      comet.y = y;
      comet.life = 0;
    };

    const registerCometBounce = (comet: Comet, x: number, y: number) => {
      comet.bounceCount = Math.min(5, (comet.bounceCount ?? 0) + 1);
      comet.heat = Math.min(1, (comet.heat ?? 0) + 0.22);
      const multiplier = playgroundBounceMultiplier(comet.bounceCount);
      const visualPower = Math.min(1, (comet.launchPower ?? comet.power ?? 0) + comet.bounceCount * 0.12);
      comet.power = visualPower;
      comet.tintRGB =
        playgroundRef.current && comet.projectileKind === 'charged'
          ? mixRGB(PLAYGROUND_CHARGED_TINT, [255, 246, 228], 0.08 + comet.bounceCount * 0.08)
          : sampleStops(AURORA, Math.min(0.92, 0.28 + comet.bounceCount * 0.13));
      comet.tailAge = 0;
      comboLabels.push({ x, y, multiplier, life: 1 });
      if (comboLabels.length > 12) comboLabels.splice(0, comboLabels.length - 12);
    };

    /* Mascota del pulso: orbita el cometa en un anillo que precesa, se ancla
       donde esté al empezar a disparar y regresa volando al soltar. */
    const resetPulsarPet = () => {
      pulsarPhase = 'orbit';
      pulsarOrbitReady = false;
    };
    const pulsarOrbitPoint = () => {
      const rx = PULSAR_ORBIT_RX * vscale;
      const ry = PULSAR_ORBIT_RY * vscale;
      const localX = rx * Math.cos(pulsarAngle);
      const localY = ry * Math.sin(pulsarAngle);
      const cosR = Math.cos(pulsarRingAngle);
      const sinR = Math.sin(pulsarRingAngle);
      return {
        x: pulsarOrbitX + localX * cosR - localY * sinR,
        y: pulsarOrbitY + localX * sinR + localY * cosR,
      };
    };
    const pulsarPos = () => {
      if (pulsarPhase === 'firing') return { x: pulsarAnchorX, y: pulsarAnchorY };
      const orbitPoint = pulsarOrbitPoint();
      if (pulsarPhase === 'orbit') return orbitPoint;
      const progress = Math.min(
        1,
        Math.max(0, (time - pulsarReturnStart) / Math.max(0.001, pulsarReturnDuration)),
      );
      const eased = 1 - (1 - progress) * (1 - progress);
      return {
        x: pulsarAnchorX + (orbitPoint.x - pulsarAnchorX) * eased,
        y: pulsarAnchorY + (orbitPoint.y - pulsarAnchorY) * eased,
      };
    };
    const pulsarScale = () => {
      if (pulsarPhase === 'orbit') return 0.5;
      if (pulsarPhase === 'firing') {
        return Math.min(1, 0.5 + 0.5 * ((time - pulsarPhaseAt) / 0.15));
      }
      const progress = Math.min(
        1,
        Math.max(0, (time - pulsarReturnStart) / Math.max(0.001, pulsarReturnDuration)),
      );
      return 1 - 0.55 * smoothstep(progress);
    };

    const spawnRapidProjectile = () => {
      if (pulsarPhase !== 'firing' || !rapidFireHeld) return false;
      const originX = pulsarAnchorX;
      const originY = pulsarAnchorY;
      const aimX = mouse.x - originX;
      const aimY = mouse.y - originY;
      const aimDistance = Math.hypot(aimX, aimY);
      if (aimDistance < 16 || mouse.x < -999 || mouse.y < -999) return false;

      const directionX = aimX / aimDistance;
      const directionY = aimY / aimDistance;
      spawnComet({
        x: originX + directionX * 13,
        y: originY + directionY * 13,
        vx: directionX * 20,
        vy: directionY * 20,
        sizeMul: 0.42,
        power: PLAYGROUND_RAPID_DAMAGE / PLAYGROUND_BASE_DAMAGE,
        tintRGB: PLAYGROUND_RAPID_TINT,
        layer: 'museum',
        curve: 0,
        projectileKind: 'rapid',
      });
      return true;
    };

    const chargeSketchSegment = (segmentIndex: number, x: number, y: number) => {
      const activeSketch = sketch;
      if (
        !activeSketch ||
        activeSketch.layer !== 'museum' ||
        activeSketch.chargedSegments.has(segmentIndex)
      ) {
        return;
      }

      const nextCharge = Math.min(
        PLAYGROUND_SEGMENT_CHARGE_HITS,
        (activeSketch.segmentCharges[segmentIndex] ?? 0) + 1,
      );
      activeSketch.segmentCharges[segmentIndex] = nextCharge;
      flashes.push({
        x,
        y,
        r: 3 + nextCharge * 0.7,
        alpha: 0.28 + nextCharge * 0.08,
        rgb: PLAYGROUND_RAPID_TINT,
        layer: 'museum',
      });
      spawnSparkleBurst(
        x,
        y,
        3 + Math.ceil(nextCharge * 0.6),
        nextCharge / PLAYGROUND_SEGMENT_CHARGE_HITS,
        'museum',
        PLAYGROUND_RAPID_TINT,
      );

      if (nextCharge < PLAYGROUND_SEGMENT_CHARGE_HITS) return;

      activeSketch.chargedSegments.add(segmentIndex);
      activeSketch.segmentTriggeredAt[segmentIndex] = time;
      waves.push({
        x,
        y,
        r: 7,
        alpha: 0.88,
        grow: 3.2,
        decay: 0.9,
        width: 1.4,
        rgb: PLAYGROUND_RAPID_TINT,
        delay: 0,
        layer: 'museum',
      });
    };

    const affinityTint = (affinity: PlaygroundWeaponAffinity) =>
      affinity === 'rapid' ? PLAYGROUND_RAPID_TINT : PLAYGROUND_CHARGED_TINT;

    const spawnPlaygroundShieldImpact = (target: PlaygroundLetter, x: number, y: number) => {
      const rgb = affinityTint(target.affinity);
      flashes.push({ x, y, r: 7, alpha: 0.82, rgb, layer: 'museum' });
      waves.push({
        x,
        y,
        r: playgroundFontSize() * 0.24,
        alpha: 0.92,
        grow: 2.4,
        decay: 0.88,
        width: 1.8,
        rgb,
        delay: 0,
        layer: 'museum',
      });
      spawnSparkleBurst(x, y, 10, 0.55, 'museum', rgb);
    };

    const applyChargedSegmentContacts = (
      target: PlaygroundLetter,
      previousCenter: { x: number; y: number },
      currentCenter: { x: number; y: number },
      fontSize: number,
    ) => {
      const activeSketch = sketch;
      if (
        !activeSketch ||
        activeSketch.layer !== 'museum' ||
        activeSketch.chargedSegments.size === 0 ||
        time - activeSketch.lastAdd >= 6
      ) {
        return;
      }

      const collisionRadius = Math.max(24, fontSize * 0.5);
      for (const segmentIndex of activeSketch.chargedSegments) {
        const a = activeSketch.nodes[segmentIndex];
        const b = activeSketch.nodes[segmentIndex + 1];
        if (!a || !b) continue;

        const contacts =
          activeSketch.segmentContacts[segmentIndex] ??
          (activeSketch.segmentContacts[segmentIndex] = new Set<number>());
        const wasTouching = contacts.has(target.id);
        const finalDistance = closestPointOnSegment(currentCenter.x, currentCenter.y, a.x, a.y, b.x, b.y);
        const isTouching = finalDistance.dist2 <= collisionRadius * collisionRadius;
        const crossing = sweptSegmentHit(
          previousCenter.x,
          previousCenter.y,
          currentCenter.x,
          currentCenter.y,
          a.x,
          a.y,
          b.x,
          b.y,
          collisionRadius,
        );

        if (!wasTouching && crossing) {
          const wasAlreadySlowed = target.slowedUntil > time;
          target.slowedUntil = Math.max(target.slowedUntil, time + PLAYGROUND_SLOW_DURATION);
          if (!wasAlreadySlowed) {
            target.roamVX *= PLAYGROUND_SLOW_FACTOR;
            target.roamVY *= PLAYGROUND_SLOW_FACTOR;
            target.vx *= PLAYGROUND_SLOW_FACTOR;
            target.vy *= PLAYGROUND_SLOW_FACTOR;
          }
          activeSketch.segmentTriggeredAt[segmentIndex] = time;
          flashes.push({
            x: crossing.x,
            y: crossing.y,
            r: 6,
            alpha: 0.72,
            rgb: PLAYGROUND_RAPID_TINT,
            layer: 'museum',
          });
          waves.push({
            x: crossing.x,
            y: crossing.y,
            r: 8,
            alpha: 0.86,
            grow: 3.6,
            decay: 0.9,
            width: 1.5,
            rgb: PLAYGROUND_RAPID_TINT,
            delay: 0,
            layer: 'museum',
          });
          spawnSparkleBurst(crossing.x, crossing.y, 8, 0.5, 'museum', PLAYGROUND_RAPID_TINT);
        }

        if (isTouching) contacts.add(target.id);
        else contacts.delete(target.id);
      }
    };

    const studioExit = (x0: number, y0: number, x1: number, y1: number, rect: ViewRect) => {
      if (!pointInRect(x0, y0, rect) || pointInRect(x1, y1, rect)) return null;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const candidates: { t: number; x: number; y: number; nx: number; ny: number }[] = [];
      const addVertical = (edgeX: number, nx: number) => {
        if (Math.abs(dx) < 1e-8) return;
        const t = (edgeX - x0) / dx;
        const y = y0 + dy * t;
        if (t >= 0 && t <= 1 && y >= rect.y && y <= rect.y + rect.h) {
          candidates.push({ t, x: edgeX, y, nx, ny: 0 });
        }
      };
      const addHorizontal = (edgeY: number, ny: number) => {
        if (Math.abs(dy) < 1e-8) return;
        const t = (edgeY - y0) / dy;
        const x = x0 + dx * t;
        if (t >= 0 && t <= 1 && x >= rect.x && x <= rect.x + rect.w) {
          candidates.push({ t, x, y: edgeY, nx: 0, ny });
        }
      };
      addVertical(rect.x, 1);
      addVertical(rect.x + rect.w, -1);
      addHorizontal(rect.y, 1);
      addHorizontal(rect.y + rect.h, -1);
      return candidates.sort((a, b) => a.t - b.t)[0] ?? null;
    };

    /* ---- Lluvia dirigida por WASD ---- */

    const heldDirs = new Set<'up' | 'down' | 'left' | 'right'>();
    const heldMovementCodes = new Set<string>();
    const boostedWasdCodes = new Set<string>();
    const lastWasdDown = new Map<string, number>();
    let boostLatched = false;
    let shiftHeld = false;
    let wasPlayground = playgroundRef.current;
    let wasPlaygroundScene = playgroundSceneRef.current !== 'museum';
    const isKeyboardInput = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.isContentEditable ||
        target.matches('input, textarea, select, [role="textbox"], [contenteditable="true"]')
      );
    };
    const isInteractiveControl = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      Boolean(
        target.closest(
          'button, a, input, textarea, select, [role="button"], [role="textbox"], [contenteditable="true"]',
        ),
      );

    /* ---- Constelación dibujable ---- */

    const nearestStarPos = (x: number, y: number, maxDist: number) => {
      let bestX = x;
      let bestY = y;
      let bestD = maxDist;
      // Misma proyección toroidal del bucle de dibujo: buscar sobre lo que se ve
      const spanW = width + 160;
      const spanH = height + 160;
      for (const star of stars) {
        const sx = wrapSpan(star.x - camX, spanW) - 80;
        const sy = wrapSpan(star.y - camY, spanH) - 80;
        const d = Math.hypot(sx - x, sy - y);
        if (d < bestD) {
          bestD = d;
          bestX = sx;
          bestY = sy;
        }
      }
      return { x: bestX, y: bestY };
    };

    const addSketchNode = (x: number, y: number, layer: EffectLayer) => {
      if (!sketch || sketch.layer !== layer || time - sketch.lastAdd > 6) {
        clearSketch();
        sketch = {
          id: nextSketchId,
          nodes: [],
          lastAdd: time,
          layer,
          segmentCharges: [],
          chargedSegments: new Set<number>(),
          segmentContacts: [],
          segmentTriggeredAt: [],
        };
        nextSketchId += 1;
      }
      if (sketch.nodes.length >= 16) return;
      if (sketch.nodes.length > 0) {
        sketch.segmentCharges.push(0);
        sketch.segmentContacts.push(new Set<number>());
        sketch.segmentTriggeredAt.push(Number.NEGATIVE_INFINITY);
      }
      sketch.nodes.push(nearestStarPos(x, y, 30));
      sketch.lastAdd = time;
    };

    /* ---- Interacción ---- */

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (
        scriptedWarp ||
        playgroundSceneRef.current === 'arriving' ||
        playgroundSceneRef.current === 'departing'
      ) {
        return;
      }
      if (playgroundRef.current && playgroundPhase !== 'active') return;
      const target = event.target as HTMLElement | null;
      const interactive = Boolean(target?.closest('button, a, input, textarea, select, [contenteditable="true"]'));
      if (sandboxActive) {
        // En el lab las armas funcionan: supernova y cometa con clic cargado.
        if (SANDBOX_CLASSIC_EXPERIMENTS) labScatterSwarm(event.clientX, event.clientY);
        if (event.shiftKey || interactive) return;
        if (event.pointerType !== 'touch') event.preventDefault();
        window.getSelection()?.removeAllRanges();
        setCatapultDragging(true);
        charge = { x: event.clientX, y: event.clientY, t0: time, dx: event.clientX, dy: event.clientY, layer: 'museum' };
        return;
      }
      const x = event.clientX;
      const y = event.clientY;
      const studio = target?.closest('.mo-studio');
      const studioPanel = target?.closest('.mo-studio-panel');

      // El fondo exterior cierra el estudio desde React y nunca inicia una carga.
      if (studio && !studioPanel) return;
      // El estudio no tiene cielo estrellado: allí no se dibujan constelaciones.
      if (studioPanel && !interactive && event.shiftKey) return;
      const layer: EffectLayer = studioPanel ? 'studio' : 'museum';

      if (!interactive && event.shiftKey) {
        addSketchNode(x, y, layer);
        return;
      }

      // Clic cargado tipo resortera: mantener presionado y arrastrar en
      // cualquier sala del museo (los controles interactivos quedan fuera)
      if (!interactive) {
        // Mouse y lápiz no deben iniciar la selección nativa mientras se
        // apunta. En touch conservamos el gesto de scroll del navegador.
        if (event.pointerType !== 'touch') event.preventDefault();
        window.getSelection()?.removeAllRanges();
        setCatapultDragging(true);
        // Evita que el arrastre nativo de una imagen cancele los pointermove
        // necesarios para apuntar la catapulta dentro de la sala.
        const image = target?.closest('img');
        if (image) image.setAttribute('draggable', 'false');
        charge = { x, y, t0: time, dx: x, dy: y, layer };
      }
    };

    /* La onda de choque sin proyectil también empuja el texto cercano:
       cada bloque recibe el golpe cuando el frente de la burbuja le llega,
       con fuerza y giro proporcionales a la carga y a la distancia. */
    const TEXT_WAVE_SPEED = 600;
    const pushTextWithShockwave = (cx: number, cy: number, power: number) => {
      if (playgroundRef.current) return;
      if (letterRects.length === 0 && pgLetterRects.length === 0 && textRects.length === 0) return;
      const radius = 120 + 240 * Math.max(0, Math.min(1, power));

      // En el hero, cada letra del título recibe su propio golpe radial:
      // dirección desde la explosión, retardo según distancia y potencia
      // decreciente, para que la onda las barra de forma orgánica. El evento
      // más cercano arrastra también el empujón de kicker/subtítulo/hints.
      if (letterRects.length > 0) {
        const affected: {
          index: number;
          x: number;
          y: number;
          distance: number;
          dirX: number;
          dirY: number;
        }[] = [];
        letterRects.forEach((rect, index) => {
          const nearestX = Math.max(rect.x, Math.min(rect.x + rect.w, cx));
          const nearestY = Math.max(rect.y, Math.min(rect.y + rect.h, cy));
          const dx = nearestX - cx;
          const dy = nearestY - cy;
          let distance = Math.hypot(dx, dy);
          let dirX: number;
          let dirY: number;
          if (distance > 0.5) {
            dirX = dx / distance;
            dirY = dy / distance;
          } else {
            const awayX = rect.x + rect.w / 2 - cx;
            const awayY = rect.y + rect.h / 2 - cy;
            distance = Math.hypot(awayX, awayY);
            if (distance > 0.5) {
              dirX = awayX / distance;
              dirY = awayY / distance;
            } else {
              dirX = Math.cos((index / Math.max(1, letterRects.length)) * Math.PI * 2);
              dirY = Math.sin((index / Math.max(1, letterRects.length)) * Math.PI * 2);
              distance = 0;
            }
          }
          if (distance > radius) return;
          affected.push({ index, x: nearestX, y: nearestY, distance, dirX, dirY });
        });
        affected.sort((a, b) => a.distance - b.distance);
        affected.forEach((letter, position) => {
          const falloff = 1 - letter.distance / radius;
          window.setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('mo-title-hit', {
                detail: {
                  hits: [{ index: letter.index, x: letter.x, y: letter.y }],
                  vx: letter.dirX * (10 + 8 * falloff),
                  vy: letter.dirY * (10 + 8 * falloff),
                  power: Math.max(0.15, power * falloff),
                  extras: position === 0,
                },
              }),
            );
          }, (letter.distance / TEXT_WAVE_SPEED) * 1000 * (0.92 + Math.random() * 0.16));
        });
      }

      // La palabra PLAYGROUND del hero recibe la onda con la misma
      // coreografía radial por letra.
      if (pgLetterRects.length > 0) {
        const pgAffected: {
          index: number;
          x: number;
          y: number;
          distance: number;
          dirX: number;
          dirY: number;
        }[] = [];
        pgLetterRects.forEach((rect, index) => {
          const nearestX = Math.max(rect.x, Math.min(rect.x + rect.w, cx));
          const nearestY = Math.max(rect.y, Math.min(rect.y + rect.h, cy));
          const dx = nearestX - cx;
          const dy = nearestY - cy;
          let distance = Math.hypot(dx, dy);
          let dirX: number;
          let dirY: number;
          if (distance > 0.5) {
            dirX = dx / distance;
            dirY = dy / distance;
          } else {
            const awayX = rect.x + rect.w / 2 - cx;
            const awayY = rect.y + rect.h / 2 - cy;
            distance = Math.hypot(awayX, awayY);
            if (distance > 0.5) {
              dirX = awayX / distance;
              dirY = awayY / distance;
            } else {
              dirX = Math.cos((index / Math.max(1, pgLetterRects.length)) * Math.PI * 2);
              dirY = Math.sin((index / Math.max(1, pgLetterRects.length)) * Math.PI * 2);
              distance = 0;
            }
          }
          if (distance > radius) return;
          pgAffected.push({ index, x: nearestX, y: nearestY, distance, dirX, dirY });
        });
        pgAffected.sort((a, b) => a.distance - b.distance);
        pgAffected.forEach((letter) => {
          const falloff = 1 - letter.distance / radius;
          window.setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('mo-pg-hit', {
                detail: {
                  hits: [{ index: letter.index, x: letter.x, y: letter.y }],
                  vx: letter.dirX * (10 + 8 * falloff),
                  vy: letter.dirY * (10 + 8 * falloff),
                  power: Math.max(0.15, power * falloff),
                },
              }),
            );
          }, (letter.distance / TEXT_WAVE_SPEED) * 1000 * (0.92 + Math.random() * 0.16));
        });
      }

      textRects.forEach((rect) => {
        const nearestX = Math.max(rect.x, Math.min(rect.x + rect.w, cx));
        const nearestY = Math.max(rect.y, Math.min(rect.y + rect.h, cy));
        const dx = nearestX - cx;
        const dy = nearestY - cy;
        let distance = Math.hypot(dx, dy);
        let dirX: number;
        let dirY: number;
        if (distance > 0.5) {
          dirX = dx / distance;
          dirY = dy / distance;
        } else {
          // El centro de la explosión quedó dentro del bloque: empujar desde
          // el centro del bloque hacia afuera.
          const awayX = rect.x + rect.w / 2 - cx;
          const awayY = rect.y + rect.h / 2 - cy;
          distance = Math.hypot(awayX, awayY);
          if (distance > 0.5) {
            dirX = awayX / distance;
            dirY = awayY / distance;
          } else {
            dirX = Math.cos(Math.random() * Math.PI * 2);
            dirY = Math.sin(Math.random() * Math.PI * 2);
            distance = 0;
          }
        }
        if (distance > radius) return;
        const falloff = 1 - distance / radius;
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('mo-page-text-hit', {
              detail: {
                element: rect.element,
                x: nearestX,
                y: nearestY,
                vx: dirX * 14,
                vy: dirY * 14,
                power: Math.max(0.15, power * falloff),
              },
            }),
          );
        }, (distance / TEXT_WAVE_SPEED) * 1000);
      });
    };

    /* Conducción: una supernova cerca de la constelación inyecta energía;
       un pulso dorado recorre los nodos empujando suavemente el texto
       cercano y, al terminar el recorrido, la red queda armada. */
    const CONDUCTION_SPEED = 900;
    const chargeConstellation = (cx: number, cy: number, power: number, blastLayer: EffectLayer) => {
      const activeSketch = sketch;
      if (
        !activeSketch ||
        activeSketch.layer !== blastLayer ||
        blastLayer === 'studio' ||
        playgroundRef.current ||
        activeSketch.nodes.length < 2
      ) {
        return;
      }
      // Solo una supernova a plena carga conduce y arma la red
      if (power < 0.95) return;
      const waveRadius = 120 + 240 * Math.max(0, Math.min(1, power));
      let nearestDistance = Infinity;
      for (let i = 1; i < activeSketch.nodes.length; i += 1) {
        const a = activeSketch.nodes[i - 1];
        const b = activeSketch.nodes[i];
        const segX = b.x - a.x;
        const segY = b.y - a.y;
        const lenSq = segX * segX + segY * segY || 1;
        const u = Math.max(0, Math.min(1, ((cx - a.x) * segX + (cy - a.y) * segY) / lenSq));
        nearestDistance = Math.min(
          nearestDistance,
          Math.hypot(cx - (a.x + segX * u), cy - (a.y + segY * u)),
        );
      }
      if (nearestDistance > waveRadius * 0.85) return;

      let elapsed = 0;
      for (let i = 1; i < activeSketch.nodes.length; i += 1) {
        const a = activeSketch.nodes[i - 1];
        const b = activeSketch.nodes[i];
        const hopDuration = Math.max(
          0.09,
          Math.hypot(b.x - a.x, b.y - a.y) / (CONDUCTION_SPEED * vscale),
        );
        conductions.push({
          x: a.x,
          y: a.y,
          vx: (b.x - a.x) / hopDuration,
          vy: (b.y - a.y) / hopDuration,
          life: hopDuration,
          maxLife: hopDuration,
          layer: blastLayer,
        });
        elapsed += hopDuration;
        const nodeX = b.x;
        const nodeY = b.y;
        window.setTimeout(() => {
          if (sketch !== activeSketch) return;
          waves.push({
            x: nodeX,
            y: nodeY,
            r: 6,
            alpha: 0.5,
            grow: 2.6,
            decay: 0.94,
            width: 1.2,
            delay: 0,
            layer: blastLayer,
          });
          textRects.forEach((rect) => {
            const rectCx = rect.x + rect.w / 2;
            const rectCy = rect.y + rect.h / 2;
            const dx = rectCx - nodeX;
            const dy = rectCy - nodeY;
            const distance = Math.hypot(dx, dy);
            if (distance > 150) return;
            const safeDistance = distance || 1;
            window.dispatchEvent(
              new CustomEvent('mo-page-text-hit', {
                detail: {
                  element: rect.element,
                  x: nodeX,
                  y: nodeY,
                  vx: (dx / safeDistance) * 9,
                  vy: (dy / safeDistance) * 9,
                  power: 0.3 * (1 - distance / 150),
                },
              }),
            );
          });
        }, elapsed * 1000);
      }

      const endNode = activeSketch.nodes[activeSketch.nodes.length - 1];
      if (!activeSketch.armed) {
        window.setTimeout(() => {
          if (sketch !== activeSketch || activeSketch.armed) return;
          activeSketch.armed = time;
          flashes.push({
            x: endNode.x,
            y: endNode.y,
            r: 6,
            alpha: 0.7,
            rgb: [228, 199, 127],
            layer: blastLayer,
          });
        }, elapsed * 1000);
      }
    };

    /* Detonación: un cometa a plena carga sobre una constelación armada
       provoca una implosión estelar — la red entera pulsa y su energía
       converge desde ambos extremos hacia el punto de contacto, donde
       estalla un racimo compacto de chispas doradas. Sin burbujas ni
       anillos expansivos: todo queda contenido en la constelación. */
    const detonateConstellation = (x: number, y: number, segmentIndex: number, layer: EffectLayer) => {
      const activeSketch = sketch;
      if (!activeSketch || !activeSketch.armed) return;
      activeSketch.armed = undefined;

      // Descarga total: todos los segmentos pulsan con el sistema de trigger
      for (let i = 0; i < activeSketch.nodes.length - 1; i += 1) {
        activeSketch.segmentTriggeredAt[i] = time;
      }

      // Implosión: pulsos desde ambos extremos convergiendo al contacto
      const contact = Math.max(0, Math.min(activeSketch.nodes.length - 2, segmentIndex));
      const emitSide = (from: number, to: number, step: number) => {
        let sideElapsed = 0;
        for (let i = from; step > 0 ? i < to : i > to; i += step) {
          const ax = activeSketch.nodes[step > 0 ? i : i - 1].x;
          const ay = activeSketch.nodes[step > 0 ? i : i - 1].y;
          const bx = activeSketch.nodes[step > 0 ? i - 1 : i].x;
          const by = activeSketch.nodes[step > 0 ? i - 1 : i].y;
          const hopDuration = Math.max(
            0.09,
            Math.hypot(bx - ax, by - ay) / (CONDUCTION_SPEED * vscale),
          );
          sideElapsed += hopDuration;
          conductions.push({
            x: ax,
            y: ay,
            vx: (bx - ax) / hopDuration,
            vy: (by - ay) / hopDuration,
            life: hopDuration,
            maxLife: hopDuration,
            layer,
          });
          const nodeX = bx;
          const nodeY = by;
          window.setTimeout(() => {
            if (sketch !== activeSketch) return;
            waves.push({
              x: nodeX,
              y: nodeY,
              r: 4,
              alpha: 0.4,
              grow: 2,
              width: 1,
              delay: 0,
              rgb: [228, 199, 127],
              layer,
            });
          }, sideElapsed * 1000);
        }
        return sideElapsed;
      };
      const leftElapsed = emitSide(contact, 0, -1);
      const rightElapsed = emitSide(contact + 1, activeSketch.nodes.length, 1);
      const implodeDuration = Math.max(leftElapsed, rightElapsed);

      // Estallido al converger toda la energía: el contacto destella como
      // foco y CADA vértice de la constelación revienta con su propio color
      // de la paleta, con un micro-retardo aleatorio para que sea orgánico.
      window.setTimeout(() => {
        if (sketch !== activeSketch) return;
        flashes.push({ x, y, r: 8, alpha: 0.9, rgb: [228, 199, 127], layer });
        spawnSparkleBurst(x, y, 22, 0.35, layer, [228, 199, 127]);
        activeSketch.nodes.forEach((node, index) => {
          const nodeColor = VIVID_TINTS[index % VIVID_TINTS.length];
          window.setTimeout(() => {
            if (sketch !== activeSketch) return;
            flashes.push({ x: node.x, y: node.y, r: 4, alpha: 0.55, rgb: nodeColor, layer });
            spawnSparkleBurst(node.x, node.y, 7, 0.3, layer, nodeColor);
          }, Math.random() * 90);
        });
        pushTextWithShockwave(x, y, 1);
      }, implodeDuration * 1000);
    };

    const releaseCharge = () => {
      if (!charge) {
        clearCharge();
        return;
      }
      const power = Math.min(1, (time - charge.t0) / 1.1);
      const x = charge.x;
      const y = charge.y;
      const layer = charge.layer;

      // Vector de resortera: tirar hacia atrás lanza hacia adelante
      const px = x - charge.dx;
      const py = y - charge.dy;
      const pull = Math.hypot(px, py);

      clearCharge();
      if (power < 0.06) return;

      // Explosión residual en el punto de origen: destello y chispas; la
      // burbuja de choque queda reservada para el release sin apuntar y para
      // los impactos del proyectil
      flashes.push({ x, y, r: 4, alpha: 0.2 + 0.3 * power, layer });
      spawnSparkleBurst(x, y, Math.round(8 + 14 * power), power * 0.7, layer);

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
          layer,
        });
        spawnSparkleBurst(x, y, Math.round(10 + 20 * power), power, layer);
        pushTextWithShockwave(x, y, power);
        chargeConstellation(x, y, power, layer);
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
        tintRGB: playgroundRef.current
          ? PLAYGROUND_CHARGED_TINT
          : EMBER_METEORITE_DESIGN
            ? EMBER_SALTS[Math.floor(Math.random() * EMBER_SALTS.length)]
            : VIVID_TINTS[Math.floor(Math.random() * VIVID_TINTS.length)],
        layer,
      });
    };

    const onUp = () => {
      releaseCharge();
    };

    const onWarp = (event: Event) => {
      const detail = (event as CustomEvent<WarpDetail>).detail;
      const strength = Number.isFinite(detail?.strength) ? Math.max(0, detail.strength ?? 22) : 22;
      warpBoost = Math.min(detail?.strength === undefined ? 34 : 40, warpBoost + strength);
      if (detail?.direction === -1 || detail?.direction === 1) warpDirection = detail.direction;
      clearCharge();

      if (Number.isFinite(detail?.durationMs) && (detail?.durationMs ?? 0) > 0) {
        scriptedWarp = {
          startedAt: performance.now(),
          durationMs: Math.min(5_000, Math.max(100, detail?.durationMs ?? 1_500)),
          peakVelocity: Math.min(3_000, Math.max(0, detail?.travelSpeed ?? 900)),
          direction: detail?.direction === -1 ? -1 : 1,
        };
        clearSketch();
        rapidFireHeld = false;
        resetPulsarPet();
        comets = [];
        waves = [];
        bubbles = [];
        flashes = [];
        sparkles = [];
        conductions = [];
        comboLabels = [];
        trail.length = 0;
        heldDirs.clear();
        heldMovementCodes.clear();
        boostedWasdCodes.clear();
        lastWasdDown.clear();
        boostLatched = false;
        shiftHeld = false;
      }
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
        // El hueco sin frames no debe contar como fps bajo ni como dt gigante
        lastFrameNow = 0;
        lowFpsSince = null;
        raf = requestAnimationFrame(frame);
      } else {
        rapidFireHeld = false;
        cancelAnimationFrame(raf);
      }
    };

    /* ==== SANDBOX LAB: spawns, física y render del laboratorio ==== */
    const clearLab = () => {
      labHoles.length = 0;
      labWells.length = 0;
      labDummies.length = 0;
      labSwarm.length = 0;
      labEmitters.length = 0;
      labRings.length = 0;
      labBinaries.length = 0;
      labWormholes.length = 0;
      comets = comets.filter((comet) => !comet.labMirror);
      sandboxTimeScale = 1;
    };
    const enterSandbox = () => {
      sandboxActive = true;
      comets = [];
      waves = [];
      bubbles = [];
      flashes = [];
      sparkles = [];
      trail.length = 0;
      clearCharge();
      clearSketch();
      flashes.push({ x: width / 2, y: height / 2, r: 20, alpha: 0.8, rgb: [143, 208, 255], layer: 'museum' });
      waves.push({
        x: width / 2,
        y: height / 2,
        r: 30,
        alpha: 0.9,
        grow: 14,
        width: 2.2,
        delay: 0,
        rgb: [143, 208, 255],
        layer: 'museum',
      });
    };
    const exitSandbox = () => {
      sandboxActive = false;
      clearLab();
      heldDirs.clear();
      heldMovementCodes.clear();
      boostedWasdCodes.clear();
      camVX = 0;
      camVY = 0;
      rapidFireHeld = false;
      resetPulsarPet();
    };
    const labSpawnHole = () => {
      labHoles.push({ x: mouse.x, y: mouse.y, born: time });
      if (labHoles.length > 3) labHoles.shift();
    };
    const labSpawnSwarm = () => {
      for (let i = 0; i < 26; i += 1) {
        const ang = Math.random() * Math.PI * 2;
        labSwarm.push({
          x: mouse.x + Math.cos(ang) * (10 + Math.random() * 60),
          y: mouse.y + Math.sin(ang) * (10 + Math.random() * 60),
          vx: 0,
          vy: 0,
          hue: Math.random(),
        });
      }
      if (labSwarm.length > 80) labSwarm.splice(0, labSwarm.length - 80);
    };
    const labSpawnIons = () => {
      labEmitters.push({
        x: mouse.x,
        y: mouse.y,
        born: time,
        angle: Math.random() * Math.PI * 2,
        nextShot: 0,
      });
      if (labEmitters.length > 2) labEmitters.shift();
    };
    const labSpawnWell = (repulsor: boolean) => {
      labWells.push({ x: mouse.x, y: mouse.y, strength: repulsor ? -1 : 1 });
      if (labWells.length > 6) labWells.shift();
    };
    const labSpawnChain = () => {
      for (let i = 0; i < 5; i += 1) {
        window.setTimeout(() => {
          if (!sandboxActive) return;
          const cx = mouse.x + (i - 2) * 150;
          const cy = mouse.y + Math.sin(i * 1.7) * 40;
          bubbles.push({
            x: cx,
            y: cy,
            r: 12,
            alpha: 0.6,
            age: 0,
            tintT: Math.random() * 0.65,
            grow: 9,
            layer: 'museum',
          });
          flashes.push({ x: cx, y: cy, r: 7, alpha: 0.7, layer: 'museum' });
          waves.push({ x: cx, y: cy, r: 10, alpha: 0.8, grow: 8, width: 2, delay: 0, layer: 'museum' });
          spawnSparkleBurst(cx, cy, 18, 0.9, 'museum');
        }, i * 160);
      }
    };
    const labSpawnMirror = () => {
      if (comets.filter((comet) => comet.labMirror).length >= 6) return;
      const ang = Math.random() * Math.PI * 2;
      comets.push({
        x: mouse.x,
        y: mouse.y,
        vx: Math.cos(ang) * 9,
        vy: Math.sin(ang) * 9,
        life: 1,
        size: 3.4,
        tint: 1,
        curve: 0,
        tintRGB: EMBER_SALTS[Math.floor(Math.random() * EMBER_SALTS.length)],
        labMirror: true,
      });
    };
    const labSpawnDummies = () => {
      labDummies.length = 0;
      for (let i = 0; i < 8; i += 1) {
        const ang = (i / 8) * Math.PI * 2;
        labDummies.push({
          x: mouse.x + Math.cos(ang) * 170,
          y: mouse.y + Math.sin(ang) * 170,
          vx: 0,
          vy: 0,
        });
      }
    };
    const labSpawnRing = () => {
      const particles: LabRing['particles'] = [];
      for (let i = 0; i < 220; i += 1) {
        const rad = 60 + Math.pow(Math.random(), 0.8) * 90;
        particles.push({
          ang: Math.random() * Math.PI * 2,
          rad,
          // Kepler: las partículas internas orbitan más rápido
          speed: 0.25 + 2.4 * Math.pow(70 / rad, 1.5),
          size: 0.7 + Math.random() * 1.6,
          tint: Math.random(),
          kick: 0,
          kickAng: 0,
        });
      }
      labRings.length = 0;
      labRings.push({ x: mouse.x, y: mouse.y, born: time, tilt: 0, particles });
    };
    const labSpawnBinary = () => {
      labBinaries.length = 0;
      labBinaries.push({
        x: mouse.x,
        y: mouse.y,
        born: time,
        phase: Math.random() * Math.PI * 2,
        nextFlare: time + 1.6,
      });
    };
    const labSpawnWormhole = () => {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.min(340, Math.hypot(width, height) * 0.22);
      labWormholes.length = 0;
      labWormholes.push({
        ax: mouse.x,
        ay: mouse.y,
        bx: Math.max(60, Math.min(width - 60, mouse.x + Math.cos(ang) * dist)),
        by: Math.max(60, Math.min(height - 60, mouse.y + Math.sin(ang) * dist)),
        born: time,
      });
    };
    const labScatterSwarm = (x: number, y: number) => {
      for (const boid of labSwarm) {
        const dx = boid.x - x;
        const dy = boid.y - y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 220) {
          const f = (1 - d / 220) * 9;
          boid.vx += (dx / d) * f;
          boid.vy += (dy / d) * f;
        }
      }
      waves.push({ x, y, r: 6, alpha: 0.5, grow: 6, width: 1.4, delay: 0, rgb: [150, 196, 255], layer: 'museum' });
    };

    const updateLab = () => {
      if (!sandboxActive) return;
      const step = dt * sandboxTimeScale;

      // Agujeros negros: atracción espiral, consumo de cometas, colapso final
      for (let i = labHoles.length - 1; i >= 0; i -= 1) {
        const hole = labHoles[i];
        const age = time - hole.born;
        if (sparkles.length < 150 && Math.random() < 0.5) {
          const ang = Math.random() * Math.PI * 2;
          const rr = 60 + Math.random() * 50;
          const flat = LAB_BLACKHOLE_V2;
          sparkles.push({
            x: hole.x + Math.cos(ang) * rr,
            y: hole.y + Math.sin(ang) * rr * (flat ? 0.3 : 1),
            vx: -Math.sin(ang) * 3.2,
            vy: Math.cos(ang) * 3.2 * (flat ? 0.3 : 1),
            life: 0.9,
            tint: 2,
            size: 1.4,
            grav: 0,
            rgb: flat ? [255, 214, 160] : [186, 214, 255],
            layer: 'museum',
          });
        }
        for (const comet of comets) {
          if (comet.labCaptured) continue;
          const dx = hole.x - comet.x;
          const dy = hole.y - comet.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d > 360) continue;
          const pull = Math.pow(1 - d / 360, 2) * 2.4;
          comet.vx += ((dx / d) * pull - (dy / d) * pull * 0.55) * sandboxTimeScale;
          comet.vy += ((dy / d) * pull + (dx / d) * pull * 0.55) * sandboxTimeScale;
          if (d < 68 && !comet.labMirror && !comet.labCaptured) {
            // Captura: el cometa entra en espiral hacia el horizonte
            comet.labCaptured = { x: hole.x, y: hole.y, t0: time };
            flashes.push({
              x: comet.x,
              y: comet.y,
              r: 3,
              alpha: 0.5,
              rgb: LAB_BLACKHOLE_V2 ? [255, 214, 160] : [186, 214, 255],
              layer: 'museum',
            });
          }
        }
        for (const dummy of labDummies) {
          const dx = hole.x - dummy.x;
          const dy = hole.y - dummy.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < 480) {
            const pull = (1 - d / 420) * 42 * step;
            dummy.vx += (dx / d) * pull;
            dummy.vy += (dy / d) * pull;
          }
        }
        for (const boid of labSwarm) {
          const dx = hole.x - boid.x;
          const dy = hole.y - boid.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < 360) {
            const pull = (1 - d / 340) * 0.24 * sandboxTimeScale;
            boid.vx += (dx / d) * pull;
            boid.vy += (dy / d) * pull;
          }
        }
        if (age > 6) {
          labHoles.splice(i, 1);
          flashes.push({ x: hole.x, y: hole.y, r: 14, alpha: 0.95, rgb: [240, 248, 255], layer: 'museum' });
          waves.push({
            x: hole.x,
            y: hole.y,
            r: 12,
            alpha: 0.9,
            grow: 16,
            width: 2.6,
            delay: 0,
            rgb: [200, 224, 255],
            layer: 'museum',
          });
          bubbles.push({
            x: hole.x,
            y: hole.y,
            r: 16,
            alpha: 0.7,
            age: 0,
            tintT: 0.9,
            grow: 14,
            layer: 'museum',
          });
          spawnSparkleBurst(hole.x, hole.y, 40, 1.2, 'museum', [200, 224, 255]);
        }
      }

      // Pozos de gravedad: curvan cometas y blancos
      for (const well of labWells) {
        for (const comet of comets) {
          const dx = well.x - comet.x;
          const dy = well.y - comet.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d > 520) continue;
          const f = well.strength * 0.1 * sandboxTimeScale * (140 / Math.max(70, d));
          comet.vx += (dx / d) * f;
          comet.vy += (dy / d) * f;
        }
        for (const dummy of labDummies) {
          const dx = well.x - dummy.x;
          const dy = well.y - dummy.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d > 520) continue;
          const f = well.strength * 34 * step * (140 / Math.max(70, d));
          dummy.vx += (dx / d) * f;
          dummy.vy += (dy / d) * f;
        }
      }

      // Enjambre: boids que persiguen el cursor
      for (const boid of labSwarm) {
        const dx = mouse.x - boid.x;
        const dy = mouse.y - boid.y;
        const d = Math.hypot(dx, dy) || 1;
        boid.vx += (dx / d) * 0.22;
        boid.vy += (dy / d) * 0.22;
        for (const other of labSwarm) {
          if (other === boid) continue;
          const sx = boid.x - other.x;
          const sy = boid.y - other.y;
          const sd = Math.hypot(sx, sy);
          if (sd > 0.01 && sd < 26) {
            boid.vx += (sx / sd) * 0.5;
            boid.vy += (sy / sd) * 0.5;
          }
        }
        for (const well of labWells) {
          const wx = well.x - boid.x;
          const wy = well.y - boid.y;
          const wd = Math.hypot(wx, wy) || 1;
          if (wd < 300) {
            const f = well.strength * 0.3 * (1 - wd / 300);
            boid.vx += (wx / wd) * f;
            boid.vy += (wy / wd) * f;
          }
        }
        boid.vx *= 0.92;
        boid.vy *= 0.92;
        const spd = Math.hypot(boid.vx, boid.vy);
        if (spd > 6) {
          boid.vx *= 6 / spd;
          boid.vy *= 6 / spd;
        }
        boid.x += boid.vx * sandboxTimeScale;
        boid.y += boid.vy * sandboxTimeScale;
      }

      // Emisor de iones: espiral doble de proyectiles
      for (let i = labEmitters.length - 1; i >= 0; i -= 1) {
        const emitter = labEmitters[i];
        emitter.angle += 0.3 * sandboxTimeScale;
        if (time >= emitter.nextShot) {
          emitter.nextShot = time + 0.07 / Math.max(0.25, sandboxTimeScale);
          for (const arm of [0, Math.PI]) {
            comets.push({
              x: emitter.x,
              y: emitter.y,
              vx: Math.cos(emitter.angle + arm) * 7.5,
              vy: Math.sin(emitter.angle + arm) * 7.5,
              life: 0.9,
              size: 1.9,
              tint: 2,
              curve: 0,
              tintRGB: [150, 196, 255],
            });
          }
        }
        if (time - emitter.born > 4) labEmitters.splice(i, 1);
      }

      // Anillo planetario: órbitas keplerianas; los cometas perturban partículas
      for (let i = labRings.length - 1; i >= 0; i -= 1) {
        const ring = labRings[i];
        const age = time - ring.born;
        for (const particle of ring.particles) {
          particle.ang += particle.speed * sandboxTimeScale;
          particle.kick *= 0.93;
          if (comets.length === 0 || comets.length > 60) continue;
          const px0 = ring.x + Math.cos(particle.ang) * particle.rad;
          const py0 = ring.y + Math.sin(particle.ang) * particle.rad * 0.38;
          for (const comet of comets) {
            const dx = px0 - comet.x;
            const dy = py0 - comet.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > 676) continue;
            const d = Math.sqrt(d2) || 1;
            particle.kick = Math.min(1.2, particle.kick + (1 - d / 26) * 0.5 * sandboxTimeScale);
            particle.kickAng = Math.atan2(dy, dx);
          }
        }
        if (age > 20) labRings.splice(i, 1);
      }

      // Estrella binaria: slingshot gravitatorio alternante + fulguraciones
      for (let i = labBinaries.length - 1; i >= 0; i -= 1) {
        const binary = labBinaries[i];
        const age = time - binary.born;
        binary.phase += 0.9 * sandboxTimeScale;
        const sep = 46;
        const ax = binary.x + Math.cos(binary.phase) * sep;
        const ay = binary.y + Math.sin(binary.phase) * sep * 0.6;
        const bx = binary.x - Math.cos(binary.phase) * sep;
        const by = binary.y - Math.sin(binary.phase) * sep * 0.6;
        for (const comet of comets) {
          for (const star of [ax, bx]) {
            const starY = star === ax ? ay : by;
            const dx = star - comet.x;
            const dy = starY - comet.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d > 260) continue;
            const pull = (1 - d / 260) * 0.9 * sandboxTimeScale;
            comet.vx += (dx / d) * pull;
            comet.vy += (dy / d) * pull;
          }
        }
        for (const dummy of labDummies) {
          for (const star of [ax, bx]) {
            const starY = star === ax ? ay : by;
            const dx = star - dummy.x;
            const dy = starY - dummy.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d > 260) continue;
            const pull = (1 - d / 260) * 52 * step;
            dummy.vx += (dx / d) * pull;
            dummy.vy += (dy / d) * pull;
          }
        }
        if (time >= binary.nextFlare) {
          binary.nextFlare = time + 2.6;
          const midX = (ax + bx) / 2;
          const midY = (ay + by) / 2;
          waves.push({
            x: midX,
            y: midY,
            r: 8,
            alpha: 0.55,
            grow: 5,
            width: 1.4,
            delay: 0,
            rgb: [255, 214, 150],
            layer: 'museum',
          });
          spawnSparkleBurst(midX, midY, 10, 0.5, 'museum', [255, 214, 150]);
        }
        if (age > 10) {
          labBinaries.splice(i, 1);
          flashes.push({ x: binary.x, y: binary.y, r: 16, alpha: 0.95, rgb: [255, 236, 200], layer: 'museum' });
          waves.push({
            x: binary.x,
            y: binary.y,
            r: 14,
            alpha: 0.9,
            grow: 12,
            width: 2.4,
            delay: 0,
            rgb: [255, 224, 170],
            layer: 'museum',
          });
          spawnSparkleBurst(binary.x, binary.y, 36, 1.1, 'museum', [255, 224, 170]);
        }
      }

      // Agujero de gusano: teletransporte conservando velocidad, con cooldown
      for (let i = labWormholes.length - 1; i >= 0; i -= 1) {
        const wormhole = labWormholes[i];
        const age = time - wormhole.born;
        if (sparkles.length < 150 && Math.random() < 0.6) {
          const portalX = Math.random() < 0.5 ? wormhole.ax : wormhole.bx;
          const portalY = Math.random() < 0.5 ? wormhole.ay : wormhole.by;
          const ang = Math.random() * Math.PI * 2;
          const rr = 30 + Math.random() * 26;
          sparkles.push({
            x: portalX + Math.cos(ang) * rr,
            y: portalY + Math.sin(ang) * rr,
            vx: -Math.cos(ang) * 1.8,
            vy: -Math.sin(ang) * 1.8,
            life: 0.7,
            tint: 2,
            size: 1.2,
            grav: 0,
            rgb: [167, 139, 250],
            layer: 'museum',
          });
        }
        if (Math.random() < 0.12 && sparkles.length < 150) {
          const t = Math.random();
          sparkles.push({
            x: wormhole.ax + (wormhole.bx - wormhole.ax) * t + (Math.random() - 0.5) * 14,
            y: wormhole.ay + (wormhole.by - wormhole.ay) * t + (Math.random() - 0.5) * 14,
            vx: (wormhole.bx - wormhole.ax) * 0.004,
            vy: (wormhole.by - wormhole.ay) * 0.004,
            life: 0.8,
            tint: 2,
            size: 1.1,
            grav: 0,
            rgb: [190, 160, 255],
            layer: 'museum',
          });
        }
        for (const comet of comets) {
          if (comet.labWarpAt !== undefined && time - comet.labWarpAt < 0.6) continue;
          const dA = Math.hypot(comet.x - wormhole.ax, comet.y - wormhole.ay);
          const dB = Math.hypot(comet.x - wormhole.bx, comet.y - wormhole.by);
          if (dA < 22) {
            flashes.push({ x: wormhole.ax, y: wormhole.ay, r: 5, alpha: 0.7, rgb: [167, 139, 250], layer: 'museum' });
            comet.x = wormhole.bx + (comet.x - wormhole.ax);
            comet.y = wormhole.by + (comet.y - wormhole.ay);
            comet.labWarpAt = time;
            flashes.push({ x: comet.x, y: comet.y, r: 5, alpha: 0.7, rgb: [196, 160, 255], layer: 'museum' });
          } else if (dB < 22) {
            flashes.push({ x: wormhole.bx, y: wormhole.by, r: 5, alpha: 0.7, rgb: [167, 139, 250], layer: 'museum' });
            comet.x = wormhole.ax + (comet.x - wormhole.bx);
            comet.y = wormhole.ay + (comet.y - wormhole.by);
            comet.labWarpAt = time;
            flashes.push({ x: comet.x, y: comet.y, r: 5, alpha: 0.7, rgb: [196, 160, 255], layer: 'museum' });
          }
        }
        for (const dummy of labDummies) {
          if (dummy.warpAt !== undefined && time - dummy.warpAt < 0.8) continue;
          const dA = Math.hypot(dummy.x - wormhole.ax, dummy.y - wormhole.ay);
          const dB = Math.hypot(dummy.x - wormhole.bx, dummy.y - wormhole.by);
          if (dA < 24) {
            dummy.x = wormhole.bx + (dummy.x - wormhole.ax);
            dummy.y = wormhole.by + (dummy.y - wormhole.ay);
            dummy.warpAt = time;
          } else if (dB < 24) {
            dummy.x = wormhole.ax + (dummy.x - wormhole.bx);
            dummy.y = wormhole.ay + (dummy.y - wormhole.by);
            dummy.warpAt = time;
          }
        }
        if (age > 12) labWormholes.splice(i, 1);
      }

      // Blancos: muelles, bordes e impacto de cometas
      for (const dummy of labDummies) {
        dummy.vx *= 0.965;
        dummy.vy *= 0.965;
        dummy.x += dummy.vx * sandboxTimeScale;
        dummy.y += dummy.vy * sandboxTimeScale;
        if (dummy.x < 30 || dummy.x > width - 30) {
          dummy.vx *= -0.7;
          dummy.x = Math.max(30, Math.min(width - 30, dummy.x));
        }
        if (dummy.y < 30 || dummy.y > height - 30) {
          dummy.vy *= -0.7;
          dummy.y = Math.max(30, Math.min(height - 30, dummy.y));
        }
        for (const comet of comets) {
          if (comet.labCaptured) continue;
          if (comet.launchPower === undefined && !comet.labMirror) continue;
          const dx = dummy.x - comet.x;
          const dy = dummy.y - comet.y;
          const d = Math.hypot(dx, dy);
          if (d < 26 + comet.size * 2) {
            const dSafe = d || 1;
            const knock = Math.min(14, Math.hypot(comet.vx, comet.vy) * 1.1);
            dummy.vx += (dx / dSafe) * knock;
            dummy.vy += (dy / dSafe) * knock;
            flashes.push({ x: comet.x, y: comet.y, r: 4, alpha: 0.6, rgb: comet.tintRGB, layer: 'museum' });
            if (!comet.labMirror) comet.life = 0;
          }
        }
      }

      // Burbujas empujan blancos y enjambre al pasar el frente
      for (const b of bubbles) {
        if (b.age > 0.5) continue;
        for (const dummy of labDummies) {
          const dx = dummy.x - b.x;
          const dy = dummy.y - b.y;
          const d = Math.hypot(dx, dy) || 1;
          const reach = b.r + 50;
          if (d > reach) continue;
          const f = (1 - d / reach) * (b.grow ?? 8) * 0.5;
          dummy.vx += (dx / d) * f;
          dummy.vy += (dy / d) * f;
        }
        for (const boid of labSwarm) {
          const dx = boid.x - b.x;
          const dy = boid.y - b.y;
          const d = Math.hypot(dx, dy) || 1;
          const reach = b.r + 40;
          if (d > reach) continue;
          const f = (1 - d / reach) * (b.grow ?? 8) * 0.12;
          boid.vx += (dx / d) * f;
          boid.vy += (dy / d) * f;
        }
      }

      // Cometas espejo: colisiones elásticas entre ellos
      const mirrors = comets.filter((comet) => comet.labMirror);
      for (let i = 0; i < mirrors.length; i += 1) {
        for (let j = i + 1; j < mirrors.length; j += 1) {
          const a = mirrors[i];
          const b = mirrors[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          const minD = a.size + b.size + 6;
          if (d > 0.01 && d < minD) {
            const nx = dx / d;
            const ny = dy / d;
            const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
            if (rel > 0) {
              a.vx -= rel * nx;
              a.vy -= rel * ny;
              b.vx += rel * nx;
              b.vy += rel * ny;
              flashes.push({
                x: (a.x + b.x) / 2,
                y: (a.y + b.y) / 2,
                r: 4,
                alpha: 0.6,
                rgb: [230, 204, 150],
                layer: 'museum',
              });
            }
            const push = (minD - d) / 2;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
          }
        }
      }
    };

    const drawLab = () => {
      if (!sandboxActive || !fxCtx) return;
      for (const hole of labHoles) {
        const grow = Math.min(1, (time - hole.born) / 0.6);
        if (LAB_BLACKHOLE_V2) {
          // Gargantua: sombra pura + anillo de fotones con doppler + disco
          // de acreción térmico + luz lejana doblada por el lente.
          const coreR = 14 * grow;
          const spin = time * 1.6;
          // Resplandor cálido del lente alrededor de todo el horizonte
          const lensGlow = fxCtx.createRadialGradient(hole.x, hole.y, coreR, hole.x, hole.y, coreR * 2.9);
          lensGlow.addColorStop(0, `rgba(255,232,196,${0.42 * grow})`);
          lensGlow.addColorStop(0.4, `rgba(255,190,120,${0.18 * grow})`);
          lensGlow.addColorStop(1, 'rgba(255,170,90,0)');
          fxCtx.fillStyle = lensGlow;
          fxCtx.beginPath();
          fxCtx.arc(hole.x, hole.y, coreR * 2.9, 0, Math.PI * 2);
          fxCtx.fill();
          // Disco de acreción horizontal: gradiente térmico, más caliente adentro
          fxCtx.save();
          fxCtx.translate(hole.x, hole.y);
          for (let ringIndex = 0; ringIndex < 4; ringIndex += 1) {
            const t = ringIndex / 3;
            const rr = coreR * (1.4 + t * 2.2);
            fxCtx.strokeStyle = `rgba(${255 - Math.round(t * 90)},${Math.round(232 - t * 122)},${Math.round(190 - t * 130)},${(0.5 * (1 - t * 0.72) * grow).toFixed(3)})`;
            fxCtx.lineWidth = 2.6 - t * 1.5;
            fxCtx.beginPath();
            fxCtx.ellipse(0, 0, rr, rr * 0.3, spin * 0.1, 0, Math.PI * 2);
            fxCtx.stroke();
          }
          // Luz lejana doblada: anillo vertical que asoma por encima y debajo
          fxCtx.strokeStyle = `rgba(255,214,160,${(0.42 * grow).toFixed(3)})`;
          fxCtx.lineWidth = 2;
          fxCtx.beginPath();
          fxCtx.ellipse(0, 0, coreR * 0.6, coreR * 2.2, 0, 0, Math.PI * 2);
          fxCtx.stroke();
          fxCtx.restore();
          // Sombra pura: la única cosa del espacio que apaga estrellas
          fxCtx.fillStyle = 'rgba(2,2,5,0.97)';
          fxCtx.beginPath();
          fxCtx.arc(hole.x, hole.y, coreR, 0, Math.PI * 2);
          fxCtx.fill();
          // Anillo de fotones con doppler beaming: el lado que se acerca brilla más
          fxCtx.save();
          fxCtx.translate(hole.x, hole.y);
          fxCtx.rotate(0.35);
          const photon = fxCtx.createLinearGradient(-coreR * 1.3, 0, coreR * 1.3, 0);
          photon.addColorStop(0, `rgba(255,244,224,${(0.55 * grow).toFixed(3)})`);
          photon.addColorStop(0.5, `rgba(255,240,210,${(0.95 * grow).toFixed(3)})`);
          photon.addColorStop(1, `rgba(255,226,180,${(0.4 * grow).toFixed(3)})`);
          fxCtx.strokeStyle = photon;
          fxCtx.lineWidth = 1.7;
          fxCtx.beginPath();
          fxCtx.arc(0, 0, coreR * 1.1, 0, Math.PI * 2);
          fxCtx.stroke();
          fxCtx.restore();
        } else {
          const coreR = 13 * grow;
          const coreGrad = fxCtx.createRadialGradient(hole.x, hole.y, 0, hole.x, hole.y, coreR * 2.6);
          coreGrad.addColorStop(0, 'rgba(4,4,8,0.96)');
          coreGrad.addColorStop(0.5, 'rgba(20,24,44,0.8)');
          coreGrad.addColorStop(1, 'rgba(120,160,255,0)');
          fxCtx.fillStyle = coreGrad;
          fxCtx.beginPath();
          fxCtx.arc(hole.x, hole.y, coreR * 2.6, 0, Math.PI * 2);
          fxCtx.fill();
          fxCtx.strokeStyle = `rgba(150,190,255,${(0.5 + 0.2 * Math.sin(time * 7)) * grow})`;
          fxCtx.lineWidth = 1.3;
          fxCtx.beginPath();
          fxCtx.ellipse(hole.x, hole.y, coreR * 1.9, coreR * 0.7, time * 1.4, 0, Math.PI * 2);
          fxCtx.stroke();
        }
      }
      for (const well of labWells) {
        const pulse = 0.6 + 0.4 * Math.sin(time * 4 + well.x);
        const rgb = well.strength > 0 ? [143, 208, 255] : [255, 176, 84];
        fxCtx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(0.35 + pulse * 0.3).toFixed(3)})`;
        fxCtx.lineWidth = 1.4;
        fxCtx.beginPath();
        fxCtx.arc(well.x, well.y, 16 + pulse * 5, 0, Math.PI * 2);
        fxCtx.stroke();
        fxCtx.globalAlpha = 0.4;
        fxCtx.beginPath();
        fxCtx.arc(well.x, well.y, 30 + pulse * 8, 0, Math.PI * 2);
        fxCtx.stroke();
        fxCtx.globalAlpha = 1;
      }
      for (const dummy of labDummies) {
        fxCtx.strokeStyle = 'rgba(245,241,232,0.55)';
        fxCtx.lineWidth = 1.2;
        fxCtx.beginPath();
        fxCtx.arc(dummy.x, dummy.y, 15, 0, Math.PI * 2);
        fxCtx.stroke();
        fxCtx.beginPath();
        fxCtx.moveTo(dummy.x - 5, dummy.y);
        fxCtx.lineTo(dummy.x + 5, dummy.y);
        fxCtx.moveTo(dummy.x, dummy.y - 5);
        fxCtx.lineTo(dummy.x, dummy.y + 5);
        fxCtx.stroke();
      }
      for (const boid of labSwarm) {
        const [r, g, b] = sampleStops(AURORA, boid.hue * 0.8);
        const glow = fxCtx.createRadialGradient(boid.x, boid.y, 0, boid.x, boid.y, 5);
        glow.addColorStop(0, 'rgba(255,240,220,0.9)');
        glow.addColorStop(0.4, `rgba(${r},${g},${b},0.6)`);
        glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
        fxCtx.fillStyle = glow;
        fxCtx.beginPath();
        fxCtx.arc(boid.x, boid.y, 5, 0, Math.PI * 2);
        fxCtx.fill();
      }
      for (const emitter of labEmitters) {
        fxCtx.save();
        fxCtx.translate(emitter.x, emitter.y);
        fxCtx.rotate(emitter.angle);
        fxCtx.strokeStyle = 'rgba(150,196,255,0.8)';
        fxCtx.lineWidth = 1.3;
        fxCtx.beginPath();
        fxCtx.moveTo(-8, 0);
        fxCtx.lineTo(8, 0);
        fxCtx.moveTo(0, -8);
        fxCtx.lineTo(0, 8);
        fxCtx.stroke();
        fxCtx.restore();
      }
      // Anillo planetario: polvo orbital con brillo titilante
      for (const ring of labRings) {
        const age = time - ring.born;
        const fadeIn = Math.min(1, age / 1.2);
        const fadeOut = age > 17 ? Math.max(0, (20 - age) / 3) : 1;
        const global = fadeIn * fadeOut;
        for (const particle of ring.particles) {
          const ox = Math.cos(particle.kickAng) * particle.kick * 16;
          const oy = Math.sin(particle.kickAng) * particle.kick * 16 * 0.38;
          const px = ring.x + Math.cos(particle.ang) * (particle.rad + particle.kick * 6);
          const py = ring.y + Math.sin(particle.ang) * (particle.rad * 0.38 + particle.kick * 4);
          const [r, g, b] = sampleStops(AURORA, 0.15 + particle.tint * 0.6);
          const twinkle = 0.55 + 0.45 * Math.sin(time * 3 + particle.rad);
          fxCtx.fillStyle = `rgba(${r},${g},${b},${(global * twinkle * 0.8).toFixed(3)})`;
          fxCtx.beginPath();
          fxCtx.arc(px + ox, py + oy, particle.size, 0, Math.PI * 2);
          fxCtx.fill();
        }
      }
      // Estrella binaria: puente de plasma + dos soles
      for (const binary of labBinaries) {
        const age = time - binary.born;
        const fadeIn = Math.min(1, age / 0.8);
        const fadeOut = age > 8.5 ? Math.max(0, (10 - age) / 1.5) : 1;
        const global = fadeIn * fadeOut;
        const sep = 46;
        const ax = binary.x + Math.cos(binary.phase) * sep;
        const ay = binary.y + Math.sin(binary.phase) * sep * 0.6;
        const bx = binary.x - Math.cos(binary.phase) * sep;
        const by = binary.y - Math.sin(binary.phase) * sep * 0.6;
        const midX = (ax + bx) / 2 + Math.sin(time * 2.2) * 10;
        const midY = (ay + by) / 2 + Math.cos(time * 1.8) * 8;
        const bridge = fxCtx.createLinearGradient(ax, ay, bx, by);
        bridge.addColorStop(0, `rgba(150,196,255,${(0.55 * global).toFixed(3)})`);
        bridge.addColorStop(0.5, `rgba(255,214,150,${(0.6 * global).toFixed(3)})`);
        bridge.addColorStop(1, `rgba(255,176,120,${(0.55 * global).toFixed(3)})`);
        fxCtx.strokeStyle = bridge;
        fxCtx.lineWidth = 2.2;
        fxCtx.beginPath();
        fxCtx.moveTo(ax, ay);
        fxCtx.quadraticCurveTo(midX, midY, bx, by);
        fxCtx.stroke();
        for (const star of [
          [ax, ay, 170, 205, 255],
          [bx, by, 255, 200, 130],
        ] as const) {
          const glow = fxCtx.createRadialGradient(star[0], star[1], 0, star[0], star[1], 22);
          glow.addColorStop(0, `rgba(255,252,244,${(0.9 * global).toFixed(3)})`);
          glow.addColorStop(0.3, `rgba(${star[2]},${star[3]},${star[4]},${(0.55 * global).toFixed(3)})`);
          glow.addColorStop(1, `rgba(${star[2]},${star[3]},${star[4]},0)`);
          fxCtx.fillStyle = glow;
          fxCtx.beginPath();
          fxCtx.arc(star[0], star[1], 22, 0, Math.PI * 2);
          fxCtx.fill();
        }
      }
      // Agujero de gusano: vórtices gemelos girando
      for (const wormhole of labWormholes) {
        const age = time - wormhole.born;
        const fadeIn = Math.min(1, age / 0.8);
        const fadeOut = age > 10.5 ? Math.max(0, (12 - age) / 1.5) : 1;
        const global = fadeIn * fadeOut;
        for (const portal of [
          [wormhole.ax, wormhole.ay],
          [wormhole.bx, wormhole.by],
        ] as const) {
          const spin = time * 2.4;
          for (let ringIndex = 0; ringIndex < 3; ringIndex += 1) {
            const rr = 8 + ringIndex * 7;
            fxCtx.strokeStyle = `rgba(${167 + ringIndex * 12},${139 + ringIndex * 8},255,${((0.5 - ringIndex * 0.13) * global).toFixed(3)})`;
            fxCtx.lineWidth = 1.3;
            fxCtx.beginPath();
            fxCtx.ellipse(portal[0], portal[1], rr, rr * 0.42, spin + ringIndex, 0, Math.PI * 2);
            fxCtx.stroke();
          }
          const glow = fxCtx.createRadialGradient(portal[0], portal[1], 0, portal[0], portal[1], 20);
          glow.addColorStop(0, `rgba(210,180,255,${(0.5 * global).toFixed(3)})`);
          glow.addColorStop(1, 'rgba(167,139,250,0)');
          fxCtx.fillStyle = glow;
          fxCtx.beginPath();
          fxCtx.arc(portal[0], portal[1], 20, 0, Math.PI * 2);
          fxCtx.fill();
        }
      }
    };

    const frame = () => {
      if (!running) return;
      const nowMs = performance.now();
      dt = lastFrameNow > 0
        ? Math.min(0.032, Math.max(0.008, (nowMs - lastFrameNow) / 1000))
        : 0.016;
      time += dt;
      if (lastFrameNow > 0) {
        const rawDt = Math.max(1, nowMs - lastFrameNow);
        labFps = labFps * 0.94 + (1000 / rawDt) * 0.06;
      }
      lastFrameNow = nowMs;
      // Degradación progresiva: etapa 1 baja el DPR a 1, etapa 2 además
      // reduce la densidad de estrellas. Solo tras 2.5s de fps bajo.
      if (time > 5 && qualityStage < 2) {
        if (labFps < 44) {
          if (lowFpsSince === null) {
            lowFpsSince = nowMs;
          } else if (nowMs - lowFpsSince > 2500) {
            qualityStage += 1;
            dprCap = 1;
            starDensity = qualityStage >= 2 ? 0.65 : 1;
            lowFpsSince = null;
            resize();
          }
        } else if (labFps > 55) {
          lowFpsSince = null;
        }
      }
      const labStep = sandboxActive ? sandboxTimeScale : 1;
      // Entrada al sandbox: Q+E mantenidas 2s en el museo
      if (!sandboxActive && !playgroundRef.current && labQHeld && labEHeld) {
        if (sandboxChargeT0 === null) sandboxChargeT0 = time;
        else if (time - sandboxChargeT0 >= 2) {
          sandboxChargeT0 = null;
          enterSandbox();
        }
      } else if (!sandboxActive && sandboxChargeT0 !== null) {
        sandboxChargeT0 = null;
      }
      scrollVel *= 0.92;
      warpBoost *= 0.93;
      let scriptedVelocity = 0;
      let scriptedElapsedMs = 0;
      if (scriptedWarp) {
        const progress = Math.min(
          1,
          Math.max(0, (performance.now() - scriptedWarp.startedAt) / scriptedWarp.durationMs),
        );
        scriptedElapsedMs = progress * scriptedWarp.durationMs;
        if (progress >= 1) {
          scriptedWarp = null;
        } else {
          // Media onda senoidal: arranque y frenada suaves, con el máximo
          // estiramiento en la mitad del ascenso.
          scriptedVelocity =
            scriptedWarp.direction * scriptedWarp.peakVelocity * Math.sin(Math.PI * progress);
        }
      }
      const targetDim = dimRef.current ? 0.22 : 1;
      dimLevel += (targetDim - dimLevel) * 0.06;

      mouse.sx += (mouse.x - mouse.sx) * 0.055;
      mouse.sy += (mouse.y - mouse.sy) * 0.055;
      const parX = mouse.sx > -999 ? (mouse.sx / width - 0.5) * 2 : 0;
      const parY = mouse.sy > -999 ? (mouse.sy / height - 0.5) * 2 : 0;

      const isPlayground = playgroundSceneRef.current === 'active';
      const isArriving = playgroundSceneRef.current === 'arriving';
      const isDeparting = playgroundSceneRef.current === 'departing';
      const isSceneTransition = isArriving || isDeparting;
      const hasPlaygroundScene = isPlayground || isSceneTransition;
      const sceneProgress = isArriving
        ? smoothstep(
            (scriptedElapsedMs - PLAYGROUND_ARRIVAL_START_MS) /
              (PLAYGROUND_ARRIVAL_END_MS - PLAYGROUND_ARRIVAL_START_MS),
          )
        : isDeparting
          ? 1 -
            smoothstep(
              (scriptedElapsedMs - PLAYGROUND_DEPARTURE_START_MS) /
                (PLAYGROUND_DEPARTURE_END_MS - PLAYGROUND_DEPARTURE_START_MS),
            )
          : isPlayground
            ? 1
            : 0;
      const sceneDepthScale = isSceneTransition ? 0.72 + sceneProgress * 0.28 : 1;
      if (isSceneTransition && charge) clearCharge();

      if (hasPlaygroundScene && activePlaygroundRunId !== playgroundRunIdRef.current) {
        beginPlaygroundRun(playgroundRunIdRef.current);
      } else if (!hasPlaygroundScene && wasPlaygroundScene) {
        clearSketch();
        playgroundTargets = [];
        comboLabels = [];
        rapidFireHeld = false;
        resetPulsarPet();
        activePlaygroundRunId = -1;
      }
      wasPlaygroundScene = hasPlaygroundScene;

      const requestedPhase = requestedPlaygroundPhaseRef.current;
      if (isPlayground && playgroundPhase === 'active' && requestedPhase !== 'active') {
        playgroundPhase = requestedPhase;
        clearCharge();
        clearSketch();
        rapidFireHeld = false;
        resetPulsarPet();
        comets.forEach((comet) => {
          if (comet.launchPower !== undefined) comet.life = 0;
        });
      }

      /* ---- Navegación libre 360°: WASD/flechas empujan la cámara en
         cualquier dirección; fricción suave y velocidad de crucero limitada.
         Al salir del playground el impulso residual se disipa rápido ---- */
      if ((isPlayground && playgroundPhase === 'active') || sandboxActive) {
        let ax = 0;
        let ay = 0;
        if (heldDirs.has('left')) ax -= 1;
        if (heldDirs.has('right')) ax += 1;
        if (heldDirs.has('up')) ay -= 1;
        if (heldDirs.has('down')) ay += 1;
        const mag = Math.hypot(ax, ay);
        // El boost es un estado que persiste mientras se mantenga alguna tecla
        // de movimiento: cambiar de direccion no lo rompe; quedarse sin
        // ninguna tecla presionada (aunque sea un frame) si lo apaga.
        if (heldMovementCodes.size === 0) {
          boostLatched = false;
        } else if ((shiftHeld && Array.from(heldMovementCodes).some((code) => code.startsWith('Key'))) || Array.from(boostedWasdCodes).some((code) => heldMovementCodes.has(code))) {
          boostLatched = true;
        }
        const hasHeldWasd = Array.from(heldMovementCodes).some((code) => code.startsWith('Key'));
        const hasDoubleTapBoost = Array.from(boostedWasdCodes).some((code) => heldMovementCodes.has(code));
        const movementMultiplier =
          (shiftHeld && hasHeldWasd) || hasDoubleTapBoost || boostLatched ? 2 : 1;
        if (mag > 0) {
          const thrust = 0.32 * vscale * movementMultiplier;
          camVX += (ax / mag) * thrust;
          camVY += (ay / mag) * thrust;
        }
        const drag = mag > 0 ? 0.965 : 0.94;
        camVX *= drag;
        camVY *= drag;
        const cap = 12 * vscale * movementMultiplier;
        const spd = Math.hypot(camVX, camVY);
        if (spd > cap) {
          camVX *= cap / spd;
          camVY *= cap / spd;
        }
      } else {
        if (wasPlayground) {
          heldDirs.clear();
          heldMovementCodes.clear();
          boostedWasdCodes.clear();
          lastWasdDown.clear();
          boostLatched = false;
          rapidFireHeld = false;
          resetPulsarPet();
          shiftHeld = false;
        }
        camVX *= 0.86;
        camVY *= 0.86;
        if (Math.abs(camVX) < 0.01) camVX = 0;
        if (Math.abs(camVY) < 0.01) camVY = 0;
      }
      wasPlayground = isPlayground;
      camX += camVX;
      camY += camVY;

      if ((isPlayground && playgroundPhase === 'active') || sandboxActive) {
        // El anillo de la mascota persigue al puntero con seguimiento suave
        const hasPointer = mouse.x > -999 && mouse.y > -999;
        const orbitTargetX = hasPointer ? mouse.x : width / 2;
        const orbitTargetY = hasPointer ? mouse.y : height / 2;
        if (pulsarOrbitReady) {
          const follow = 1 - Math.exp(-12 * dt);
          pulsarOrbitX += (orbitTargetX - pulsarOrbitX) * follow;
          pulsarOrbitY += (orbitTargetY - pulsarOrbitY) * follow;
        } else {
          pulsarOrbitX = orbitTargetX;
          pulsarOrbitY = orbitTargetY;
          pulsarOrbitReady = true;
        }
        pulsarAngle += PULSAR_ORBIT_SPIN * dt;
        pulsarRingAngle += PULSAR_RING_PRECESSION * dt;
        if (pulsarPhase === 'returning' && time >= pulsarReturnStart + pulsarReturnDuration) {
          resetPulsarPet();
        }
      }

      const rapidFireReady =
        rapidFireAvailable &&
        ((isPlayground && playgroundPhase === 'active') || sandboxActive) &&
        pulsarPhase === 'firing' &&
        rapidFireHeld &&
        !charge &&
        mouse.x > -999 &&
        Math.hypot(mouse.x - pulsarAnchorX, mouse.y - pulsarAnchorY) >= 16;

      if (rapidFireReady && time >= nextRapidFireAt) {
        if (spawnRapidProjectile()) nextRapidFireAt = time + PLAYGROUND_RAPID_FIRE_INTERVAL;
      }

      // Refresco de rects de imágenes: al hacer scroll/resize y de forma
      // periódica (las imágenes con parallax se desplazan unos píxeles)
      if (rectsDirty || time > nextRectCheck) {
        refreshImgRects();
        rectsDirty = false;
        nextRectCheck = time + 0.5;
      }

      // Meteoros organicos: un unico programador con intervalo variable en
      // toda la pagina, sin ninguna dependencia del scroll
      if (!isSceneTransition && time > nextComet) {
        spawnAmbientComet();
        nextComet = time + 5 + Math.random() * 8;
      }

      ctx.clearRect(0, 0, width, height);
      fxCtx?.clearRect(0, 0, width, height);
      trailCtx?.clearRect(0, 0, width, height);
      const keyboardVelocity = playgroundRef.current
        ? 0
        : Math.abs(museumKeyboardVelocityRef?.current ?? 0);
      const effectiveScrollVelocity = scrollVel + scriptedVelocity;
      const scrollWarpFactor = scriptedVelocity !== 0 ? 0.055 : keyboardVelocity > 1 ? 0.18 : 0.055;
      const warp = Math.min(40, Math.abs(effectiveScrollVelocity) * scrollWarpFactor + warpBoost);
      const scrollDirection = Math.sign(effectiveScrollVelocity);
      if (scrollDirection === -1 || scrollDirection === 1) warpDirection = scrollDirection;
      const dir = scrollDirection || warpDirection;
      // Estiramiento por velocidad de la cámara: las estrellas se fugan en
      // sentido contrario al vuelo (efecto hyperspace al cruzar bordes rápido)
      const camSpd = Math.hypot(camVX, camVY);
      const camStretch = playgroundRef.current ? Math.min(40, camSpd * 2.4) : 0;

      const drawn: { x: number; y: number; z: number }[] = [];

      /* ---- Capa trasera: estrellas ---- */
      // Espacio infinito toroidal: la posición se envuelve dentro del viewport
      // con un margen de 80px; salir por un borde es reaparecer por el opuesto
      const spanW = width + 160;
      const spanH = height + 160;
      for (const star of stars) {
        star.x -= 0.05 * star.z;
        star.y -= effectiveScrollVelocity * 0.045 * star.z;

        const bx = wrapSpan(star.x - camX, spanW) - 80;
        const by = wrapSpan(star.y - camY, spanH) - 80;

        // Gravedad sutil del cursor: las estrellas cercanas se inclinan hacia él.
        // Usa la posición REAL del puntero (sin suavizar) para que el halo
        // gravitacional viva exactamente bajo el punto, nunca detrás.
        if (mouse.x > -999) {
          const gx = mouse.x - bx;
          const gy = mouse.y - by;
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

        const px = bx + star.ox + parX * star.z * 16;
        const py = by + star.oy + parY * star.z * 11;

        const [r, g, b] = TINTS[star.tint];
        const twinkle = 0.55 + 0.45 * Math.sin(time * (0.6 + star.z) + star.phase);
        const alpha = (0.16 + star.z * 0.5) * twinkle * dimLevel;
        const size = star.z * 1.5 + 0.3;

        // Vector de estiramiento: componente vertical por scroll (museo) más
        // componente direccional por la velocidad de la cámara (playground)
        let stX = 0;
        let stY = warp * star.z * dir;
        if (camStretch > 1.2) {
          const norm = 1 / (camSpd || 1);
          stX += -camVX * norm * camStretch * star.z;
          stY += -camVY * norm * camStretch * star.z;
        }

        if (warp > 1.2 || camStretch > 1.2) {
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = size * 0.9;
          ctx.beginPath();
          ctx.moveTo(px - stX * 0.5, py - stY * 0.5);
          ctx.lineTo(px + stX * 0.5, py + stY * 0.5);
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

        // En playground conviven estela aurora y constelacion del cursor:
        // solo el hero real suprime esta ultima (allí la estela es la protagonista)
        const cursorConstellationOff = overHero && !hasPlaygroundScene;
        const constellationArrivalAlpha = isSceneTransition ? sceneProgress : 1;
        if (drawn.length > 1 && dimLevel > 0.4 && !cursorConstellationOff) {
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
                const lineAlpha = Math.min(
                  1,
                  0.95 * (1 - d / 126) * near * dimLevel * constellationArrivalAlpha,
                );
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

        if (!cursorConstellationOff) {
          const glowTint = mixRGB(sampleStops(AURORA, (time * 0.08) % 1), [250, 244, 224], 0.3);
          for (const node of drawn) {
            if (pointInImage(node.x, node.y)) continue;
            const pulse = 0.75 + 0.25 * Math.sin(time * 2.2 + node.x);
            fxCtx.fillStyle = `rgba(${glowTint[0]},${glowTint[1]},${glowTint[2]},${(
              0.42 *
              pulse *
              dimLevel *
              constellationArrivalAlpha
            ).toFixed(3)})`;
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
        // Parallax profundo: las ambientales siguen la cámara al 35% (cielo
        // lejano), cada una dibujada desde su instancia envuelta más cercana
        // al centro para que la costura toroidal nunca parta una figura
        const camFX = camX * 0.35;
        const camFY = camY * 0.35;
        const ambSpanW = width + 160;
        const ambSpanH = height + 160;
        for (const c of ambient) {
          c.x -= 0.032;
          const age = time - c.t0;
          // Sin banda de hero en playground: las ambientales cubren todo
          const heroFade = hasPlaygroundScene
            ? 1
            : Math.max(0, Math.min(1, (c.y - heroBottom) / 140));
          const fade = Math.min(1, age / 2.2) * Math.min(1, (c.dur - age) / 2.6) * heroFade;
          if (fade <= 0.01) continue;
          const rawAnchorX = wrapNearest(c.x - camFX, ambSpanW, width / 2);
          const rawAnchorY = wrapNearest(c.y - camFY, ambSpanH, height / 2);
          const anchorX = width / 2 + (rawAnchorX - width / 2) * sceneDepthScale;
          const anchorY = height / 2 + (rawAnchorY - height / 2) * sceneDepthScale;
          // Eco magnético: el cursor aviva ligeramente la constelación cercana
          let boost = 1;
          if (mouse.x > -999) {
            const dc = Math.hypot(mouse.x - anchorX, mouse.y - anchorY);
            if (dc < 300) boost += 0.5 * (1 - dc / 300);
          }
          const sceneAlpha = isSceneTransition ? sceneProgress : 1;
          const alpha = Math.min(1, 0.3 * fade * boost * dimLevel * sceneAlpha);
          // Tinte aurora propio de esta constelación, aclarado en el trazo fino
          const tint = c.tint;
          const tintLite = mixRGB(tint, [250, 244, 224], 0.55);
          fxCtx.lineCap = 'round';
          for (const [a, b] of c.edges) {
            const ax = anchorX + c.nodes[a].ox * sceneDepthScale;
            const ay = anchorY + c.nodes[a].oy * sceneDepthScale;
            const bx = anchorX + c.nodes[b].ox * sceneDepthScale;
            const by = anchorY + c.nodes[b].oy * sceneDepthScale;
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
            const nx = anchorX + node.ox * sceneDepthScale;
            const ny = anchorY + node.oy * sceneDepthScale;
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

        // Mini-palabra: las letras destruidas vuelan hasta su slot y forman
        // ASTROINGENIERÍA arriba, en pequeño, como progreso viviente.
        if (hasPlaygroundScene && playgroundTargets.length > 0) {
          const miniSize = Math.max(13, Math.min(20, Math.min(width, height) * 0.024));
          const wordY = Math.max(26, miniSize * 1.7);
          fxCtx.save();
          fxCtx.font = `600 ${miniSize}px "Fraunces Variable", Fraunces, serif`;
          fxCtx.textAlign = 'center';
          fxCtx.textBaseline = 'middle';
          const characters = PLAYGROUND_WORD.split('');
          const charWidths = characters.map((character) => fxCtx.measureText(character).width);
          const tracking = miniSize * 0.14;
          const totalWordWidth =
            charWidths.reduce((sum, charWidth) => sum + charWidth, 0) +
            tracking * (charWidths.length - 1);
          let slotCursor = width / 2 - totalWordWidth / 2;
          const slots = charWidths.map((charWidth) => {
            const x = slotCursor + charWidth / 2;
            slotCursor += charWidth + tracking;
            return x;
          });

          // Puntos guía en los slots aún vacíos
          slots.forEach((slotX, index) => {
            const target = playgroundTargets[index];
            if (!target || target.destroyed) return;
            const guidePulse = 0.5 + 0.5 * Math.sin(time * 2.2 + index * 0.7);
            fxCtx.fillStyle = `rgba(245,241,232,${(0.1 + guidePulse * 0.08).toFixed(3)})`;
            fxCtx.beginPath();
            fxCtx.arc(slotX, wordY, 1.4, 0, Math.PI * 2);
            fxCtx.fill();
          });

          // Barrido de brillo al completar la palabra
          let sweepX = -Infinity;
          if (playgroundPhase === 'complete') {
            sweepX = width / 2 - totalWordWidth / 2 + totalWordWidth * (((time * 0.55) % 1.6) / 1.6);
          }

          playgroundTargets.forEach((target, index) => {
            if (
              !target.destroyed ||
              target.destroyedAt === undefined ||
              target.deathX === undefined ||
              target.deathY === undefined
            ) {
              return;
            }
            const slotX = slots[index];
            if (slotX === undefined) return;
            const progress = Math.min(1, (time - target.destroyedAt) / 0.9);
            const eased = 1 - Math.pow(1 - progress, 3);
            const arcLift = Math.sin(eased * Math.PI) * miniSize * 2.2;
            const x = target.deathX + (slotX - target.deathX) * eased;
            const y = target.deathY + (wordY - target.deathY) * eased - arcLift;
            const settle = 1 + (1 - eased) * 1.1;
            const tint = affinityTint(target.affinity);
            let alpha = 0.25 + 0.75 * eased;
            if (progress >= 1) {
              alpha = 0.82 + 0.18 * Math.sin(time * 2 + index * 0.9);
            }
            let glow = 7;
            if (sweepX !== -Infinity) {
              glow += Math.max(0, 10 - Math.abs(slotX - sweepX)) * 1.6;
            }
            fxCtx.save();
            fxCtx.translate(x, y);
            fxCtx.scale(settle, settle);
            fxCtx.shadowColor = `rgba(${tint[0]},${tint[1]},${tint[2]},0.85)`;
            fxCtx.shadowBlur = glow;
            fxCtx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${alpha.toFixed(3)})`;
            fxCtx.fillText(target.character, 0, 0);
            fxCtx.restore();
          });
          fxCtx.restore();
        }

        // Objetivos del playground: letras persistentes en un campo de 4 x 3
        // viewports, proyectadas respecto de la cámara libre.
        if (hasPlaygroundScene && playgroundTargets.length > 0 && playgroundPhase !== 'complete') {
          const fontSize = playgroundFontSize() * sceneDepthScale;
          fxCtx.save();
          fxCtx.textAlign = 'center';
          fxCtx.textBaseline = 'middle';
          fxCtx.font = `700 ${fontSize}px "Fraunces Variable", Fraunces, serif`;

          for (const target of playgroundTargets) {
            if (target.destroyed) continue;

            const fullCenter = playgroundLetterCenter(target);
            const previousCenter = {
              x: target.previousScreenX ?? fullCenter.x,
              y: target.previousScreenY ?? fullCenter.y,
            };
            let center = {
              x: width / 2 + (fullCenter.x - width / 2) * sceneDepthScale,
              y: height / 2 + (fullCenter.y - height / 2) * sceneDepthScale,
            };
            if (isPlayground && playgroundPhase === 'active') {
              const frameStep = dt;
              const minDimension = Math.max(320, Math.min(width, height));
              const slowFactor = target.slowedUntil > time ? PLAYGROUND_SLOW_FACTOR : 1;
              const toDestinationX = (target.destinationU - target.worldU) * width;
              const toDestinationY = (target.destinationV - target.worldV) * height;
              const waypointDistance = Math.hypot(toDestinationX, toDestinationY);
              if (time >= target.nextWaypoint || waypointDistance < fontSize * 0.52) {
                chooseLetterWaypoint(target);
              }

              let desiredPxVX = 0;
              let desiredPxVY = 0;
              if (time >= target.pauseUntil && waypointDistance > 1) {
                let directionX = toDestinationX / waypointDistance;
                let directionY = toDestinationY / waypointDistance;
                const bend =
                  target.profile === 'orbit'
                    ? Math.sin(time * 0.45 + target.phase) * target.curve
                    : target.profile === 'wander'
                      ? Math.sin(time * 0.6 + target.phase) * target.curve * 0.6
                      : target.profile === 'drift'
                        ? Math.sin(time * 0.28 + target.phase) * target.curve * 0.3
                        : 0;
                const bentX = directionX - directionY * bend;
                const bentY = directionY + directionX * bend;
                const bentLength = Math.hypot(bentX, bentY) || 1;
                directionX = bentX / bentLength;
                directionY = bentY / bentLength;
                const profileSpeed = target.profile === 'wander' ? 1.08 : target.profile === 'pause' ? 0.82 : 1;
                const speed = target.cruiseSpeed * minDimension * profileSpeed * slowFactor;
                desiredPxVX = directionX * speed;
                desiredPxVY = directionY * speed;
              }

              // Repulsión suave: mantiene las siluetas separadas sin imponerles
              // una cuadrícula ni impedir que migren entre sectores.
              const minimumSeparation = fontSize * 1.65;
              for (const other of playgroundTargets) {
                if (other === target || other.destroyed) continue;
                const separationX = (target.worldU - other.worldU) * width;
                const separationY = (target.worldV - other.worldV) * height;
                const separation = Math.hypot(separationX, separationY);
                if (separation <= 0.001 || separation >= minimumSeparation) continue;
                const strength =
                  (1 - separation / minimumSeparation) *
                  target.cruiseSpeed *
                  minDimension *
                  1.4 *
                  slowFactor;
                desiredPxVX += (separationX / separation) * strength;
                desiredPxVY += (separationY / separation) * strength;
              }

              const desiredSpeed = Math.hypot(desiredPxVX, desiredPxVY);
              const maxCruiseSpeed = target.cruiseSpeed * minDimension * 1.9 * slowFactor;
              if (desiredSpeed > maxCruiseSpeed) {
                desiredPxVX *= maxCruiseSpeed / desiredSpeed;
                desiredPxVY *= maxCruiseSpeed / desiredSpeed;
              }
              let roamPxVX = target.roamVX * width;
              let roamPxVY = target.roamVY * height;
              const velocityDeltaX = desiredPxVX - roamPxVX;
              const velocityDeltaY = desiredPxVY - roamPxVY;
              const velocityDelta = Math.hypot(velocityDeltaX, velocityDeltaY);
              const maxVelocityDelta = target.acceleration * minDimension * frameStep * slowFactor;
              if (velocityDelta > maxVelocityDelta) {
                roamPxVX += (velocityDeltaX / velocityDelta) * maxVelocityDelta;
                roamPxVY += (velocityDeltaY / velocityDelta) * maxVelocityDelta;
              } else {
                roamPxVX = desiredPxVX;
                roamPxVY = desiredPxVY;
              }
              // Dardos aleatorios: impulsos bruscos periodicos para que ninguna
              // letra se quede quieta en el mapa, la ataquen o no.
              if (time >= target.nextDart) {
                const dartAngle = nextLetterRandom(target) * Math.PI * 2;
                const dartImpulse = 90 * Math.max(0.72, vscale) * slowFactor;
                roamPxVX += Math.cos(dartAngle) * dartImpulse;
                roamPxVY += Math.sin(dartAngle) * dartImpulse;
                target.nextDart = time + 1.2 + nextLetterRandom(target) * 1.5;
              }
              target.roamVX = roamPxVX / Math.max(1, width);
              target.roamVY = roamPxVY / Math.max(1, height);
              target.worldU += target.roamVX * frameStep;
              target.worldV += target.roamVY * frameStep;
              if (Math.abs(target.worldU) > PLAYGROUND_FIELD_U) {
                target.worldU = Math.sign(target.worldU) * PLAYGROUND_FIELD_U;
                target.roamVX *= -0.45;
                chooseLetterWaypoint(target);
              }
              if (Math.abs(target.worldV) > PLAYGROUND_FIELD_V) {
                target.worldV = Math.sign(target.worldV) * PLAYGROUND_FIELD_V;
                target.roamVY *= -0.45;
                chooseLetterWaypoint(target);
              }

              target.vx += -target.offsetX * 4.1 * frameStep;
              target.vy += -target.offsetY * 4.1 * frameStep;
              const evadeDamping = Math.exp(-2.5 * frameStep);
              target.vx *= evadeDamping;
              target.vy *= evadeDamping;
              target.offsetX += target.vx * frameStep;
              target.offsetY += target.vy * frameStep;
              const displacement = Math.hypot(target.offsetX, target.offsetY);
              const maxEvade = 120 * Math.max(0.72, vscale);
              if (displacement > maxEvade) {
                target.offsetX *= maxEvade / displacement;
                target.offsetY *= maxEvade / displacement;
              }

              center = playgroundLetterCenter(target);
              if (time >= target.nextEvade) {
              let threat: Comet | null = null;
              const rapidEvader = rapidFireAvailable && target.affinity === 'rapid';
              const evadeScale = Math.max(0.72, vscale);
              const baseThreatDistance = (rapidEvader ? 430 : 300) * evadeScale;
              let nearestThreatDistance = Infinity;
              for (const comet of comets) {
                if (comet.launchPower === undefined || comet.life <= 0) continue;
                const dx = center.x - comet.x;
                const dy = center.y - comet.y;
                const distance = Math.hypot(dx, dy);
                // Proyectiles rapidos exigen detection proporcional a su velocidad
                const approachSpeed = Math.hypot(comet.vx, comet.vy);
                const reach = Math.max(baseThreatDistance, approachSpeed * 22 * evadeScale);
                if (distance >= reach || dx * comet.vx + dy * comet.vy <= 0) continue;
                if (distance >= nearestThreatDistance) continue;
                threat = comet;
                nearestThreatDistance = distance;
              }
              if (threat) {
                const speed = Math.hypot(threat.vx, threat.vy) || 1;
                let dodgeX = -threat.vy / speed;
                let dodgeY = threat.vx / speed;
                const side = Math.sign((center.x - threat.x) * dodgeX + (center.y - threat.y) * dodgeY) || 1;
                dodgeX *= side;
                dodgeY *= side;
                const evadeImpulse =
                  150 * (rapidEvader ? 1.9 : 1) * slowFactor * evadeScale;
                target.vx += dodgeX * evadeImpulse;
                target.vy += dodgeY * evadeImpulse;
                const evadeSpeed = Math.hypot(target.vx, target.vy);
                const maxEvadeSpeed =
                  245 * (rapidEvader ? 1.65 : 1) * slowFactor * evadeScale;
                if (evadeSpeed > maxEvadeSpeed) {
                  target.vx *= maxEvadeSpeed / evadeSpeed;
                  target.vy *= maxEvadeSpeed / evadeSpeed;
                }
                target.nextEvade = time + (rapidEvader ? 0.12 : 0.3);
                target.threatenedUntil = time + 0.25;
              }
            }

            // Evasión del jugador: al acercar la cámara, el cursor termina
            // encima de la letra. Durante la carga manda el origen fijo de la
            // supernova, para que apuntar siga requiriendo anticipación.
              const pointerThreat =
              charge && charge.layer !== 'studio'
                ? { x: charge.x, y: charge.y }
                : mouse.x > -999
                  ? mouse
                  : null;
              if (pointerThreat) {
              let awayX = center.x - pointerThreat.x;
              let awayY = center.y - pointerThreat.y;
              let pointerDistance = Math.hypot(awayX, awayY);
              const pointerScale = Math.max(0.72, vscale);
              const rapidEvader = rapidFireAvailable && target.affinity === 'rapid';
                const pointerRadius = (rapidEvader ? 390 : 320) * pointerScale;
              if (pointerDistance < pointerRadius) {
                if (pointerDistance < 0.001) {
                  const fallbackAngle = target.phase + target.id * 1.7;
                  awayX = Math.cos(fallbackAngle);
                  awayY = Math.sin(fallbackAngle);
                  pointerDistance = 1;
                }
                const normalX = awayX / pointerDistance;
                const normalY = awayY / pointerDistance;
                const proximity = Math.max(0, 1 - pointerDistance / pointerRadius);
                const response = Math.pow(proximity, 1.35);
                // Con un proyectil entrante la huida del cursor se atenia para
                // que el esquivo lateral del proyectil no quede anulado.
                const threatBias = target.threatenedUntil > time ? 0.4 : 1;
                const pointerAcceleration =
                  (130 + 700 * response) *
                  pointerScale *
                  (rapidEvader ? 1.85 : 1) *
                  slowFactor *
                  threatBias;
                target.vx += normalX * pointerAcceleration * frameStep;
                target.vy += normalY * pointerAcceleration * frameStep;

                const pointerSpeed = Math.hypot(target.vx, target.vy);
                const maxPointerSpeed =
                  235 * pointerScale * (rapidEvader ? 1.6 : 1) * slowFactor;
                if (pointerSpeed > maxPointerSpeed) {
                  target.vx *= maxPointerSpeed / pointerSpeed;
                  target.vy *= maxPointerSpeed / pointerSpeed;
                }

                if (proximity >= 0.38 && time >= target.nextPointerEvade) {
                  const escapeDistance = pointerRadius * (0.9 + nextLetterRandom(target) * 0.35);
                  target.destinationU = Math.max(
                    -PLAYGROUND_FIELD_U,
                    Math.min(PLAYGROUND_FIELD_U, target.worldU + (normalX * escapeDistance) / Math.max(1, width)),
                  );
                  target.destinationV = Math.max(
                    -PLAYGROUND_FIELD_V,
                    Math.min(PLAYGROUND_FIELD_V, target.worldV + (normalY * escapeDistance) / Math.max(1, height)),
                  );
                  target.pauseUntil = time;
                  target.nextWaypoint = time + 3.5 + nextLetterRandom(target) * 1.5;
                  target.nextPointerEvade = time + (rapidEvader ? 0.15 : 0.35);
                }
              }

              // Linea de tiro del pulsar: mientras la mascota esta anclada y
              // dispara, empuje perpendicular fuera del rayo anclaje->cursor y
              // waypoint de escape lateral, para que el disparo no la alcance.
              if (rapidFireHeld && !charge && pulsarPhase === 'firing') {
                const aimX = mouse.x - pulsarAnchorX;
                const aimY = mouse.y - pulsarAnchorY;
                const aimLength = Math.hypot(aimX, aimY);
                if (aimLength > 16) {
                  const aimUX = aimX / aimLength;
                  const aimUY = aimY / aimLength;
                  const alongX = center.x - pulsarAnchorX;
                  const alongY = center.y - pulsarAnchorY;
                  const projection = alongX * aimUX + alongY * aimUY;
                  if (projection > -fontSize) {
                    let laneX = alongX - projection * aimUX;
                    let laneY = alongY - projection * aimUY;
                    let laneDistance = Math.hypot(laneX, laneY);
                    if (laneDistance < 0.001) {
                      laneX = -aimUY;
                      laneY = aimUX;
                      laneDistance = 1;
                    }
                    const laneRadius = fontSize * 1.3 + 70 * pointerScale;
                    if (laneDistance < laneRadius) {
                      const lanePush =
                        (1 - laneDistance / laneRadius) *
                        620 *
                        pointerScale *
                        (rapidEvader ? 1.7 : 1) *
                        slowFactor;
                      target.vx += (laneX / laneDistance) * lanePush * frameStep;
                      target.vy += (laneY / laneDistance) * lanePush * frameStep;
                      const laneMaxSpeed =
                        260 * pointerScale * (rapidEvader ? 1.6 : 1) * slowFactor;
                      const laneSpeed = Math.hypot(target.vx, target.vy);
                      if (laneSpeed > laneMaxSpeed) {
                        target.vx *= laneMaxSpeed / laneSpeed;
                        target.vy *= laneMaxSpeed / laneSpeed;
                      }
                      if (time >= target.nextPointerEvade) {
                        const laneEscape = laneRadius * (1.2 + nextLetterRandom(target) * 0.5);
                        target.destinationU = Math.max(
                          -PLAYGROUND_FIELD_U,
                          Math.min(
                            PLAYGROUND_FIELD_U,
                            target.worldU + ((laneX / laneDistance) * laneEscape) / Math.max(1, width),
                          ),
                        );
                        target.destinationV = Math.max(
                          -PLAYGROUND_FIELD_V,
                          Math.min(
                            PLAYGROUND_FIELD_V,
                            target.worldV + ((laneY / laneDistance) * laneEscape) / Math.max(1, height),
                          ),
                        );
                        target.pauseUntil = time;
                        target.nextWaypoint = time + 2 + nextLetterRandom(target) * 1.2;
                        target.nextPointerEvade = time + (rapidEvader ? 0.25 : 0.5);
                      }
                    }
                  }
                }
              }
            }

            }

            if (isPlayground && playgroundPhase === 'active') {
              applyChargedSegmentContacts(target, previousCenter, center, fontSize);
            }
            target.previousScreenX = center.x;
            target.previousScreenY = center.y;

            if (
              center.x < -fontSize * 1.5 ||
              center.x > width + fontSize * 1.5 ||
              center.y < -fontSize * 1.5 ||
              center.y > height + fontSize * 1.5
            ) {
              continue;
            }

            const damageRatio = 1 - target.hp / target.maxHp;
            const state = Math.min(4, Math.floor(damageRatio * 5));
            const damageFlicker = state >= 3 ? Math.max(0, Math.sin(time * (7.5 + state) + target.phase * 2.1)) * 0.07 : 0;
            const pulse = 0.97 - damageRatio * 0.2 + Math.sin(time * (1.2 + state * 0.38) + target.phase) * (0.025 + state * 0.012) - damageFlicker;
            const rotation =
              Math.sin(time * (0.28 + state * 0.12) + target.phase) * (0.012 + state * 0.011) +
              target.vx * 0.00045;
            const tint = affinityTint(target.affinity);
            const bodyTint = mixRGB(tint, [250, 246, 234], 0.64 - damageRatio * 0.18);
            const isSlowed = target.slowedUntil > time;

            fxCtx.save();
            fxCtx.translate(center.x, center.y);
            fxCtx.rotate(rotation);
            fxCtx.globalAlpha = pulse * sceneProgress;
            if (target.affinity === 'rapid') {
              const orbitPulse = 0.68 + Math.sin(time * 5.4 + target.phase) * 0.2;
              fxCtx.setLineDash([3, 7]);
              fxCtx.lineWidth = 1.25;
              fxCtx.strokeStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${orbitPulse.toFixed(3)})`;
              fxCtx.beginPath();
              fxCtx.ellipse(0, 0, fontSize * 0.48, fontSize * 0.39, time * 0.24 + target.phase, 0, Math.PI * 2);
              fxCtx.stroke();
              fxCtx.globalAlpha *= 0.58;
              fxCtx.beginPath();
              fxCtx.ellipse(0, 0, fontSize * 0.6, fontSize * 0.48, -time * 0.18 + target.phase, 0, Math.PI * 2);
              fxCtx.stroke();
              fxCtx.globalAlpha = pulse * sceneProgress;
              fxCtx.setLineDash([]);
            } else {
              fxCtx.lineWidth = 3.2;
              fxCtx.strokeStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},0.28)`;
              fxCtx.beginPath();
              fxCtx.ellipse(0, 0, fontSize * 0.53, fontSize * 0.43, 0, 0, Math.PI * 2);
              fxCtx.stroke();
            }
            if (isSlowed) {
              const slowSpin = time * 1.8 + target.phase;
              fxCtx.setLineDash([8, 6]);
              fxCtx.lineDashOffset = -time * 18;
              fxCtx.lineWidth = 2.2;
              fxCtx.strokeStyle = `rgba(${PLAYGROUND_RAPID_TINT[0]},${PLAYGROUND_RAPID_TINT[1]},${PLAYGROUND_RAPID_TINT[2]},0.88)`;
              fxCtx.beginPath();
              fxCtx.ellipse(0, 0, fontSize * 0.66, fontSize * 0.54, slowSpin, 0, Math.PI * 2);
              fxCtx.stroke();
              fxCtx.setLineDash([]);
              fxCtx.lineDashOffset = 0;
            }
            fxCtx.lineWidth = 1.2 + state * 0.55;
            fxCtx.strokeStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${(0.48 + damageRatio * 0.42).toFixed(3)})`;
            fxCtx.shadowColor = `rgba(${tint[0]},${tint[1]},${tint[2]},${0.38 + damageRatio * 0.35})`;
            fxCtx.shadowBlur = 14 + state * 5;
            fxCtx.strokeText(target.character, 0, 0);
            fxCtx.fillStyle = `rgba(${bodyTint[0]},${bodyTint[1]},${bodyTint[2]},${(0.94 - damageRatio * 0.38).toFixed(3)})`;
            fxCtx.fillText(target.character, 0, 0);
            fxCtx.shadowBlur = 0;

            for (let crack = 0; crack < state; crack += 1) {
              const crackSeed = target.id * 1.71 + crack * 2.37;
              const startX = Math.sin(crackSeed) * fontSize * 0.2;
              const startY = -fontSize * 0.24 + crack * fontSize * 0.12;
              fxCtx.strokeStyle = `rgba(7,7,7,${0.42 + crack * 0.08})`;
              fxCtx.lineWidth = 1.5;
              fxCtx.beginPath();
              fxCtx.moveTo(startX, startY);
              fxCtx.lineTo(startX + Math.cos(crackSeed) * fontSize * 0.16, startY + fontSize * 0.17);
              fxCtx.lineTo(startX - Math.sin(crackSeed) * fontSize * 0.1, startY + fontSize * 0.29);
              if (crack > 0) {
                fxCtx.moveTo(startX + Math.cos(crackSeed) * fontSize * 0.09, startY + fontSize * 0.1);
                fxCtx.lineTo(startX - Math.sin(crackSeed * 1.7) * fontSize * 0.13, startY + fontSize * 0.2);
              }
              fxCtx.stroke();
            }
            fxCtx.restore();
          }

          if (playgroundPhase === 'active') {
          const remainingTargets = playgroundTargets.filter((target) => !target.destroyed);
          let nearest: { center: { x: number; y: number }; rect: ViewRect; distance: number } | null = null;
          for (const target of remainingTargets) {
            const fullCenter = playgroundLetterCenter(target);
            const center = {
              x: width / 2 + (fullCenter.x - width / 2) * sceneDepthScale,
              y: height / 2 + (fullCenter.y - height / 2) * sceneDepthScale,
            };
            const fullRect = playgroundLetterRect(target);
            const rect = {
              x: center.x - (fullRect.w * sceneDepthScale) / 2,
              y: center.y - (fullRect.h * sceneDepthScale) / 2,
              w: fullRect.w * sceneDepthScale,
              h: fullRect.h * sceneDepthScale,
            };
            const distance = Math.hypot(center.x - width / 2, center.y - height / 2);
            if (!nearest || distance < nearest.distance) {
              nearest = { center, rect, distance };
            }
          }
          const compactRadar = width <= 720;
          const radarSide = compactRadar ? 64 : 58;
          const radarTop = compactRadar ? 126 : 104;
          const radarBottom = Math.max(radarTop + 80, height - (compactRadar ? 154 : 150));
          const radarSafeRect: ViewRect = {
            x: radarSide,
            y: radarTop,
            w: Math.max(40, width - radarSide * 2),
            h: Math.max(40, radarBottom - radarTop),
          };
          const nearestIsVisible =
            nearest !== null &&
            nearest.rect.x + nearest.rect.w >= radarSafeRect.x &&
            nearest.rect.x <= radarSafeRect.x + radarSafeRect.w &&
            nearest.rect.y + nearest.rect.h >= radarSafeRect.y &&
            nearest.rect.y <= radarSafeRect.y + radarSafeRect.h;
          if (nearest && !nearestIsVisible) {
            const dx = nearest.center.x - width / 2;
            const dy = nearest.center.y - height / 2;
            const scaleX =
              dx > 0
                ? (radarSafeRect.x + radarSafeRect.w - width / 2) / dx
                : dx < 0
                  ? (radarSafeRect.x - width / 2) / dx
                  : Number.POSITIVE_INFINITY;
            const scaleY =
              dy > 0
                ? (radarSafeRect.y + radarSafeRect.h - height / 2) / dy
                : dy < 0
                  ? (radarSafeRect.y - height / 2) / dy
                  : Number.POSITIVE_INFINITY;
            const scale = Math.max(0, Math.min(scaleX, scaleY));
            const radarX = width / 2 + dx * scale;
            const radarY = height / 2 + dy * scale;
            const angle = Math.atan2(dy, dx);
            fxCtx.save();
            fxCtx.globalAlpha = sceneProgress;
            fxCtx.translate(radarX, radarY);
            fxCtx.rotate(angle);
            fxCtx.fillStyle = 'rgba(230,204,158,0.82)';
            fxCtx.shadowColor = 'rgba(201,168,106,0.65)';
            fxCtx.shadowBlur = 12;
            fxCtx.beginPath();
            fxCtx.moveTo(12, 0);
            fxCtx.lineTo(-7, -6);
            fxCtx.lineTo(-3, 0);
            fxCtx.lineTo(-7, 6);
            fxCtx.closePath();
            fxCtx.fill();
            fxCtx.restore();
          }
          }
          fxCtx.restore();
        }

        // Estela del cursor sobre el hero: cinta continua por segmentos con la
        // paleta aurora fluyendo a lo largo de la cola, cabeza brillante y
        // polvo de acento naciendo a media cola para no ensuciar el halo.
        // En las salas de estudio la misma cinta se dibuja en la capa superior,
        // exenta del modo dim para que luzca plena sobre el panel.
        if (mouse.x > -999 && !isSceneTransition) {
          // Estela aurora en toda la página: hero, salas, estudio y playground
          const zone = overStudio ? 'studio' : 'hero';
          if (zone) {
            const lastPt = trail[trail.length - 1];
            if (!lastPt || Math.hypot(mouse.x - lastPt.x, mouse.y - lastPt.y) > 1.2) {
              trail.push({ x: mouse.x, y: mouse.y, t: time });
            }
          }
          while (trail.length > 0 && time - trail[0].t > 0.38) trail.shift();
          if (trail.length > 40) trail.splice(0, trail.length - 40);

          if (trail.length >= 6 && sparkles.length < 150) {
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
          if (sandboxActive) {
            for (const hole of labHoles) {
              const dx = hole.x - sp.x;
              const dy = hole.y - sp.y;
              const d = Math.hypot(dx, dy) || 1;
              if (d < 300) {
                const pull = (1 - d / 300) * 1.6;
                sp.vx += ((dx / d) * pull - (dy / d) * pull * 0.8) * sandboxTimeScale;
                sp.vy += ((dy / d) * pull + (dx / d) * pull * 0.8) * sandboxTimeScale;
              }
            }
          }
          sp.x += sp.vx * labStep;
          sp.y += sp.vy * labStep;
          sp.vx *= 0.965;
          sp.vy = sp.vy * 0.965 + sp.grav;
          sp.life -= (sp.size > 2.6 ? 0.018 : 0.024) * labStep;
          const [sr, sg, sb] = sp.rgb ?? TINTS[sp.tint];
          const target = effectContext(sp.layer);
          if (!target) continue;
          const level = effectOpacity(sp.layer);
          target.fillStyle = `rgba(${sr},${sg},${sb},${Math.min(1, sp.life * 1.15 * level).toFixed(3)})`;
          target.beginPath();
          target.arc(sp.x, sp.y, sp.size * sp.life + 0.5, 0, Math.PI * 2);
          target.fill();
        }

        flashes = flashes.filter((flash) => flash.alpha > 0.02);
        for (const flash of flashes) {
          flash.r += 3.4;
          flash.alpha *= 0.87;
          const target = effectContext(flash.layer);
          if (!target) continue;
          const level = effectOpacity(flash.layer);
          const flashRGB: RGB = flash.rgb ?? [230, 204, 150];
          const flashLite = mixRGB(flashRGB, [255, 250, 235], 0.72);
          const gradient = target.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, flash.r * 2.4);
          gradient.addColorStop(0, `rgba(${flashLite[0]},${flashLite[1]},${flashLite[2]},${flash.alpha.toFixed(3)})`);
          gradient.addColorStop(0.45, `rgba(${flashRGB[0]},${flashRGB[1]},${flashRGB[2]},${(flash.alpha * 0.5).toFixed(3)})`);
          gradient.addColorStop(1, `rgba(${flashRGB[0]},${flashRGB[1]},${flashRGB[2]},0)`);
          target.globalAlpha = level;
          target.fillStyle = gradient;
          target.beginPath();
          target.arc(flash.x, flash.y, flash.r * 2.4, 0, Math.PI * 2);
          target.fill();
          target.globalAlpha = 1;
        }

        if (!isSceneTransition && time > nextComet) {
          spawnAmbientComet();
          nextComet = time + 6 + Math.random() * 6;
        }
        updateLab();
        comets = comets.filter((comet) => comet.life > 0);
        for (const comet of comets) {
          const prevX = comet.x;
          const prevY = comet.y;
          comet.x += comet.vx * labStep;
          comet.y += comet.vy * labStep;
          comet.vy += comet.curve;
          comet.life -= (comet.size > 2.4 ? 0.009 : 0.012) * labStep;
          if (sandboxActive) {
            // Capturado por un agujero: espiral hacia el horizonte, encogiéndose
            if (comet.labCaptured) {
              const cap = comet.labCaptured;
              const elapsed = time - cap.t0;
              const dx0 = comet.x - cap.x;
              const dy0 = comet.y - cap.y;
              const ang0 = Math.atan2(dy0, dx0);
              const rad0 = Math.hypot(dx0, dy0);
              const prevCapX = comet.x;
              const prevCapY = comet.y;
              // Rotación a velocidad angular constante mientras el radio decae:
              // espiral lenta y legible, sin vueltas frenéticas.
              const ang = ang0 + 3.6 * labStep;
              const rad = Math.max(9, rad0 - 78 * labStep);
              comet.x = cap.x + Math.cos(ang) * rad;
              comet.y = cap.y + Math.sin(ang) * rad;
              // La estela sigue la espiral: velocidad = delta real del frame
              comet.vx = (comet.x - prevCapX) / Math.max(0.0001, labStep);
              comet.vy = (comet.y - prevCapY) / Math.max(0.0001, labStep);
              comet.size = Math.max(0.4, comet.size * 0.92);
              comet.life = Math.max(comet.life, 0.9);
              const captureRGB: RGB = LAB_BLACKHOLE_V2 ? [255, 214, 160] : [186, 214, 255];
              if (sparkles.length < 150 && Math.random() < 0.5) {
                sparkles.push({
                  x: comet.x + (Math.random() - 0.5) * 6,
                  y: comet.y + (Math.random() - 0.5) * 6,
                  vx: (Math.random() - 0.5) * 1.4,
                  vy: (Math.random() - 0.5) * 1.4,
                  life: 0.4,
                  tint: 1,
                  size: 1,
                  grav: 0,
                  rgb: captureRGB,
                  layer: 'museum',
                });
              }
              if (rad <= 9.5 || elapsed > 0.8) {
                comet.labCaptured = null;
                comet.life = 0;
                flashes.push({ x: cap.x, y: cap.y, r: 4, alpha: 0.85, rgb: captureRGB, layer: 'museum' });
                waves.push({
                  x: cap.x,
                  y: cap.y,
                  r: 6,
                  alpha: 0.5,
                  grow: 2.4,
                  width: 1.2,
                  delay: 0,
                  rgb: captureRGB,
                  layer: 'museum',
                });
              }
            } else if (comet.labMirror) {
              if (comet.x < 14 && comet.vx < 0) {
                comet.vx *= -1;
                comet.x = 14;
              }
              if (comet.x > width - 14 && comet.vx > 0) {
                comet.vx *= -1;
                comet.x = width - 14;
              }
              if (comet.y < 14 && comet.vy < 0) {
                comet.vy *= -1;
                comet.y = 14;
              }
              if (comet.y > height - 14 && comet.vy > 0) {
                comet.vy *= -1;
                comet.y = height - 14;
              }
              comet.life = Math.max(comet.life, 0.85);
            }
            // Pozos de gravedad curvan cualquier cometa (los capturados no)
            if (!comet.labCaptured) {
              for (const well of labWells) {
                const dx = well.x - comet.x;
                const dy = well.y - comet.y;
                const d = Math.hypot(dx, dy) || 1;
                if (d > 520) continue;
                const f = well.strength * 0.1 * sandboxTimeScale * (140 / Math.max(70, d));
                comet.vx += (dx / d) * f;
                comet.vy += (dy / d) * f;
              }
            }
          }

          // Las constelaciones creadas por el visitante son superficies aurora:
          // cada tramo rebota una sola vez por proyectil y aumenta su potencia.
          if (
            comet.power !== undefined &&
            sketch &&
            sketch.layer === (comet.layer ?? 'museum') &&
            time - sketch.lastAdd < 6
          ) {
            const hitKeys = comet.hitSketchSegments ?? new Set<string>();
            comet.hitSketchSegments = hitKeys;
            const radius = 10 + comet.size;
            let best:
              | {
                  key: string;
                  segmentIndex: number | null;
                  x: number;
                  y: number;
                  t: number;
                  nx: number;
                  ny: number;
                }
              | null = null;
            if (sketch.nodes.length === 1 && comet.projectileKind !== 'rapid') {
              const node = sketch.nodes[0];
              const key = `${sketch.id}:node:0`;
              if (!hitKeys.has(key)) {
                const hit = sweptSegmentHit(
                  prevX,
                  prevY,
                  comet.x,
                  comet.y,
                  node.x,
                  node.y,
                  node.x,
                  node.y,
                  radius,
                );
                if (hit) best = { key, segmentIndex: null, ...hit };
              }
            } else {
              for (let index = 1; index < sketch.nodes.length; index += 1) {
                const key = `${sketch.id}:segment:${index - 1}`;
                if (hitKeys.has(key)) continue;
                const a = sketch.nodes[index - 1];
                const b = sketch.nodes[index];
                const hit = sweptSegmentHit(
                  prevX,
                  prevY,
                  comet.x,
                  comet.y,
                  a.x,
                  a.y,
                  b.x,
                  b.y,
                  radius,
                );
                if (hit && (!best || hit.t < best.t)) {
                  best = { key, segmentIndex: index - 1, ...hit };
                }
              }
            }
            if (best) {
              const hitLetterIds = comet.hitPlaygroundLetterIds ?? new Set<number>();
              const nearestLetterT =
                isPlayground && playgroundPhase === 'active'
                  ? playgroundTargets.reduce<number | null>((nearest, target) => {
                      if (target.destroyed || hitLetterIds.has(target.id)) return nearest;
                      const hitT = segmentRectEntry(
                        prevX,
                        prevY,
                        comet.x,
                        comet.y,
                        playgroundLetterRect(target),
                        7,
                      );
                      if (hitT === null) return nearest;
                      return nearest === null || hitT < nearest ? hitT : nearest;
                    }, null)
                  : null;
              const sketchHitsFirst = nearestLetterT === null || best.t < nearestLetterT;

              if (sketchHitsFirst && comet.projectileKind === 'rapid' && best.segmentIndex !== null) {
                hitKeys.add(best.key);
                comet.x = best.x;
                comet.y = best.y;
                comet.life = 0;
                chargeSketchSegment(best.segmentIndex, best.x, best.y);
              } else if (sketchHitsFirst && comet.projectileKind === 'charged') {
                hitKeys.add(best.key);
                const dot = comet.vx * best.nx + comet.vy * best.ny;
                let reflectedX = comet.vx - 2 * dot * best.nx;
                let reflectedY = comet.vy - 2 * dot * best.ny;
                const reflectedSpeed = Math.hypot(reflectedX, reflectedY) || 1;
                const boostedSpeed = Math.min(22 * vscale, reflectedSpeed * 1.08);
                reflectedX = (reflectedX / reflectedSpeed) * boostedSpeed;
                reflectedY = (reflectedY / reflectedSpeed) * boostedSpeed;
                comet.vx = reflectedX;
                comet.vy = reflectedY;
                comet.x = best.x + best.nx * (radius + 1);
                comet.y = best.y + best.ny * (radius + 1);
                comet.size = Math.min(5.8 * vscale, comet.size * 1.05 + 0.08);
                registerCometBounce(comet, best.x, best.y);
                if (sketch?.armed && (comet.launchPower ?? 0) >= 0.95) {
                  detonateConstellation(best.x, best.y, best.segmentIndex ?? 0, comet.layer ?? 'museum');
                }
                const layer = comet.layer ?? 'museum';
                const visualPower = comet.power ?? comet.launchPower ?? 0;
                flashes.push({ x: best.x, y: best.y, r: 4, alpha: 0.42 + visualPower * 0.3, layer });
                spawnSparkleBurst(best.x, best.y, 8, visualPower * 0.7, layer);
              }
            }
          }

          // En el playground la carga original fija el daño y los rebotes solo
          // amplían el presupuesto perforante. Los impactos se resuelven en el
          // orden real de entrada para que el daño sobrante pase a la siguiente.
          if (
            isPlayground &&
            playgroundPhase === 'active' &&
            comet.launchPower !== undefined &&
            comet.layer !== 'studio' &&
            playgroundTargets.length > 0 &&
            comet.life > 0
          ) {
            const hitIds = comet.hitPlaygroundLetterIds ?? new Set<number>();
            comet.hitPlaygroundLetterIds = hitIds;
            const hits = playgroundTargets
              .filter((target) => !target.destroyed && !hitIds.has(target.id))
              .map((target) => ({
                target,
                t: segmentRectEntry(prevX, prevY, comet.x, comet.y, playgroundLetterRect(target), 7),
              }))
              .filter((hit): hit is { target: PlaygroundLetter; t: number } => hit.t !== null)
              .sort((a, b) => a.t - b.t);

            let progressChanged = false;
            for (const hit of hits) {
              const totalBudget =
                comet.projectileKind === 'rapid'
                  ? PLAYGROUND_RAPID_DAMAGE
                  : playgroundDamageBudget(comet.launchPower, comet.bounceCount ?? 0);
              const remainingBudget = Math.max(0, totalBudget - (comet.damageSpent ?? 0));
              if (remainingBudget <= 0.001) {
                comet.life = 0;
                break;
              }

              hitIds.add(hit.target.id);
              const hitX = prevX + (comet.x - prevX) * hit.t;
              const hitY = prevY + (comet.y - prevY) * hit.t;
              const projectileAffinity = comet.projectileKind ?? 'charged';
              if (projectileAffinity !== hit.target.affinity) {
                comet.x = hitX;
                comet.y = hitY;
                comet.life = 0;
                spawnPlaygroundShieldImpact(hit.target, hitX, hitY);
                break;
              }

              const appliedDamage = Math.min(hit.target.hp, remainingBudget);
              hit.target.hp = Math.max(0, hit.target.hp - appliedDamage);
              comet.damageSpent =
                comet.projectileKind === 'rapid'
                  ? totalBudget
                  : (comet.damageSpent ?? 0) + appliedDamage;

              const impactSpeed = Math.hypot(comet.vx, comet.vy) || 1;
              const targetMotionFactor = hit.target.slowedUntil > time ? PLAYGROUND_SLOW_FACTOR : 1;
              const targetImpulse =
                comet.projectileKind === 'rapid'
                  ? 22 * targetMotionFactor * Math.max(0.72, vscale)
                  : Math.min(150, 58 + appliedDamage * 1.15) *
                    targetMotionFactor *
                    Math.max(0.72, vscale);
              hit.target.vx += (comet.vx / impactSpeed) * targetImpulse;
              hit.target.vy += (comet.vy / impactSpeed) * targetImpulse;
              hit.target.nextEvade = time + 0.5;
              const hitTint = affinityTint(hit.target.affinity);
              flashes.push({
                x: hitX,
                y: hitY,
                r: 4 + appliedDamage * 0.06,
                alpha: 0.45,
                rgb: hitTint,
                layer: 'museum',
              });
              spawnSparkleBurst(
                hitX,
                hitY,
                Math.round(7 + appliedDamage * 0.12),
                Math.min(1, appliedDamage / hit.target.maxHp),
                'museum',
                hitTint,
              );

              if (hit.target.hp <= 0.001) {
                hit.target.destroyed = true;
                hit.target.deathX = hitX;
                hit.target.deathY = hitY;
                hit.target.destroyedAt = time;
                progressChanged = true;
                bubbles.push({
                  x: hitX,
                  y: hitY,
                  r: 12,
                  alpha: 0.5,
                  age: 0,
                  tintT: hit.target.affinity === 'rapid' ? 0.3 : 0.62,
                  grow: 5.5,
                  layer: 'museum',
                });
                spawnSparkleBurst(hitX, hitY, 28, 1, 'museum', hitTint);
              }

              const unusedDamage = totalBudget - (comet.damageSpent ?? 0);
              if (unusedDamage <= 0.001) {
                comet.x = hitX;
                comet.y = hitY;
                comet.life = 0;
                break;
              }
            }

            if (progressChanged) {
              const destroyed = playgroundTargets.filter((target) => target.destroyed).length;
              if (destroyed === PLAYGROUND_WORD.length) {
                playgroundPhase = 'complete';
                clearCharge();
                clearSketch();
                rapidFireHeld = false;
                resetPulsarPet();
                comets.forEach((item) => {
                  if (item.launchPower !== undefined) item.life = 0;
                });
                waves.push({
                  x: width / 2,
                  y: height / 2,
                  r: 20,
                  alpha: 0.85,
                  delay: 0,
                  grow: 12,
                  width: 2.4,
                });
              }
              notifyPlaygroundProgress();
            }
          }

          // Un mismo proyectil puede atravesar y activar todas las letras de su
          // recorrido, pero nunca vuelve a golpear una letra ya registrada.
          if (
            comet.power !== undefined &&
            comet.layer !== 'studio' &&
            letterRects.length > 0 &&
            !playgroundRef.current
          ) {
            const hitIndices = comet.hitLetterIndices ?? new Set<number>();
            comet.hitLetterIndices = hitIndices;
            const hits: { index: number; x: number; y: number }[] = [];
            letterRects.forEach((rect, index) => {
              if (hitIndices.has(index)) return;
              const t = segmentRectEntry(prevX, prevY, comet.x, comet.y, rect, 8);
              if (t === null) return;
              hitIndices.add(index);
              hits.push({
                index,
                x: prevX + (comet.x - prevX) * t,
                y: prevY + (comet.y - prevY) * t,
              });
            });
            if (hits.length > 0) {
              window.dispatchEvent(
                new CustomEvent('mo-title-hit', {
                  detail: { hits, vx: comet.vx, vy: comet.vy, power: comet.power },
                }),
              );
            }

            // La palabra PLAYGROUND del hero también recibe impactos directos
            if (pgLetterRects.length > 0) {
              const pgHitIndices = comet.hitPgLetterIndices ?? new Set<number>();
              comet.hitPgLetterIndices = pgHitIndices;
              const pgHits: { index: number; x: number; y: number }[] = [];
              pgLetterRects.forEach((rect, index) => {
                if (pgHitIndices.has(index)) return;
                const t = segmentRectEntry(prevX, prevY, comet.x, comet.y, rect, 6);
                if (t === null) return;
                pgHitIndices.add(index);
                pgHits.push({
                  index,
                  x: prevX + (comet.x - prevX) * t,
                  y: prevY + (comet.y - prevY) * t,
                });
              });
              if (pgHits.length > 0) {
                window.dispatchEvent(
                  new CustomEvent('mo-pg-hit', {
                    detail: { hits: pgHits, vx: comet.vx, vy: comet.vy, power: comet.power },
                  }),
                );
              }
            }
          }

          // Fuera del hero, los proyectiles golpean bloques textuales completos.
          // Solo se miden los elementos cercanos al viewport y cada uno reacciona
          // una vez por proyectil, aunque varios se crucen en el mismo frame.
          if (
            comet.power !== undefined &&
            textRects.length > 0 &&
            !playgroundRef.current
          ) {
            const hitElements = comet.hitTextElements ?? new Set<HTMLElement>();
            comet.hitTextElements = hitElements;
            textRects.forEach((rect) => {
              if (hitElements.has(rect.element)) return;
              const t = segmentRectEntry(prevX, prevY, comet.x, comet.y, rect, 6);
              if (t === null) return;
              hitElements.add(rect.element);
              window.dispatchEvent(
                new CustomEvent('mo-page-text-hit', {
                  detail: {
                    element: rect.element,
                    x: prevX + (comet.x - prevX) * t,
                    y: prevY + (comet.y - prevY) * t,
                    vx: comet.vx,
                    vy: comet.vy,
                    power: comet.power,
                  },
                }),
              );
            });
          }

          // En una sala de estudio el muro es el panel real, no el viewport.
          if (
            comet.layer === 'studio' &&
            comet.power !== undefined &&
            comet.power >= 0.95 &&
            studioRect &&
            comet.life > 0
          ) {
            const hit = studioExit(prevX, prevY, comet.x, comet.y, studioRect);
            if (hit) spawnWallImpact(comet, hit.x, hit.y, hit.nx, hit.ny);
          }

          // Todo proyectil de catapulta fuera del estudio rebota una vez en los
          // laterales. La pared no altera el combo; el segundo choque lo destruye.
          if (
            comet.layer !== 'studio' &&
            comet.projectileKind === 'charged' &&
            comet.launchPower !== undefined &&
            comet.life > 0
          ) {
            const hitLeft = comet.vx < 0 && prevX >= 0 && comet.x <= 0;
            const hitRight = comet.vx > 0 && prevX <= width && comet.x >= width;
            if (hitLeft || hitRight) {
              const edgeX = hitLeft ? 0 : width;
              const travelX = comet.x - prevX;
              const t = Math.abs(travelX) < 1e-8 ? 0 : Math.max(0, Math.min(1, (edgeX - prevX) / travelX));
              const hitY = prevY + (comet.y - prevY) * t;
              const inward = hitLeft ? 1 : -1;
              if ((comet.lateralBounces ?? 0) === 0) {
                comet.lateralBounces = 1;
                comet.x = edgeX + inward * (comet.size + 3);
                comet.y = hitY;
                comet.vx = Math.abs(comet.vx) * inward;
                comet.tailAge = 0;
                flashes.push({ x: edgeX, y: hitY, r: 5, alpha: 0.52, layer: 'museum' });
                spawnSparkleBurst(edgeX + inward * 2, hitY, 10, comet.power ?? comet.launchPower);
              } else {
                spawnWallImpact(comet, edgeX + inward * 3, hitY, inward, 0);
              }
            } else if ((comet.lateralBounces ?? 0) >= 1) {
              // Tras un rebote lateral, cualquier otro borde (superior/inferior)
              // también detona la onda de choque y destruye el proyectil.
              const hitTop = comet.vy < 0 && prevY >= 0 && comet.y <= 0;
              const hitBottom = comet.vy > 0 && prevY <= height && comet.y >= height;
              if (hitTop || hitBottom) {
                const edgeY = hitTop ? 0 : height;
                const travelY = comet.y - prevY;
                const t = Math.abs(travelY) < 1e-8 ? 0 : Math.max(0, Math.min(1, (edgeY - prevY) / travelY));
                const hitX = prevX + (comet.x - prevX) * t;
                const inwardY = hitTop ? 1 : -1;
                spawnWallImpact(comet, hitX, edgeY + inwardY * 3, 0, inwardY);
              }
            }
          }

          if (
            !(sandboxActive && comet.labMirror) &&
            (comet.x < -140 || comet.x > width + 140 || comet.y < -140 || comet.y > height + 90)
          ) {
            comet.life = 0;
          }
          const fullTailFrames =
            comet.projectileKind === 'rapid'
              ? 3.4
              : 9 + comet.size * 4.5;
          const tailFrames =
            comet.tailAge === undefined
              ? fullTailFrames
              : Math.min(fullTailFrames, comet.tailAge);
          const visibleTailFrames = Math.max(0.12, tailFrames);
          const tailX = comet.x - comet.vx * visibleTailFrames;
          const tailY = comet.y - comet.vy * visibleTailFrames;
          const [tr, tg, tb] = comet.tintRGB ?? TINTS[comet.tint];
          const target = effectContext(comet.layer);
          if (!target) continue;
          const level = effectOpacity(comet.layer);
          const isEmber =
            EMBER_METEORITE_DESIGN &&
            comet.seed !== undefined &&
            comet.projectileKind === 'charged';
          if (isEmber) {
            // Brasa: esquirla poligonal irregular con grietas incandescentes,
            // estela corta y chispas de ceniza. El fragmento se deshace; no
            // compite con la cinta aurora del cometa madre (el cursor).
            const heat = comet.heat ?? 0;
            const emberTailFrames = visibleTailFrames * 0.45;
            const emberTailX = comet.x - comet.vx * emberTailFrames;
            const emberTailY = comet.y - comet.vy * emberTailFrames;
            const gradient = target.createLinearGradient(comet.x, comet.y, emberTailX, emberTailY);
            gradient.addColorStop(0, `rgba(${tr},${tg},${tb},${0.8 * comet.life * level})`);
            gradient.addColorStop(1, 'rgba(245,241,232,0)');
            target.strokeStyle = gradient;
            target.lineWidth = comet.size * 1.1;
            target.lineCap = 'round';
            target.beginPath();
            target.moveTo(comet.x, comet.y);
            target.lineTo(emberTailX, emberTailY);
            target.stroke();
            const haloR = comet.size * 4.2;
            const halo = target.createRadialGradient(comet.x, comet.y, 0, comet.x, comet.y, haloR);
            halo.addColorStop(0, `rgba(${tr},${tg},${tb},${(0.3 + heat * 0.22) * comet.life * level})`);
            halo.addColorStop(1, `rgba(${tr},${tg},${tb},0)`);
            target.fillStyle = halo;
            target.beginPath();
            target.arc(comet.x, comet.y, haloR, 0, Math.PI * 2);
            target.fill();

            comet.spinAngle = (comet.spinAngle ?? 0) + (comet.spin ?? 0);
            const shardR = comet.size * 2.1;
            target.save();
            target.translate(comet.x, comet.y);
            target.rotate(comet.spinAngle ?? 0);
            target.beginPath();
            for (let vertex = 0; vertex < 6; vertex += 1) {
              const angle = (vertex / 6) * Math.PI * 2;
              const wobble = 0.6 + 0.4 * emberWobble(comet.seed ?? 1, vertex);
              const px = Math.cos(angle) * shardR * wobble;
              const py = Math.sin(angle) * shardR * wobble;
              if (vertex === 0) target.moveTo(px, py);
              else target.lineTo(px, py);
            }
            target.closePath();
            // Cuerpo de roca cálida fija: la sal tiñe el fuego, no la piedra
            target.fillStyle = `rgba(98,54,30,${0.92 * comet.life * level})`;
            target.fill();
            target.strokeStyle = `rgba(${tr},${tg},${tb},${(0.5 + heat * 0.4) * comet.life * level})`;
            target.lineWidth = 1.1;
            target.stroke();
            // Grietas internas: arden con el color de la sal del fragmento
            const crackR = Math.round(tr * 0.5 + 128);
            const crackG = Math.round(tg * 0.5 + 112);
            const crackB = Math.round(tb * 0.5 + 85);
            target.strokeStyle = `rgba(${crackR},${crackG},${crackB},${((0.22 + heat * 0.6) * comet.life * level).toFixed(3)})`;
            target.lineWidth = 1;
            target.beginPath();
            target.moveTo(-shardR * 0.5, -shardR * 0.15);
            target.lineTo(0, 0);
            target.lineTo(shardR * 0.26, shardR * 0.5);
            target.moveTo(shardR * 0.46, -shardR * 0.42);
            target.lineTo(shardR * 0.04, shardR * 0.04);
            target.stroke();
            target.fillStyle = `rgba(255,232,190,${0.72 * comet.life * level})`;
            target.beginPath();
            target.arc(0, 0, comet.size * 0.55, 0, Math.PI * 2);
            target.fill();
            target.restore();

            // Chispas de ceniza que se desprenden en pleno vuelo
            if (sparkles.length < 150 && Math.random() < 0.4) {
              sparkles.push({
                x: comet.x + (Math.random() - 0.5) * 6,
                y: comet.y + (Math.random() - 0.5) * 6,
                vx: -comet.vx * 0.06 + (Math.random() - 0.5) * 0.5,
                vy: -comet.vy * 0.06 + (Math.random() - 0.5) * 0.5,
                life: 0.7,
                tint: 1,
                size: 0.8 + Math.random() * 1.2,
                grav: 0.03,
                rgb: comet.tintRGB,
                layer: comet.layer,
              });
            }
          } else {
            const gradient = target.createLinearGradient(comet.x, comet.y, tailX, tailY);
            gradient.addColorStop(0, `rgba(${tr},${tg},${tb},${0.95 * comet.life * level})`);
            gradient.addColorStop(1, 'rgba(245,241,232,0)');
            target.strokeStyle = gradient;
            target.lineWidth = comet.size * 1.6;
            target.lineCap = 'round';
            target.beginPath();
            target.moveTo(comet.x, comet.y);
            target.lineTo(tailX, tailY);
            target.stroke();
            target.fillStyle = `rgba(255,252,244,${comet.life * level})`;
            target.beginPath();
            target.arc(comet.x, comet.y, comet.size, 0, Math.PI * 2);
            target.fill();
            const [hr, hg, hb] = comet.tintRGB ?? [230, 204, 150];
            const halo = target.createRadialGradient(comet.x, comet.y, 0, comet.x, comet.y, comet.size * 7);
            halo.addColorStop(0, `rgba(${hr},${hg},${hb},${(comet.size > 2.4 ? 0.5 : 0.22) * comet.life * level})`);
            halo.addColorStop(1, `rgba(${hr},${hg},${hb},0)`);
            target.fillStyle = halo;
            target.beginPath();
            target.arc(comet.x, comet.y, comet.size * 7, 0, Math.PI * 2);
            target.fill();
          }
          if (comet.tailAge !== undefined && comet.tailAge < fullTailFrames) {
            comet.tailAge = Math.min(fullTailFrames, comet.tailAge + 1);
          }
        }

        // Pulsos de conducción: energía dorada viajando por la constelación
        conductions = conductions.filter((dot) => dot.life > 0);
        for (const dot of conductions) {
          dot.life -= dt;
          dot.x += dot.vx * dt;
          dot.y += dot.vy * dt;
          const lifeFrac = Math.max(0, dot.life / dot.maxLife);
          const target = effectContext(dot.layer);
          if (!target) continue;
          const level = effectOpacity(dot.layer);
          const glowR = 7 + 5 * (1 - lifeFrac);
          const grad = target.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, glowR);
          grad.addColorStop(0, `rgba(255,246,224,${(0.85 * lifeFrac * level).toFixed(3)})`);
          grad.addColorStop(0.4, `rgba(228,199,127,${(0.5 * lifeFrac * level).toFixed(3)})`);
          grad.addColorStop(1, 'rgba(228,199,127,0)');
          target.fillStyle = grad;
          target.beginPath();
          target.arc(dot.x, dot.y, glowR, 0, Math.PI * 2);
          target.fill();
        }

        // Burbujas de choque: disco semitransparente que nace de un color
        // aleatorio de la paleta y deriva suavizado hacia el extremo claro
        bubbles = bubbles.filter((b) => b.alpha > 0.02);
        for (const b of bubbles) {
          b.age += dt * labStep;
          b.r += (b.grow ?? 8.5) * labStep;
          b.alpha *= Math.pow(0.954, labStep);
          const drift = Math.min(0.97, b.tintT + b.age * 0.15);
          const col = sampleStops(AURORA, drift);
          const lite = mixRGB(col, [250, 244, 224], 0.35);
          const target = effectContext(b.layer);
          if (!target) continue;
          const level = effectOpacity(b.layer);
          const grad = target.createRadialGradient(b.x, b.y, b.r * 0.12, b.x, b.y, b.r);
          grad.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${(b.alpha * 0.14).toFixed(3)})`);
          grad.addColorStop(0.6, `rgba(${col[0]},${col[1]},${col[2]},${Math.min(1, b.alpha * 0.78).toFixed(3)})`);
          grad.addColorStop(0.86, `rgba(${lite[0]},${lite[1]},${lite[2]},${Math.min(1, b.alpha).toFixed(3)})`);
          grad.addColorStop(1, `rgba(${lite[0]},${lite[1]},${lite[2]},0)`);
          target.globalAlpha = level;
          target.fillStyle = grad;
          target.beginPath();
          target.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          target.fill();
          target.strokeStyle = `rgba(${lite[0]},${lite[1]},${lite[2]},${(b.alpha * 0.75).toFixed(3)})`;
          target.lineWidth = 1.6;
          target.beginPath();
          target.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          target.stroke();
          target.globalAlpha = 1;
        }

        waves = waves.filter((wave) => wave.alpha > 0.02);
        for (const wave of waves) {
          if (wave.delay > 0) {
            wave.delay -= dt;
            continue;
          }
          wave.r += wave.grow ?? 7;
          wave.alpha *= wave.decay ?? 0.94;
          if (wave.r <= 0) continue;
          const wBase = wave.width ?? 1.2;
          const target = effectContext(wave.layer);
          if (!target) continue;
          const level = effectOpacity(wave.layer);
          const waveRGB: RGB = wave.rgb ?? [201, 168, 106];
          const waveLite = mixRGB(waveRGB, [245, 235, 205], 0.72);
          // Doble trazo: halo cromático ancho + núcleo claro brillante.
          target.strokeStyle = `rgba(${waveRGB[0]},${waveRGB[1]},${waveRGB[2]},${(wave.alpha * 0.35 * level).toFixed(3)})`;
          target.lineWidth = wBase * 2.6;
          target.beginPath();
          target.arc(wave.x, wave.y, wave.r, 0, Math.PI * 2);
          target.stroke();
          target.strokeStyle = `rgba(${waveLite[0]},${waveLite[1]},${waveLite[2]},${Math.min(1, wave.alpha * 0.85 * level).toFixed(3)})`;
          target.lineWidth = wBase;
          target.beginPath();
          target.arc(wave.x, wave.y, wave.r, 0, Math.PI * 2);
          target.stroke();
        }

        comboLabels = comboLabels.filter((label) => label.life > 0.02);
        for (const label of comboLabels) {
          label.life *= 0.94;
          label.y -= 0.45;
          fxCtx.save();
          fxCtx.globalAlpha = Math.min(1, label.life * 1.4);
          fxCtx.textAlign = 'center';
          fxCtx.textBaseline = 'middle';
          fxCtx.font = '600 13px "JetBrains Mono Variable", monospace';
          fxCtx.fillStyle = '#f3dfac';
          fxCtx.shadowColor = 'rgba(201,168,106,0.85)';
          fxCtx.shadowBlur = 12;
          fxCtx.fillText(`×${label.multiplier}`, label.x, label.y - (1 - label.life) * 18);
          fxCtx.restore();
        }

        // Mascota del púlsar: pequeña orbita el cometa en un anillo que precesa;
        // al disparar se ancla donde esté y crece; al soltar vuelve volando.
        if ((isPlayground && playgroundPhase === 'active') || sandboxActive) {
          const pulse = 0.5 + 0.5 * Math.sin(time * 18);
          const core = pulsarPos();
          const scale = pulsarScale();
          const dim = pulsarPhase === 'firing' ? 1 : 0.78 + pulse * 0.16;

          if (pulsarPhase !== 'firing') {
            fxCtx.save();
            fxCtx.translate(pulsarOrbitX, pulsarOrbitY);
            fxCtx.rotate(pulsarRingAngle);
            fxCtx.setLineDash([3, 9]);
            fxCtx.strokeStyle = `rgba(142,224,255,${(0.11 + pulse * 0.05).toFixed(3)})`;
            fxCtx.lineWidth = 1;
            fxCtx.beginPath();
            fxCtx.ellipse(0, 0, PULSAR_ORBIT_RX * vscale, PULSAR_ORBIT_RY * vscale, 0, 0, Math.PI * 2);
            fxCtx.stroke();
            fxCtx.restore();
          }

          if (rapidFireReady) {
            const aimLen = Math.hypot(mouse.x - core.x, mouse.y - core.y);
            if (aimLen > 16) {
              const grad = fxCtx.createLinearGradient(core.x, core.y, mouse.x, mouse.y);
              grad.addColorStop(0, `rgba(142,224,255,${(0.2 + pulse * 0.08).toFixed(3)})`);
              grad.addColorStop(1, 'rgba(142,224,255,0)');
              fxCtx.strokeStyle = grad;
              fxCtx.lineWidth = 1;
              fxCtx.beginPath();
              fxCtx.moveTo(core.x, core.y);
              fxCtx.lineTo(mouse.x, mouse.y);
              fxCtx.stroke();
            }
          }

          fxCtx.save();
          fxCtx.globalAlpha = Math.min(1, 0.55 + 0.45 * scale);
          const halo = fxCtx.createRadialGradient(core.x, core.y, 0, core.x, core.y, (24 + pulse * 5) * scale);
          halo.addColorStop(0, `rgba(236,248,255,${((0.52 + pulse * 0.16) * dim).toFixed(3)})`);
          halo.addColorStop(0.35, `rgba(142,224,255,${((0.22 + pulse * 0.08) * dim).toFixed(3)})`);
          halo.addColorStop(1, 'rgba(96,214,255,0)');
          fxCtx.fillStyle = halo;
          fxCtx.beginPath();
          fxCtx.arc(core.x, core.y, 29 * scale, 0, Math.PI * 2);
          fxCtx.fill();
          fxCtx.strokeStyle = `rgba(236,248,255,${((0.58 + pulse * 0.28) * dim).toFixed(3)})`;
          fxCtx.lineWidth = 1.2;
          fxCtx.beginPath();
          fxCtx.arc(core.x, core.y, (7 + pulse * 2.2) * scale, 0, Math.PI * 2);
          fxCtx.stroke();
          fxCtx.restore();
        }

        // Resortera: anillo de carga + línea de mira + trayectoria proyectada
        if (charge) {
          const target = effectContext(charge.layer) ?? fxCtx;
          const level = effectOpacity(charge.layer);
          const p = Math.min(1, (time - charge.t0) / 1.1);
          const ringR = 24 + p * 12;
          const glow = 0.5 + 0.35 * p + (p >= 1 ? 0.15 * Math.sin(time * 9) : 0);
          target.strokeStyle = `rgba(230,204,158,${(glow * level).toFixed(3)})`;
          target.lineWidth = 2.4;
          target.lineCap = 'round';
          target.beginPath();
          target.arc(charge.x, charge.y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
          target.stroke();
          target.strokeStyle = `rgba(245,241,232,${(0.16 * level).toFixed(3)})`;
          target.lineWidth = 1;
          target.beginPath();
          target.arc(charge.x, charge.y, ringR, 0, Math.PI * 2);
          target.stroke();

          const pullX = charge.x - charge.dx;
          const pullY = charge.y - charge.dy;
          const pullDist = Math.hypot(pullX, pullY);

          if (pullDist >= 6) {
            // Línea de arrastre punteada (hacia atrás)
            target.setLineDash([5, 7]);
            target.strokeStyle = `rgba(245,241,232,${(0.4 * level).toFixed(3)})`;
            target.lineWidth = 1.4;
            target.beginPath();
            target.moveTo(charge.x, charge.y);
            target.lineTo(charge.dx, charge.dy);
            target.stroke();

            // Trayectoria proyectada del lanzamiento (sentido contrario). Si
            // se apunta a una constelación, la línea se extiende hasta el
            // primer segmento y anticipa el rebote con un reflejo sutil que
            // crece con la carga.
            const normP = pullDist || 1;
            const launchX = pullX / normP;
            const launchY = pullY / normP;
            let endLen = Math.min(260, (60 + pullDist * 1.5) * (0.45 + 0.55 * p));
            let bounce: { x: number; y: number; dirX: number; dirY: number } | null = null;
            const aimingSketch = sketch;
            if (
              aimingSketch &&
              aimingSketch.layer === charge.layer &&
              aimingSketch.nodes.length >= 2
            ) {
              const castLen = 640 * (0.45 + 0.55 * p);
              let bestT = Infinity;
              let bestIndex = -1;
              for (let i = 1; i < aimingSketch.nodes.length; i += 1) {
                const ax = aimingSketch.nodes[i - 1].x;
                const ay = aimingSketch.nodes[i - 1].y;
                const segX = aimingSketch.nodes[i].x - ax;
                const segY = aimingSketch.nodes[i].y - ay;
                const denom = launchX * segY - launchY * segX;
                if (Math.abs(denom) < 1e-6) continue;
                const offX = ax - charge.x;
                const offY = ay - charge.y;
                const t = (offX * segY - offY * segX) / denom;
                const u = (offX * launchY - offY * launchX) / denom;
                if (t <= 4 || t >= bestT || u < 0 || u > 1) continue;
                bestT = t;
                bestIndex = i;
              }
              if (bestIndex > 0 && bestT <= castLen) {
                endLen = bestT;
                const ax = aimingSketch.nodes[bestIndex - 1].x;
                const ay = aimingSketch.nodes[bestIndex - 1].y;
                const bx = aimingSketch.nodes[bestIndex].x;
                const by = aimingSketch.nodes[bestIndex].y;
                const segLen = Math.hypot(bx - ax, by - ay) || 1;
                const normalX = -(by - ay) / segLen;
                const normalY = (bx - ax) / segLen;
                const dot = launchX * normalX + launchY * normalY;
                bounce = {
                  x: charge.x + launchX * bestT,
                  y: charge.y + launchY * bestT,
                  dirX: launchX - 2 * dot * normalX,
                  dirY: launchY - 2 * dot * normalY,
                };
              }
            }

            target.setLineDash([]);
            const grad = target.createLinearGradient(
              charge.x,
              charge.y,
              charge.x + launchX * endLen,
              charge.y + launchY * endLen,
            );
            grad.addColorStop(0, `rgba(230,204,158,${(0.55 * level).toFixed(3)})`);
            grad.addColorStop(1, `rgba(230,204,158,${(bounce ? 0.2 : 0) * level})`);
            target.strokeStyle = grad;
            target.lineWidth = 2.2;
            target.beginPath();
            target.moveTo(charge.x, charge.y);
            target.lineTo(charge.x + launchX * endLen, charge.y + launchY * endLen);
            target.stroke();

            if (bounce) {
              const previewLen = 150;
              const bounceAlpha = (0.26 + 0.26 * p) * level;
              const bounceGrad = target.createLinearGradient(
                bounce.x,
                bounce.y,
                bounce.x + bounce.dirX * previewLen,
                bounce.y + bounce.dirY * previewLen,
              );
              bounceGrad.addColorStop(0, `rgba(230,204,158,${bounceAlpha.toFixed(3)})`);
              bounceGrad.addColorStop(1, 'rgba(230,204,158,0)');
              target.strokeStyle = bounceGrad;
              target.lineWidth = 1.8;
              target.beginPath();
              target.moveTo(bounce.x, bounce.y);
              target.lineTo(bounce.x + bounce.dirX * previewLen, bounce.y + bounce.dirY * previewLen);
              target.stroke();
              target.fillStyle = `rgba(245,241,232,${((0.3 + 0.25 * p) * level).toFixed(3)})`;
              target.beginPath();
              target.arc(bounce.x, bounce.y, 2.2, 0, Math.PI * 2);
              target.fill();
            }
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
                layer: charge.layer,
              });
            }
          }
          target.setLineDash([]);
        }

        // Constelación dibujada: líneas aurora entre nodos, se desvanece sola
        if (sketch && sketch.nodes.length > 0) {
          const fade = Math.max(0, Math.min(1, 1 - (time - sketch.lastAdd - 4.5) / 1.5));
          if (fade <= 0) {
            clearSketch();
          } else {
            const target = effectContext(sketch.layer) ?? fxCtx;
            const level = effectOpacity(sketch.layer);
            const flowS = sampleStops(AURORA, (time * 0.08) % 1);
            const flowSLite = mixRGB(flowS, [250, 244, 224], 0.6);
            target.save();
            target.lineCap = 'round';
            for (let i = 1; i < sketch.nodes.length; i += 1) {
              const a = sketch.nodes[i - 1];
              const b = sketch.nodes[i];
              const segmentIndex = i - 1;
              const chargeCount = sketch.segmentCharges[segmentIndex] ?? 0;
              const chargeLevel = Math.min(
                1,
                chargeCount / PLAYGROUND_SEGMENT_CHARGE_HITS,
              );
              const isCharged = sketch.chargedSegments.has(segmentIndex);
              const triggerAge = time - (sketch.segmentTriggeredAt[segmentIndex] ?? Number.NEGATIVE_INFINITY);
              const triggerPulse =
                triggerAge >= 0 && triggerAge <= 0.72
                  ? Math.sin((triggerAge / 0.72) * Math.PI)
                  : 0;
              const segmentGlow = Math.max(chargeLevel, triggerPulse);
              const segmentTint = isCharged ? PLAYGROUND_RAPID_TINT : flowS;
              const segmentLite = isCharged
                ? mixRGB(PLAYGROUND_RAPID_TINT, [255, 250, 238], 0.68)
                : flowSLite;
              target.shadowColor = isCharged
                ? `rgba(${PLAYGROUND_RAPID_TINT[0]},${PLAYGROUND_RAPID_TINT[1]},${PLAYGROUND_RAPID_TINT[2]},0.88)`
                : 'transparent';
              target.shadowBlur = isCharged ? 12 + triggerPulse * 12 : 0;
              target.strokeStyle = `rgba(${segmentTint[0]},${segmentTint[1]},${segmentTint[2]},${((0.4 + segmentGlow * 0.35) * fade * level).toFixed(3)})`;
              target.lineWidth = 3.6 + segmentGlow * 4.2;
              target.beginPath();
              target.moveTo(a.x, a.y);
              target.lineTo(b.x, b.y);
              target.stroke();
              target.shadowBlur = 0;
              target.strokeStyle = `rgba(${segmentLite[0]},${segmentLite[1]},${segmentLite[2]},${((0.85 + segmentGlow * 0.15) * fade * level).toFixed(3)})`;
              target.lineWidth = 1.4 + segmentGlow * 1.2;
              target.beginPath();
              target.moveTo(a.x, a.y);
              target.lineTo(b.x, b.y);
              target.stroke();

              if (chargeLevel > 0) {
                for (let marker = 0; marker < PLAYGROUND_SEGMENT_CHARGE_HITS; marker += 1) {
                  const markerProgress = (marker + 0.5) / PLAYGROUND_SEGMENT_CHARGE_HITS;
                  const markerX = a.x + (b.x - a.x) * markerProgress;
                  const markerY = a.y + (b.y - a.y) * markerProgress;
                  const filled = marker < chargeCount;
                  target.fillStyle = filled
                    ? `rgba(${segmentLite[0]},${segmentLite[1]},${segmentLite[2]},${(fade * level).toFixed(3)})`
                    : `rgba(${segmentTint[0]},${segmentTint[1]},${segmentTint[2]},${(0.18 * fade * level).toFixed(3)})`;
                  target.beginPath();
                  target.arc(markerX, markerY, filled ? 2.1 + triggerPulse : 1.25, 0, Math.PI * 2);
                  target.fill();
                }
              }
            }
            if (sketch.armed) {
              const armPulse = 0.55 + 0.45 * Math.sin(time * 6);
              target.shadowColor = 'rgba(228,199,127,0.9)';
              target.shadowBlur = 10 + armPulse * 10;
              target.strokeStyle = `rgba(228,199,127,${((0.28 + armPulse * 0.3) * fade * level).toFixed(3)})`;
              target.lineWidth = 1.6;
              target.beginPath();
              target.moveTo(sketch.nodes[0].x, sketch.nodes[0].y);
              for (let i = 1; i < sketch.nodes.length; i += 1) {
                target.lineTo(sketch.nodes[i].x, sketch.nodes[i].y);
              }
              target.stroke();
              target.shadowBlur = 0;
            }
            sketch.nodes.forEach((node, index) => {
              const twinkleN = 0.7 + 0.3 * Math.sin(time * 3 + index * 1.3);
              const adjacentCharged =
                sketch?.chargedSegments.has(index - 1) || sketch?.chargedSegments.has(index);
              const adjacentPulse = Math.max(
                0,
                ...[index - 1, index].map((segmentIndex) => {
                  const age = time - (sketch?.segmentTriggeredAt[segmentIndex] ?? Number.NEGATIVE_INFINITY);
                  return age >= 0 && age <= 0.72 ? Math.sin((age / 0.72) * Math.PI) : 0;
                }),
              );
              const nodeTint = adjacentCharged ? PLAYGROUND_RAPID_TINT : flowS;
              const nodeRadius = 11 + adjacentPulse * 9 + (adjacentCharged ? 3 : 0);
              const haloS = target.createRadialGradient(node.x, node.y, 0, node.x, node.y, nodeRadius);
              haloS.addColorStop(0, `rgba(${nodeTint[0]},${nodeTint[1]},${nodeTint[2]},${((0.5 + adjacentPulse * 0.4) * fade * twinkleN * level).toFixed(3)})`);
              haloS.addColorStop(1, `rgba(${nodeTint[0]},${nodeTint[1]},${nodeTint[2]},0)`);
              target.fillStyle = haloS;
              target.beginPath();
              target.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
              target.fill();
              target.fillStyle = `rgba(255,250,238,${(fade * level).toFixed(3)})`;
              target.beginPath();
              target.arc(node.x, node.y, 2.4, 0, Math.PI * 2);
              target.fill();
            });
            target.restore();
          }
        }
      }

      drawLab();

      if (sandboxActive && fxCtx) {
        fxCtx.save();
        fxCtx.font = '500 11px "JetBrains Mono Variable", monospace';
        fxCtx.textAlign = 'left';
        fxCtx.textBaseline = 'top';
        const hudLines = [
          `LAB · fps ${Math.round(labFps)} · cometas ${comets.length} · chispas ${sparkles.length} · tiempo ×${sandboxTimeScale.toFixed(2)}`,
          '1 agujero  2 anillo  3 iones  4 binaria  5 cadena  6 gusano  7 blancos  8 limpiar',
          'Q/E tiempo (dentro del lab) · WASD/flechas mover · ESC salir',
        ];
        hudLines.forEach((line, index) => {
          fxCtx.fillStyle = index === 0 ? 'rgba(143,208,255,0.75)' : 'rgba(245,241,232,0.45)';
          fxCtx.fillText(line, 18, 14 + index * 17);
        });
        fxCtx.restore();
      }
      if (sandboxChargeT0 !== null && !sandboxActive && fxCtx && mouse.x > -999) {
        const chargeP = Math.min(1, (time - sandboxChargeT0) / 2);
        fxCtx.save();
        fxCtx.strokeStyle = `rgba(143,208,255,${(0.45 + 0.35 * chargeP).toFixed(3)})`;
        fxCtx.lineWidth = 2.4;
        fxCtx.beginPath();
        fxCtx.arc(mouse.x, mouse.y, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeP);
        fxCtx.stroke();
        fxCtx.restore();
      }

      raf = requestAnimationFrame(frame);
    };

    syncTextTargets();
    resize();
    window.addEventListener('resize', resize);
    const DIR_KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      KeyW: 'up',
      KeyS: 'down',
      KeyA: 'left',
      KeyD: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (sandboxActive) {
        if (event.code === 'Escape') {
          exitSandbox();
          return;
        }
        if (event.code === 'Digit1') {
          labSpawnHole();
          return;
        }
        if (SANDBOX_CLASSIC_EXPERIMENTS && event.code === 'Digit2') {
          labSpawnSwarm();
          return;
        }
        if (event.code === 'Digit2') {
          labSpawnRing();
          return;
        }
        if (event.code === 'Digit3') {
          labSpawnIons();
          return;
        }
        if (SANDBOX_CLASSIC_EXPERIMENTS && event.code === 'Digit4') {
          labSpawnWell(event.shiftKey);
          return;
        }
        if (event.code === 'Digit4') {
          labSpawnBinary();
          return;
        }
        if (event.code === 'Digit5') {
          labSpawnChain();
          return;
        }
        if (SANDBOX_CLASSIC_EXPERIMENTS && event.code === 'Digit6') {
          labSpawnMirror();
          return;
        }
        if (event.code === 'Digit6') {
          labSpawnWormhole();
          return;
        }
        if (event.code === 'Digit7') {
          labSpawnDummies();
          return;
        }
        if (event.code === 'Digit8') {
          clearLab();
          return;
        }
        if (event.code === 'KeyQ') {
          sandboxTimeScale = Math.max(0.25, sandboxTimeScale / 1.25);
          return;
        }
        if (event.code === 'KeyE') {
          sandboxTimeScale = Math.min(2.5, sandboxTimeScale * 1.25);
          return;
        }
        // WASD/flechas/shift caen al pilotaje: el gate de cámara incluye el lab
      }
      if (
        event.code === 'Space' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        rapidFireAvailable &&
        ((playgroundRef.current && playgroundSceneRef.current === 'active') || sandboxActive) &&
        !isInteractiveControl(event.target)
      ) {
        event.preventDefault();
        if (playgroundRef.current && playgroundPhase !== 'active') return;
        if (event.repeat) return;
        if (pulsarPhase !== 'orbit') return;
        const anchor = pulsarOrbitPoint();
        pulsarAnchorX = anchor.x;
        pulsarAnchorY = anchor.y;
        pulsarPhase = 'firing';
        pulsarPhaseAt = time;
        nextRapidFireAt = time;
        rapidFireHeld = true;
        return;
      }
      if (
        scriptedWarp ||
        playgroundSceneRef.current === 'arriving' ||
        playgroundSceneRef.current === 'departing'
      ) {
        return;
      }
      if (event.key === 'Escape') {
        clearCharge();
        clearSketch();
        rapidFireHeld = false;
        resetPulsarPet();
        boostedWasdCodes.clear();
        lastWasdDown.clear();
        boostLatched = false;
        heldMovementCodes.clear();
        heldDirs.clear();
        shiftHeld = false;
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isKeyboardInput(event.target)) return;
      if (!event.repeat) {
        if (event.code === 'KeyQ') labQHeld = true;
        if (event.code === 'KeyE') labEHeld = true;
      }
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        shiftHeld = true;
        return;
      }
      const dir = DIR_KEYS[event.code];
      if (!dir) return;
      // Las flechas solo pilotan la cámara dentro del playground; fuera
      // conservan su comportamiento nativo de scroll
      if (event.code.startsWith('Arrow')) {
        if (!playgroundRef.current) return;
        event.preventDefault();
      }
      if (!event.repeat) {
        heldMovementCodes.add(event.code);
        heldDirs.add(dir);
        if (event.code.startsWith('Key')) {
          if (playgroundRef.current) {
            const now = performance.now();
            const previous = lastWasdDown.get(event.code) ?? -Infinity;
            if (now - previous <= 280) boostedWasdCodes.add(event.code);
            lastWasdDown.set(event.code, now);
          } else {
            lastWasdDown.delete(event.code);
          }
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'KeyQ') labQHeld = false;
      if (event.code === 'KeyE') labEHeld = false;
      if (event.code === 'Space') {
        if (
          rapidFireAvailable &&
          playgroundRef.current &&
          !isInteractiveControl(event.target)
        ) {
          event.preventDefault();
        }
        rapidFireHeld = false;
        if (pulsarPhase === 'firing') {
          const orbitPoint = pulsarOrbitPoint();
          const distance = Math.hypot(orbitPoint.x - pulsarAnchorX, orbitPoint.y - pulsarAnchorY);
          pulsarReturnDuration = Math.min(
            PULSAR_RETURN_MAX,
            Math.max(PULSAR_RETURN_MIN, distance / (PULSAR_RETURN_SPEED * Math.max(0.72, vscale))),
          );
          pulsarReturnStart = time;
          pulsarPhase = 'returning';
        }
        return;
      }
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        shiftHeld = event.shiftKey;
        return;
      }
      const dir = DIR_KEYS[event.code];
      if (!dir) return;
      heldMovementCodes.delete(event.code);
      boostedWasdCodes.delete(event.code);
      const sameDirectionHeld = Array.from(heldMovementCodes).some((code) => DIR_KEYS[code] === dir);
      if (!sameDirectionHeld) heldDirs.delete(dir);
    };
    const onWinBlur = () => {
      onUp();
      heldDirs.clear();
      heldMovementCodes.clear();
      boostedWasdCodes.clear();
      lastWasdDown.clear();
      boostLatched = false;
      rapidFireHeld = false;
      resetPulsarPet();
      shiftHeld = false;
    };
    const onSelectStart = (event: Event) => {
      if (charge) event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mo-warp', onWarp);

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onWinBlur);
    scrollEl?.addEventListener('scroll', onScroll, { passive: true });
    const structureObserver = new MutationObserver(() => {
      syncTextTargets();
      rectsDirty = true;
    });
    if (scrollEl) structureObserver.observe(scrollEl, { childList: true, subtree: true });
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('selectstart', onSelectStart);
    raf = requestAnimationFrame(frame);

    return () => {
      clearCharge();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mo-warp', onWarp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onWinBlur);
      scrollEl?.removeEventListener('scroll', onScroll);
      structureObserver.disconnect();
      textObserver.disconnect();
      visibleTextTargets.clear();
      observedTextTargets.clear();
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('selectstart', onSelectStart);
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
