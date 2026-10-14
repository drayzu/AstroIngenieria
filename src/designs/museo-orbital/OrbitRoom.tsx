import { memo, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { smoothScrollTo } from '../shared/smoothScroll';
import type { AstroConcept } from '../../types';
import type { CorridorGroup } from './GalleryCorridor';
import { RoomHud, RoomProgress } from './RoomHud';
import { clamp, clamp01, smoothstep, useRoomLook, useRoomLoop } from './roomShared';
import './orbitRoom.css';

/* Energía estelar: las obras orbitan una estrella. El scroll hace girar la
   órbita y cada obra pasa más lento al frente para leerla. Desde el primer
   tema se lanzan colectores alrededor de la estrella y con cada obra se
   suman más: el enjambre de Dyson se construye a lo largo de la sala. Los
   que pasan por delante tapan el disco y la estrella se apaga en el visible
   hasta que solo queda su resplandor infrarrojo, la luz capturada. */

// Scroll por obra, en alturas de pantalla
const STEP = 0.7;
// Cuánto se frena la órbita al frente: 0 es giro parejo, 1 se detiene
const KEPLER_EASE = 0.55;

/* Órbitas del enjambre en unidades del dibujo (el disco mide ~12 de radio):
   inclinación en el cielo, segundos por vuelta y cuántos colectores caben */
const SWARM_ORBITS = [
  { radius: 17, tilt: -14, speed: 38, count: 14 },
  { radius: 21, tilt: 9, speed: 50, count: 18 },
  { radius: 26, tilt: -4, speed: 64, count: 22 },
  { radius: 31, tilt: 16, speed: 82, count: 26 },
  { radius: 36, tilt: -21, speed: 100, count: 30 },
  { radius: 41, tilt: 4, speed: 124, count: 34 },
];

interface Collector {
  orbit: number;
  angle: number;
  order: number;
}

// Pseudoazar con semilla: el enjambre se arma igual en cada visita
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};

/* Orden de lanzamiento: al azar, pero las órbitas cercanas a la estrella se
   llenan antes que las lejanas */
const SWARM: Collector[] = (() => {
  const random = seeded(5);
  const collectors = SWARM_ORBITS.flatMap((orbit, orbitIndex) =>
    Array.from({ length: orbit.count }, (_, index) => ({
      orbit: orbitIndex,
      angle: ((index + random() * 0.6) / orbit.count) * 360,
      key: random() + orbitIndex * 0.22,
    })));
  return collectors
    .sort((a, b) => a.key - b.key)
    .map(({ orbit, angle }, order) => ({ orbit, angle, order }));
})();

/* Parte del enjambre construida según la obra en que va la sala: la estrella
   parte desnuda y los colectores se lanzan al dejar atrás la primera obra */
const builtShare = (position: number, total: number) =>
  clamp01(position / Math.max(1, total - 1)) ** 1.35;

interface Geometry {
  pinned: number;
  radiusX: number;
  radiusY: number;
  ticks: number[];
}

// Altura de la órbita: el frente baja más de lo que el fondo sube, así las
// obras de atrás quedan junto a la estrella y la de adelante bajo ella
const orbitY = (angle: number, radiusY: number) => {
  const cos = Math.cos(angle);
  return cos * radiusY * (0.72 + 0.28 * cos);
};

export const OrbitRoom = memo(({
  chapterTitle,
  groups,
  scrollRef,
  renderObra,
}: {
  chapterTitle: string;
  groups: CorridorGroup[];
  scrollRef: RefObject<HTMLDivElement | null>;
  renderObra: (concept: AstroConcept, plate: number, preload: boolean) => ReactNode;
}) => {
  const { t } = useLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const spaceRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const starRef = useRef<HTMLSpanElement>(null);
  const infraredRef = useRef<HTMLSpanElement>(null);
  const swarmRef = useRef<HTMLDivElement>(null);
  // Colectores por orden de lanzamiento (cada uno dibujado delante y detrás)
  const collectorRefs = useRef<Element[][]>([]);
  const orbitRefs = useRef<Element[][]>([]);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const geometry = useRef<Geometry>({ pinned: 1, radiusX: 1, radiusY: 1, ticks: [] });
  const live = useRef({ current: -1, started: false, layers: [] as number[], live: false, built: 0 });
  const [ticks, setTicks] = useState<number[]>([]);
  const [path, setPath] = useState('');
  const [active, setActive] = useState(0);
  const [started, setStarted] = useState(false);

  const works = useMemo(() => groups.flatMap((group, groupIndex) =>
    group.works.map((work) => ({ ...work, groupIndex }))), [groups]);
  const total = works.length;

  const paint = (offset: number, viewport: number) => {
    const { pinned, radiusX, radiusY } = geometry.current;
    const state = live.current;
    const progress = clamp01(offset / pinned);
    // Como en una órbita de Kepler, el giro se frena al frente y acelera entre
    // una obra y otra, pero nunca se detiene: el scroll no se siente trabado
    const raw = progress * (total - 1);
    const position = raw - (KEPLER_EASE * Math.sin(raw * Math.PI * 2)) / (Math.PI * 2);

    fillRef.current?.style.setProperty('transform', `scaleX(${progress.toFixed(4)})`);

    for (let index = 0; index < total; index++) {
      const item = itemRefs.current[index];
      if (!item) continue;
      const angle = (index - position) * ((Math.PI * 2) / total);
      const depth = (Math.cos(angle) + 1) / 2;
      const x = Math.sin(angle) * radiusX;
      const y = orbitY(angle, radiusY);
      const scale = 0.28 + 0.72 * depth ** 2.2;
      item.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
      item.style.opacity = (0.2 + 0.8 * depth ** 1.3).toFixed(3);
      item.style.setProperty('--front', smoothstep(0.8, 1, depth).toFixed(3));
      // Por delante o por detrás de la estrella (que está en la capa 15)
      const layer = depth > 0.5 ? 20 + Math.round(depth * 10) : Math.round(depth * 20);
      if (state.layers[index] !== layer) {
        state.layers[index] = layer;
        item.style.zIndex = String(layer);
      }
    }

    // El enjambre crece con cada obra: se lanzan los colectores que faltan
    const share = builtShare(position, total);
    const built = Math.round(share * SWARM.length);
    if (built !== state.built) {
      const from = Math.min(built, state.built);
      const to = Math.max(built, state.built);
      for (let order = from; order < to; order++) {
        collectorRefs.current[order]?.forEach((element) => element.classList.toggle('is-built', order < built));
      }
      state.built = built;
      // Cada órbita se dibuja al recibir su primer colector
      orbitRefs.current.forEach((elements, orbit) => {
        const open = SWARM.some((collector) => collector.orbit === orbit && collector.order < built);
        elements.forEach((element) => element.classList.toggle('is-open', open));
      });
    }

    // La luz capturada: la estrella se apaga en el visible y queda el infrarrojo
    const capture = smoothstep(0.15, 1, share);
    starRef.current?.style.setProperty('opacity', (1 - capture * 0.82).toFixed(3));
    starRef.current?.style.setProperty('transform', `scale(${(1 - capture * 0.16).toFixed(4)})`);
    infraredRef.current?.style.setProperty('opacity', capture.toFixed(3));

    // El enjambre y la estrella solo se animan mientras la sala está a la vista
    const isLive = offset > -viewport && offset < pinned + viewport;
    if (isLive !== state.live) {
      state.live = isLive;
      sectionRef.current?.classList.toggle('is-live', isLive);
    }

    const nearest = Math.round(position);
    if (nearest !== state.current) {
      state.current = nearest;
      setActive(nearest);
    }
    if (!state.started && progress > 0.015) {
      state.started = true;
      setStarted(true);
    }
  };

  useLayoutEffect(() => {
    const swarm = swarmRef.current;
    if (!swarm) return;
    collectorRefs.current = SWARM.map(() => []);
    swarm.querySelectorAll<SVGElement>('[data-order]').forEach((element) => {
      collectorRefs.current[Number(element.dataset.order)].push(element);
    });
    orbitRefs.current = SWARM_ORBITS.map(() => []);
    swarm.querySelectorAll<SVGElement>('[data-orbit]').forEach((element) => {
      orbitRefs.current[Number(element.dataset.orbit)].push(element);
    });
    live.current.built = 0;
  }, []);

  const refresh = useRoomLoop(sectionRef, scrollRef, (frame) => paint(frame.offset, frame.viewport));
  // Mirar alrededor: el escenario se ladea hacia donde mira el visitante
  useRoomLook(sectionRef, stageRef);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const space = spaceRef.current;
    if (!section || !stage || !space) return;

    const measure = () => {
      const stageHeight = stage.clientHeight;
      const width = space.clientWidth;
      const pinned = Math.max(1, (total - 1) * STEP * stageHeight);
      const itemHeight = itemRefs.current[0]?.offsetHeight ?? 300;
      const radiusX = Math.min(width * (width < 720 ? 0.52 : 0.44), 700);
      const radiusY = itemHeight / 2 + Math.min(40, stageHeight * 0.05);
      const groupTicks = groups.map((_, groupIndex) => {
        const first = works.findIndex((work) => work.groupIndex === groupIndex);
        return total > 1 ? first / (total - 1) : 0;
      });
      geometry.current = { pinned, radiusX, radiusY, ticks: groupTicks };
      section.style.height = `${Math.round(pinned + stageHeight)}px`;
      setTicks(groupTicks);
      // Trazo de la órbita, relativo al centro de la estrella
      const points = Array.from({ length: 73 }, (_, index) => {
        const angle = (index / 72) * Math.PI * 2;
        return `${(Math.sin(angle) * radiusX).toFixed(1)},${orbitY(angle, radiusY).toFixed(1)}`;
      });
      setPath(`M${points.join('L')}Z`);
      refresh();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [groups, works, total, refresh]);

  const travelTo = (progress: number) => {
    const root = scrollRef.current;
    const section = sectionRef.current;
    if (!root || !section) return;
    const sectionTop = section.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
    const top = sectionTop + clamp(progress, 0, 1) * geometry.current.pinned;
    if (!smoothScrollTo(top)) root.scrollTo({ top, behavior: 'smooth' });
  };

  const activeGroup = works[active]?.groupIndex ?? 0;

  return (
    <section ref={sectionRef} className="mo-orbit" aria-label={t("Órbita de {0}", chapterTitle)}>
      <div className="mo-orbit-stage" ref={stageRef}>
        <RoomHud
          groupIndex={activeGroup}
          groupTitle={groups[activeGroup]?.title ?? ''}
          current={active}
          total={total}
        />

        <div className="mo-orbit-space" ref={spaceRef}>
          <div className="mo-orbit-center" aria-hidden="true">
            <svg className="mo-orbit-path" overflow="visible">
              <path d={path} />
            </svg>
            <span className="mo-orbit-infrared" ref={infraredRef} />
            <span className="mo-orbit-star" ref={starRef}>
              <span className="mo-sun-corona" />
              <span className="mo-sun-corona is-slow" />
              <span className="mo-sun-wave" />
              <span className="mo-sun-disc">
                <span className="mo-sun-cells" />
                <span className="mo-sun-cells is-counter" />
              </span>
              {/* Protuberancias: arcos de plasma bajos, pegados al borde del disco */}
              <svg className="mo-sun-loops" viewBox="-50 -50 100 100">
                <path className="is-glow" d="M -9.5 -15.3 Q -11.4 -24.5 -5.6 -17.1" />
                <path d="M -9.5 -15.3 Q -11.4 -24.5 -5.6 -17.1" />
                <path className="is-glow is-b" d="M 17.8 2.5 Q 25.1 6.7 16.7 6.7" />
                <path className="is-b" d="M 17.8 2.5 Q 25.1 6.7 16.7 6.7" />
                <path className="is-glow is-c" d="M -12.3 13.2 Q -19.9 16.7 -15.1 9.8" />
                <path className="is-c" d="M -12.3 13.2 Q -19.9 16.7 -15.1 9.8" />
              </svg>
              <span className="mo-sun-flare" />
            </span>
            <div ref={swarmRef}>
              <DysonSwarm side="back" />
              <DysonSwarm side="front" />
            </div>
          </div>

          {works.map(({ concept, plate }, index) => (
            <div
              key={concept.id}
              className="mo-orbit-item"
              ref={(element) => { itemRefs.current[index] = element; }}
              onFocus={() => travelTo(total > 1 ? index / (total - 1) : 0)}
            >
              <span className="mo-orbit-glow" aria-hidden="true" />
              {renderObra(concept, plate, true)}
            </div>
          ))}
        </div>

        <RoomProgress
          fillRef={fillRef}
          ticks={ticks}
          groupIndex={activeGroup}
          started={started}
          onTick={(group) => travelTo(geometry.current.ticks[group] ?? 0)}
        />
      </div>
    </section>
  );
});

/* Media órbita del enjambre: la de atrás va bajo la estrella y muestra la cara
   iluminada de los colectores; la de adelante la cubre y se ve a contraluz.
   El giro es CSS, así ambas mitades quedan sincronizadas */
const DysonSwarm = memo(({ side }: { side: 'back' | 'front' }) => {
  const clipId = useId();
  return (
    <svg className={`mo-swarm is-${side}`} viewBox="-50 -50 100 100" aria-hidden="true">
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <rect x="-60" y={side === 'front' ? 0 : -60} width="120" height="60" />
        </clipPath>
      </defs>
      {SWARM_ORBITS.map((orbit, orbitIndex) => (
        <g key={orbit.radius} transform={`rotate(${orbit.tilt}) scale(1 0.26)`}>
          <g clipPath={`url(#${clipId})`}>
            <g className="mo-swarm-spin" style={{ '--swarm-speed': `${orbit.speed}s` } as CSSProperties}>
              <circle className="mo-swarm-orbit" r={orbit.radius} data-orbit={orbitIndex} />
              {SWARM.filter((collector) => collector.orbit === orbitIndex).map((collector) => (
                <rect
                  key={collector.order}
                  className="mo-swarm-collector"
                  data-order={collector.order}
                  x={-1.7}
                  y={-0.7}
                  width={3.4}
                  height={1.4}
                  transform={`rotate(${collector.angle.toFixed(1)}) translate(${orbit.radius} 0) rotate(90)`}
                />
              ))}
            </g>
          </g>
        </g>
      ))}
    </svg>
  );
});
