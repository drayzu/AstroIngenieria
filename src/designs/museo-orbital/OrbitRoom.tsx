import { memo, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import { smoothScrollTo } from '../shared/smoothScroll';
import type { AstroConcept } from '../../types';
import type { CorridorGroup } from './GalleryCorridor';
import { RoomHud, RoomProgress } from './RoomHud';
import { clamp, clamp01, smoothstep, useRoomLoop } from './roomShared';
import './orbitRoom.css';

/* Energía estelar: las obras orbitan una estrella. El scroll hace girar la
   órbita y cada obra se detiene un momento al frente para leerla. Al llegar
   a las estructuras Dyson aparecen los anillos del enjambre y la estrella se
   apaga en el visible: solo queda su resplandor infrarrojo, la luz capturada. */

// Scroll por obra, en alturas de pantalla
const STEP = 0.7;
const DYSON_RINGS = [
  { size: 31, tilt: -12, speed: 46 },
  { size: 39, tilt: 9, speed: 62 },
  { size: 48, tilt: -4, speed: 80 },
  { size: 57, tilt: 15, speed: 104 },
];

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
  const ringRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const geometry = useRef<Geometry>({ pinned: 1, radiusX: 1, radiusY: 1, ticks: [] });
  const live = useRef({ current: -1, started: false, layers: [] as number[], live: false });
  const [ticks, setTicks] = useState<number[]>([]);
  const [path, setPath] = useState('');
  const [active, setActive] = useState(0);
  const [started, setStarted] = useState(false);

  const works = useMemo(() => groups.flatMap((group, groupIndex) =>
    group.works.map((work) => ({ ...work, groupIndex }))), [groups]);
  const total = works.length;
  // Primera obra de las estructuras Dyson: desde ahí la estrella se envuelve
  const dysonFrom = Math.max(1, works.findIndex((work) => work.groupIndex === groups.length - 1));

  const paint = (offset: number, viewport: number) => {
    const { pinned, radiusX, radiusY } = geometry.current;
    const state = live.current;
    const progress = clamp01(offset / pinned);
    // Cada obra se detiene al frente: el giro se concentra entre una y otra
    const raw = progress * (total - 1);
    const step = Math.min(total - 1, Math.floor(raw));
    const position = raw >= total - 1 ? total - 1 : step + smoothstep(0.18, 0.82, raw - step);

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

    // La luz capturada: la estrella se apaga y queda el infrarrojo
    const capture = smoothstep(dysonFrom - 0.6, total - 1, position);
    starRef.current?.style.setProperty('opacity', (1 - capture * 0.85).toFixed(3));
    starRef.current?.style.setProperty('transform', `scale(${(1 - capture * 0.18).toFixed(4)})`);
    infraredRef.current?.style.setProperty('opacity', capture.toFixed(3));
    ringRefs.current.forEach((ring, index) => {
      ring?.style.setProperty('opacity', (smoothstep(index / 4, (index + 1) / 4, capture) * 0.9).toFixed(3));
    });

    // Los anillos solo giran mientras la sala está a la vista
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

  const refresh = useRoomLoop(sectionRef, scrollRef, (frame) => paint(frame.offset, frame.viewport));

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
              {/* Protuberancias: arcos de plasma anclados al borde */}
              <svg className="mo-sun-loops" viewBox="-50 -50 100 100">
                <path className="is-glow" d="M -11.5 -13.9 Q -14 -34 -2.8 -17.8" />
                <path d="M -11.5 -13.9 Q -14 -34 -2.8 -17.8" />
                <path className="is-glow is-b" d="M 17.4 4.6 Q 33 4 16.3 7.8" />
                <path className="is-b" d="M 17.4 4.6 Q 33 4 16.3 7.8" />
                <path className="is-glow is-c" d="M -14.6 10.6 Q -22 27 -8.2 16.1" />
                <path className="is-c" d="M -14.6 10.6 Q -22 27 -8.2 16.1" />
              </svg>
              <span className="mo-sun-flare" />
            </span>
            {DYSON_RINGS.map((ring, index) => (
              <span
                key={ring.size}
                className="mo-orbit-ring"
                ref={(element) => { ringRefs.current[index] = element; }}
                style={{ '--ring-size': `${ring.size}vmin`, '--ring-tilt': `${ring.tilt}deg`, '--ring-speed': `${ring.speed}s` } as CSSProperties}
              >
                <span className="mo-orbit-ring-spin" />
              </span>
            ))}
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
