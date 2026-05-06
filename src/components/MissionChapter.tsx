import { motion } from 'framer-motion';
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

  return (
    <motion.article
      className="mission-panel"
      initial={{ opacity: 0, y: 44 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.28 }}
      transition={{ duration: 0.65, ease: 'easeOut' }}
    >
      <img className="mission-media" src={visual?.heroImage} alt={visual?.visualFocus} loading={index < 2 ? 'eager' : 'lazy'} />
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
