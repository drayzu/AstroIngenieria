import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { plausibilityLabels, scaleLabels } from '../../data/astroData';
import type { AstroChapter, AstroConcept } from '../../types';
import { metricRows, metricValueLabel } from '../../data/metricProfile';
import { getConceptImageVariants } from '../shared/conceptImages';
import { ArticleReader } from '../shared/ArticleReader';
import { ImageLightbox, type ImageLightboxImage } from '../shared/ImageLightbox';
import './museoOrbital.css';

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

interface StudioProps {
  concept: AstroConcept;
  chapter: AstroChapter;
  siblings: AstroConcept[];
  navigationContext: 'chapter' | 'vitrine';
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
  navigationContext,
  enableFlight = true,
  inVitrine,
  onToggleVitrine,
  onClose,
  onSelect,
}: StudioProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropPressRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLDivElement>(null);
  const [lightboxImage, setLightboxImage] = useState<ImageLightboxImage | null>(null);
  const [articleLightboxOpen, setArticleLightboxOpen] = useState(false);
  const lightboxOpen = Boolean(lightboxImage) || articleLightboxOpen;
  const handleArticleLightboxOpenChange = useCallback((open: boolean) => {
    setArticleLightboxOpen(open);
  }, []);

  const variants = useMemo(() => getConceptImageVariants(concept), [concept]);
  const [variantIndex, setVariantIndex] = useState(0);

  const index = siblings.findIndex((item) => item.id === concept.id);
  const previous = index > 0 ? siblings[index - 1] : null;
  const next = index < siblings.length - 1 ? siblings[index + 1] : null;
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
    const resizeObserver = new ResizeObserver(onScroll);
    const observeContent = () => {
      resizeObserver.disconnect();
      resizeObserver.observe(el);
      el.querySelectorAll('.ar-reader, .mo-studio-hero, .mo-tab-pane').forEach(child => resizeObserver.observe(child));
      onScroll();
    };
    const mutationObserver = new MutationObserver(observeContent);
    mutationObserver.observe(el, { childList: true, subtree: true });
    observeContent();
    return () => {
      el.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [concept]);

  useEffect(() => {
    setVariantIndex(0);
    setLightboxImage(null);
    setArticleLightboxOpen(false);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [concept]);

  useEffect(() => {
    const closeBtn = panelRef.current?.querySelector<HTMLButtonElement>('.mo-studio-close');
    closeBtn?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (lightboxImage && ['Escape', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input, summary, [tabindex]:not([tabindex="-1"])',
        )).filter(element => element.getClientRects().length > 0);
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
  }, [lightboxImage, next, previous, onClose, onSelect]);

  const profileRows = metricRows(concept.metrics);

  const variant = variants[Math.min(variantIndex, variants.length - 1)];

  const selectVariant = (nextIndex: number) => {
    const nextVariant = variants[nextIndex];
    if (!nextVariant) return;
    setVariantIndex(nextIndex);
    setLightboxImage((current) => current ? {
      src: nextVariant.src,
      alt: concept.illustration.alt,
      caption: nextVariant.caption,
    } : current);
  };

  const changeVariant = (direction: -1 | 1) => {
    selectVariant((variantIndex + direction + variants.length) % variants.length);
  };

  return (
    <motion.div
      className={`mo-studio${lightboxOpen ? ' is-lightbox-open' : ''}`}
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
            {navigationContext === 'vitrine'
              ? `Vitrina · ${String(index + 1).padStart(2, '0')} / ${String(siblings.length).padStart(2, '0')}`
              : `N.º ${String(index + 1).padStart(2, '0')} / ${String(siblings.length).padStart(2, '0')}`}
          </span>
          <nav
            className="mo-studio-nav"
            aria-label={navigationContext === 'vitrine' ? 'Obras de la vitrina' : 'Obras contiguas'}
          >
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
              >
                <button
                  type="button"
                  className="mo-studio-image-open"
                  onClick={() => setLightboxImage({
                    src: variant.src,
                    alt: concept.illustration.alt,
                    caption: variant.caption,
                  })}
                  aria-label={`Ampliar imagen de ${concept.title}`}
                  data-cursor-label="Ampliar imagen"
                >
                  <motion.div
                    className="mo-studio-imgframe"
                    layoutId={enableFlight ? `obra-${concept.id}` : undefined}
                  >
                    <div className="mo-studio-zoomer">
                      <div className="mo-kb">
                        <AnimatePresence mode="wait">
                          <motion.img
                            key={variant.src}
                            src={variant.src}
                            alt={concept.illustration.alt}
                            decoding="async"
                            initial={{ opacity: 0, scale: 1.03 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5, ease: EASE_OUT }}
                          />
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                </button>

                {variants.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="mo-studio-image-nav is-prev"
                      onClick={() => changeVariant(-1)}
                      aria-label="Ver imagen anterior"
                      data-cursor-label="Anterior"
                    >
                      <span aria-hidden="true">‹</span>
                    </button>
                    <button
                      type="button"
                      className="mo-studio-image-nav is-next"
                      onClick={() => changeVariant(1)}
                      aria-label="Ver imagen siguiente"
                      data-cursor-label="Siguiente"
                    >
                      <span aria-hidden="true">›</span>
                    </button>
                  </>
                )}

                <figcaption>{variant.caption}</figcaption>
              </div>

              {variants.length > 1 && (
                <div className="mo-filmstrip" role="group" aria-label="Capas visuales de la obra">
                  {variants.map((item, itemIndex) => (
                    <button
                      key={item.id}
                      type="button"
                      className={itemIndex === variantIndex ? 'is-active' : ''}
                      onClick={() => selectVariant(itemIndex)}
                      data-cursor-label={item.label}
                      aria-pressed={itemIndex === variantIndex}
                    >
                      <img src={item.src} alt="" loading="lazy" decoding="async" />
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

              <div className="mo-metric-profile-heading">
                <span>Perfil comparativo</span>
              </div>
              <dl className="mo-metrics-v2">
                {profileRows.map((row) => (
                  <div key={row.key} title={row.definition}>
                    <dt>{row.label}<small>{row.descriptor}</small></dt>
                    <dd aria-label={metricValueLabel(row)}>
                      {[1, 2, 3, 4, 5].map((cell) => (
                        <i key={cell} className={cell <= row.value ? 'is-on' : ''} />
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section className="mo-tab-pane mo-tab-pane-with-back" aria-label="Lectura del tema">
            <ArticleReader
              key={concept.id}
              concept={concept}
              onLightboxOpenChange={handleArticleLightboxOpenChange}
            />
            <button
              type="button"
              className="mo-back-to-top"
              onClick={() => scrollRef.current?.scrollTo({
                top: 0,
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
              })}
              aria-label="Volver al inicio de la sala de estudio"
              data-cursor-label="Volver arriba"
              title="Volver arriba"
            >
              <span aria-hidden="true">↑</span>
            </button>
          </section>
        </div>
      </div>
      <AnimatePresence>
        {lightboxImage && (
          <ImageLightbox
            image={lightboxImage}
            onClose={() => setLightboxImage(null)}
            onPrevious={variants.length > 1 ? () => changeVariant(-1) : undefined}
            onNext={variants.length > 1 ? () => changeVariant(1) : undefined}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
