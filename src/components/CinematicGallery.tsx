import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { getChapterVisual, plausibilityLabels, scaleLabels } from '../data/astroData';
import type { AstroConcept } from '../types';

interface CinematicGalleryProps {
  concepts: AstroConcept[];
  onOpenConcept: (concept: AstroConcept) => void;
}

export function CinematicGallery({ concepts, onOpenConcept }: CinematicGalleryProps) {
  return (
    <div className="cinematic-grid">
      {concepts.map((concept, index) => {
        const visual = getChapterVisual(concept.chapterId);
        return (
          <motion.article
            className="cinematic-card"
            key={concept.id}
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: Math.min(index % 6, 4) * 0.035 }}
          >
            <button type="button" onClick={() => onOpenConcept(concept)}>
              <img src={visual.heroImage} alt={visual.visualFocus} loading="lazy" />
              <span className="card-scrim" />
              <span className="card-open">
                <Eye aria-hidden="true" />
                Open
              </span>
            </button>
            <div className="cinematic-caption">
              <span>
                {scaleLabels[concept.scale]} / {plausibilityLabels[concept.plausibility]}
              </span>
              <h3>{concept.title}</h3>
              <p>{concept.summary}</p>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}
