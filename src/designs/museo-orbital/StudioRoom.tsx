import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { plausibilityLabels, scaleLabels } from '../../data/astroData';
import type { AstroChapter, AstroConcept, VisualLayerId } from '../../types';
import { getConceptImageVariants } from '../shared/conceptImages';
import './museoOrbital.css';

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

type StudioTab = 'pieza' | 'narrativa' | 'lectura' | 'dossier';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const roman = (index: number) => ROMAN[index] ?? String(index + 1);

const LAYER_COLORS: Record<VisualLayerId, string> = {
  estructura: '#c9a86a',
  escala: '#8fd0ff',
  energia: '#ffd27a',
  riesgos: '#ff8f7a',
  materiales: '#a8e08f',
};

const EVIDENCE_META = {
  fuente: { label: 'Fuente', color: '#a8e08f' },
  estimacion: { label: 'Estimación', color: '#ffd27a' },
  conceptual: { label: 'Conceptual', color: '#b9a7e8' },
} as const;

const tabs: { id: StudioTab; label: string }[] = [
  { id: 'pieza', label: 'Pieza' },
  { id: 'narrativa', label: 'Narrativa' },
  { id: 'lectura', label: 'Lectura larga' },
  { id: 'dossier', label: 'Dossier técnico' },
];

interface StudioProps {
  concept: AstroConcept;
  chapter: AstroChapter;
  siblings: AstroConcept[];
  enableFlight?: boolean;
  onClose: () => void;
  onSelect: (concept: AstroConcept) => void;
}

export const StudioRoom = ({
  concept,
  chapter,
  siblings,
  enableFlight = true,
  onClose,
  onSelect,
}: StudioProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<StudioTab>('pieza');

  const variants = useMemo(() => getConceptImageVariants(concept), [concept]);
  const [variantIndex, setVariantIndex] = useState(0);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(
    () => new Set(concept.layers.map((layer) => layer.id)),
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const index = siblings.findIndex((item) => item.id === concept.id);
  const previous = index > 0 ? siblings[index - 1] : null;
  const next = index < siblings.length - 1 ? siblings[index + 1] : null;
  const related = concept.related
    .map((id) => siblings.find((s) => s.id === id))
    .filter((item): item is AstroConcept => Boolean(item));

  useEffect(() => {
    setVariantIndex(0);
    setVisibleLayers(new Set(concept.layers.map((layer) => layer.id)));
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setTab('pieza');
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

  const toggleLayer = (layerId: string) => {
    setVisibleLayers((current) => {
      const nextSet = new Set(current);
      if (nextSet.has(layerId)) nextSet.delete(layerId);
      else nextSet.add(layerId);
      return nextSet;
    });
  };

  const hotspots = concept.hotspots.filter((hotspot) => visibleLayers.has(hotspot.layer));
  const variant = variants[Math.min(variantIndex, variants.length - 1)];
  const allLayerIds = new Set(concept.layers.map((layer) => layer.id));

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, ox: pan.x, oy: pan.y };
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || zoom <= 1) return;
    const limit = 260 * (zoom - 1);
    setPan({
      x: Math.max(-limit, Math.min(limit, dragRef.current.ox + event.clientX - dragRef.current.x)),
      y: Math.max(-limit, Math.min(limit, dragRef.current.oy + event.clientY - dragRef.current.y)),
    });
  };
  const endDrag = () => {
    dragRef.current = null;
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
    >
      <div
        className="mo-studio-panel"
        ref={panelRef}
        style={{ '--accent': chapter.color } as CSSProperties}
      >
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
            <div className="mo-studio-figure">
              <motion.div
                className="mo-studio-imgframe"
                layoutId={enableFlight ? `obra-${concept.id}` : undefined}
              >
                <div
                  className="mo-studio-zoomer"
                  data-cursor-label={zoom > 1 ? 'Arrastra' : undefined}
                  style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
                  onPointerDown={startDrag}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerLeave={endDrag}
                >
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
              </motion.div>

              {hotspots.map((hotspot) => (
                <button
                  key={hotspot.id}
                  type="button"
                  className={`mo-hotspot${hotspot.x > 62 ? ' flip-left' : ''}`}
                  style={
                    {
                      left: `${hotspot.x}%`,
                      top: `${hotspot.y}%`,
                      '--layer-color': LAYER_COLORS[hotspot.layer],
                    } as CSSProperties
                  }
                >
                  <i />
                  <span>
                    <b>{hotspot.title}</b>
                    {hotspot.description}
                  </span>
                </button>
              ))}

              <figcaption>{variant.caption}</figcaption>
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

              {variants.length > 1 && (
                <div className="mo-variant-row" role="group" aria-label="Capas visuales">
                  {variants.map((item, itemIndex) => (
                    <button
                      key={item.id}
                      type="button"
                      className={itemIndex === variantIndex ? 'is-active' : ''}
                      onClick={() => {
                        setVariantIndex(itemIndex);
                        setZoom(1);
                        setPan({ x: 0, y: 0 });
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <nav className="mo-studio-tabs" aria-label="Secciones de la sala de estudio">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                className={tab === item.id ? 'is-active' : ''}
                onClick={() => goTab(item.id)}
              >
                <b>{roman(tabs.indexOf(item))}</b> {item.label}
              </button>
            ))}
          </nav>

          {tab === 'pieza' && (
            <section className="mo-tab-pane" aria-label="La pieza">
              <div className="mo-legend">
                <span className="mo-legend-title">Capas de lectura</span>
                <div className="mo-legend-row">
                  <button
                    type="button"
                    className={
                      visibleLayers.size === allLayerIds.size ? 'mo-layer-pill is-on' : 'mo-layer-pill'
                    }
                    onClick={() => setVisibleLayers(new Set(allLayerIds))}
                  >
                    Todas
                  </button>
                  {concept.layers.map((layer) => {
                    const count = concept.hotspots.filter((h) => h.layer === layer.id).length;
                    const isOn = visibleLayers.has(layer.id);
                    return (
                      <button
                        key={layer.id}
                        type="button"
                        className={`mo-layer-pill${isOn ? ' is-on' : ' is-off'}`}
                        title={layer.description}
                        onClick={() => toggleLayer(layer.id)}
                      >
                        <i style={{ background: LAYER_COLORS[layer.id] }} />
                        {layer.label}
                        <b>{count}</b>
                      </button>
                    );
                  })}
                </div>
                <div className="mo-zoom-row">
                  <span className="mo-legend-title">Acercamiento</span>
                  {[1, 1.5, 2].map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={zoom === level ? 'mo-layer-pill is-on' : 'mo-layer-pill'}
                      onClick={() => {
                        setZoom(level);
                        setPan({ x: 0, y: 0 });
                      }}
                    >
                      ×{String(level).replace('.', ',')}
                    </button>
                  ))}
                  {zoom > 1 && <em>arrastra sobre la imagen para explorar el detalle</em>}
                </div>
              </div>

              <div className="mo-piece-hint">
                {concept.hotspots.length === 0
                  ? 'Esta pieza no tiene marcadores de detalle.'
                  : `${hotspots.length} de ${concept.hotspots.length} marcadores visibles sobre la pieza.`}
              </div>
            </section>
          )}

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
        </div>
      </div>
    </motion.div>
  );
};
