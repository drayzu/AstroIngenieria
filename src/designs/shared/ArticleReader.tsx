import { useLocale } from '../../i18n/LocaleProvider';
import { Fragment, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { loadArticle } from '../../data/articles/loadArticle';
import type { ConceptArticle } from '../../data/articles/model';
import type { Locale } from '../../i18n/messages';
import type { AstroConcept } from '../../types';
import { ImageLightbox, type ImageLightboxImage } from './ImageLightbox';
import './articleReader.css';

interface ArticleReaderProps {
  concept: AstroConcept;
  onLightboxOpenChange?: (open: boolean) => void;
  onContentReady?: () => void;
}

export function ArticleReader({ concept, onLightboxOpenChange, onContentReady }: ArticleReaderProps) {
  const { locale, t } = useLocale();
  const [loaded, setLoaded] = useState<{ article: ConceptArticle; locale: Locale } | null>(null);
  const content = loaded?.locale === locale && loaded.article.id === concept.id ? loaded.article : null;
  const [error, setError] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<ImageLightboxImage | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setError(false);
    setLightboxImage(null);
    onLightboxOpenChange?.(false);
    loadArticle(concept.sourceChapterId, concept.id, locale).then(article => {
      if (!cancelled) setLoaded({ article, locale });
    }).catch(() => {
      if (!cancelled) setError(true);
    });
    return () => { cancelled = true; };
  }, [concept.id, concept.sourceChapterId, locale, onLightboxOpenChange]);
  useLayoutEffect(() => { if (content) onContentReady?.(); }, [content, onContentReady]);

  if (error) return <div className="ar-status" role="alert"><p>{t("No se pudo cargar la lectura.")}</p><button type="button" onClick={() => {
    // A rejected module import can stay cached until the document is reloaded.
    window.location.reload();
  }}>{t("Recargar lectura")}</button></div>;
  if (!content || content.id !== concept.id) return <div className="ar-status" role="status" aria-live="polite">{t("Preparando la lectura…")}</div>;
  // Las imágenes del artículo se incorporarán solo cuando se seleccionen para esa sección.
  const variants: { id: string; src: string; caption?: string }[] = [];
  const openLightbox = (image: ImageLightboxImage) => {
    onLightboxOpenChange?.(true);
    setLightboxImage(image);
  };
  const closeLightbox = () => {
    onLightboxOpenChange?.(false);
    setLightboxImage(null);
  };
  const changeLightboxImage = (direction: -1 | 1) => {
    if (!lightboxImage || variants.length < 2) return;
    const currentIndex = variants.findIndex(item => item.src === lightboxImage.src);
    const nextIndex = (currentIndex + direction + variants.length) % variants.length;
    const nextVariant = variants[nextIndex];
    if (!nextVariant) return;
    setLightboxImage({
      src: nextVariant.src,
      alt: concept.illustration.alt,
      caption: nextVariant.caption,
    });
  };
  const prefix = `article-${concept.id}`;
  const renderText = (text: string): ReactNode => text.split(/(\[\d+\])/g).map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) return <Fragment key={index}>{part}</Fragment>;
    const number = Number(match[1]);
    const source = content.sources[number - 1];
    return source ? <sup key={index}><a className="ar-citation" href={`#${prefix}-source-${number}`} onClick={event => { event.preventDefault(); document.getElementById(`${prefix}-source-${number}`)?.focus(); }} aria-label={t("Referencia {0}: {1}", number, source.title)}>[{number}]</a></sup> : null;
  });
  let paragraphIndex = 0;
  return <>
    <article className="ar-reader" lang={locale} data-locale={locale} aria-labelledby={`${prefix}-title`}>
      <header className="ar-header">
        <p className="ar-time">{content.readingMinutes} {t("min de lectura")}{content.blocks.some(block => block.kind === 'note') ? t(" · Notas para profundizar") : ''}</p>
        <h3 id={`${prefix}-title`}>{content.title}</h3>
        <p className="ar-lead">{content.lead}</p>
      </header>
      {content.blocks.map((block, index) => {
        if (block.kind === 'heading') return <h4 key={index}>{block.text}</h4>;
        if (block.kind === 'paragraph') return <p className={paragraphIndex++ === 0 ? 'ar-opening' : undefined} key={index}>{renderText(block.text)}</p>;
        if (block.kind === 'note') return <details key={index} className="ar-note"><summary>{block.title}</summary><div>{block.paragraphs.map((paragraph, noteIndex) => <p key={noteIndex}>{renderText(paragraph)}</p>)}</div></details>;
        const variant = variants.find(item => item.id === block.variant);
        return variant ? (
          <figure key={index}>
            <button
              type="button"
              className="ar-image-trigger"
              onClick={() => openLightbox({ src: variant.src, alt: block.caption, caption: block.caption })}
              aria-label={t("Ampliar imagen: {0}", block.caption)}
              data-cursor-label={t("Ampliar imagen")}
            >
              <img src={variant.src} alt={block.caption} loading="lazy" decoding="async" />
            </button>
            <figcaption>{block.caption}</figcaption>
          </figure>
        ) : null;
      })}
      <footer className="ar-sources">
        <h4>{t("Fuentes y caminos para seguir")}</h4>
        <ol>{content.sources.map((source, index) => <li key={source.url} id={`${prefix}-source-${index + 1}`} tabIndex={-1}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a><span>{source.publisher}</span></li>)}</ol>
      </footer>
    </article>
    <AnimatePresence>
      {lightboxImage && (
        <ImageLightbox
          image={lightboxImage}
          onClose={closeLightbox}
          onPrevious={variants.length > 1 ? () => changeLightboxImage(-1) : undefined}
          onNext={variants.length > 1 ? () => changeLightboxImage(1) : undefined}
        />
      )}
    </AnimatePresence>
  </>;
}
