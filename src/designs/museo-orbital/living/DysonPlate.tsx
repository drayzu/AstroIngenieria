import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useLocale } from '../../../i18n/LocaleProvider';
import { livingSignal, starFrame } from './livingHero';

/* Cartela de la obra junto a la estrella, como las del museo: qué se está
   construyendo, cuánto va y para qué. El porcentaje lo avisa la escena; al
   llegar al 100 % la cartela pasa a describir la obra terminada. */
export const DysonPlate = ({ heroRef }: { heroRef: RefObject<HTMLElement | null> }) => {
  const { t } = useLocale();
  const plateRef = useRef<HTMLElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const [complete, setComplete] = useState(false);

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
    livingSignal.onProgress = (percent, rushing) => {
      if (valueRef.current) valueRef.current.textContent = String(percent);
      // Clases por classList y no por className: un render de React las borraría
      plateRef.current?.classList.add('is-on');
      plateRef.current?.classList.toggle('is-rushing', rushing);
      plateRef.current?.classList.toggle('is-complete', percent >= 100);
      // Una nueva ignición vuelve a empezar la obra
      setComplete(percent >= 100);
    };
    return () => {
      livingSignal.onProgress = undefined;
    };
  }, []);

  return (
    <aside className="mo-dyson-plate" ref={plateRef} aria-live="polite">
      <p className="mo-dyson-plate-kicker">
        {complete ? t("Esfera de Dyson · completada") : t("Esfera de Dyson · en construcción")}
      </p>
      <p className="mo-dyson-plate-value">
        <span ref={valueRef}>0</span>
        <span className="mo-dyson-plate-unit">%</span>
        <small>{t("completada")}</small>
        <em className="mo-dyson-plate-rush" aria-hidden="true">{t("acelerando")}</em>
      </p>
      <p className="mo-dyson-plate-note">
        {complete
          ? t("La estrella quedó envuelta: desde fuera solo se ve su calor, en infrarrojo.")
          : t("Una civilización envuelve su estrella para aprovechar toda su energía.")}
      </p>
    </aside>
  );
};
