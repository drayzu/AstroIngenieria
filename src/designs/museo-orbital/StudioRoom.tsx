import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { plausibilityLabels, scaleLabels } from '../../data/astroData';
import type { AstroChapter, AstroConcept } from '../../types';
import { getConceptImageVariants } from '../shared/conceptImages';
import './museoOrbital.css';

const ONeillCylinderModel = lazy(() =>
  import('./ONeillCylinderModel').then((module) => ({ default: module.ONeillCylinderModel })),
);

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

type StudioTab = 'narrativa' | 'lectura' | 'dossier' | 'maqueta';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const roman = (index: number) => ROMAN[index] ?? String(index + 1);

const EVIDENCE_META = {
  fuente: { label: 'Fuente', color: '#a8e08f' },
  estimacion: { label: 'Estimación', color: '#ffd27a' },
  conceptual: { label: 'Conceptual', color: '#b9a7e8' },
} as const;

const tabs: { id: StudioTab; label: string }[] = [
  { id: 'narrativa', label: 'Narrativa' },
  { id: 'lectura', label: 'Lectura larga' },
  { id: 'dossier', label: 'Dossier técnico' },
];

const ZOOM_LEVELS = [1, 1.5, 2];

interface StudioProps {
  concept: AstroConcept;
  chapter: AstroChapter;
  siblings: AstroConcept[];
  enableFlight?: boolean;
  inVitrine: boolean;
  onToggleVitrine: (conceptId: string) => void;
  onClose: () => void;
  onSelect: (concept: AstroConcept) => void;
}

export const StudioRoom = ({
  concept,
  chapter,
  siblings,
  enableFlight = true,
  inVitrine,
  onToggleVitrine,
  onClose,
  onSelect,
}: StudioProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropPressRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomerRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<StudioTab>('narrativa');
  const [zoom, setZoom] = useState(1);

  const variants = useMemo(() => getConceptImageVariants(concept), [concept]);
  const [variantIndex, setVariantIndex] = useState(0);
  const inlineVariants = useMemo(() => variants.slice(1), [variants]);

  const index = siblings.findIndex((item) => item.id === concept.id);
  const previous = index > 0 ? siblings[index - 1] : null;
  const next = index < siblings.length - 1 ? siblings[index + 1] : null;
  const related = concept.related
    .map((id) => siblings.find((s) => s.id === id))
    .filter((item): item is AstroConcept => Boolean(item));

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 4 ? Math.min(1, el.scrollTop / max) : 0);
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [concept]);

  useEffect(() => {
    setVariantIndex(0);
    setZoom(1);
    setOrigin(50, 50);
    setTab('narrativa');
    scrollRef.current?.scrollTo({ top: 0 });
  }, [concept]);

  useEffect(() => {
    const closeBtn = panelRef.current?.querySelector<HTMLButtonElement>('.mo-studio-close');
    closeBtn?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const activeEl = document.activeElement as HTMLElement | null;
        if (event.shiftKey && (activeEl === first || !panelRef.current.contains(activeEl))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && activeEl === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if ((event.target as HTMLElement)?.closest('input, textarea')) return;
      if (event.key === 'ArrowRight' && next) {
        onSelect(next);
      } else if (event.key === 'ArrowLeft' && previous) {
        onSelect(previous);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, previous, onClose, onSelect]);

  const setOrigin = (x: number, y: number) => {
    if (zoomerRef.current) {
      zoomerRef.current.style.transformOrigin = `${x}% ${y}%`;
    }
  };

  const trackOrigin = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (zoom <= 1 || !figureRef.current) return;
    const rect = figureRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    setOrigin(x, y);
  };

  const applyZoom = (level: number) => {
    setZoom(level);
    if (level === 1) setOrigin(50, 50);
  };

  const toggleZoomDblClick = () => {
    applyZoom(zoom === 1 ? 2 : 1);
  };

  const goTab = (nextTab: StudioTab) => {
    setTab(nextTab);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const metricRows: [string, number][] = [
    ['Energía', concept.metrics.energia],
    ['Materiales', concept.metrics.materiales],
    ['Madurez', concept.metrics.madurez],
    ['Maravilla', concept.metrics.maravilla],
  ];

  const variant = variants[Math.min(variantIndex, variants.length - 1)];

  const visibleTabs = [
    ...tabs,
    ...(concept.model3d ? [{ id: 'maqueta' as StudioTab, label: 'Maqueta 3D' }] : []),
  ];

  return (
    <motion.div
      className="mo-studio"
      role="dialog"
      aria-modal="true"
      aria-label={`Sala de estudio: ${concept.title}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      onPointerDown={(event) => {
        backdropPressRef.current =
          event.target === event.currentTarget ? event.pointerId : null;
      }}
      onPointerUp={(event) => {
        const startedOnBackdrop = backdropPressRef.current === event.pointerId;
        backdropPressRef.current = null;
        if (startedOnBackdrop && event.target === event.currentTarget) onClose();
      }}
      onPointerCancel={(event) => {
        if (backdropPressRef.current === event.pointerId) backdropPressRef.current = null;
      }}
    >
      <div
        className="mo-studio-panel"
        ref={panelRef}
        style={{ '--accent': chapter.color } as CSSProperties}
      >
        <div
          className="mo-read-progress"
          style={{ width: `${(progress * 100).toFixed(1)}%` }}
          role="progressbar"
          aria-label="Progreso de lectura"
        />
        <header className="mo-studio-topbar">
          <button
            type="button"
            className="mo-studio-close"
            onClick={onClose}
            data-cursor-label="Cerrar"
          >
            ✕ &nbsp;Volver al recorrido
          </button>
          <span className="mo-studio-plate">
            N.º {String(index + 1).padStart(2, '0')} / {String(siblings.length).padStart(2, '0')}
          </span>
          <nav className="mo-studio-nav" aria-label="Obras contiguas">
            <button
              type="button"
              disabled={!previous}
              onClick={() => previous && onSelect(previous)}
              data-cursor-label="Anterior"
            >
              ← {previous?.title ?? '—'}
            </button>
            <button
              type="button"
              disabled={!next}
              onClick={() => next && onSelect(next)}
              data-cursor-label="Siguiente"
            >
              {next?.title ?? '—'} →
            </button>
          </nav>
        </header>

        <div className="mo-studio-scroll" ref={scrollRef}>
          <section className="mo-studio-hero">
            <div className="mo-studio-figure-col">
              <div
                className="mo-studio-figure"
                ref={figureRef}
                onMouseMove={(event) => {
                  trackOrigin(event);
                  const rect = event.currentTarget.getBoundingClientRect();
                  const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
                  const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
                  event.currentTarget.style.setProperty('--frx', `${(-py * 1.3).toFixed(2)}deg`);
                  event.currentTarget.style.setProperty('--fry', `${(px * 1.6).toFixed(2)}deg`);
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.setProperty('--frx', '0deg');
                  event.currentTarget.style.setProperty('--fry', '0deg');
                }}
                onDoubleClick={toggleZoomDblClick}
                data-cursor-label={zoom > 1 ? 'Mueve el ratón para explorar' : 'Doble clic para acercar'}
              >
                <motion.div
                  className="mo-studio-imgframe"
                  layoutId={enableFlight ? `obra-${concept.id}` : undefined}
                >
                <div
                  className="mo-studio-zoomer"
                  ref={zoomerRef}
                  style={{ transform: `scale(${zoom})` }}
                >
                  <div className="mo-kb">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={variant.src}
                        src={variant.src}
                        alt={concept.illustration.alt}
                        initial={{ opacity: 0, scale: 1.03 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: EASE_OUT }}
                      />
                    </AnimatePresence>
                  </div>
                </div>
                </motion.div>

                <div className="mo-zoom-hud" role="group" aria-label="Acercamiento">
                  {ZOOM_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={zoom === level ? 'is-active' : ''}
                      onClick={() => applyZoom(level)}
                      data-cursor-label={`Zoom ×${String(level).replace('.', ',')}`}
                    >
                      ×{String(level).replace('.', ',')}
                    </button>
                  ))}
                </div>

                <figcaption>{variant.caption}</figcaption>
              </div>

              {variants.length > 1 && (
                <div className="mo-filmstrip" role="group" aria-label="Capas visuales de la obra">
                  {variants.map((item, itemIndex) => (
                    <button
                      key={item.id}
                      type="button"
                      className={itemIndex === variantIndex ? 'is-active' : ''}
                      onClick={() => setVariantIndex(itemIndex)}
                      data-cursor-label={item.label}
                      aria-pressed={itemIndex === variantIndex}
                    >
                      <img src={item.src} alt="" loading="lazy" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mo-studio-brief">
              <p className="mo-kicker">
                Sala de estudio — Sala {chapter.number}, {chapter.title}
              </p>
              <h2>{concept.title}</h2>
              <div className="mo-chip-row">
                <span>{concept.category}</span>
                <span>{scaleLabels[concept.scale]}</span>
                <span>{plausibilityLabels[concept.plausibility]}</span>
              </div>
              <p className="mo-studio-lead">{concept.summary}</p>

              <button
                type="button"
                className={`mo-vitrine-toggle${inVitrine ? ' is-in' : ''}`}
                onClick={() => onToggleVitrine(concept.id)}
                data-cursor-label={inVitrine ? 'Quitar' : 'Añadir'}
              >
                {inVitrine ? '✓ En la vitrina de contrastes' : '+ Añadir a la vitrina de contrastes'}
              </button>

              <dl className="mo-metrics-v2">
                {metricRows.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd aria-label={`${value} de 5`}>
                      {[1, 2, 3, 4, 5].map((cell) => (
                        <i key={cell} className={cell <= value ? 'is-on' : ''} />
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <nav className="mo-studio-tabs" aria-label="Secciones de la sala de estudio">
            {visibleTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? 'is-active' : ''}
                onClick={() => goTab(item.id)}
              >
                <b>{roman(visibleTabs.indexOf(item))}</b> {item.label}
              </button>
            ))}
          </nav>

          {tab === 'narrativa' && (
            <section className="mo-tab-pane mo-reader" aria-label="Narrativa">
              <p className="mo-reader-kicker">{concept.narrative.title}</p>
              <p className="mo-reader-standfirst">{concept.narrative.lead}</p>
              {concept.narrative.paragraphs.map((paragraph, paragraphIndex) => (
                <p key={paragraphIndex} className={paragraphIndex === 0 ? 'mo-dropcap' : undefined}>
                  {paragraph}
                </p>
              ))}
              {concept.narrative.sections.map((section, sectionIndex) => (
                <div key={section.id} className="mo-reader-section">
                  <h3>
                    <span>{roman(sectionIndex)}.</span> {section.title}
                  </h3>
                  {section.body.map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex}>{paragraph}</p>
                  ))}
                  {inlineVariants[sectionIndex] && (
                    <figure className="mo-reader-figure">
                      <div className="mo-reader-figure-frame">
                        <img
                          src={inlineVariants[sectionIndex].src}
                          alt={inlineVariants[sectionIndex].caption ?? concept.title}
                          loading="lazy"
                        />
                      </div>
                      <figcaption>
                        <b>Lámina {roman(sectionIndex + 1)}</b>
                        {inlineVariants[sectionIndex].label}
                        {inlineVariants[sectionIndex].caption
                          ? ` — ${inlineVariants[sectionIndex].caption}`
                          : ''}
                      </figcaption>
                    </figure>
                  )}
                </div>
              ))}
              {concept.narrative.closing && (
                <p className="mo-reader-closing">{concept.narrative.closing}</p>
              )}
            </section>
          )}

          {tab === 'lectura' && (
            <section className="mo-tab-pane mo-reader" aria-label="Lectura larga">
              <p className="mo-reader-kicker">{concept.longRead.title}</p>
              <p className="mo-reader-standfirst">{concept.longRead.subtitle}</p>
              {concept.longRead.sections.map((section, sectionIndex) => (
                <div key={section.id} className="mo-reader-section">
                  <h3>
                    <span>{roman(sectionIndex)}.</span> {section.title}
                  </h3>
                  {section.body.map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex}>{paragraph}</p>
                  ))}
                  {section.callout && (
                    <aside className="mo-callout">
                      <b>{section.callout.label}</b>
                      {section.callout.body}
                    </aside>
                  )}
                </div>
              ))}

              {concept.longRead.takeaways.length > 0 && (
                <div className="mo-takeaways">
                  <h4>Para llevarse del museo</h4>
                  <div className="mo-takeaway-grid">
                    {concept.longRead.takeaways.map((takeaway, takeawayIndex) => (
                      <article key={takeaway}>
                        <b>{roman(takeawayIndex)}</b>
                        {takeaway}
                      </article>
                    ))}
                  </div>
                </div>
              )}
              {concept.longRead.closing && (
                <blockquote className="mo-final-quote">{concept.longRead.closing}</blockquote>
              )}
            </section>
          )}

          {tab === 'dossier' && (
            <section className="mo-tab-pane mo-dossier" aria-label="Dossier técnico">
              {concept.dossier.map((section, sectionIndex) => (
                <div key={section.id} className="mo-dossier-section">
                  <h3>
                    <span>{roman(sectionIndex)}</span> {section.title}
                  </h3>
                  <dl>
                    {section.items.map((item) => {
                      const evidence = EVIDENCE_META[item.evidence];
                      return (
                        <div key={`${section.id}-${item.label}`}>
                          <dt>
                            {item.label}
                            <i
                              className="mo-stamp"
                              style={{ '--stamp': evidence.color } as CSSProperties}
                            >
                              {evidence.label}
                            </i>
                          </dt>
                          <dd>{item.body}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              ))}

              <div className="mo-dossier-foot">
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
                <div className="mo-related-v2">
                  <h4>Obras relacionadas en esta sala</h4>
                  <div className="mo-variant-row">
                    {related.slice(0, 6).map((item) => (
                      <button key={item.id} type="button" onClick={() => onSelect(item)}>
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {concept.sources && concept.sources.length > 0 && (
                <div className="mo-footnotes">
                  <h4>Referencias</h4>
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
            </section>
          )}
          {tab === 'maqueta' && concept.model3d && (
            <section className="mo-tab-pane mo-model-pane" aria-label="Maqueta 3D interactiva">
              <p className="mo-reader-kicker">{concept.model3d.label}</p>
              <div className="mo-model-stage">
                <Suspense fallback={<div className="mo-model-loading">Forjando la maqueta…</div>}>
                  <ONeillCylinderModel />
                </Suspense>
              </div>
              <p className="mo-model-caption">{concept.model3d.caption}</p>
            </section>
          )}
        </div>
      </div>
    </motion.div>
  );
};
