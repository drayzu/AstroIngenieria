import { useEffect, useRef, useState, type RefObject } from 'react';
import type { DistortHandle } from './distort';

interface DistortOverlayProps {
  imageRef: RefObject<HTMLImageElement | null>;
  active: boolean;
}

export const DistortOverlay = ({ imageRef, active }: DistortOverlayProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) {
      setReady(false);
      return;
    }
    let disposed = false;
    let handle: DistortHandle | null = null;
    let detachMove: (() => void) | null = null;
    let detachLoad: (() => void) | null = null;

    const mount = () => {
      if (disposed) return;
      const img = imageRef.current;
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!img || !canvas || !wrap) return;
      if (!img.complete || img.naturalWidth === 0) {
        img.addEventListener('load', mount, { once: true });
        detachLoad = () => img.removeEventListener('load', mount);
        return;
      }

      import('./distort').then(({ mountDistort }) => {
        if (disposed) return;
        handle = mountDistort({ canvas, image: img, container: wrap });
        if (!handle) return;
        const onMove = (event: MouseEvent) => handle?.move(event.clientX, event.clientY);
        wrap.addEventListener('mousemove', onMove, { passive: true });
        detachMove = () => wrap.removeEventListener('mousemove', onMove);
        requestAnimationFrame(() => {
          if (!disposed) setReady(true);
        });
      });
    };

    mount();
    return () => {
      disposed = true;
      detachMove?.();
      detachLoad?.();
      handle?.destroy();
    };
  }, [active, imageRef]);

  return (
    <div ref={wrapRef} className="mo-distort" aria-hidden="true">
      <canvas ref={canvasRef} className={ready ? 'is-live' : ''} />
    </div>
  );
};
