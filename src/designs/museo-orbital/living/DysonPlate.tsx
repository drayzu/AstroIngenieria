import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useLocale } from '../../../i18n/LocaleProvider';
import { livingSignal, starFrame } from './livingHero';

/* Cartela de la obra junto a la estrella, como las del museo: qué se está
   construyendo, cuánto va y para qué. El porcentaje lo avisa la escena. */
export const DysonPlate = ({ heroRef }: { heroRef: RefObject<HTMLElement | null> }) => {
  const { t } = useLocale();
  const plateRef = useRef<HTMLElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);

  // Bajo el disco, algo a la derecha; en vertical, centrada bajo la estrella
  useLayoutEffect(() => {
    const plate = plateRef.current;
    // Al montar, el ref del hero aún no está asignado: se busca desde la cartela
    const hero = heroRef.current ?? plate?.closest<HTMLElement>('.mo-hero') ?? null;
    if (!hero || !plate) return;
    const place = () => {
      const width = hero.clientWidth;
      const height = hero.clientHeight;
      const frame = starFrame(width, height);
      const narrow = width < 720 || width / height < 0.9;
      plate.style.setProperty('--plate-x', `${Math.round(narrow ? frame.x : frame.x + frame.r * 0.3)}px`);
      plate.style.setProperty('--plate-y', `${Math.round(frame.y + frame.r * (narrow ? 1.12 : 1.12))}px`);
      plate.style.setProperty('--plate-reach', `${Math.round(frame.r * 0.16)}px`);
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(hero);
    return () => observer.disconnect();
  }, [heroRef]);

  useEffect(() => {
    livingSignal.onProgress = (percent) => {
      if (valueRef.current) valueRef.current.textContent = String(percent);
      plateRef.current?.classList.add('is-on');
    };
    return () => {
      livingSignal.onProgress = undefined;
    };
  }, []);

  return (
    <aside className="mo-dyson-plate" ref={plateRef}>
      <p className="mo-dyson-plate-kicker">{t("Esfera de Dyson · en construcción")}</p>
      <p className="mo-dyson-plate-value">
        <span ref={valueRef}>0</span>
        <span className="mo-dyson-plate-unit">%</span>
        <small>{t("completada")}</small>
      </p>
      <p className="mo-dyson-plate-note">{t("Una civilización envuelve su estrella para aprovechar toda su energía.")}</p>
    </aside>
  );
};
