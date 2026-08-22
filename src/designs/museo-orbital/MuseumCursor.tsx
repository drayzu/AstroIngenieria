import { useEffect, useRef, useState } from 'react';

const CURSOR_CLASS = 'mo-has-custom-cursor';

export const MuseumCursor = () => {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    setEnabled(true);

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ring = { ...pos };
    let raf = 0;
    let wasActive = false;
    let lastLabel = '';

    const move = (event: MouseEvent) => {
      pos.x = event.clientX;
      pos.y = event.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
      }

      const target = event.target as HTMLElement | null;
      const hit = target?.closest('button, a, input, textarea, [data-cursor]');
      const isActive = Boolean(hit);
      const label = hit?.getAttribute('data-cursor-label') ?? '';

      if (ringRef.current) {
        ringRef.current.classList.toggle('is-active', isActive);
        ringRef.current.classList.toggle('has-label', Boolean(label));
        if (isActive !== wasActive || label !== lastLabel) {
          const text = ringRef.current.querySelector('span');
          if (text) text.textContent = label;
        }
      }
      wasActive = isActive;
      lastLabel = label;
    };

    const loop = () => {
      ring.x += (pos.x - ring.x) * 0.16;
      ring.y += (pos.y - ring.y) * 0.16;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${Math.round(ring.x)}px, ${Math.round(ring.y)}px)`;
      }
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', move, { passive: true });
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', move);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const root = document.querySelector('.mo-root');
    if (!root) return;
    if (enabled) root.classList.add(CURSOR_CLASS);
    return () => root.classList.remove(CURSOR_CLASS);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div ref={dotRef} className="mo-cursor-dot" aria-hidden="true">
        <i />
      </div>
      <div ref={ringRef} className="mo-cursor-ring" aria-hidden="true">
        <span />
      </div>
    </>
  );
};
