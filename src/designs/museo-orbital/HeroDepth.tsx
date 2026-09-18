import { memo, useEffect, useState, type RefObject } from 'react';
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'framer-motion';

const ASSET_BASE = `${import.meta.env.BASE_URL}illustrations/ai/hero-depth/`;
const LAYERS = [
  { name: 'background', amplitude: 3 },
  { name: 'middle', amplitude: 8 },
  { name: 'foreground', amplitude: 16 },
] as const;
const SPRING = { stiffness: 85, damping: 24, mass: 1, restDelta: 0.004, restSpeed: 0.004 };
const DEPTH_MEDIA = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

function DepthLayer({ name, amplitude, x, y }: {
  name: string;
  amplitude: number;
  x: MotionValue<number>;
  y: MotionValue<number>;
}) {
  const translateX = useTransform(x, value => -value * amplitude);
  const translateY = useTransform(y, value => -value * amplitude * 0.6);
  return <motion.img
    className={`mo-hero-depth-layer mo-hero-depth-${name}`}
    src={`${ASSET_BASE}${name}.webp`}
    alt=""
    draggable={false}
    style={{ x: translateX, y: translateY, z: 0 }}
  />;
}

/**
 * Experimental depth treatment, currently disconnected from MuseoOrbital because
 * full-screen transparent layers were too expensive on lower-powered GPUs.
 * Pointer motion lives entirely in MotionValues, outside React's render cycle.
 */
export const HeroDepth = memo(function HeroDepth({ heroRef, original, paused }: {
  heroRef: RefObject<HTMLElement | null>;
  original: string | undefined;
  paused: boolean;
}) {
  const [enabled, setEnabled] = useState(() => window.matchMedia(DEPTH_MEDIA).matches);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [performanceLimited, setPerformanceLimited] = useState(false);
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const x = useSpring(targetX, SPRING);
  const y = useSpring(targetY, SPRING);
  const ready = enabled && loaded && !failed && !performanceLimited;

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || !ready || paused) return;
    // Ignore entry/loading work. Only sample while the visitor is moving the pointer.
    const eligibleAt = performance.now() + 3500;
    let frame = 0;
    let lastInput = 0;
    let previous = 0;
    let elapsed = 0;
    let samples = 0;
    let slow = 0;
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      elapsed = 0;
      samples = 0;
      slow = 0;
    };
    const sample = (now: number) => {
      frame = 0;
      if (document.hidden || now - lastInput > 350) { stop(); return; }
      if (previous) {
        const delta = now - previous;
        elapsed += delta;
        samples++;
        if (delta > 28) slow++;
      }
      previous = now;
      if (elapsed >= 2400 && samples >= 25) {
        const struggling = elapsed / samples > 30 && slow / samples > 0.65;
        stop();
        if (struggling) {
          // Stay static for this mount; never oscillate between quality levels.
          setPerformanceLimited(true);
          return;
        }
      }
      frame = requestAnimationFrame(sample);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || document.hidden || performance.now() < eligibleAt) return;
      lastInput = performance.now();
      if (!frame) frame = requestAnimationFrame(sample);
    };
    hero.addEventListener('pointermove', onMove, { passive: true });
    hero.addEventListener('pointerleave', stop);
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    return () => {
      stop();
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', stop);
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', stop);
    };
  }, [heroRef, ready, paused]);

  useEffect(() => {
    const media = window.matchMedia(DEPTH_MEDIA);
    const update = () => setEnabled(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!enabled || loaded || failed) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      cancelled = true;
      setFailed(true);
    }, 15_000);
    // Decode every plate before replacing the original; a partial scene is never shown.
    Promise.all(LAYERS.map(async ({ name }) => {
      const image = new Image();
      image.src = `${ASSET_BASE}${name}.webp`;
      await image.decode();
      return image;
    })).then(images => {
      if (cancelled) return;
      const first = images[0];
      if (!images.every(image => image.naturalWidth === first.naturalWidth && image.naturalHeight === first.naturalHeight)) {
        setFailed(true);
      } else {
        setLoaded(true);
      }
    }).catch(() => {
      if (!cancelled) setFailed(true);
    }).finally(() => window.clearTimeout(timeout));
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [enabled, loaded, failed]);

  useEffect(() => {
    const reset = () => {
      targetX.jump(0);
      targetY.jump(0);
      x.jump(0);
      y.jump(0);
    };
    reset();
    const hero = heroRef.current;
    if (!hero || !ready || paused) return;
    let visible = false;
    let rect = hero.getBoundingClientRect();
    const measure = () => { rect = hero.getBoundingClientRect(); };
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(hero);
    const scrollRoot = hero.closest('.mo-root');
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      measure();
      if (!visible) reset();
    }, { root: hero.closest('.mo-root'), threshold: 0 });
    observer.observe(hero);
    const onMove = (event: PointerEvent) => {
      if (!visible || document.hidden || event.pointerType !== 'mouse') return;
      if (!rect.width || !rect.height) return;
      const clamp = (value: number) => Math.max(-1, Math.min(1, value));
      targetX.set(clamp((event.clientX - rect.left) / rect.width * 2 - 1));
      targetY.set(clamp((event.clientY - rect.top) / rect.height * 2 - 1));
    };
    const recenter = () => { targetX.set(0); targetY.set(0); };
    const onVisibility = () => { if (document.hidden) reset(); };
    hero.addEventListener('pointermove', onMove, { passive: true });
    hero.addEventListener('pointerleave', recenter);
    hero.addEventListener('pointercancel', recenter);
    scrollRoot?.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      scrollRoot?.removeEventListener('scroll', measure);
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', recenter);
      hero.removeEventListener('pointercancel', recenter);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', onVisibility);
      reset();
    };
  }, [heroRef, ready, paused, targetX, targetY, x, y]);

  return <motion.div
    className="mo-hero-bg"
    aria-hidden="true"
    data-depth={ready ? 'ready' : 'static'}
    data-depth-paused={paused || !ready}
    data-depth-performance={performanceLimited ? 'limited' : 'normal'}
    initial={enabled ? { scale: 1.22, opacity: 0 } : false}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ duration: enabled ? 3 : 0, ease: [0.16, 1, 0.3, 1] }}
  >
    {!ready && <img className="mo-hero-depth-original" src={original} alt="" fetchPriority="high" />}
    {ready && <div
      className="mo-hero-depth-plates"
      onErrorCapture={() => setFailed(true)}
    >
      {LAYERS.map(layer => <DepthLayer key={layer.name} {...layer} x={x} y={y} />)}
    </div>}
  </motion.div>;
});
