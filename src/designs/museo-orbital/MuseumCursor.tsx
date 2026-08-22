import { useEffect, useRef, useState } from 'react';

const CURSOR_CLASS = 'mo-has-custom-cursor';

export const MuseumCursor = () => {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    setEnabled(true);

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ring = { ...pos };
    const trailCtx = trailRef.current?.getContext('2d') ?? null;
    const particles: { x: number; y: number; vx: number; vy: number; life: number; gold: boolean }[] = [];
    let lastSpawn = { x: pos.x, y: pos.y };
    let raf = 0;
    let wasActive = false;
    let lastLabel = '';
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const sizeTrail = () => {
      const canvas = trailRef.current;
      if (!canvas || !trailCtx) return;
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    sizeTrail();

    const move = (event: MouseEvent) => {
      pos.x = event.clientX;
      pos.y = event.clientY;

      if (trailCtx) {
        const dx = pos.x - lastSpawn.x;
        const dy = pos.y - lastSpawn.y;
        if (dx * dx + dy * dy > 26 * 26) {
          lastSpawn = { x: pos.x, y: pos.y };
          particles.push({
            x: pos.x + (Math.random() - 0.5) * 10,
            y: pos.y + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 0.7,
            vy: (Math.random() - 0.5) * 0.7 - 0.25,
            life: 1,
            gold: Math.random() < 0.3,
          });
          if (particles.length > 36) particles.splice(0, particles.length - 36);
        }
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
      ring.x += (pos.x - ring.x) * 0.32;
      ring.y += (pos.y - ring.y) * 0.32;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${Math.round(ring.x)}px, ${Math.round(ring.y)}px)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${Math.round(ring.x)}px, ${Math.round(ring.y)}px)`;
      }

      if (trailCtx) {
        trailCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        for (let i = particles.length - 1; i >= 0; i -= 1) {
          const p = particles[i];
          p.life -= 0.045;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          p.x += p.vx;
          p.y += p.vy;
          const color = p.gold ? '226,204,158' : '245,241,232';
          trailCtx.fillStyle = `rgba(${color},${(p.life * 0.4).toFixed(3)})`;
          trailCtx.beginPath();
          trailCtx.arc(p.x, p.y, 1.6 * p.life + 0.3, 0, Math.PI * 2);
          trailCtx.fill();
        }
      }

      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', move, { passive: true });
    window.addEventListener('resize', sizeTrail);
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('resize', sizeTrail);
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
      <canvas ref={trailRef} className="mo-trail" aria-hidden="true" />
      <div ref={dotRef} className="mo-cursor-dot" aria-hidden="true">
        <i />
      </div>
      <div ref={ringRef} className="mo-cursor-ring" aria-hidden="true">
        <span />
      </div>
    </>
  );
};
