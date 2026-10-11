import { useEffect, type RefObject } from 'react';
import { wallGain } from './roomShared';

/* La velocidad del scroll deforma las obras: la imagen se estira en la
   dirección del movimiento y el marco y su ficha se quedan un poco atrás,
   como si tuvieran inercia. Solo se tocan las obras en pantalla y el
   bucle se apaga cuando el museo queda quieto. En el pasillo de galería
   la pared avanza de lado, así que ahí la deformación es horizontal y
   sigue la velocidad real de la pared; en la órbita no hay deformación. */

// Velocidad (px por cuadro) a la que el efecto llega a su máximo
const FULL_SPEED = 55;
const MAX_STRETCH = 0.06;
const FRAME_LAG = 10;
const META_LAG = 18;
// La separación de color solo aparece pasado este umbral de velocidad
const CHROMA_FROM = 0.2;

interface WarpParts {
  frame: HTMLElement | null;
  mask: HTMLElement | null;
  zoom: HTMLElement | null;
  meta: HTMLElement | null;
  /* Pasillo al que pertenece, si la obra cuelga de una pared lateral */
  corridor: HTMLElement | null;
  still: boolean;
}

// Píxeles de pared por píxel de scroll a velocidad base del pasillo
const BASE_WALL_GAIN = 1.55;

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
          mask: obra.querySelector<HTMLElement>('.mo-frame-mask'),
          zoom: obra.querySelector<HTMLElement>('.mo-frame-zoom'),
          meta: obra.querySelector<HTMLElement>('.mo-obra-meta'),
          corridor: obra.closest<HTMLElement>('.mo-corridor'),
          still: Boolean(obra.closest('.mo-orbit')),
        };
        found.mask?.classList.toggle('is-lateral', Boolean(found.corridor));
        parts.set(obra, found);
      }
      return found;
    };

    const reset = (obra: HTMLElement) => {
      const { frame, mask, zoom, meta } = partsOf(obra);
      frame?.style.removeProperty('translate');
      mask?.style.removeProperty('--chroma');
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
      // Los saltos de varias pantallas son teletransportes, no velocidad
      const step = Math.abs(top - last) > window.innerHeight * 3 ? 0 : top - last;
      velocity = velocity * 0.75 + step * 0.25;
      last = top;

      if (Math.abs(velocity) < 0.05) {
        velocity = 0;
        raf = 0;
        visible.forEach(reset);
        return;
      }

      visible.forEach((obra) => {
        const { frame, mask, zoom, meta, corridor, still } = partsOf(obra);
        if (still) return;
        const lateral = Boolean(corridor);
        // En los tramos rápidos del pasillo la pared corre más que el scroll
        const gain = corridor ? (wallGain.get(corridor) ?? BASE_WALL_GAIN) / BASE_WALL_GAIN : 1;
        // Positivo al bajar: el marco queda atrás (abajo) y la ficha un poco más
        const speed = Math.max(-1, Math.min(1, (velocity * gain) / FULL_SPEED));
        const stretch = (1 + Math.abs(speed) * MAX_STRETCH).toFixed(4);
        const frameShift = (speed * FRAME_LAG).toFixed(2);
        const metaShift = (speed * META_LAG).toFixed(2);
        // Separación de color: rojo en el borde que avanza, cian en el que queda
        const chroma = Math.max(0, (Math.abs(speed) - CHROMA_FROM) / (1 - CHROMA_FROM));
        // En el pasillo la pared va hacia la izquierda: lo que queda atrás, a la derecha
        frame?.style.setProperty('translate', lateral ? `${frameShift}px 0` : `0 ${frameShift}px`);
        zoom?.style.setProperty('scale', lateral ? `${stretch} 1` : `1 ${stretch}`);
        meta?.style.setProperty('translate', lateral ? `${metaShift}px 0` : `0 ${metaShift}px`);
        if (mask) {
          mask.style.setProperty('--chroma', chroma.toFixed(3));
          mask.classList.toggle('is-rising', speed < 0);
        }
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
