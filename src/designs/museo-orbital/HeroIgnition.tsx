import { useLayoutEffect, useRef, type CSSProperties, type RefObject } from 'react';
import { animate, type AnimationPlaybackControls } from 'framer-motion';
import { lockSmoothScroll } from '../shared/smoothScroll';
import { livingSignal, starFrame } from './living/livingHero';
import { FLIGHT } from './living/nebulaFlight';
import { skyCovers } from './roomShared';
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

/* Durante el vuelo un fondo fijo y opaco tapa el cielo 2D: el cielo no se
   dibuja (su cuadro competiría con la escena) hasta que el fondo empieza a
   desvanecerse al aterrizar */
const FLIGHT_COVER = {};
const setFlight = (hero: HTMLElement, value: '' | 'landing' | null) => {
  if (value === null) hero.removeAttribute('data-flight');
  else hero.setAttribute('data-flight', value);
  if (value === '') skyCovers.add(FLIGHT_COVER);
  else skyCovers.delete(FLIGHT_COVER);
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

/* El cierre ya hizo la muerte de la estrella y la caída del gas al punto: al
   volver desde él la intro no repite el colapso ni estalla. La estrella nace
   de esa nebulosa como nacen de verdad: el gas forma un disco que gira
   alrededor del punto, la protoestrella dispara dos chorros por sus polos y,
   al encenderse la fusión, su viento despeja la nube. Una sola explosión en
   todo el ciclo, la de la muerte. */
export const introSeam = { fromFinale: false };

const dispatchWarp = (strength: number) =>
  window.dispatchEvent(new CustomEvent('mo-warp', { detail: { strength, direction: 1 } }));

/* Con la estrella viva la estrella nace en el centro de la
   pantalla: el punto colapsa (disco de acreción y anillos que se cierran),
   estalla con onda de choque y rayos, y la escena la lleva después a su
   lugar junto al título. */
const LIVING_IGNITE_MIN = 2.05;
// Pseudoazar con semilla: los rayos y las chispas son iguales en cada visita
const seeded = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/* Rayos del estallido: haces irregulares, cada uno con su ángulo, grosor,
   brillo y tono, con bordes suaves (un degradado cónico armado a mano) */
const RAY_COUNT = 46;
const RAYS_GRADIENT = (() => {
  const step = 360 / RAY_COUNT;
  const stops = Array.from({ length: RAY_COUNT }, (_, index) => {
    const angle = index * step + (seeded(index + 3) - 0.5) * step * 0.7;
    const width = 0.5 + seeded(index + 17) ** 2 * 2.4;
    const alpha = 0.25 + seeded(index + 29) * 0.7;
    const color = seeded(index + 41) > 0.6 ? `rgba(255, 168, 112, ${alpha.toFixed(2)})` : `rgba(255, 222, 186, ${alpha.toFixed(2)})`;
    return `transparent ${(angle - width).toFixed(2)}deg, ${color} ${angle.toFixed(2)}deg, transparent ${(angle + width).toFixed(2)}deg`;
  });
  return `conic-gradient(from 0deg, ${stops.join(', ')})`;
})();

/* Chispas: vetas de luz que salen disparadas desde el borde de la estrella a
   distintas velocidades y se frenan al alejarse */
const SPARKS = Array.from({ length: 40 }, (_, index) => ({
  angle: (index / 40) * 360 + (seeded(index + 53) - 0.5) * 9,
  reach: 1.6 + seeded(index + 61) * 2.6,
  length: 30 + seeded(index + 73) * 120,
  duration: 0.75 + seeded(index + 89) * 0.75,
  delay: seeded(index + 97) * 0.14,
  warm: seeded(index + 101) > 0.55,
}));

// Desde el cierre: lo que tarda el punto en calentarse antes de encenderse
const GENTLE_WARM = 0.9;
// Desde el encendido, cuándo nace la estrella bajo el resplandor ya alto
const GENTLE_GLOW = 0.35;
// Desde el encendido, cuándo el viento estelar despeja la nube
const GENTLE_WIND = 1.3;
// Y cuánto tiene que estar quieta la rueda para devolver el scroll
const WHEEL_CALM_MS = 450;
// Todo cae hacia el punto acelerando, como absorbido
const EASE_SWALLOW = [0.6, 0, 0.98, 0.55] as const;
// Vuelo por la nebulosa: cuánto se espera a la escena antes de renunciar a
// él, y cuánto lo apura girar la rueda
const FLIGHT_WAIT = 6;
const FLIGHT_RUSH = 3.2;

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
  const sparksRef = useRef<HTMLSpanElement>(null);
  const redRef = useRef<HTMLSpanElement>(null);
  const blueRef = useRef<HTMLSpanElement>(null);
  const cloudRef = useRef<HTMLSpanElement>(null);
  const diskRef = useRef<HTMLSpanElement>(null);
  const jetsRef = useRef<HTMLSpanElement>(null);
  const windRef = useRef<HTMLSpanElement>(null);
  const hitRef = useRef<HTMLSpanElement>(null);

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
    const sparks = sparksRef.current;
    const red = redRef.current;
    const blue = blueRef.current;
    const cloud = cloudRef.current;
    const disk = diskRef.current;
    const jets = jetsRef.current;
    const wind = windRef.current;
    const hit = hitRef.current;
    if (!hit || !sparks || !cloud || !disk || !jets || !wind || !hero || !bg || !layer || !dot || !flare || !ring || !echo || !flash || !implode || !implodeEcho || !swirl || !rays || !red || !blue) {
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
    const fromFinale = introSeam.fromFinale && living;
    // Primera visita con la estrella viva: la estrella nace al final de un
    // vuelo por la nebulosa dentro de la escena 3D
    const flying = living && !fromFinale && livingSignal.flight.planned;

    /* Desde el cierre la mitad lejana del disco va detrás de la escena 3D (su
       lienzo es transparente), así la estrella la tapa por sí sola. Se monta
       dentro del escenario durante el nacimiento y se retira al terminar */
    let under: HTMLDivElement | null = null;
    if (fromFinale) {
      under = document.createElement('div');
      under.className = 'mo-ignite mo-ignite-under';
      under.setAttribute('aria-hidden', 'true');
      ['--sx', '--sy', '--star-d'].forEach((name) => under?.style.setProperty(name, layer.style.getPropertyValue(name)));
      under.innerHTML = '<span class="mo-ignite-anchor"><span class="mo-ignite-disk"><span class="mo-ignite-disk-half is-back">'
        + '<span class="mo-ignite-disk-plane"><span class="mo-ignite-disk-clip"><span class="mo-ignite-disk-spin"></span></span></span>'
        + '</span></span></span>';
      bg.prepend(under);
    }
    const diskBack = under?.querySelector<HTMLElement>('.mo-ignite-disk');
    const disks = diskBack ? [disk, diskBack] : [disk];

    // El punto nace donde estaba el de arranque y viaja al centro de la estrella
    const bootX = window.innerWidth / 2;
    const bootY = window.innerHeight * 0.5;
    dot.style.transform = `translateX(${bootX}px) translateY(${bootY}px)`;
    releaseBootScreen();
    // fromFinale se borra al terminar y no al leerlo: en desarrollo el efecto
    // corre dos veces

    const controls: AnimationPlaybackControls[] = [];
    const timers: number[] = [];
    const run = (control: AnimationPlaybackControls) => controls.push(control);
    const later = (fn: () => void, seconds: number) => {
      timers.push(window.setTimeout(fn, seconds * 1000));
    };
    let ignited = false;
    let revealed = false;
    let skipped = false;
    let finished = false;
    let cancelled = false;
    // Hasta la ignición el scroll con inercia queda detenido (desde el cierre,
    // hasta que la estrella termina de nacer)
    let scrollFree = false;
    let lastWheel = 0;
    lockSmoothScroll('intro', true);
    const releaseScroll = () => {
      scrollFree = true;
      lockSmoothScroll('intro', false);
    };
    // Quien llega bajando desde el cierre sigue girando la rueda (o arrastra la
    // inercia del trackpad): el scroll se libera solo cuando la rueda se calma
    const releaseWhenStill = () => {
      if (cancelled || scrollFree) return;
      if (performance.now() - lastWheel > WHEEL_CALM_MS) releaseScroll();
      else later(releaseWhenStill, 0.15);
    };

    const clearIris = () => {
      hero.style.removeProperty('--ignite-r');
      hero.style.removeProperty('--ignite-x');
      hero.style.removeProperty('--ignite-y');
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      introSeam.fromFinale = false;
      onPhase('off');
    };

    let held: AnimationPlaybackControls | null = null;
    // Llegada desde el hiperespacio: el cielo entra estirado y frena
    const arrive = () => {
      dispatchWarp(40);
      later(() => dispatchWarp(30), 0.16);
      later(() => dispatchWarp(22), 0.32);
      later(() => dispatchWarp(12), 0.5);
      run(animate(dot, { x: [bootX, sx], y: [bootY, sy] }, { duration: T.glide, ease: EASE_OUT }));
    };
    if (fromFinale) {
      // Desde el cierre todo ya cayó al punto: queda contenido un instante
      run(animate(dot, { x: sx, y: sy, scale: 0.75 }, { duration: 0 }));
    } else if (flying) {
      // El punto espera donde estaba el de arranque: el vuelo trae su propio cielo
      run(animate(dot, { x: sx, y: sy }, { duration: 0 }));
    } else {
      arrive();
    }
    // El estallido espera a que el colapso termine de verdad: si la escena
    // tarda en compilar, las animaciones arrancan tarde y un reloj fijo
    // haría estallar la estrella con los anillos a medio cerrar
    let gathered: Promise<unknown> = Promise.resolve();
    if (fromFinale) {
      // El texto de la portada espera a que la estrella termine de nacer
      hero.setAttribute('data-birth', '');
      // El gas que cayó queda girando en un disco alrededor del punto, dentro
      // de una nube tenue, mientras el punto se calienta
      run(animate(cloud, { opacity: [0, 0.9], scale: [1.3, 1] }, { duration: GENTLE_WARM, ease: EASE_OUT }));
      run(animate(disks, { opacity: [0, 1], scale: [1.5, 0.85] }, { duration: GENTLE_WARM + 0.1, ease: EASE_OUT }));
      const warm = animate(dot, { scale: [0.75, 1.8] }, { duration: GENTLE_WARM, ease: 'easeIn' });
      run(warm);
      gathered = warm.then(() => undefined);
    }
    const collapseLiving = () => {
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
    };
    if (living && !fromFinale && !flying) {
      collapseLiving();
    } else if (!living) {
      run(animate(dot, { scale: [1, 2.2, 1.5] }, { duration: 0.9, delay: T.chargeAt, ease: 'easeInOut' }));
      run(animate(flare, { scaleX: [0, 1], opacity: [0, 0.9] }, { duration: 0.9, delay: T.chargeAt + 0.1, ease: EASE_OUT }));
    }

    const ignite = () => {
      if (ignited || finished) return;
      ignited = true;
      if (!fromFinale) releaseScroll();
      revealed = true;
      onPhase('reveal');
      livingSignal.gentle = fromFinale;
      if (fromFinale) {
        // Nace la protoestrella bajo un resplandor: la luz sube primero y la
        // estrella aparece debajo, así nunca se la ve surgir de golpe; después
        // dispara sus chorros por los polos, con nudos de gas que se alejan
        run(animate(flash, { opacity: [0, 0.8, 0] }, { duration: 2.4, times: [0, 0.22, 1], ease: 'easeInOut' }));
        later(() => { livingSignal.ignitedAt = performance.now(); }, GENTLE_GLOW);
        // La estrella ilumina el gas que la rodea al encenderse
        run(animate([...disks, cloud], { filter: ['brightness(0.75)', 'brightness(1.6) saturate(1.15)'] }, { duration: GENTLE_WIND, ease: 'easeIn' }));
        run(animate([implode, implodeEcho, swirl, flare], { opacity: 0 }, { duration: 0.12 }));
        run(animate(dot, { scale: 3.2, opacity: 0 }, { duration: 1.4, ease: EASE_OUT }));
        const reach = window.innerHeight * 0.4;
        jets.querySelectorAll<HTMLElement>('.mo-ignite-jet').forEach((jet) => {
          run(animate(jet, { scaleY: [0, 1], opacity: [0, 1, 0.8] }, { duration: 0.6, ease: EASE_OUT }));
        });
        jets.querySelectorAll<HTMLElement>('.mo-ignite-knot').forEach((knot, index) => {
          const side = index % 2 ? 1 : -1;
          run(animate(knot, { y: [0, side * reach], opacity: [0, 1, 0] }, { duration: 1.7, delay: 0.15 + Math.floor(index / 2) * 0.4, ease: 'easeOut' }));
        });
        run(animate(jets, { opacity: [1, 0] }, { duration: 1, delay: 1.7 }));
        // Al encenderse la fusión el viento estelar despeja la nube y el disco
        run(animate(wind, { scale: [0.5, 3], opacity: [0, 0.55, 0] }, { duration: 1.9, delay: GENTLE_WIND, ease: EASE_OUT }));
        run(animate(cloud, { opacity: 0, scale: 1.7 }, { duration: 1.5, delay: GENTLE_WIND, ease: EASE_OUT }));
        run(animate(disks, { opacity: 0, scale: 1.5 }, { duration: 1.2, delay: GENTLE_WIND + 0.1, ease: EASE_OUT }));
        later(() => {
          hero.removeAttribute('data-birth');
          hero.setAttribute('data-born', '');
        }, 2.6);
        later(() => onPhase('chrome'), 3.2);
        later(releaseWhenStill, 3.4);
        later(finish, 5.2);
        return;
      }
      if (living) {
        // Estalla: la escena infla la estrella, la onda de choque se separa en
        // colores, los rayos se abren y el cielo sale empujado
        livingSignal.ignitedAt = performance.now();
        dispatchWarp(40);
        later(() => dispatchWarp(24), 0.18);
        held?.stop();
        run(animate([implode, implodeEcho, swirl], { opacity: 0 }, { duration: 0.12 }));
        run(animate(rays, { scale: [0.35, 2.4], opacity: [0, 1, 0], rotate: [0, 14] }, { duration: 1.3, times: [0, 0.14, 1], ease: EASE_OUT }));
        // Las chispas salen del borde de la estrella y se frenan al alejarse
        sparks.querySelectorAll<HTMLElement>('.mo-ignite-spark').forEach((spark, index) => {
          const { reach, duration, delay } = SPARKS[index];
          run(animate(spark, {
            x: [starR * 0.85, starR * reach],
            scaleX: [0.15, 1, 0.35],
            opacity: [0, 1, 0],
          }, { duration, delay, ease: EASE_OUT, opacity: { duration, delay, times: [0, 0.12, 1] }, scaleX: { duration, delay, times: [0, 0.25, 1] } }));
        });
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
    /* Vuelo por la nebulosa: la escena mueve la cámara con este reloj y aquí
       se disparan, a su hora, el destello, el golpe y la vuelta de la portada */
    const flight = livingSignal.flight;
    let flightFrame = 0;
    let rushUntil = 0;
    const startFlight = () => {
      flight.t = 0;
      flight.active = true;
      held?.stop();
      // El núcleo de la escena toma el lugar del punto de arranque
      run(animate(dot, { opacity: 0 }, { duration: 0.35, ease: 'easeOut' }));
      const events: [number, () => void][] = [
        // El texto empieza a entrar (con sus propias demoras, después del
        // golpe) mientras el núcleo contiene el aliento: lo que cuesta
        // dibujarlo por primera vez cae en el único instante quieto del vuelo
        [FLIGHT.reveal, () => {
          if (revealed) return;
          revealed = true;
          onPhase('reveal');
        }],
        [FLIGHT.ignite, () => {
          ignited = true;
          livingSignal.gentle = false;
          livingSignal.ignitedAt = performance.now() - (flight.t - FLIGHT.ignite) * 1000;
          run(animate(flash, { opacity: [0, 0.6, 0] }, { duration: 1.3, times: [0, 0.07, 1] }));
        }],
        // La onda de choque atraviesa la cámara
        [FLIGHT.hit, () => run(animate(hit, { opacity: [0, 0.6, 0] }, { duration: 0.55, times: [0, 0.1, 1] }))],
        [FLIGHT.landing, () => setFlight(hero, 'landing')],
        // Con la cámara ya quieta vuelven la barra, la marquesina y el scroll
        [FLIGHT.end, () => {
          flight.active = false;
          setFlight(hero, null);
          releaseScroll();
          onPhase('chrome');
          later(finish, 1.1);
        }],
      ];
      let next = 0;
      let last = performance.now();
      let speed = 1;
      const tick = (now: number) => {
        if (cancelled || finished) return;
        const step = Math.min(0.05, Math.max(0, now - last) / 1000);
        last = now;
        // Girar la rueda durante el vuelo lo apura
        speed += ((now < rushUntil ? FLIGHT_RUSH : 1) - speed) * Math.min(1, step * 6);
        flight.t += step * speed;
        while (next < events.length && flight.t >= events[next][0]) events[next++][1]();
        if (flight.active) flightFrame = requestAnimationFrame(tick);
      };
      flightFrame = requestAnimationFrame(tick);
    };

    if (flying) {
      // El fondo tapa el cielo 2D: el vuelo trae el suyo
      setFlight(hero, '');
      // Mientras la escena compila, el punto late como en la pantalla de arranque
      held = animate(dot, { scale: [1, 1.35, 1], opacity: [1, 0.75, 1] }, { duration: 1.8, repeat: Infinity, ease: 'easeInOut' });
      const sceneReady = livingSignal.ready.then(() => 'ready' as const);
      const late = new Promise<'late'>((resolve) => later(() => resolve('late'), FLIGHT_WAIT));
      void Promise.race([sceneReady, late]).then((result) => {
        if (cancelled || finished || skipped) return;
        if (result === 'ready') {
          startFlight();
          return;
        }
        // La escena no llegó a tiempo: la estrella nace como antes, sin vuelo
        setFlight(hero, null);
        held?.stop();
        arrive();
        collapseLiving();
        void Promise.all([fontsReady, gathered]).then(() => {
          if (!cancelled) ignite();
        });
      });
    } else {
      const minWait = new Promise<void>((resolve) => later(resolve, fromFinale ? GENTLE_WARM : living ? LIVING_IGNITE_MIN : T.igniteMin));
      const maxWait = new Promise<void>((resolve) => later(resolve, T.igniteMax));
      // Desde el cierre la escena y las fuentes ya están cargadas: no se esperan
      const ready = fromFinale ? Promise.all([minWait, gathered]) : Promise.all([preload(), fontsReady, minWait, gathered]);
      void Promise.race([ready, maxWait]).then(() => {
        if (!cancelled) ignite();
      });
    }

    // Esc salta la intro: la estrella se abre de golpe
    const skip = () => {
      if (finished || cancelled || skipped) return;
      skipped = true;
      controls.forEach((control) => control.stop());
      held?.stop();
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.length = 0;
      releaseScroll();
      if (flying) {
        window.cancelAnimationFrame(flightFrame);
        flight.active = false;
        setFlight(hero, null);
      }
      if (!revealed) {
        revealed = true;
        onPhase('reveal');
      }
      if (!ignited) {
        ignited = true;
        // Saltada: la estrella aparece ya en su lugar
        if (living) {
          livingSignal.gentle = false;
          livingSignal.ignitedAt = performance.now() - 3000;
        }
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
      lastWheel = performance.now();
      if (flight.active) rushUntil = lastWheel + 450;
      if (!scrollFree) event.preventDefault();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        skip();
        return;
      }
      if (event.target instanceof HTMLElement && event.target.closest('button, input, textarea, select')) return;
      if (!scrollFree && scrollKeys.has(event.key)) {
        event.preventDefault();
        if (flight.active) rushUntil = performance.now() + 450;
      }
    };
    window.addEventListener('wheel', blockScroll, { passive: false });
    window.addEventListener('touchmove', blockScroll, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(flightFrame);
      if (flying) {
        flight.active = false;
        setFlight(hero, null);
      }
      under?.remove();
      hero.removeAttribute('data-birth');
      hero.removeAttribute('data-born');
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
      <span ref={hitRef} className="mo-ignite-hit" />
      <span className="mo-ignite-anchor">
        <span ref={flareRef} className="mo-ignite-flare" />
        <span ref={ringRef} className="mo-ignite-ring" />
        <span ref={echoRef} className="mo-ignite-ring is-echo" />
        <span ref={redRef} className="mo-ignite-ring is-red" />
        <span ref={blueRef} className="mo-ignite-ring is-blue" />
        <span ref={raysRef} className="mo-ignite-rays" style={{ '--rays': RAYS_GRADIENT } as CSSProperties} />
        <span ref={sparksRef} className="mo-ignite-sparks">
          {SPARKS.map((spark, index) => (
            <span key={index} className="mo-ignite-spark-arm" style={{ rotate: `${spark.angle.toFixed(1)}deg` }}>
              <span
                className={`mo-ignite-spark${spark.warm ? ' is-warm' : ''}`}
                style={{ width: `${spark.length.toFixed(0)}px` }}
              />
            </span>
          ))}
        </span>
        <span ref={swirlRef} className="mo-ignite-swirl" />
        <span ref={implodeRef} className="mo-ignite-implode" />
        <span ref={implodeEchoRef} className="mo-ignite-implode is-echo" />
        {/* Nacimiento desde el cierre: nube, disco, chorros y viento */}
        <span ref={cloudRef} className="mo-ignite-cloud" />
        {/* Mitad cercana del disco: pasa por delante de la estrella (la
            lejana se monta detrás de la escena 3D) */}
        <span ref={diskRef} className="mo-ignite-disk">
          <span className="mo-ignite-disk-half is-front">
            <span className="mo-ignite-disk-plane">
              <span className="mo-ignite-disk-clip">
                <span className="mo-ignite-disk-spin" />
              </span>
            </span>
          </span>
        </span>
        <span ref={jetsRef} className="mo-ignite-jets">
          <span className="mo-ignite-jet is-up" />
          <span className="mo-ignite-jet is-down" />
          {[0, 1, 2, 3, 4, 5].map((knot) => <span key={knot} className="mo-ignite-knot" />)}
        </span>
        <span ref={windRef} className="mo-ignite-wind" />
      </span>
      <span ref={dotRef} className="mo-ignite-dot" />
    </div>
  );
};
