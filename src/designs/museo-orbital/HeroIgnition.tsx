import { useLayoutEffect, useRef, type RefObject } from 'react';
import { animate, type AnimationPlaybackControls } from 'framer-motion';
import { lockSmoothScroll } from '../shared/smoothScroll';
import { livingSignal, starFrame } from './living/livingHero';
import './heroIgnition.css';

/* Fases de la intro, compartidas con el hero:
   dark   → todo oculto salvo el punto de luz y el cielo
   reveal → la estrella se enciende y el texto del hero empieza a entrar
   chrome → aparecen barra superior, marquesina y riel
   off    → intro terminada (o nunca empezó) */
export type IntroPhase = 'dark' | 'reveal' | 'chrome' | 'off';

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

/* En cada visita, salvo con movimiento reducido o al entrar por un enlace a
   una obra (su sala de estudio se abre encima y taparía la intro). */
export const shouldPlayIntro = () => {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return !window.location.hash;
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

/* Con la estrella viva la estrella nace en el centro de la
   pantalla: el punto colapsa (disco de acreción y anillos que se cierran),
   estalla con onda de choque y rayos, y la escena la lleva después a su
   lugar junto al título. */
const LIVING_IGNITE_MIN = 2.05;
// Todo cae hacia el punto acelerando, como absorbido
const EASE_SWALLOW = [0.6, 0, 0.98, 0.55] as const;

export const HeroIgnition = ({
  heroRef,
  preload,
  onPhase,
  living = false,
}: {
  heroRef: RefObject<HTMLElement | null>;
  preload: () => Promise<unknown>;
  onPhase: (phase: IntroPhase) => void;
  living?: boolean;
}) => {
  const layerRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const flareRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const echoRef = useRef<HTMLSpanElement>(null);
  const flashRef = useRef<HTMLSpanElement>(null);
  const implodeRef = useRef<HTMLSpanElement>(null);
  const implodeEchoRef = useRef<HTMLSpanElement>(null);
  const swirlRef = useRef<HTMLSpanElement>(null);
  const raysRef = useRef<HTMLSpanElement>(null);
  const redRef = useRef<HTMLSpanElement>(null);
  const blueRef = useRef<HTMLSpanElement>(null);

  // Layout effect: el punto de React se pinta en el mismo cuadro en que se
  // retira el de index.html, sin parpadeo entre ambos.
  useLayoutEffect(() => {
    const layer = layerRef.current;
    // Al montar, el ref del padre aún no está asignado (React asigna los refs
    // de los hijos primero): se busca el hero desde la propia capa.
    const hero = heroRef.current ?? layer?.closest<HTMLElement>('.mo-hero') ?? null;
    const bg = hero?.querySelector<HTMLElement>(living ? '.mo-living-stage' : '.mo-hero-bg-static');
    const dot = dotRef.current;
    const flare = flareRef.current;
    const ring = ringRef.current;
    const echo = echoRef.current;
    const flash = flashRef.current;
    const implode = implodeRef.current;
    const implodeEcho = implodeEchoRef.current;
    const swirl = swirlRef.current;
    const rays = raysRef.current;
    const red = redRef.current;
    const blue = blueRef.current;
    if (!hero || !bg || !layer || !dot || !flare || !ring || !echo || !flash || !implode || !implodeEcho || !swirl || !rays || !red || !blue) {
      releaseBootScreen();
      onPhase('off');
      return;
    }

    // Dónde cae la estrella: en la imagen (cover, 50% 50%) o en la escena viva
    const rect = bg.getBoundingClientRect();
    let lx: number;
    let ly: number;
    let starR: number;
    if (living) {
      // Nace en el centro, donde aparece el punto de arranque, algo más grande
      lx = rect.width / 2;
      ly = window.innerHeight * 0.5 - rect.top;
      starR = starFrame(rect.width, rect.height).r * 1.12;
      livingSignal.intro = { fx: lx / rect.width, fy: ly / rect.height, fr: starR / rect.height };
      livingSignal.ignitedAt = 0;
    } else {
      const wide = rect.width / rect.height > STAR.aspect;
      const rw = wide ? rect.width : rect.height * STAR.aspect;
      const rh = wide ? rect.width / STAR.aspect : rect.height;
      lx = (rect.width - rw) / 2 + STAR.fx * rw;
      ly = (rect.height - rh) / 2 + STAR.fy * rh;
      starR = STAR.fr * rh;
    }
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
    const bootY = window.innerHeight * 0.5;
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
    // Hasta la ignición el scroll con inercia queda detenido
    lockSmoothScroll('intro', true);

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
    let held: AnimationPlaybackControls | null = null;
    // El estallido espera a que el colapso termine de verdad: si la escena
    // tarda en compilar, las animaciones arrancan tarde y un reloj fijo
    // haría estallar la estrella con los anillos a medio cerrar
    let gathered: Promise<unknown> = Promise.resolve();
    if (living) {
      // Colapso: el disco de acreción y los anillos se cierran hasta
      // desaparecer dentro del punto, cada vez más rápido; el latido se
      // acelera con ellos y al final el punto se contrae: contiene el aliento
      run(animate(swirl, { scale: [1.6, 0.03], rotate: [0, 1080], opacity: [0, 0.9, 1, 0] }, { duration: 1.3, delay: 0.45, ease: EASE_SWALLOW, opacity: { duration: 1.3, delay: 0.45, times: [0, 0.2, 0.86, 1] } }));
      run(animate(implode, { scale: [3.4, 0.03], opacity: [0, 0.95, 0.95, 0] }, { duration: 1.25, delay: 0.55, ease: EASE_SWALLOW, opacity: { duration: 1.25, delay: 0.55, times: [0, 0.25, 0.88, 1] } }));
      run(animate(implodeEcho, { scale: [4.6, 0.03], opacity: [0, 0.55, 0.55, 0] }, { duration: 1.15, delay: 0.7, ease: EASE_SWALLOW, opacity: { duration: 1.15, delay: 0.7, times: [0, 0.25, 0.88, 1] } }));
      const inhale = animate(dot, { scale: [1, 1.5, 1.15, 1.8, 1.35, 2.3, 2.9, 0.75] }, { duration: 1.5, delay: 0.45, times: [0, 0.18, 0.32, 0.46, 0.58, 0.72, 0.86, 1], ease: 'easeInOut' });
      run(inhale);
      gathered = new Promise<void>((resolve) => { void inhale.then(() => later(resolve, 0.12)); });
      run(animate(flare, { scaleX: [0, 0.55, 0.95, 0.004], opacity: [0, 0.7, 1, 0] }, { duration: 1.5, delay: 0.45, times: [0, 0.4, 0.78, 1], ease: 'easeInOut' }));
      // Si la página aún no está lista, el punto late contenido en lugar de
      // dejar los anillos congelados
      void gathered.then(() => {
        if (!ignited && !cancelled) held = animate(dot, { scale: [0.75, 1.05, 0.75] }, { duration: 0.9, repeat: Infinity, ease: 'easeInOut' });
      });
    } else {
      run(animate(dot, { scale: [1, 2.2, 1.5] }, { duration: 0.9, delay: T.chargeAt, ease: 'easeInOut' }));
      run(animate(flare, { scaleX: [0, 1], opacity: [0, 0.9] }, { duration: 0.9, delay: T.chargeAt + 0.1, ease: EASE_OUT }));
    }

    const ignite = () => {
      if (ignited || finished) return;
      ignited = true;
      lockSmoothScroll('intro', false);
      onPhase('reveal');
      if (living) {
        // Estalla: la escena infla la estrella, la onda de choque se separa en
        // colores, los rayos se abren y el cielo sale empujado
        livingSignal.ignitedAt = performance.now();
        dispatchWarp(40);
        later(() => dispatchWarp(24), 0.18);
        held?.stop();
        run(animate([implode, implodeEcho, swirl], { opacity: 0 }, { duration: 0.12 }));
        run(animate(rays, { scale: [0.35, 2.4], opacity: [0, 0.9, 0], rotate: [0, 14] }, { duration: 1.1, times: [0, 0.18, 1], ease: EASE_OUT }));
        run(animate(red, { scale: [0.15, 3.1], opacity: [0.8, 0] }, { duration: 1.5, delay: 0.03, ease: EASE_OUT }));
        run(animate(blue, { scale: [0.15, 2.85], opacity: [0.8, 0] }, { duration: 1.5, delay: 0.07, ease: EASE_OUT }));
        run(animate(ring, { scale: [0.15, 3], opacity: [1, 0] }, { duration: 1.5, ease: EASE_OUT }));
        run(animate(echo, { scale: [0.15, 2.2], opacity: [0.7, 0] }, { duration: 1.6, delay: 0.16, ease: EASE_OUT }));
      } else {
        // Primero se enciende el disco de la estrella, luego se revela el cielo
        run(animate(radius, starR * 1.06, { duration: T.starOpen, ease: EASE_OUT, onUpdate: setRadius }));
        later(() => {
          run(animate(radius, coverR, { duration: T.cover, ease: EASE_IN_OUT, onUpdate: setRadius }));
        }, T.coverAt);
      }
      run(animate(dot, { scale: 5, opacity: 0 }, { duration: 0.4, ease: EASE_OUT }));
      // Con la estrella viva la línea estaba fundida en el punto: vuelve a dispararse desde él
      if (living) run(animate(flare, { scaleX: [0.02, 2.6], opacity: [1, 0] }, { duration: 1.2, ease: EASE_OUT }));
      else run(animate(flare, { scaleX: 1.8, opacity: 0 }, { duration: 1, ease: EASE_OUT }));
      run(animate(flash, { opacity: [0, 1, 0] }, { duration: living ? 1.3 : 1, times: [0, 0.1, 1] }));
      if (!living) {
        run(animate(ring, { scale: [1, 2.8], opacity: [0.95, 0] }, { duration: 1.4, ease: EASE_OUT }));
        run(animate(echo, { scale: [1, 2], opacity: [0.6, 0] }, { duration: 1.4, delay: 0.14, ease: EASE_OUT }));
      }
      later(() => onPhase('chrome'), living ? 1.5 : T.chromeAt);
      later(finish, living ? 2.8 : T.coverAt + T.cover + 0.1);
    };

    const fontsReady = document.fonts
      ? Promise.all([
          document.fonts.load('520 1em "Fraunces Variable"'),
          document.fonts.load('1em "Space Grotesk Variable"'),
        ]).catch(() => undefined)
      : Promise.resolve();
    const minWait = new Promise<void>((resolve) => later(resolve, living ? LIVING_IGNITE_MIN : T.igniteMin));
    const maxWait = new Promise<void>((resolve) => later(resolve, T.igniteMax));
    void Promise.race([Promise.all([preload(), fontsReady, minWait, gathered]), maxWait]).then(() => {
      if (!cancelled) ignite();
    });

    // Esc salta la intro: la estrella se abre de golpe
    const skip = () => {
      if (finished || cancelled) return;
      controls.forEach((control) => control.stop());
      held?.stop();
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.length = 0;
      if (!ignited) {
        ignited = true;
        lockSmoothScroll('intro', false);
        onPhase('reveal');
        // Saltada: la estrella aparece ya en su lugar
        if (living) livingSignal.ignitedAt = performance.now() - 3000;
      }
      if (!living) run(animate(radius, coverR, { duration: 0.45, ease: EASE_OUT, onUpdate: setRadius }));
      run(animate(layer, { opacity: 0 }, { duration: 0.25 }));
      later(() => onPhase('chrome'), 0.15);
      later(finish, 1);
    };
    // Hasta la ignición la página no se desplaza: un scroll accidental no
    // arrastra el hero ni rompe la escena
    const scrollKeys = new Set([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End']);
    const blockScroll = (event: Event) => {
      if (!ignited) event.preventDefault();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        skip();
        return;
      }
      if (event.target instanceof HTMLElement && event.target.closest('button, input, textarea, select')) return;
      if (!ignited && scrollKeys.has(event.key)) event.preventDefault();
    };
    window.addEventListener('wheel', blockScroll, { passive: false });
    window.addEventListener('touchmove', blockScroll, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      cancelled = true;
      lockSmoothScroll('intro', false);
      window.removeEventListener('wheel', blockScroll);
      window.removeEventListener('touchmove', blockScroll);
      window.removeEventListener('keydown', onKeyDown);
      controls.forEach((control) => control.stop());
      held?.stop();
      timers.forEach((timer) => window.clearTimeout(timer));
      if (finished) clearIris();
    };
  }, [heroRef, onPhase, preload, living]);

  return (
    <div ref={layerRef} className="mo-ignite" aria-hidden="true">
      <span ref={flashRef} className="mo-ignite-flash" />
      <span className="mo-ignite-anchor">
        <span ref={flareRef} className="mo-ignite-flare" />
        <span ref={ringRef} className="mo-ignite-ring" />
        <span ref={echoRef} className="mo-ignite-ring is-echo" />
        <span ref={redRef} className="mo-ignite-ring is-red" />
        <span ref={blueRef} className="mo-ignite-ring is-blue" />
        <span ref={raysRef} className="mo-ignite-rays" />
        <span ref={swirlRef} className="mo-ignite-swirl" />
        <span ref={implodeRef} className="mo-ignite-implode" />
        <span ref={implodeEchoRef} className="mo-ignite-implode is-echo" />
      </span>
      <span ref={dotRef} className="mo-ignite-dot" />
    </div>
  );
};
