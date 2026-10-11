import type { ReactNode, RefObject } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { toRoman } from './roomShared';
import './roomHud.css';

/* Cabecera y pie de las salas con escenario fijo: el grupo que se está
   recorriendo, el número de obra y el avance con una marca por grupo */

export const RoomHud = ({
  groupIndex,
  groupTitle,
  current,
  total,
  children,
}: {
  groupIndex: number;
  groupTitle: string;
  current: number;
  total: number;
  children?: ReactNode;
}) => (
  <header className="mo-room-hud" aria-hidden="true">
    <div className="mo-room-hud-group">
      <span className="mo-room-hud-index">{toRoman(groupIndex + 1)}</span>
      <span className="mo-room-hud-title" key={groupIndex}>{groupTitle}</span>
    </div>
    <div className="mo-room-hud-side">
      {children}
      <div className="mo-room-count">
        <span className="mo-room-count-current" key={current}>{String(current + 1).padStart(2, '0')}</span>
        <span className="mo-room-count-total">/ {String(total).padStart(2, '0')}</span>
      </div>
    </div>
  </header>
);

export const RoomProgress = ({
  fillRef,
  ticks,
  groupIndex,
  started,
  onTick,
  marker,
}: {
  fillRef: RefObject<HTMLSpanElement | null>;
  ticks: number[];
  groupIndex: number;
  started: boolean;
  onTick?: (index: number) => void;
  marker?: ReactNode;
}) => {
  const { t } = useLocale();
  return (
    <footer className={`mo-room-foot${started ? ' is-started' : ''}`}>
      <p className="mo-room-hint" aria-hidden="true">
        {t("Sigue bajando: la sala avanza")}
        <span className="mo-room-hint-arrow">→</span>
      </p>
      <div className="mo-room-progress">
        <span className="mo-room-progress-fill" ref={fillRef} />
        {ticks.map((tick, index) => (
          <button
            type="button"
            key={index}
            className={`mo-room-tick${index <= groupIndex ? ' is-passed' : ''}`}
            style={{ left: `${(tick * 100).toFixed(3)}%` }}
            onClick={() => onTick?.(index)}
            tabIndex={-1}
            aria-hidden="true"
          />
        ))}
        {marker}
      </div>
    </footer>
  );
};
