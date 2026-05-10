import { useRef, type CSSProperties } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import type { AstroChapter } from '../types';

interface MissionTimelineProps {
  chapters: AstroChapter[];
  onExploreChapter: (chapter: AstroChapter) => void;
}

interface MissionTimelineItemProps {
  chapter: AstroChapter;
  index: number;
  onExploreChapter: (chapter: AstroChapter) => void;
}

export function MissionTimeline({ chapters, onExploreChapter }: MissionTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ['start 62%', 'end 38%'],
  });

  return (
    <div ref={timelineRef} className="mission-timeline" aria-label="Recorrido de misiones">
      <div className="mission-timeline-rail" aria-hidden="true">
        <motion.span
          className="mission-timeline-progress"
          style={{ scaleY: shouldReduceMotion ? 1 : scrollYProgress }}
        />
      </div>
      <div className="mission-timeline-list">
        {chapters.map((chapter, index) => (
          <MissionTimelineItem
            key={chapter.id}
            chapter={chapter}
            index={index}
            onExploreChapter={onExploreChapter}
          />
        ))}
      </div>
    </div>
  );
}

function MissionTimelineItem({ chapter, index, onExploreChapter }: MissionTimelineItemProps) {
  const itemRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: itemRef,
    offset: ['start 78%', 'end 28%'],
  });
  const itemOpacity = useTransform(scrollYProgress, [0, 0.18, 0.78, 1], [0.42, 1, 1, 0.48]);
  const mediaY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [32, -32]);
  const nodeScale = useTransform(scrollYProgress, [0, 0.34, 0.7, 1], [0.82, 1.18, 1.18, 0.82]);
  const visual = chapter.visual;
  const missionStyle = {
    '--mission-color': chapter.color,
    '--mission-accent': chapter.accent,
  } as CSSProperties;

  return (
    <motion.article
      ref={itemRef}
      id={`mission-${chapter.id}`}
      className={index % 2 === 1 ? 'mission-timeline-item is-reversed' : 'mission-timeline-item'}
      style={{ opacity: shouldReduceMotion ? 1 : itemOpacity, ...missionStyle }}
      aria-labelledby={`mission-title-${chapter.id}`}
    >
      <div className="mission-timeline-copy">
        <span className="mission-timeline-label">{visual?.missionLabel}</span>
        <h3 id={`mission-title-${chapter.id}`}>{chapter.title}</h3>
        <p>{chapter.summary}</p>
        <button type="button" className="sx-button primary" onClick={() => onExploreChapter(chapter)}>
          <span>{visual?.cta ?? 'Explorar mision'}</span>
          <ArrowUpRight aria-hidden="true" />
        </button>
      </div>

      <div className="mission-timeline-node" aria-hidden="true">
        <motion.span style={{ scale: shouldReduceMotion ? 1 : nodeScale }} />
        <strong>{chapter.number.padStart(2, '0')}</strong>
      </div>

      <figure className="mission-timeline-visual">
        <div>
          <motion.img
            src={visual?.heroImage}
            alt={visual?.visualFocus}
            loading={index < 2 ? 'eager' : 'lazy'}
            style={{ y: mediaY }}
          />
        </div>
        <figcaption>{visual?.visualFocus}</figcaption>
      </figure>
    </motion.article>
  );
}
