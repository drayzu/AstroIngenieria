import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import type { AstroChapter, AstroConcept } from '../types';

interface MissionChapterProps {
  chapter: AstroChapter;
  index: number;
  onOpenConcept: (concept: AstroConcept) => void;
}

export function MissionChapter({ chapter, index, onOpenConcept }: MissionChapterProps) {
  const visual = chapter.visual;
  const leadConcept = chapter.concepts[0];
  const panelRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: panelRef,
    offset: ['start end', 'end start'],
  });
  const dimOpacity = useTransform(scrollYProgress, [0, 0.48, 0.52, 1], [0.34, 0, 0, 0.34]);
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.07, 1.02, 1.07]);
  const imageY = useTransform(scrollYProgress, [0, 1], ['-1.2%', '1.2%']);

  return (
    <motion.article
      ref={panelRef}
      className="mission-panel"
      initial={{ y: 36 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.28 }}
      transition={{ duration: 0.65, ease: 'easeOut' }}
    >
      <motion.img
        className="mission-media"
        src={visual?.heroImage}
        alt={visual?.visualFocus}
        loading={index < 2 ? 'eager' : 'lazy'}
        style={{
          scale: shouldReduceMotion ? 1.02 : imageScale,
          y: shouldReduceMotion ? 0 : imageY,
        }}
      />
      <motion.div
        className="mission-focus-dim"
        style={{ opacity: shouldReduceMotion ? 0.08 : dimOpacity }}
      />
      <div className="mission-scrim" />
      <div className="mission-copy">
        <span className="sx-kicker">{visual?.missionLabel}</span>
        <h2>{chapter.title}</h2>
        <p>{chapter.summary}</p>
        <div className="mission-actions">
          {leadConcept && (
            <button type="button" className="sx-button primary" onClick={() => onOpenConcept(leadConcept)}>
              <span>{visual?.cta ?? 'Explorar'}</span>
              <ArrowUpRight aria-hidden="true" />
            </button>
          )}
          <a className="sx-button" href="#gallery">
            <span>Ver conceptos</span>
          </a>
        </div>
      </div>
    </motion.article>
  );
}
