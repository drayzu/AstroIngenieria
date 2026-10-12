import { memo, useMemo, type CSSProperties, type RefObject } from 'react';
import type { CorridorKind } from './salaRooms';

/* Lo que hay detrás de cada pasillo. Todo es estático: GalleryCorridor solo
   cambia opacidades y transformaciones de estas capas en cada cuadro. */

type ScenePart = HTMLElement | SVGElement | null;

export type SceneParts = Partial<Record<
  | 'backdrop'
  | 'streaks'
  | 'dopplerLeft'
  | 'dopplerRight'
  | 'barren'
  | 'living'
  | 'clouds'
  | 'sky'
  | 'terrain'
  | 'night'
  | 'cloudStrip'
  | 'sun'
  | 'dawn'
  | 'groundBarren'
  | 'groundLiving'
  | 'glint'
  | 'scalePlanet'
  | 'scaleStar'
  | 'scaleGalaxy'
  | 'scaleDeep'
  | 'satellites'
  | 'cities'
  | 'galaxySpin'
  | 'embers'
  | 'hole'
  | 'flash',
  ScenePart
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
  const bind = (key: keyof SceneParts) => (element: ScenePart) => {
    parts.current[key] = element;
  };

  if (kind === 'acceleration') {
    return (
      <>
        <p className="mo-corridor-backdrop" ref={bind('backdrop')} aria-hidden="true">{chapterTitle}</p>
        {/* Estrellas que pasan: casi quietas en reposo, estelas largas a toda velocidad */}
        <span className="mo-speed-streaks" ref={bind('streaks')} aria-hidden="true" />
        {/* Doppler: al avanzar, lo que viene se corre al azul y lo que queda al rojo */}
        <span className="mo-doppler is-left" ref={bind('dopplerLeft')} aria-hidden="true" />
        <span className="mo-doppler is-right" ref={bind('dopplerRight')} aria-hidden="true" />
      </>
    );
  }

  if (kind === 'horizon') return <HorizonScene bind={bind} />;

  return <KardashevScales bind={bind} />;
});

type Bind = (key: keyof SceneParts) => (element: ScenePart) => void;

/* Ingeniería planetaria: de noche sobre Marte; el sol sale con la
   terraformación, la luz barre el suelo, el mar llena las tierras bajas y la
   tierra firme reverdece. El suelo es el relieve real de Marte, que gira con
   la pared (ver marsGround) */
const HorizonScene = ({ bind }: { bind: Bind }) => (
  <div className="mo-horizon" aria-hidden="true">
    {/* El cielo de día: la atmósfera nueva dispersa la luz y apaga las estrellas */}
    <span className="mo-horizon-sky" ref={bind('sky')} />
    {/* Amanecer: el sol asoma tras el borde a medida que el mundo despierta */}
    <span className="mo-horizon-dawn" ref={bind('dawn')} />
    <span className="mo-horizon-sun" ref={bind('sun')}>
      <span className="mo-horizon-sun-flare" />
    </span>
    <span className="mo-horizon-air is-barren" ref={bind('barren')} />
    <span className="mo-horizon-air is-living" ref={bind('living')} />
    <div className="mo-horizon-clouds" ref={bind('clouds')}>
      <span className="mo-horizon-cloud-strip" ref={bind('cloudStrip')} />
    </div>
    <div className="mo-horizon-planet">
      <div className="mo-horizon-ground">
        <canvas className="mo-horizon-mars" ref={bind('terrain')} />
        {/* La noche se retira de derecha a izquierda cuando sale el sol */}
        <span className="mo-horizon-night" ref={bind('night')} />
      </div>
      {/* Bruma en el limbo: polvo oxidado que se vuelve aire azul */}
      <span className="mo-horizon-limb is-barren" ref={bind('groundBarren')} />
      <span className="mo-horizon-limb is-living" ref={bind('groundLiving')} />
    </div>
    {/* Con océanos, el sol se refleja en el agua bajo el horizonte */}
    <span className="mo-horizon-glint" ref={bind('glint')} />
  </div>
);

/* Cada pieza de una escala aparece cuando el avance del grupo (--grow, que
   escribe GalleryCorridor) pasa su umbral --t: la civilización se construye
   con el scroll. --o es su opacidad final */
const grows = (t: number, o = 1) => ({ '--t': t.toFixed(3), '--o': o.toFixed(3) }) as CSSProperties;

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

const KardashevScales = ({ bind }: { bind: (key: keyof SceneParts) => (element: ScenePart) => void }) => {
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
      const offset = gauss(index);
      const angle = region + offset * 0.1;
      const depth = 1 - seeded(index + 40) ** 1.6 * 0.2;
      // Cada región se enciende desde su centro hacia afuera, una tras otra
      const t = (index % regions.length) * 0.06 + Math.abs(offset) * 0.42 + seeded(index + 160) * 0.18;
      return { ...at(angle, 170 * depth), r: 0.12 + seeded(index + 80) * 0.32, o: 0.25 + seeded(index + 120) * 0.75, t };
    });
    // Tipo I: al final la red de luces cubre toda la cara del planeta
    const spread = Array.from({ length: 320 }, (_, index) => {
      const angle = -Math.PI / 2 + gauss(index + 500) * 1.15;
      const depth = 0.12 + seeded(index + 540) * 0.88;
      const t = 0.32 + (1 - depth) * 0.3 + seeded(index + 580) * 0.12;
      return { ...at(angle, 170 * depth), r: 0.1 + seeded(index + 620) * 0.26, o: 0.2 + seeded(index + 660) * 0.6, t };
    });
    cities.push(...spread);
    // Rutas: arcos tenues que saltan entre regiones por encima de la superficie
    const routes = regions.slice(0, -1).map((region, index) => {
      const from = at(region, 168);
      const to = at(regions[index + 1], 168);
      const lift = at((region + regions[index + 1]) / 2, 188);
      return `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${lift.x.toFixed(1)} ${lift.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
    });
    const satellites = Array.from({ length: 70 }, (_, index) => {
      const angle = -Math.PI / 2 + (seeded(index + 200) - 0.5) * 1.5;
      return { ...at(angle, 181 + gauss(index + 250) * 2.4), o: 0.3 + seeded(index + 300) * 0.6, t: 0.2 + seeded(index + 350) * 0.75 };
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
        // Se construye de adentro hacia afuera, cúmulo por cúmulo
        t: orbitIndex * 0.17 + (clump / 7) * 0.12 + seeded(seed + 50) * 0.2,
      };
    });
    return { ...orbit, panels, t: orbitIndex * 0.17 };
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
        reached: 0,
      };
    });
    // La colonización parte de un sistema en un brazo y se ramifica por la
    // galaxia: cada colonia nueva se enlaza con la más cercana ya fundada
    const angle = 0.36 * WINDING;
    const origin = { x: Math.cos(angle) * 35, y: Math.sin(angle) * 35 };
    const reach = (x: number, y: number) => Math.hypot(x - origin.x, y - origin.y) / 135;
    stars.forEach((star) => {
      star.reached = reach(star.x, star.y);
    });
    const picked = stars
      .filter((star, index) => index % 23 === 0 && Math.hypot(star.x, star.y) > 14)
      .map((star) => ({ x: star.x, y: star.y, t: star.reached }));
    const colonies = [{ ...origin, t: 0 }, ...picked].sort((a, b) => a.t - b.t);
    const links = colonies.slice(1).map((colony, index) => {
      const founded = colonies.slice(0, index + 1);
      const parent = founded.reduce((best, other) =>
        Math.hypot(other.x - colony.x, other.y - colony.y) < Math.hypot(best.x - colony.x, best.y - colony.y) ? other : best);
      return {
        d: `M ${parent.x.toFixed(1)} ${parent.y.toFixed(1)} L ${colony.x.toFixed(1)} ${colony.y.toFixed(1)}`,
        t: colony.t - 0.03,
      };
    });
    return { stars, colonies, links };
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
      // Momento del tiempo profundo en que se apaga
      fade: 0.15 + seeded(index + 1500) * 0.8,
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
            {/* Iluminado desde arriba: el borde se apaga hacia el lado de noche */}
            <linearGradient id="mo-scale-planet-lit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="35%" stopColor="#fff" stopOpacity="0.5" />
              <stop offset="80%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id="mo-scale-planet-shade" maskContentUnits="userSpaceOnUse">
              <rect x="-200" y="60" width="600" height="420" fill="url(#mo-scale-planet-lit)" />
            </mask>
          </defs>
          <g mask="url(#mo-scale-planet-shade)">
            <circle className="mo-scale-atmosphere" cx="100" cy="262" r="172" />
          <circle cx="100" cy="262" r="170" fill="url(#mo-scale-planet-fill)" />
          {/* Paralelos: dan volumen al casquete */}
          <g clipPath="url(#mo-scale-planet-clip)">
            {[150, 122, 90].map((radius) => (
              <ellipse key={radius} className="mo-scale-graticule" cx="100" cy={262 - Math.sqrt(170 * 170 - radius * radius)} rx={radius} ry={radius * 0.16} />
            ))}
          </g>
            <circle className="mo-scale-rim" cx="100" cy="262" r="170" />
            <circle className="mo-scale-orbit" cx="100" cy="262" r="181" />
          </g>
          {/* El planeta gira bajo la cámara y los satélites lo adelantan */}
          <g ref={bind('cities')}>
            {planet.routes.map((route, index) => (
              <path key={route} className="mo-scale-route" d={route} style={grows(0.35 + index * 0.12, 0.45)} />
            ))}
            {planet.cities.map((city, index) => (
              <circle key={index} className="mo-scale-city" cx={city.x} cy={city.y} r={city.r} style={grows(city.t, city.o)} />
            ))}
          </g>
          <g ref={bind('satellites')}>
            {planet.satellites.map((satellite, index) => (
              <circle key={index} className="mo-scale-satellite" cx={satellite.x} cy={satellite.y} r="0.28" style={grows(satellite.t, satellite.o)} />
            ))}
          </g>
        </svg>
      </div>

      {/* II · una estrella envuelta por un enjambre de colectores */}
      <div className="mo-scale is-star" ref={bind('scaleStar')}>
        <svg viewBox="-100 -100 200 200">
          <defs>
            {/* Calor residual: lo que el enjambre no aprovecha sale en infrarrojo */}
            <radialGradient id="mo-scale-sun-waste">
              <stop offset="0%" stopColor="#ff6a3c" stopOpacity="0.35" />
              <stop offset="55%" stopColor="#c8362a" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#c8362a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="mo-scale-sun-glow">
              <stop offset="0%" stopColor="#fffaf0" stopOpacity="0.9" />
              <stop offset="12%" stopColor="#ffe9cc" stopOpacity="0.55" />
              <stop offset="35%" stopColor="currentColor" stopOpacity="0.16" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* La estrella se apaga a medida que el enjambre capta su luz */}
          <circle className="mo-scale-sun-waste" r="88" fill="url(#mo-scale-sun-waste)" />
          <circle className="mo-scale-sun-glow" r="42" fill="url(#mo-scale-sun-glow)" />
          {/* Mitades traseras primero: la estrella las tapa */}
          {swarm.map((orbit) => (
            <g key={`back-${orbit.rx}`} transform={`rotate(${orbit.tilt})`} className="is-back">
              <path className="mo-scale-swarm-orbit" d={backArc(orbit.rx, orbit.ry)} style={grows(orbit.t, 0.3)} />
              {orbit.panels.filter((panel) => panel.back).map((panel, index) => (
                <circle key={index} className="mo-scale-panel" cx={panel.x} cy={panel.y} r={panel.r} style={grows(panel.t, panel.o)} />
              ))}
            </g>
          ))}
          <circle className="mo-scale-sun-disc" r="3.6" />
          {swarm.map((orbit) => (
            <g key={`front-${orbit.rx}`} transform={`rotate(${orbit.tilt})`}>
              <path className="mo-scale-swarm-orbit" d={frontArc(orbit.rx, orbit.ry)} style={grows(orbit.t, 0.3)} />
              {orbit.panels.filter((panel) => !panel.back).map((panel, index) => (
                <circle key={index} className="mo-scale-panel" cx={panel.x} cy={panel.y} r={panel.r} style={grows(panel.t, panel.o)} />
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
            <g ref={bind('galaxySpin')}>
            {galaxy.stars.map((star, index) => (
              <circle
                key={index}
                className={star.warm ? 'mo-scale-star is-warm' : 'mo-scale-star'}
                cx={star.x}
                cy={star.y}
                r={star.r}
                opacity={star.o}
                style={grows(star.reached)}
              />
            ))}
            {galaxy.links.map((link) => (
              <path key={link.d} className="mo-scale-network" d={link.d} style={grows(link.t, 0.85)} />
            ))}
            {/* Cada colonia: un punto encendido y un pulso al fundarse */}
            {galaxy.colonies.map((colony, index) => (
              <g key={index} style={grows(colony.t)}>
                <circle className="mo-scale-colony-ping" cx={colony.x} cy={colony.y} r="5" />
                <circle className="mo-scale-colony" cx={colony.x} cy={colony.y} r={index ? 0.9 : 1.6} />
              </g>
            ))}
            </g>
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
            <radialGradient id="mo-scale-flash">
              <stop offset="0%" stopColor="#fff" stopOpacity="1" />
              <stop offset="25%" stopColor="#ffe6cc" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#ffb07a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="mo-scale-hole-glow">
              <stop offset="0%" stopColor="#ffb07a" stopOpacity="0.4" />
              <stop offset="45%" stopColor="#ff7a48" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#ff5a30" stopOpacity="0" />
            </radialGradient>
            <filter id="mo-scale-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.9" />
            </filter>
            <linearGradient id="mo-scale-disk" x1="0" x2="1">
              <stop offset="0%" stopColor="#ff8a5c" stopOpacity="0.15" />
              <stop offset="35%" stopColor="#ffd2a8" stopOpacity="0.9" />
              <stop offset="65%" stopColor="#ffb98a" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#ff7a50" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          {/* Las brasas se apagan una a una mientras avanza el tiempo profundo */}
          <g ref={bind('embers')}>
            {embers.map((ember, index) => (
              <g key={index} data-fade={ember.dead ? 0 : ember.fade} data-glow={ember.o}>
                <circle className="mo-scale-dwarf" cx={ember.x} cy={ember.y} r={ember.r} />
                {!ember.dead && (
                  <g className="mo-scale-ember-light" opacity={ember.o}>
                    <circle cx={ember.x} cy={ember.y} r={ember.r * 4} fill="url(#mo-scale-ember-halo)" />
                    <circle className="mo-scale-ember" cx={ember.x} cy={ember.y} r={ember.r} />
                  </g>
                )}
              </g>
            ))}
          </g>
          {/* Agujero negro: disco detrás, sombra, anillo de fotones, disco delante y su imagen curvada por encima */}
          {/* Al final se evapora: un último destello y nada */}
          <circle className="mo-scale-flash" r="40" fill="url(#mo-scale-flash)" opacity="0" ref={bind('flash')} />
          <g transform="rotate(-8)">
          <g ref={bind('hole')}>
            <circle r="34" fill="url(#mo-scale-hole-glow)" />
            {/* Cada trazo del disco va dos veces: un halo difuso y su línea nítida */}
            <path className="mo-scale-disk is-halo" d={backArc(44, 7.5)} filter="url(#mo-scale-soft)" />
            <path className="mo-scale-disk" d={backArc(44, 7.5)} />
            <circle className="mo-scale-hole" r="13" />
            <circle className="mo-scale-photon is-halo" r="13.8" filter="url(#mo-scale-soft)" />
            <circle className="mo-scale-photon" r="13.8" />
            {/* El disco de atrás, curvado por la gravedad, asoma por encima y por debajo */}
            <path className="mo-scale-lensed is-halo" d={backArc(21, 19.5)} filter="url(#mo-scale-soft)" />
            <path className="mo-scale-lensed" d={backArc(21, 19.5)} />
            <path className="mo-scale-lensed is-under" d={frontArc(17.5, 16)} />
            <path className="mo-scale-disk is-front is-halo" d={frontArc(44, 7.5)} filter="url(#mo-scale-soft)" />
            <path className="mo-scale-disk is-front" d={frontArc(44, 7.5)} />
            {/* Grumos calientes del disco: giran con el scroll */}
            <path className="mo-scale-disk-spots" d={backArc(44, 7.5)} />
            <path className="mo-scale-disk-spots is-front" d={frontArc(44, 7.5)} />
          </g>
          </g>
        </svg>
      </div>
    </div>
  );
};
