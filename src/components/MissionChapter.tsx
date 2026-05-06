import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import type { AstroChapter } from '../types';

interface MissionChapterProps {
  chapter: AstroChapter;
  index: number;
  onExploreChapter: (chapterId: string) => void;
}

export function MissionChapter({ chapter, index, onExploreChapter }: MissionChapterProps) {
  const visual = chapter.visual;
  const panelRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: panelRef,
    offset: ['start end', 'end start'],
  });
  const dimOpacity = useTransform(scrollYProgress, [0, 0.48, 0.52, 1], [0.34, 0, 0, 0.34]);

  return (
    <article ref={panelRef} id={`mission-${chapter.id}`} className="mission-panel">
      <img
        className="mission-media"
        src={visual?.heroImage}
        alt={visual?.visualFocus}
        loading={index < 2 ? 'eager' : 'lazy'}
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
          <button type="button" className="sx-button primary" onClick={() => onExploreChapter(chapter.id)}>
            <span>{visual?.cta ?? 'Explorar'}</span>
            <ArrowUpRight aria-hidden="true" />
          </button>
          <button type="button" className="sx-button" onClick={() => onExploreChapter(chapter.id)}>
            <span>Ver conceptos</span>
          </button>
        </div>
      </div>
    </article>
  );
}
