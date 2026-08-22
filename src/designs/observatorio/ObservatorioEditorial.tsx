import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { chapters, conceptById, plausibilityLabels, scaleLabels } from '../../data/astroData';
import type { AstroChapter, AstroConcept } from '../../types';
import { getConceptImageVariants } from '../shared/conceptImages';
import { Grain } from '../shared/Grain';
import { useScrollLock } from '../shared/useScrollLock';
import './observatorioEditorial.css';

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const DEFAULT_FEATURE = 'habitats';

const resolveChapter = (concept: AstroConcept): AstroChapter =>
  chapters.find((chapter) => chapter.id === concept.chapterId) ?? chapters[0];

/* ---------------- Portada ---------------- */

const Ticker = () => {
  const terms = [
    ...Object.values(scaleLabels),
    ...Object.values(plausibilityLabels),
    'Megaestructuras',
    'SETI',
    'Kardashev',
  ];
  const phrase = `${terms.join('  ·  ')}  ·  `;
  return (
    <div className="oe-ticker" aria-hidden="true">
      <div className="oe-ticker-track">
        <span>{phrase.repeat(2)}</span>
        <span>{phrase.repeat(2)}</span>
      </div>
    </div>
  );
};

const Cover = ({ feature }: { feature: AstroChapter }) => {
  const reduced = useReducedMotion();
  return (
    <header className="oe-cover">
      <div className="oe-cover-top">
        <p className="oe-folio">N.º 01 — EDICIÓN DE APERTURA</p>
        <h1 className="oe-masthead">
          {'OBSERVATORIO'.split('').map((letter, index) => (
            <motion.span
              key={`${letter}-${index}`}
              initial={{ y: '110%', opacity: 0 }}
              animate={{ y: '0%', opacity: 1 }}
              transition={{ delay: reduced ? 0 : 0.08 * index, duration: 0.9, ease: EASE_OUT }}
            >
              {letter}
            </motion.span>
          ))}
        </h1>
        <div className="oe-masthead-rule">
          <span>ATLAS DE ASTROINGENIERÍA</span>
          <span>MMXXVI</span>
          <span>DISTRIBUCIÓN GRATUITA</span>
        </div>
      </div>

      <Ticker />

      <div className="oe-cover-body">
        <figure className="oe-cover-figure">
          <img src={feature.visual?.heroImage} alt={feature.visual?.visualFocus ?? feature.title} />
          <figcaption>{feature.visual?.visualFocus}</figcaption>
        </figure>

        <div className="oe-cover-headline">
          <p className="oe-kicker">Reportaje principal</p>
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : 1.15, duration: 1, ease: EASE_OUT }}
          >
            El arte de habitar el vacío
          </motion.h2>
          <p className="oe-deck">{feature.summary}</p>
          <p className="oe-byline">Por el equipo editorial del atlas — {chapters.length} salas en revisión</p>
        </div>

        <aside className="oe-cover-index">
          <p className="oe-kicker">En este número</p>
          <ul>
            {chapters.map((chapter) => (
              <li key={chapter.id}>
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById('oe-feature')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                >
                  <b>{String(chapter.concepts.length).padStart(2, '0')} piezas</b>
                  <span>{chapter.title}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="oe-barcode" aria-hidden="true" />
        </aside>
      </div>
    </header>
  );
};

/* ---------------- Carta editorial ---------------- */

const Letter = () => (
  <section className="oe-letter oe-reveal">
    <p className="oe-kicker">Carta editorial</p>
    <div className="oe-letter-body">
      <p className="oe-dropcap">{chapters[0].sections[0]?.body}</p>
      <p>{chapters[0].sections[1]?.body}</p>
      <p className="oe-letter-sign">— La redacción</p>
    </div>
  </section>
);

/* ---------------- Reportaje central ---------------- */

const Feature = ({
  chapter,
  onOpenConcept,
}: {
  chapter: AstroChapter;
  onOpenConcept: (concept: AstroConcept) => void;
}) => {
  const reduced = useReducedMotion();
  const figureRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: figureRef,
    offset: ['start end', 'end start'],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ['-6%', '6%']);

  return (
    <section id="oe-feature" className="oe-feature">
      <div className="oe-feature-grid">
        <figure className="oe-feature-figure" ref={figureRef}>
          <div className="oe-feature-frame">
            <motion.img
              src={chapter.visual?.heroImage}
              alt={chapter.visual?.visualFocus ?? chapter.title}
              style={reduced ? undefined : { y: imageY }}
            />
          </div>
          <figcaption>
            Lámina I — {chapter.visual?.missionLabel}
          </figcaption>
        </figure>

        <article className="oe-feature-article">
          <p className="oe-kicker">Reportaje central — Sala {chapter.number}</p>
          <h2>{chapter.title}</h2>
          <p className="oe-standfirst">{chapter.summary}</p>
          <div className="oe-byline-row">
            <span>Piezas: {chapter.concepts.length}</span>
            <span>Escala: {scaleLabels[chapter.scale]}</span>
          </div>

          <div className="oe-feature-columns">
            {chapter.sections.map((section, index) => (
              <p key={section.title} className={index === 0 ? 'oe-dropcap' : undefined}>
                <b className="oe-inline-head">{section.title}. </b>
                {section.body}
              </p>
            ))}
            <blockquote className="oe-pullquote">
              «{chapter.concepts[0]?.keyIdea}»
            </blockquote>
          </div>

          <aside className="oe-marginalia">
            <b>Nota al margen</b>
            {chapter.visual?.visualFocus}
          </aside>
        </article>
      </div>

      <Catalog chapter={chapter} onOpenConcept={onOpenConcept} />
    </section>
  );
};

const Catalog = ({
  chapter,
  onOpenConcept,
}: {
  chapter: AstroChapter;
  onOpenConcept: (concept: AstroConcept) => void;
}) => (
  <div className="oe-catalog">
    <header className="oe-catalog-head">
      <p className="oe-kicker">Catálogo de la sala</p>
      <h3>
        Piezas de <em>{chapter.title}</em>
      </h3>
    </header>
    <ul className="oe-catalog-list">
      {chapter.concepts.map((concept, index) => (
        <motion.li
          key={concept.id}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.7, ease: EASE_OUT }}
        >
          <button type="button" onClick={() => onOpenConcept(concept)}>
            <span className="oe-cat-num">Fig. {String(index + 1).padStart(2, '0')}</span>
            <img src={concept.illustration.src} alt="" loading="lazy" />
            <span className="oe-cat-main">
              <strong>{concept.title}</strong>
              <small>{concept.keyIdea}</small>
            </span>
            <span className="oe-cat-meta">
              {concept.category}
              <i>
                {plausibilityLabels[concept.plausibility]} · {scaleLabels[concept.scale]}
              </i>
            </span>
            <span className="oe-cat-arrow" aria-hidden="true">
              Leer ficha →
            </span>
          </button>
        </motion.li>
      ))}
    </ul>
  </div>
);

/* ---------------- Índice de salas ---------------- */

const IndexRooms = ({
  featureId,
  onSelect,
}: {
  featureId: string;
  onSelect: (id: string) => void;
}) => (
  <section className="oe-index oe-reveal">
    <header className="oe-section-head">
      <p className="oe-kicker">Sumario de salas</p>
      <h3>Toda la colección</h3>
      <p className="oe-section-sub">
        Seleccione cualquier sala para convertirla en el reportaje central del número.
      </p>
    </header>
    <ol>
      {chapters.map((chapter) => (
        <li key={chapter.id}>
          <button
            type="button"
            className={`oe-room${featureId === chapter.id ? ' is-current' : ''}`}
            onClick={() => {
              onSelect(chapter.id);
              document
                .getElementById('oe-feature')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <b>{chapter.number}</b>
            <span className="oe-room-title">{chapter.title}</span>
            <i className="oe-leader" />
            <span className="oe-room-count">{chapter.concepts.length} piezas</span>
            <span className="oe-room-arrow" aria-hidden="true">
              →
            </span>
          </button>
        </li>
      ))}
    </ol>
  </section>
);

/* ---------------- Ficha artículo ---------------- */

const SpecRow = ({ label, value }: { label: string; value: number }) => (
  <div className="oe-spec">
    <dt>{label}</dt>
    <dd aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((cell) => (
        <i key={cell} className={cell <= value ? 'is-on' : ''} />
      ))}
    </dd>
  </div>
);

const ArticleOverlay = ({
  concept,
  onClose,
  onNavigate,
}: {
  concept: AstroConcept;
  onClose: () => void;
  onNavigate: (concept: AstroConcept) => void;
}) => {
  const chapter = resolveChapter(concept);
  const siblings = chapter.concepts;
  const index = siblings.findIndex((item) => item.id === concept.id);
  const variants = useMemo(() => getConceptImageVariants(concept), [concept]);
  const related = concept.related
    .map((id) => conceptById.get(id))
    .filter((item): item is AstroConcept => Boolean(item));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight' && siblings[index + 1]) onNavigate(siblings[index + 1]);
      if (event.key === 'ArrowLeft' && siblings[index - 1]) onNavigate(siblings[index - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [concept, siblings, index, onClose, onNavigate]);

  return (
    <motion.div
      className="oe-article"
      role="dialog"
      aria-modal="true"
      aria-label={concept.title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        key={concept.id}
        className="oe-article-page"
        initial={{ y: 44, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ duration: 0.55, ease: EASE_OUT }}
        style={{ '--accent': chapter.color } as CSSProperties}
      >
        <button type="button" className="oe-article-close" onClick={onClose}>
          ✕ Cerrar
        </button>

        <header className="oe-article-header">
          <p className="oe-kicker">
            Ficha — Sala {chapter.number}, {concept.category}
          </p>
          <h2>{concept.title}</h2>
          <p className="oe-article-standfirst">{concept.narrative.lead}</p>
          <div className="oe-dateline">
            <span>{concept.category}</span>
            <span>{scaleLabels[concept.scale]}</span>
            <span>{plausibilityLabels[concept.plausibility]}</span>
          </div>
        </header>

        <div className="oe-figures">
          {variants.slice(0, 2).map((variant, variantIndex) => (
            <figure key={variant.id}>
              <img src={variant.src} alt={variant.label} loading="lazy" />
              <figcaption>
                Fig. {String(variantIndex + 1).padStart(2, '0')} — {variant.caption ?? variant.label}
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="oe-article-columns">
          {concept.narrative.paragraphs.map((paragraph, paragraphIndex) => (
            <p key={paragraphIndex} className={paragraphIndex === 0 ? 'oe-dropcap' : undefined}>
              {paragraph}
            </p>
          ))}
          {concept.longRead.takeaways[0] && (
            <aside className="oe-takeaway">
              <b>Idea para llevar</b>
              {concept.longRead.takeaways[0]}
            </aside>
          )}
        </div>

        <dl className="oe-specs">
          <SpecRow label="Energía" value={concept.metrics.energia} />
          <SpecRow label="Materiales" value={concept.metrics.materiales} />
          <SpecRow label="Madurez" value={concept.metrics.madurez} />
          <SpecRow label="Maravilla" value={concept.metrics.maravilla} />
        </dl>

        <div className="oe-procon">
          <div>
            <h4>A favor</h4>
            <ul>
              {concept.advantages.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>En contra</h4>
            <ul>
              {concept.difficulties.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <footer className="oe-article-foot">
          {concept.sources && concept.sources.length > 0 && (
            <div className="oe-notes">
              <h4>Notas y fuentes</h4>
              <ol>
                {concept.sources.map((source, sourceIndex) => (
                  <li key={source.url}>
                    <sup>[{sourceIndex + 1}]</sup>{' '}
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.publisher}: {source.title} ↗
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <nav className="oe-article-nav">
            <button
              type="button"
              disabled={!siblings[index - 1]}
              onClick={() => siblings[index - 1] && onNavigate(siblings[index - 1])}
            >
              ← {siblings[index - 1]?.title ?? '—'}
            </button>
            <span>
              {index + 1} / {siblings.length}
            </span>
            <button
              type="button"
              disabled={!siblings[index + 1]}
              onClick={() => siblings[index + 1] && onNavigate(siblings[index + 1])}
            >
              {siblings[index + 1]?.title ?? '—'} →
            </button>
          </nav>

          {related.length > 0 && (
            <div className="oe-related">
              <span>Otras piezas relacionadas:</span>
              {related.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item)}
                >
                  {item.title}
                </button>
              ))}
            </div>
          )}
        </footer>
      </motion.div>
    </motion.div>
  );
};

/* ---------------- Principal ---------------- */

export default function ObservatorioEditorial() {
  const [featureId, setFeatureId] = useState(DEFAULT_FEATURE);
  const [activeConcept, setActiveConcept] = useState<AstroConcept | null>(null);
  useScrollLock(Boolean(activeConcept));
  const feature = chapters.find((chapter) => chapter.id === featureId) ?? chapters[1];

  const openConcept = (concept: AstroConcept) => setActiveConcept(concept);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      },
      { rootMargin: '-10% 0px -10% 0px' },
    );
    document.querySelectorAll('.oe-root .oe-reveal').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="oe-root">
      <Grain opacity={0.055} blend="multiply" zIndex={70} />

      <Cover feature={feature} />
      <Letter />
      <Feature chapter={feature} onOpenConcept={openConcept} />
      <IndexRooms featureId={featureId} onSelect={setFeatureId} />

      <footer className="oe-colophon">
        <p className="oe-colophon-mark">❦</p>
        <p>
          OBSERVATORIO — publicación imaginaria del atlas de astroingeniería. Compuesta con datos
          reales del repositorio; tipografía Fraunces y Space Grotesk sobre papel digital.
        </p>
      </footer>

      <AnimatePresence>
        {activeConcept && (
          <ArticleOverlay
            concept={activeConcept}
            onClose={() => setActiveConcept(null)}
            onNavigate={setActiveConcept}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
