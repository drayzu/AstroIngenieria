import { Boxes, CircleDot, Factory, Globe2, Orbit, Rocket } from 'lucide-react';
import { scaleLabels } from '../data/astroData';
import type { AstroScale } from '../types';

interface ScaleNavigatorProps {
  selectedScale: 'all' | AstroScale;
  onSelectScale: (scale: 'all' | AstroScale) => void;
}

const iconByScale = {
  nave: Rocket,
  habitat: Boxes,
  orbital: Orbit,
  planetaria: Globe2,
  estelar: CircleDot,
  galactica: Factory,
} satisfies Record<AstroScale, typeof Rocket>;

const descriptions = {
  nave: 'vehículos, motores y viajes',
  habitat: 'mundos interiores y soporte vital',
  orbital: 'puertos, redes y acceso',
  planetaria: 'climas, atmósferas y superficies',
  estelar: 'energía, plasma y estrellas',
  galactica: 'civilizaciones, SETI y tiempo profundo',
} satisfies Record<AstroScale, string>;

const scaleOrder = Object.keys(scaleLabels) as AstroScale[];

export function ScaleNavigator({ selectedScale, onSelectScale }: ScaleNavigatorProps) {
  return (
    <div className="scale-navigator" aria-label="Navegador por escala">
      <button
        type="button"
        className={selectedScale === 'all' ? 'scale-chip is-active' : 'scale-chip'}
        onClick={() => onSelectScale('all')}
      >
        <CircleDot aria-hidden="true" />
        <span>Todas las escalas</span>
      </button>
      {scaleOrder.map((scale) => {
        const Icon = iconByScale[scale];
        return (
          <button
            type="button"
            key={scale}
            className={selectedScale === scale ? 'scale-chip is-active' : 'scale-chip'}
            onClick={() => onSelectScale(scale)}
          >
            <Icon aria-hidden="true" />
            <span>{scaleLabels[scale]}</span>
            <small>{descriptions[scale]}</small>
          </button>
        );
      })}
    </div>
  );
}
