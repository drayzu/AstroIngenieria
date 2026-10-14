import { memo, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import type { AstroConcept } from '../../types';
import type { VerticalKind } from './salaRooms';
import type { CorridorGroup } from './GalleryCorridor';
import { TopicHeading } from './TopicHeading';
import { selectedStudyImages } from '../../data/selectedStudyImages';
import { ASSEMBLY_MAX, assemblyEnd, assemblySides, drawAssembly, endAssembly, startAssembly, type Assembly, type Box } from './tileAssembly';
import { clamp, clamp01, offsetWithin, skyDrift, smoothstep, useRoomLook, useRoomLoop } from './roomShared';
import { drawWheel, sizeWheel, wheelRadius, wheelSpokes, wheelStops, type Wheel, type WheelStop } from './wheelHabitat';
import './verticalRooms.css';

/* Salas que se recorren en vertical, cada una con su física:

   - spotlight (Introducción): la primera obra espera a oscuras y su foco se
     enciende, con un parpadeo, cuando llegas frente a ella
   - wheel (Hábitats): las obras van montadas en la rueda de un hábitat; el
     scroll la hace girar, se inclinan siguiendo su borde y el cielo gira
     con ella. La rueda crece de obra en obra, de la ISS al Ringworld
     (wheelHabitat dibuja el casco, los radios y el cubo en un lienzo)
   - blueprint (Industria): cada obra llega como un hueco vacío y, al
     asomar, una flota de remolcadores trae las teselas de su imagen desde
     fuera de la pantalla, por la derecha, donde un resplandor delata de
     dónde viene la materia (tileAssembly lo dibuja en un lienzo). El vuelo
     lleva su propio tiempo (el scroll solo lo dispara); una obra armada
     queda armada, y vuelve a armarse si te alejas hacia arriba y regresas
   - starlight (Estelar): el borde de una estrella hierve al pie de la sala y
     cada obra sale de ella al rojo vivo, como materia extraída, disparada en
     arco y frenando mientras sube y se enfría. La estrella gira con el scroll
     y vive lo que cuenta cada grupo: se desplaza (motores estelares), se
     encoge y enrojece al extraerle materia y al final colapsa en un agujero
     negro que crece hasta tragarse la pantalla: la sala termina dentro de él
   - silence (Inteligencia extraterrestre): sala a oscuras que solo revela el
     barrido del radar o la linterna del cursor; el bosque oscuro se esconde

   Las posiciones se miden al cambiar de tamaño; en cada cuadro solo se
   escriben transformaciones y opacidades de las obras a la vista. */

const RADAR_PERIOD = 7200;

const DARK_FOREST = 'dark-forest';

interface ItemParts {
  root?: HTMLElement | null;
  heat?: HTMLElement | null;
  glow?: HTMLElement | null;
  cone?: HTMLElement | null;
  ping?: HTMLElement | null;
  label?: HTMLElement | null;
}

interface SkyParts {
  sky?: HTMLElement | null;
  wheel?: HTMLElement | null;
  forge?: HTMLElement | null;
  source?: HTMLElement | null;
  sourceLeft?: HTMLElement | null;
  surface?: HTMLElement | null;
  granules?: HTMLElement | null;
  cooled?: HTMLElement | null;
  hole?: HTMLElement | null;
  motes?: HTMLElement | null;
  beam?: HTMLElement | null;
  blips?: (HTMLElement | null)[];
}

interface Geometry {
  width: number;
  bodyHeight: number;
  items: { top: number; height: number; centerX: number; width: number; frameHeight: number; window: Box }[];
  groups: { top: number; height: number }[];
  // Hábitats: el radio de la rueda en cada obra y la distancia al casco
  wheel: WheelStop[];
  gap: number;
}

// Pseudoaleatorio estable para los ecos falsos del radar
const seeded = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const BLIPS = Array.from({ length: 7 }, (_, index) => ({
  x: 0.12 + seeded(index + 7) * 0.76,
  y: 0.16 + seeded(index + 19) * 0.7,
}));

// Plasma que sube desde el borde de la estrella
const MOTES = Array.from({ length: 14 }, (_, index) => ({
  x: -46 + seeded(index + 41) * 92,
  duration: 7 + seeded(index + 53) * 6,
  delay: -seeded(index + 67) * 12,
  size: 2 + seeded(index + 79) * 2.5,
}));

export const VerticalRoom = memo(({
  kind,
  groups,
  scrollRef,
  renderObra,
}: {
  kind: VerticalKind;
  groups: CorridorGroup[];
  scrollRef: RefObject<HTMLDivElement | null>;
  renderObra: (concept: AstroConcept, plate: number, preload: boolean, overlay?: ReactNode) => ReactNode;
}) => {
  const { t } = useLocale();
  const bodyRef = useRef<HTMLDivElement>(null);
  const items = useRef<ItemParts[]>([]);
  const sky = useRef<SkyParts>({ blips: [] });
  const geometry = useRef<Geometry>({ width: 1, bodyHeight: 1, items: [], groups: [], wheel: [], gap: 0 });
  const wheel = useRef<Wheel | null>(null);
  const live = useRef({
    touched: new Set<number>(),
    lit: new Set<number>(),
    pointer: { x: -9999, y: -9999 },
    // Radar: ángulo desde el último barrido, señal fijada y su intensidad
    since: [] as number[],
    locked: new Set<number>(),
    lock: [] as number[],
    lastNow: 0,
    // Industria: cuándo empezó a armarse cada obra (ms; -Infinity si se
    // dio por armada), si ya quedó armada, su lienzo mientras se arma y si
    // hay alguna obra armándose
    start: [] as number[],
    built: [] as boolean[],
    assembly: [] as (Assembly | null)[],
    assembling: false,
    // Hábitats: el punto de la sala en el centro de la pantalla en el último cuadro
    wheelCenter: Number.NaN,
    // Mirar alrededor: la sala gira alrededor del centro de la pantalla
    pivot: Number.NaN,
  });
  const radar = useRef<Animation | null>(null);

  const works = useMemo(() => groups.flatMap((group, groupIndex) =>
    group.works.map((work) => ({ ...work, groupIndex }))), [groups]);
  const sources = useMemo(() => works.map(({ concept }) => selectedStudyImages[concept.id]?.[0]), [works]);

  const part = (index: number, key: keyof ItemParts) => (element: HTMLElement | null) => {
    items.current[index] = { ...items.current[index], [key]: element };
  };
  const skyPart = (key: Exclude<keyof SkyParts, 'blips'>) => (element: HTMLElement | null) => {
    sky.current[key] = element;
  };

  const paint = (offset: number, viewport: number, now: number) => {
    const { width, bodyHeight, items: placed } = geometry.current;
    const state = live.current;
    state.pivot = offset + viewport / 2;
    relook();
    let sweep = 0;
    const dt = state.lastNow ? clamp(now - state.lastNow, 0, 100) : 16;
    state.lastNow = now;
    if (kind === 'silence') {
      const animation = radar.current;
      if (animation && animation.playState !== 'running') animation.play();
      const time = Number(animation?.currentTime ?? now);
      sweep = ((time % RADAR_PERIOD) / RADAR_PERIOD) * Math.PI * 2;
      sky.current.blips?.forEach((blip, index) => {
        if (!blip) return;
        const point = BLIPS[index];
        const echo = Math.exp(-sinceSweep(sweep, point.x * width - width / 2, point.y * viewport - viewport / 2) / 0.7);
        blip.style.opacity = (echo * 0.9).toFixed(3);
      });
    }

    if (kind === 'starlight') {
      // La estrella sigue al grupo que asoma por abajo: lo que sale de ella
      const level = groupLevel(geometry.current.groups, offset + viewport * 0.92);
      paintStar(sky.current, level, offset, width, viewport, bodyHeight - offset - viewport);
    }

    if (kind === 'blueprint') {
      // El borde de donde viene la materia brilla mientras alguna obra se
      // arma; mientras tanto el bucle sigue aunque no haya scroll
      // Brilla el borde por donde llega cada flota en camino
      let left = false;
      let right = false;
      state.start.forEach((start, index) => {
        if (start === undefined || (now - start) / 1000 >= assemblyEnd(index)) return;
        const sides = assemblySides(index);
        left ||= sides.left;
        right ||= sides.right;
      });
      state.assembling = state.start.some((start) => start !== undefined && (now - start) / 1000 < ASSEMBLY_MAX);
      sky.current.source?.style.setProperty('opacity', right ? '1' : '0');
      sky.current.sourceLeft?.style.setProperty('opacity', left ? '1' : '0');
    }

    let wheelR = 1;
    if (kind === 'wheel') {
      // La rueda gira lo mismo que avanzan las obras sobre su borde y crece
      // con los hábitats
      const center = offset + viewport / 2;
      const stops = geometry.current.wheel;
      wheelR = wheelRadius(stops, center);
      if (wheel.current) {
        drawWheel(wheel.current, { center, radius: wheelR, gap: geometry.current.gap, spokes: wheelSpokes(stops, wheelR), masts: stops.map((stop) => stop.at) });
        // Sigue entera hasta pasar la última obra y se desvanece antes de que
        // termine la sala: no llega al portal siguiente
        const remaining = bodyHeight - offset - viewport;
        const lastAt = stops.length ? stops[stops.length - 1].at : center;
        const past = 1 - smoothstep(lastAt, lastAt + viewport * 0.6, center);
        wheel.current.canvas.style.opacity = Math.min(past, smoothstep(-viewport * 0.4, viewport * 0.2, remaining)).toFixed(3);
      }
      // El cielo gira con ella alrededor del eje; lo lejano, más despacio
      const moved = center - state.wheelCenter;
      if (Math.abs(moved) < viewport) {
        skyDrift.spin.x = width / 2 + wheelR;
        skyDrift.spin.y = viewport / 2;
        skyDrift.spin.depth = 1;
        skyDrift.spin.angle += (moved / wheelR) * 0.5;
      }
      state.wheelCenter = center;
    }

    for (let index = 0; index < placed.length; index++) {
      const box = placed[index];
      const parts = items.current[index];
      const root = parts?.root;
      if (!root) continue;
      const top = box.top - offset;
      const centerY = top + box.height / 2;
      if (centerY < -viewport * 0.6 || centerY > viewport * 1.6) {
        if (state.touched.delete(index)) {
          settleItem(parts);
          delete state.built[index];
          endAssembly(state.assembly[index], false);
          state.assembly[index] = null;
          if (state.start[index] !== undefined) {
            if (centerY > 0) {
              // Quedó por debajo (volviste más arriba): al bajar de nuevo
              // hasta ella, la flota la arma otra vez
              delete state.start[index];
            } else {
              // Quedó atrás a medio armar: queda armada
              state.start[index] = -Infinity;
            }
          }
          if (kind === 'silence') {
            state.locked.delete(index);
            state.lock[index] = 0;
            delete state.since[index];
            root.classList.remove('is-locked');
          }
        }
        continue;
      }
      state.touched.add(index);
      const fromMiddle = (centerY - viewport / 2) / viewport;

      if (kind === 'spotlight') {
        const lit = 1 - smoothstep(0.14, 0.55, Math.abs(fromMiddle));
        root.style.opacity = (0.1 + lit * 0.9).toFixed(3);
        parts.cone?.style.setProperty('opacity', lit.toFixed(3));
        // El foco se enciende una vez, con su parpadeo; luego solo sigue la distancia
        if (lit > 0.6 && !state.lit.has(index)) {
          state.lit.add(index);
          root.classList.add('is-on');
        }
      } else if (kind === 'wheel') {
        const angle = Math.asin(clamp((centerY - viewport / 2) / wheelR, -0.8, 0.8));
        const shift = wheelR * (1 - Math.cos(angle));
        root.style.transform = `translate3d(${shift.toFixed(1)}px, 0, 0) rotate(${(-angle * (width < 720 ? 0.55 : 0.8) * 180 / Math.PI).toFixed(3)}deg)`;
      } else if (kind === 'blueprint') {
        if (state.built[index]) continue;
        // Al asomar la ventana despega la flota (sin movimiento reducido,
        // queda armada de una vez)
        const windowTop = top + box.window.top;
        if (state.start[index] === undefined && windowTop < viewport * 0.88 && windowTop + box.window.height > 0) {
          state.start[index] = reducedMotion() ? -Infinity : now;
          state.assembling = true;
        }
        const start = state.start[index];
        if (start === undefined) continue;
        const elapsed = (now - start) / 1000;
        // Cada obra tiene su coreografía (orden, vuelo, altura de entrada)
        if (elapsed >= assemblyEnd(index)) {
          // Armada: la imagen real queda sola (el lienzo era el mismo dibujo)
          endAssembly(state.assembly[index]);
          state.assembly[index] = null;
          state.built[index] = true;
          root.classList.add('is-built');
          root.classList.remove('is-building');
          continue;
        }
        const itemLeft = box.centerX - box.width / 2;
        const assembly = state.assembly[index] ??= startAssembly(root, box.window, itemLeft, width, viewport, sources[index], index);
        root.classList.add('is-building');
        // Las teselas salen de fuera de la pantalla, por los bordes a media
        // altura: su posición respecto a la ventana
        const windowLeft = itemLeft + box.window.left;
        if (assembly) drawAssembly(assembly, elapsed, width - windowLeft, -windowLeft, viewport / 2 - windowTop, viewport);
      } else if (kind === 'starlight') {
        // Al asomar desde la estrella la obra llega incandescente; al subir se
        // enfría de arriba abajo y queda en sus colores hacia la mitad
        const heat = smoothstep(0.5, 0.97, (top + box.frameHeight / 2) / viewport);
        parts.heat?.style.setProperty('opacity', heat.toFixed(3));
        parts.heat?.style.setProperty('transform', `translate3d(0, ${((1 - heat) * 50).toFixed(2)}%, 0)`);
        parts.glow?.style.setProperty('opacity', heat.toFixed(3));
        // Eyectada en arco, como un bucle de plasma: sale de un costado, más
        // rápido que el scroll, y frena y se endereza al llegar a la mitad
        const launch = smoothstep(0.42, 1.05, (top + box.frameHeight / 2) / viewport);
        const side = index % 2 ? 1 : -1;
        const swing = launch * launch;
        const drift = side * swing * Math.min(width * 0.07, 90);
        root.style.transform = `translate3d(${drift.toFixed(1)}px, ${(swing * viewport * 0.16).toFixed(1)}px, 0) rotate(${(side * swing * 5).toFixed(2)}deg) scale(${(1 - launch * 0.06).toFixed(4)})`;
      } else if (kind === 'silence') {
        const work = works[index];
        const since = sinceSweep(sweep, box.centerX - width / 2, centerY - viewport / 2);
        // El ángulo crece hasta que el barrido vuelve a pasar y cae a cero
        const crossed = since < (state.since[index] ?? -1) - 1;
        state.since[index] = since;
        const pointer = state.pointer;
        const gapX = Math.max(0, Math.abs(pointer.x - box.centerX) - box.width / 2);
        const gapY = Math.max(0, Math.abs(pointer.y - centerY) - box.height / 2);
        const torch = 1 - smoothstep(40, 340, Math.hypot(gapX, gapY));
        const inReach = Math.abs(fromMiddle) < 0.3;
        if (work?.concept.id === DARK_FOREST) {
          // El bosque oscuro: lo que encuentra la luz se esconde
          const found = Math.max(Math.exp(-since / 1.1), torch);
          root.style.opacity = (0.08 + 0.6 * (1 - found)).toFixed(3);
          root.style.transform = `scale(${(1 - found * 0.05).toFixed(4)})`;
          if (crossed && inReach) {
            parts.label?.animate(
              [{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 0.2, offset: 0.16 }, { opacity: 1, offset: 0.24 }, { opacity: 0 }],
              { duration: 1800, easing: 'ease-out' },
            );
          }
          continue;
        }
        // Detectada frente al visitante: la señal se fija hasta que se aleja
        if (crossed && inReach && !state.locked.has(index)) {
          state.locked.add(index);
          root.classList.add('is-locked');
          pingEcho(parts.ping, true);
        } else if (crossed && Math.abs(fromMiddle) < 0.7) {
          pingEcho(parts.ping, false);
        }
        if (state.locked.has(index) && Math.abs(fromMiddle) > 0.55) {
          state.locked.delete(index);
          root.classList.remove('is-locked');
        }
        const target = state.locked.has(index) ? 1 : 0;
        const current = state.lock[index] ?? 0;
        const lock = current + (target - current) * (1 - Math.exp(-dt * (target ? 0.004 : 0.0015)));
        state.lock[index] = lock;
        // El barrido pinta la obra como el fósforo de una pantalla de radar:
        // la máscara sigue el haz y deja una estela que se apaga
        root.style.setProperty('--sweep', `${((sweep * 180) / Math.PI).toFixed(2)}deg`);
        root.style.setProperty('--rx', `${(width / 2 - (box.centerX - box.width / 2)).toFixed(1)}px`);
        root.style.setProperty('--ry', `${(viewport / 2 - top).toFixed(1)}px`);
        root.style.setProperty('--floor', Math.max(0.05, lock, torch).toFixed(3));
      }
    }
  };

  const pauseRadar = () => radar.current?.pause();
  // Al detenerse la rueda, el próximo cuadro no arrastra el cielo
  const forgetWheel = () => {
    live.current.wheelCenter = Number.NaN;
  };
  // Mirar alrededor: la sala se ladea hacia donde mira el visitante, con el
  // giro en el centro de la pantalla (la sala es más alta que ella)
  const relook = useRoomLook(bodyRef, bodyRef, () => live.current.pivot);
  const refresh = useRoomLoop(bodyRef, scrollRef, (frame) => paint(frame.offset, frame.viewport, frame.now), {
    continuous: kind === 'silence',
    busy: kind === 'blueprint' ? () => live.current.assembling : undefined,
    onIdle: kind === 'silence' ? pauseRadar : kind === 'wheel' ? forgetWheel : undefined,
  });

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const measure = () => {
      const bodyLeft = body.getBoundingClientRect().left;
      const placed = items.current.map((parts) => {
        const root = parts?.root;
        const opening = { top: 0, left: 0, width: 0, height: 0 };
        if (!root) return { top: 0, height: 0, centerX: 0, width: 0, frameHeight: 0, window: opening };
        const { top, left } = offsetWithin(root, body);
        const frame = root.querySelector<HTMLElement>('.mo-frame');
        const mask = root.querySelector<HTMLElement>('.mo-frame-mask');
        if (kind === 'blueprint' && mask) {
          Object.assign(opening, offsetWithin(mask, root), { width: mask.offsetWidth, height: mask.offsetHeight });
        }
        return {
          top,
          height: root.offsetHeight,
          centerX: bodyLeft + left + root.offsetWidth / 2,
          width: root.offsetWidth,
          frameHeight: frame?.offsetHeight ?? root.offsetHeight,
          window: opening,
        };
      });
      const groupBoxes = Array.from(body.querySelectorAll<HTMLElement>('.mo-topic-group')).map((group) => ({
        top: offsetWithin(group, body).top,
        height: group.offsetHeight,
      }));
      const width = document.documentElement.clientWidth;
      geometry.current = { width, bodyHeight: body.offsetHeight, items: placed, groups: groupBoxes, wheel: [], gap: 0 };
      // Con otro tamaño los lienzos ya no calzan: lo que se armaba queda armado
      live.current.assembly.forEach((assembly, index) => {
        if (!assembly) return;
        endAssembly(assembly, false);
        live.current.assembly[index] = null;
        live.current.start[index] = -Infinity;
      });
      live.current.built = [];
      if (kind === 'wheel') {
        // Cada obra trae su radio; el casco va por fuera de la más ancha
        const viewport = scrollRef.current?.clientHeight ?? window.innerHeight;
        geometry.current.wheel = wheelStops(placed.map((box) => box.top + box.height / 2), viewport, width < 720);
        const half = Math.max(0, ...placed.map((box) => box.width / 2));
        geometry.current.gap = Math.max(0, Math.min(half + 104, width / 2 - 24));
        // Los títulos de grupo empiezan dentro de la cubierta, no cruzan el casco
        const deck = Math.max(width / 2 - half + 16, width / 2 - geometry.current.gap + 62);
        body.querySelectorAll<HTMLElement>('.mo-topic-group').forEach((group) => {
          group.style.setProperty('--wheel-deck', `${Math.max(0, deck - group.getBoundingClientRect().left).toFixed(0)}px`);
        });
        const canvas = sky.current.wheel;
        const host = canvas?.parentElement;
        if (canvas instanceof HTMLCanvasElement && host) {
          const accent = getComputedStyle(body).getPropertyValue('--accent');
          wheel.current = sizeWheel(canvas, host.getBoundingClientRect().left, width, viewport, accent, wheel.current);
        }
      }
      refresh();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, [kind, works, refresh, scrollRef]);

  // Radar: el barrido gira en el compositor; el bucle solo lee su ángulo
  useEffect(() => {
    if (kind !== 'silence' || !sky.current.beam) return;
    const animation = sky.current.beam.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: RADAR_PERIOD, iterations: Infinity },
    );
    radar.current = animation;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      live.current.pointer = { x: event.clientX, y: event.clientY };
    };
    const onLeave = () => {
      live.current.pointer = { x: -9999, y: -9999 };
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => {
      animation.cancel();
      radar.current = null;
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [kind]);

  const overlayFor = (index: number) => {
    // El hueco donde se arma la obra: la grilla de sus teselas, vacía
    if (kind === 'blueprint') return <span className="mo-bay" aria-hidden="true" />;
    if (kind === 'starlight') return <span className="mo-forge-heat" ref={part(index, 'heat')} aria-hidden="true" />;
    return undefined;
  };

  let index = 0;
  return (
    <div className={`mo-room is-${kind}`} ref={bodyRef}>
      <div className="mo-room-sky" ref={skyPart('sky')} aria-hidden="true">
        {kind === 'wheel' && (
          <div className="mo-wheel">
            <canvas className="mo-wheel-canvas" ref={skyPart('wheel')} />
          </div>
        )}
        {kind === 'blueprint' && (
          <>
            <span className="mo-source" ref={skyPart('source')} />
            <span className="mo-source is-left" ref={skyPart('sourceLeft')} />
          </>
        )}
        {kind === 'starlight' && (
          <div className="mo-forge" ref={skyPart('forge')}>
            <span className="mo-forge-surface" ref={skyPart('surface')}>
              <span className="mo-forge-cooled" ref={skyPart('cooled')} />
              <span className="mo-forge-granules" ref={skyPart('granules')} />
            </span>
            {/* Lo que queda al final: un agujero negro con su disco */}
            <span className="mo-forge-hole" ref={skyPart('hole')}>
              <span className="mo-forge-hole-disk is-back" />
              <span className="mo-forge-hole-shadow" />
              <span className="mo-forge-hole-disk" />
            </span>
            <span className="mo-forge-motes" ref={skyPart('motes')}>
              {MOTES.map((mote, moteIndex) => (
                <span
                  key={moteIndex}
                  className="mo-forge-mote"
                  style={{
                    left: `${mote.x}vw`,
                    width: `${mote.size}px`,
                    height: `${mote.size}px`,
                    animationDuration: `${mote.duration}s`,
                    animationDelay: `${mote.delay}s`,
                  }}
                />
              ))}
            </span>
          </div>
        )}
        {kind === 'silence' && (
          <div className="mo-radar">
            <span className="mo-radar-rings" />
            <span className="mo-radar-beam" ref={skyPart('beam')} />
            {BLIPS.map((blip, blipIndex) => (
              <span
                key={blipIndex}
                className="mo-radar-blip"
                style={{ left: `${blip.x * 100}%`, top: `${blip.y * 100}%` }}
                ref={(element) => { sky.current.blips![blipIndex] = element; }}
              />
            ))}
          </div>
        )}
      </div>

      {groups.map((group) => (
        <section className="mo-topic-group" key={group.title} aria-label={group.title}>
          <TopicHeading title={group.title} />
          <div className="mo-wall">
            {group.works.map(({ concept, plate }) => {
              const current = index++;
              return (
                <div className="mo-room-item" key={concept.id} data-concept={concept.id} ref={part(current, 'root')}>
                  {kind === 'spotlight' && (
                    <span className="mo-spot" ref={part(current, 'cone')} aria-hidden="true">
                      <span className="mo-spot-beam" />
                    </span>
                  )}
                  {kind === 'starlight' && <span className="mo-forge-glow" ref={part(current, 'glow')} aria-hidden="true" />}
                  {kind === 'silence' && (
                    <span className="mo-radar-mark" aria-hidden="true">
                      <span className="mo-radar-ping" ref={part(current, 'ping')} />
                      <span className="mo-radar-brackets" />
                      <span className="mo-radar-label" ref={part(current, 'label')}>
                        {concept.id === DARK_FOREST ? t("Señal perdida") : t("Señal confirmada")}
                      </span>
                    </span>
                  )}
                  {renderObra(concept, plate, false, overlayFor(current))}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
});

/* Ángulo recorrido por el barrido desde que pasó sobre un punto (0 = recién) */
const sinceSweep = (sweep: number, dx: number, dy: number) => {
  // Ángulo del punto en sentido horario desde las doce, como el barrido
  const angle = Math.atan2(dx, -dy);
  const turn = Math.PI * 2;
  return (((sweep - angle) % turn) + turn) % turn;
};

/* Eco que vuelve de la obra al pasar el barrido; más fuerte al fijar la señal */
const pingEcho = (ping: HTMLElement | null | undefined, strong: boolean) => {
  ping?.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.15)', opacity: strong ? 0.95 : 0.4 },
      { transform: `translate(-50%, -50%) scale(${strong ? 1 : 0.7})`, opacity: 0 },
    ],
    { duration: strong ? 1700 : 1100, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
  );
};

const settleItem = (parts: ItemParts) => {
  parts.root?.style.removeProperty('transform');
  parts.root?.style.removeProperty('opacity');
  parts.root?.style.removeProperty('--floor');
  parts.heat?.style.removeProperty('transform');
  parts.heat?.style.removeProperty('opacity');
  parts.glow?.style.removeProperty('opacity');
  parts.root?.classList.remove('is-built', 'is-building');
};

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Grupo que se recorre más lo avanzado en él: 0 al entrar al primero */
const groupLevel = (groups: Geometry['groups'], at: number) => {
  let level = 0;
  groups.forEach((group, index) => {
    if (at >= group.top) level = index + clamp01((at - group.top) / (group.height || 1));
  });
  return level;
};

/* La estrella cuenta su capítulo: gira con el scroll, se desplaza con los
   motores estelares, se encoge y enrojece al extraerle materia y colapsa */
const paintStar = (sky: SkyParts, level: number, offset: number, width: number, viewport: number, remaining: number) => {
  const engines = smoothstep(0.15, 1, level) * (1 - smoothstep(1.2, 2, level));
  const lifted = smoothstep(1, 1.8, level);
  const collapse = smoothstep(1.85, 2.45, level);
  const shift = -engines * Math.min(width * 0.14, 220);
  const shrink = lifted * viewport * 0.065 + collapse * viewport * 0.3;
  // La estrella gira con el scroll: la granulación corre por el borde (la
  // textura se repite cada 360 px, así el desplazamiento no tiene costura)
  sky.granules?.style.setProperty('translate', `${(-((offset * 0.35) % 360)).toFixed(1)}px 0`);
  if (sky.surface) {
    sky.surface.style.transform = `translate3d(${shift.toFixed(1)}px, ${shrink.toFixed(1)}px, 0)`;
    sky.surface.style.opacity = (1 - collapse).toFixed(3);
  }
  sky.cooled?.style.setProperty('opacity', lifted.toFixed(3));
  sky.motes?.style.setProperty('opacity', (1 - collapse).toFixed(3));
  if (sky.hole) {
    // Al acabar la sala caemos en él: sube al centro y crece hasta que el
    // anillo de fotones sale por los bordes y todo queda en negro; después
    // la oscuridad se disuelve en el cielo y la sala termina sin corte
    const swallow = 1 - smoothstep(viewport * 0.32, viewport * 1, remaining);
    const through = 1 - smoothstep(viewport * 0.02, viewport * 0.28, remaining);
    const rise = (1 - collapse) * viewport * 0.25 - swallow * swallow * viewport * 0.5;
    const scale = (0.6 + collapse * 0.4) * (1 + swallow ** 2.2 * 3.4);
    sky.hole.style.opacity = (collapse * (1 - through)).toFixed(3);
    sky.hole.style.setProperty('--swallow', swallow.toFixed(3));
    sky.hole.style.transform = `translate3d(-50%, ${rise.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
  }
};
