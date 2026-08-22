import { useEffect, useRef, useState } from 'react';

const CURSOR_CLASS = 'mo-has-custom-cursor';

export const MuseumCursor = () => {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setEnabled(true);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ring = { ...pos };
    let raf = 0;
    let wasActive = false;
    let lastLabel = '';
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const particles: { x: number; y: number; vx: number; vy: number; life: number; gold: boolean }[] = [];
    let lastSpawn = { x: pos.x, y: pos.y };
    let trailCtx: CanvasRenderingContext2D | null = null;

    const sizeTrail = () => {
      const canvas = trailRef.current;
      if (!canvas) return;
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      trailCtx = canvas.getContext('2d');
      trailCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    sizeTrail();

    const move = (event: MouseEvent) => {
      pos.x = event.clientX;
      pos.y = event.clientY;

      const dx = pos.x - lastSpawn.x;
      const dy = pos.y - lastSpawn.y;
      if (dx * dx + dy * dy > 22 * 22) {
        lastSpawn = { x: pos.x, y: pos.y };
        particles.push({
          x: pos.x + (Math.random() - 0.5) * 12,
          y: pos.y + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8 - 0.3,
          life: 1,
          gold: Math.random() < 0.35,
        });
        if (particles.length > 42) particles.splice(0, particles.length - 42);
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
          p.life -= 0.04;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          p.x += p.vx;
          p.y += p.vy;
          const color = p.gold ? '230,204,150' : '245,241,232';
          trailCtx.fillStyle = `rgba(${color},${(p.life * 0.55).toFixed(3)})`;
          trailCtx.beginPath();
          trailCtx.arc(p.x, p.y, 2.1 * p.life + 0.4, 0, Math.PI * 2);
          trailCtx.fill();
        }

        if (particles.length > 1) {
          for (let a = 0; a < particles.length; a += 1) {
            for (let b = a + 1; b < particles.length; b += 1) {
              const pa = particles[a];
              const pb = particles[b];
              if (pa.life < 0.18 || pb.life < 0.18) continue;
              const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
              if (d < 48) {
                trailCtx.strokeStyle = `rgba(230,204,150,${((1 - d / 48) * Math.min(pa.life, pb.life) * 0.3).toFixed(3)})`;
                trailCtx.lineWidth = 0.8;
                trailCtx.beginPath();
                trailCtx.moveTo(pa.x, pa.y);
                trailCtx.lineTo(pb.x, pb.y);
                trailCtx.stroke();
              }
            }
          }
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
  }, [enabled]);

  useEffect(() => {
    const root = document.querySelector('.mo-root');
    if (!root || !enabled) return;
    root.classList.add(CURSOR_CLASS);
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
