import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { LanguageSwitch } from '../../i18n/LanguageSwitch';
import { useLocale } from '../../i18n/LocaleProvider';
import { getCatalog } from '../../i18n/catalog';
import { useScrollLock } from '../shared/useScrollLock';
import {
  closeStarMap,
  focusStarMap,
  hitStarMap,
  lastPointer,
  openStarMap,
  prepareStarMapLabels,
  updateStarMap,
  warpTo,
  whenStarMapReady,
  type StarMapPoint,
  type StarMapSetup,
} from './chapterWarp';
import type { MapRegion } from './starMap';
import './starMap.css';

/* Índice del museo como mapa estelar. La lista sigue siendo la de siempre
   (botones reales, teclado, lectores de pantalla, Escape, idioma); detrás,
   el lienzo del salto dibuja el recorrido como una galaxia. Señalar un
   capítulo en la lista o su estrella en el mapa es lo mismo, y elegirlo
   zambulle la cámara en la estrella: el hiperespacio sigue sin corte.

   Vive en <body>, fuera de .mo-root: abrirlo y cerrarlo no despierta a los
   observadores del museo, y queda por encima del lienzo del salto. */

const EXIT_MS = 300;
const DIVE_EXIT_MS = 190;
const HERO_COLOR = '#f2a35e';
const END_COLOR = '#c9a86a';
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

type Props = {
  open: boolean;
  activeId: string | null;
  onClose: () => void;
  onGo: (targetId: string) => void;
};

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Portada, capítulos y, al final, vitrina y archivo: los puntos del mapa
const useMapPoints = () => {
  const { locale, t } = useLocale();
  const { chapters } = getCatalog(locale);
  const points = useMemo((): StarMapPoint[] => [
    { number: '', title: t('Inicio'), color: HERO_COLOR },
    ...chapters.map((chapter) => ({ number: chapter.number.padStart(2, '0'), title: chapter.title, color: chapter.color })),
    { number: '✦', title: t('Vitrina y archivo'), color: END_COLOR },
  ], [chapters, t]);
  return { points, chapters, t, hereLabel: t('Estás aquí') };
};

/* La región del mapa se lee de un IntersectionObserver: llega ya medida
   después del diseño del cuadro, sin forzarlo a mitad del clic */
const measureRegion = (element: Element | null, then: (region: MapRegion | null) => void) => {
  if (!element) return () => {};
  const observer = new IntersectionObserver(([entry]) => {
    observer.disconnect();
    const box = entry.boundingClientRect;
    then(box.width >= 2 && box.height >= 2 ? { x: box.left, y: box.top, w: box.width, h: box.height } : null);
  });
  observer.observe(element);
  return () => observer.disconnect();
};

const MenuPanel = ({ open, activeId, onClose, onGo, onExited }: Props & { onExited: () => void }) => {
  const { points, chapters, t, hereLabel } = useMapPoints();
  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  // Botón de cada punto del mapa (portada sin botón; vitrina y archivo comparten el último)
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const leaving = useRef<'close' | 'dive' | null>(null);
  const hot = useRef(-1);
  const blurTimer = useRef(0);
  const regionRef = useRef<MapRegion | null>(null);
  // Se asume que habrá mapa: si no puede abrirse, el fondo liso entra con un fundido
  const [mapped, setMapped] = useState(true);
  // Quien abrió el índice recupera el foco si se cierra sin viajar
  const [opener] = useState(() => document.activeElement);
  const [cursor] = useState(() => window.matchMedia('(pointer: fine)').matches && !reducedMotion());

  useScrollLock(true);

  const endPoint = points.length - 1;
  const chapterIndex = chapters.findIndex((chapter) => chapter.id === activeId);
  const here = activeId === 'vitrina' || activeId === 'archivo' ? endPoint : chapterIndex + 1;

  const setup = useCallback((): StarMapSetup | null => {
    const region = regionRef.current;
    return region ? { points, here, hereLabel, region } : null;
  }, [points, here, hereLabel]);
  const setupRef = useRef(setup);
  useLayoutEffect(() => {
    setupRef.current = setup;
  }, [setup]);

  /* ---- Apertura: el mapa llega en el lienzo y la lista entra deslizándose ---- */
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (cursorRef.current && lastPointer.x >= 0) {
      cursorRef.current.style.transform = `translate(${lastPointer.x}px, ${lastPointer.y}px)`;
      cursorRef.current.classList.add('has-moved');
    }
    const quiet = reducedMotion();
    const fade = (element: Element | null, delay: number, shift = 0) => element?.animate(
      quiet
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, transform: `translateX(${-shift}px)` }, { opacity: 1, transform: 'none' }],
      { duration: quiet ? 200 : 560, delay: quiet ? 0 : delay, easing: EASE, fill: 'backwards' },
    );
    fade(root.querySelector('.mo-menu-shade'), 0);
    fade(root.querySelector('.mo-menu-head'), 40);
    fade(root.querySelector('.mo-menu-body h2'), 90, 10);
    root.querySelectorAll('.mo-menu-list li').forEach((item, index) => fade(item, 130 + index * 32, 16));

    let stopWaiting = () => {};
    const stopMeasuring = measureRegion(mapRef.current, (region) => {
      // Ya con el diseño hecho, el foco no fuerza nada
      closeRef.current?.focus({ preventScroll: true });
      regionRef.current = region;
      if (leaving.current) return;
      const first = setupRef.current();
      if (first && openStarMap(first)) {
        setMapped(true);
        return;
      }
      // Sin mapa todavía: un fondo liso cubre el museo mientras tanto
      setMapped(false);
      root.querySelector('.mo-menu-backdrop')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280 });
      // Primera apertura antes de que el dibujante esté listo: el mapa llega después
      stopWaiting = whenStarMapReady(() => {
        if (leaving.current) return;
        const next = setupRef.current();
        if (next && openStarMap(next)) setMapped(true);
      });
    });
    return () => {
      stopMeasuring();
      stopWaiting();
    };
  }, []);

  // Cambió el idioma o el lugar actual mientras está abierto: rótulos nuevos
  const firstSync = useRef(true);
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    const next = setupRef.current();
    if (next) updateStarMap(next);
  }, [setup]);

  useEffect(() => {
    let stop = () => {};
    const onResize = () => {
      stop();
      stop = measureRegion(mapRef.current, (region) => {
        if (!region) return;
        regionRef.current = region;
        const next = setupRef.current();
        if (next) updateStarMap(next);
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      stop();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (leaving.current) return;
      // M lo abrió desde el museo; la misma tecla lo cierra
      const mapKey = (event.key === 'm' || event.key === 'M')
        && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey;
      if (event.key === 'Escape' || mapKey) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  /* ---- Salida: sin elegir, el mapa se aleja; tras elegir, la zambullida ya va ---- */
  useEffect(() => {
    if (open) return;
    const root = rootRef.current;
    const dive = leaving.current === 'dive';
    leaving.current ??= 'close';
    window.clearTimeout(blurTimer.current);
    if (!dive) {
      closeStarMap();
      if (root?.contains(document.activeElement) && opener instanceof HTMLElement && opener.isConnected) {
        opener.focus({ preventScroll: true });
      }
    }
    const duration = dive ? DIVE_EXIT_MS : EXIT_MS;
    root?.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: 'ease-out', fill: 'forwards' });
    if (dive) {
      root?.querySelector('.mo-menu-body')?.animate(
        [{ transform: 'none' }, { transform: 'translateX(-14px)' }],
        { duration, easing: 'ease-in', fill: 'forwards' },
      );
    }
    const timer = window.setTimeout(onExited, duration + 20);
    return () => window.clearTimeout(timer);
  }, [open, onExited, opener]);

  // Por si se desmonta de golpe (cambio de página): el mapa no queda abierto
  useEffect(() => () => {
    if (leaving.current !== 'dive') closeStarMap();
  }, []);

  /* ---- Señalar: lista y mapa son la misma cosa ---- */
  const setHot = useCallback((index: number, from: 'list' | 'map') => {
    window.clearTimeout(blurTimer.current);
    blurTimer.current = 0;
    if (leaving.current || index === hot.current) return;
    if (from === 'map' || hot.current >= 0) {
      buttons.current[hot.current]?.classList.remove('is-hot');
      if (from === 'map') buttons.current[index]?.classList.add('is-hot');
    }
    hot.current = index;
    focusStarMap(index, buttons.current[index]?.dataset.warpTarget);
  }, []);

  // Al salir de una fila se espera un instante: pasar a la siguiente no vuelve a la vista general
  const releaseHot = useCallback(() => {
    if (blurTimer.current) return;
    blurTimer.current = window.setTimeout(() => setHot(-1, 'list'), 110);
  }, [setHot]);

  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  const choose = (targetId: string, point: number) => {
    if (leaving.current) return;
    const target = document.getElementById(targetId);
    if (mapped && target && !reducedMotion()) {
      // Salto en curso: el clic se ignora, como en el resto de la navegación
      if (!warpTo(target, { fromMap: point })) return;
      leaving.current = 'dive';
      onClose();
      return;
    }
    leaving.current = 'close';
    onGo(targetId);
  };

  /* ---- Puntero sobre el mapa ---- */
  const overList = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest('button, a, .mo-menu-list, .mo-menu-head'));

  const mapHot = () => hot.current >= 0 && Boolean(buttons.current[hot.current]?.classList.contains('is-hot'));

  const onPointerMove = (event: ReactPointerEvent) => {
    let hit = -1;
    if (mapped && !overList(event.target)) {
      hit = hitStarMap(event.clientX, event.clientY, event.pointerType === 'mouse' ? 24 : 30, mapHot() ? hot.current : -1);
      if (hit >= 0) setHot(hit, 'map');
      else if (mapHot()) releaseHot();
    } else if (mapHot() && !(event.target instanceof Element && event.target.closest('.mo-menu-list button'))) {
      releaseHot();
    }
    const element = cursorRef.current;
    if (!element || event.pointerType !== 'mouse') return;
    element.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    element.classList.add('has-moved');
    const control = event.target instanceof Element ? event.target.closest<HTMLElement>('button, a') : null;
    // Sobre una estrella el mapa ya rotula número y título: el cursor solo se anilla
    const label = control?.dataset.cursorLabel ?? '';
    element.classList.toggle('is-active', Boolean(control) || hit >= 0);
    element.classList.toggle('has-label', Boolean(label));
    const text = element.querySelector('span');
    if (text && text.textContent !== label) text.textContent = label;
  };

  const onPointerDown = (event: ReactPointerEvent) => {
    // En pantallas táctiles, tocar una estrella la señala antes de soltar
    if (event.pointerType === 'mouse' || overList(event.target) || !mapped) return;
    const hit = hitStarMap(event.clientX, event.clientY, 30);
    if (hit >= 0) setHot(hit, 'map');
  };

  const onClick = (event: ReactMouseEvent) => {
    if (overList(event.target) || !mapped) return;
    const hit = hitStarMap(event.clientX, event.clientY, 30, mapHot() ? hot.current : -1);
    // Elegir la estrella es pulsar su botón
    if (hit >= 0) buttons.current[hit]?.click();
  };

  // El foco da la vuelta dentro del diálogo
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Tab' || !rootRef.current) return;
    const items = [...rootRef.current.querySelectorAll<HTMLElement>('button:not([disabled])')];
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  const rowProps = (point: number) => ({
    onPointerEnter: (event: ReactPointerEvent) => {
      if (event.pointerType === 'mouse') setHot(point, 'list');
    },
    onPointerLeave: releaseHot,
    onFocus: () => setHot(point, 'list'),
    onBlur: releaseHot,
  });

  return (
    <div
      ref={rootRef}
      className={`mo-menu${mapped ? '' : ' is-plain'}${cursor ? ' has-cursor' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('Mapa del museo')}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerLeave={() => {
        cursorRef.current?.classList.remove('has-moved');
        if (mapHot()) releaseHot();
      }}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <div className="mo-menu-backdrop" aria-hidden="true" />
      <div className="mo-menu-shade" aria-hidden="true" />
      <div ref={mapRef} className="mo-menu-map" aria-hidden="true" />
      <header className="mo-menu-head">
        <p className="mo-kicker">{t('Museo Orbital')}</p>
        <LanguageSwitch />
        <button
          ref={closeRef}
          type="button"
          className="mo-menu-close"
          onClick={onClose}
          data-cursor-label={t('Cerrar')}
        >{t('✕ Cerrar mapa')}</button>
      </header>
      <div className="mo-menu-body">
        <h2>{t('Mapa del recorrido')}</h2>
        <ol className="mo-menu-list">
          {chapters.map((chapter, index) => {
            const point = index + 1;
            const isHere = here === point;
            return (
              <li key={chapter.id}>
                <button
                  ref={(element) => { buttons.current[point] = element; }}
                  type="button"
                  className={isHere ? 'is-here' : undefined}
                  style={{ '--accent': chapter.color } as CSSProperties}
                  data-warp-target={`sala-${chapter.id}`}
                  aria-current={isHere ? 'location' : undefined}
                  onClick={() => choose(`sala-${chapter.id}`, point)}
                  data-cursor-label={t('Capítulo {0}', chapter.number.padStart(2, '0'))}
                  {...rowProps(point)}
                >
                  <b>{chapter.number}</b>
                  <span>
                    {chapter.title}
                    {isHere && <em className="mo-menu-here">{hereLabel}</em>}
                  </span>
                  <i>{chapter.concepts.length}</i>
                </button>
              </li>
            );
          })}
          <li>
            <button
              ref={(element) => { buttons.current[endPoint] = element; }}
              type="button"
              className={`is-extra${activeId === 'vitrina' ? ' is-here' : ''}`}
              style={{ '--accent': END_COLOR } as CSSProperties}
              data-warp-target="vitrina"
              aria-current={activeId === 'vitrina' ? 'location' : undefined}
              onClick={() => choose('vitrina', endPoint)}
              data-cursor-label={t('Comparar')}
              {...rowProps(endPoint)}
            >
              <b>✦</b>
              <span>
                {t('Vitrina de contrastes')}
                {activeId === 'vitrina' && <em className="mo-menu-here">{hereLabel}</em>}
              </span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`is-extra${activeId === 'archivo' ? ' is-here' : ''}`}
              style={{ '--accent': END_COLOR } as CSSProperties}
              data-warp-target="archivo"
              aria-current={activeId === 'archivo' ? 'location' : undefined}
              onClick={() => choose('archivo', endPoint)}
              data-cursor-label={t('Fuentes')}
              {...rowProps(endPoint)}
            >
              <b>§</b>
              <span>
                {t('Sala archivo')}
                {activeId === 'archivo' && <em className="mo-menu-here">{hereLabel}</em>}
              </span>
            </button>
          </li>
        </ol>
      </div>
      {cursor && (
        <div ref={cursorRef} className="mo-cursor mo-menu-cursor" aria-hidden="true">
          <i className="mo-cursor-ring" />
          <span />
        </div>
      )}
    </div>
  );
};

/* Montado solo mientras se ve: la salida se anima antes de desmontar */
export const MenuOverlay = memo(({ open, activeId, onClose, onGo }: Props) => {
  // Los rótulos del mapa se dibujan en un momento ocioso, no al abrir
  const { points, hereLabel } = useMapPoints();
  useEffect(() => {
    if (typeof window.requestIdleCallback !== 'function') return;
    const id = window.requestIdleCallback(() => prepareStarMapLabels(points, hereLabel), { timeout: 9000 });
    return () => window.cancelIdleCallback(id);
  }, [points, hereLabel]);

  const [present, setPresent] = useState(open);
  const [wasOpen, setWasOpen] = useState(open);
  // Cada apertura monta un panel nuevo, aunque el anterior aún se estuviera yendo
  const [instance, setInstance] = useState(0);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPresent(true);
      setInstance((value) => value + 1);
    }
  }
  const onExited = useCallback(() => setPresent(false), []);
  if (!present) return null;
  return createPortal(
    <MenuPanel key={instance} open={open} activeId={activeId} onClose={onClose} onGo={onGo} onExited={onExited} />,
    document.body,
  );
});
