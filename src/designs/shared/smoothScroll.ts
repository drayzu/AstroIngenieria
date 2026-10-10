import Lenis from 'lenis';

/* Scroll con inercia (Lenis) sobre el contenedor del museo. Un único
   punto para encenderlo, bloquearlo (intro, sala de estudio, menú,
   Playground) y para que los saltos programados no peleen con la inercia. */

let lenis: Lenis | null = null;
const locks = new Set<string>();

const applyLocks = () => {
  if (!lenis) return;
  if (locks.size > 0) lenis.stop();
  else lenis.start();
};

export const startSmoothScroll = (wrapper: HTMLElement) => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  lenis = new Lenis({
    wrapper,
    content: wrapper,
    // Solo la rueda: en pantallas táctiles se conserva el scroll nativo
    smoothWheel: true,
    // Más alto = responde antes; 0.15 se siente ágil sin perder suavidad
    lerp: 0.15,
    autoRaf: true,
    // Los paneles con scroll propio (sala de estudio, menú…) lo conservan
    allowNestedScroll: true,
    // El contenido crece al cargar imágenes: medir siempre en vivo
    naiveDimensions: true,
  });
  applyLocks();
  return () => {
    lenis?.destroy();
    lenis = null;
  };
};

/* Bloquea o libera el scroll suave; con varios bloqueos activos basta uno */
export const lockSmoothScroll = (key: string, locked: boolean) => {
  if (locked) locks.add(key);
  else locks.delete(key);
  applyLocks();
};

/* Desplazamiento animado; devuelve false si no hay scroll suave activo */
export const smoothScrollTo = (target: HTMLElement | number) => {
  if (!lenis) return false;
  lenis.scrollTo(target, { force: true });
  return true;
};

/* Salto instantáneo que también detiene la inercia en curso: sin esto,
   Lenis seguiría animando hacia su destino anterior y desharía el salto */
export const jumpScroll = (wrapper: HTMLElement, top: number) => {
  if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
  else wrapper.scrollTop = top;
};
