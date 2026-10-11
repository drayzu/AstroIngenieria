import { useEffect, useRef, type RefObject } from 'react';
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

/* Guion del cierre sobre el tramo fijo, contraparte de la intro: allí todo
   cae hacia el punto y estalla en una estrella; aquí la estrella vuelve a
   encenderse, se enfría y se contrae hasta el punto mientras suelta sus
   capas hacia afuera, y el disco se desenrolla al revés. Sin estallido:
   la visita termina en el punto, que es donde empieza. */
const T = {
  quote: [0.03, 0.34],
  signature: [0.34, 0.41],
  copyOut: [0.5, 0.58],
  dotIn: [0.52, 0.58],
  starIn: [0.57, 0.66],
  collapse: [0.68, 0.88],
  unwind: [0.66, 0.88],
  close: [0.8, 0.93],
} satisfies Record<string, [number, number]>;
// Capas que la estrella suelta mientras se contrae, escalonadas
const SHELLS = [
  { range: [0.69, 0.85], to: 2.3, tone: 'is-warm' },
  { range: [0.73, 0.89], to: 3.1, tone: 'is-cool' },
  { range: [0.77, 0.93], to: 4, tone: 'is-warm' },
] as const;
// Pasado este punto bajando, se vuelve al inicio
const HOME_AT = 0.95;
// Reposo del cierre: cita y firma completas, antes de que se vayan. La tecla
// Fin aterriza aquí para que el bucle solo lo dispare quien sigue bajando.
export const FINALE_REST = (T.signature[1] + T.copyOut[0]) / 2;

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

/* Una capa de gas que se separa del borde de la estrella y se aleja */
const Shell = ({
  progress,
  range,
  to,
  tone,
}: {
  progress: MotionValue<number>;
  range: readonly [number, number];
  to: number;
  tone: string;
}) => {
  const [from, until] = range;
  const scale = useTransform(progress, [from, until], [0.9, to], { ease: EASE_OUT });
  const opacity = useTransform(progress, [from, from + 0.025, until], [0, 0.8, 0]);
  return <motion.span className={`mo-finale-shell ${tone}`} style={{ scale, opacity }} />;
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

  // El punto aparece, se esconde en la estrella y queda como su remanente
  const dotOpacity = useTransform(progress, T.dotIn, [0, 1]);
  const dotScale = useTransform(
    progress,
    [T.dotIn[0], T.dotIn[1], T.collapse[1] - 0.04, T.collapse[1], T.close[1]],
    [0, 1, 1, 1.9, 1],
  );

  // La estrella fantasma se abre desde el punto, como en la intro, pero sin
  // estallido; luego se contrae acelerando, se enfoca y se enfría: pierde el
  // rojo y queda blanca
  const starScale = useTransform(
    progress,
    [T.starIn[0], T.starIn[1], T.collapse[0], T.collapse[1]],
    [0.02, 1, 1, 0.02],
    { ease: [EASE_OUT, (v) => v, EASE_COLLAPSE] },
  );
  const starOpacity = useTransform(
    progress,
    [T.starIn[0], T.starIn[0] + 0.03, T.collapse[1] - 0.03, T.collapse[1]],
    [0, 1, 1, 0],
  );
  const starFilter = useTransform(
    progress,
    T.collapse,
    ['blur(6px) saturate(1) brightness(1)', 'blur(0px) saturate(0.1) brightness(2.4)'],
  );

  // El disco de acreción al revés: nace pegado a la estrella y se desenrolla
  // hacia afuera girando en sentido contrario
  const swirlScale = useTransform(progress, T.unwind, [0.95, 2.6], { ease: EASE_OUT });
  const swirlRotate = useTransform(progress, T.unwind, [0, -540]);
  const swirlOpacity = useTransform(
    progress,
    [T.unwind[0], T.unwind[0] + 0.04, T.unwind[1] - 0.06, T.unwind[1]],
    [0, 0.85, 0.5, 0],
  );

  // El destello no se dispara: se tiende y se recoge en el punto, un ojo que se cierra
  const flareScale = useTransform(progress, [T.close[0], T.close[0] + 0.05, T.close[1]], [0, 0.9, 0], {
    ease: [EASE_OUT, EASE_COLLAPSE],
  });
  const flareOpacity = useTransform(progress, [T.close[0], T.close[0] + 0.04, T.close[1]], [0, 0.85, 0.2]);

  // El cielo se estira hacia atrás mientras la estrella se contrae, y la
  // visita vuelve al inicio al terminar
  const last = useRef(0);
  const returning = useRef(false);
  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const delta = value - last.current;
    last.current = value;
    if (value > T.collapse[0] && value < T.close[1] && delta > 0.001) {
      window.dispatchEvent(
        new CustomEvent('mo-warp', { detail: { strength: Math.min(10, delta * 260), direction: -1 } }),
      );
    }
    if (value < T.copyOut[0]) returning.current = false;
  });
  // La vuelta se decide con lo que se ve (el resorte), no con el scroll: así
  // el salto llega cuando en pantalla ya solo queda el punto de luz. Desde
  // que aparece la estrella se apagan barra y riel, que la intro no tiene:
  // el último cuadro del cierre es igual al primero de la intro.
  const chromeOff = useRef(false);
  useMotionValueEvent(progress, 'change', (value) => {
    const off = value >= T.starIn[0];
    if (off !== chromeOff.current) {
      chromeOff.current = off;
      scrollRef.current?.toggleAttribute('data-finale-end', off);
    }
    if (value >= HOME_AT && !returning.current) {
      returning.current = true;
      onReturn();
    }
  });

  useEffect(() => {
    const root = scrollRef.current;
    return () => root?.removeAttribute('data-finale-end');
  }, [scrollRef]);

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

        <div className="mo-finale-anchor" aria-hidden="true">
          {SHELLS.map((shell) => (
            <Shell key={shell.range[0]} progress={progress} range={shell.range} to={shell.to} tone={shell.tone} />
          ))}
          <motion.span
            className="mo-finale-swirl"
            style={{ opacity: swirlOpacity, scale: swirlScale, rotate: swirlRotate }}
          />
          <motion.span
            className="mo-finale-star"
            style={{ opacity: starOpacity, scale: starScale, filter: starFilter }}
          />
          <motion.span className="mo-finale-flare" style={{ opacity: flareOpacity, scaleX: flareScale }} />
          <motion.span className="mo-finale-dot" style={{ opacity: dotOpacity, scale: dotScale }} />
        </div>
      </div>
    </footer>
  );
};
