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

const STAR_IMAGE = `${import.meta.env.BASE_URL}illustrations/hero-rotation/hero-00-estrella-roja.webp`;
const QUOTE = 'La naturaleza necesitó miles de millones de años para engendrar una mente capaz de comprenderla. Bastó una fracción de ese tiempo para que aquella mente aprendiera a crear otras. Y así, de un universo que nunca supo hacia dónde iba, nació algo capaz de elegir hacia dónde irá.';
const SIGNATURE = 'ASTROINGENIERÍA — EXPOSICIÓN PERMANENTE · MUSEO ORBITAL · MMXXVI';

/* Guion del cierre sobre el tramo fijo: la estrella de la portada colapsa
   hasta el punto de luz con que empezó la visita y deja la cita final. */
const T = {
  starIn: [0, 0.1],
  collapse: [0.1, 0.42],
  burst: [0.4, 0.6],
  dotIn: [0.37, 0.44],
  dotRise: [0.5, 0.64],
  quote: [0.56, 0.84],
  signature: [0.86, 0.95],
} satisfies Record<string, [number, number]>;

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
  onRestart,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  onRestart: () => void;
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

  // Estrella: aparece como disco luminoso y colapsa acelerando
  const starOpacity = useTransform(
    progress,
    [T.starIn[0], T.starIn[1], T.collapse[1] - 0.02, T.collapse[1] + 0.02],
    [0, 1, 1, 0],
  );
  const starScale = useTransform(progress, T.collapse, [1, 0.012], { ease: EASE_COLLAPSE });
  const haloOpacity = useTransform(
    progress,
    [T.starIn[0], T.starIn[1], T.collapse[1] - 0.06, T.collapse[1] + 0.02],
    [0, 0.55, 0.95, 0],
  );

  // Destello y onda al quedar solo el punto
  const flareScale = useTransform(progress, [T.burst[0], T.burst[0] + 0.05, T.burst[1]], [0, 1, 1.5]);
  const flareOpacity = useTransform(progress, [T.burst[0], T.burst[0] + 0.04, T.burst[1]], [0, 1, 0]);
  const ringScale = useTransform(progress, T.burst, [0.1, 2.8], { ease: EASE_OUT });
  const ringOpacity = useTransform(progress, T.burst, [0.9, 0]);

  // El mismo punto de luz de la intro, que sube para dejar sitio a la cita
  const dotOpacity = useTransform(progress, T.dotIn, [0, 1]);
  const dotScale = useTransform(progress, [T.dotIn[0], T.dotIn[1], T.dotIn[1] + 0.06], [0, 2.4, 1]);
  const sparkY = useTransform(progress, T.dotRise, ['0vh', '-17vh'], { ease: EASE_OUT });

  const signatureOpacity = useTransform(progress, T.signature, [0, 1]);
  const signatureY = useTransform(progress, T.signature, [14, 0], { ease: EASE_OUT });
  // Invisible no es clicable: el botón solo responde cuando ya se ve
  const signaturePointer = useTransform(signatureOpacity, (value) => (value > 0.5 ? 'auto' : 'none'));

  // El colapso sacude el cielo, en ambos sentidos del scroll
  const collapsed = useRef(false);
  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const now = value >= T.collapse[1];
    if (now === collapsed.current) return;
    collapsed.current = now;
    window.dispatchEvent(
      new CustomEvent('mo-warp', { detail: { strength: 18, direction: now ? -1 : 1 } }),
    );
  });

  const sentences = t(QUOTE).split(/(?<=[.!?])\s+/);
  const span = (T.quote[1] - T.quote[0]) / sentences.length;

  const restart = (
    <button type="button" className="mo-finale-restart" onClick={onRestart} data-cursor-label={t('Volver al comienzo')}>
      <i aria-hidden="true" />
      {t('Volver al comienzo')}
    </button>
  );

  if (reduced) {
    return (
      <footer ref={finaleRef} className="mo-finale mo-layer is-static">
        <blockquote className="mo-finale-quote">
          {sentences.map((sentence) => <span key={sentence}>{sentence}</span>)}
        </blockquote>
        <p className="mo-finale-line">{t(SIGNATURE)}</p>
        {restart}
      </footer>
    );
  }

  return (
    <footer ref={finaleRef} className="mo-finale mo-layer">
      <div className="mo-finale-stage">
        <div className="mo-finale-anchor" aria-hidden="true">
          <motion.span className="mo-finale-halo" style={{ opacity: haloOpacity, scale: starScale }} />
          <motion.span
            className="mo-finale-star"
            style={{ opacity: starOpacity, scale: starScale, backgroundImage: `url(${STAR_IMAGE})` }}
          />
          <motion.div className="mo-finale-spark" style={{ y: sparkY }}>
            <motion.span className="mo-finale-flare" style={{ opacity: flareOpacity, scaleX: flareScale }} />
            <motion.span className="mo-finale-ring" style={{ opacity: ringOpacity, scale: ringScale }} />
            <motion.span className="mo-finale-dot" style={{ opacity: dotOpacity, scale: dotScale }} />
          </motion.div>
        </div>

        <div className="mo-finale-copy">
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
          <motion.div className="mo-finale-signature" style={{ opacity: signatureOpacity, y: signatureY, pointerEvents: signaturePointer }}>
            <p className="mo-finale-line">{t(SIGNATURE)}</p>
            {restart}
          </motion.div>
        </div>
      </div>
    </footer>
  );
};
