import { cancelFrame, frame } from 'framer-motion';
import { isScrollWarping } from './chapterWarp';
import { isObraFlightRunning } from './obraFlight';

/* Mirar alrededor: el visitante gira un poco la cabeza y el mundo responde
   como una cámara. Con el mouse, la vista se va hacia donde se mueve el
   puntero; en el teléfono, hacia donde se gira el teléfono. Al quedarse
   quieto, la vista vuelve sola al frente con un muelle suave.

   Es la única fuente: { yaw, pitch } en radianes (yaw > 0 mira a la
   derecha, pitch > 0 mira hacia arriba). El cielo lo lee en su propio
   cuadro; los portales y las salas se suscriben y solo vuelven a dibujar
   mientras la mirada se mueve. Sin movimiento no corre ningún bucle.

   El muelle se resuelve en forma cerrada y se evalúa con el reloj del
   cuadro (document.timeline): el cielo, los portales y las salas leen el
   mismo valor en el mismo cuadro, sin un cuadro de atraso entre ellos. */

// Cuánto se gira, como mucho: unos grados a los lados y menos arriba y abajo
const YAW = 0.052;
const PITCH = 0.03;
// Muelles (rad/s, amortiguados críticos): seguir al gesto y volver al frente
const FOLLOW = 6.5;
const RETURN = 3.2;
// Tras este rato sin gestos la vista vuelve al frente
const HOLD_MS = 1600;
// Mouse: zona muerta al centro y cuánto hay que moverlo para mirar del todo
const DEAD_ZONE = 0.1;
const ENGAGE_PX = 260;
// Teléfono: grados de giro para mirar del todo, temblor que se ignora y
// cuánto tarda en volverse neutro un teléfono que se queda inclinado
const TILT_FULL = 11;
const TILT_DEAD = 0.5;
const RECENTER_S = 2.6;

export interface Look {
  yaw: number;
  pitch: number;
}

/* ---------------- El muelle ---------------- */

// Un tramo del muelle: desde t0, con valor y velocidad iniciales, hacia el objetivo
const spring = {
  t0: 0,
  omega: FOLLOW,
  x0: [0, 0],
  v0: [0, 0],
  target: [0, 0],
  rest: true,
};

const clock = () => {
  const time = document.timeline?.currentTime;
  return typeof time === 'number' ? time : performance.now();
};

// Valor y velocidad de un eje en el instante t (ms)
const sample = (axis: number, t: number, out: number[]) => {
  const target = spring.target[axis];
  if (spring.rest) {
    out[0] = target;
    out[1] = 0;
    return;
  }
  const tau = Math.max(0, t - spring.t0) / 1000;
  const omega = spring.omega;
  const d0 = spring.x0[axis] - target;
  const c = spring.v0[axis] + omega * d0;
  const decay = Math.exp(-omega * tau);
  out[0] = target + (d0 + c * tau) * decay;
  out[1] = (spring.v0[axis] - omega * c * tau) * decay;
};

const scratch = [0, 0];
const retarget = (yaw: number, pitch: number, omega: number) => {
  if (spring.rest && spring.target[0] === yaw && spring.target[1] === pitch) return;
  if (!spring.rest && spring.target[0] === yaw && spring.target[1] === pitch && spring.omega === omega) return;
  // Parte desde donde va ahora, con su velocidad: sin saltos
  const now = performance.now();
  for (let axis = 0; axis < 2; axis++) {
    sample(axis, now, scratch);
    spring.x0[axis] = scratch[0];
    spring.v0[axis] = scratch[1];
  }
  spring.t0 = now;
  spring.omega = omega;
  spring.target[0] = yaw;
  spring.target[1] = pitch;
  spring.rest = false;
  wake();
};

/* ---------------- Lectura ---------------- */

// El valor del cuadro, con sus senos y cosenos: se calcula una vez por cuadro
interface LookFrame extends Look {
  at: number;
  cosYaw: number;
  sinYaw: number;
  cosPitch: number;
  sinPitch: number;
}
const current: LookFrame = { at: -1, yaw: 0, pitch: 0, cosYaw: 1, sinYaw: 0, cosPitch: 1, sinPitch: 0 };

export const readLook = (): Readonly<LookFrame> => {
  const t = clock();
  if (t === current.at) return current;
  current.at = t;
  sample(0, t, scratch);
  const yaw = scratch[0];
  sample(1, t, scratch);
  const pitch = scratch[0];
  if (yaw !== current.yaw || pitch !== current.pitch) {
    current.yaw = yaw;
    current.pitch = pitch;
    current.cosYaw = Math.cos(yaw);
    current.sinYaw = Math.sin(yaw);
    current.cosPitch = Math.cos(pitch);
    current.sinPitch = Math.sin(pitch);
  }
  return current;
};

// Si la mirada se está moviendo (los que dibujan con el scroll quieto)
export const lookMoving = () => !spring.rest;

/* ---------------- Suscripción ---------------- */

const listeners = new Set<() => void>();
export const onLook = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/* El bucle corre en el cuadro de framer, en su paso de actualización: lo
   que los suscriptores encargan para el paso de pintura sale en el mismo
   cuadro, junto con el avance del scroll de los portales */
let running = false;
const tick = () => {
  if (!enabled) {
    stop();
    return;
  }
  if (spring.target[0] !== 0 || spring.target[1] !== 0) {
    if (blocked()) retarget(0, 0, RETURN);
  }
  const t = clock();
  sample(0, t, scratch);
  const yawDone = Math.abs(scratch[0] - spring.target[0]) < 2e-5 && Math.abs(scratch[1]) < 2e-4;
  sample(1, t, scratch);
  const pitchDone = Math.abs(scratch[0] - spring.target[1]) < 2e-5 && Math.abs(scratch[1]) < 2e-4;
  if (yawDone && pitchDone) {
    // Quieta: queda justo en el objetivo y el bucle se detiene
    spring.rest = true;
    current.at = -1;
    stop();
  }
  listeners.forEach((listener) => listener());
};
const wake = () => {
  if (running || !enabled) return;
  running = true;
  frame.update(tick, true);
};
const stop = () => {
  if (!running) return;
  running = false;
  cancelFrame(tick);
};

/* ---------------- Cuándo no se mira ---------------- */

let enabled = false;
let held = false;
let warpOverlay: HTMLCollectionOf<Element> | null = null;
const blocked = () => {
  if (held || isScrollWarping() || isObraFlightRunning()) return true;
  // El salto entre capítulos: su velo vive fuera del museo, en el body
  warpOverlay ??= document.getElementsByClassName('mo-warp');
  const overlay = warpOverlay[0];
  return Boolean(overlay?.classList.contains('is-active'));
};

/* ---------------- Mouse ---------------- */

let engage = 0;
let lastX = Number.NaN;
let lastY = Number.NaN;
let lastInput = 0;
let idleTimer = 0;

const shape = (value: number) => {
  const magnitude = Math.min(1, Math.max(0, (Math.abs(value) - DEAD_ZONE) / (1 - DEAD_ZONE)));
  return Math.sign(value) * magnitude * magnitude * (3 - 2 * magnitude);
};

// Sin gestos por un rato, la vista vuelve al frente
const armIdle = () => {
  lastInput = performance.now();
  if (idleTimer) return;
  const check = () => {
    const left = HOLD_MS - (performance.now() - lastInput);
    if (left > 16) {
      idleTimer = window.setTimeout(check, left);
      return;
    }
    idleTimer = 0;
    engage = 0;
    retarget(0, 0, RETURN);
  };
  idleTimer = window.setTimeout(check, HOLD_MS);
};

const onPointerMove = (event: PointerEvent) => {
  if (event.pointerType === 'touch') return;
  const { clientX: x, clientY: y } = event;
  const moved = Number.isNaN(lastX) ? 0 : Math.hypot(x - lastX, y - lastY);
  lastX = x;
  lastY = y;
  if (blocked()) {
    engage = 0;
    retarget(0, 0, RETURN);
    return;
  }
  // Mirar del todo pide un gesto: un roce del mouse apenas gira la vista
  engage = Math.min(1, engage + moved / ENGAGE_PX);
  if (engage <= 0) return;
  const width = window.innerWidth || 1;
  const height = window.innerHeight || 1;
  const nx = shape((x / width - 0.5) * 2);
  const ny = shape((y / height - 0.5) * 2);
  retarget(nx * YAW * engage, -ny * PITCH * engage, FOLLOW);
  armIdle();
};

const onPointerLeave = () => {
  engage = 0;
  lastX = Number.NaN;
  retarget(0, 0, RETURN);
};

/* ---------------- Teléfono ---------------- */

// Inclinación de referencia (grados), que sigue despacio a la real
let baseX = Number.NaN;
let baseY = Number.NaN;
let lastTilt = 0;

// Diferencia de ángulos en grados por el camino corto
const wrap = (degrees: number) => ((((degrees + 180) % 360) + 360) % 360) - 180;
const dead = (degrees: number) => Math.sign(degrees) * Math.max(0, Math.abs(degrees) - TILT_DEAD);

const onOrientation = (event: DeviceOrientationEvent) => {
  const { beta, gamma } = event;
  if (beta === null || gamma === null) return;
  // Lo que es girar a los lados y cabecear depende de cómo se sostiene
  const angle = screen.orientation?.angle ?? 0;
  let x = gamma;
  let y = beta;
  if (angle === 90) {
    x = beta;
    y = -gamma;
  } else if (angle === 270 || angle === -90) {
    x = -beta;
    y = gamma;
  } else if (angle === 180) {
    x = -gamma;
    y = -beta;
  }
  const now = performance.now();
  if (Number.isNaN(baseX) || now - lastTilt > 1000) {
    baseX = x;
    baseY = y;
  } else {
    const follow = 1 - Math.exp(-(now - lastTilt) / 1000 / RECENTER_S);
    baseX += wrap(x - baseX) * follow;
    baseY += wrap(y - baseY) * follow;
  }
  lastTilt = now;
  if (blocked()) {
    retarget(0, 0, RETURN);
    return;
  }
  // Girar el teléfono hacia un lado mira hacia ese lado; inclinar su borde
  // de arriba hacia atrás mira hacia abajo, como por una ventana
  const yaw = Math.max(-1, Math.min(1, dead(wrap(x - baseX)) / TILT_FULL)) * YAW;
  const pitch = -Math.max(-1, Math.min(1, dead(wrap(y - baseY)) / TILT_FULL)) * PITCH;
  // El sensor llega 60 veces por segundo: un cambio de fracción de píxel no
  // reinicia el muelle (salvo para llegar justo al frente)
  const still = Math.abs(yaw - spring.target[0]) < 2.5e-4 && Math.abs(pitch - spring.target[1]) < 2.5e-4;
  if (still && (yaw || pitch)) return;
  retarget(yaw, pitch, FOLLOW);
};

// iOS pide permiso desde un gesto: se pregunta en el primer toque, sin
// ningún aviso propio (el sistema muestra el suyo una sola vez)
type OrientationPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };
let asked = false;
let asking = false;
const listenOrientation = () => window.addEventListener('deviceorientation', onOrientation, { passive: true });
const waitForTap = (on: boolean) => {
  const method = on ? 'addEventListener' : 'removeEventListener';
  window[method]('touchend', askOrientation, { passive: true });
  window[method]('click', askOrientation, { passive: true });
};
const askOrientation = () => {
  if (asked || asking) return;
  const request = (window.DeviceOrientationEvent as unknown as OrientationPermission | undefined)?.requestPermission;
  if (!request) return;
  asking = true;
  request.call(window.DeviceOrientationEvent)
    .then((state) => {
      asked = true;
      waitForTap(false);
      if (state === 'granted' && enabled) listenOrientation();
    })
    // Un toque que no cuenta como gesto (el fin de un arrastre): el próximo
    .catch(() => {})
    .finally(() => {
      asking = false;
    });
};

/* ---------------- Encendido ---------------- */

const reduced = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
let users = 0;
let stopTimer = 0;

const attach = () => {
  if (enabled || reduced?.matches) return;
  enabled = true;
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onPointerLeave, { passive: true });
  window.addEventListener('blur', onPointerLeave, { passive: true });
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (coarse && 'DeviceOrientationEvent' in window) {
    const needsPermission = typeof (window.DeviceOrientationEvent as unknown as OrientationPermission).requestPermission === 'function';
    if (!needsPermission) listenOrientation();
    else if (!asked) waitForTap(true);
    else listenOrientation();
  }
};

const detach = () => {
  if (!enabled) return;
  enabled = false;
  window.removeEventListener('pointermove', onPointerMove);
  document.documentElement.removeEventListener('pointerleave', onPointerLeave);
  window.removeEventListener('blur', onPointerLeave);
  window.removeEventListener('deviceorientation', onOrientation);
  waitForTap(false);
  window.clearTimeout(idleTimer);
  idleTimer = 0;
  engage = 0;
  baseX = Number.NaN;
  // Apagada, la vista queda al frente de inmediato
  spring.rest = true;
  spring.target[0] = 0;
  spring.target[1] = 0;
  current.at = -1;
  stop();
  listeners.forEach((listener) => listener());
};

const onReducedChange = () => {
  if (reduced?.matches) detach();
  else if (users > 0) attach();
};

/* Enciende la mirada mientras alguien la use. `hold` la deja al frente
   (estudio, menú o juego abiertos). Devuelve la función que la suelta: un
   cambio de `hold` suelta y vuelve a tomar en el mismo cuadro sin apagarla */
export const startLookAround = (hold = false) => {
  users += 1;
  window.clearTimeout(stopTimer);
  if (users === 1) reduced?.addEventListener('change', onReducedChange);
  attach();
  held = hold;
  if (hold) {
    engage = 0;
    retarget(0, 0, RETURN);
  }
  return () => {
    users -= 1;
    window.clearTimeout(stopTimer);
    stopTimer = window.setTimeout(() => {
      if (users > 0) return;
      reduced?.removeEventListener('change', onReducedChange);
      held = false;
      detach();
    }, 0);
  };
};

/* ---------------- La mirada en una cámara ---------------- */

type Vec = number[];

/* Gira la base de una cámara (adelante, derecha, abajo) según la mirada:
   el rumbo alrededor de su eje vertical y el cabeceo alrededor del lateral.
   Así la escena 3D gira de verdad, no se corre como una imagen plana */
export const lookTurn = <T extends { forward: Vec; right: Vec; down: Vec }>(camera: T, look: Look = readLook()): T => {
  const { yaw, pitch } = look;
  if (!yaw && !pitch) return camera;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const { forward: f, right: r, down: d } = camera;
  // Rumbo: adelante va hacia la derecha
  const f1 = [f[0] * cy + r[0] * sy, f[1] * cy + r[1] * sy, f[2] * cy + r[2] * sy];
  const right = [r[0] * cy - f[0] * sy, r[1] * cy - f[1] * sy, r[2] * cy - f[2] * sy];
  // Cabeceo: adelante sube (hacia el contrario de abajo)
  const forward = [f1[0] * cp - d[0] * sp, f1[1] * cp - d[1] * sp, f1[2] * cp - d[2] * sp];
  const down = [d[0] * cp + f1[0] * sp, d[1] * cp + f1[1] * sp, d[2] * cp + f1[2] * sp];
  return { ...camera, forward, right, down } as T;
};

/* La mirada vista desde una cámara que rueda la imagen después de
   proyectar: el giro de cabeza va en los ejes de la pantalla, no en los
   de la cámara sin rodar. `roll` en el sentido en que la cámara rota la
   imagen (radianes, horario en pantalla) */
export const lookRolled = (roll: number, look: Look = readLook()): Look => {
  if (!roll || (!look.yaw && !look.pitch)) return look;
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  return { yaw: look.yaw * cos - look.pitch * sin, pitch: look.pitch * cos + look.yaw * sin };
};

/* Un punto en coordenadas de cámara (x derecha, y abajo, z adelante),
   girado según la mirada; se escribe en `out` */
export const lookView = (x: number, y: number, z: number, out: Vec, look = readLook()) => {
  const { cosYaw: cy, sinYaw: sy, cosPitch: cp, sinPitch: sp } = look;
  const x1 = x * cy - z * sy;
  const z1 = z * cy + x * sy;
  out[0] = x1;
  out[1] = y * cp + z1 * sp;
  out[2] = z1 * cp - y * sp;
  return out;
};

/* Un punto de la pantalla tal como se vería con la cabeza girada: girar la
   cámara sobre su centro es exactamente esta homografía, sin importar la
   profundidad de lo que se mira. `focal` en píxeles, (cx, cy) el centro */
export const lookWarp = (x: number, y: number, cx: number, cy: number, focal: number, out: Vec, look = readLook()) => {
  if (!look.yaw && !look.pitch) {
    out[0] = x;
    out[1] = y;
    return out;
  }
  lookView(x - cx, y - cy, focal, out, look);
  const depth = Math.max(focal * 0.05, out[2]);
  out[0] = cx + (focal * out[0]) / depth;
  out[1] = cy + (focal * out[1]) / depth;
  return out;
};

/* Dónde queda lo que estaba al centro de la pantalla (px desde el centro):
   las ventanas de los portales se abren en lo que la cámara mira */
export const lookShift = (focal: number, look: Look = readLook()): [number, number] => {
  if (!look.yaw && !look.pitch) return [0, 0];
  return [(-focal * Math.tan(look.yaw)) / Math.cos(look.pitch), focal * Math.tan(look.pitch)];
};
