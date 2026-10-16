import { memo, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { smoothScrollTo } from '../shared/smoothScroll';
import type { AstroConcept } from '../../types';
import type { CorridorKind } from './salaRooms';
import { RoomHud, RoomProgress } from './RoomHud';
import { CorridorScene, type SceneParts } from './corridorScenes';
import { paintMarsGround } from './marsGround';
import { clamp, clamp01, offsetWithin, skyDrift, smoothstep, toRoman, useRoomLook, useRoomLoop, wallGain } from './roomShared';
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
// (las obras 21:9 son anchas, así la pared no se vuelve eterna)
const WALL_SPEED = 2.1;
const TABLE_STEP = 8;

// Ritmo de cuelgue: todas las obras son 21:9; el muro de salón alterna su
// tamaño y la altura a la que cuelgan
const SHAPES = ['grand', 'mid', 'center', 'low', 'grand', 'high', 'mid'] as const;

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

/* Escala de Kardashev: el grupo que se recorre más lo avanzado en él */
const scaleLevel = (ticks: number[], progress: number) => {
  if (Number.isNaN(progress) || !ticks.length) return 0;
  let level = 0;
  for (let index = 0; index < ticks.length; index++) {
    const from = ticks[index];
    const to = ticks[index + 1] ?? 1;
    if (progress >= from) level = index + clamp01((progress - from) / (to - from || 1));
  }
  return level;
};

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const power10 = (exponent: number) =>
  `10${String(exponent).split('').map((digit) => SUPERSCRIPT[Number(digit)]).join('')}`;

/* Medidor: de la humanidad actual (K ≈ 0,73) a una civilización galáctica
   (K = 3), con su potencia según Sagan, log₁₀ P = 10 K + 6. En el tiempo
   profundo la escala ya no crece y el medidor pasa a contar años */
const KARDASHEV = [0.73, 1, 2, 3];
const kardashevReading = (level: number, years: string) => {
  if (level >= 3) {
    const exponent = Math.round(10 + clamp01(level - 3) * 90);
    return { value: power10(exponent), unit: years };
  }
  const index = Math.floor(level);
  const k = KARDASHEV[index] + (KARDASHEV[index + 1] - KARDASHEV[index]) * (level - index);
  return {
    value: `K ${k.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    unit: `${power10(Math.round(10 * k + 6))} W`,
  };
};

/* Velocímetro: la velocidad relativa del tramo en escala logarítmica, de un
   cohete químico (~10 km/s) a una vela de luz (0,2 c) */
const LIGHT_KMS = 299_792;
const velocityLabel = (speed: number) => {
  const share = clamp01((speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED));
  const ofLight = 10 ** (-4.6 + share * 3.9);
  if (ofLight < 0.005) {
    const kms = ofLight * LIGHT_KMS;
    return { value: Math.round(kms).toLocaleString('es-CL'), unit: 'km/s' };
  }
  const gamma = 1 / Math.sqrt(1 - ofLight * ofLight);
  return {
    value: ofLight.toFixed(ofLight < 0.1 ? 3 : 2).replace('.', ','),
    unit: gamma > 1.0005 ? `c · γ ${gamma.toFixed(3).replace('.', ',')}` : 'c',
  };
};

/* Termómetro y barómetro del mundo que se terraforma: de Marte hoy (−63 °C,
   0,006 atm) a un clima templado como el de la Tierra (15 °C, 1 atm). La
   presión crece en escala logarítmica, como se espesaría el aire */
const terraformLife = (progress: number) => smoothstep(0.08, 0.92, progress);
const atmosphereReading = (life: number) => {
  const celsius = Math.round(-63 + 78 * life);
  const atm = 0.006 ** (1 - life);
  return {
    value: `${celsius < 0 ? '−' : ''}${Math.abs(celsius)} °C`,
    unit: `${atm.toLocaleString('es-CL', { maximumFractionDigits: atm < 0.1 ? 3 : 2, minimumFractionDigits: atm < 0.1 ? 3 : 2 })} atm`,
  };
};

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
  rimTop: number;
  /* Avance en que la cartela de la terraformación pasa frente al sol */
  dawnAt: number;
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
  const velocityRef = useRef<HTMLElement>(null);
  const shipRef = useRef<HTMLSpanElement>(null);
  const velocityUnitRef = useRef<HTMLElement>(null);
  const scene = useRef<SceneParts>({});
  const geometry = useRef<Geometry>({
    stageWidth: 1, travel: 0, pinned: 1, table: new Float64Array([0]), knots: [], pieces: [], rimRadius: 1, rimTop: 0, dawnAt: 0.4, ticks: [],
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
    reading: '',
  });
  const [ticks, setTicks] = useState<number[]>([]);
  const [active, setActive] = useState(0);
  const [started, setStarted] = useState(false);
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
    const { stageWidth, travel, pinned, table, knots, pieces, rimRadius, rimTop, dawnAt, ticks: tickPositions } = geometry.current;
    const state = live.current;
    const track = trackRef.current;
    if (!track) return;
    const progress = pinned > 0 ? clamp(offset, 0, pinned) / pinned : 0;
    const wall = Math.min(travel, wallAt(table, clamp(offset, 0, pinned)));
    const middle = wall + stageWidth / 2;
    const speed = speedAt(knots, middle);

    track.style.transform = `translate3d(${(-wall).toFixed(1)}px, 0, 0)`;
    fillRef.current?.style.setProperty('transform', `scaleX(${progress.toFixed(4)})`);
    shipRef.current?.style.setProperty('--ship-at', progress.toFixed(4));

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

    paintScene(kind, scene.current, { wall, progress, beta, ticks: tickPositions, rimTop, rimRadius, dawnAt });
    const showReading = (reading: { value: string; unit: string }) => {
      const key = reading.value + reading.unit;
      if (key === state.reading) return;
      state.reading = key;
      if (velocityRef.current) velocityRef.current.textContent = reading.value;
      if (velocityUnitRef.current) velocityUnitRef.current.textContent = reading.unit;
    };
    if (kind === 'acceleration') {
      const reverse = state.velocity < -0.3 ? true : state.velocity > 0.3 ? false : state.reverse;
      if (reverse !== state.reverse) {
        state.reverse = reverse;
        stageRef.current?.classList.toggle('is-reverse', reverse);
      }
      showReading(velocityLabel(speed));
    } else if (kind === 'kardashev') {
      showReading(kardashevReading(scaleLevel(tickPositions, progress), t("años")));
    } else {
      showReading(atmosphereReading(terraformLife(progress)));
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
    paintScene(kind, scene.current, { wall: Number.NaN, progress: Number.NaN, beta: 0, ticks: [], rimTop: 0, rimRadius: 1, dawnAt: 0 });
  };

  const refresh = useRoomLoop(sectionRef, scrollRef, (frame) => paint(frame.offset), { onIdle: settle });
  // Mirar alrededor: el escenario se ladea hacia donde mira el visitante
  useRoomLook(sectionRef, stageRef);

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
      let rimTop = 0;
      let dawnAt = 0.4;
      if (kind === 'horizon') {
        rimRadius = stageWidth * (stageWidth < 720 ? 4 : 2.1);
        const frame = items[0]?.querySelector<HTMLElement>('.mo-frame');
        if (frame) {
          rimTop = offsetWithin(frame, stage).top + frame.offsetHeight;
          stage.style.setProperty('--rim-y', `${Math.round(rimTop)}px`);
          stage.style.setProperty('--rim-r', `${Math.round(rimRadius)}px`);
          // El sol sale hacia un costado, donde el borde ya baja e inclina
          const sunAlong = stageWidth * (stageWidth < 720 ? 0.24 : 0.22);
          const sunDrop = rimRadius - Math.sqrt(rimRadius * rimRadius - sunAlong * sunAlong);
          stage.style.setProperty('--sun-x', `${Math.round(stageWidth / 2 + sunAlong)}px`);
          stage.style.setProperty('--sun-rim', `${Math.round(rimTop + sunDrop)}px`);
          stage.style.setProperty('--sun-tilt', `${((Math.asin(sunAlong / rimRadius) * 180) / Math.PI).toFixed(2)}deg`);
          // Amanece cuando la cartela de la terraformación cruza frente al sol:
          // es texto sin marco, así que el sol se ve asomar detrás del título
          const dawnPanel = panels[2];
          if (dawnPanel && travel > 0) {
            const crossing = offsetWithin(dawnPanel, track).left + dawnPanel.offsetWidth / 2 - stageWidth / 2 - sunAlong;
            dawnAt = clamp01(scrollAt(table, clamp(crossing, 0, travel)) / pinned);
          }
        }
      }

      geometry.current = { stageWidth, travel, pinned, table, knots, pieces, rimRadius, rimTop, dawnAt, ticks: tickPositions };
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
          {kind !== 'acceleration' && (
            <span className="mo-corridor-meter">
              <b ref={velocityRef}>—</b>
              <small ref={velocityUnitRef} />
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

        <RoomProgress fillRef={fillRef} ticks={ticks} groupIndex={activeGroup} started={started} onTick={jumpToGroup}
          marker={kind === 'acceleration' && (
            <span className="mo-ship" ref={shipRef} aria-hidden="true">
              <span className="mo-velocity">
                <b ref={velocityRef}>—</b>
                <small ref={velocityUnitRef} />
              </span>
              <svg className="mo-ship-icon" viewBox="0 0 32 16">
                <path className="mo-ship-flame" d="M6 6.4 0 8l6 1.6Z" />
                <path className="mo-ship-wing" d="M17 5.4 11 1H8.5l3 4.6ZM17 10.6 11 15H8.5l3-4.6Z" />
                <rect className="mo-ship-nozzle" x="5.5" y="6.2" width="2" height="3.6" rx="0.5" />
                <path className="mo-ship-hull" d="M31 8c-4-2.8-10-3.4-19-2.8L7 6v4l5 .8c9 .6 15 0 19-2.8Z" />
                <ellipse className="mo-ship-window" cx="23.5" cy="7.3" rx="3" ry="1.2" />
              </svg>
            </span>
          )}
        />
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
  rimTop: number;
  rimRadius: number;
  dawnAt: number;
}

/* Cada pieza de una escala aparece cuando el avance de su grupo (--grow)
   pasa su umbral --t. Escribir --grow en la escala entera recalculaba en cada
   cuadro los estilos de sus miles de nodos (la galaxia sola tiene más de
   mil): se escribe en cada pieza, recortado a su tramo de aparición, y solo
   cuando cambia. Fuera de ese tramo la pieza ya está apagada o encendida del
   todo, así que se ve exactamente igual */
// El tramo de la aparición más lenta (--grow × 8 en el CSS), con margen
const GROW_SPAN = 0.13;

interface GrowPiece {
  element: SVGElement;
  t: number;
  last: string;
}

const growPieces = new WeakMap<Element, { pieces: GrowPiece[]; whole: GrowPiece[] }>();

const writeGrow = (layer: HTMLElement | SVGElement, grow: number) => {
  let found = growPieces.get(layer);
  if (!found) {
    const piece = (element: SVGElement) => ({ element, t: parseFloat(element.style.getPropertyValue('--t')) || 0, last: '' });
    found = {
      pieces: Array.from(layer.querySelectorAll<SVGElement>('[style*="--t"]'), piece),
      // El brillo y el calor de la estrella siguen el avance entero
      whole: Array.from(layer.querySelectorAll<SVGElement>('.mo-scale-sun-glow, .mo-scale-sun-waste'), piece),
    };
    growPieces.set(layer, found);
  }
  const write = (piece: GrowPiece, value: string) => {
    if (value === piece.last) return;
    piece.last = value;
    piece.element.style.setProperty('--grow', value);
  };
  for (const piece of found.pieces) write(piece, Math.min(piece.t + GROW_SPAN, Math.max(piece.t, grow)).toFixed(3));
  const whole = grow.toFixed(3);
  for (const piece of found.whole) write(piece, whole);
};

const paintScene = (kind: CorridorKind, parts: SceneParts, frame: SceneFrame) => {
  if (kind === 'acceleration') {
    const doppler = (frame.beta ** 1.4 * 0.9).toFixed(3);
    parts.dopplerLeft?.style.setProperty('opacity', doppler);
    parts.dopplerRight?.style.setProperty('opacity', doppler);
    // Las estelas corren más rápido que la pared y se alargan con la velocidad
    parts.streaks?.style.setProperty('opacity', (0.1 + frame.beta * 0.8).toFixed(3));
    if (!Number.isNaN(frame.wall)) {
      parts.backdrop?.style.setProperty('transform', `translate3d(${(-frame.wall * 0.28).toFixed(1)}px, 0, 0)`);
      parts.streaks?.style.setProperty('transform', `translate3d(${(-((frame.wall * 1.8) % 1600)).toFixed(1)}px, 0, 0) scaleX(${(1 + frame.beta * 2.2).toFixed(3)})`);
    }
    return;
  }
  if (Number.isNaN(frame.progress)) return;

  if (kind === 'horizon') {
    // Del mundo estéril al mundo vivo a lo largo de los cinco grupos
    const life = terraformLife(frame.progress);
    parts.barren?.style.setProperty('opacity', (1 - life * 0.9).toFixed(3));
    parts.living?.style.setProperty('opacity', life.toFixed(3));
    parts.groundBarren?.style.setProperty('opacity', (1 - life).toFixed(3));
    parts.groundLiving?.style.setProperty('opacity', life.toFixed(3));
    // Amanecer: el sol sube desde detrás del borde, asoma con la cartela de
    // la terraformación, se detiene un instante sobre el horizonte mientras
    // destella y termina sobre las obras, ya de día
    const lift = Math.max(160, frame.rimTop * 0.62);
    const below = 46;
    const atCrest = (below - 5) / (below + lift);
    const rise = frame.progress < frame.dawnAt
      ? atCrest * smoothstep(0.04, frame.dawnAt, frame.progress)
      : atCrest + (1 - atCrest) * smoothstep(frame.dawnAt, 1, frame.progress);
    const sunY = below - rise * (below + lift);
    const crest = (1 - clamp01(Math.abs(sunY - 5) / 18)) ** 2;
    const approach = smoothstep(0, atCrest, rise);
    if (parts.sun) {
      parts.sun.style.setProperty('translate', `0 ${sunY.toFixed(1)}px`);
      parts.sun.style.setProperty('--crest', crest.toFixed(3));
      // Sin aire el sol es un disco duro; la atmósfera lo envuelve en un halo
      parts.sun.style.setProperty('--haze', (0.2 + life * 0.8).toFixed(3));
    }
    parts.dawn?.style.setProperty('opacity', ((0.2 + approach * 0.8) * (1 - smoothstep(0.35, 1, rise) * 0.4) + crest * 0.25).toFixed(3));
    // Con el sol, la luz barre el suelo desde la derecha y el cielo se vuelve
    // de día; los mares llenan las zonas bajas y luego la tierra reverdece
    const day = smoothstep(frame.dawnAt - 0.03, frame.dawnAt + 0.2, frame.progress);
    parts.night?.style.setProperty('transform', `translate3d(${(-day * 66.667).toFixed(2)}%, 0, 0)`);
    parts.sky?.style.setProperty('opacity', (day * (0.35 + life * 0.65)).toFixed(3));
    const seas = smoothstep(frame.dawnAt, (frame.ticks[3] ?? 0.66) + 0.04, frame.progress);
    const green = smoothstep(frame.ticks[3] ?? 0.66, Math.min(0.98, (frame.ticks[4] ?? 0.86) + 0.06), frame.progress);
    parts.glint?.style.setProperty('opacity', (seas * smoothstep(0.1, 0.45, rise)).toFixed(3));
    parts.clouds?.style.setProperty('opacity', smoothstep(0.42, 0.95, frame.progress).toFixed(3));
    // Superficie y nubes giran con el planeta, más lento que la pared; el
    // mar sube y la tierra reverdece sobre el relieve de Marte
    if (parts.terrain instanceof HTMLCanvasElement) {
      paintMarsGround(parts.terrain, { wall: frame.wall, radius: frame.rimRadius, seas, green });
    }
    parts.cloudStrip?.style.setProperty('transform', `translate3d(${(-((frame.wall * 0.3) % 1600)).toFixed(1)}px, 0, 0)`);
    return;
  }

  // kardashev: cada grupo es una escala y la cámara se aleja sin parar,
  // como en Powers of Ten: cada escala se encoge hasta caber en la siguiente
  const level = scaleLevel(frame.ticks, frame.progress);
  const layers = [parts.scalePlanet, parts.scaleStar, parts.scaleGalaxy, parts.scaleDeep];
  const last = layers.length - 1;
  layers.forEach((layer, index) => {
    if (!layer) return;
    const local = Math.min(level - index, index === last ? 1 : 2);
    // Cada escala domina su grupo y cede el paso solo en su último tramo
    const shown = smoothstep(-0.28, 0, local) * (index === last ? 1 : 1 - smoothstep(0.72, 1, local));
    layer.style.opacity = shown.toFixed(3);
    if (shown <= 0) return;
    // Lo que se construye en la escala: hoy la Tierra ya tiene sus luces
    const built = clamp01(local / 0.85);
    writeGrow(layer, Number((index === 0 ? 0.3 + built * 0.7 : built).toFixed(3)));
    // La cámara siempre se aleja; en el tiempo profundo, más despacio, para
    // que el agujero se vea crecer con lo que traga
    const zoom = (index === 0 ? 9 : index === last ? 1.5 : 2.4) ** -local;
    // El planeta se ve desde muy cerca: al alejarse sube hasta quedar entero al centro
    const lift = index === 0 ? -81 * zoom * smoothstep(0, 0.8, local) : 0;
    const roll = index === 1 ? local * 14 : 0;
    layer.style.transform = `translate3d(0, ${lift.toFixed(2)}%, 0) scale(${zoom.toFixed(4)}) rotate(${roll.toFixed(2)}deg)`;
  });
  const planetTurn = clamp(level, -0.5, 1.5);
  parts.cities?.setAttribute('transform', `rotate(${(planetTurn * 9).toFixed(2)} 100 262)`);
  parts.satellites?.setAttribute('transform', `rotate(${(planetTurn * 34).toFixed(2)} 100 262)`);
  parts.galaxySpin?.setAttribute('transform', `rotate(${(clamp(level - 2, -1, 2) * 50).toFixed(2)})`);
  // Tiempo profundo: el agujero devora las últimas estrellas, que caen en
  // espiral; crece con lo que traga y, ya solo, se evapora en un destello
  const deep = clamp01(level - 3);
  const embers = parts.embers?.children;
  if (embers) {
    for (let index = 0; index < embers.length; index++) {
      const ember = embers[index] as SVGGElement;
      // Todas caen en la primera mitad: la segunda es del agujero solo
      const fade = (Number(ember.dataset.fade) || 0.95) * 0.5;
      const fall = smoothstep(fade - 0.3, fade, deep);
      ember.setAttribute('transform', `rotate(${(fall * fall * 260).toFixed(1)}) scale(${(1 - fall * 0.9).toFixed(3)})`);
      const light = ember.lastElementChild as SVGGElement | null;
      if (ember.childElementCount > 1) {
        light?.setAttribute('opacity', (Number(ember.dataset.glow) * (1 - smoothstep(0.8, 1, fall))).toFixed(3));
      }
      ember.style.opacity = (1 - smoothstep(0.9, 1, fall)).toFixed(3);
    }
  }
  // La evaporación es lenta: el agujero se encoge y se calienta, brilla cada
  // vez más y se deshace en un destello que se apaga suave
  const evaporate = smoothstep(0.5, 0.94, deep);
  const fed = 1 + smoothstep(0.05, 0.5, deep) * 0.4;
  parts.hole?.setAttribute('transform', `scale(${(fed * (1 - evaporate)).toFixed(4)})`);
  parts.hole?.style.setProperty('--spin', (deep * 260).toFixed(1));
  const flash = smoothstep(0.62, 0.9, deep) * (1 - smoothstep(0.9, 1, deep) * 0.85);
  parts.flash?.setAttribute('opacity', flash.toFixed(3));
  parts.flash?.setAttribute('transform', `scale(${(0.15 + smoothstep(0.62, 1, deep) * 1.1).toFixed(3)})`);
};
