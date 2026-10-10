import { useRef, type CSSProperties, type RefObject } from 'react';
import {
  cubicBezier,
  motion,
  useInView,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { useLocale } from '../../i18n/LocaleProvider';
import type { AstroChapter } from '../../types';
import './salaPortal.css';

const EASE_OUT = cubicBezier(0.16, 1, 0.3, 1);
const EASE_IN_OUT = cubicBezier(0.65, 0, 0.35, 1);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/* Guion del salto sobre el progreso del tramo fijo (0 = el escenario se
   ancla, 1 = se suelta). Ajustar aquí cambia el ritmo de todos los portales. */
const T = {
  hudIn: [0, 0.08],
  hudOut: [0.86, 0.97],
  ringIn: [0, 0.05],
  irisOpen: [0.03, 0.42],
  irisCover: [0.48, 0.8],
  numberIn: [0.06, 0.42],
  numberFill: [0.18, 0.46],
  numberFly: [0.5, 0.72],
  shade: [0.8, 0.93],
  arrive: [0.92, 1],
  // Fundido corto: la cabecera aún sube bajo el escenario y en un relevo
  // largo se vería la imagen doble
  handoff: [0.95, 1],
  warp: [0.4, 0.8],
} satisfies Record<string, [number, number]>;

/* ---------------- Portal entre capítulos ---------------- */

export const SalaPortal = ({
  from,
  to,
  scrollRef,
  onCross,
}: {
  from: AstroChapter;
  to: AstroChapter;
  scrollRef: RefObject<HTMLDivElement | null>;
  onCross: (chapter: AstroChapter) => void;
}) => {
  const { t } = useLocale();
  const portalRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    container: scrollRef,
    target: portalRef,
    offset: ['start start', 'end end'],
  });
  // Un muelle corto suaviza los saltos de la rueda sin despegarse del dedo
  const progress = useSpring(scrollYProgress, { stiffness: 170, damping: 32, mass: 0.4 });

  // La imagen de fondo solo se pide cuando el portal se acerca: los fondos
  // CSS no tienen carga diferida nativa.
  const near = useInView(portalRef, { root: scrollRef, margin: '150% 0px', once: true });

  const lastValue = useRef(0);
  const crossed = useRef<boolean | null>(null);
  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const delta = value - lastValue.current;
    lastValue.current = value;
    const side = value >= 0.5;
    if (side !== crossed.current) {
      crossed.current = side;
      // Un salto que deja el portal fuera de pantalla (carga con scroll
      // restaurado, arrastre de la barra) no es un cruce: la sala activa la
      // corrige el observador de salas.
      const offStage = value <= 0 || value >= 1;
      if (!offStage || Math.abs(delta) <= 0.5) onCross(side ? to : from);
    }
    // Impulso al cielo en el tramo central: las estrellas se estiran con el salto
    if (value > T.warp[0] && value < T.warp[1] && Math.abs(delta) > 0.002) {
      window.dispatchEvent(
        new CustomEvent('mo-warp', {
          detail: { strength: Math.min(9, Math.abs(delta) * 240), direction: delta > 0 ? 1 : -1 },
        }),
      );
    }
  });

  // Iris: un punto de luz que se abre en ventana (vmin) y luego cubre todo (vmax)
  const irisMin = useTransform(progress, [0, T.irisOpen[0], T.irisOpen[1]], [0.7, 0.7, 30], {
    ease: EASE_OUT,
  });
  const irisMax = useTransform(progress, T.irisCover, [0, 76], { ease: EASE_IN_OUT });
  const radius = useTransform(
    [irisMin, irisMax],
    ([min, max]: number[]) => `calc(${min.toFixed(3)}vmin + ${max.toFixed(3)}vmax)`,
  );
  const clipPath = useTransform(radius, (r) => `circle(${r} at 50% 50%)`);
  const ringSize = useTransform(radius, (r) => `calc(${r} * 2)`);
  const ringOpacity = useTransform(
    progress,
    [T.ringIn[0], T.ringIn[1], T.irisCover[0], T.irisCover[0] + 0.18],
    [0, 1, 1, 0],
  );
  const glowOpacity = useTransform(progress, [0, T.irisOpen[1], T.irisCover[1]], [0, 0.75, 0]);

  const imageScale = useTransform(
    progress,
    [T.irisOpen[0], T.irisCover[0], T.irisCover[1]],
    [1.45, 1.15, 1],
  );
  const scrimOpacity = useTransform(progress, T.irisCover, [0.12, 0.3]);
  // Sombra de la cabecera: el último cuadro del portal ya luce como ella
  const shadeOpacity = useTransform(progress, T.shade, [0, 1]);

  // Relevo: la última pantalla del portal se superpone a la cabecera del
  // capítulo, que ya está debajo con la misma imagen. El escenario se
  // disuelve y los textos de la cabecera llegan en ese mismo tramo.
  const stageOpacity = useTransform(progress, T.handoff, [1, 0]);
  const salaRef = useRef<HTMLElement | null>(null);
  useMotionValueEvent(progress, 'change', (value) => {
    salaRef.current ??= document.getElementById(`sala-${to.id}`);
    const arrive = clamp01((value - T.arrive[0]) / (T.arrive[1] - T.arrive[0]));
    salaRef.current?.style.setProperty('--arrive', arrive.toFixed(3));
  });

  // Número monumental: llega desde el fondo, se rellena y lo atravesamos
  const numberScale = useTransform(
    progress,
    [T.numberIn[0], T.numberIn[1], T.numberFly[0], T.numberFly[1]],
    [0.3, 1, 1, 2.4],
    { ease: [EASE_OUT, (t) => t, EASE_IN_OUT] },
  );
  const numberOpacity = useTransform(
    progress,
    [T.numberIn[0], T.numberIn[0] + 0.1, T.numberFly[0], T.numberFly[1]],
    [0, 1, 1, 0],
  );
  const numberClip = useTransform(progress, T.numberFill, [
    'inset(100% 0% 0% 0%)',
    'inset(-15% -15% -15% -15%)',
  ]);

  const hudOpacity = useTransform(
    progress,
    [T.hudIn[0], T.hudIn[1], T.hudOut[0], T.hudOut[1]],
    [0, 1, 1, 0],
  );

  const image = to.visual?.sectionImage ?? to.visual?.heroImage;
  const label = (chapter: AstroChapter) => `${t('Capítulo')} ${chapter.number.padStart(2, '0')}`;

  return (
    <section
      ref={portalRef}
      className="mo-portal"
      aria-hidden="true"
      style={{ '--accent': to.color, '--from-accent': from.color } as CSSProperties}
    >
      <motion.div className="mo-portal-stage" style={{ opacity: stageOpacity }}>
        <motion.div className="mo-portal-glow" style={{ opacity: glowOpacity }} />

        <motion.div className="mo-portal-iris" style={{ clipPath }}>
          <motion.div
            className="mo-portal-image"
            style={{
              scale: imageScale,
              backgroundImage: near && image ? `url(${image})` : undefined,
            }}
          />
          <motion.div className="mo-portal-scrim" style={{ opacity: scrimOpacity }} />
          <motion.div className="mo-portal-shade" style={{ opacity: shadeOpacity }} />
        </motion.div>

        <motion.span
          className="mo-portal-ring"
          style={{ width: ringSize, height: ringSize, opacity: ringOpacity }}
        />

        <motion.span
          className="mo-portal-no"
          style={{ scale: numberScale, opacity: numberOpacity }}
        >
          <span className="mo-portal-no-outline">{to.number}</span>
          <motion.span className="mo-portal-no-fill" style={{ clipPath: numberClip }}>
            {to.number}
          </motion.span>
        </motion.span>


        <motion.div className="mo-portal-hud" style={{ opacity: hudOpacity }}>
          <span className="mo-portal-hud-from">
            <i />
            {label(from)}
            <em> · {from.title}</em>
          </span>
          <span className="mo-portal-hud-line">
            <motion.i style={{ scaleX: progress }} />
          </span>
          <span className="mo-portal-hud-to">
            {label(to)}
            <em> · {to.title}</em>
            <i />
          </span>
        </motion.div>
      </motion.div>
    </section>
  );
};
