import { useLocale } from '../../i18n/LocaleProvider';
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useScrollLock } from './useScrollLock';
import { LivingCanvas } from '../museo-orbital/LivingCanvas';

export interface ImageLightboxImage {
  src: string;
  alt: string;
  caption?: string;
}

interface ImageLightboxProps {
  image: ImageLightboxImage;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  /* Capítulo de la obra: con él, la imagen ampliada queda viva con su atmósfera */
  chapterId?: string;
}

export function ImageLightbox({ image, onClose, onPrevious, onNext, chapterId }: ImageLightboxProps) {
  const { t } = useLocale();
  const closeRef = useRef<HTMLButtonElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  // Mantener presionado (el clic o la barra espaciadora) muestra la imagen tal
  // cual, sin profundidad ni atmósfera; al soltar vuelve a estar viva
  const hold = useRef({ timer: 0, held: false });
  const setRaw = (raw: boolean) => mediaRef.current?.classList.toggle('is-raw', raw);
  const releaseHold = () => {
    window.clearTimeout(hold.current.timer);
    setRaw(false);
  };
  useEffect(() => {
    const onSpace = (event: KeyboardEvent) => {
      if (event.key !== ' ') return;
      event.preventDefault();
      setRaw(event.type === 'keydown');
    };
    window.addEventListener('keydown', onSpace, true);
    window.addEventListener('keyup', onSpace, true);
    return () => {
      window.removeEventListener('keydown', onSpace, true);
      window.removeEventListener('keyup', onSpace, true);
    };
  }, []);
  useScrollLock(true);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && onPrevious) {
        event.preventDefault();
        onPrevious();
      }
      if (event.key === 'ArrowRight' && onNext) {
        event.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onNext, onPrevious]);

  return (
    <motion.div
      className="mo-image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={t("Imagen ampliada: {0}", image.alt)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
      onPointerDown={(event) => {
        const target = event.target;
        if (target instanceof Element && !target.closest('.mo-image-lightbox-panel')) onClose();
      }}
    >
      <div className="mo-image-lightbox-backdrop" aria-hidden="true" />
      <div className="mo-image-lightbox-panel">
        <button
          ref={closeRef}
          type="button"
          className="mo-image-lightbox-close"
          onClick={onClose}
          data-cursor-label={t("Cerrar")}
        >
          ✕ <span>{t("Cerrar")}</span>
        </button>
        <div className="mo-image-lightbox-viewer">
          <figure className="mo-image-lightbox-figure">
            <div
              className={`mo-image-lightbox-media${chapterId ? ' is-wide' : ''}`}
              ref={mediaRef}
              onPointerDown={() => {
                hold.current.held = false;
                hold.current.timer = window.setTimeout(() => {
                  hold.current.held = true;
                  setRaw(true);
                }, 220);
              }}
              onPointerUp={releaseHold}
              onPointerLeave={releaseHold}
              onPointerCancel={releaseHold}
            >
              {onPrevious && (
                <button
                  type="button"
                  className="mo-image-lightbox-nav is-prev"
                  onClick={onPrevious}
                  aria-label={t("Ver imagen anterior")}
                  data-cursor-label={t("Anterior")}
                >
                  <span aria-hidden="true">‹</span>
                </button>
              )}
              <img
                src={image.src}
                alt={image.alt}
                draggable={false}
                onClick={() => {
                  // Soltar después de mantener presionado no cierra
                  if (hold.current.held) {
                    hold.current.held = false;
                    return;
                  }
                  onClose();
                }}
                title={t("Clic para cerrar")}
                data-cursor-label={t("Cerrar")}
              />
              <LivingCanvas key={image.src} src={image.src} chapterId={chapterId} />
              {onNext && (
                <button
                  type="button"
                  className="mo-image-lightbox-nav is-next"
                  onClick={onNext}
                  aria-label={t("Ver imagen siguiente")}
                  data-cursor-label={t("Siguiente")}
                >
                  <span aria-hidden="true">›</span>
                </button>
              )}
            </div>
            {image.caption && <figcaption>{image.caption}</figcaption>}
          </figure>
        </div>
      </div>
    </motion.div>
  );
}
