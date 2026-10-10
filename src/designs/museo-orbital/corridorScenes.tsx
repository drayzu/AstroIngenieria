import { memo, useMemo, type RefObject } from 'react';
import type { CorridorKind } from './salaRooms';

/* Lo que hay detrás de cada pasillo. Todo es estático: GalleryCorridor solo
   cambia opacidades y transformaciones de estas capas en cada cuadro. */

export type SceneParts = Partial<Record<
  | 'backdrop'
  | 'dopplerLeft'
  | 'dopplerRight'
  | 'barren'
  | 'living'
  | 'clouds'
  | 'surface'
  | 'cloudStrip'
  | 'scalePlanet'
  | 'scaleStar'
  | 'scaleGalaxy'
  | 'scaleDeep',
  HTMLElement | null
>>;

// Pseudoaleatorio estable: luces y estrellas no cambian entre renders
const seeded = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

export const CorridorScene = memo(({
  kind,
  chapterTitle,
  parts,
}: {
  kind: CorridorKind;
  chapterTitle: string;
  parts: RefObject<SceneParts>;
}) => {
  const bind = (key: keyof SceneParts) => (element: HTMLElement | null) => {
    parts.current[key] = element;
  };

  if (kind === 'acceleration') {
    return (
      <>
        <p className="mo-corridor-backdrop" ref={bind('backdrop')} aria-hidden="true">{chapterTitle}</p>
        {/* Doppler: al avanzar, lo que viene se corre al azul y lo que queda al rojo */}
        <span className="mo-doppler is-left" ref={bind('dopplerLeft')} aria-hidden="true" />
        <span className="mo-doppler is-right" ref={bind('dopplerRight')} aria-hidden="true" />
      </>
    );
  }

  if (kind === 'horizon') {
    return (
      <div className="mo-horizon" aria-hidden="true">
        <span className="mo-horizon-air is-barren" ref={bind('barren')} />
        <span className="mo-horizon-air is-living" ref={bind('living')} />
        <div className="mo-horizon-clouds" ref={bind('clouds')}>
          <span className="mo-horizon-cloud-strip" ref={bind('cloudStrip')} />
        </div>
        <div className="mo-horizon-planet">
          <span className="mo-horizon-surface" ref={bind('surface')} />
        </div>
      </div>
    );
  }

  return <KardashevScales bind={bind} />;
});

const KardashevScales = ({ bind }: { bind: (key: keyof SceneParts) => (element: HTMLElement | null) => void }) => {
  const cities = useMemo(() => Array.from({ length: 160 }, (_, index) => {
    // Luces sobre el casquete visible, más densas cerca del borde
    const angle = -Math.PI / 2 + (seeded(index) - 0.5) * 1.1;
    const depth = 1 - seeded(index + 40) ** 2 * 0.16;
    return {
      x: 100 + Math.cos(angle) * 170 * depth,
      y: 262 + Math.sin(angle) * 170 * depth,
      r: 0.12 + seeded(index + 80) * 0.3,
      o: 0.2 + seeded(index + 120) * 0.7,
    };
  }), []);

  const galaxy = useMemo(() => Array.from({ length: 320 }, (_, index) => {
    const arm = index % 2;
    const t = Math.floor(index / 2) / 160;
    const angle = arm * Math.PI + t * Math.PI * 3.3 + (seeded(index) - 0.5) * 0.5;
    const radius = 5 + t * 86 + (seeded(index + 300) - 0.5) * 9;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      r: 0.18 + seeded(index + 600) * 0.4 * (1 - t * 0.5),
      o: 0.25 + (1 - t) * 0.6 * seeded(index + 900),
    };
  }), []);

  const embers = useMemo(() => Array.from({ length: 16 }, (_, index) => ({
    x: (seeded(index + 1000) - 0.5) * 180,
    y: (seeded(index + 1100) - 0.5) * 120,
    r: 0.4 + seeded(index + 1200) * 0.8,
    o: 0.2 + seeded(index + 1300) * 0.5,
  })), []);

  return (
    <div className="mo-scales" aria-hidden="true">
      {/* I · un planeta y las luces de su civilización */}
      <div className="mo-scale is-planet" ref={bind('scalePlanet')}>
        <svg viewBox="0 0 200 200">
          <defs>
            <radialGradient id="mo-scale-planet-fill" cx="50%" cy="0%" r="80%">
              <stop offset="0%" stopColor="#151316" />
              <stop offset="60%" stopColor="#070608" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="262" r="170" fill="url(#mo-scale-planet-fill)" />
          <circle className="mo-scale-rim" cx="100" cy="262" r="170" />
          {cities.map((city, index) => (
            <circle key={index} className="mo-scale-city" cx={city.x} cy={city.y} r={city.r} opacity={city.o} />
          ))}
        </svg>
      </div>

      {/* II · una estrella envuelta en capas de cómputo */}
      <div className="mo-scale is-star" ref={bind('scaleStar')}>
        <span className="mo-scale-sun" />
        <svg viewBox="-100 -100 200 200">
          {[34, 50, 68, 86].map((radius, index) => (
            <ellipse
              key={radius}
              className="mo-scale-shell"
              rx={radius}
              ry={radius * 0.32}
              transform={`rotate(${-14 + index * 9})`}
              opacity={0.75 - index * 0.13}
            />
          ))}
        </svg>
      </div>

      {/* III · una galaxia entera */}
      <div className="mo-scale is-galaxy" ref={bind('scaleGalaxy')}>
        <svg viewBox="-100 -100 200 200">
          <g transform="rotate(-18) scale(1 0.58)">
            <circle className="mo-scale-core" r="14" />
            {galaxy.map((star, index) => (
              <circle key={index} className="mo-scale-star" cx={star.x} cy={star.y} r={star.r} opacity={star.o} />
            ))}
          </g>
        </svg>
      </div>

      {/* IV · tiempo profundo: brasas de estrellas que se apagan */}
      <div className="mo-scale is-deep" ref={bind('scaleDeep')}>
        <svg viewBox="-100 -100 200 200">
          <circle className="mo-scale-ember-glow" r="40" />
          {embers.map((ember, index) => (
            <circle key={index} className="mo-scale-ember" cx={ember.x} cy={ember.y} r={ember.r} opacity={ember.o} />
          ))}
        </svg>
      </div>
    </div>
  );
};
