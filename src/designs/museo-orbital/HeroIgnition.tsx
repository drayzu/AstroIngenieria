import { useLayoutEffect, useRef, type RefObject } from 'react';
import { animate, type AnimationPlaybackControls } from 'framer-motion';
import './heroIgnition.css';

/* Fases de la intro, compartidas con el hero:
   dark   → todo oculto salvo el punto de luz y el cielo
   reveal → la estrella se enciende y el texto del hero empieza a entrar
   chrome → aparecen barra superior, marquesina y riel
   off    → intro terminada (o nunca empezó) */
export type IntroPhase = 'dark' | 'reveal' | 'chrome' | 'off';

const INTRO_KEY = 'mo-intro-v1';
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

/* Disco de la estrella en hero-00-estrella-roja.webp (1916×821), en
   fracciones de la imagen: el iris se abre primero justo a ese tamaño. */
const STAR = { fx: 0.499, fy: 0.4714, fr: 0.4, aspect: 1916 / 821 };

/* Guion en segundos. La ignición espera a que la imagen y la fuente del
   título estén listas (mínimo igniteMin, máximo igniteMax). */
const T = {
  glide: 1.0,
  chargeAt: 0.55,
  igniteMin: 1.45,
  igniteMax: 5,
  starOpen: 0.6,
  coverAt: 0.75,
  cover: 1.25,
  chromeAt: 0.9,
};

/* Una vez por sesión, nunca con movimiento reducido ni al entrar por un
   enlace profundo. ?intro la fuerza para probarla. */
export const shouldPlayIntro = () => {
  try {
    if (new URLSearchParams(window.location.search).has('intro')) return true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (window.location.hash) return false;
    return window.sessionStorage.getItem(INTRO_KEY) !== '1';
  } catch {
    return false;
  }
};

/* Retira el punto de luz de index.html (con fundido si no hay intro) */
export const releaseBootScreen = (fadeMs = 0) => {
  const boot = document.getElementById('mo-boot');
  if (!boot) return;
  if (!fadeMs) {
    boot.remove();
    return;
  }
  boot.style.transition = `opacity ${fadeMs}ms ease`;
  boot.style.opacity = '0';
  window.setTimeout(() => boot.remove(), fadeMs);
};

const dispatchWarp = (strength: number) =>
  window.dispatchEvent(new CustomEvent('mo-warp', { detail: { strength, direction: 1 } }));

export const HeroIgnition = ({
  heroRef,
  preload,
  onPhase,
}: {
  heroRef: RefObject<HTMLElement | null>;
  preload: () => Promise<unknown>;
  onPhase: (phase: IntroPhase) => void;
}) => {
  const layerRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const flareRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const echoRef = useRef<HTMLSpanElement>(null);
  const flashRef = useRef<HTMLSpanElement>(null);

  // Layout effect: el punto de React se pinta en el mismo cuadro en que se
  // retira el de index.html, sin parpadeo entre ambos.
  useLayoutEffect(() => {
    const layer = layerRef.current;
    // Al montar, el ref del padre aún no está asignado (React asigna los refs
    // de los hijos primero): se busca el hero desde la propia capa.
    const hero = heroRef.current ?? layer?.closest<HTMLElement>('.mo-hero') ?? null;
    const bg = hero?.querySelector<HTMLElement>('.mo-hero-bg-static');
    const dot = dotRef.current;
    const flare = flareRef.current;
    const ring = ringRef.current;
    const echo = echoRef.current;
    const flash = flashRef.current;
    if (!hero || !bg || !layer || !dot || !flare || !ring || !echo || !flash) {
      releaseBootScreen();
      onPhase('off');
      return;
    }
    try {
      window.sessionStorage.setItem(INTRO_KEY, '1');
    } catch {
      // Sin almacenamiento la intro simplemente puede repetirse
    }

    // Dónde cae la estrella con background-size: cover y posición 50% 50%
    const rect = bg.getBoundingClientRect();
    const wide = rect.width / rect.height > STAR.aspect;
    const rw = wide ? rect.width : rect.height * STAR.aspect;
    const rh = wide ? rect.width / STAR.aspect : rect.height;
    const lx = (rect.width - rw) / 2 + STAR.fx * rw;
    const ly = (rect.height - rh) / 2 + STAR.fy * rh;
    const starR = STAR.fr * rh;
    const coverR = Math.max(
      Math.hypot(lx, ly),
      Math.hypot(rect.width - lx, ly),
      Math.hypot(lx, rect.height - ly),
      Math.hypot(rect.width - lx, rect.height - ly),
    );
    const sx = rect.left + lx;
    const sy = rect.top + ly;

    let radius = 0;
    const setRadius = (value: number) => {
      radius = value;
      hero.style.setProperty('--ignite-r', `${value.toFixed(1)}px`);
    };
    hero.style.setProperty('--ignite-x', `${lx.toFixed(1)}px`);
    hero.style.setProperty('--ignite-y', `${ly.toFixed(1)}px`);
    setRadius(0);
    layer.style.setProperty('--sx', `${sx.toFixed(1)}px`);
    layer.style.setProperty('--sy', `${sy.toFixed(1)}px`);
    layer.style.setProperty('--star-d', `${(starR * 2).toFixed(1)}px`);

    // El punto nace donde estaba el de arranque y viaja al centro de la estrella
    const bootX = window.innerWidth / 2;
    const bootY = (window.innerHeight - 46) * 0.4675;
    dot.style.transform = `translateX(${bootX}px) translateY(${bootY}px)`;
    releaseBootScreen();

    const controls: AnimationPlaybackControls[] = [];
    const timers: number[] = [];
    const run = (control: AnimationPlaybackControls) => controls.push(control);
    const later = (fn: () => void, seconds: number) => {
      timers.push(window.setTimeout(fn, seconds * 1000));
    };
    let ignited = false;
    let finished = false;
    let cancelled = false;

    const clearIris = () => {
      hero.style.removeProperty('--ignite-r');
      hero.style.removeProperty('--ignite-x');
      hero.style.removeProperty('--ignite-y');
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      onPhase('off');
    };

    // Llegada desde el hiperespacio: el cielo entra estirado y frena
    dispatchWarp(40);
    later(() => dispatchWarp(30), 0.16);
    later(() => dispatchWarp(22), 0.32);
    later(() => dispatchWarp(12), 0.5);

    run(animate(dot, { x: [bootX, sx], y: [bootY, sy] }, { duration: T.glide, ease: EASE_OUT }));
    run(animate(dot, { scale: [1, 2.2, 1.5] }, { duration: 0.9, delay: T.chargeAt, ease: 'easeInOut' }));
    run(animate(flare, { scaleX: [0, 1], opacity: [0, 0.9] }, { duration: 0.9, delay: T.chargeAt + 0.1, ease: EASE_OUT }));

    const ignite = () => {
      if (ignited || finished) return;
      ignited = true;
      onPhase('reveal');
      // Primero se enciende el disco de la estrella, luego se revela el cielo
      run(animate(radius, starR * 1.06, { duration: T.starOpen, ease: EASE_OUT, onUpdate: setRadius }));
      later(() => {
        run(animate(radius, coverR, { duration: T.cover, ease: EASE_IN_OUT, onUpdate: setRadius }));
      }, T.coverAt);
      run(animate(dot, { scale: 5, opacity: 0 }, { duration: 0.4, ease: EASE_OUT }));
      run(animate(flare, { scaleX: 1.8, opacity: 0 }, { duration: 1, ease: EASE_OUT }));
      run(animate(flash, { opacity: [0, 1, 0] }, { duration: 1, times: [0, 0.12, 1] }));
      run(animate(ring, { scale: [1, 2.8], opacity: [0.95, 0] }, { duration: 1.4, ease: EASE_OUT }));
      run(animate(echo, { scale: [1, 2], opacity: [0.6, 0] }, { duration: 1.4, delay: 0.14, ease: EASE_OUT }));
      later(() => onPhase('chrome'), T.chromeAt);
      later(finish, T.coverAt + T.cover + 0.1);
    };

    const fontsReady = document.fonts
      ? Promise.all([
          document.fonts.load('520 1em "Fraunces Variable"'),
          document.fonts.load('1em "Space Grotesk Variable"'),
        ]).catch(() => undefined)
      : Promise.resolve();
    const minWait = new Promise<void>((resolve) => later(resolve, T.igniteMin));
    const maxWait = new Promise<void>((resolve) => later(resolve, T.igniteMax));
    void Promise.race([Promise.all([preload(), fontsReady, minWait]), maxWait]).then(() => {
      if (!cancelled) ignite();
    });

    // Cualquier gesto salta la intro: la estrella se abre de golpe
    const skip = () => {
      if (finished || cancelled) return;
      controls.forEach((control) => control.stop());
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.length = 0;
      if (!ignited) {
        ignited = true;
        onPhase('reveal');
      }
      run(animate(radius, coverR, { duration: 0.45, ease: EASE_OUT, onUpdate: setRadius }));
      run(animate(layer, { opacity: 0 }, { duration: 0.25 }));
      later(() => onPhase('chrome'), 0.15);
      later(finish, 1);
    };
    const skipEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    skipEvents.forEach((name) => window.addEventListener(name, skip, { passive: true }));

    return () => {
      cancelled = true;
      skipEvents.forEach((name) => window.removeEventListener(name, skip));
      controls.forEach((control) => control.stop());
      timers.forEach((timer) => window.clearTimeout(timer));
      if (finished) clearIris();
    };
  }, [heroRef, onPhase, preload]);

  return (
    <div ref={layerRef} className="mo-ignite" aria-hidden="true">
      <span ref={flashRef} className="mo-ignite-flash" />
      <span className="mo-ignite-anchor">
        <span ref={flareRef} className="mo-ignite-flare" />
        <span ref={ringRef} className="mo-ignite-ring" />
        <span ref={echoRef} className="mo-ignite-ring is-echo" />
      </span>
      <span ref={dotRef} className="mo-ignite-dot" />
    </div>
  );
};
