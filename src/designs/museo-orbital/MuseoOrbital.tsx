import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { chapters, conceptById, plausibilityLabels, scaleLabels } from '../../data/astroData';
import type { AstroChapter, AstroConcept } from '../../types';
import { getConceptImageVariants } from '../shared/conceptImages';
import { Grain } from '../shared/Grain';
import { useScrollLock } from '../shared/useScrollLock';
import './museoOrbital.css';

const totalWorks = chapters.reduce((sum, chapter) => sum + chapter.concepts.length, 0);
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

interface FichaState {
  concept: AstroConcept;
  chapter: AstroChapter;
}

const resolveChapter = (concept: AstroConcept): AstroChapter =>
  chapters.find((chapter) => chapter.id === concept.chapterId) ?? chapters[0];

const MetricPlaque = ({ label, value }: { label: string; value: number }) => (
  <div className="mo-plaque">
    <span className="mo-plaque-label">{label}</span>
    <span className="mo-plaque-cells" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((cell) => (
        <i key={cell} className={cell <= value ? 'is-on' : ''} />
      ))}
    </span>
  </div>
);

const Hero = () => {
  const reduced = useReducedMotion();
  const letters = useMemo(() => 'ASTROINGENIERÍA'.split(''), []);

  return (
    <section className="mo-hero">
      <motion.div
        className="mo-hero-bg"
        style={{ backgroundImage: `url(${chapters[1].visual?.heroImage})` }}
        initial={{ scale: 1.18, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: reduced ? 0 : 2.4, ease: EASE_OUT }}
      />
      <div className="mo-hero-scrim" />

      <div className="mo-hero-copy">
        <motion.p
          className="mo-kicker"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 0.5, duration: 0.9, ease: EASE_OUT }}
        >
          Exposición permanente — Atlas de astroingeniería
        </motion.p>

        <h1 className="mo-hero-title" aria-label="Astroingeniería">
          {letters.map((letter, index) => (
            <span className="mo-hero-letterbox" key={`${letter}-${index}`} aria-hidden="true">
              <motion.span
                className="mo-hero-letter"
                initial={{ y: '115%' }}
                animate={{ y: '0%' }}
                transition={{
                  delay: reduced ? 0 : 0.55 + index * 0.035,
                  duration: 1,
                  ease: EASE_OUT,
                }}
              >
                {letter}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.div
          className="mo-hero-rule"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: reduced ? 0 : 1.3, duration: 1.5, ease: EASE_OUT }}
        />

        <motion.p
          className="mo-hero-sub"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 1.5, duration: 1, ease: EASE_OUT }}
        >
          Nueve salas. {totalWorks} obras. Un recorrido desde la primera estación orbital hasta
          civilizaciones capaces de mover estrellas.
        </motion.p>

        <motion.button
          type="button"
          className="mo-hero-cta"
          onClick={() =>
            document.getElementById('sala-intro')?.scrollIntoView({ behavior: 'smooth' })
          }
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduced ? 0 : 2, duration: 1 }}
        >
          Descender a la Sala 00
          <span aria-hidden="true">↓</span>
        </motion.button>
      </div>
    </section>
  );
};

const Marquee = () => {
  const phrase = `COLECCIÓN PERMANENTE · ${chapters.length} SALAS · ${totalWorks} OBRAS · ENTRADA LIBRE · `;
  return (
    <div className="mo-marquee" aria-hidden="true">
      <div className="mo-marquee-track">
        <span>{phrase.repeat(3)}</span>
        <span>{phrase.repeat(3)}</span>
      </div>
    </div>
  );
};

const HallIndex = ({ activeId }: { activeId: string | null }) => (
  <nav className="mo-halls" aria-label="Salas de la exposición">
    {chapters.map((chapter) => (
      <button
        key={chapter.id}
        type="button"
        className={`mo-hall-chip${activeId === chapter.id ? ' is-active' : ''}`}
        style={{ '--accent': chapter.color } as CSSProperties}
        onClick={() =>
          document
            .getElementById(`sala-${chapter.id}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      >
        <b>{chapter.number}</b>
        {chapter.title}
      </button>
    ))}
  </nav>
);

const Obra = ({
  concept,
  plate,
  featured,
  onSelect,
}: {
  concept: AstroConcept;
  plate: number;
  featured: boolean;
  onSelect: (concept: AstroConcept) => void;
}) => (
  <motion.article
    className={`mo-obra${featured ? ' is-featured' : ''}`}
    initial={{ opacity: 0, y: 46 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.9, ease: EASE_OUT }}
  >
    <button type="button" className="mo-obra-hit" onClick={() => onSelect(concept)}>
      <figure className="mo-frame">
        <img src={concept.illustration.src} alt={concept.illustration.alt} loading="lazy" />
        <span className="mo-frame-glow" aria-hidden="true" />
      </figure>
      <div className="mo-obra-meta">
        <span className="mo-plate">N.º {String(plate).padStart(2, '0')}</span>
        <h3>{concept.title}</h3>
        <p>
          {concept.category} · {scaleLabels[concept.scale]} ·{' '}
          {plausibilityLabels[concept.plausibility]}
        </p>
        <span className="mo-obra-cta">Ver ficha →</span>
      </div>
    </button>
  </motion.article>
);

const Sala = ({
  chapter,
  offset,
  onSelect,
}: {
  chapter: AstroChapter;
  offset: number;
  onSelect: (concept: AstroConcept) => void;
}) => {
  const headRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: headRef,
    offset: ['start end', 'end start'],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ['-8%', '8%']);

  return (
    <section
      id={`sala-${chapter.id}`}
      className="mo-sala"
      style={{ '--accent': chapter.color } as CSSProperties}
    >
      <header className="mo-sala-head" ref={headRef}>
        <span className="mo-sala-no" aria-hidden="true">
          {chapter.number}
        </span>
        <div className="mo-sala-copy">
          <p className="mo-kicker">
            Sala {chapter.number} — {chapter.concepts.length} piezas
          </p>
          <h2>{chapter.title}</h2>
          <p className="mo-lede">{chapter.summary}</p>
          {chapter.sections.map((section) => (
            <details key={section.title} className="mo-sala-note">
              <summary>{section.title}</summary>
              <p>{section.body}</p>
            </details>
          ))}
        </div>
        <motion.figure className="mo-sala-figure">
          <motion.img
            src={chapter.visual?.heroImage}
            alt={chapter.visual?.visualFocus ?? chapter.title}
            loading="lazy"
            style={{ y: imageY }}
          />
          <figcaption>{chapter.visual?.visualFocus}</figcaption>
        </motion.figure>
      </header>

      <div className="mo-wall">
        {chapter.concepts.map((concept, index) => (
          <Obra
            key={concept.id}
            concept={concept}
            plate={offset + index + 1}
            featured={index % 5 === 0}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
};

const Ficha = ({
  state,
  onClose,
  onSelect,
}: {
  state: FichaState;
  onClose: () => void;
  onSelect: (concept: AstroConcept) => void;
}) => {
  const { concept, chapter } = state;
  const variants = useMemo(() => getConceptImageVariants(concept), [concept]);
  const [variantIndex, setVariantIndex] = useState(0);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(
    () => new Set(concept.layers.map((layer) => layer.id)),
  );

  useEffect(() => {
    setVariantIndex(0);
    setVisibleLayers(new Set(concept.layers.map((layer) => layer.id)));
  }, [concept]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        const siblings = chapter.concepts;
        const index = siblings.findIndex((item) => item.id === concept.id);
        const next =
          event.key === 'ArrowRight'
            ? siblings[(index + 1) % siblings.length]
            : siblings[(index - 1 + siblings.length) % siblings.length];
        if (next) {
          onSelect(next);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [concept, chapter, onClose, onSelect]);

  const variant = variants[Math.min(variantIndex, variants.length - 1)];
  const hotspots = concept.hotspots.filter((hotspot) => visibleLayers.has(hotspot.layer));
  const related = concept.related
    .map((id) => conceptById.get(id))
    .filter((item): item is AstroConcept => Boolean(item));

  const toggleLayer = (layerId: string) => {
    setVisibleLayers((current) => {
      const next = new Set(current);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  };

  return (
    <motion.div
      className="mo-ficha"
      role="dialog"
      aria-modal="true"
      aria-label={`Ficha de obra: ${concept.title}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div
        className="mo-ficha-panel"
        initial={{ y: 60, scale: 0.985 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.55, ease: EASE_OUT }}
        style={{ '--accent': chapter.color } as CSSProperties}
      >
        <button type="button" className="mo-ficha-close" onClick={onClose} aria-label="Cerrar ficha">
          ✕
        </button>

        <div className="mo-ficha-view">
          <AnimatePresence mode="wait">
            <motion.img
              key={variant.src}
              src={variant.src}
              alt={concept.illustration.alt}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
            />
          </AnimatePresence>

          {hotspots.map((hotspot) => (
            <button
              key={hotspot.id}
              type="button"
              className="mo-hotspot"
              style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
            >
              <i />
              <span>
                <b>{hotspot.title}</b>
                {hotspot.description}
              </span>
            </button>
          ))}

          <figcaption className="mo-ficha-caption">{variant.caption}</figcaption>
        </div>

        <div className="mo-ficha-dossier">
          <p className="mo-kicker">
            Ficha de obra — Sala {chapter.number}, {chapter.title}
          </p>
          <h2>{concept.title}</h2>
          <p className="mo-ficha-lead">{concept.summary}</p>

          <div className="mo-ficha-block">
            <h4>Mecanismo</h4>
            <p>{concept.mechanism}</p>
          </div>

          <div className="mo-ficha-metrics">
            <MetricPlaque label="Energía" value={concept.metrics.energia} />
            <MetricPlaque label="Materiales" value={concept.metrics.materiales} />
            <MetricPlaque label="Madurez" value={concept.metrics.madurez} />
            <MetricPlaque label="Maravilla" value={concept.metrics.maravilla} />
          </div>

          {variants.length > 1 && (
            <div className="mo-ficha-variants">
              <h4>Capas visuales</h4>
              <div className="mo-variant-row">
                {variants.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={index === variantIndex ? 'is-active' : ''}
                    onClick={() => setVariantIndex(index)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mo-ficha-layers">
            <h4>Detalles sobre la obra</h4>
            <div className="mo-layer-row">
              {concept.layers.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  title={layer.description}
                  className={visibleLayers.has(layer.id) ? 'is-active' : ''}
                  onClick={() => toggleLayer(layer.id)}
                >
                  {layer.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mo-ficha-lists">
            <div>
              <h4>A favor</h4>
              <ul>
                {concept.advantages.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Limitaciones</h4>
              <ul>
                {concept.difficulties.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {related.length > 0 && (
            <div className="mo-ficha-related">
              <h4>Obras relacionadas</h4>
              <div className="mo-related-row">
                {related.slice(0, 4).map((item) => (
                  <button key={item.id} type="button" onClick={() => onSelect(item)}>
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {concept.sources && concept.sources.length > 0 && (
            <div className="mo-ficha-sources">
              <h4>Referencias</h4>
              {concept.sources.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  {source.publisher} — {source.title} ↗
                </a>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function MuseoOrbital() {
  const [active, setActive] = useState<FichaState | null>(null);
  const [activeHallId, setActiveHallId] = useState<string | null>(null);
  useScrollLock(Boolean(active));

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveHallId(entry.target.id.replace('sala-', ''));
          }
        });
      },
      { rootMargin: '-42% 0px -42% 0px' },
    );
    chapters.forEach((chapter) => {
      const element = document.getElementById(`sala-${chapter.id}`);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  const openConcept = (concept: AstroConcept) =>
    setActive({ concept, chapter: resolveChapter(concept) });

  let plateOffset = 0;

  return (
    <div className="mo-root">
      <Grain opacity={0.06} blend="screen" zIndex={40} />

      <Hero />
      <Marquee />
      <HallIndex activeId={activeHallId} />

      {chapters.map((chapter) => {
        const offset = plateOffset;
        plateOffset += chapter.concepts.length;
        return (
          <Sala
            key={chapter.id}
            chapter={chapter}
            offset={offset}
            onSelect={openConcept}
          />
        );
      })}

      <footer className="mo-footer">
        <blockquote>{chapters[0].sections[1]?.body}</blockquote>
        <p className="mo-footer-line">
          ASTROINGENIERÍA — EXPOSICIÓN PERMANENTE · PLANTILLA MUSEO ORBITAL · MMXXVI
        </p>
      </footer>

      <aside className="mo-rail" aria-label="Progreso del recorrido">
        {chapters.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            title={chapter.title}
            className={activeHallId === chapter.id ? 'is-active' : ''}
            style={{ '--accent': chapter.color } as CSSProperties}
            onClick={() =>
              document
                .getElementById(`sala-${chapter.id}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          />
        ))}
      </aside>

      <AnimatePresence>
        {active && (
          <Ficha state={active} onClose={() => setActive(null)} onSelect={openConcept} />
        )}
      </AnimatePresence>
    </div>
  );
}
