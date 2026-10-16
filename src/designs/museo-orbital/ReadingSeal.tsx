import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { getCatalog } from '../../i18n/catalog';
import { markRead, readLog } from './readingLog';
import './readingSeal.css';

/* Sello al final de la lectura: llegar hasta aquí enciende la estrella de la
   obra en la constelación del visitante. Antes de llegar es un contorno
   apagado; al asomar entero se enciende (destello, anillo, líneas que se
   abren) y anuncia su lugar en el mapa. Si la obra ya estaba leída, el sello
   aparece encendido y quieto. */

// Lo justo para que se vea encenderse, no aparecer ya encendido
const IGNITE_DELAY_MS = 380;
// Chispas que salen al encenderse, en direcciones apenas irregulares
const SPARKS = [8, 52, 97, 141, 188, 229, 274, 318];

type SealState = 'dark' | 'igniting' | 'lit';

export const ReadingSeal = ({ conceptId }: { conceptId: string }) => {
  const { locale, t } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<SealState>(() => (readLog().includes(conceptId) ? 'lit' : 'dark'));
  const [number, setNumber] = useState(0);
  const total = getCatalog(locale).chapters.reduce((sum, chapter) => sum + chapter.concepts.length, 0);

  useEffect(() => {
    const element = ref.current;
    if (!element || state !== 'dark') return;
    let timer = 0;
    const observer = new IntersectionObserver(([entry]) => {
      window.clearTimeout(timer);
      if (!entry.isIntersecting) return;
      timer = window.setTimeout(() => {
        observer.disconnect();
        if (markRead(conceptId)) setNumber(readLog().length);
        setState('igniting');
      }, IGNITE_DELAY_MS);
    }, {
      root: element.closest('.mo-studio-scroll'),
      threshold: 0.85,
    });
    observer.observe(element);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [conceptId, state]);

  const lit = state !== 'dark';
  return (
    <div ref={ref} className={`mo-seal is-${state}`} role="status" aria-live="polite">
      <div className="mo-seal-mark" aria-hidden="true">
        <i className="mo-seal-rule" />
        <span className="mo-seal-star">
          <svg viewBox="-24 -24 48 48">
            <circle className="mo-seal-ring" r="11" />
            <path
              className="mo-seal-shape"
              d="M0 -17 C1.1 -4 4 -1.1 17 0 C4 1.1 1.1 4 0 17 C-1.1 4 -4 1.1 -17 0 C-4 -1.1 -1.1 -4 0 -17Z"
            />
            <circle className="mo-seal-core" r="2.1" />
          </svg>
          {state === 'igniting' && SPARKS.map((angle, index) => (
            <i key={index} className="mo-seal-spark" style={{ '--angle': `${angle}deg`, '--delay': `${(index % 3) * 40}ms` } as CSSProperties} />
          ))}
        </span>
        <i className="mo-seal-rule" />
      </div>
      <p className="mo-seal-title">
        {state === 'igniting' && number > 0
          ? t('Nueva estrella en tu constelación')
          : lit
            ? t('Esta estrella ya brilla en tu constelación')
            : t('Llega al final para encender esta estrella')}
      </p>
      {state === 'igniting' && number > 0 && (
        <p className="mo-seal-meta">{t('Estrella {0} de {1} · ya está en el mapa del museo', number, total)}</p>
      )}
    </div>
  );
};
