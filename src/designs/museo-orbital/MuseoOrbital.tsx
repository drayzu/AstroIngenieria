import '@fontsource-variable/fraunces';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react';
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import { chapters, conceptById, plausibilityLabels, scaleLabels } from '../../data/astroData';
import type { AstroChapter, AstroConcept, SourceRef } from '../../types';
import { Grain } from '../shared/Grain';
import { useScrollLock } from '../shared/useScrollLock';
import { MuseumCursor } from './MuseumCursor';
import {
  PLAYGROUND_ARRIVAL_END_MS,
  PLAYGROUND_ARRIVAL_START_MS,
  PLAYGROUND_ENTER_MS,
  PLAYGROUND_ENTER_TRAVEL_SPEED,
  PLAYGROUND_LEAVE_MS,
  PLAYGROUND_MUSEUM_RETURN_START_MS,
} from './playgroundTiming';
import { StudioRoom } from './StudioRoom';
import { StarfieldCanvas, type PlaygroundProgress } from './StarfieldCanvas';
import { DistortOverlay } from './DistortOverlay';
import './museoOrbital.css';

const totalWorks = chapters.reduce((sum, chapter) => sum + chapter.concepts.length, 0);
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const VITRINE_CAP = 5;
const VITRINE_KEY = 'mo-vitrine';
const PLAYGROUND_WORD = 'ASTROINGENIERÍA';
const PLAYGROUND_TIMES_KEY = 'mo-playground-best-times-v1';
const PLAYGROUND_TIMES_CAP = 10;
const PLAYGROUND_HOLD_MS = 2_000;
const PG_TAIL_SEGMENTS = 16;
const pgTailColor = (f: number) => {
  const r = Math.round(158 + (255 - 158) * f);
  const g = Math.round(197 + (246 - 197) * f);
  const b = Math.round(255 + (227 - 255) * f);
  return `rgb(${r}, ${g}, ${b})`;
};
const PLAYGROUND_MUSIC_MUTED_KEY = 'mo-playground-music-muted-v1';
const PLAYGROUND_MUSIC_VOLUME = 0.35;
const PLAYGROUND_MUSIC_ENTER_FADE_MS = 2_000;
const PLAYGROUND_MUSIC_LEAVE_FADE_MS = 1_500;
const PLAYGROUND_MUSIC_TOGGLE_FADE_MS = 180;
const PLAYGROUND_MUSIC_TRACKS = [
  `${import.meta.env.BASE_URL}music/in-the-pool.mp3`,
  `${import.meta.env.BASE_URL}music/my-lady.mp3`,
];
const INITIAL_PLAYGROUND_PROGRESS: PlaygroundProgress = {
  destroyed: 0,
  total: PLAYGROUND_WORD.length,
  phase: 'active',
};

interface PlaygroundBestTime {
  id: string;
  durationMs: number;
  completedAt: string;
}

interface PlaygroundResult {
  id: string;
  durationMs: number;
}

type PlaygroundEntryState = 'idle' | 'charging' | 'entering' | 'leaving';

const resolveChapter = (concept: AstroConcept): AstroChapter =>
  chapters.find((chapter) => chapter.id === concept.chapterId) ?? chapters[0];

const conceptFromHash = (): AstroConcept | null => {
  const match = window.location.hash.match(/^#obra-(.+)$/);
  return match ? conceptById.get(match[1]) ?? null : null;
};

const loadVitrine = (): string[] => {
  try {
    const raw = window.localStorage.getItem(VITRINE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => conceptById.has(id)).slice(0, VITRINE_CAP) : [];
  } catch {
    return [];
  }
};

const scrollToId = (id: string) => {
  window.dispatchEvent(new CustomEvent('mo-warp'));
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const loadPlaygroundBestTimes = (): PlaygroundBestTime[] => {
  try {
    const raw = window.localStorage.getItem(PLAYGROUND_TIMES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is PlaygroundBestTime => {
        if (!entry || typeof entry !== 'object') return false;
        const candidate = entry as Partial<PlaygroundBestTime>;
        return (
          typeof candidate.id === 'string' &&
          typeof candidate.durationMs === 'number' &&
          Number.isFinite(candidate.durationMs) &&
          candidate.durationMs > 0 &&
          typeof candidate.completedAt === 'string'
        );
      })
      .sort((a, b) => a.durationMs - b.durationMs)
      .slice(0, PLAYGROUND_TIMES_CAP);
  } catch {
    return [];
  }
};

const loadPlaygroundMusicMuted = () => {
  try {
    return window.localStorage.getItem(PLAYGROUND_MUSIC_MUTED_KEY) === 'true';
  } catch {
    return false;
  }
};

const formatPlaygroundElapsed = (durationMs: number) => {
  const totalSeconds = Math.floor(Math.max(0, durationMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const formatPlaygroundTime = (durationMs: number) => {
  const totalTenths = Math.floor(Math.max(0, durationMs) / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
};

interface PageTextHitDetail {
  element: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  power: number;
}

interface TextPhysicsState {
  element: HTMLElement;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  vx: number;
  vy: number;
  vr: number;
  vs: number;
  originalTranslate: string;
  originalRotate: string;
  originalScale: string;
  originalWillChange: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const usePageTextPhysics = (disabled: boolean) => {
  useEffect(() => {
    if (disabled) return;

    const states = new Map<HTMLElement, TextPhysicsState>();
    let raf = 0;
    let previousTime = 0;

    const restoreInlineStyles = (state: TextPhysicsState) => {
      const { style } = state.element;
      const restore = (property: string, value: string) => {
        if (value) style.setProperty(property, value);
        else style.removeProperty(property);
      };
      restore('translate', state.originalTranslate);
      restore('rotate', state.originalRotate);
      restore('scale', state.originalScale);
      restore('will-change', state.originalWillChange);
    };

    const loop = (now: number) => {
      const dt = previousTime > 0 ? Math.min(0.032, Math.max(0.008, (now - previousTime) / 1000)) : 0.016;
      previousTime = now;

      states.forEach((state, element) => {
        if (!element.isConnected) {
          restoreInlineStyles(state);
          states.delete(element);
          return;
        }

        state.vx += (-105 * state.x - 11 * state.vx) * dt;
        state.vy += (-105 * state.y - 11 * state.vy) * dt;
        state.vr += (-115 * state.rotation - 11.5 * state.vr) * dt;
        state.vs += (-145 * state.scale - 14 * state.vs) * dt;
        state.x = clamp(state.x + state.vx * dt, -90, 90);
        state.y = clamp(state.y + state.vy * dt, -90, 90);
        state.rotation = clamp(state.rotation + state.vr * dt, -0.122, 0.122);
        state.scale = clamp(state.scale + state.vs * dt, -0.15, 0.18);

        const settled =
          Math.abs(state.x) < 0.04 &&
          Math.abs(state.y) < 0.04 &&
          Math.abs(state.rotation) < 0.0005 &&
          Math.abs(state.scale) < 0.0005 &&
          Math.abs(state.vx) < 0.08 &&
          Math.abs(state.vy) < 0.08 &&
          Math.abs(state.vr) < 0.002 &&
          Math.abs(state.vs) < 0.002;

        if (settled) {
          restoreInlineStyles(state);
          states.delete(element);
          return;
        }

        element.style.setProperty('translate', `${state.x.toFixed(2)}px ${state.y.toFixed(2)}px`);
        element.style.setProperty('rotate', `${state.rotation.toFixed(4)}rad`);
        element.style.setProperty('scale', (1 + state.scale).toFixed(3));
      });

      if (states.size > 0) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
        previousTime = 0;
      }
    };

    const onPageTextHit = (event: Event) => {
      const detail = (event as CustomEvent<PageTextHitDetail>).detail;
      const element = detail?.element;
      if (!element?.isConnected || element.closest('.mo-hero, .mo-marquee, .mo-halls, .mo-menu, .mo-rail')) {
        return;
      }
      const speed = Math.hypot(detail.vx, detail.vy);
      if (speed < 0.5) return;

      let state = states.get(element);
      if (!state) {
        state = {
          element,
          x: 0,
          y: 0,
          rotation: 0,
          scale: 0,
          vx: 0,
          vy: 0,
          vr: 0,
          vs: 0,
          originalTranslate: element.style.getPropertyValue('translate'),
          originalRotate: element.style.getPropertyValue('rotate'),
          originalScale: element.style.getPropertyValue('scale'),
          originalWillChange: element.style.getPropertyValue('will-change'),
        };
        states.set(element, state);
        element.style.setProperty('will-change', 'transform');
      }

      const dirX = detail.vx / speed;
      const dirY = detail.vy / speed;
      const jitter = (Math.random() - 0.5) * 0.36;
      const impulseX = dirX * Math.cos(jitter) - dirY * Math.sin(jitter);
      const impulseY = dirX * Math.sin(jitter) + dirY * Math.cos(jitter);
      const strength =
        Math.min(230, (300 + speed * 10) * 0.55) *
        (0.75 + clamp(detail.power, 0, 1) * 0.25) *
        (0.85 + Math.random() * 0.3);
      state.vx += impulseX * strength;
      state.vy += impulseY * strength;

      const rect = element.getBoundingClientRect();
      const rx = (detail.x - (rect.left + rect.width / 2)) / Math.max(1, rect.width / 2);
      const ry = (detail.y - (rect.top + rect.height / 2)) / Math.max(1, rect.height / 2);
      const torque = clamp(rx * dirY - ry * dirX, -1, 1);
      state.vr += torque * (1.8 + detail.power * 1.4) + (Math.random() - 0.5) * 0.25;
      state.vs -= 0.75 + detail.power * 0.55;

      if (!raf) raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mo-page-text-hit', onPageTextHit);
    return () => {
      window.removeEventListener('mo-page-text-hit', onPageTextHit);
      if (raf) cancelAnimationFrame(raf);
      states.forEach(restoreInlineStyles);
      states.clear();
    };
  }, [disabled]);
};

/* ---------------- Contador animado ---------------- */

const Counter = ({ to }: { to: number }) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 650;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <b className="mo-counter">{value}</b>;
};

/* ---------------- Hero con título magnético ---------------- */

interface HeroProps {
  heroRef: RefObject<HTMLElement | null>;
  onOpenIndex: () => void;
  onOpenPlayground: () => void;
  onPlaygroundArm: () => void;
  playgroundHoldProgress: number;
  playgroundEntryState: PlaygroundEntryState;
}

const Hero = memo(({
  heroRef,
  onOpenIndex,
  onOpenPlayground,
  onPlaygroundArm,
  playgroundHoldProgress,
  playgroundEntryState,
}: HeroProps) => {
  const reduced = useReducedMotion();
  const letters = useMemo(() => 'ASTROINGENIERÍA'.split(''), []);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const boxRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const pgRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const pgButtonRef = useRef<HTMLButtonElement | null>(null);
  const pgCometRef = useRef<HTMLElement | null>(null);
  const pgHeadRef = useRef<HTMLElement | null>(null);
  const pgTailRefs = useRef<(HTMLElement | null)[]>([]);
  const pgFlashRef = useRef<HTMLElement | null>(null);
  const kickerRef = useRef<HTMLParagraphElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduced || !window.matchMedia('(pointer: fine)').matches) return;

    const mouse = { x: -9999, y: -9999 };
    const motion2d = { x: -9999, y: -9999, t: 0, speed: 0 };
    const states = letters.map(() => ({
      w: 520,
      lw: -1,
      ix: 0,
      iy: 0,
      ir: 0,
      ivx: 0,
      ivy: 0,
      ivr: 0,
      is: 0,
      ivs: 0,
    }));
    const personas = letters.map(() => ({
      k: 0.85 + Math.random() * 0.3,
      c: 0.85 + Math.random() * 0.3,
    }));
    // Textos del hero que tambien reciben impactos (bloques completos)
    const extras: {
      el: HTMLElement | null;
      x: number;
      y: number;
      r: number;
      vx: number;
      vy: number;
      vr: number;
    }[] = [
      { el: kickerRef.current, x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0 },
      { el: subRef.current, x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0 },
      { el: hintRef.current, x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0 },
    ];
    const glint = { index: -1, t0: 0 };
    let raf = 0;
    let clock = 0;
    let prevT = 0;
    // Fuera del viewport el bucle se detiene por completo: todo lo que anima
    // (letras, palabra PLAYGROUND, cometa) vive dentro del hero.
    let heroVisible = true;

    // Física propia de la palabra PLAYGROUND: muelles por letra que reaccionan
    // a impactos de cometas y ondas de choque (eventos mo-pg-hit del canvas).
    const pgStates = 'PLAYGROUND'.split('').map(() => ({
      x: 0,
      y: 0,
      r: 0,
      s: 0,
      vx: 0,
      vy: 0,
      vr: 0,
      vs: 0,
    }));
    type CometMode = 'away' | 'enter' | 'orbit' | 'sweep' | 'nudge' | 'dive' | 'exit';
    const comet = {
      mode: 'away' as CometMode,
      t: 0,
      dur: 1.8 + Math.random() * 1.0,
      x: 0,
      y: 0,
      sx: 0,
      sy: 0,
      cx: 0,
      cy: 0,
      tx: 0,
      ty: 0,
      theta: 0,
      dir: 1,
      ox: 0,
      oy: 0,
      rx: 0,
      ry: 0,
      target: 0,
      pushes: 0,
      lunging: false,
      nextPushAt: 0,
      hoverX: 0,
      hoverY: 0,
      visible: false,
    };
    const trail: { x: number; y: number }[] = [];
    const fireFlash = (x: number, y: number) => {
      const flash = pgFlashRef.current;
      if (!flash) return;
      flash.classList.remove('is-on');
      void flash.offsetWidth;
      flash.style.left = `${x.toFixed(1)}px`;
      flash.style.top = `${y.toFixed(1)}px`;
      flash.classList.add('is-on');
    };
    const wordMetrics = () => {
      const btn = pgButtonRef.current;
      const first = pgRefs.current[0];
      const last = pgRefs.current[pgRefs.current.length - 1];
      if (!btn || !first || !last) return null;
      const br = btn.getBoundingClientRect();
      const fr = first.getBoundingClientRect();
      const lr = last.getBoundingClientRect();
      const left = fr.left - br.left;
      const right = lr.right - br.left;
      const midY = (fr.top + fr.bottom) / 2 - br.top;
      return { br, left, right, midY, cx: (left + right) / 2, width: right - left };
    };
    const letterCenter = (index: number) => {
      const el = pgRefs.current[index];
      const btn = pgButtonRef.current;
      const st = pgStates[index];
      if (!el || !btn || !st) return null;
      const br = btn.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - br.left - st.x,
        y: r.top + r.height / 2 - br.top - st.y,
      };
    };
    const setCometMode = (mode: CometMode, dur: number) => {
      comet.mode = mode;
      comet.t = 0;
      comet.dur = dur;
    };
    const BEHAVIORS: CometMode[] = ['orbit', 'sweep', 'nudge', 'dive'];
    let behaviorDeck: CometMode[] = [];
    let lastBehavior: CometMode | null = null;
    // Mazo barajado: garantiza que las 4 animaciones salgan antes de repetir
    // y que dos consecutivas nunca sean iguales (contraste máximo).
    const reshuffleDeck = () => {
      const arr = [...BEHAVIORS];
      for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      if (lastBehavior && arr[0] === lastBehavior) {
        const j = 1 + Math.floor(Math.random() * (arr.length - 1));
        [arr[0], arr[j]] = [arr[j], arr[0]];
      }
      behaviorDeck = arr;
    };
    const nextBehavior = (): CometMode => {
      if (behaviorDeck.length === 0) reshuffleDeck();
      const b = behaviorDeck.shift();
      if (!b) return 'orbit';
      lastBehavior = b;
      return b;
    };
    // Punto de entrada aleatorio alrededor de todo el perímetro del botón.
    const entryPoint = (m: { br: DOMRect; midY: number }) => {
      const w = m.br.width;
      const h = m.br.height;
      const margin = 70;
      const side = Math.floor(Math.random() * 4);
      if (side === 0) return { x: w * (0.15 + Math.random() * 0.7), y: -margin };
      if (side === 1) return { x: w + margin, y: m.midY + (Math.random() - 0.5) * h * 0.7 };
      if (side === 2) return { x: w * (0.15 + Math.random() * 0.7), y: h + margin };
      return { x: -margin, y: m.midY + (Math.random() - 0.5) * h * 0.7 };
    };
    const pickBehavior = () => {
      const m = wordMetrics();
      if (!m) {
        setCometMode('away', 4 + Math.random() * 3);
        return;
      }
      const behavior = nextBehavior();
      if (behavior === 'orbit') {
        comet.sx = comet.x;
        comet.sy = comet.y;
        comet.ox = m.cx;
        comet.oy = m.midY;
        comet.rx = m.width / 2 + 26;
        comet.ry = 24 + Math.random() * 10;
        comet.dir = Math.random() < 0.5 ? 1 : -1;
        comet.theta = Math.atan2(comet.y - comet.oy, comet.x - comet.ox);
        setCometMode('orbit', 4 + Math.random() * 1.5);
      } else if (behavior === 'sweep') {
        comet.dir = Math.random() < 0.5 ? 1 : -1;
        comet.sx = comet.x;
        comet.sy = comet.y;
        comet.cx = comet.dir === 1 ? m.left - 46 : m.right + 46;
        comet.cy = m.midY + (Math.random() - 0.5) * 6;
        comet.tx = comet.dir === 1 ? m.right + 46 : m.left - 46;
        comet.ty = m.midY + (Math.random() - 0.5) * 6;
        setCometMode('sweep', 1.15);
      } else if (behavior === 'nudge') {
        comet.target = Math.floor(Math.random() * pgStates.length);
        comet.pushes = 0;
        comet.lunging = false;
        comet.nextPushAt = 0.55;
        comet.dir = Math.random() < 0.5 ? 1 : -1;
        setCometMode('nudge', 3.4);
      } else {
        comet.target = Math.floor(Math.random() * pgStates.length);
        const lc = letterCenter(comet.target);
        if (!lc) {
          setCometMode('away', 4 + Math.random() * 3);
          return;
        }
        comet.sx = comet.x;
        comet.sy = comet.y;
        comet.cx = lc.x;
        comet.cy = lc.y - 64;
        setCometMode('dive', 1.0);
      }
    };
    const startExit = () => {
      const m = wordMetrics();
      const width = m ? m.br.width : 460;
      comet.sx = comet.x;
      comet.sy = comet.y;
      // Continuamos la dirección de vuelo actual en vez de un salto forzado:
      // la salida prolonga la trayectoria que ya traía el cometa.
      let hx = 0;
      let hy = 0;
      const n = trail.length;
      if (n >= 6) {
        hx = trail[n - 1].x - trail[n - 6].x;
        hy = trail[n - 1].y - trail[n - 6].y;
      }
      const hlen = Math.hypot(hx, hy);
      if (hlen < 2) {
        // Estaba casi quieto (p. ej. tras un nudge): salimos hacia el lado más
        // cercano, alejándonos del centro de la palabra.
        const cx = m ? m.cx : width / 2;
        hx = comet.x < cx ? -1 : 1;
        hy = -0.35;
      } else {
        hx /= hlen;
        hy /= hlen;
      }
      const dist = 260;
      comet.tx = comet.x + hx * dist;
      comet.ty = comet.y + hy * dist;
      // Curva suave: el punto de control se desvía un poco en perpendicular
      const drift = (Math.random() - 0.5) * 46;
      comet.cx = comet.x + hx * dist * 0.5 - hy * drift;
      comet.cy = comet.y + hy * dist * 0.5 + hx * drift;
      setCometMode('exit', 0.7);
    };

    // Impacto de proyectiles de la resortera sobre las letras del título:
    // cada caja atravesada recibe su propio impulso una sola vez por proyectil.
    const onTitleHit = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          hits: { index: number; x: number; y: number }[];
          vx: number;
          vy: number;
          power: number;
          extras?: boolean;
        }>
      ).detail;
      if (!detail?.hits.length) return;
      const speed = Math.hypot(detail.vx, detail.vy);
      if (speed < 0.5) return;
      const dirX = detail.vx / speed;
      const dirY = detail.vy / speed;
      detail.hits.forEach((hit) => {
        const index = hit.index;
        const el = boxRefs.current[index];
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const state = states[index];
        if (!state) return;
        const kick = Math.min(420, (300 + speed * 10) * (0.75 + detail.power * 0.25));
        // Jitter explosivo: cada letra recibe el golpe desviado al azar y con
        // magnitud propia, para que la hilera estalle en direcciones distintas
        const jitterAng = (Math.random() - 0.5) * 0.7;
        const magMul = 0.75 + Math.random() * 0.6;
        state.ivx += (dirX * Math.cos(jitterAng) - dirY * Math.sin(jitterAng)) * kick * magMul;
        state.ivy += (dirX * Math.sin(jitterAng) + dirY * Math.cos(jitterAng)) * kick * magMul;
        // Golpe de escala: pulso de tamano que respira y se asienta
        state.ivs += 2.4;
        const d = Math.hypot(cx - hit.x, cy - hit.y) || 1;
        const cross = dirX * ((cy - hit.y) / d) - dirY * ((cx - hit.x) / d);
        state.ivr += cross * 3.5;
      });
      // Bloques de texto (kicker, subtitulo, hints): empujon contenido. Los
      // eventos por letra de la onda de choque marcan extras: false salvo el
      // mas cercano, para no multiplicar el golpe.
      if (detail.extras === false) return;
      for (const ex of extras) {
        const el = ex.el;
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const nearest = detail.hits
          .map((hit) => {
            const dxr = Math.max(rect.left - hit.x, 0, hit.x - rect.right);
            const dyr = Math.max(rect.top - hit.y, 0, hit.y - rect.bottom);
            return { hit, d: Math.hypot(dxr, dyr) };
          })
          .sort((a, b) => a.d - b.d)[0];
        if (!nearest) continue;
        const { hit, d } = nearest;
        const radiusX = 240;
        if (d > radiusX) continue;
        const cxr = rect.left + rect.width / 2;
        const cyr = rect.top + rect.height / 2;
        const f = Math.pow(1 - d / radiusX, 1.5);
        const kick = Math.min(120, (300 + speed * 10) * 0.45 * f);
        ex.vx += dirX * kick;
        ex.vy += dirY * kick;
        const cross = dirX * ((cyr - hit.y) / (d || 1)) - dirY * ((cxr - hit.x) / (d || 1));
        ex.vr += Math.max(-0.05, Math.min(0.05, cross * 0.9 * f));
      }
    };
    window.addEventListener('mo-title-hit', onTitleHit);

    const onPgHit = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          hits: { index: number; x: number; y: number }[];
          vx: number;
          vy: number;
          power: number;
        }>
      ).detail;
      if (!detail?.hits.length) return;
      const speed = Math.hypot(detail.vx, detail.vy);
      if (speed < 0.5) return;
      const dirX = detail.vx / speed;
      const dirY = detail.vy / speed;
      detail.hits.forEach((hit) => {
        const el = pgRefs.current[hit.index];
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const state = pgStates[hit.index];
        if (!state) return;
        // Un poco más contenido que el título: letras pequeñas, golpe seco
        const kick = Math.min(260, (300 + speed * 10) * (0.7 + detail.power * 0.3)) * 0.72;
        const jitterAng = (Math.random() - 0.5) * 0.7;
        const magMul = 0.75 + Math.random() * 0.6;
        state.vx += (dirX * Math.cos(jitterAng) - dirY * Math.sin(jitterAng)) * kick * magMul;
        state.vy += (dirY * Math.sin(jitterAng) + dirX * Math.cos(jitterAng)) * kick * magMul;
        state.vs += 1.5;
        const d = Math.hypot(cx - hit.x, cy - hit.y) || 1;
        const cross = dirX * ((cy - hit.y) / d) - dirY * ((cx - hit.x) / d);
        state.vr += cross * 2.4;
      });
    };
    window.addEventListener('mo-pg-hit', onPgHit);

    const onMove = (event: MouseEvent) => {
      const now = performance.now();
      if (motion2d.t > 0) {
        const dt = Math.max(8, now - motion2d.t);
        const inst = (Math.hypot(event.clientX - motion2d.x, event.clientY - motion2d.y) / dt) * 1000;
        motion2d.speed = motion2d.speed * 0.7 + inst * 0.3;
      }
      motion2d.x = event.clientX;
      motion2d.y = event.clientY;
      motion2d.t = now;
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    const loop = (now: number) => {
      if (!heroVisible) {
        raf = 0;
        return;
      }
      const dt = prevT > 0 ? Math.min(0.032, Math.max(0.008, (now - prevT) / 1000)) : 0.016;
      prevT = now;
      // Lerp independiente del framerate para suavizados por-frame
      const lerpK = (k: number) => 1 - Math.pow(1 - k, dt * 60);
      clock += dt;
      if (clock - glint.t0 > 4.4) {
        glint.index = Math.floor(Math.random() * letters.length);
        glint.t0 = clock;
      }
      const glintP = (clock - glint.t0) / 0.85;
      if (performance.now() - motion2d.t > 90) motion2d.speed *= Math.pow(0.9, dt * 60);
      const speedFactor = Math.min(1, motion2d.speed / 1000);
      const radius = 190 + speedFactor * 70;
      const push = 1 + speedFactor * 1.6;

      const targets = letters.map((_, index) => {
        const box = boxRefs.current[index];
        const state = states[index];
        if (!box || !state) return { x: 0, y: 0 };
        const rect = box.getBoundingClientRect();
        const cx = rect.left + rect.width / 2 - state.ix;
        const cy = rect.top + rect.height / 2 - state.iy;
        const dx = cx - mouse.x;
        const dy = cy - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= radius) return { x: 0, y: 0 };
        const force = 1 - dist / radius;
        const eased = force * force * (3 - 2 * force);
        const tx = (dx / (dist || 1)) * eased * 11 * push;
        let ty = (dy / (dist || 1)) * eased * 8.5 * push;
        if (index === glint.index && glintP < 1) {
          ty -= Math.sin(Math.PI * glintP) * 7;
        }
        return {
          x: Math.max(-14, Math.min(14, tx)),
          y: Math.max(-11, Math.min(11, ty)),
        };
      });

      letterRefs.current.forEach((el, index) => {
        if (!el) return;
        const state = states[index];
        const persona = personas[index];
        const target = targets[index];
        if (!state || !persona || !target) return;

        const leftX = states[index - 1]?.ix ?? 0;
        const rightX = states[index + 1]?.ix ?? 0;
        const leftY = states[index - 1]?.iy ?? 0;
        const rightY = states[index + 1]?.iy ?? 0;
        const k = 95 * persona.k;
        const c = 5.8 * persona.c;
        state.ivx += (k * (target.x - state.ix) + 14 * (leftX + rightX - 2 * state.ix) - c * state.ivx) * dt;
        state.ivy += (k * (target.y - state.iy) + 14 * (leftY + rightY - 2 * state.iy) - c * state.ivy) * dt;
        const targetR = Math.max(-0.05, Math.min(0.05, state.ivx * 0.0003));
        state.ivr += (140 * (targetR - state.ir) - 7 * state.ivr) * dt;
        state.ivs += (-170 * state.is - 8.5 * state.ivs) * dt;
        state.ix += state.ivx * dt;
        state.iy += state.ivy * dt;
        state.ir += state.ivr * dt;
        state.is += state.ivs * dt;

        const dispMag = Math.hypot(state.ix, state.iy);
        let targetW = 520 + Math.min(1, dispMag / 9) * 165;
        if (index === glint.index && glintP < 1) {
          targetW += Math.sin(Math.PI * glintP) * 190;
        }
        state.w += (targetW - state.w) * lerpK(0.12);
        const weight = Math.round(state.w);
        if (weight !== state.lw) {
          state.lw = weight;
          el.style.fontVariationSettings = `'opsz' 144, 'wght' ${weight}`;
        }

        const box = boxRefs.current[index];
        if (box) {
          const scl = Math.max(0.55, Math.min(1.45, 1 + state.is));
          if (
            Math.abs(state.ix) > 0.05 ||
            Math.abs(state.iy) > 0.05 ||
            Math.abs(state.ir) > 0.003 ||
            Math.abs(state.is) > 0.002
          ) {
            box.style.transform = `translate(${state.ix.toFixed(2)}px, ${state.iy.toFixed(2)}px) rotate(${state.ir.toFixed(3)}rad) scale(${scl.toFixed(3)})`;
          } else if (box.style.transform) {
            box.style.transform = '';
            state.ix = 0;
            state.iy = 0;
            state.ir = 0;
            state.ivx = 0;
            state.ivy = 0;
            state.ivr = 0;
            state.is = 0;
            state.ivs = 0;
          }
        }
      });

      // Muelles propios para los bloques de texto golpeados
      for (const ex of extras) {
        const el = ex.el;
        if (!el) continue;
        ex.vx += (-110 * ex.x - 7 * ex.vx) * dt;
        ex.vy += (-110 * ex.y - 7 * ex.vy) * dt;
        ex.vr += (-110 * ex.r - 7 * ex.vr) * dt;
        ex.x += ex.vx * dt;
        ex.y += ex.vy * dt;
        ex.r += ex.vr * dt;
        if (Math.abs(ex.x) > 0.08 || Math.abs(ex.y) > 0.08 || Math.abs(ex.r) > 0.004) {
          el.style.transform = `translate(${ex.x.toFixed(2)}px, ${ex.y.toFixed(2)}px) rotate(${ex.r.toFixed(4)}rad)`;
        } else if (el.style.transform) {
          el.style.transform = '';
          ex.x = 0;
          ex.y = 0;
          ex.r = 0;
          ex.vx = 0;
          ex.vy = 0;
          ex.vr = 0;
        }
      }

      // Cometa juguetón: protagonista ambiental que orbita, barre, juguetea
      // y se lanza en picada sobre la palabra
      comet.t += dt;
      const cometEl = pgCometRef.current;
      const cp = Math.min(1, comet.t / comet.dur);
      if (comet.mode === 'away') {
        if (comet.t >= comet.dur && !document.hidden) {
          const m = wordMetrics();
          if (m) {
            const sp = entryPoint(m);
            comet.sx = sp.x;
            comet.sy = sp.y;
            comet.tx = m.cx + (Math.random() - 0.5) * m.width * 0.5;
            comet.ty = m.midY - 18 - Math.random() * 26;
            const dx = comet.tx - comet.sx;
            const dy = comet.ty - comet.sy;
            const dlen = Math.hypot(dx, dy) || 1;
            const bend = (Math.random() - 0.5) * 90;
            comet.cx = (comet.sx + comet.tx) / 2 + (-dy / dlen) * bend;
            comet.cy = (comet.sy + comet.ty) / 2 + (dx / dlen) * bend;
            comet.x = comet.sx;
            comet.y = comet.sy;
            comet.visible = true;
            if (cometEl) cometEl.style.opacity = '0';
            setCometMode('enter', 0.6);
          }
        }
      } else if (comet.mode === 'enter') {
        const e = cp * cp;
        const u = 1 - e;
        comet.x = u * u * comet.sx + 2 * u * e * comet.cx + e * e * comet.tx;
        comet.y = u * u * comet.sy + 2 * u * e * comet.cy + e * e * comet.ty;
        if (cometEl) cometEl.style.opacity = Math.min(1, cp * 1.8).toFixed(3);
        if (cp >= 1) pickBehavior();
      } else if (comet.mode === 'orbit') {
        comet.theta += comet.dir * 2.3 * (1 + 0.45 * Math.cos(comet.theta)) * dt;
        const ex = comet.ox + Math.cos(comet.theta) * comet.rx;
        const ey = comet.oy + Math.sin(comet.theta) * comet.ry;
        const blend = Math.min(1, comet.t / 0.35);
        comet.x = comet.sx + (ex - comet.sx) * blend;
        comet.y = comet.sy + (ey - comet.sy) * blend;
        if (comet.t >= comet.dur) startExit();
      } else if (comet.mode === 'sweep') {
        const approach = 0.3 / comet.dur;
        if (cp < approach) {
          const q = cp / approach;
          const e = q * q;
          comet.x = comet.sx + (comet.cx - comet.sx) * e;
          comet.y = comet.sy + (comet.cy - comet.sy) * e;
        } else {
          const q = (cp - approach) / (1 - approach);
          comet.x = comet.cx + (comet.tx - comet.cx) * q;
          comet.y = comet.cy + (comet.ty - comet.cy) * q + Math.sin(q * Math.PI * 2.5) * 3.5;
        }
        if (cp >= 1) startExit();
      } else if (comet.mode === 'nudge') {
        const lc = letterCenter(comet.target);
        if (!lc) {
          startExit();
        } else {
          const st = pgStates[comet.target];
          const glyphX = lc.x + st.x;
          const glyphY = lc.y + st.y;
          const downPush = comet.pushes === 1;
          const contactX = downPush ? glyphX : glyphX + comet.dir * 4;
          const contactY = downPush ? glyphY - 5 : glyphY - 2;
          if (comet.lunging) {
            comet.x += (contactX - comet.x) * lerpK(0.5);
            comet.y += (contactY - comet.y) * lerpK(0.5);
            if (Math.hypot(comet.x - contactX, comet.y - contactY) < 2) {
              if (downPush) {
                st.vy += 190;
                st.vx += (Math.random() - 0.5) * 40;
              } else {
                const dx = glyphX - comet.x;
                const dy = glyphY - comet.y;
                const d = Math.hypot(dx, dy) || 1;
                st.vx += (dx / d) * 150;
                st.vy += (dy / d) * 150;
              }
              st.vs += 0.9;
              st.vr += (Math.random() - 0.5) * 1.8;
              comet.pushes += 1;
              comet.lunging = false;
              comet.nextPushAt = comet.t + 0.7;
            }
          } else {
            comet.hoverX = glyphX + comet.dir * 18;
            comet.hoverY = glyphY - 16;
            comet.x += (comet.hoverX - comet.x) * lerpK(0.12);
            comet.y += (comet.hoverY - comet.y) * lerpK(0.12);
            if (comet.t >= comet.nextPushAt) {
              if (comet.pushes < 3) {
                comet.lunging = true;
              } else {
                startExit();
              }
            }
          }
          if (comet.t >= comet.dur) startExit();
        }
      } else if (comet.mode === 'dive') {
        const lc = letterCenter(comet.target);
        if (!lc) {
          startExit();
        } else if (comet.t < 0.45) {
          const q = comet.t / 0.45;
          const e = 1 - Math.pow(1 - q, 2);
          comet.x = comet.sx + (comet.cx - comet.sx) * e;
          comet.y = comet.sy + (comet.cy - comet.sy) * e;
        } else if (comet.t < 0.7) {
          comet.x = comet.cx + Math.sin(comet.t * 30) * 1.5;
          comet.y = comet.cy + Math.cos(comet.t * 24) * 1.2;
        } else {
          const q = Math.min(1, (comet.t - 0.7) / 0.3);
          const e = q * q;
          comet.x = comet.cx + (lc.x - comet.cx) * e;
          comet.y = comet.cy + (lc.y - comet.cy) * e;
          if (q >= 1) {
            const st = pgStates[comet.target];
            const dx = lc.x - comet.cx;
            const dy = lc.y - comet.cy;
            const d = Math.hypot(dx, dy) || 1;
            st.vx += (dx / d) * 230;
            st.vy += (dy / d) * 230;
            st.vs += 1.6;
            st.vr += (Math.random() - 0.5) * 2.8;
            for (const neighbor of [comet.target - 1, comet.target + 1]) {
              const ns = pgStates[neighbor];
              if (ns) {
                ns.vx += (dx / d) * 80;
                ns.vy += (dy / d) * 80;
              }
            }
            fireFlash(lc.x, lc.y);
            startExit();
          }
        }
      } else if (comet.mode === 'exit') {
        const e = cp * cp;
        const u = 1 - e;
        comet.x = u * u * comet.sx + 2 * u * e * comet.cx + e * e * comet.tx;
        comet.y = u * u * comet.sy + 2 * u * e * comet.cy + e * e * comet.ty;
        if (cometEl) cometEl.style.opacity = Math.max(0, 1 - cp * 1.15).toFixed(3);
        if (cp >= 1) {
          comet.visible = false;
          if (cometEl) cometEl.style.opacity = '0';
          setCometMode('away', 2.5 + Math.random() * 2.5);
        }
      }
      if (comet.visible) {
        trail.push({ x: comet.x, y: comet.y });
        if (trail.length > 40) trail.shift();
      } else if (trail.length > 0) {
        trail.length = 0;
      }
      const headEl = pgHeadRef.current;
      if (headEl) {
        headEl.style.transform = `translate(${comet.x.toFixed(1)}px, ${comet.y.toFixed(1)}px) translate(-50%, -50%)`;
      }
      for (let k = 0; k < PG_TAIL_SEGMENTS; k += 1) {
        const seg = pgTailRefs.current[k];
        if (!seg) continue;
        const a = trail[trail.length - 1 - k * 2];
        const b = trail[trail.length - 1 - (k * 2 + 2)];
        if (!a || !b) {
          seg.style.opacity = '0';
          continue;
        }
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.5) {
          seg.style.opacity = '0';
          continue;
        }
        const angle = Math.atan2(dy, dx);
        const f = 1 - (k + 1) / (PG_TAIL_SEGMENTS + 1);
        seg.style.opacity = (0.5 * f).toFixed(3);
        seg.style.width = `${dist.toFixed(1)}px`;
        seg.style.height = `${(1 + 3 * f).toFixed(2)}px`;
        seg.style.transform = `translate(${midX.toFixed(1)}px, ${midY.toFixed(1)}px) translate(-50%, -50%) rotate(${angle.toFixed(3)}rad)`;
      }

      const btnRect = pgButtonRef.current ? pgButtonRef.current.getBoundingClientRect() : null;
      const cometActive = btnRect !== null && comet.visible && comet.mode !== 'away' && comet.mode !== 'exit';
      const cometVX = btnRect ? btnRect.left + comet.x : 0;
      const cometVY = btnRect ? btnRect.top + comet.y : 0;

      // Letras de PLAYGROUND: subamortiguado como las cajas del título,
      // con evasión del cursor y del cometa
      pgStates.forEach((state, index) => {
        const el = pgRefs.current[index];
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2 - state.x;
        const cy = rect.top + rect.height / 2 - state.y;

        if (mouse.x > -999) {
          const dx = cx - mouse.x;
          const dy = cy - mouse.y;
          const dist = Math.hypot(dx, dy);
          const pgRadius = 130;
          if (dist < pgRadius) {
            const proximity = 1 - dist / pgRadius;
            const response = Math.pow(proximity, 1.4);
            state.vx += (dx / (dist || 1)) * 950 * response * dt;
            state.vy += (dy / (dist || 1)) * 950 * response * dt;
          }
        }

        if (cometActive) {
          const dx = cx - cometVX;
          const dy = cy - cometVY;
          const dist = Math.hypot(dx, dy);
          const cometRadius = 90;
          if (dist < cometRadius) {
            const response = Math.pow(1 - dist / cometRadius, 1.3);
            state.vx += (dx / (dist || 1)) * 2200 * response * dt;
            state.vy += (dy / (dist || 1)) * 2200 * response * dt;
          }
        }

        state.vx += (-150 * state.x - 7.5 * state.vx) * dt;
        state.vy += (-150 * state.y - 7.5 * state.vy) * dt;
        state.vr += (-150 * state.r - 7.5 * state.vr) * dt;
        state.vs += (-180 * state.s - 8.5 * state.vs) * dt;
        state.x += state.vx * dt;
        state.y += state.vy * dt;
        state.r += state.vr * dt;
        state.s += state.vs * dt;
        const scl = Math.max(0.6, Math.min(1.4, 1 + state.s));
        if (
          Math.abs(state.x) > 0.06 ||
          Math.abs(state.y) > 0.06 ||
          Math.abs(state.r) > 0.003 ||
          Math.abs(state.s) > 0.002
        ) {
          el.style.transform = `translate(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px) rotate(${state.r.toFixed(3)}rad) scale(${scl.toFixed(3)})`;
        } else if (el.style.transform) {
          el.style.transform = '';
        }
      });
      raf = requestAnimationFrame(loop);
    };

    const heroEl = heroRef.current;
    let heroObserver: IntersectionObserver | null = null;
    if (heroEl) {
      heroObserver = new IntersectionObserver((entries) => {
        const visible = entries[0]?.isIntersecting ?? true;
        if (visible === heroVisible) return;
        heroVisible = visible;
        if (visible) {
          if (!raf) raf = requestAnimationFrame(loop);
        } else if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      });
      heroObserver.observe(heroEl);
    }

    raf = requestAnimationFrame(loop);
    return () => {
      heroObserver?.disconnect();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mo-title-hit', onTitleHit);
      window.removeEventListener('mo-pg-hit', onPgHit);
      pgRefs.current.forEach((el) => {
        if (el) el.style.transform = '';
      });
      if (pgCometRef.current) {
        pgCometRef.current.style.opacity = '0';
      }
      if (pgHeadRef.current) {
        pgHeadRef.current.style.transform = '';
      }
      pgTailRefs.current.forEach((el) => {
        if (el) {
          el.style.opacity = '0';
          el.style.transform = '';
        }
      });
      if (pgFlashRef.current) {
        pgFlashRef.current.classList.remove('is-on');
      }
      cancelAnimationFrame(raf);
    };
  }, [reduced, letters]);

  const trackSpotlight = (event: ReactMouseEvent<HTMLElement>) => {
    if (reduced) return;
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    target.style.setProperty('--sx', `${event.clientX - rect.left}px`);
    target.style.setProperty('--sy', `${event.clientY - rect.top}px`);
    // Parallax sutil del cielo de fondo
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    target.style.setProperty('--hbx', `${(-px * 14).toFixed(1)}px`);
    target.style.setProperty('--hby', `${(-py * 10).toFixed(1)}px`);
  };

  return (
    <section ref={heroRef} className="mo-hero mo-layer" onMouseMove={trackSpotlight}>
      <button
        type="button"
        className="mo-index-button mo-hero-index"
        onClick={onOpenIndex}
        data-cursor-label="Índice"
      >
        Índice
      </button>
      <motion.div
        className="mo-hero-bg"
        style={{ backgroundImage: `url(${chapters[1].visual?.heroImage})` }}
        initial={{ scale: 1.22, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.9 }}
        transition={{ duration: reduced ? 0 : 3, ease: EASE_OUT }}
      />
      <div className="mo-hero-scrim" />
      <div className="mo-hero-spot" aria-hidden="true" />

      <motion.button
        type="button"
        ref={pgButtonRef}
        className={`mo-hero-playground is-${playgroundEntryState}`}
        onClick={onOpenPlayground}
        onPointerEnter={onPlaygroundArm}
        data-cursor-label="Entrar"
        aria-label="Entrar al Playground"
        disabled={playgroundEntryState === 'entering' || playgroundEntryState === 'leaving'}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduced ? 0 : 1.05, duration: reduced ? 0 : 0.9, ease: EASE_OUT }}
      >
          <span className="mo-hero-playground-word" aria-hidden="true">
            {'PLAYGROUND'.split('').map((letter, index) => (
              <span
                key={`${letter}-${index}`}
                className="mo-pg-letter"
                style={{ '--i': index } as CSSProperties}
                ref={(el) => {
                  pgRefs.current[index] = el;
                }}
              >
                {letter}
              </span>
            ))}
          </span>
        <span className="mo-hero-playground-charge" aria-hidden="true">
          <i style={{ transform: `scaleX(${playgroundHoldProgress})` }} />
        </span>
        <span ref={pgCometRef} className="mo-pg-comet" aria-hidden="true">
          <i ref={pgHeadRef} className="mo-pg-comet-head" />
          {Array.from({ length: PG_TAIL_SEGMENTS }, (_, index) => (
            <i
              key={index}
              ref={(el) => {
                pgTailRefs.current[index] = el;
              }}
              className="mo-pg-comet-tail"
              style={{
                background: pgTailColor(1 - (index + 1) / (PG_TAIL_SEGMENTS + 1)),
                boxShadow: `0 0 6px ${pgTailColor(1 - (index + 1) / (PG_TAIL_SEGMENTS + 1))}`,
              }}
            />
          ))}
          <i ref={pgFlashRef} className="mo-pg-comet-flash" />
        </span>
      </motion.button>

      <div className="mo-hero-copy">
        <motion.p
          ref={kickerRef}
          className="mo-kicker"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 0.5, duration: 0.9, ease: EASE_OUT }}
        >
          Exposición permanente — Atlas de astroingeniería
        </motion.p>

        <h1 className="mo-hero-title" aria-label="Astroingeniería">
          {letters.map((letter, index) => (
            <span
              className="mo-hero-letterbox"
              key={`${letter}-${index}`}
              aria-hidden="true"
              ref={(el) => {
                boxRefs.current[index] = el;
              }}
            >
              <span className="mo-hero-hover">
                <motion.span
                  className="mo-hero-letter"
                  ref={(el) => {
                    letterRefs.current[index] = el;
                  }}
                  initial={{ y: '180%' }}
                  animate={{ y: '0%' }}
                  transition={{
                    delay: reduced ? 0 : 0.55 + index * 0.038,
                    duration: 1.25,
                    ease: EASE_OUT,
                  }}
                >
                  {letter}
                </motion.span>
              </span>
            </span>
          ))}
        </h1>

        <motion.div
          className="mo-hero-rule"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: reduced ? 0 : 1.4, duration: 1.6, ease: EASE_OUT }}
        />

        <motion.p
          ref={subRef}
          className="mo-hero-sub"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 1.6, duration: 1, ease: EASE_OUT }}
        >
          Nueve salas convertidas en <Counter to={chapters.length} /> puertas. <Counter to={totalWorks} /> obras
          esperando. Un recorrido desde la primera estación orbital hasta civilizaciones capaces
          de mover estrellas.
        </motion.p>

        <motion.button
          type="button"
          className="mo-hero-cta mo-orbital"
          data-cursor-label="Descender"
          onClick={() => scrollToId('sala-intro')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduced ? 0 : 2.1, duration: 1 }}
        >
          <i className="mo-orbit a" aria-hidden="true" />
          <i className="mo-orbit b" aria-hidden="true" />
          Descender a la Sala 00
          <span aria-hidden="true">↓</span>
        </motion.button>

        <motion.span
          ref={hintRef}
          className="mo-sky-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduced ? 0 : 2.8, duration: 1 }}
        >
          <span className="mo-sky-action">
            <kbd className="mo-sky-key is-pulse">clic mantenido</kbd>
            <span>supernova</span>
          </span>
          <i className="mo-sky-sep" aria-hidden="true" />
          <span className="mo-sky-action">
            <kbd className="mo-sky-key is-pulse is-delayed">clic + arrastre</kbd>
            <span>cometa</span>
          </span>
          <i className="mo-sky-sep" aria-hidden="true" />
          <span className="mo-sky-action">
            <kbd className="mo-sky-key is-pulse">shift + clic</kbd>
            <span>constelación</span>
          </span>
        </motion.span>
      </div>
    </section>
  );
});

const Marquee = memo(() => {
  const phrase = `COLECCIÓN PERMANENTE · ${chapters.length} SALAS · ${totalWorks} OBRAS · ENTRADA LIBRE · `;
  return (
    <div className="mo-marquee mo-layer" aria-hidden="true">
      <div className="mo-marquee-track">
        <span>{phrase.repeat(3)}</span>
        <span>{phrase.repeat(3)}</span>
      </div>
    </div>
  );
});

/* ---------------- Índice de salas ---------------- */

const HallIndex = memo(({ activeId }: { activeId: string | null }) => (
  <nav className="mo-halls mo-layer" aria-label="Salas de la exposición">
    {chapters.map((chapter) => (
      <button
        key={chapter.id}
        type="button"
        className={`mo-hall-chip${activeId === chapter.id ? ' is-active' : ''}`}
        style={{ '--accent': chapter.color } as CSSProperties}
        onClick={() => scrollToId(`sala-${chapter.id}`)}
      >
        <b>{chapter.number}</b>
        {chapter.title}
      </button>
    ))}
    <button type="button" className="mo-hall-chip is-extra" onClick={() => scrollToId('vitrina')}>
      <b>✦</b>
      Vitrina
    </button>
    <button type="button" className="mo-hall-chip is-extra" onClick={() => scrollToId('archivo')}>
      <b>§</b>
      Archivo
    </button>
  </nav>
));

/* ---------------- Número monumental que se rellena ---------------- */

const SalaNo = ({
  value,
  progress,
  reduced,
}: {
  value: string;
  progress: MotionValue<number>;
  reduced: boolean;
}) => {
  const clip = useTransform(
    progress,
    [0.02, 0.6],
    ['inset(100% 0% 0% 0%)', 'inset(-15% -15% -15% -15%)'],
  );
  return (
    <span className="mo-sala-no" aria-hidden="true">
      <span className="mo-sala-no-outline">{value}</span>
      {reduced ? (
        <span className="mo-sala-no-fill">{value}</span>
      ) : (
        <motion.span className="mo-sala-no-fill" style={{ clipPath: clip }}>
          {value}
        </motion.span>
      )}
    </span>
  );
};

/* ---------------- Reveals por palabras ---------------- */

const RevealWords = ({ text }: { text: string }) => {
  const reduced = useReducedMotion();
  const words = useMemo(() => text.split(' '), [text]);
  // La visibilidad se observa sobre el CONTENEDOR: las palabras viven dentro
  // de cajas con overflow:hidden que las recortan al 114%, y un observer
  // sobre la palabra recortada nunca llegaría a dispararse.
  const containerRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(containerRef, { once: true, margin: '-40px' });
  const shown = Boolean(inView) || Boolean(reduced);
  return (
    <span className="mo-words" ref={containerRef}>
      {words.map((word, index) => (
        <span className="mo-word-box" key={`${word}-${index}`}>
          <motion.span
            className="mo-word"
            initial={{ y: '114%' }}
            animate={{ y: shown ? '0%' : '114%' }}
            transition={{ delay: shown ? index * 0.055 : 0, duration: 0.85, ease: EASE_OUT }}
          >
            {word}
            {index < words.length - 1 ? '\u00A0' : ''}
          </motion.span>
        </span>
      ))}
    </span>
  );
};

/* ---------------- Obra del muro ---------------- */

const Obra = memo(({
  concept,
  plate,
  featured,
  enableFlight,
  onSelect,
}: {
  concept: AstroConcept;
  plate: number;
  featured: boolean;
  enableFlight: boolean;
  onSelect: (concept: AstroConcept) => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const tilt = (event: ReactMouseEvent<HTMLElement>) => {
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    target.style.setProperty('--rx', `${(-py * 4.5).toFixed(2)}deg`);
    target.style.setProperty('--ry', `${(px * 5.5).toFixed(2)}deg`);
    imgRef.current?.style.setProperty('translate', `${(-px * 10).toFixed(1)}px, ${(-py * 10).toFixed(1)}px`);
  };
  const untilt = (event: ReactMouseEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--rx', '0deg');
    event.currentTarget.style.setProperty('--ry', '0deg');
    imgRef.current?.style.setProperty('translate', '0px, 0px');
  };

  return (
    <motion.article
      className={`mo-obra${featured ? ' is-featured' : ''}`}
      initial={{ opacity: 0, y: 60, rotateZ: plate % 2 === 0 ? -1.1 : 1.1 }}
      whileInView={{ opacity: 1, y: 0, rotateZ: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 1, ease: EASE_OUT }}
    >
      <button
        type="button"
        className="mo-obra-hit"
        data-cursor-label="Abrir sala de estudio"
        onMouseMove={tilt}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={(event) => {
          untilt(event);
          setHovered(false);
        }}
        onClick={() => onSelect(concept)}
      >
        <figure className="mo-frame">
          <div className="mo-frame-mask">
            <motion.img
              ref={imgRef}
              layoutId={enableFlight ? `obra-${concept.id}` : undefined}
              src={concept.illustration.src}
              alt={concept.illustration.alt}
              loading="lazy"
              decoding="async"
            />
            {featured && <DistortOverlay imageRef={imgRef} active={hovered} />}
          </div>
          <span className="mo-frame-glow" aria-hidden="true" />
        </figure>
        <div className="mo-obra-meta">
          <span className="mo-plate">
            N.º {String(plate).padStart(2, '0')}
            {concept.model3d ? ' · maqueta' : ''}
          </span>
          <h3>{concept.title}</h3>
          <p>
            {concept.category} · {scaleLabels[concept.scale]} ·{' '}
            {plausibilityLabels[concept.plausibility]}
          </p>
          <span className="mo-obra-cta">Entrar a la sala de estudio →</span>
        </div>
      </button>
    </motion.article>
  );
});

/* ---------------- Sala ---------------- */

const Sala = memo(({
  chapter,
  offset,
  enableFlight,
  onSelect,
}: {
  chapter: AstroChapter;
  offset: number;
  enableFlight: boolean;
  onSelect: (concept: AstroConcept) => void;
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const figureRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: fillProgress } = useScroll({
    target: sectionRef,
    offset: ['start 90%', 'start 32%'],
  });
  const { scrollYProgress: figureProgress } = useScroll({
    target: figureRef,
    offset: ['start end', 'end start'],
  });
  const imageY = useTransform(figureProgress, [0, 1], ['-9%', '9%']);
  const reduced = useReducedMotion();

  return (
    <section
      id={`sala-${chapter.id}`}
      className="mo-sala mo-layer"
      ref={sectionRef}
      style={{ '--accent': chapter.color } as CSSProperties}
    >
      <header className="mo-sala-head">
        <SalaNo value={chapter.number} progress={fillProgress} reduced={Boolean(reduced)} />
        <div className="mo-sala-copy">
          <p className="mo-kicker">
            Sala {chapter.number} — {chapter.concepts.length} piezas
          </p>
          <h2>
            <RevealWords text={chapter.title} />
          </h2>
          <p className="mo-lede">{chapter.summary}</p>
          {chapter.sections.map((section) => (
            <details key={section.title} className="mo-sala-note">
              <summary>{section.title}</summary>
              <p>{section.body}</p>
            </details>
          ))}
        </div>
        <figure className="mo-sala-figure">
          <div ref={figureRef} className="mo-sala-figure-inner">
            <motion.img
              src={chapter.visual?.heroImage}
              alt={chapter.visual?.visualFocus ?? chapter.title}
              loading="lazy"
              decoding="async"
              style={reduced ? undefined : { y: imageY }}
            />
          </div>
          <figcaption>{chapter.visual?.visualFocus}</figcaption>
        </figure>
      </header>

      <div className="mo-wall">
        {chapter.concepts.map((concept, conceptIndex) => (
          <Obra
            key={concept.id}
            concept={concept}
            plate={offset + conceptIndex + 1}
            featured={conceptIndex % 5 === 0}
            enableFlight={enableFlight}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
});

/* ---------------- Vitrina de contrastes ---------------- */

const Vitrina = memo(({
  ids,
  onRemove,
  onOpen,
}: {
  ids: string[];
  onRemove: (conceptId: string) => void;
  onOpen: (concept: AstroConcept) => void;
}) => {
  const obras = ids
    .map((id) => conceptById.get(id))
    .filter((item): item is AstroConcept => Boolean(item));

  return (
    <section id="vitrina" className="mo-vitrina mo-layer">
      <header className="mo-section-head">
        <p className="mo-kicker">Vitrina de contrastes</p>
        <h2>
          <RevealWords text="Obras seleccionadas" />
        </h2>
        <p className="mo-section-sub">
          Añade hasta {VITRINE_CAP} obras desde su sala de estudio para leerlas en paralelo.
        </p>
      </header>

      {obras.length === 0 ? (
        <p className="mo-vitrina-empty">
          La vitrina está vacía. Entra a cualquier obra y pulsa «Añadir a la vitrina de
          contrastes» para comenzar la comparación.
        </p>
      ) : (
        <div className="mo-vitrina-grid">
          {obras.map((concept, cardIndex) => {
            const chapter = resolveChapter(concept);
            return (
              <motion.article
                key={concept.id}
                className="mo-vitrina-card"
                style={{ '--accent': chapter.color } as CSSProperties}
                initial={{ opacity: 0, y: 34 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: Math.min(cardIndex * 0.06, 0.42), duration: 0.75, ease: EASE_OUT }}
              >
                <header>
                  <button
                    type="button"
                    className="mo-vitrina-title"
                    onClick={() => onOpen(concept)}
                    data-cursor-label="Abrir"
                  >
                    <span className="mo-plate">{chapter.number}·{concept.title}</span>
                    <h3>{concept.title}</h3>
                  </button>
                  <button
                    type="button"
                    className="mo-vitrina-remove"
                    onClick={() => onRemove(concept.id)}
                    aria-label={`Quitar ${concept.title} de la vitrina`}
                    data-cursor-label="Quitar"
                  >
                    ✕
                  </button>
                </header>
                <div className="mo-chip-row">
                  <span>{concept.category}</span>
                  <span>{scaleLabels[concept.scale]}</span>
                  <span>{plausibilityLabels[concept.plausibility]}</span>
                </div>
                <dl className="mo-metrics-v2">
                  {(
                    [
                      ['Energía', concept.metrics.energia],
                      ['Materiales', concept.metrics.materiales],
                      ['Madurez', concept.metrics.madurez],
                      ['Maravilla', concept.metrics.maravilla],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd aria-label={`${value} de 5`}>
                        {[1, 2, 3, 4, 5].map((cell) => (
                          <i key={cell} className={cell <= value ? 'is-on' : ''} />
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mo-vitrina-mechanism">{concept.mechanism}</p>
              </motion.article>
            );
          })}
        </div>
      )}
    </section>
  );
});

/* ---------------- Sala archivo ---------------- */

interface ArchiveSource extends SourceRef {
  count: number;
}

const buildArchive = (): ArchiveSource[] => {
  const map = new Map<string, ArchiveSource>();
  const push = (source: SourceRef) => {
    const current = map.get(source.url);
    map.set(source.url, { ...source, count: (current?.count ?? 0) + 1 });
  };
  chapters.forEach((chapter) => chapter.sources.forEach(push));
  chapters.forEach((chapter) => chapter.concepts.forEach((concept) => concept.sources?.forEach(push)));
  return [...map.values()];
};

const Archivo = memo(({ sources }: { sources: ArchiveSource[] }) => (
  <section id="archivo" className="mo-archivo mo-layer">
    <header className="mo-section-head">
      <p className="mo-kicker">Sala archivo</p>
      <h2>
        <RevealWords text="Fuentes de la colección" />
      </h2>
      <p className="mo-section-sub">
        Toda la documentación técnica citada en el museo: NASA, SETI y otros materiales de
        referencia.
      </p>
    </header>
    <ol className="mo-archivo-list">
      {sources.map((source, index) => (
        <motion.li
          key={source.url}
          initial={{ opacity: 0, x: -22 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-30px' }}
          transition={{ delay: Math.min(index * 0.035, 0.5), duration: 0.6, ease: EASE_OUT }}
        >
          <b>{String(index + 1).padStart(2, '0')}</b>
          <div>
            <span>{source.publisher}</span>
            <a href={source.url} target="_blank" rel="noreferrer" data-cursor-label="Leer">
              {source.title} ↗
            </a>
          </div>
          <i>
            citada en {source.count} {source.count === 1 ? 'ficha' : 'fichas'}
          </i>
        </motion.li>
      ))}
    </ol>
  </section>
));

/* ---------------- Menú persistente ---------------- */

const MenuOverlay = memo(({
  open,
  onClose,
  onGo,
}: {
  open: boolean;
  onClose: () => void;
  onGo: (targetId: string) => void;
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useScrollLock(open);

  if (!open) return null;

  return (
    <motion.div
      className="mo-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Índice del museo"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mo-menu-panel">
        <header className="mo-menu-head">
          <p className="mo-kicker">Museo Orbital</p>
          <button
            ref={closeRef}
            type="button"
            className="mo-menu-close"
            onClick={onClose}
            data-cursor-label="Cerrar"
          >
            ✕ Cerrar índice
          </button>
        </header>
        <h2>Índice del recorrido</h2>
        <ol className="mo-menu-list">
          {chapters.map((chapter, index) => (
            <motion.li
              key={chapter.id}
              initial={{ opacity: 0, x: -26 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 + index * 0.04, duration: 0.5, ease: EASE_OUT }}
            >
              <button
                type="button"
                style={{ '--accent': chapter.color } as CSSProperties}
                onClick={() => onGo(`sala-${chapter.id}`)}
                data-cursor-label={`Sala ${chapter.number}`}
              >
                <b>{chapter.number}</b>
                <span>{chapter.title}</span>
                <i>{chapter.concepts.length}</i>
              </button>
            </motion.li>
          ))}
          <motion.li
            initial={{ opacity: 0, x: -26 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 + chapters.length * 0.04, duration: 0.5, ease: EASE_OUT }}
          >
            <button
              type="button"
              className="is-extra"
              onClick={() => onGo('vitrina')}
              data-cursor-label="Comparar"
            >
              <b>✦</b>
              <span>Vitrina de contrastes</span>
            </button>
          </motion.li>
          <motion.li
            initial={{ opacity: 0, x: -26 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 + chapters.length * 0.04, duration: 0.5, ease: EASE_OUT }}
          >
            <button
              type="button"
              className="is-extra"
              onClick={() => onGo('archivo')}
              data-cursor-label="Fuentes"
            >
              <b>§</b>
              <span>Sala archivo</span>
            </button>
          </motion.li>
        </ol>
      </div>
    </motion.div>
  );
});

/* ---------------- Principal ---------------- */

export default function MuseoOrbital() {
  const reduced = useReducedMotion();
  usePageTextPhysics(Boolean(reduced));
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState<AstroConcept | null>(() => conceptFromHash());
  const [activeHallId, setActiveHallId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [vitrineIds, setVitrineIds] = useState<string[]>(loadVitrine);
  const [flight, setFlight] = useState(false);
  const [eclipsedChapterId, setEclipsedChapterId] = useState<string | null>(null);
  const [playground, setPlayground] = useState(false);
  const [playgroundEntryState, setPlaygroundEntryState] = useState<PlaygroundEntryState>('idle');
  const [playgroundMusicMuted, setPlaygroundMusicMuted] = useState(loadPlaygroundMusicMuted);
  const [playgroundMusicBlocked, setPlaygroundMusicBlocked] = useState(false);
  const [playgroundHoldProgress, setPlaygroundHoldProgress] = useState(0);
  const [playgroundRunId, setPlaygroundRunId] = useState(0);
  const [playgroundProgress, setPlaygroundProgress] = useState<PlaygroundProgress>(
    INITIAL_PLAYGROUND_PROGRESS,
  );
  const [playgroundElapsedMs, setPlaygroundElapsedMs] = useState(0);
  const [playgroundBestTimes, setPlaygroundBestTimes] = useState<PlaygroundBestTime[]>(
    loadPlaygroundBestTimes,
  );
  const [playgroundResult, setPlaygroundResult] = useState<PlaygroundResult | null>(null);
  const playgroundStartedAt = useRef<number | null>(null);
  const playgroundPhase = useRef<PlaygroundProgress['phase']>('active');
  const reducedPlaygroundRun = useRef(false);
  const flightTimer = useRef(0);
  const playgroundTransitionTimer = useRef(0);
  const playgroundEntryStateRef = useRef<PlaygroundEntryState>('idle');
  const playgroundActiveRef = useRef(false);
  const playgroundScrollTop = useRef(0);
  const playgroundAudioRef = useRef<HTMLAudioElement>(null);
  const playgroundAudioFadeFrame = useRef(0);
  const playgroundAudioRequestId = useRef(0);
  const playgroundAudioTrackIndex = useRef(0);
  const playgroundAudioPreloaderRef = useRef<HTMLAudioElement | null>(null);
  const railRef = useRef<HTMLElement>(null);
  const railStarRef = useRef<HTMLElement>(null);
  const railNodeRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const museumKeyboardVelocityRef = useRef(0);

  useScrollLock(Boolean(active));
  useScrollLock(playground);

  const { scrollYProgress } = useScroll({ container: rootRef });
  const railScale = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.4 });
  const railStarTop = useTransform(railScale, [0, 1], ['2%', '98%']);

  const syncRailEclipse = useCallback((progress: number) => {
    const rail = railRef.current;
    const star = railStarRef.current;
    if (!rail || !star || rail.offsetHeight === 0) {
      setEclipsedChapterId(null);
      return;
    }

    const starCenter = rail.offsetHeight * (0.02 + clamp(progress, 0, 1) * 0.96);
    const starDiameter = star.offsetHeight || 15;
    let nextChapterId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    railNodeRefs.current.forEach((node, index) => {
      if (!node) return;
      const nodeCenter = node.offsetTop + node.offsetHeight / 2;
      const distance = Math.abs(starCenter - nodeCenter);
      // El eclipse comienza cuando el centro del disco menor entra en el mayor:
      // evita encender la corona con una sala activa pero todavía distante.
      const collisionRadius = Math.min(starDiameter, node.offsetHeight) / 2;
      if (distance <= collisionRadius && distance < nearestDistance) {
        nearestDistance = distance;
        nextChapterId = chapters[index]?.id ?? null;
      }
    });

    setEclipsedChapterId((current) => (current === nextChapterId ? current : nextChapterId));
  }, []);

  useMotionValueEvent(railScale, 'change', syncRailEclipse);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const sync = () => syncRailEclipse(railScale.get());
    const resizeObserver = new ResizeObserver(sync);
    resizeObserver.observe(rail);
    railNodeRefs.current.forEach((node) => {
      if (node) resizeObserver.observe(node);
    });
    const frame = requestAnimationFrame(sync);
    window.addEventListener('resize', sync);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', sync);
      resizeObserver.disconnect();
    };
  }, [railScale, syncRailEclipse]);

  const archiveSources = useMemo(buildArchive, []);

  const triggerFlight = useCallback(() => {
    if (reduced) return;
    setFlight(true);
    window.clearTimeout(flightTimer.current);
    flightTimer.current = window.setTimeout(() => setFlight(false), 460);
  }, [reduced]);

  const fadePlaygroundMusic = useCallback(
    (targetVolume: number, durationMs: number, pauseAfter = false) => {
      const audio = playgroundAudioRef.current;
      if (!audio) return;

      cancelAnimationFrame(playgroundAudioFadeFrame.current);
      const initialVolume = audio.volume;
      const startedAt = performance.now();
      const target = clamp(targetVolume, 0, 1);

      const step = (now: number) => {
        const progress = durationMs <= 0 ? 1 : clamp((now - startedAt) / durationMs, 0, 1);
        const eased = progress * progress * (3 - 2 * progress);
        audio.volume = initialVolume + (target - initialVolume) * eased;

        if (progress < 1) {
          playgroundAudioFadeFrame.current = requestAnimationFrame(step);
          return;
        }

        playgroundAudioFadeFrame.current = 0;
        if (pauseAfter) audio.pause();
      };

      playgroundAudioFadeFrame.current = requestAnimationFrame(step);
    },
    [],
  );

  const requestPlaygroundMusic = useCallback(
    (targetVolume: number, fadeDurationMs: number) => {
      const audio = playgroundAudioRef.current;
      if (!audio) return;

      const requestId = playgroundAudioRequestId.current + 1;
      playgroundAudioRequestId.current = requestId;
      setPlaygroundMusicBlocked(false);

      const onStarted = () => {
        if (playgroundAudioRequestId.current !== requestId) {
          audio.pause();
          return;
        }
        setPlaygroundMusicBlocked(false);
        fadePlaygroundMusic(targetVolume, fadeDurationMs);
      };
      const onBlocked = () => {
        if (playgroundAudioRequestId.current !== requestId) return;
        audio.pause();
        audio.volume = 0;
        setPlaygroundMusicBlocked(true);
      };

      const playback = audio.play();
      if (playback) playback.then(onStarted).catch(onBlocked);
      else onStarted();
    },
    [fadePlaygroundMusic],
  );

  // Con preload="none" el MP3 no se descarga al abrir el museo: se calienta
  // cuando el usuario se acerca al playground para que la entrada no espere.
  const warmPlaygroundAudio = useCallback(() => {
    const audio = playgroundAudioRef.current;
    if (audio && audio.readyState === 0) audio.load();
  }, []);

  const preloadPlaygroundTrack = useCallback((trackIndex: number) => {
    if (!playgroundAudioPreloaderRef.current) {
      playgroundAudioPreloaderRef.current = new Audio();
      playgroundAudioPreloaderRef.current.preload = 'auto';
    }
    const preloader = playgroundAudioPreloaderRef.current;
    const trackSrc = PLAYGROUND_MUSIC_TRACKS[trackIndex];
    if (preloader.getAttribute('src') !== trackSrc) {
      preloader.src = trackSrc;
      preloader.load();
    }
  }, []);

  const selectPlaygroundTrack = useCallback(
    (trackIndex: number) => {
      const audio = playgroundAudioRef.current;
      if (!audio) return;
      playgroundAudioTrackIndex.current = trackIndex;
      audio.src = PLAYGROUND_MUSIC_TRACKS[trackIndex];
      preloadPlaygroundTrack((trackIndex + 1) % PLAYGROUND_MUSIC_TRACKS.length);
    },
    [preloadPlaygroundTrack],
  );

  const startPlaygroundMusic = useCallback(() => {
    const audio = playgroundAudioRef.current;
    if (!audio) return;
    selectPlaygroundTrack(Math.floor(Math.random() * PLAYGROUND_MUSIC_TRACKS.length));
    cancelAnimationFrame(playgroundAudioFadeFrame.current);
    audio.volume = 0;
    requestPlaygroundMusic(
      playgroundMusicMuted ? 0 : PLAYGROUND_MUSIC_VOLUME,
      PLAYGROUND_MUSIC_ENTER_FADE_MS,
    );
  }, [playgroundMusicMuted, requestPlaygroundMusic, selectPlaygroundTrack]);

  const handlePlaygroundTrackEnded = useCallback(() => {
    const audio = playgroundAudioRef.current;
    if (!audio) return;
    selectPlaygroundTrack((playgroundAudioTrackIndex.current + 1) % PLAYGROUND_MUSIC_TRACKS.length);
    audio.volume = 0;
    requestPlaygroundMusic(
      playgroundMusicMuted ? 0 : PLAYGROUND_MUSIC_VOLUME,
      PLAYGROUND_MUSIC_ENTER_FADE_MS,
    );
  }, [playgroundMusicMuted, requestPlaygroundMusic, selectPlaygroundTrack]);

  const stopPlaygroundMusic = useCallback(() => {
    playgroundAudioRequestId.current += 1;
    fadePlaygroundMusic(0, PLAYGROUND_MUSIC_LEAVE_FADE_MS, true);
  }, [fadePlaygroundMusic]);

  const togglePlaygroundMusic = useCallback(() => {
    const audio = playgroundAudioRef.current;
    if (!audio) return;

    if (!playgroundMusicMuted && !playgroundMusicBlocked) {
      playgroundAudioRequestId.current += 1;
      setPlaygroundMusicMuted(true);
      fadePlaygroundMusic(0, PLAYGROUND_MUSIC_TOGGLE_FADE_MS);
      return;
    }

    setPlaygroundMusicMuted(false);
    if (audio.paused || playgroundMusicBlocked) {
      audio.volume = 0;
      requestPlaygroundMusic(PLAYGROUND_MUSIC_VOLUME, PLAYGROUND_MUSIC_TOGGLE_FADE_MS);
    } else {
      fadePlaygroundMusic(PLAYGROUND_MUSIC_VOLUME, PLAYGROUND_MUSIC_TOGGLE_FADE_MS);
    }
  }, [
    fadePlaygroundMusic,
    playgroundMusicBlocked,
    playgroundMusicMuted,
    requestPlaygroundMusic,
  ]);

  const preparePlaygroundScene = useCallback(() => {
    const isReducedRun = Boolean(reduced);
    reducedPlaygroundRun.current = isReducedRun;
    playgroundStartedAt.current = null;
    playgroundPhase.current = isReducedRun ? 'complete' : 'active';
    setPlaygroundElapsedMs(0);
    setPlaygroundResult(null);
    setPlaygroundRunId((current) => current + 1);
    setPlaygroundProgress(
      isReducedRun
        ? { destroyed: PLAYGROUND_WORD.length, total: PLAYGROUND_WORD.length, phase: 'complete' }
        : INITIAL_PLAYGROUND_PROGRESS,
    );
  }, [reduced]);

  const startPlaygroundRun = useCallback(() => {
    playgroundStartedAt.current = reducedPlaygroundRun.current ? null : performance.now();
  }, []);

  const activatePlayground = useCallback(() => {
    playgroundActiveRef.current = true;
    startPlaygroundRun();
    setPlayground(true);
  }, [startPlaygroundRun]);

  const resetPlayground = useCallback(() => {
    playgroundActiveRef.current = false;
    playgroundStartedAt.current = null;
    playgroundPhase.current = 'active';
    setPlayground(false);
    setPlaygroundProgress(INITIAL_PLAYGROUND_PROGRESS);
    setPlaygroundElapsedMs(0);
    setPlaygroundResult(null);
  }, []);

  const beginPlaygroundTransition = useCallback(() => {
    if (
      playgroundActiveRef.current ||
      playground ||
      !['idle', 'charging'].includes(playgroundEntryStateRef.current)
    ) {
      return;
    }

    const root = rootRef.current;
    if (root) playgroundScrollTop.current = root.scrollTop;
    window.clearTimeout(playgroundTransitionTimer.current);
    playgroundEntryStateRef.current = 'entering';
    setPlaygroundEntryState('entering');
    setPlaygroundHoldProgress(0);
    preparePlaygroundScene();
    window.dispatchEvent(new CustomEvent('mo-cursor-reset'));
    warmPlaygroundAudio();
    startPlaygroundMusic();

    if (reduced) {
      activatePlayground();
      playgroundEntryStateRef.current = 'idle';
      setPlaygroundEntryState('idle');
      return;
    }

    window.dispatchEvent(
      new CustomEvent('mo-warp', {
        detail: {
          strength: 0,
          direction: -1,
          durationMs: PLAYGROUND_ENTER_MS,
          travelSpeed: PLAYGROUND_ENTER_TRAVEL_SPEED,
        },
      }),
    );
    playgroundTransitionTimer.current = window.setTimeout(() => {
      activatePlayground();
      playgroundEntryStateRef.current = 'idle';
      setPlaygroundEntryState('idle');
    }, PLAYGROUND_ENTER_MS);
  }, [activatePlayground, playground, preparePlaygroundScene, reduced, startPlaygroundMusic, warmPlaygroundAudio]);

  const leavePlayground = useCallback(() => {
    if (!playground || playgroundEntryStateRef.current !== 'idle') return;

    window.clearTimeout(playgroundTransitionTimer.current);
    playgroundEntryStateRef.current = 'leaving';
    setPlaygroundEntryState('leaving');
    setPlaygroundHoldProgress(0);
    playgroundStartedAt.current = null;
    stopPlaygroundMusic();

    const finishLeaving = () => {
      resetPlayground();
      const root = rootRef.current;
      if (root) root.scrollTop = playgroundScrollTop.current;
    };

    if (reduced) {
      finishLeaving();
      playgroundEntryStateRef.current = 'idle';
      setPlaygroundEntryState('idle');
      return;
    }

    window.dispatchEvent(
      new CustomEvent('mo-warp', {
        detail: {
          strength: 0,
          direction: 1,
          durationMs: PLAYGROUND_LEAVE_MS,
          travelSpeed: PLAYGROUND_ENTER_TRAVEL_SPEED,
        },
      }),
    );
    playgroundTransitionTimer.current = window.setTimeout(() => {
      finishLeaving();
      playgroundEntryStateRef.current = 'idle';
      setPlaygroundEntryState('idle');
    }, PLAYGROUND_LEAVE_MS);
  }, [playground, reduced, resetPlayground, stopPlaygroundMusic]);

  const replayPlayground = useCallback(() => {
    preparePlaygroundScene();
    startPlaygroundRun();
  }, [preparePlaygroundScene, startPlaygroundRun]);

  const handlePlaygroundProgress = useCallback((nextProgress: PlaygroundProgress) => {
    if (nextProgress.phase !== 'complete') {
      if (playgroundPhase.current === 'active') {
        setPlaygroundProgress({ ...nextProgress, phase: 'active' });
      }
      return;
    }

    if (playgroundPhase.current !== 'active') return;
    const now = performance.now();
    const startedAt = playgroundStartedAt.current;
    if (startedAt === null || reducedPlaygroundRun.current) return;
    const durationMs = Math.max(1, now - startedAt);

    playgroundPhase.current = 'complete';
    playgroundStartedAt.current = null;
    setPlaygroundProgress(nextProgress);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const entry: PlaygroundBestTime = {
      id,
      durationMs,
      completedAt: new Date().toISOString(),
    };
    setPlaygroundElapsedMs(durationMs);
    setPlaygroundResult({ id, durationMs });
    setPlaygroundBestTimes((current) =>
      [...current, entry]
        .sort((a, b) => a.durationMs - b.durationMs)
        .slice(0, PLAYGROUND_TIMES_CAP),
    );
  }, []);

  // W/S recorren el museo con inercia. Al llegar arriba, W sostenida confirma
  // la entrada al Playground sin interferir con el pilotaje WASD del minijuego.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let raf = 0;
    let previous = performance.now();
    let velocity = 0;
    let holdStartedAt: number | null = null;
    let lastPublishedProgress = -1;
    const held = { w: false, s: false };
    const modifiers = { alt: false, ctrl: false, meta: false, shift: false };

    const isEditable = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.isContentEditable ||
        target.matches('input, textarea, select, [role="textbox"], [contenteditable="true"]')
      );
    };

    const publishIdle = () => {
      holdStartedAt = null;
      lastPublishedProgress = -1;
      setPlaygroundHoldProgress(0);
      if (playgroundEntryStateRef.current === 'charging') {
        playgroundEntryStateRef.current = 'idle';
        setPlaygroundEntryState('idle');
      }
    };

    const clearInput = () => {
      held.w = false;
      held.s = false;
      velocity = 0;
      museumKeyboardVelocityRef.current = 0;
      publishIdle();
    };

    const updateModifiers = (event: KeyboardEvent) => {
      modifiers.alt = event.altKey;
      modifiers.ctrl = event.ctrlKey;
      modifiers.meta = event.metaKey;
      modifiers.shift = event.shiftKey;
    };

    const blocked = () =>
      playground ||
      Boolean(active) ||
      menuOpen ||
      !['idle', 'charging'].includes(playgroundEntryStateRef.current) ||
      isEditable(document.activeElement);

    const onKeyDown = (event: KeyboardEvent) => {
      updateModifiers(event);
      if (event.key === 'Escape') {
        clearInput();
        return;
      }
      if (isEditable(event.target) || blocked()) return;

      if (event.code.startsWith('Arrow')) {
        velocity = 0;
        museumKeyboardVelocityRef.current = 0;
        publishIdle();
        return;
      }

      if (event.code === 'KeyW' && !event.repeat) held.w = true;
      if (event.code === 'KeyS' && !event.repeat) {
        held.s = true;
        publishIdle();
      }
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) publishIdle();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      updateModifiers(event);
      if (event.code === 'KeyW') {
        held.w = false;
        publishIdle();
      }
      if (event.code === 'KeyS') held.s = false;
      if (event.code.startsWith('Shift') || event.code.startsWith('Control') || event.code.startsWith('Alt') || event.code.startsWith('Meta')) {
        publishIdle();
      }
    };

    const onManualScroll = () => {
      velocity = 0;
      publishIdle();
    };

    const onVisibility = () => {
      if (document.hidden) clearInput();
    };

    const loop = (now: number) => {
      const dt = Math.min(0.032, Math.max(0, (now - previous) / 1000));
      previous = now;

      if (blocked()) {
        velocity = 0;
        museumKeyboardVelocityRef.current = 0;
        if (playgroundEntryStateRef.current === 'charging') publishIdle();
      } else {
        const direction = Number(held.s) - Number(held.w);
        if (reduced) {
          velocity = direction * 1_920;
        } else if (direction !== 0) {
          velocity += direction * 4_800 * dt;
          velocity = Math.max(-2_400, Math.min(2_400, velocity));
        } else {
          velocity *= Math.exp(-7.5 * dt);
          if (Math.abs(velocity) < 1) velocity = 0;
        }

        if (velocity !== 0) root.scrollTop += velocity * dt;

        const noModifiers = !modifiers.alt && !modifiers.ctrl && !modifiers.meta && !modifiers.shift;
        if (held.w && !held.s && noModifiers && root.scrollTop <= 2) {
          root.scrollTop = 0;
          velocity = 0;
          if (holdStartedAt === null) {
            holdStartedAt = now;
            playgroundEntryStateRef.current = 'charging';
            setPlaygroundEntryState('charging');
          }
          const progress = Math.min(1, (now - holdStartedAt) / PLAYGROUND_HOLD_MS);
          if (progress === 1 || Math.abs(progress - lastPublishedProgress) >= 0.01) {
            lastPublishedProgress = progress;
            setPlaygroundHoldProgress(progress);
          }
          if (progress >= 1) beginPlaygroundTransition();
        } else if (holdStartedAt !== null || playgroundEntryStateRef.current === 'charging') {
          publishIdle();
        }

        const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
        if ((root.scrollTop <= 0 && velocity < 0) || (root.scrollTop >= maxScroll && velocity > 0)) {
          velocity = 0;
        }
        museumKeyboardVelocityRef.current = velocity;
      }

      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInput);
    document.addEventListener('visibilitychange', onVisibility);
    root.addEventListener('wheel', onManualScroll, { passive: true });
    root.addEventListener('touchstart', onManualScroll, { passive: true });
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInput);
      document.removeEventListener('visibilitychange', onVisibility);
      root.removeEventListener('wheel', onManualScroll);
      root.removeEventListener('touchstart', onManualScroll);
      cancelAnimationFrame(raf);
      clearInput();
    };
  }, [active, beginPlaygroundTransition, menuOpen, playground, reduced]);

  // Escape sale del playground y descarta cualquier intento en curso.
  useEffect(() => {
    if (!playground) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') leavePlayground();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leavePlayground, playground]);

  // El reloj monotónico sigue contabilizando el intervalo aunque la pestaña se
  // oculte y se congela únicamente al completar todos los objetivos.
  useEffect(() => {
    if (!playground || playgroundProgress.phase !== 'active' || reduced) return;
    const tick = () => {
      const startedAt = playgroundStartedAt.current;
      if (startedAt === null || playgroundPhase.current !== 'active') return;
      const elapsedMs = Math.max(0, performance.now() - startedAt);
      setPlaygroundElapsedMs(elapsedMs);
    };
    tick();
    const timer = window.setInterval(tick, 100);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [playground, playgroundProgress.phase, playgroundRunId, reduced]);

  useEffect(
    () => () => {
      window.clearTimeout(flightTimer.current);
      window.clearTimeout(playgroundTransitionTimer.current);
      cancelAnimationFrame(playgroundAudioFadeFrame.current);
      playgroundAudioRequestId.current += 1;
      playgroundAudioRef.current?.pause();
    },
    [],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(VITRINE_KEY, JSON.stringify(vitrineIds));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [vitrineIds]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PLAYGROUND_TIMES_KEY, JSON.stringify(playgroundBestTimes));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [playgroundBestTimes]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PLAYGROUND_MUSIC_MUTED_KEY, String(playgroundMusicMuted));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [playgroundMusicMuted]);

  useEffect(() => {
    const hash = active ? `#obra-${active.id}` : '';
    const desired = hash || `${window.location.pathname}${window.location.search}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', desired);
    }
  }, [active]);

  useEffect(() => {
    const onHash = () => setActive(conceptFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const el = rootRef.current;
    if (!el) return;
    let last = el.scrollTop;
    let vel = 0;
    let raf = 0;
    let lastSkew = '';
    const onScroll = () => {
      const top = el.scrollTop;
      vel = vel * 0.8 + (top - last) * 0.2;
      last = top;
    };
    const loop = () => {
      vel *= 0.9;
      const skew = Math.max(-5, Math.min(5, vel * 0.012)).toFixed(2);
      if (skew !== lastSkew) {
        lastSkew = skew;
        el.style.setProperty('--marquee-skew', `${skew}deg`);
      }
      raf = requestAnimationFrame(loop);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  useEffect(() => {
    if (reduced || !window.matchMedia('(pointer: fine)').matches) return;
    const offsets = new WeakMap<Element, { x: number; y: number }>();
    const mouse = { x: -9999, y: -9999 };
    let raf = 0;
    let nodes: HTMLElement[] = [];
    let lastScan = 0;

    const onMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };

    const loop = (time: number) => {
      if (time - lastScan > 2200) {
        nodes = Array.from(
          document.querySelectorAll<HTMLElement>('.mo-obra.is-featured .mo-frame-mask'),
        );
        lastScan = time;
      }
      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        if (rect.bottom < -90 || rect.top > window.innerHeight + 90) continue;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = mouse.x - cx;
        const dy = mouse.y - cy;
        const dist = Math.hypot(dx, dy);
        const radius = Math.max(rect.width, rect.height) / 2 + 100;
        const force = dist < radius ? Math.pow(1 - dist / radius, 1.6) : 0;
        const state = offsets.get(node) ?? { x: 0, y: 0 };
        const tx = force > 0 ? (dx / (dist || 1)) * force * 7 : 0;
        const ty = force > 0 ? (dy / (dist || 1)) * force * 5 : 0;
        state.x += (tx - state.x) * 0.12;
        state.y += (ty - state.y) * 0.12;
        offsets.set(node, state);
        node.style.transform = `translate(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px)`;
      }
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  // Títulos de sala con peso tipográfico magnético, eco sutil del hero
  useEffect(() => {
    if (reduced || !window.matchMedia('(pointer: fine)').matches) return;
    const weights = new WeakMap<Element, number>();
    const mouse = { x: -9999, y: -9999 };
    let raf = 0;
    let nodes: HTMLElement[] = [];
    let lastScan = 0;

    const onMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };

    const loop = (time: number) => {
      if (time - lastScan > 2000) {
        nodes = Array.from(
          document.querySelectorAll<HTMLElement>('.mo-sala-copy h2 .mo-word'),
        );
        lastScan = time;
      }

      // Fase de lectura: medir una sola vez antes de escribir estilos
      const rects = nodes.map((node) => node.getBoundingClientRect());

      nodes.forEach((node, index) => {
        const rect = rects[index];
        if (rect.bottom < -80 || rect.top > window.innerHeight + 80) return;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(mouse.x - cx, mouse.y - cy);
        const radius = 200;
        const norm = dist < radius ? 1 - dist / radius : 0;
        const eased = norm * norm * (3 - 2 * norm);
        const current = weights.get(node) ?? 500;
        const next = current + (500 + eased * 180 - current) * 0.2;
        weights.set(node, next);
        // El peso se aplica vía font-weight: la Fraunces variable interpola
        // el eje wght sin depender de font-variation-settings.
        if (next < 501.5 && eased === 0) {
          if (node.style.fontWeight) node.style.fontWeight = '';
        } else {
          node.style.fontWeight = String(Math.round(next));
        }
      });
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveHallId(entry.target.id.replace('sala-', ''));
        });
      },
      { rootMargin: '-42% 0px -42% 0px' },
    );
    chapters.forEach((chapter) => {
      const element = document.getElementById(`sala-${chapter.id}`);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  const openConcept = useCallback((concept: AstroConcept) => {
    triggerFlight();
    setActive(concept);
  }, [triggerFlight]);

  const closeConcept = useCallback(() => {
    triggerFlight();
    setActive(null);
  }, [triggerFlight]);

  const toggleVitrine = useCallback((conceptId: string) => {
    setVitrineIds((current) => {
      if (current.includes(conceptId)) {
        return current.filter((id) => id !== conceptId);
      }
      if (current.length >= VITRINE_CAP) {
        return current;
      }
      return [...current, conceptId];
    });
  }, []);

  const goFromMenu = useCallback((targetId: string) => {
    setMenuOpen(false);
    window.setTimeout(() => scrollToId(targetId), 120);
  }, []);

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  let plateOffset = 0;
  const activeHall = chapters.find((chapter) => chapter.id === activeHallId);
  const playgroundArriving = playgroundEntryState === 'entering';
  const playgroundDeparting = playgroundEntryState === 'leaving';
  const playgroundTransitioning = playgroundArriving || playgroundDeparting;
  const playgroundScene = playgroundArriving
    ? 'arriving'
    : playgroundDeparting
      ? 'departing'
      : playground
        ? 'active'
        : 'museum';

  return (
    <div
      className={`mo-root${playground ? ' is-playground' : ''}${
        playgroundEntryState === 'entering' ? ' is-entering-playground' : ''
      }${playgroundEntryState === 'leaving' ? ' is-leaving-playground' : ''}`}
      ref={rootRef}
      style={
        {
          '--mo-playground-arrival-delay': `${PLAYGROUND_ARRIVAL_START_MS}ms`,
          '--mo-playground-arrival-duration': `${PLAYGROUND_ARRIVAL_END_MS - PLAYGROUND_ARRIVAL_START_MS}ms`,
          '--mo-museum-return-delay': `${PLAYGROUND_MUSEUM_RETURN_START_MS}ms`,
          '--mo-museum-return-duration': `${PLAYGROUND_LEAVE_MS - PLAYGROUND_MUSEUM_RETURN_START_MS}ms`,
        } as CSSProperties
      }
      onClickCapture={(event) => {
        // Con Mayús presionado se dibujan constelaciones: ningún clic navega
        if (event.shiftKey) {
          const target = event.target as HTMLElement;
          if (target.classList.contains('mo-studio')) return;
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <StarfieldCanvas
        scrollRef={rootRef}
        museumKeyboardVelocityRef={museumKeyboardVelocityRef}
        dim={(Boolean(active) || menuOpen) && !playground}
        playground={playground}
        playgroundScene={playgroundScene}
        playgroundRunId={playgroundRunId}
        playgroundPhase={playgroundProgress.phase}
        onPlaygroundProgress={handlePlaygroundProgress}
      />
      <Grain opacity={0.06} blend="screen" zIndex={40} />
      <MuseumCursor />
      <audio
        ref={playgroundAudioRef}
        src={PLAYGROUND_MUSIC_TRACKS[0]}
        preload="none"
        onEnded={handlePlaygroundTrackEnded}
        aria-hidden="true"
      />

      <AnimatePresence>
        {(playgroundEntryState === 'entering' || playgroundEntryState === 'leaving') && (
          <motion.div
            key={playgroundEntryState}
            className={`mo-playground-transition is-${playgroundEntryState}`}
            aria-hidden="true"
            initial={{ opacity: playgroundEntryState === 'entering' ? 0 : 1 }}
            animate={
              playgroundEntryState === 'entering'
                ? { opacity: [0, 1, 1] }
                : { opacity: [1, 1, 0] }
            }
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={{
              duration:
                playgroundEntryState === 'entering'
                  ? PLAYGROUND_ENTER_MS / 1000
                  : PLAYGROUND_LEAVE_MS / 1000,
              times:
                playgroundEntryState === 'entering'
                  ? [0, 0.12, 1]
                  : [0, PLAYGROUND_MUSEUM_RETURN_START_MS / PLAYGROUND_LEAVE_MS, 1],
              ease: 'easeInOut',
            }}
          />
        )}
      </AnimatePresence>

      {(playground || playgroundTransitioning) && (
        <div
          className={`mo-playground-ui${playgroundArriving ? ' is-arriving' : ''}${
            playgroundDeparting ? ' is-departing' : ''
          }${
            playgroundProgress.phase !== 'active' ? ' is-finished' : ''
          }`}
          aria-hidden={playgroundTransitioning || undefined}
          data-playground-scene={playgroundScene}
          data-playground-phase={playgroundProgress.phase}
          data-playground-destroyed={playgroundProgress.destroyed}
        >
          <button
            type="button"
            className="mo-playground-exit mo-playground-exit-corner"
            onClick={(event) => {
              event.currentTarget.blur();
              leavePlayground();
            }}
            disabled={playgroundTransitioning}
            data-cursor-label="Volver"
          >
            ← Volver al museo
          </button>
          <button
            type="button"
            className={`mo-playground-audio${playgroundMusicBlocked ? ' is-blocked' : ''}`}
            onClick={(event) => {
              event.currentTarget.blur();
              togglePlaygroundMusic();
            }}
            disabled={playgroundTransitioning}
            aria-label={
              playgroundMusicMuted || playgroundMusicBlocked
                ? 'Activar música del playground'
                : 'Silenciar música del playground'
            }
            aria-pressed={playgroundMusicMuted}
            title={playgroundMusicBlocked ? 'Activar música' : undefined}
            data-cursor-label={
              playgroundMusicMuted || playgroundMusicBlocked ? 'Activar música' : 'Silenciar música'
            }
          >
            {playgroundMusicMuted || playgroundMusicBlocked ? (
              <VolumeX aria-hidden="true" />
            ) : (
              <Volume2 aria-hidden="true" />
            )}
          </button>
          <div className="mo-playground-status">
            <div>
              <span>Tiempo</span>
              <strong>
                <time dateTime={`PT${Math.floor(playgroundElapsedMs / 1000)}S`}>
                  {formatPlaygroundElapsed(playgroundElapsedMs)}
                </time>
              </strong>
            </div>
          </div>

          <AnimatePresence>
            {playgroundProgress.phase !== 'active' && (
              <motion.section
                className={`mo-playground-complete is-${playgroundProgress.phase}`}
                initial={reduced ? false : { opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: reduced ? 0 : 0.8, ease: EASE_OUT }}
                aria-labelledby="mo-playground-result-title"
                role="dialog"
                aria-modal="true"
              >
                <span className="mo-playground-complete-kicker">Misión completada</span>
                <h2 id="mo-playground-result-title" aria-label={PLAYGROUND_WORD}>
                  {PLAYGROUND_WORD.split('').map((letter, index) => (
                    <motion.span
                      aria-hidden="true"
                      key={`${letter}-${index}`}
                      initial={reduced ? false : { opacity: 0, y: 44, rotate: index % 2 ? -8 : 8 }}
                      animate={{ opacity: 1, y: 0, rotate: 0 }}
                      transition={{
                        delay: reduced ? 0 : 0.12 + index * 0.045,
                        duration: reduced ? 0 : 0.68,
                        ease: EASE_OUT,
                      }}
                    >
                      {letter}
                    </motion.span>
                  ))}
                </h2>
                <p>Las piezas dispersas vuelven a ser una sola idea.</p>

                {playgroundResult && (
                  <div className="mo-playground-current-time">
                    <span>Tu tiempo</span>
                    <strong>{formatPlaygroundTime(playgroundResult.durationMs)}</strong>
                  </div>
                )}

                <div className="mo-playground-ranking" aria-label="Tus diez mejores tiempos">
                  <span className="mo-playground-ranking-title">Tus mejores tiempos</span>
                  {playgroundBestTimes.length > 0 ? (
                    <ol>
                      {playgroundBestTimes.map((entry, index) => (
                        <li
                          key={entry.id}
                          className={entry.id === playgroundResult?.id ? 'is-current' : undefined}
                        >
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          <strong>{formatPlaygroundTime(entry.durationMs)}</strong>
                          {entry.id === playgroundResult?.id && <em>nuevo</em>}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>Completa una misión para estrenar el registro.</p>
                  )}
                </div>

                <div className="mo-playground-result-actions">
                  <button
                    type="button"
                    className="mo-playground-replay"
                    onClick={(event) => {
                      event.currentTarget.blur();
                      replayPlayground();
                    }}
                    data-cursor-label="Repetir"
                  >
                    Jugar de nuevo
                  </button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <div className="mo-playground-controls">
            <p className="mo-playground-hint">
              <span className="mo-playground-hint-desktop">
                <span className="mo-pg-action">
                  <kbd className="mo-pg-key">Espacio</kbd>Pulsar
                </span>
                <i className="mo-pg-sep" aria-hidden="true" />
                <span className="mo-pg-action">
                  <kbd className="mo-pg-key">Clic mantenido</kbd>Supernova
                </span>
                <i className="mo-pg-sep" aria-hidden="true" />
                <span className="mo-pg-action">
                  <kbd className="mo-pg-key">Clic + Arrastre</kbd>Cometa
                </span>
                <i className="mo-pg-sep" aria-hidden="true" />
                <span className="mo-pg-action">
                  <kbd className="mo-pg-key">Shift + WASD</kbd>Speed Boost
                </span>
                <i className="mo-pg-sep" aria-hidden="true" />
                <span className="mo-pg-action">
                  <kbd className="mo-pg-key">Shift + Clic</kbd>Constelación
                </span>
              </span>
              <span className="mo-playground-hint-touch">
                COMETA: TOCA Y ARRASTRA PARA LANZAR
              </span>
            </p>
          </div>
        </div>
      )}

      <Hero
        heroRef={heroRef}
        onOpenIndex={openMenu}
        onOpenPlayground={beginPlaygroundTransition}
        onPlaygroundArm={warmPlaygroundAudio}
        playgroundHoldProgress={playgroundHoldProgress}
        playgroundEntryState={playgroundEntryState}
      />
      <Marquee />
      <HallIndex activeId={activeHallId} />

      {chapters.map((chapter) => {
        const offset = plateOffset;
        plateOffset += chapter.concepts.length;
        return (
          <Sala
            key={chapter.id}
            chapter={chapter}
            offset={offset}
            enableFlight={!reduced}
            onSelect={openConcept}
          />
        );
      })}

      <Vitrina
        ids={vitrineIds}
        onRemove={toggleVitrine}
        onOpen={openConcept}
      />

      <Archivo sources={archiveSources} />

      <footer className="mo-footer mo-layer">
        <blockquote>
          La naturaleza necesitó miles de millones de años para engendrar una
          mente capaz de comprenderla. Bastó una fracción de ese tiempo para que
          aquella mente aprendiera a crear otras. Y así, de un universo que
          nunca supo hacia dónde iba, nació algo capaz de elegir hacia dónde irá.
        </blockquote>
        <p className="mo-footer-line">
          ASTROINGENIERÍA — EXPOSICIÓN PERMANENTE · MUSEO ORBITAL · MMXXVI
        </p>
      </footer>

      <aside ref={railRef} className="mo-rail" aria-label="Progreso del recorrido">
        <div className="mo-rail-track">
          <motion.div className="mo-rail-fill" style={{ scaleY: railScale }} />
          <motion.i
            ref={railStarRef}
            className="mo-rail-star"
            style={{ top: railStarTop }}
            aria-hidden="true"
          />
        </div>
        {chapters.map((chapter, index) => (
          <button
            ref={(node) => {
              railNodeRefs.current[index] = node;
            }}
            key={chapter.id}
            type="button"
            title={chapter.title}
            className={eclipsedChapterId === chapter.id ? 'is-eclipsed' : ''}
            aria-current={activeHallId === chapter.id ? 'step' : undefined}
            onClick={() => scrollToId(`sala-${chapter.id}`)}
          />
        ))}
        <span className="mo-rail-label">
          {activeHall ? `Sala ${activeHall.number} — ${activeHall.title}` : ''}
        </span>
      </aside>

      <AnimatePresence>
        {menuOpen && (
          <MenuOverlay open={menuOpen} onClose={closeMenu} onGo={goFromMenu} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {flight && (
          <motion.div
            key="flash"
            className="mo-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.18, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, times: [0, 0.3, 1] }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {active && (
          <StudioRoom
            key="studio"
            concept={active}
            chapter={resolveChapter(active)}
            siblings={resolveChapter(active).concepts}
            enableFlight={!reduced}
            inVitrine={vitrineIds.includes(active.id)}
            onToggleVitrine={toggleVitrine}
            onClose={closeConcept}
            onSelect={openConcept}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
