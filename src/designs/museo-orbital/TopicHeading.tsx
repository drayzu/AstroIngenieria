import { motion, useReducedMotion } from 'framer-motion';

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/* Encabezado de grupo del muro: la línea superior se traza desde el color
   del capítulo y el título sube a su lugar */
export const TopicHeading = ({ title }: { title: string }) => {
  const reduced = useReducedMotion();
  return (
    <motion.h3
      initial={reduced ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.8, ease: EASE_OUT }}
    >
      <motion.span
        className="mo-topic-rule"
        aria-hidden="true"
        initial={reduced ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 1.4, ease: EASE_OUT }}
      />
      {title}
    </motion.h3>
  );
};
