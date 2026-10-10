import { memo, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { smoothScrollTo } from '../shared/smoothScroll';
import type { AstroConcept } from '../../types';
import type { CorridorKind } from './salaRooms';
import { RoomHud, RoomProgress } from './RoomHud';
import { CorridorScene, type SceneParts } from './corridorScenes';
import { clamp, clamp01, offsetWithin, skyDrift, smoothstep, toRoman, useRoomLoop, wallGain } from './roomShared';
import './galleryCorridor.css';

/* Pasillo de galería: el escenario queda fijo (sticky) y el scroll vertical
   desliza la pared hacia el lado. Tres pasillos con carácter propio:

   - acceleration (Viaje interestelar): cada grupo avanza más rápido que el
     anterior, el frenado desacelera la pared y la velocidad real trae
     Doppler en los bordes y una leve contracción de las obras
   - horizon (Ingeniería planetaria): las obras se paran sobre el borde
     curvo de un planeta que se terraforma mientras avanzas
   - kardashev (Civilizaciones): la pared envuelve al visitante y al fondo la
     escala crece de planeta a estrella, galaxia y tiempo profundo

   La geometría se mide al cambiar de tamaño; en cada cuadro solo se lee el
   scroll y se escriben transformaciones. */

// Píxeles de pared por píxel de scroll a velocidad base: acorta el recorrido
const WALL_SPEED = 1.55;
const TABLE_STEP = 8;

// Ritmo de cuelgue: alturas y proporciones alternadas, como un muro de salón
const SHAPES = ['tall', 'wide', 'square', 'wide-low', 'tall', 'square-high', 'wide'] as const;

/* Velocidad relativa de cada obra en Viaje interestelar, grupo por grupo:
   química, eléctrica, nuclear, velas, viaje interestelar (máxima, frenado,
   nave generacional) y especulativas */
const ACCELERATION = [
  [1],
  [1.2, 1.3, 1.4, 1.5],
  [1.65, 1.8, 1.95, 2.1, 2.25],
  [2.3, 2.4, 2.5, 2.6, 2.7],
  [2.95, 1.5, 0.8],
  [1.1, 1.2, 1.3],
];
const MIN_SPEED = 0.8;
const MAX_SPEED = 2.95;

const TURN: Record<CorridorKind, number> = { acceleration: 16, horizon: 0, kardashev: 30 };

export interface CorridorGroup {
  title: string;
  works: { concept: AstroConcept; plate: number }[];
}

interface Piece {
  element: HTMLElement;
  zoom: HTMLElement | null;
  center: number;
  work: number;
}

interface Geometry {
  stageWidth: number;
  travel: number;
  pinned: number;
  /* Scroll acumulado cada TABLE_STEP píxeles de pared */
  table: Float64Array;
  knots: { at: number; speed: number }[];
  pieces: Piece[];
  rimRadius: number;
  ticks: number[];
}

const speedAt = (knots: Geometry['knots'], at: number) => {
  if (knots.length === 0) return 1;
  if (at <= knots[0].at) return knots[0].speed;
  for (let index = 1; index < knots.length; index++) {
    const next = knots[index];
    if (at <= next.at) {
      const previous = knots[index - 1];
      return previous.speed + (next.speed - previous.speed) * ((at - previous.at) / (next.at - previous.at));
    }
  }
  return knots[knots.length - 1].speed;
};

// Pared recorrida para un scroll dado (inversa de la tabla)
const wallAt = (table: Float64Array, offset: number) => {
  if (offset <= 0) return 0;
  let low = 0;
  let high = table.length - 1;
  if (offset >= table[high]) return high * TABLE_STEP;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (table[mid] <= offset) low = mid;
    else high = mid;
  }
  return (low + (offset - table[low]) / (table[high] - table[low] || 1)) * TABLE_STEP;
};

const scrollAt = (table: Float64Array, wall: number) => {
  const position = clamp(wall / TABLE_STEP, 0, table.length - 1);
  const low = Math.floor(position);
  const high = Math.min(table.length - 1, low + 1);
  return table[low] + (table[high] - table[low]) * (position - low);
};

export const GalleryCorridor = memo(({
  kind,
  chapterTitle,
  groups,
  scrollRef,
  renderObra,
}: {
  kind: CorridorKind;
  chapterTitle: string;
  groups: CorridorGroup[];
  scrollRef: RefObject<HTMLDivElement | null>;
  renderObra: (concept: AstroConcept, plate: number, preload: boolean) => ReactNode;
}) => {
  const { t } = useLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const scene = useRef<SceneParts>({});
  const geometry = useRef<Geometry>({
    stageWidth: 1, travel: 0, pinned: 1, table: new Float64Array([0]), knots: [], pieces: [], rimRadius: 1, ticks: [],
  });
  const live = useRef({
    lastWall: Number.NaN,
    velocity: 0,
    reverse: false,
    lateral: false,
    touched: new Set<number>(),
    loaded: new Set<number>(),
    current: -1,
    started: false,
    thrust: 1,
  });
  const [ticks, setTicks] = useState<number[]>([]);
  const [active, setActive] = useState(0);
  const [started, setStarted] = useState(false);
  const [thrust, setThrust] = useState(1);
  // Obras cuyas imágenes ya pueden cargarse: el escenario recorta lo que
  // viene por el costado y la carga por cercanía no alcanzaría a verlas
  const [preloaded, setPreloaded] = useState<ReadonlySet<number>>(() => new Set());

  // Todas las obras en orden de pared, con su grupo y su velocidad
  const works = useMemo(() => groups.flatMap((group, groupIndex) =>
    group.works.map((work, index) => ({
      ...work,
      groupIndex,
      speed: kind === 'acceleration'
        ? ACCELERATION[groupIndex]?.[index] ?? ACCELERATION[groupIndex]?.at(-1) ?? 1
        : 1,
    }))), [groups, kind]);
  const total = works.length;

  const paint = (offset: number) => {
    const { stageWidth, travel, pinned, table, knots, pieces, rimRadius, ticks: tickPositions } = geometry.current;
    const state = live.current;
    const track = trackRef.current;
    if (!track) return;
    const progress = pinned > 0 ? clamp(offset, 0, pinned) / pinned : 0;
    const wall = Math.min(travel, wallAt(table, clamp(offset, 0, pinned)));
    const middle = wall + stageWidth / 2;
    const speed = speedAt(knots, middle);

    track.style.transform = `translate3d(${(-wall).toFixed(1)}px, 0, 0)`;
    fillRef.current?.style.setProperty('transform', `scaleX(${progress.toFixed(4)})`);

    // Velocidad real de la pared, suavizada: alimenta Doppler y contracción
    const step = Number.isNaN(state.lastWall) ? 0 : wall - state.lastWall;
    state.lastWall = wall;
    state.velocity = state.velocity * 0.7 + step * 0.3;
    const beta = clamp01(Math.abs(state.velocity) / 70);

    // Dentro del tramo fijo el cielo también corre de lado
    const lateral = offset > 0 && offset < pinned;
    if (lateral !== state.lateral) {
      state.lateral = lateral;
      skyDrift.lateral = lateral ? 1 : 0;
    }
    if (lateral) {
      skyDrift.gain = WALL_SPEED * speed;
      if (sectionRef.current) wallGain.set(sectionRef.current, WALL_SPEED * speed);
    }

    let nearest = 0;
    let nearestDistance = Infinity;
    let incoming: number[] | null = null;
    const turn = TURN[kind];
    for (let index = 0; index < pieces.length; index++) {
      const piece = pieces[index];
      const delta = piece.center - middle;
      const position = delta / stageWidth;
      const distance = Math.abs(position);
      if (piece.work >= 0) {
        if (distance < 1.6 && !state.loaded.has(piece.work)) {
          state.loaded.add(piece.work);
          (incoming ??= []).push(piece.work);
        }
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = piece.work;
        }
      }
      if (distance > 0.9) {
        if (state.touched.delete(index)) {
          piece.element.style.removeProperty('transform');
          piece.element.style.removeProperty('--focus');
          piece.zoom?.style.removeProperty('translate');
        }
        continue;
      }
      state.touched.add(index);

      let transform: string;
      if (kind === 'horizon') {
        // De pie sobre el borde del planeta: bajan y se inclinan siguiendo la curva
        const along = clamp(delta, -rimRadius * 0.98, rimRadius * 0.98);
        const drop = rimRadius - Math.sqrt(rimRadius * rimRadius - along * along);
        const tilt = (Math.asin(along / rimRadius) * 180) / Math.PI;
        transform = `translate3d(0, ${drop.toFixed(1)}px, 0) rotate(${tilt.toFixed(2)}deg)`;
      } else {
        const angle = clamp(position * 1.6, -1, 1) * -turn;
        // Civilizaciones: lo que queda a los lados está más cerca, envolviéndote
        const near = kind === 'kardashev' ? 1 + Math.min(0.85, distance) * 0.14 : 1;
        // Viaje interestelar: a gran velocidad las obras se contraen en el sentido del viaje
        const squeeze = kind === 'acceleration' ? 1 - beta * beta * 0.16 : 1;
        transform = `perspective(1600px) rotateY(${angle.toFixed(2)}deg) scale(${(near * squeeze).toFixed(4)}, ${near.toFixed(4)})`;
      }
      piece.element.style.transform = transform;
      if (piece.work >= 0) {
        piece.element.style.setProperty('--focus', Math.max(0, 1 - distance * 2.4).toFixed(3));
        piece.zoom?.style.setProperty('translate', `${(-position * 7).toFixed(2)}% 0`);
      }
    }

    paintScene(kind, scene.current, { wall, progress, beta, ticks: tickPositions });
    if (kind === 'acceleration') {
      const reverse = state.velocity < -0.3 ? true : state.velocity > 0.3 ? false : state.reverse;
      if (reverse !== state.reverse) {
        state.reverse = reverse;
        stageRef.current?.classList.toggle('is-reverse', reverse);
      }
      const level = Math.max(1, Math.min(5, Math.round(((speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 4) + 1));
      if (level !== state.thrust) {
        state.thrust = level;
        setThrust(level);
      }
    }

    if (incoming) {
      const added = incoming;
      setPreloaded((previous) => new Set([...previous, ...added]));
    }
    if (nearest !== state.current) {
      state.current = nearest;
      setActive(nearest);
    }
    if (!state.started && progress > 0.015) {
      state.started = true;
      setStarted(true);
    }
  };

  // Al quedar quieto: sin velocidad no hay Doppler ni contracción
  const settle = () => {
    const state = live.current;
    state.velocity = 0;
    state.lastWall = Number.NaN;
    paintScene(kind, scene.current, { wall: Number.NaN, progress: Number.NaN, beta: 0, ticks: [] });
  };

  const refresh = useRoomLoop(sectionRef, scrollRef, (frame) => paint(frame.offset), { onIdle: settle });

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const track = trackRef.current;
    if (!section || !stage || !track) return;

    const measure = () => {
      const stageWidth = stage.clientWidth || 1;
      const stageHeight = stage.clientHeight;
      const elements = Array.from(track.querySelectorAll<HTMLElement>('[data-corridor-piece]'));
      const items = elements.filter((element) => element.dataset.work !== undefined);
      const panels = elements.filter((element) => element.dataset.work === undefined);
      // La pared termina con la última obra en el centro, bajo su foco
      const last = items[items.length - 1];
      if (last) track.style.paddingRight = `${Math.round(Math.max(0, (stageWidth - last.offsetWidth) / 2))}px`;
      // offsetWidth y no scrollWidth: el halo de luz sobresale y no es pared
      const travel = Math.max(0, track.offsetWidth - stageWidth);

      const pieces: Piece[] = elements.map((element) => ({
        element,
        zoom: element.querySelector<HTMLElement>('.mo-frame-zoom'),
        center: offsetWithin(element, track).left + element.offsetWidth / 2,
        work: element.dataset.work === undefined ? -1 : Number(element.dataset.work),
      }));
      const knots = pieces
        .filter((piece) => piece.work >= 0)
        .map((piece) => ({ at: piece.center, speed: works[piece.work]?.speed ?? 1 }));

      const samples = Math.max(2, Math.ceil(travel / TABLE_STEP) + 1);
      const table = new Float64Array(samples);
      for (let index = 1; index < samples; index++) {
        const at = (index - 0.5) * TABLE_STEP + stageWidth / 2;
        table[index] = table[index - 1] + TABLE_STEP / (WALL_SPEED * speedAt(knots, at));
      }
      const pinned = Math.max(1, table[samples - 1]);

      // Cada marca queda donde la cartela de su grupo pasa por el centro
      const tickPositions = travel > 0
        ? panels.map((panel) => {
          const center = offsetWithin(panel, track).left + panel.offsetWidth / 2 - stageWidth / 2;
          return clamp01(scrollAt(table, clamp(center, 0, travel)) / pinned);
        })
        : [];

      // El borde del planeta pasa justo bajo los marcos
      let rimRadius = 1;
      if (kind === 'horizon') {
        rimRadius = stageWidth * (stageWidth < 720 ? 4 : 2.1);
        const frame = items[0]?.querySelector<HTMLElement>('.mo-frame');
        if (frame) {
          const rimTop = offsetWithin(frame, stage).top + frame.offsetHeight;
          stage.style.setProperty('--rim-y', `${Math.round(rimTop)}px`);
          stage.style.setProperty('--rim-r', `${Math.round(rimRadius)}px`);
        }
      }

      geometry.current = { stageWidth, travel, pinned, table, knots, pieces, rimRadius, ticks: tickPositions };
      section.style.height = `${Math.round(pinned + stageHeight)}px`;
      setTicks(tickPositions);
      refresh();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(track);
    return () => observer.disconnect();
  }, [works, kind, refresh]);

  useLayoutEffect(() => () => {
    if (live.current.lateral) skyDrift.lateral = 0;
  }, []);

  // Lleva el pasillo hasta un punto de la pared (foco con teclado, marcas)
  const travelTo = (wall: number) => {
    const root = scrollRef.current;
    const section = sectionRef.current;
    if (!root || !section) return;
    const { table, travel } = geometry.current;
    const sectionTop = section.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
    const top = sectionTop + scrollAt(table, clamp(wall, 0, travel));
    if (!smoothScrollTo(top)) root.scrollTo({ top, behavior: 'smooth' });
  };

  const bringIntoView = (work: number) => {
    const piece = geometry.current.pieces.find((item) => item.work === work);
    if (piece) travelTo(piece.center - geometry.current.stageWidth / 2);
  };

  const jumpToGroup = (group: number) => {
    const { pinned, table, ticks: tickPositions } = geometry.current;
    travelTo(wallAt(table, (tickPositions[group] ?? 0) * pinned));
  };

  const activeGroup = works[active]?.groupIndex ?? 0;

  let workIndex = 0;
  return (
    <section
      ref={sectionRef}
      className={`mo-corridor is-${kind}`}
      aria-label={t("Pasillo de {0}", chapterTitle)}
    >
      <div className="mo-corridor-stage" ref={stageRef}>
        <CorridorScene kind={kind} chapterTitle={chapterTitle} parts={scene} />

        <RoomHud
          groupIndex={activeGroup}
          groupTitle={groups[activeGroup]?.title ?? ''}
          current={active}
          total={total}
        >
          {kind === 'acceleration' && (
            <span className="mo-thrust">
              {[1, 2, 3, 4, 5].map((level) => <i key={level} className={level <= thrust ? 'is-on' : undefined} />)}
            </span>
          )}
        </RoomHud>

        <div className="mo-corridor-track" ref={trackRef}>
          {groups.map((group, groupIndex) => (
            <div className="mo-corridor-room-block" key={group.title} role="group" aria-label={group.title}>
              <div className="mo-corridor-panel" data-corridor-piece="">
                <span className="mo-corridor-panel-numeral" aria-hidden="true">{toRoman(groupIndex + 1)}</span>
                <h3>{group.title}</h3>
                <p>
                  {group.works.length} {group.works.length === 1 ? t("obra") : t("obras")}
                </p>
              </div>
              {group.works.map(({ concept, plate }) => {
                const index = workIndex++;
                return (
                  <div
                    className={`mo-corridor-work is-${SHAPES[index % SHAPES.length]}`}
                    data-corridor-piece=""
                    data-work={index}
                    key={concept.id}
                    onFocus={() => bringIntoView(index)}
                  >
                    <span className="mo-corridor-light" aria-hidden="true" />
                    {renderObra(concept, plate, preloaded.has(index))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <RoomProgress fillRef={fillRef} ticks={ticks} groupIndex={activeGroup} started={started} onTick={jumpToGroup} />
      </div>
    </section>
  );
});

/* ---------------- Escena de fondo por pasillo ---------------- */

interface SceneFrame {
  wall: number;
  progress: number;
  beta: number;
  ticks: number[];
}

const paintScene = (kind: CorridorKind, parts: SceneParts, frame: SceneFrame) => {
  if (kind === 'acceleration') {
    const doppler = (frame.beta ** 1.4 * 0.9).toFixed(3);
    parts.dopplerLeft?.style.setProperty('opacity', doppler);
    parts.dopplerRight?.style.setProperty('opacity', doppler);
    if (!Number.isNaN(frame.wall)) {
      parts.backdrop?.style.setProperty('transform', `translate3d(${(-frame.wall * 0.28).toFixed(1)}px, 0, 0)`);
    }
    return;
  }
  if (Number.isNaN(frame.progress)) return;

  if (kind === 'horizon') {
    // Del mundo estéril al mundo vivo a lo largo de los cinco grupos
    const life = smoothstep(0.08, 0.92, frame.progress);
    parts.barren?.style.setProperty('opacity', (1 - life * 0.9).toFixed(3));
    parts.living?.style.setProperty('opacity', life.toFixed(3));
    parts.clouds?.style.setProperty('opacity', smoothstep(0.42, 0.95, frame.progress).toFixed(3));
    // Superficie y nubes giran con el planeta, más lento que la pared
    parts.surface?.style.setProperty('transform', `translate3d(${(-((frame.wall * 0.5) % 1200)).toFixed(1)}px, 0, 0)`);
    parts.cloudStrip?.style.setProperty('transform', `translate3d(${(-((frame.wall * 0.3) % 1600)).toFixed(1)}px, 0, 0)`);
    return;
  }

  // kardashev: cada grupo es una escala; al terminar el grupo la cámara se aleja
  const { ticks, progress } = frame;
  const layers = [parts.scalePlanet, parts.scaleStar, parts.scaleGalaxy, parts.scaleDeep];
  let level = 0;
  for (let index = 0; index < ticks.length; index++) {
    const from = ticks[index];
    const to = ticks[index + 1] ?? 1.0001;
    if (progress >= to) {
      level = index + 1;
      continue;
    }
    if (progress >= from) level = index + smoothstep(0.6, 1, (progress - from) / (to - from || 1));
    break;
  }
  level = Math.min(level, layers.length - 1);
  layers.forEach((layer, index) => {
    if (!layer) return;
    const local = level - index;
    layer.style.opacity = clamp01(1 - Math.abs(local)).toFixed(3);
    layer.style.transform = `scale(${(1 - clamp(local, -1, 1) * 0.28).toFixed(4)})`;
  });
};
