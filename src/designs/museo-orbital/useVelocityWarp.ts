import { useEffect, type RefObject } from 'react';

/* La velocidad del scroll deforma las obras: la imagen se estira en la
   dirección del movimiento y el marco y su ficha se quedan un poco atrás,
   como si tuvieran inercia. Solo se tocan las obras en pantalla y el
   bucle se apaga cuando el museo queda quieto. */

// Velocidad (px por cuadro) a la que el efecto llega a su máximo
const FULL_SPEED = 55;
const MAX_STRETCH = 0.06;
const FRAME_LAG = 10;
const META_LAG = 18;

interface WarpParts {
  frame: HTMLElement | null;
  zoom: HTMLElement | null;
  meta: HTMLElement | null;
}

export const useVelocityWarp = (rootRef: RefObject<HTMLElement | null>, disabled: boolean) => {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || disabled) return;

    const parts = new WeakMap<HTMLElement, WarpParts>();
    const partsOf = (obra: HTMLElement) => {
      let found = parts.get(obra);
      if (!found) {
        found = {
          frame: obra.querySelector<HTMLElement>('.mo-frame'),
          zoom: obra.querySelector<HTMLElement>('.mo-frame-zoom'),
          meta: obra.querySelector<HTMLElement>('.mo-obra-meta'),
        };
        parts.set(obra, found);
      }
      return found;
    };

    const reset = (obra: HTMLElement) => {
      const { frame, zoom, meta } = partsOf(obra);
      frame?.style.removeProperty('translate');
      zoom?.style.removeProperty('scale');
      meta?.style.removeProperty('translate');
    };

    const visible = new Set<HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const obra = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            visible.add(obra);
          } else {
            visible.delete(obra);
            reset(obra);
          }
        }
      },
      { root, rootMargin: '15% 0px' },
    );
    root.querySelectorAll<HTMLElement>('.mo-obra').forEach((obra) => observer.observe(obra));

    let last = root.scrollTop;
    let velocity = 0;
    let raf = 0;

    const loop = () => {
      const top = root.scrollTop;
      velocity = velocity * 0.75 + (top - last) * 0.25;
      last = top;

      if (Math.abs(velocity) < 0.05) {
        velocity = 0;
        raf = 0;
        visible.forEach(reset);
        return;
      }

      // Positivo al bajar: el marco queda atrás (abajo) y la ficha un poco más
      const speed = Math.max(-1, Math.min(1, velocity / FULL_SPEED));
      const stretch = (1 + Math.abs(speed) * MAX_STRETCH).toFixed(4);
      const frameLag = `0 ${(speed * FRAME_LAG).toFixed(2)}px`;
      const metaLag = `0 ${(speed * META_LAG).toFixed(2)}px`;
      visible.forEach((obra) => {
        const { frame, zoom, meta } = partsOf(obra);
        frame?.style.setProperty('translate', frameLag);
        zoom?.style.setProperty('scale', `1 ${stretch}`);
        meta?.style.setProperty('translate', metaLag);
      });
      raf = requestAnimationFrame(loop);
    };

    const onScroll = () => {
      if (!raf && !document.hidden) raf = requestAnimationFrame(loop);
    };
    root.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      root.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
      observer.disconnect();
      visible.forEach(reset);
    };
  }, [rootRef, disabled]);
};
