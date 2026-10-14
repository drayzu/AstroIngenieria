import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { onLook, readLook } from './lookAround';

/* Piezas comunes de las salas: cada capítulo se recorre a su manera, pero
   todas comparten el mismo bucle (solo corre con la sala a la vista y
   mientras el scroll se mueve) y el mismo estado con el cielo. */

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const clamp01 = (value: number) => clamp(value, 0, 1);
export const smoothstep = (from: number, to: number, value: number) => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

export const toRoman = (value: number) => {
  const numerals: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let rest = value;
  let out = '';
  for (const [amount, numeral] of numerals) {
    while (rest >= amount) {
      out += numeral;
      rest -= amount;
    }
  }
  return out;
};

/* Lo leen el cielo de estrellas y la deformación por velocidad: dentro de
   un pasillo el scroll mueve la pared de lado (lateral = 1) y, en los
   tramos rápidos, más píxeles de pared por píxel de scroll (gain).
   spin: el cielo gira alrededor de un eje (x, y en pantalla); quien lo
   mueve suma el ángulo (rad, horario) y el cielo lo consume en su cuadro.
   depth 0 gira todo igual (la cámara rueda); 1, lo lejano gira menos */
export const skyDrift = { lateral: 0, gain: 1, spin: { x: 0, y: 0, angle: 0, depth: 0 } };
// Viajes cuyo lienzo opaco tapa ahora toda la pantalla: mientras haya alguno,
// el cielo de la página no se dibuja (nadie lo ve y su raster compite con el
// del viaje)
export const skyCovers = new Set<object>();
export const wallGain = new WeakMap<Element, number>();

export interface RoomFrame {
  /* scroll del museo */
  top: number;
  /* scroll medido desde el inicio de la sala */
  offset: number;
  viewport: number;
  now: number;
}

interface RoomLoopOptions {
  /* Sigue dibujando aunque el scroll esté quieto (barrido del radar) */
  continuous?: boolean;
  enabled?: boolean;
  /* Al detenerse el bucle: apagar lo que depende de la velocidad */
  onIdle?: () => void;
  /* Sigue dibujando con el scroll quieto mientras devuelva true (algo de la
     sala anima con su propio tiempo) */
  busy?: () => boolean;
}

export const useRoomLoop = (
  sectionRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
  paint: (frame: RoomFrame) => void,
  { continuous = false, enabled = true, onIdle, busy }: RoomLoopOptions = {},
) => {
  const paintRef = useRef(paint);
  const idleRef = useRef(onIdle);
  const busyRef = useRef(busy);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    paintRef.current = paint;
    idleRef.current = onIdle;
    busyRef.current = busy;
  });

  useEffect(() => {
    const root = scrollRef.current;
    const section = sectionRef.current;
    if (!root || !section || !enabled) return;

    let sectionTop = 0;
    let lastTop = Number.NaN;
    let still = 0;
    let raf = 0;
    let inView = false;

    // Se mide al despertar el bucle, no en cada cuadro
    const locate = () => {
      sectionTop = section.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
    };

    const draw = (top: number, now: number) => {
      paintRef.current({ top, offset: top - sectionTop, viewport: root.clientHeight, now });
    };

    const loop = (now: number) => {
      const top = root.scrollTop;
      if (top === lastTop && !continuous && !busyRef.current?.()) {
        still += 1;
        if (still > 8) {
          raf = 0;
          idleRef.current?.();
          return;
        }
      } else {
        still = 0;
        lastTop = top;
        draw(top, now);
      }
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (raf || !inView || document.hidden) return;
      still = 0;
      raf = requestAnimationFrame(loop);
    };

    const sleep = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const refresh = () => {
      locate();
      lastTop = Number.NaN;
      draw(root.scrollTop, performance.now());
      wake();
    };
    refreshRef.current = refresh;

    const onScroll = () => {
      if (!raf && inView) locate();
      wake();
    };

    const onVisibility = () => {
      if (document.hidden) sleep();
      else wake();
    };

    const observer = new IntersectionObserver(([entry]) => {
      inView = Boolean(entry?.isIntersecting);
      if (inView) refresh();
      else {
        sleep();
        idleRef.current?.();
      }
    }, { root, rootMargin: '25% 0px' });
    observer.observe(section);

    root.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      root.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      sleep();
      refreshRef.current = () => {};
    };
  }, [sectionRef, scrollRef, continuous, enabled]);

  // Para volver a dibujar tras medir de nuevo (cambio de tamaño)
  return useCallback(() => refreshRef.current(), []);
};

/* Mirar alrededor en una sala: el escenario se ladea un poco hacia donde
   mira el visitante, como la pared que uno tiene enfrente cuando gira la
   cabeza (el cielo de atrás se corre más). Solo una transformación, en el
   compositor, y solo mientras la sala está a la vista y la mirada se mueve.
   El escenario lleva will-change: transform en su CSS: así no cambia de
   capa al empezar o terminar de mirar.

   `pivot` da el punto de giro dentro del escenario (px desde su borde de
   arriba) para las salas que no están fijas en pantalla: el centro de la
   pantalla. Devuelve con qué volver a ubicar el giro cuando cambia el
   scroll (lo llama el bucle de la sala) */
// Qué parte del giro de cabeza se ve en la sala y su perspectiva
const ROOM_TURN = 0.5;
const ROOM_PERSPECTIVE = 1400;

export const useRoomLook = (
  sectionRef: RefObject<HTMLElement | null>,
  stageRef: RefObject<HTMLElement | null>,
  pivot?: () => number,
) => {
  const pivotRef = useRef(pivot);
  const applyRef = useRef<() => void>(() => {});
  useEffect(() => {
    pivotRef.current = pivot;
  });

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;
    let inView = false;
    let last = '';
    const apply = () => {
      const { yaw, pitch } = readLook();
      let value = '';
      if (inView && (yaw || pitch)) {
        const turn = `perspective(${ROOM_PERSPECTIVE}px) rotateX(${((pitch * ROOM_TURN * 180) / Math.PI).toFixed(3)}deg) rotateY(${((yaw * ROOM_TURN * 180) / Math.PI).toFixed(3)}deg)`;
        const at = pivotRef.current?.();
        // Aún sin medir el centro de la pantalla en la sala: espera al bucle
        if (at !== undefined && Number.isNaN(at)) return;
        value = at === undefined ? turn : `translate3d(0, ${at.toFixed(1)}px, 0) ${turn} translate3d(0, ${(-at).toFixed(1)}px, 0)`;
      }
      if (value === last) return;
      last = value;
      stage.style.transform = value;
    };
    applyRef.current = apply;
    // Con un punto de giro propio, las transformaciones parten del borde de
    // arriba del escenario (no de su centro, que puede quedar muy lejos)
    if (pivotRef.current) stage.style.transformOrigin = '50% 0';
    const observer = new IntersectionObserver(([entry]) => {
      inView = Boolean(entry?.isIntersecting);
      apply();
    });
    observer.observe(section);
    const off = onLook(apply);
    return () => {
      off();
      observer.disconnect();
      applyRef.current = () => {};
      stage.style.transform = '';
      stage.style.transformOrigin = '';
    };
  }, [sectionRef, stageRef]);

  return useCallback(() => applyRef.current(), []);
};

/* Posición de un elemento dentro de otro sin contar transformaciones */
export const offsetWithin = (element: HTMLElement, ancestor: HTMLElement) => {
  let top = 0;
  let left = 0;
  let node: HTMLElement | null = element;
  while (node && node !== ancestor) {
    top += node.offsetTop;
    left += node.offsetLeft;
    node = node.offsetParent as HTMLElement | null;
  }
  return { top, left };
};
