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

// Desviación aproximadamente normal (suma de uniformes), estable por semilla
const gauss = (seed: number) => (seeded(seed) + seeded(seed + 0.31) + seeded(seed + 0.67) - 1.5) / 1.5;

// Medias elipses: la de atrás pasa por arriba y la de adelante por abajo
const backArc = (rx: number, ry: number) => `M ${-rx} 0 A ${rx} ${ry} 0 0 1 ${rx} 0`;
const frontArc = (rx: number, ry: number) => `M ${rx} 0 A ${rx} ${ry} 0 0 1 ${-rx} 0`;

// Órbitas del enjambre de Dyson: radio, achatamiento y giro de cada anillo
const SWARM = [
  { rx: 26, ry: 8, tilt: -16, panels: 90 },
  { rx: 40, ry: 14, tilt: 10, panels: 130 },
  { rx: 56, ry: 16, tilt: -6, panels: 170 },
  { rx: 76, ry: 27, tilt: 22, panels: 210 },
];

// Vueltas que dan los brazos de la galaxia de su centro al borde
const WINDING = Math.PI * 2.3;

const KardashevScales = ({ bind }: { bind: (key: keyof SceneParts) => (element: HTMLElement | null) => void }) => {
  /* I · Planeta: luces de ciudades, rutas entre ellas y un cinturón de satélites */
  const planet = useMemo(() => {
    const at = (angle: number, radius: number) => ({
      x: 100 + Math.cos(angle) * radius,
      y: 262 + Math.sin(angle) * radius,
    });
    // Las luces se agrupan en regiones, como continentes habitados
    const regions = [-2.02, -1.78, -1.5, -1.24, -1.02];
    const cities = Array.from({ length: 220 }, (_, index) => {
      const region = regions[index % regions.length];
      const angle = region + gauss(index) * 0.1;
      const depth = 1 - seeded(index + 40) ** 1.6 * 0.2;
      return { ...at(angle, 170 * depth), r: 0.12 + seeded(index + 80) * 0.32, o: 0.25 + seeded(index + 120) * 0.75 };
    });
    // Rutas: arcos tenues que saltan entre regiones por encima de la superficie
    const routes = regions.slice(0, -1).map((region, index) => {
      const from = at(region, 168);
      const to = at(regions[index + 1], 168);
      const lift = at((region + regions[index + 1]) / 2, 188);
      return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${lift.x.toFixed(1)} ${lift.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    });
    const satellites = Array.from({ length: 70 }, (_, index) => {
      const angle = -Math.PI / 2 + (seeded(index + 200) - 0.5) * 1.5;
      return { ...at(angle, 181 + gauss(index + 250) * 2.4), o: 0.3 + seeded(index + 300) * 0.6 };
    });
    return { cities, routes, satellites };
  }, []);

  /* II · Estrella: colectores del enjambre, en cúmulos irregulares que se
     dispersan un poco a cada lado de su órbita */
  const swarm = useMemo(() => SWARM.map((orbit, orbitIndex) => {
    const panels = Array.from({ length: orbit.panels }, (_, index) => {
      const seed = orbitIndex * 1000 + index;
      // Cúmulos: el ángulo se concentra alrededor de unos pocos frentes de obra
      const clump = Math.floor(seeded(seed) * 7);
      const theta = (clump / 7) * Math.PI * 2 + orbitIndex + gauss(seed + 10) * 0.55;
      const spread = 1 + gauss(seed + 20) * 0.045;
      return {
        x: orbit.rx * spread * Math.cos(theta),
        y: orbit.ry * spread * Math.sin(theta),
        r: 0.12 + seeded(seed + 30) ** 3 * 0.55,
        o: 0.35 + seeded(seed + 40) * 0.65,
        back: Math.sin(theta) < 0,
      };
    });
    return { ...orbit, panels };
  }), []);

  /* III · Galaxia: brazos espirales, núcleo cálido y la red de quienes la habitan */
  const galaxy = useMemo(() => {
    const stars = Array.from({ length: 1100 }, (_, index) => {
      const arm = index % 2;
      const disk = seeded(index + 2000) < 0.25;
      const t = disk ? seeded(index + 2100) ** 1.4 : seeded(index + 2200) ** 0.85;
      const angle = disk
        ? seeded(index + 2300) * Math.PI * 2
        : arm * Math.PI + t * WINDING + gauss(index + 2400) * (0.1 + t * 0.16);
      const radius = 3 + t * 90 + gauss(index + 2500) * (disk ? 8 : 2 + t * 3);
      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        r: 0.14 + seeded(index + 2600) * (disk ? 0.22 : 0.42) * (1 - t * 0.45),
        o: (disk ? 0.18 : 0.35) + (1 - t) * 0.55 * seeded(index + 2700),
        warm: t < 0.22,
      };
    });
    // Sistemas colonizados a lo largo de un brazo, enlazados entre sí
    const colonies = Array.from({ length: 9 }, (_, index) => {
      const t = 0.3 + index * 0.07;
      const angle = t * WINDING + gauss(index + 2800) * 0.06;
      const radius = 3 + t * 90;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
    const network = colonies.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
    return { stars, colonies, network };
  }, []);

  /* IV · Tiempo profundo: enanas rojas que se apagan alrededor de un agujero negro */
  const embers = useMemo(() => Array.from({ length: 26 }, (_, index) => {
    const angle = seeded(index + 1000) * Math.PI * 2;
    const radius = 30 + seeded(index + 1100) * 64;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.62,
      r: 0.3 + seeded(index + 1200) ** 2 * 1.1,
      o: 0.15 + seeded(index + 1300) * 0.7,
      // Algunas ya son enanas negras: solo queda su contorno
      dead: seeded(index + 1400) < 0.3,
    };
  }), []);

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
            <clipPath id="mo-scale-planet-clip">
              <circle cx="100" cy="262" r="170" />
            </clipPath>
          </defs>
          <circle className="mo-scale-atmosphere" cx="100" cy="262" r="172" />
          <circle cx="100" cy="262" r="170" fill="url(#mo-scale-planet-fill)" />
          {/* Paralelos: dan volumen al casquete */}
          <g clipPath="url(#mo-scale-planet-clip)">
            {[150, 122, 90].map((radius) => (
              <ellipse key={radius} className="mo-scale-graticule" cx="100" cy={262 - Math.sqrt(170 * 170 - radius * radius)} rx={radius} ry={radius * 0.16} />
            ))}
          </g>
          <circle className="mo-scale-rim" cx="100" cy="262" r="170" />
          {planet.routes.map((route) => <path key={route} className="mo-scale-route" d={route} />)}
          {planet.cities.map((city, index) => (
            <circle key={index} className="mo-scale-city" cx={city.x} cy={city.y} r={city.r} opacity={city.o} />
          ))}
          <circle className="mo-scale-orbit" cx="100" cy="262" r="181" />
          {planet.satellites.map((satellite, index) => (
            <circle key={index} className="mo-scale-satellite" cx={satellite.x} cy={satellite.y} r="0.28" opacity={satellite.o} />
          ))}
        </svg>
      </div>

      {/* II · una estrella envuelta por un enjambre de colectores */}
      <div className="mo-scale is-star" ref={bind('scaleStar')}>
        <svg viewBox="-100 -100 200 200">
          <defs>
            <radialGradient id="mo-scale-sun-glow">
              <stop offset="0%" stopColor="#fffaf0" stopOpacity="0.9" />
              <stop offset="12%" stopColor="#ffe9cc" stopOpacity="0.55" />
              <stop offset="35%" stopColor="currentColor" stopOpacity="0.16" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle r="42" fill="url(#mo-scale-sun-glow)" />
          {/* Mitades traseras primero: la estrella las tapa */}
          {swarm.map((orbit) => (
            <g key={`back-${orbit.rx}`} transform={`rotate(${orbit.tilt})`} className="is-back">
              <path className="mo-scale-swarm-orbit" d={backArc(orbit.rx, orbit.ry)} />
              {orbit.panels.filter((panel) => panel.back).map((panel, index) => (
                <circle key={index} className="mo-scale-panel" cx={panel.x} cy={panel.y} r={panel.r} opacity={panel.o} />
              ))}
            </g>
          ))}
          <circle className="mo-scale-sun-disc" r="3.6" />
          {swarm.map((orbit) => (
            <g key={`front-${orbit.rx}`} transform={`rotate(${orbit.tilt})`}>
              <path className="mo-scale-swarm-orbit" d={frontArc(orbit.rx, orbit.ry)} />
              {orbit.panels.filter((panel) => !panel.back).map((panel, index) => (
                <circle key={index} className="mo-scale-panel" cx={panel.x} cy={panel.y} r={panel.r} opacity={panel.o} />
              ))}
            </g>
          ))}
        </svg>
      </div>

      {/* III · una galaxia entera */}
      <div className="mo-scale is-galaxy" ref={bind('scaleGalaxy')}>
        <svg viewBox="-100 -100 200 200">
          <defs>
            <radialGradient id="mo-scale-galaxy-core">
              <stop offset="0%" stopColor="#fff3e2" stopOpacity="0.85" />
              <stop offset="18%" stopColor="#ffd9b0" stopOpacity="0.4" />
              <stop offset="55%" stopColor="currentColor" stopOpacity="0.1" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g transform="rotate(-18) scale(1 0.56)">
            <circle r="34" fill="url(#mo-scale-galaxy-core)" />
            {galaxy.stars.map((star, index) => (
              <circle
                key={index}
                className={star.warm ? 'mo-scale-star is-warm' : 'mo-scale-star'}
                cx={star.x}
                cy={star.y}
                r={star.r}
                opacity={star.o}
              />
            ))}
            <path className="mo-scale-network" d={galaxy.network} />
            {galaxy.colonies.map((colony, index) => (
              <circle key={index} className="mo-scale-colony" cx={colony.x} cy={colony.y} r="1.1" />
            ))}
          </g>
        </svg>
      </div>

      {/* IV · tiempo profundo: brasas de estrellas que se apagan */}
      <div className="mo-scale is-deep" ref={bind('scaleDeep')}>
        <svg viewBox="-100 -100 200 200">
          <defs>
            <radialGradient id="mo-scale-ember-halo">
              <stop offset="0%" stopColor="#ff7a55" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#ff5a3c" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="mo-scale-disk" x1="0" x2="1">
              <stop offset="0%" stopColor="#ff8a5c" stopOpacity="0.15" />
              <stop offset="35%" stopColor="#ffd2a8" stopOpacity="0.9" />
              <stop offset="65%" stopColor="#ffb98a" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#ff7a50" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          {embers.map((ember, index) => ember.dead ? (
            <circle key={index} className="mo-scale-dwarf" cx={ember.x} cy={ember.y} r={ember.r} />
          ) : (
            <g key={index} opacity={ember.o}>
              <circle cx={ember.x} cy={ember.y} r={ember.r * 4} fill="url(#mo-scale-ember-halo)" />
              <circle className="mo-scale-ember" cx={ember.x} cy={ember.y} r={ember.r} />
            </g>
          ))}
          {/* Agujero negro: disco detrás, sombra, anillo de fotones, disco delante y su imagen curvada por encima */}
          <g transform="rotate(-8)">
            <path className="mo-scale-disk" d={backArc(30, 5)} />
            <circle className="mo-scale-hole" r="9" />
            <circle className="mo-scale-photon" r="9.6" />
            {/* El disco de atrás, curvado por la gravedad, asoma por encima y por debajo */}
            <path className="mo-scale-lensed" d={backArc(15, 13.5)} />
            <path className="mo-scale-lensed is-under" d={frontArc(12.5, 11)} />
            <path className="mo-scale-disk is-front" d={frontArc(30, 5)} />
          </g>
        </svg>
      </div>
    </div>
  );
};
