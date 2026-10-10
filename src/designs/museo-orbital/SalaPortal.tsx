import { useRef, type CSSProperties, type RefObject } from 'react';
import {
  cubicBezier,
  motion,
  useInView,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useLocale } from '../../i18n/LocaleProvider';
import type { AstroChapter } from '../../types';
import './salaPortal.css';

const EASE_OUT = cubicBezier(0.16, 1, 0.3, 1);
const EASE_IN_OUT = cubicBezier(0.65, 0, 0.35, 1);

/* Guion del salto sobre el progreso del tramo fijo (0 = el escenario se
   ancla, 1 = se suelta). Ajustar aquí cambia el ritmo de todos los portales. */
const T = {
  hudIn: [0, 0.06],
  hudOut: [0.9, 0.98],
  ringIn: [0, 0.04],
  irisOpen: [0.02, 0.29],
  irisCover: [0.34, 0.56],
  numberIn: [0.04, 0.29],
  numberFill: [0.13, 0.32],
  numberFly: [0.35, 0.5],
  kickerIn: [0.39, 0.46],
  titleIn: [0.41, 0.53],
  // Pausa 0.53–0.76: imagen limpia con el título, acercándose despacio
  textIn: [0.76, 0.88],
  imageFade: [0.9, 1],
  warp: [0.28, 0.56],
} satisfies Record<string, [number, number]>;

/* ---------------- Palabra del título, revelada por scroll ---------------- */

const ScrubWord = ({
  word,
  progress,
  range,
  last,
}: {
  word: string;
  progress: MotionValue<number>;
  range: [number, number];
  last: boolean;
}) => {
  const y = useTransform(progress, range, ['112%', '0%'], { ease: EASE_OUT });
  return (
    <span className="mo-word-box">
      <motion.span className="mo-word" style={{ y }}>
        {word}
        {last ? '' : ' '}
      </motion.span>
    </span>
  );
};

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
    [T.ringIn[0], T.ringIn[1], T.irisCover[0], T.irisCover[0] + 0.13],
    [0, 1, 1, 0],
  );
  const glowOpacity = useTransform(progress, [0, T.irisOpen[1], T.irisCover[1]], [0, 0.75, 0]);

  const imageScale = useTransform(
    progress,
    [T.irisOpen[0], T.irisCover[0], T.irisCover[1], T.textIn[1]],
    [1.45, 1.15, 1.07, 1],
  );
  // La imagen se oscurece recién cuando llega el texto, no durante la pausa
  const scrimOpacity = useTransform(progress, T.textIn, [0.1, 0.5]);
  const irisOpacity = useTransform(progress, T.imageFade, [1, 0.32]);

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

  // La pregunta y el resumen llegan tras el título y se quedan: al soltarse
  // el escenario se van con el scroll como texto normal
  const kickerOpacity = useTransform(progress, T.kickerIn, [0, 1]);
  const textOpacity = useTransform(progress, T.textIn, [0, 1]);
  const textY = useTransform(progress, T.textIn, [28, 0], { ease: EASE_OUT });

  const hudOpacity = useTransform(
    progress,
    [T.hudIn[0], T.hudIn[1], T.hudOut[0], T.hudOut[1]],
    [0, 1, 1, 0],
  );

  const words = to.title.split(' ');
  const image = to.visual?.sectionImage ?? to.visual?.heroImage;
  const label = (chapter: AstroChapter) => `${t('Capítulo')} ${chapter.number.padStart(2, '0')}`;
  const wordSpan = (T.titleIn[1] - T.titleIn[0]) / (words.length + 1.5);

  return (
    <section
      ref={portalRef}
      className="mo-portal"
      aria-hidden="true"
      style={{ '--accent': to.color, '--from-accent': from.color } as CSSProperties}
    >
      <div className="mo-portal-stage">
        <motion.div className="mo-portal-glow" style={{ opacity: glowOpacity }} />

        <motion.div className="mo-portal-iris" style={{ clipPath, opacity: irisOpacity }}>
          <motion.div
            className="mo-portal-image"
            style={{
              scale: imageScale,
              backgroundImage: near && image ? `url(${image})` : undefined,
            }}
          />
          <motion.div className="mo-portal-scrim" style={{ opacity: scrimOpacity }} />
          <motion.div className="mo-portal-veil" style={{ opacity: textOpacity }} />
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

        <div className="mo-portal-copy">
          <motion.p className="mo-kicker mo-portal-kicker" style={{ opacity: kickerOpacity }}>
            {label(to)} · {to.concepts.length} {to.concepts.length === 1 ? t('tema') : t('temas')}
          </motion.p>
          <p className="mo-portal-title">
            {words.map((word, index) => {
              const start = T.titleIn[0] + index * wordSpan;
              return (
                <ScrubWord
                  key={`${word}-${index}`}
                  word={word}
                  progress={progress}
                  range={[start, start + wordSpan * 2.5]}
                  last={index === words.length - 1}
                />
              );
            })}
          </p>
          <motion.div className="mo-portal-text" style={{ opacity: textOpacity, y: textY }}>
            {to.question && <p className="mo-portal-question">{to.question}</p>}
            <p className="mo-portal-summary">{to.summary}</p>
          </motion.div>
        </div>

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
      </div>
    </section>
  );
};
