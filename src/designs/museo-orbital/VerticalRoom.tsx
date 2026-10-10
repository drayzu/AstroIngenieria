import { memo, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
import { useLocale } from '../../i18n/LocaleProvider';
import type { AstroConcept } from '../../types';
import type { VerticalKind } from './salaRooms';
import type { CorridorGroup } from './GalleryCorridor';
import { TopicHeading } from './TopicHeading';
import { clamp, clamp01, offsetWithin, smoothstep, useRoomLoop } from './roomShared';
import './verticalRooms.css';

/* Salas que se recorren en vertical, cada una con su física:

   - spotlight (Introducción): la primera obra espera a oscuras y su foco se
     enciende, con un parpadeo, cuando llegas frente a ella
   - wheel (Hábitats): las obras van montadas en la rueda de un hábitat; el
     scroll la hace girar y se inclinan siguiendo su borde
   - blueprint (Industria): cada obra llega como plano técnico y se imprime
     línea a línea al pasar; el transporte sube por un ascensor espacial
   - starlight (Estelar): una estrella se desplaza empujada por su motor y
     proyecta las sombras de las obras; al final colapsa en un agujero negro
   - silence (Inteligencia extraterrestre): sala a oscuras que solo revela el
     barrido del radar o la linterna del cursor; el bosque oscuro se esconde

   Las posiciones se miden al cambiar de tamaño; en cada cuadro solo se
   escriben transformaciones y opacidades de las obras a la vista. */

const RADAR_PERIOD = 7200;
const DARK_FOREST = 'dark-forest';

interface ItemParts {
  root?: HTMLElement | null;
  shadow?: HTMLElement | null;
  rim?: HTMLElement | null;
  print?: HTMLElement | null;
  sheet?: HTMLElement | null;
  cone?: HTMLElement | null;
}

interface SkyParts {
  sky?: HTMLElement | null;
  spokes?: HTMLElement | null;
  star?: HTMLElement | null;
  sun?: HTMLElement | null;
  jet?: HTMLElement | null;
  mirror?: HTMLElement | null;
  lift?: HTMLElement | null;
  hole?: HTMLElement | null;
  beam?: HTMLElement | null;
  blips?: (HTMLElement | null)[];
}

interface Geometry {
  width: number;
  bodyHeight: number;
  items: { top: number; height: number; centerX: number; width: number; frameHeight: number }[];
  groups: { top: number; height: number }[];
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
  const geometry = useRef<Geometry>({ width: 1, bodyHeight: 1, items: [], groups: [] });
  const live = useRef({ touched: new Set<number>(), lit: new Set<number>(), pointer: { x: -9999, y: -9999 } });
  const radar = useRef<Animation | null>(null);

  const works = useMemo(() => groups.flatMap((group, groupIndex) =>
    group.works.map((work) => ({ ...work, groupIndex }))), [groups]);

  const part = (index: number, key: keyof ItemParts) => (element: HTMLElement | null) => {
    items.current[index] = { ...items.current[index], [key]: element };
  };
  const skyPart = (key: Exclude<keyof SkyParts, 'blips'>) => (element: HTMLElement | null) => {
    sky.current[key] = element;
  };

  const paint = (offset: number, viewport: number, now: number) => {
    const { width, bodyHeight, items: placed, groups: groupBoxes } = geometry.current;
    const state = live.current;
    // El cielo se queda fijo mientras la sala ocupa la pantalla
    const skyTop = offset < 0 ? -offset : Math.min(0, bodyHeight - viewport - offset);

    // Luz de la sala Estelar: dónde está la estrella y cuánto ilumina
    let light = { x: 0, y: 0, power: 0 };
    if (kind === 'starlight') light = paintStar(sky.current, groupBoxes, offset, viewport, width, skyTop);

    let sweep = 0;
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

    if (kind === 'wheel' && sky.current.spokes) {
      // La rueda gira lo mismo que avanzan las obras sobre su borde
      const radius = viewport * (width < 720 ? 3.2 : 1.7);
      sky.current.spokes.style.transform = `rotate(${((offset / radius) * 180 / Math.PI).toFixed(3)}deg)`;
    }

    for (let index = 0; index < placed.length; index++) {
      const box = placed[index];
      const parts = items.current[index];
      const root = parts?.root;
      if (!root) continue;
      const top = box.top - offset;
      const centerY = top + box.height / 2;
      if (centerY < -viewport * 0.6 || centerY > viewport * 1.6) {
        if (state.touched.delete(index)) settleItem(parts);
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
        const radius = viewport * (width < 720 ? 3.2 : 1.7);
        const angle = Math.asin(clamp((centerY - viewport / 2) / radius, -0.8, 0.8));
        const shift = radius * (1 - Math.cos(angle));
        root.style.transform = `translate3d(${shift.toFixed(1)}px, 0, 0) rotate(${(-angle * (width < 720 ? 0.55 : 0.8) * 180 / Math.PI).toFixed(3)}deg)`;
      } else if (kind === 'blueprint') {
        // La impresión baja por la ventana del marco mientras la obra sube
        const printed = clamp01((viewport * 0.84 - top) / (viewport * 0.46));
        const percent = (printed * 100).toFixed(2);
        parts.print?.style.setProperty('transform', `translate3d(0, ${percent}%, 0)`);
        parts.sheet?.style.setProperty('transform', `translate3d(0, -${percent}%, 0)`);
        parts.print?.classList.toggle('is-printing', printed > 0.001 && printed < 0.999);
      } else if (kind === 'starlight') {
        const centerX = box.centerX;
        const frameCenterY = top + box.frameHeight / 2;
        const dx = centerX - light.x;
        const dy = frameCenterY - light.y;
        const distance = Math.hypot(dx, dy) || 1;
        const length = 16 + 26 * clamp01(distance / (width * 0.9));
        parts.shadow?.style.setProperty('transform', `translate3d(${((dx / distance) * length).toFixed(1)}px, ${((dy / distance) * length).toFixed(1)}px, 0)`);
        parts.shadow?.style.setProperty('opacity', (0.25 + light.power * 0.6).toFixed(3));
        // El lado del marco que mira a la estrella recibe su luz
        const rimX = (-dx / distance) * box.width * 0.7;
        const rimY = (-dy / distance) * box.frameHeight * 0.9;
        parts.rim?.style.setProperty('transform', `translate3d(${rimX.toFixed(1)}px, ${rimY.toFixed(1)}px, 0)`);
        parts.rim?.style.setProperty('opacity', (light.power * 0.9).toFixed(3));
      } else if (kind === 'silence') {
        const work = works[index];
        const echo = Math.exp(-sinceSweep(sweep, box.centerX - width / 2, centerY - viewport / 2) / 1.1);
        const pointer = state.pointer;
        const gapX = Math.max(0, Math.abs(pointer.x - box.centerX) - box.width / 2);
        const gapY = Math.max(0, Math.abs(pointer.y - centerY) - box.height / 2);
        const torch = 1 - smoothstep(40, 340, Math.hypot(gapX, gapY));
        const found = Math.max(echo, torch);
        if (work?.concept.id === DARK_FOREST) {
          // El bosque oscuro: lo que encuentra la luz se esconde
          root.style.opacity = (0.08 + 0.6 * (1 - found)).toFixed(3);
          root.style.transform = `scale(${(1 - found * 0.05).toFixed(4)})`;
        } else {
          root.style.opacity = (0.06 + found * 0.94).toFixed(3);
        }
      }
    }
  };

  const pauseRadar = () => radar.current?.pause();
  const refresh = useRoomLoop(bodyRef, scrollRef, (frame) => paint(frame.offset, frame.viewport, frame.now), {
    continuous: kind === 'silence',
    onIdle: kind === 'silence' ? pauseRadar : undefined,
  });

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const measure = () => {
      const bodyLeft = body.getBoundingClientRect().left;
      const placed = items.current.map((parts) => {
        const root = parts?.root;
        if (!root) return { top: 0, height: 0, centerX: 0, width: 0, frameHeight: 0 };
        const { top, left } = offsetWithin(root, body);
        const frame = root.querySelector<HTMLElement>('.mo-frame');
        return {
          top,
          height: root.offsetHeight,
          centerX: bodyLeft + left + root.offsetWidth / 2,
          width: root.offsetWidth,
          frameHeight: frame?.offsetHeight ?? root.offsetHeight,
        };
      });
      const groupBoxes = Array.from(body.querySelectorAll<HTMLElement>('.mo-topic-group')).map((group) => ({
        top: offsetWithin(group, body).top,
        height: group.offsetHeight,
      }));
      const width = document.documentElement.clientWidth;
      geometry.current = { width, bodyHeight: body.offsetHeight, items: placed, groups: groupBoxes };
      if (kind === 'wheel' && sky.current.sky) {
        const viewport = scrollRef.current?.clientHeight ?? window.innerHeight;
        sky.current.sky.style.setProperty('--wheel-r', `${Math.round(viewport * (width < 720 ? 3.2 : 1.7))}px`);
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

  const overlayFor = (index: number, concept: AstroConcept, plate: number) => {
    if (kind === 'blueprint') {
      return (
        <span className="mo-print" ref={part(index, 'print')} aria-hidden="true">
          <span className="mo-print-sheet" ref={part(index, 'sheet')}>
            <BlueprintDrawing title={concept.title} plate={plate} label={t("Plano de fabricación")} />
          </span>
        </span>
      );
    }
    if (kind === 'starlight') return <span className="mo-starlight-rim" ref={part(index, 'rim')} aria-hidden="true" />;
    return undefined;
  };

  let index = 0;
  return (
    <div className={`mo-room is-${kind}`} ref={bodyRef}>
      <div className="mo-room-sky" ref={skyPart('sky')} aria-hidden="true">
        {kind === 'wheel' && (
          <div className="mo-wheel">
            <span className="mo-wheel-rim" />
            <span className="mo-wheel-spokes" ref={skyPart('spokes')} />
          </div>
        )}
        {kind === 'blueprint' && <span className="mo-drafting-grid" />}
        {kind === 'starlight' && (
          <div className="mo-starlight-star" ref={skyPart('star')}>
            <span className="mo-starlight-jet" ref={skyPart('jet')} />
            <span className="mo-starlight-lift" ref={skyPart('lift')}>
              {[0, 1, 2, 3, 4].map((filament) => <i key={filament} />)}
            </span>
            <span className="mo-starlight-sun" ref={skyPart('sun')} />
            <span className="mo-starlight-mirror" ref={skyPart('mirror')} />
            <span className="mo-starlight-hole" ref={skyPart('hole')} />
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

      {groups.map((group) => {
        const elevator = kind === 'blueprint' && group.works.some(({ concept }) => concept.id === 'space-elevator');
        return (
          <section className="mo-topic-group" key={group.title} aria-label={group.title}>
            <TopicHeading title={group.title} />
            <div className="mo-wall">
              {elevator && (
                <span className="mo-cable" aria-hidden="true">
                  <span className="mo-cable-mark is-top">GEO · 35 786 km</span>
                  <span className="mo-cable-climber" />
                  <span className="mo-cable-mark is-bottom">0 km</span>
                </span>
              )}
              {group.works.map(({ concept, plate }) => {
                const current = index++;
                return (
                  <div className="mo-room-item" key={concept.id} data-concept={concept.id} ref={part(current, 'root')}>
                    {kind === 'spotlight' && (
                      <span className="mo-spot" ref={part(current, 'cone')} aria-hidden="true">
                        <span className="mo-spot-beam" />
                      </span>
                    )}
                    {kind === 'starlight' && <span className="mo-starlight-shadow" ref={part(current, 'shadow')} aria-hidden="true" />}
                    {renderObra(concept, plate, false, overlayFor(current, concept, plate))}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
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

const settleItem = (parts: ItemParts) => {
  parts.root?.style.removeProperty('transform');
  parts.root?.style.removeProperty('opacity');
  parts.shadow?.style.removeProperty('transform');
  parts.rim?.style.removeProperty('transform');
  parts.print?.style.removeProperty('transform');
  parts.sheet?.style.removeProperty('transform');
};

/* La estrella de la sala Estelar recorre tres actos, uno por grupo: se
   desplaza empujada por su espejo (Shkadov) dejando un chorro de luz, pierde
   materia hacia arriba y termina colapsando en un agujero negro. */
const paintStar = (
  parts: SkyParts,
  groups: Geometry['groups'],
  offset: number,
  viewport: number,
  width: number,
  skyTop: number,
) => {
  const progressIn = (index: number) => {
    const group = groups[index];
    if (!group) return 0;
    return clamp01((offset + viewport * 0.5 - group.top) / Math.max(1, group.height));
  };
  const moving = progressIn(0);
  const lifting = progressIn(1);
  const collapse = smoothstep(0.1, 0.75, progressIn(2));

  // Acto I: de izquierda a derecha, con el espejo delante y el chorro detrás
  const travel = smoothstep(0, 1, moving);
  let x = 0.16 + travel * 0.66;
  let y = 0.26 - travel * 0.06;
  // Acto III: la estrella colapsada vuelve al centro
  x += (0.5 - x) * collapse;
  y += (0.22 - y) * collapse;
  const thrust = smoothstep(0.02, 0.15, moving) * (1 - smoothstep(0.85, 1, moving));

  const px = x * width;
  const py = skyTop + y * viewport;
  parts.star?.style.setProperty('transform', `translate3d(${(x * width).toFixed(1)}px, ${(y * viewport).toFixed(1)}px, 0)`);
  parts.jet?.style.setProperty('opacity', (thrust * (1 - collapse)).toFixed(3));
  parts.mirror?.style.setProperty('opacity', (smoothstep(0, 0.12, moving) * (1 - smoothstep(0.2, 0.6, lifting)) * (1 - collapse)).toFixed(3));
  parts.lift?.style.setProperty('opacity', (smoothstep(0.05, 0.3, lifting) * (1 - collapse)).toFixed(3));
  const shrink = 1 - smoothstep(0, 1, lifting) * 0.2;
  parts.sun?.style.setProperty('opacity', (1 - collapse).toFixed(3));
  parts.sun?.style.setProperty('transform', `scale(${(shrink * (1 - collapse * 0.7)).toFixed(4)})`);
  parts.hole?.style.setProperty('opacity', collapse.toFixed(3));

  return { x: px, y: py, power: 1 - collapse * 0.35 };
};

/* Plano técnico de cada obra: retícula, cotas y su cajetín */
const BlueprintDrawing = ({ title, plate, label }: { title: string; plate: number; label: string }) => (
  <>
    <svg className="mo-print-lines" viewBox="0 0 210 90">
      <rect x="4" y="4" width="202" height="82" />
      <path className="is-faint" d="M4 4 L206 86 M206 4 L4 86" />
      <path className="is-dashed" d="M105 6 V84 M6 45 H204" />
      <circle cx="105" cy="45" r="31" />
      <circle className="is-faint" cx="105" cy="45" r="19" />
      <circle cx="105" cy="45" r="2.2" />
      <path d="M58 79 H152 M58 76.5 V81.5 M152 76.5 V81.5" />
      <path className="is-faint" d="M16 14 h10 M16 14 v6 M194 14 h-10 M194 14 v6" />
    </svg>
    <span className="mo-print-code">N.º {String(plate).padStart(2, '0')}</span>
    <span className="mo-print-title">
      {title}
      <small>{label}</small>
    </span>
  </>
);
