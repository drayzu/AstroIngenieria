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

interface Comet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface Wave {
  x: number;
  y: number;
  r: number;
  alpha: number;
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
    let comets: Comet[] = [];
    let waves: Wave[] = [];
    let sparkles: { x: number; y: number; vx: number; vy: number; life: number; tint: number }[] = [];
    let raf = 0;
    let time = 0;
    let scrollVel = 0;
    let lastScroll = scrollRef.current?.scrollTop ?? 0;
    let dimLevel = 0;
    let running = true;
    let nextComet = time + 4 + Math.random() * 5;

    const mouse = { x: -9999, y: -9999, sx: -9999, sy: -9999 };

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

    const onMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      if (mouse.sx < -999) {
        mouse.sx = mouse.x;
        mouse.sy = mouse.y;
      }
    };

    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.mo-hero')) return;
      waves.push({ x: event.clientX, y: event.clientY, r: 6, alpha: 0.85 });
      for (let s = 0; s < 18; s += 1) {
        const ang = (Math.PI * 2 * s) / 12 + Math.random() * 0.4;
        const spd = 3.2 + Math.random() * 3.4;
        sparkles.push({ x: event.clientX, y: event.clientY, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1, tint: Math.random() < 0.6 ? 0 : 1 });
      }
      if (sparkles.length > 90) sparkles.splice(0, sparkles.length - 90);
      if (waves.length > 4) waves.shift();
    };

    const spawnComet = () => {
      const fromLeft = Math.random() < 0.5;
      const speed = 7 + Math.random() * 5;
      const angle = (Math.PI / 180) * (18 + Math.random() * 16);
      comets.push({
        x: fromLeft ? -40 : width + 40,
        y: Math.random() * height * 0.45,
        vx: (fromLeft ? 1 : -1) * Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
      });
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

      mouse.sx += (mouse.x - mouse.sx) * 0.055;
      mouse.sy += (mouse.y - mouse.sy) * 0.055;
      const parX = mouse.sx > -999 ? (mouse.sx / width - 0.5) * 2 : 0;
      const parY = mouse.sy > -999 ? (mouse.sy / height - 0.5) * 2 : 0;

      ctx.clearRect(0, 0, width, height);
      const warp = Math.min(34, Math.abs(scrollVel) * 0.055);
      const dir = Math.sign(scrollVel) || 1;

      const drawn: { x: number; y: number; z: number }[] = [];

      for (const star of stars) {
        star.x -= 0.05 * star.z;
        star.y -= scrollVel * 0.045 * star.z;
        if (star.x < -60) star.x = width + 60;
        if (star.x > width + 60) star.x = -60;
        if (star.y < -80) star.y = height + 80;
        if (star.y > height + 80) star.y = -80;

        for (const wave of waves) {
          const d = Math.hypot(star.x - wave.x, star.y - wave.y);
          const band = Math.abs(d - wave.r);
          if (band < 46) {
            const push = (1 - band / 46) * wave.alpha * 7;
            const inv = 1 / (d || 1);
            star.x += (star.x - wave.x) * inv * push;
            star.y += (star.y - wave.y) * inv * push;
          }
        }

        const px = star.x + parX * star.z * 16;
        const py = star.y + parY * star.z * 11;

        const [r, g, b] = TINTS[star.tint];
        const twinkle = 0.55 + 0.45 * Math.sin(time * (0.6 + star.z) + star.phase);
        const alpha = (0.16 + star.z * 0.5) * twinkle * dimLevel;
        const size = star.z * 1.5 + 0.3;

        if (warp > 1.2) {
          const len = warp * star.z * dir;
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = size * 0.9;
          ctx.beginPath();
          ctx.moveTo(px, py - len * 0.5);
          ctx.lineTo(px, py + len * 0.5);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fill();
        }

        if (mouse.sx > -999) {
          const dc = Math.hypot(px - mouse.sx, py - mouse.sy);
          if (dc < 185 && drawn.length < 36) drawn.push({ x: px, y: py, z: star.z });
        }
      }

      if (drawn.length > 1 && dimLevel > 0.5) {
        ctx.lineWidth = 1.15;
        for (let i = 0; i < drawn.length; i += 1) {
          for (let j = i + 1; j < drawn.length; j += 1) {
            const dx = drawn[i].x - drawn[j].x;
            const dy = drawn[i].y - drawn[j].y;
            const d = Math.hypot(dx, dy);
            if (d < 132) {
              const near = 1 - Math.min(1, Math.hypot((drawn[i].x + drawn[j].x) / 2 - mouse.sx, (drawn[i].y + drawn[j].y) / 2 - mouse.sy) / 185);
              const lineAlpha = 0.85 * (1 - d / 132) * near * dimLevel;
              ctx.strokeStyle = `rgba(226,204,158,${(lineAlpha * 0.38).toFixed(3)})`;
              ctx.lineWidth = 3.4;
              ctx.beginPath();
              ctx.moveTo(drawn[i].x, drawn[i].y);
              ctx.lineTo(drawn[j].x, drawn[j].y);
              ctx.stroke();
              ctx.strokeStyle = `rgba(250,240,214,${lineAlpha.toFixed(3)})`;
              ctx.lineWidth = 1.6;
              ctx.beginPath();
              ctx.moveTo(drawn[i].x, drawn[i].y);
              ctx.lineTo(drawn[j].x, drawn[j].y);
              ctx.stroke();
            }
          }
        }
      }

      for (const node of drawn) {
        ctx.fillStyle = `rgba(232,208,160,${(0.32 * dimLevel).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.z * 5.2, 0, Math.PI * 2);
        ctx.fill();
      }

      sparkles = sparkles.filter((sp) => sp.life > 0.02);
      for (const sp of sparkles) {
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vx *= 0.965;
        sp.vy *= 0.965;
        sp.life -= 0.024;
        const [sr, sg, sb] = TINTS[sp.tint];
        ctx.fillStyle = `rgba(${sr},${sg},${sb},${Math.min(1, sp.life * 1.15 * dimLevel).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 2.3 * sp.life + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (time > nextComet) {
        spawnComet();
        nextComet = time + 6 + Math.random() * 6;
      }
      comets = comets.filter((comet) => comet.life > 0);
      for (const comet of comets) {
        comet.x += comet.vx;
        comet.y += comet.vy;
        comet.life -= 0.012;
        if (comet.x < -80 || comet.x > width + 80 || comet.y > height + 60) comet.life = 0;
        const tailX = comet.x - comet.vx * 9;
        const tailY = comet.y - comet.vy * 9;
        const gradient = ctx.createLinearGradient(comet.x, comet.y, tailX, tailY);
        gradient.addColorStop(0, `rgba(245,241,232,${0.85 * comet.life * dimLevel})`);
        gradient.addColorStop(1, 'rgba(245,241,232,0)');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(comet.x, comet.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,250,240,${0.9 * comet.life * dimLevel})`;
        ctx.beginPath();
        ctx.arc(comet.x, comet.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      waves = waves.filter((wave) => wave.alpha > 0.02);
      for (const wave of waves) {
        wave.r += 6.5;
        wave.alpha *= 0.94;
        ctx.strokeStyle = `rgba(201,168,106,${(wave.alpha * 0.5 * dimLevel).toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener('resize', resize);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, a, input, textarea')) return;
      if ((scrollRef.current?.scrollTop ?? 0) > window.innerHeight * 0.9) return;
      event.preventDefault();
      spawnComet();
      window.setTimeout(() => { if (document.visibilityState === 'visible') spawnComet(); }, 220);
    };
    window.addEventListener('keydown', onKeyDown);

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    const scrollEl = scrollRef.current;
    scrollEl?.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('pointerdown', onDown);
      scrollEl?.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [scrollRef]);

  return <canvas ref={canvasRef} className="mo-starfield" aria-hidden="true" />;
};
