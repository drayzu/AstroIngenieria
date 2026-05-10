import { useRef, type CSSProperties } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import type { AstroChapter } from '../types';
import { useHomeCursor } from './HomeInteractionLayer';

interface MissionScrollShowcaseProps {
  chapters: AstroChapter[];
  onExploreChapter: (chapter: AstroChapter) => void;
}

interface MissionShowcaseItemProps {
  chapter: AstroChapter;
  index: number;
  onExploreChapter: (chapter: AstroChapter) => void;
}

interface MissionIntroLineProps {
  accentColor: string;
  progress: MotionValue<number>;
  shouldReduceMotion: boolean | null;
  totalChars: number;
  line: Array<{
    char: string;
    order: number;
  }>;
}

interface MissionIntroGlyphProps {
  accentColor: string;
  char: string;
  order: number;
  progress: MotionValue<number>;
  shouldReduceMotion: boolean | null;
  totalChars: number;
}

const missionIntroLines = ['Nueve misiones', 'para doblar', 'la escala humana'];
const missionIntroText = missionIntroLines.join(' ');
const missionIntroReadingLines = (() => {
  let order = 0;
  return missionIntroLines.map((line) =>
    Array.from(line).map((char) => {
      if (char === ' ') {
        return { char, order: -1 };
      }

      const glyph = { char, order };
      order += 1;
      return glyph;
    }),
  );
})();
const missionIntroCharCount = missionIntroReadingLines.flat().filter((glyph) => glyph.order >= 0).length;

export function MissionScrollShowcase({ chapters, onExploreChapter }: MissionScrollShowcaseProps) {
  const showcaseRef = useRef<HTMLElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: showcaseRef,
    offset: ['start 65%', 'end 35%'],
  });
  const { scrollYProgress: introScrollProgress } = useScroll({
    target: introRef,
    offset: ['start 82%', 'end 18%'],
  });
  const introY = useTransform(introScrollProgress, [0, 0.42, 1], shouldReduceMotion ? [0, 0, 0] : [18, 0, -42]);
  const introScale = useTransform(introScrollProgress, [0, 0.52, 1], shouldReduceMotion ? [1, 1, 1] : [0.98, 1, 1.02]);
  const introOpacity = useTransform(introScrollProgress, [0, 0.16, 0.92, 1], [0.72, 1, 1, 0.72]);
  const introAuraOpacity = useTransform(introScrollProgress, [0, 0.46, 1], [0, 0.42, 0.14]);

  return (
    <section
      ref={showcaseRef}
      id="missions"
      className="mission-showcase"
      aria-labelledby="missions-title"
    >
      <div ref={introRef} className="mission-showcase-intro">
        <motion.div className="mission-showcase-intro-aura" style={{ opacity: introAuraOpacity }} aria-hidden="true" />
        <span className="sx-kicker">Flight plan</span>
        <motion.h2
          id="missions-title"
          aria-label={missionIntroText}
          style={{ opacity: introOpacity, scale: introScale, y: introY }}
        >
          {missionIntroReadingLines.map((line, index) => (
            <MissionIntroLine
              key={missionIntroLines[index]}
              line={line}
              progress={introScrollProgress}
              shouldReduceMotion={shouldReduceMotion}
              totalChars={missionIntroCharCount}
              accentColor="#fff"
            />
          ))}
        </motion.h2>
      </div>

      <div className="mission-showcase-rail" aria-hidden="true">
        <motion.span style={{ scaleY: shouldReduceMotion ? 1 : scrollYProgress }} />
      </div>

      <div className="mission-showcase-list">
        {chapters.map((chapter, index) => (
          <MissionShowcaseItem
            key={chapter.id}
            chapter={chapter}
            index={index}
            onExploreChapter={onExploreChapter}
          />
        ))}
      </div>
    </section>
  );
}

function MissionIntroLine({ accentColor, line, progress, shouldReduceMotion, totalChars }: MissionIntroLineProps) {
  return (
    <span className="mission-showcase-title-line" aria-hidden="true">
      {line.map(({ char, order }, index) => (
        <MissionIntroGlyph
          key={`${char}-${index}-${order}`}
          accentColor={accentColor}
          char={char}
          order={order}
          progress={progress}
          shouldReduceMotion={shouldReduceMotion}
          totalChars={totalChars}
        />
      ))}
    </span>
  );
}

function MissionIntroGlyph({ accentColor, char, order, progress, shouldReduceMotion, totalChars }: MissionIntroGlyphProps) {
  const readableRange = Math.max(totalChars - 1, 1);
  const start = 0.04 + (order / readableRange) * 0.48;
  const end = Math.min(start + 0.08, 0.64);
  const color = useTransform(progress, [start, end], ['rgba(255, 255, 255, 0.2)', accentColor]);
  const opacity = useTransform(progress, [0, start, end], [0.46, 0.46, 1]);
  const y = useTransform(progress, [start, end], shouldReduceMotion ? [0, 0] : [10, 0]);

  if (char === ' ') {
    return <span className="mission-showcase-title-space"> </span>;
  }

  return (
    <motion.span
      className="mission-showcase-title-glyph"
      style={{
        color: shouldReduceMotion ? '#fff' : color,
        opacity: shouldReduceMotion ? 1 : opacity,
        textShadow: 'none',
        y,
      }}
    >
      {char}
    </motion.span>
  );
}

function MissionShowcaseItem({ chapter, index, onExploreChapter }: MissionShowcaseItemProps) {
  const itemRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { clearCursor, setCursor } = useHomeCursor();
  const { scrollYProgress } = useScroll({
    target: itemRef,
    offset: ['start end', 'end start'],
  });
  const visual = chapter.visual;
  const mediaScale = useTransform(scrollYProgress, [0, 0.5, 1], shouldReduceMotion ? [1, 1, 1] : [1.18, 1, 1.16]);
  const mediaY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [-36, 36]);
  const copyY = useTransform(scrollYProgress, [0, 0.5, 1], shouldReduceMotion ? [0, 0, 0] : [58, 0, -48]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.24, 0.78, 1], [0.18, 1, 1, 0.12]);
  const nodeActiveOpacity = useTransform(scrollYProgress, [0, 0.34, 0.5, 0.68, 1], [0.18, 0.18, 1, 0.34, 0.18]);
  const ringProgress = useTransform(scrollYProgress, [0.32, 0.62], [0, 1]);
  const mediaClip = useTransform(
    scrollYProgress,
    [0, 0.22, 0.76, 1],
    shouldReduceMotion
      ? ['inset(0% 0% 0% 0%)', 'inset(0% 0% 0% 0%)', 'inset(0% 0% 0% 0%)', 'inset(0% 0% 0% 0%)']
      : ['inset(14% 10% 18% 10%)', 'inset(0% 0% 0% 0%)', 'inset(0% 0% 0% 0%)', 'inset(14% 8% 18% 8%)'],
  );
  const missionStyle = {
    '--mission-color': chapter.color,
    '--mission-accent': chapter.accent,
  } as CSSProperties;
  const titleWords = chapter.title.split(' ');

  return (
    <motion.article
      ref={itemRef}
      id={`mission-${chapter.id}`}
      className={index % 2 === 1 ? 'mission-showcase-item is-reversed' : 'mission-showcase-item'}
      style={missionStyle}
      aria-labelledby={`mission-title-${chapter.id}`}
    >
      <div className="mission-showcase-sticky">
        <motion.div className="mission-showcase-media" style={{ clipPath: mediaClip }}>
          <motion.img
            src={visual?.heroImage}
            alt={visual?.visualFocus}
            loading={index < 2 ? 'eager' : 'lazy'}
            style={{ scale: mediaScale, y: mediaY }}
          />
        </motion.div>
        <div className="mission-showcase-scrim" />
      </div>

      <motion.div className="mission-showcase-copy" style={{ opacity: copyOpacity, y: copyY }}>
        <span className="mission-showcase-label">{visual?.missionLabel}</span>
        <h3 id={`mission-title-${chapter.id}`}>
          {titleWords.map((word, wordIndex) => (
            <motion.span
              key={`${chapter.id}-${word}`}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 44 }}
              whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ amount: 0.74, once: true }}
              transition={{ delay: wordIndex * 0.055, duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
            >
              {word}
            </motion.span>
          ))}
        </h3>
        <p>{chapter.summary}</p>
        <button
          type="button"
          className="sx-button primary mission-cta"
          data-cursor-label={visual?.cta ?? 'Explorar mision'}
          data-cursor-tone={chapter.color}
          onClick={() => onExploreChapter(chapter)}
          onPointerEnter={() => setCursor(visual?.cta ?? 'Explorar mision', chapter.color)}
          onPointerLeave={clearCursor}
        >
          <span>{visual?.cta ?? 'Explorar mision'}</span>
          <ArrowUpRight aria-hidden="true" />
        </button>
      </motion.div>

      <div className="mission-showcase-node is-node-ring" aria-hidden="true">
        <span className="mission-node-core" />
        <svg className="mission-node-ring" viewBox="0 0 64 64" focusable="false">
          <circle className="mission-node-ring-track" cx="32" cy="32" r="24" />
          <motion.circle
            className="mission-node-ring-progress"
            cx="32"
            cy="32"
            r="24"
            style={{ opacity: shouldReduceMotion ? 1 : nodeActiveOpacity, pathLength: shouldReduceMotion ? 1 : ringProgress }}
          />
        </svg>
        <strong>{chapter.number}</strong>
      </div>

      <motion.aside
        className="mission-showcase-caption"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 26 }}
        whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ amount: 0.55, once: false }}
        transition={{ duration: 0.58, ease: 'easeOut' }}
      >
        {visual?.visualFocus}
      </motion.aside>
    </motion.article>
  );
}
