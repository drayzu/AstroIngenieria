import { useEffect, useRef, useState } from 'react';

const CURSOR_CLASS = 'mo-has-custom-cursor';

export const MuseumCursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setEnabled(true);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const prev = { x: pos.x, y: pos.y };
    let speed = 0;
    let tailLen = 0;
    let tailAngle = 0;
    let lastMoveT = performance.now();
    let lastX = pos.x;
    let lastY = pos.y;
    let isActive = false;
    let wasActive = false;
    let lastLabel = '';
    let raf = 0;

    const move = (event: MouseEvent) => {
      const now = performance.now();
      const dt = Math.max(8, now - lastMoveT);
      const inst = (Math.hypot(event.clientX - lastX, event.clientY - lastY) / dt) * 1000;
      speed = speed * 0.6 + inst * 0.4;
      lastMoveT = now;
      lastX = event.clientX;
      lastY = event.clientY;

      pos.x = event.clientX;
      pos.y = event.clientY;

      const target = event.target as HTMLElement | null;
      const hit = target?.closest('button, a, input, textarea, [data-cursor]');
      isActive = Boolean(hit);
      const label = hit?.getAttribute('data-cursor-label') ?? '';

      if (cursorRef.current) {
        cursorRef.current.classList.toggle('is-active', isActive);
        cursorRef.current.classList.toggle('has-label', Boolean(label));
        if (isActive !== wasActive || label !== lastLabel) {
          const text = cursorRef.current.querySelector('span');
          if (text) text.textContent = label;
        }
      }
      wasActive = isActive;
      lastLabel = label;
    };

    const resetLabel = () => {
      isActive = false;
      wasActive = false;
      lastLabel = '';
      if (!cursorRef.current) return;
      cursorRef.current.classList.remove('is-active', 'has-label');
      const text = cursorRef.current.querySelector('span');
      if (text) text.textContent = '';
    };

    // Interpolación angular por el arco corto: evita giros bruscos en ±π
    const lerpAngle = (a: number, b: number, t: number) => {
      let d = b - a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return a + d * t;
    };

    const loop = () => {
      speed *= 0.9;

      // Dirección instantánea del movimiento (por frame)
      const vx = pos.x - prev.x;
      const vy = pos.y - prev.y;
      const frameDist = Math.hypot(vx, vy);
      prev.x = pos.x;
      prev.y = pos.y;

      if (frameDist > 1.2) {
        // La estela apunta hacia ATRÁS del movimiento y nace en el puntito
        tailAngle = lerpAngle(tailAngle, Math.atan2(-vy, -vx), 0.35);
      }
      const targetLen = Math.min(88, speed * 0.05);
      tailLen += (targetLen - tailLen) * 0.22;

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        cursorRef.current.style.setProperty(
          '--s',
          ((isActive ? 1.28 : 1) + Math.min(0.55, speed / 2200)).toFixed(3),
        );
        cursorRef.current.style.opacity = (0.78 + Math.min(0.22, speed / 1600)).toFixed(3);
        cursorRef.current.style.setProperty('--tail-len', `${tailLen.toFixed(1)}px`);
        cursorRef.current.style.setProperty('--tail-angle', `${tailAngle.toFixed(3)}rad`);
      }

      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', move, { passive: true });
    window.addEventListener('mo-cursor-reset', resetLabel);
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mo-cursor-reset', resetLabel);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  useEffect(() => {
    const root = document.querySelector('.mo-root');
    if (!root || !enabled) return;
    root.classList.add(CURSOR_CLASS);
    return () => root.classList.remove(CURSOR_CLASS);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div ref={cursorRef} className="mo-cursor" aria-hidden="true">
      <i className="mo-cursor-tail" />
      <i className="mo-cursor-ring" />
      <span />
    </div>
  );
};
