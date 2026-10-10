import { useRef, type RefObject } from 'react';
import {
  cubicBezier,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useLocale } from '../../i18n/LocaleProvider';
import './museumFinale.css';

const EASE_OUT = cubicBezier(0.16, 1, 0.3, 1);
// El colapso acelera hacia el final, como una estrella que cede a su peso
const EASE_COLLAPSE = cubicBezier(0.55, 0, 0.85, 0.35);

const QUOTE = 'La naturaleza necesitó miles de millones de años para engendrar una mente capaz de comprenderla. Bastó una fracción de ese tiempo para que aquella mente aprendiera a crear otras. Y así, de un universo que nunca supo hacia dónde iba, nació algo capaz de elegir hacia dónde irá.';
const SIGNATURE = 'ASTROINGENIERÍA — EXPOSICIÓN PERMANENTE · MUSEO ORBITAL · MMXXVI';

/* Guion del cierre sobre el tramo fijo: primero la cita; luego un punto de
   luz se carga mientras un anillo de luz se cierra sobre él (implosión),
   estalla y la visita vuelve a empezar desde ese mismo punto. */
const T = {
  quote: [0.03, 0.34],
  signature: [0.34, 0.41],
  copyOut: [0.5, 0.58],
  dotIn: [0.52, 0.58],
  implode: [0.6, 0.85],
  burst: [0.85, 0.96],
} satisfies Record<string, [number, number]>;
// Pasado este punto bajando, se vuelve al inicio
const HOME_AT = 0.95;

const QuoteSentence = ({
  text,
  progress,
  range,
}: {
  text: string;
  progress: MotionValue<number>;
  range: [number, number];
}) => {
  const opacity = useTransform(progress, range, [0, 1]);
  const y = useTransform(progress, range, [18, 0], { ease: EASE_OUT });
  const filter = useTransform(progress, range, ['blur(8px)', 'blur(0px)']);
  return <motion.span style={{ opacity, y, filter }}>{text}</motion.span>;
};

export const MuseumFinale = ({
  scrollRef,
  onReturn,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  onReturn: () => void;
}) => {
  const { t } = useLocale();
  const reduced = useReducedMotion();
  const finaleRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    container: scrollRef,
    target: finaleRef,
    offset: ['start start', 'end end'],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 170, damping: 32, mass: 0.4 });

  // La cita se va hacia arriba antes de que aparezca el punto
  const copyOpacity = useTransform(progress, T.copyOut, [1, 0]);
  const copyY = useTransform(progress, T.copyOut, [0, -40]);
  const copyFilter = useTransform(progress, T.copyOut, ['blur(0px)', 'blur(6px)']);
  const signatureOpacity = useTransform(progress, T.signature, [0, 1]);

  // El punto aparece, se carga durante la implosión y salta en el estallido
  const dotOpacity = useTransform(progress, T.dotIn, [0, 1]);
  const dotScale = useTransform(
    progress,
    [T.dotIn[0], T.dotIn[1], T.implode[1], T.burst[0] + 0.03, T.burst[1]],
    [0, 1, 1.7, 2.8, 1],
  );

  // Implosión: un anillo fino de luz se cierra sobre el punto, acelerando
  const implodeScale = useTransform(progress, T.implode, [1, 0.006], { ease: EASE_COLLAPSE });
  const implodeOpacity = useTransform(
    progress,
    [T.implode[0], T.implode[0] + 0.04, T.implode[1] - 0.02, T.implode[1]],
    [0, 0.9, 0.9, 0],
  );

  // Destello horizontal: se carga con la implosión y se abre en el estallido
  const flareScale = useTransform(
    progress,
    [T.implode[0] + 0.02, T.implode[1], T.burst[0] + 0.03, T.burst[1]],
    [0, 0.5, 1, 1.6],
  );
  const flareOpacity = useTransform(
    progress,
    [T.implode[0] + 0.02, T.implode[1], T.burst[0] + 0.02, T.burst[1]],
    [0, 0.55, 1, 0],
  );

  // Estallido: destello y onda que se abre (solo existe a partir del estallido)
  const flashOpacity = useTransform(progress, [T.burst[0], T.burst[0] + 0.015, T.burst[1]], [0, 0.85, 0]);
  const ringScale = useTransform(progress, T.burst, [0.1, 3.4], { ease: EASE_OUT });
  const ringOpacity = useTransform(progress, [T.burst[0], T.burst[0] + 0.005, T.burst[1]], [0, 0.95, 0]);

  // Sacudida del cielo en el estallido y vuelta al inicio al terminar
  const burst = useRef(false);
  const returning = useRef(false);
  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const burstNow = value >= T.burst[0];
    if (burstNow !== burst.current) {
      burst.current = burstNow;
      if (burstNow) {
        window.dispatchEvent(new CustomEvent('mo-warp', { detail: { strength: 30, direction: -1 } }));
      }
    }
    if (value < T.copyOut[0]) returning.current = false;
    if (value >= HOME_AT && !returning.current) {
      returning.current = true;
      onReturn();
    }
  });

  const sentences = t(QUOTE).split(/(?<=[.!?])\s+/);
  const span = (T.quote[1] - T.quote[0]) / sentences.length;

  if (reduced) {
    return (
      <footer ref={finaleRef} className="mo-finale mo-layer is-static">
        <blockquote className="mo-finale-quote">
          {sentences.map((sentence) => <span key={sentence}>{sentence}</span>)}
        </blockquote>
        <p className="mo-finale-line">{t(SIGNATURE)}</p>
        <button type="button" className="mo-finale-restart" onClick={onReturn}>
          <i aria-hidden="true" />
          {t('Volver al comienzo')}
        </button>
      </footer>
    );
  }

  return (
    <footer ref={finaleRef} className="mo-finale mo-layer">
      <div className="mo-finale-stage">
        <motion.div className="mo-finale-copy" style={{ opacity: copyOpacity, y: copyY, filter: copyFilter }}>
          <blockquote className="mo-finale-quote">
            {sentences.map((sentence, index) => {
              const start = T.quote[0] + index * span;
              return (
                <QuoteSentence
                  key={sentence}
                  text={sentence}
                  progress={progress}
                  range={[start, start + span * 1.3]}
                />
              );
            })}
          </blockquote>
          <motion.p className="mo-finale-line" style={{ opacity: signatureOpacity }}>
            {t(SIGNATURE)}
          </motion.p>
        </motion.div>

        <motion.span className="mo-finale-flash" style={{ opacity: flashOpacity }} aria-hidden="true" />

        <div className="mo-finale-anchor" aria-hidden="true">
          <motion.span className="mo-finale-ring is-implode" style={{ opacity: implodeOpacity, scale: implodeScale }} />
          <motion.span className="mo-finale-flare" style={{ opacity: flareOpacity, scaleX: flareScale }} />
          <motion.span className="mo-finale-ring" style={{ opacity: ringOpacity, scale: ringScale }} />
          <motion.span className="mo-finale-dot" style={{ opacity: dotOpacity, scale: dotScale }} />
        </div>
      </div>
    </footer>
  );
};
