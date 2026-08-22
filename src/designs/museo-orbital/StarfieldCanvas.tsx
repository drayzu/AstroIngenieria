import { useEffect, useRef, type RefObject } from 'react';

interface StarfieldProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  dim?: boolean;
}

interface Star {
  x: number;
  y: number;
  z: number;
  tint: number;
  phase: number;
}

const TINTS = [
  [245, 241, 232],
  [201, 168, 106],
  [143, 208, 255],
];

export const StarfieldCanvas = ({ scrollRef, dim = false }: StarfieldProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dimRef = useRef(dim);
  dimRef.current = dim;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let raf = 0;
    let time = 0;
    let scrollVel = 0;
    let lastScroll = scrollRef.current?.scrollTop ?? 0;
    let dimLevel = 0;
    let running = true;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const seed = () => {
      const count = Math.round((width * height) / 5200);
      stars = Array.from({ length: Math.min(560, Math.max(180, count)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        z: 0.25 + Math.random() * 0.75,
        tint: Math.random() < 0.82 ? 0 : Math.random() < 0.5 ? 1 : 2,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const onScroll = () => {
      const top = scrollRef.current?.scrollTop ?? 0;
      scrollVel = scrollVel * 0.82 + (top - lastScroll) * 0.18;
      lastScroll = top;
    };

    const onVisibility = () => {
      running = !document.hidden;
      if (running) {
        lastScroll = scrollRef.current?.scrollTop ?? 0;
        raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
      }
    };

    const frame = () => {
      if (!running) return;
      time += 0.016;
      scrollVel *= 0.92;
      const targetDim = dimRef.current ? 0.22 : 1;
      dimLevel += (targetDim - dimLevel) * 0.06;

      ctx.clearRect(0, 0, width, height);
      const warp = Math.min(34, Math.abs(scrollVel) * 0.055);
      const dir = Math.sign(scrollVel) || 1;

      for (const star of stars) {
        star.x -= 0.05 * star.z;
        star.y -= scrollVel * 0.045 * star.z;
        if (star.x < -40) star.x = width + 40;
        if (star.x > width + 40) star.x = -40;
        if (star.y < -60) star.y = height + 60;
        if (star.y > height + 60) star.y = -60;

        const [r, g, b] = TINTS[star.tint];
        const twinkle = 0.55 + 0.45 * Math.sin(time * (0.6 + star.z) + star.phase);
        const alpha = (0.16 + star.z * 0.5) * twinkle * dimLevel;
        const size = star.z * 1.5 + 0.3;

        if (warp > 1.2) {
          const len = warp * star.z * dir;
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = size * 0.9;
          ctx.beginPath();
          ctx.moveTo(star.x, star.y - len * 0.5);
          ctx.lineTo(star.x, star.y + len * 0.5);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener('resize', resize);
    const scrollEl = scrollRef.current;
    scrollEl?.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      scrollEl?.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [scrollRef]);

  return <canvas ref={canvasRef} className="mo-starfield" aria-hidden="true" />;
};
