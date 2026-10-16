import { jumpScroll, lockSmoothScroll, smoothScrollTo } from '../shared/smoothScroll';
import {
  DROP_MS,
  createWarpLoop,
  createWarpRenderer,
  epochNow,
  type Rgb,
  type WarpMessage,
  type WarpSize,
} from './warpField';
import { MAP_CLOSE_MS, createMapScene, type MapMessage, type MapRegion } from './starMap';
import { drawMapLabels, type MapLabelEntry } from './starMapLabels';
import { skyCovers } from './roomShared';
import './chapterWarp.css';

/* Salto al hiperespacio entre capítulos. Toda la navegación del museo (riel,
   índice, menú, inicio) pasa por aquí: en vez de recorrer decenas de miles
   de píxeles atravesando cada portal, la cámara entra en hiperespacio, el
   scroll salta de golpe con la pantalla cubierta y salimos en el destino.

   Nada de lo visible depende del hilo principal una vez lanzado: velo,
   brillo, destello y estelas se dibujan en un worker, y los números y el
   rótulo de llegada son animaciones de opacidad y transformación que corren
   en el compositor. Así el salto no se traba aunque montar el capítulo de
   destino cueste. La capa vive fuera de .mo-root y sus nodos se reutilizan:
   los observadores del museo (cielo, constelaciones) no se enteran.

   El índice usa el mismo lienzo como mapa estelar: al elegir un capítulo la
   cámara se zambulle en su estrella y el salto sigue desde ahí. */

const DEPART_MS = 440;
// Mientras el velo está cerrado, el cielo de la página descansa debajo
const WARP_COVER = {};
// Desde el mapa la partida es la zambullida: un poco más larga
const MAP_DEPART_MS = 580;
// Cada capítulo que cruzamos alarga un poco el tránsito
const cruiseFor = (crossed: number) => Math.min(950, 330 + 85 * crossed);
// Por debajo de esta distancia (en pantallas) basta el desplazamiento suave
const MIN_SCREENS = 1.6;
const MARKER_MS = 540;
const MARKER_POOL = 10;
const ARRIVAL_MS = 2400;
const HERO_COLOR = '#f2a35e';
const NEUTRAL_COLOR = '#c9a86a';

type Stop = {
  section: HTMLElement;
  top: number;
  number: string;
  color: string;
  kicker: string;
  title: string;
};

type Overlay = {
  root: HTMLDivElement;
  veil: HTMLDivElement;
  markers: HTMLSpanElement[];
  arrival: HTMLDivElement;
  kicker: HTMLSpanElement;
  title: HTMLElement;
  // El dibujante está listo (worker o hilo principal) y sabe dibujar el mapa
  ready: boolean;
  map: boolean;
  send: (message: WarpMessage, transfer?: Transferable[]) => void;
  // Quienes esperan a que el dibujante esté listo
  waiting: Set<() => void>;
};

let overlay: Overlay | null = null;
let warping = false;
let snapping = false;

/* Durante los cuadros que siguen al salto, los portales cruzados deben
   saltar a su nuevo progreso en vez de recorrerlo con su muelle: si no,
   cada uno dibujaría su viaje entero fuera de pantalla */
export const isScrollWarping = () => snapping;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const viewportSize = (): WarpSize => ({
  width: window.innerWidth,
  height: window.innerHeight,
  dpr: Math.min(window.devicePixelRatio || 1, 1.5),
});

const offsetIn = (root: HTMLElement, element: HTMLElement) =>
  element.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;

const toRgb = (color: string): Rgb => {
  const value = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as Rgb;
  }
  const rgb = /rgba?\(([^)]+)\)/i.exec(value);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number);
    if (parts.length === 3 && parts.every(Number.isFinite)) return parts as Rgb;
  }
  return [201, 168, 106];
};

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement) => {
  const element = document.createElement(tag);
  element.className = className;
  parent?.appendChild(element);
  return element;
};

/* ---------------- Capa del salto ---------------- */

const createOverlay = (): Overlay => {
  const root = make('div', 'mo-warp');
  root.hidden = true;
  root.setAttribute('aria-hidden', 'true');
  const veil = make('div', 'mo-warp-veil', root);
  let canvas = make('canvas', 'mo-warp-field', root);
  const track = make('div', 'mo-warp-markers', root);
  const markers = Array.from({ length: MARKER_POOL }, () => make('span', 'mo-warp-marker', track));
  const arrival = make('div', 'mo-warp-arrival', root);
  const kicker = make('span', 'mo-warp-kicker', arrival);
  const title = make('strong', 'mo-warp-title', arrival);
  document.body.appendChild(root);

  const state: Overlay = {
    root, veil, markers, arrival, kicker, title, ready: false, map: false, send: () => {}, waiting: new Set(),
  };
  const becameReady = () => {
    state.ready = true;
    if (pendingLabels && state.map) {
      syncLabels(state, pendingLabels);
      pendingLabels = null;
    }
    const waiting = [...state.waiting];
    state.waiting.clear();
    waiting.forEach((callback) => callback());
  };

  // Respaldo sin worker: el mismo dibujante en el hilo principal
  const onMainThread = () => {
    const fresh = make('canvas', 'mo-warp-field');
    canvas.replaceWith(fresh);
    canvas = fresh;
    state.ready = false;
    state.send = () => {};
    try {
      const renderer = createWarpRenderer(fresh);
      if (!renderer) return;
      const loop = createWarpLoop(renderer, (callback) => requestAnimationFrame(callback), viewportSize());
      state.send = loop.handle;
      state.map = renderer.hasMap;
      becameReady();
    } catch {
      // Sin WebGL queda el velo del DOM
    }
  };

  if ('transferControlToOffscreen' in canvas && typeof Worker !== 'undefined') {
    try {
      const worker = new Worker(new URL('./warpWorker.ts', import.meta.url), { type: 'module' });
      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage({ type: 'init', canvas: offscreen, ...viewportSize() }, [offscreen]);
      const fail = () => {
        worker.terminate();
        onMainThread();
      };
      worker.onerror = fail;
      worker.onmessage = (event: MessageEvent) => {
        const { type, map } = (event.data ?? {}) as { type?: string; map?: boolean };
        if (type === 'ready') {
          state.send = (message, transfer) => worker.postMessage(message, transfer ?? []);
          state.map = Boolean(map);
          becameReady();
        } else if (type === 'failed') {
          fail();
        }
      };
    } catch {
      onMainThread();
    }
  } else {
    onMainThread();
  }
  return state;
};

const ensureOverlay = () => {
  if (!overlay || !overlay.root.isConnected) overlay = createOverlay();
  return overlay;
};

/* La imagen de fondo de un portal que llega a mitad del salto se decodifica
   y se sube a la GPU justo durante el tránsito, y eso traba el hiperespacio
   (~100-300 ms). Ya en caché no cuesta nada: se piden antes */
const requested = new Set<string>();
const prefetch = (url: string | undefined, priority: 'high' | 'low') => {
  if (!url || requested.has(url)) return;
  requested.add(url);
  const image = new Image();
  image.fetchPriority = priority;
  image.src = url;
};

// Última posición conocida del puntero: el cursor del índice nace ahí
export const lastPointer = { x: -1, y: -1 };

/* Quien apunta a un capítulo en la navegación (riel, índice, menú) está
   por saltar allí: su imagen se pide ya. Solo esa: pedirlas todas a la vez
   compite con el propio salto */
const onIntent = (event: Event) => {
  if (event instanceof PointerEvent && event.pointerType === 'mouse') {
    lastPointer.x = event.clientX;
    lastPointer.y = event.clientY;
  }
  if (!(event.target instanceof Element)) return;
  const id = event.target.closest<HTMLElement>('[data-warp-target]')?.dataset.warpTarget;
  if (id) prefetch(document.getElementById(id)?.dataset.warpImage, 'high');
};

/* Prepara el worker y compila los shaders en un momento ocioso: el primer
   salto arranca al instante */
export const prewarmChapterWarp = () => {
  if (reducedMotion()) return () => {};
  const options = { passive: true, capture: true };
  for (const type of ['pointerover', 'pointerdown', 'focusin']) document.addEventListener(type, onIntent, options);
  const removeIntent = () => {
    for (const type of ['pointerover', 'pointerdown', 'focusin']) document.removeEventListener(type, onIntent, options);
  };
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(ensureOverlay, { timeout: 4000 });
    return () => {
      window.cancelIdleCallback(id);
      removeIntent();
    };
  }
  const id = window.setTimeout(ensureOverlay, 2500);
  return () => {
    window.clearTimeout(id);
    removeIntent();
  };
};

/* ---------------- Mapa estelar del índice ---------------- */

export type StarMapPoint = MapLabelEntry & { color: string };
export type StarMapSetup = {
  // Portada, capítulos y, al final, vitrina y archivo
  points: StarMapPoint[];
  here: number;
  hereLabel: string;
  region: MapRegion;
};

// Copia de la escena en este hilo: dice dónde está cada estrella bajo el puntero
const mapScene = createMapScene();
// Abierto y atendiendo al puntero / todavía en pantalla (abierto, cerrándose o en la zambullida)
let mapOpen = false;
let mapShown = false;
let mapGeneration = 0;
// Cuándo se abrió o empezó a cerrarse (reabrir a mitad del cierre retoma el velo)
let mapChangedAt = 0;
let labelsKey = '';
// Rótulos pedidos antes de que el dibujante estuviera listo
let pendingLabels: { points: MapLabelEntry[]; hereLabel: string } | null = null;

const sendMap = (state: Overlay, message: MapMessage) => {
  mapScene.handle(message);
  state.send(message);
};

const mapViewFor = (region: MapRegion) => ({ ...viewportSize(), region });

/* Los rótulos se dibujan solo cuando cambian (idioma, títulos, densidad) */
const syncLabels = (state: Overlay, setup: { points: MapLabelEntry[]; hereLabel: string }) => {
  const { dpr } = viewportSize();
  const key = JSON.stringify([setup.points.map((point) => [point.number, point.title]), setup.hereLabel, dpr]);
  if (key === labelsKey) return;
  labelsKey = key;
  void drawMapLabels(setup.points, setup.hereLabel, dpr).then((atlas) => {
    if (!atlas || key !== labelsKey || overlay !== state) {
      atlas?.image.close();
      return;
    }
    state.send({ type: 'map-labels', ...atlas }, [atlas.image]);
  }).catch(() => {
    labelsKey = '';
  });
};

/* Prepara los rótulos en un momento ocioso (cuando el dibujante exista):
   la primera apertura no paga por dibujar texto */
export const prepareStarMapLabels = (points: MapLabelEntry[], hereLabel: string) => {
  if (reducedMotion()) return;
  pendingLabels = { points, hereLabel };
  if (overlay?.ready && overlay.map) {
    syncLabels(overlay, pendingLabels);
    pendingLabels = null;
  }
};

/* Avisa cuando el dibujante esté listo (la primera apertura puede llegar
   antes del momento ocioso que lo prepara) */
export const whenStarMapReady = (callback: () => void) => {
  const state = ensureOverlay();
  if (state.ready) {
    callback();
    return () => {};
  }
  state.waiting.add(callback);
  return () => state.waiting.delete(callback);
};

/* Abre el mapa detrás del índice; false si todavía no puede dibujarse */
export const openStarMap = (setup: StarMapSetup) => {
  if (warping) return false;
  const state = ensureOverlay();
  if (!state.ready || !state.map) return false;
  const now = epochNow();
  // Si aún se estaba cerrando, la apertura retoma desde donde iba el velo
  const reopening = mapShown && !mapOpen ? Math.max(0, MAP_CLOSE_MS - (now - mapChangedAt)) : 0;
  // El rótulo de llegada de un salto reciente se retira con un fundido
  if (!mapShown) retireArrival(state);
  mapOpen = true;
  mapShown = true;
  mapGeneration += 1;
  mapChangedAt = now - Math.min(380, reopening);
  state.root.hidden = false;
  syncLabels(state, setup);
  sendMap(state, {
    type: 'map-open',
    at: mapChangedAt,
    colors: setup.points.map((point) => toRgb(point.color)),
    here: setup.here,
    reduced: reducedMotion(),
    view: mapViewFor(setup.region),
  });
  return true;
};

/* La región cambió (ventana redimensionada) o cambiaron los rótulos */
export const updateStarMap = (setup: StarMapSetup) => {
  if (!mapOpen || !overlay) return;
  syncLabels(overlay, setup);
  sendMap(overlay, { type: 'map-view', view: mapViewFor(setup.region) });
};

/* Señala una estrella (o ninguna con -1); la imagen de su capítulo se pide ya */
export const focusStarMap = (index: number, targetId?: string) => {
  if (!mapOpen || !overlay) return;
  sendMap(overlay, { type: 'map-focus', index, at: epochNow() });
  if (targetId) prefetch(document.getElementById(targetId)?.dataset.warpImage, 'high');
};

/* La estrella más cercana al punto (px CSS) dentro del radio, o -1. La ya
   señalada se suelta recién a un radio mayor: el borde no parpadea */
export const hitStarMap = (x: number, y: number, radius: number, current = -1) => {
  if (!mapOpen) return -1;
  const now = epochNow();
  let best = -1;
  let bestDistance = radius;
  // La portada no se elige: es solo el punto de partida
  for (let index = 1; index < mapScene.count; index++) {
    const at = mapScene.locate(index, now);
    if (!at) continue;
    const distance = Math.hypot(at.x - x, at.y - y) * (index === current ? 0.6 : 1);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
};

/* Cierra el mapa sin elegir: la cámara se aleja y el velo se levanta */
export const closeStarMap = () => {
  if (!mapOpen || !overlay) return;
  const state = overlay;
  mapOpen = false;
  mapChangedAt = epochNow();
  const generation = ++mapGeneration;
  sendMap(state, { type: 'map-close', at: mapChangedAt });
  window.setTimeout(() => {
    if (generation !== mapGeneration) return;
    mapShown = false;
    if (!warping) state.root.hidden = true;
  }, MAP_CLOSE_MS + 80);
};

/* ---------------- Datos del recorrido ---------------- */

const readStops = (root: HTMLElement): Stop[] =>
  [...root.querySelectorAll<HTMLElement>('.mo-sala[data-warp-number]')].map((section) => ({
    section,
    top: offsetIn(root, section),
    number: section.dataset.warpNumber ?? '',
    color: section.style.getPropertyValue('--accent') || NEUTRAL_COLOR,
    kicker: section.dataset.warpKicker ?? '',
    title: section.dataset.warpTitle ?? '',
  }));

const colorAt = (stops: Stop[], position: number) => {
  let color = HERO_COLOR;
  for (const stop of stops) if (stop.top <= position + 1) color = stop.color;
  return color;
};

/* ---------------- Animaciones del compositor ---------------- */

const play = (element: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions) =>
  element.animate(keyframes, { fill: 'both', ...options });

const cancelAll = (state: Overlay) => {
  for (const element of [state.veil, state.arrival, ...state.markers]) {
    element.getAnimations().forEach((animation) => animation.cancel());
  }
};

/* Los números de los capítulos que cruzamos pasan como hitos del camino:
   nacen en el punto de fuga y se abren hacia los bordes con perspectiva */
const launchMarkers = (state: Overlay, crossed: Stop[], direction: 1 | -1, departMs: number, cruiseMs: number) => {
  const shown = crossed.slice(-MARKER_POOL);
  if (!shown.length) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const first = departMs - 200;
  const last = Math.max(first, departMs + cruiseMs - MARKER_MS + 60);
  const spacing = shown.length > 1 ? (last - first) / (shown.length - 1) : 0;
  const far = 7;
  const near = 0.55;
  const samples = 10;
  shown.forEach((stop, index) => {
    const marker = state.markers[index];
    marker.textContent = stop.number;
    marker.style.setProperty('--marker', stop.color);
    // Cada hito llega por un lado distinto del túnel
    const angle = -0.6 + index * 2.39996;
    const ox = Math.cos(angle) * width * 0.3;
    const oy = Math.sin(angle) * height * 0.24;
    const frames: Keyframe[] = [];
    for (let i = 0; i <= samples; i++) {
      const k = i / samples;
      const z = far + (near - far) * k;
      const opacity = Math.min(1, Math.max(0, (far - z) / 2.6)) * Math.min(1, Math.max(0, (z - near) / 0.45));
      frames.push({
        offset: k,
        opacity,
        transform: `translate3d(${(ox / z).toFixed(1)}px, ${(oy / z).toFixed(1)}px, 0) scale(${(1 / z).toFixed(4)}) translate(-50%, -50%)`,
      });
    }
    // Hacia atrás, los hitos se alejan hacia el punto de fuga
    if (direction === -1) frames.reverse().forEach((frame, i) => { frame.offset = i / samples; });
    play(marker, frames, { duration: MARKER_MS, delay: first + spacing * index, easing: 'linear' });
  });
};

const retireArrival = (state: Overlay) => {
  const opacity = Number(getComputedStyle(state.arrival).opacity) || 0;
  state.arrival.getAnimations().forEach((animation) => animation.cancel());
  if (opacity <= 0.01) return;
  play(state.arrival, [
    { opacity, transform: 'translate(-50%, -50%) scale(1)' },
    { opacity: 0, transform: 'translate(-50%, -50%) scale(1.03)' },
  ], { duration: 260, easing: 'ease-out' });
};

const showArrival = (state: Overlay, delay: number) => {
  play(state.arrival, [
    { opacity: 0, transform: 'translate(-50%, -50%) scale(0.92)' },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.14 },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1.012)', offset: 0.72 },
    { opacity: 0, transform: 'translate(-50%, -50%) scale(1.02)' },
  ], { duration: ARRIVAL_MS, delay: delay + 140, easing: 'cubic-bezier(0.3, 0, 0.3, 1)' });
};

/* El velo del DOM solo cubre cuando no hay dibujante (sin WebGL o mientras
   el worker aún se prepara) */
const fallbackVeil = (state: Overlay, arriveIn: number | null) => {
  if (arriveIn === null) {
    play(state.veil, [{ opacity: 0 }, { opacity: 1 }], {
      duration: DEPART_MS - 30,
      easing: 'cubic-bezier(0.55, 0, 0.8, 0.35)',
    });
  } else {
    play(state.veil, [{ opacity: 1 }, { opacity: 0 }], {
      duration: 460,
      delay: arriveIn,
      easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
    });
  }
};

/* ---------------- Salto ---------------- */

const smoothTo = (root: HTMLElement, target: HTMLElement | 0) => {
  window.dispatchEvent(new CustomEvent('mo-warp'));
  if (smoothScrollTo(target)) return;
  if (target === 0) root.scrollTo({ top: 0, behavior: 'smooth' });
  else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const nextFrames = (count: number, callback: () => void) => {
  if (count <= 0) callback();
  else requestAnimationFrame(() => nextFrames(count - 1, callback));
};

export type WarpOptions = {
  // Índice de la estrella del mapa estelar desde la que parte el salto
  fromMap?: number;
};

/* Viaja hasta una sección (o hasta la portada con 0). Devuelve false si lo
   ignora porque ya hay un salto en curso */
export const warpTo = (target: HTMLElement | 0, options: WarpOptions = {}) => {
  const root = document.querySelector<HTMLElement>('.mo-root');
  if (!root || warping) return false;
  const top = target === 0 ? 0 : offsetIn(root, target);
  const from = root.scrollTop;
  if (reducedMotion()) {
    jumpScroll(root, top);
    return true;
  }
  // Desde el mapa siempre hay zambullida, aunque el destino quede cerca
  const mapIndex = options.fromMap ?? -1;
  const dive = mapIndex >= 0 && mapOpen && Boolean(overlay?.ready);
  if (!dive && Math.abs(top - from) < root.clientHeight * MIN_SCREENS) {
    smoothTo(root, target);
    return true;
  }

  if (target !== 0) prefetch(target.dataset.warpImage, 'high');
  const state = ensureOverlay();
  const stops = readStops(root);
  const direction: 1 | -1 = top > from ? 1 : -1;
  const destination = target === 0 ? null : stops.find((stop) => stop.section === target) ?? null;
  // Los inicios de capítulo que quedan entre aquí y el destino
  const crossed = direction === 1
    ? stops.filter((stop) => stop.top > from + 1 && stop.top < top - 1)
    : stops.filter((stop) => stop.top < from + 1 && stop.top > top + 1).reverse();
  const cruiseMs = cruiseFor(crossed.length);
  const departMs = dive ? MAP_DEPART_MS : DEPART_MS;
  const toColor = toRgb(target === 0 ? HERO_COLOR : destination?.color ?? NEUTRAL_COLOR);
  const drawn = state.ready;

  warping = true;
  lockSmoothScroll('warp', true);
  cancelAll(state);
  state.root.style.setProperty('--warp-to', toColor.join(', '));
  state.kicker.textContent = destination?.kicker ?? '';
  state.title.textContent = destination?.title ?? '';
  state.root.hidden = false;
  state.root.classList.add('is-active');

  const t0 = epochNow();
  if (dive) {
    // El mapa deja de atender al puntero; su estrella pasa a ser el punto de fuga
    mapOpen = false;
    mapGeneration += 1;
    mapScene.dive(mapIndex, t0, departMs);
  }
  if (drawn) {
    state.send({
      type: 'start',
      plan: {
        t0,
        departMs,
        cruiseMs,
        direction,
        // Nos zambullimos en el destino: el túnel ya tiene su color
        from: dive ? toColor : toRgb(colorAt(stops, from + root.clientHeight * 0.5)),
        to: toColor,
        ...(dive ? { map: mapIndex } : {}),
      },
      ...viewportSize(),
    });
  } else {
    fallbackVeil(state, null);
  }
  launchMarkers(state, crossed, direction, departMs, cruiseMs);

  window.setTimeout(() => {
    // La zambullida terminó: el mapa ya no está en pantalla
    if (dive) mapShown = false;
    // Con el velo cerrado: el salto real. Hasta la llegada nadie ve el cielo
    // de la página: no se dibuja y el destino se monta sin competir con él
    snapping = true;
    skyCovers.add(WARP_COVER);
    jumpScroll(root, top);
    nextFrames(5, () => { snapping = false; });
    // Dos cuadros para que el destino se monte y se pinte bajo el velo
    nextFrames(2, () => {
      const now = epochNow();
      const arriveAt = Math.max(t0 + DEPART_MS + cruiseMs, now + 40);
      const delay = arriveAt - now;
      if (drawn) state.send({ type: 'arrive', at: arriveAt });
      else fallbackVeil(state, delay);
      // El cielo vuelve un poco antes de que el velo empiece a abrirse
      window.setTimeout(() => skyCovers.delete(WARP_COVER), Math.max(0, delay - 60));
      if (destination) showArrival(state, delay);
      window.setTimeout(() => {
        state.root.classList.remove('is-active');
        lockSmoothScroll('warp', false);
        warping = false;
        // El rótulo de llegada se retira en cuanto el visitante sigue
        const dismiss = () => {
          root.removeEventListener('wheel', dismiss);
          root.removeEventListener('touchmove', dismiss);
          const opacity = Number(getComputedStyle(state.arrival).opacity) || 0;
          if (opacity <= 0.01) return;
          state.arrival.getAnimations().forEach((animation) => animation.cancel());
          play(state.arrival, [
            { opacity, transform: 'translate(-50%, -50%) scale(1)' },
            { opacity: 0, transform: 'translate(-50%, -50%) scale(1.03)' },
          ], { duration: 260, easing: 'ease-out' });
        };
        root.addEventListener('wheel', dismiss, { passive: true });
        root.addEventListener('touchmove', dismiss, { passive: true });
        window.setTimeout(() => {
          root.removeEventListener('wheel', dismiss);
          root.removeEventListener('touchmove', dismiss);
          if (!warping && !mapShown) {
            state.root.hidden = true;
            cancelAll(state);
          }
        }, Math.max(DROP_MS, ARRIVAL_MS + 200));
      }, delay);
    });
  }, departMs);
  return true;
};
