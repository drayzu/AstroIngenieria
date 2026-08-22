import { useEffect, useRef, useState, type RefObject } from 'react';
import type { DistortHandle } from './distort';

interface DistortOverlayProps {
  imageRef: RefObject<HTMLImageElement | null>;
  active: boolean;
}

export const DistortOverlay = ({ imageRef, active }: DistortOverlayProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<DistortHandle | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
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
      if (handleRef.current) return;

      import('./distort').then(({ mountDistort }) => {
        if (disposed || handleRef.current) return;
        handleRef.current = mountDistort({ canvas, image: img, container: wrap });
        if (!handleRef.current) return;
        const onMove = (event: MouseEvent) => handleRef.current?.move(event.clientX, event.clientY);
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
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [imageRef]);

  return (
    <div ref={wrapRef} className={ready ? 'mo-distort is-ready' : 'mo-distort'} aria-hidden="true">
      <canvas ref={canvasRef} className={active ? 'is-live' : ''} />
    </div>
  );
};
