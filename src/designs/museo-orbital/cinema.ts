import { smoothScrollLocked } from '../shared/smoothScroll';
import { isScrollWarping, warpTo } from './chapterWarp';
import { steerLook } from './lookAround';
import './cinema.css';

/* Modo cine: un piloto automático recorre el museo como una película.

   No tiene guion ni tiempos: lee la página al andar. Cada tramo tiene su
   velocidad según lo que es (portal, sala, final) y se vuelve a medir cada
   poco, así que un portal o una obra nuevos entran solos en el recorrido.
   Las pausas de los portales ya son scroll extra: a velocidad pareja, el
   piloto las vive más lento sin saber que existen.

   Lo que avanza por tiempo y no por scroll avisa con `holdCinema`: la
   intro detiene al piloto y una obra del capítulo 3 que se arma lo hace
   avanzar despacio mientras está a la vista. Un
   gesto del visitante (rueda, toque, clic o tecla) le devuelve el control. */

// Velocidades, en altos de pantalla por segundo
const PORTAL = 0.42;
const FINALE = 0.36;
const PASSAGE = 0.6;
// Las salas se recorren por obra, dentro de un margen
const SECONDS_PER_WORK = 1.85;
const ROOM_MIN = 0.22;
const ROOM_MAX = 1.1;
// Ajuste fino por capítulo, a ojo, sobre la velocidad que sale sola (más
// de 1 es más rápido). Un capítulo que no está aquí no necesita nada
const TUNING: Record<string, { portal?: number; room?: number }> = {
  'sala-planetary': { portal: 1.2 },
  'sala-energy': { portal: 1.2 },
  'sala-propulsion': { portal: 1.2, room: 0.8 },
  'sala-stellar': { portal: 1.2 },
  'sala-civilizations': { portal: 0.85 },
};
// Cuánto tarda en tomar una velocidad nueva (s): frena y arranca suave
const EASE_S = 0.7;
// La portada se contempla un rato antes de partir
const COVER_DWELL_S = 3.5;
// Una obra ocupada frena el piloto a esta fracción mientras su centro
// cruza esta franja de la pantalla: se ve armarse sin detener la visita
const BUSY_CRAWL = 0.22;
const BUSY_BAND: [number, number] = [0.08, 0.6];
const REMEASURE_MS = 1500;
// Velocidades que se eligen volviendo a pulsar la C, en orden
const RATES = [1, 1.5, 2];

interface Stretch { from: number; to: number; speed: number }
interface Plan { stretches: Stretch[]; vitrina: number; finale: number; screen: number; end: number }

let running = false;
let frameId = 0;
let removeListeners: (() => void) | null = null;
let hint: HTMLElement | null = null;
let rate = RATES[0];
let hintFor: (rate: number) => string = () => '';
const holds = new Set<string | Element>();
// Dónde queda cada obra ocupada (su borde superior y su alto en el scroll):
// se mide al verla y al medir la página, no en cada cuadro
const boxes = new Map<Element, [number, number]>();

export const isCinemaRunning = () => running;

/* La siguiente velocidad (1×, 1,5×, 2× y de vuelta a 1×), con su aviso */
export const cycleCinemaRate = () => {
  rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
  if (running) showHint(hintFor(rate));
};

/* Lo que corre por su cuenta pide que el piloto espere. Con un nombre,
   espera donde esté; con un elemento, solo cuando llega al centro */
export const holdCinema = (key: string | Element, busy: boolean) => {
  if (busy) holds.add(key);
  else holds.delete(key);
};

const topIn = (root: HTMLElement, element: Element) =>
  element.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;

const measure = (root: HTMLElement): Plan => {
  boxes.clear();
  const screen = root.clientHeight;
  const stretches: Stretch[] = [];
  const add = (element: Element, speed: (length: number) => number, part?: 'portal' | 'room') => {
    const from = topIn(root, element);
    const to = from + (element as HTMLElement).offsetHeight - screen;
    const tune = part ? TUNING[element.closest('.mo-sala')?.id ?? '']?.[part] ?? 1 : 1;
    if (to > from) stretches.push({ from, to, speed: speed(to - from) * tune });
  };
  root.querySelectorAll('.mo-portal').forEach((portal) => add(portal, () => PORTAL * screen, 'portal'));
  root.querySelectorAll('.mo-corridor, .mo-orbit, .mo-room').forEach((room) => {
    const works = Math.max(1, room.querySelectorAll('.mo-obra').length);
    add(room, (length) => {
      const speed = length / (works * SECONDS_PER_WORK);
      return Math.min(ROOM_MAX * screen, Math.max(ROOM_MIN * screen, speed));
    }, 'room');
  });
  root.querySelectorAll('.mo-finale:not(.is-static)').forEach((finale) => add(finale, () => FINALE * screen));
  const vitrina = root.querySelector('#vitrina');
  const finale = root.querySelector('.mo-finale');
  return {
    screen,
    end: root.scrollHeight - screen,
    stretches: stretches.sort((a, b) => a.from - b.from),
    vitrina: vitrina ? topIn(root, vitrina) : Number.NaN,
    finale: finale ? topIn(root, finale) : Number.NaN,
  };
};

const speedAt = (stretches: Stretch[], at: number, screen: number) =>
  stretches.find((stretch) => at >= stretch.from && at < stretch.to)?.speed ?? PASSAGE * screen;

// Algo que corre por su cuenta: con nombre se espera (0), una obra a la
// vista se deja ver avanzando despacio; sin nada, a velocidad plena (1)
const pace = (root: HTMLElement, at: number, screen: number) => {
  if (smoothScrollLocked() || isScrollWarping()) return 0;
  let factor = 1;
  for (const key of holds) {
    if (typeof key === 'string') return 0;
    if (!key.isConnected) {
      holds.delete(key);
      continue;
    }
    let box = boxes.get(key);
    if (!box) {
      box = [topIn(root, key), (key as HTMLElement).offsetHeight];
      boxes.set(key, box);
    }
    const center = (box[0] + box[1] / 2 - at) / screen;
    if (center >= BUSY_BAND[0] && center <= BUSY_BAND[1]) factor = BUSY_CRAWL;
  }
  return factor;
};

const swallowNextClick = () => {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    window.removeEventListener('click', swallow, true);
  };
  window.addEventListener('click', swallow, true);
  window.setTimeout(() => window.removeEventListener('click', swallow, true), 600);
};

const showHint = (text: string) => {
  hint?.remove();
  hint = document.createElement('div');
  hint.className = 'mo-cine-hint';
  hint.setAttribute('role', 'status');
  hint.textContent = text;
  // Vive en <body>: tocar el árbol del museo lo haría medirse entero
  document.body.append(hint);
};

export const stopCinema = () => {
  if (!running) return;
  running = false;
  cancelAnimationFrame(frameId);
  removeListeners?.();
  removeListeners = null;
  hint?.remove();
  hint = null;
  document.documentElement.classList.remove('mo-cine');
  steerLook(0, 0);
};

/* `hint` arma el aviso para cada velocidad */
export const startCinema = (root: HTMLElement, hint: (rate: number) => string) => {
  if (running) return;
  running = true;
  hintFor = hint;
  document.documentElement.classList.add('mo-cine');
  showHint(hint(rate));

  // Cualquier gesto devuelve el control; la C la atiende quien la enciende
  const takeOver = (event: Event) => {
    if (event instanceof KeyboardEvent && (event.key === 'c' || event.key === 'C')) return;
    stopCinema();
    // El toque que detiene la película no abre además lo que había debajo
    if (event.type === 'pointerdown' || event.type === 'touchstart') swallowNextClick();
  };
  const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
  events.forEach((name) => window.addEventListener(name, takeOver, { capture: true, passive: true }));
  // La posición se lee al desplazarse, no en cada cuadro: leerla con la
  // página a medio dibujar obliga a medir todo el museo
  let seen = root.scrollTop;
  const onScroll = () => {
    seen = root.scrollTop;
  };
  root.addEventListener('scroll', onScroll, { passive: true });
  removeListeners = () => {
    events.forEach((name) => window.removeEventListener(name, takeOver, { capture: true }));
    root.removeEventListener('scroll', onScroll);
  };

  let at = seen;
  let speed = 0;
  let last = performance.now();
  let plan = measure(root);
  let measured = last;
  let started = -1;
  // Arrancar desde la portada (o volver a ella desde el final) la contempla
  let coverUntil = at < 2 ? Number.POSITIVE_INFINITY : 0;
  // La vitrina se cruza con el salto una vez por vuelta
  let skipped = false;

  const step = (now: number) => {
    if (!running) return;
    frameId = requestAnimationFrame(step);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    // Otro movió la página (el final vuelve al inicio, un salto): seguir desde ahí
    if (Math.abs(seen - at) > 4) {
      at = seen;
      speed = 0;
      if (at < 2) coverUntil = Number.POSITIVE_INFINITY;
    }
    if (now - measured > REMEASURE_MS) {
      plan = measure(root);
      measured = now;
    }
    const { screen, end } = plan;

    const factor = pace(root, at, screen);
    if (factor === 0) {
      speed = 0;
      if (coverUntil !== 0) coverUntil = Number.POSITIVE_INFINITY;
      return;
    }
    if (coverUntil === Number.POSITIVE_INFINITY) coverUntil = now + (COVER_DWELL_S * 1000) / rate;
    if (now < coverUntil) return;
    coverUntil = 0;
    if (started < 0) started = now;

    // La vitrina y el archivo son para leer: se cruzan con el salto
    if (!skipped && at + screen >= plan.vitrina && at < plan.finale - 2) {
      skipped = true;
      const finale = root.querySelector<HTMLElement>('.mo-finale');
      if (finale && warpTo(finale)) return;
    }
    if (at < 2) skipped = false;

    const target = speedAt(plan.stretches, at, screen) * factor * rate;
    speed += (target - speed) * (1 - Math.exp(-dt / EASE_S));
    const next = Math.min(end, at + speed * dt);
    if (next === at && at >= end - 1) {
      stopCinema();
      return;
    }
    at = next;
    seen = next;
    root.scrollTop = next;

    // La cámara respira: mira un poco a los lados y arriba, muy despacio
    const t = (now - started) / 1000;
    steerLook(0.55 * Math.sin(t * 0.21), 0.4 * Math.sin(t * 0.15 + 1.3));
  };
  frameId = requestAnimationFrame(step);
};
