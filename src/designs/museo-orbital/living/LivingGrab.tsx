import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useLocale } from '../../../i18n/LocaleProvider';
import { livingSignal, SHELL_SCALE, starFrame } from './livingHero';

/* Zona de agarre sobre la esfera: arrastrar gira la cámara alrededor de la
   obra. Está marcada como interactiva (data-cursor), así el cielo no lanza
   meteoritos ni supernovas desde aquí y el cursor del museo la anuncia. */

// Radianes por píxel arrastrado
const YAW_PER_PX = 0.0055;
const PITCH_PER_PX = 0.0045;

export const LivingGrab = ({ heroRef }: { heroRef: RefObject<HTMLElement | null> }) => {
  const { t } = useLocale();
  const grabRef = useRef<HTMLDivElement>(null);

  // Del tamaño de la esfera en su lugar final
  useLayoutEffect(() => {
    const grab = grabRef.current;
    const hero = heroRef.current ?? grab?.closest<HTMLElement>('.mo-hero') ?? null;
    if (!hero || !grab) return;
    const place = () => {
      const frame = starFrame(hero.clientWidth, hero.clientHeight);
      grab.style.setProperty('--grab-x', `${Math.round(frame.x)}px`);
      grab.style.setProperty('--grab-y', `${Math.round(frame.y)}px`);
      grab.style.setProperty('--grab-d', `${Math.round(frame.r * SHELL_SCALE * 1.85)}px`);
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(hero);
    return () => observer.disconnect();
  }, [heroRef]);

  useEffect(() => {
    const grab = grabRef.current;
    if (!grab) return;
    const spin = livingSignal.spin;
    let last = { x: 0, y: 0, at: 0 };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      grab.setPointerCapture(event.pointerId);
      spin.dragging = true;
      spin.velocityYaw = 0;
      spin.velocityPitch = 0;
      spin.touchedAt = performance.now();
      last = { x: event.clientX, y: event.clientY, at: performance.now() };
      grab.classList.add('is-grabbing');
    };
    // Arrastrar a la derecha gira la obra hacia la derecha: la cámara va al revés
    const onMove = (event: PointerEvent) => {
      if (!spin.dragging) return;
      const now = performance.now();
      const seconds = Math.max(0.001, (now - last.at) / 1000);
      const yaw = -(event.clientX - last.x) * YAW_PER_PX;
      const pitch = (event.clientY - last.y) * PITCH_PER_PX;
      spin.yaw += yaw;
      spin.pitch += pitch;
      spin.velocityYaw = spin.velocityYaw * 0.5 + (yaw / seconds) * 0.5;
      spin.velocityPitch = spin.velocityPitch * 0.5 + (pitch / seconds) * 0.5;
      spin.touchedAt = now;
      last = { x: event.clientX, y: event.clientY, at: now };
    };
    const onUp = () => {
      if (!spin.dragging) return;
      spin.dragging = false;
      spin.touchedAt = performance.now();
      // Si se detuvo antes de soltar, no queda inercia
      if (performance.now() - last.at > 80) {
        spin.velocityYaw = 0;
        spin.velocityPitch = 0;
      }
      grab.classList.remove('is-grabbing');
    };

    grab.addEventListener('pointerdown', onDown);
    grab.addEventListener('pointermove', onMove);
    grab.addEventListener('pointerup', onUp);
    grab.addEventListener('pointercancel', onUp);
    grab.addEventListener('lostpointercapture', onUp);
    return () => {
      grab.removeEventListener('pointerdown', onDown);
      grab.removeEventListener('pointermove', onMove);
      grab.removeEventListener('pointerup', onUp);
      grab.removeEventListener('pointercancel', onUp);
      grab.removeEventListener('lostpointercapture', onUp);
      spin.dragging = false;
    };
  }, []);

  return (
    <div
      ref={grabRef}
      className="mo-living-grab"
      data-cursor=""
      data-cursor-label={t("Arrastra para girar")}
      aria-hidden="true"
    />
  );
};
