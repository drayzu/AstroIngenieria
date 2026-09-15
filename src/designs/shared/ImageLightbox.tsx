import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useScrollLock } from './useScrollLock';

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
}

export function ImageLightbox({ image, onClose, onPrevious, onNext }: ImageLightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
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
      aria-label={`Imagen ampliada: ${image.alt}`}
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
          data-cursor-label="Cerrar"
        >
          ✕ <span>Cerrar</span>
        </button>
        <div className="mo-image-lightbox-viewer">
          <figure className="mo-image-lightbox-figure">
            <div className="mo-image-lightbox-media">
              {onPrevious && (
                <button
                  type="button"
                  className="mo-image-lightbox-nav is-prev"
                  onClick={onPrevious}
                  aria-label="Ver imagen anterior"
                  data-cursor-label="Anterior"
                >
                  <span aria-hidden="true">‹</span>
                </button>
              )}
              <img
                src={image.src}
                alt={image.alt}
                draggable={false}
                onClick={onClose}
                title="Clic para cerrar"
                data-cursor-label="Cerrar"
              />
              {onNext && (
                <button
                  type="button"
                  className="mo-image-lightbox-nav is-next"
                  onClick={onNext}
                  aria-label="Ver imagen siguiente"
                  data-cursor-label="Siguiente"
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
