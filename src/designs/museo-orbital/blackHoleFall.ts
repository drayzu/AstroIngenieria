import { clamp01 } from './roomShared';

/* Ingeniería estelar: caemos a un agujero negro, trazado de verdad.

   Un shader sigue cada rayo de luz hacia atrás, desde la cámara, por el
   espacio curvo de un agujero de Schwarzschild: lo que se ve es lo que la
   gravedad deja ver. El cielo se dobla en el anillo de Einstein, el lado
   lejano del disco de acreción asoma por encima y por debajo de la sombra,
   y el gas que viene hacia nosotros brilla más (Doppler).

   El viaje, en primera persona:
   - Llegamos de lejos girando la cabeza hacia él; su gravedad se extiende
     desde la sombra y curva el cielo entero.
   - Bajamos hasta rozar el disco y volamos sobre él a contracorriente: el
     gas corre bajo nosotros y el arco del lado lejano se levanta como una
     pared de luz sobre la sombra.
   - Subimos sobre el remolino y caemos girando con él; dentro de la sombra
     se abre la ventana (el otro lado) y el anillo de fotones es su borde.

   Todo el cuadro es un solo pase de GPU a resolución reducida: el costo no
   depende de cuántas estrellas o anillos haya. */

type Range = [number, number];
type Key = [number, number];

export const HOLE = {
  // El cielo curvado se extiende desde el agujero hasta cubrir el nuestro
  lens: [0.02, 0.075],
  // La ventana que se abre dentro de la sombra
  open: [0.235, 0.29],
} satisfies Record<string, Range>;

const seg = (p: number, [from, to]: Range) => clamp01((p - from) / (to - from));
const RAD = Math.PI / 180;

/* Curvas de la cámara: claves [progreso, valor] unidas por una cúbica
   monótona, sin frenar en cada clave ni pasarse de largo */
const track = (keys: Key[]) => {
  const slopes = keys.map((_, index) => {
    if (index === 0 || index === keys.length - 1) return 0;
    const [x0, y0] = keys[index - 1];
    const [x1, y1] = keys[index];
    const [x2, y2] = keys[index + 1];
    const before = (y1 - y0) / (x1 - x0);
    const after = (y2 - y1) / (x2 - x1);
    if (before * after <= 0) return 0;
    // Media armónica: nunca se pasa de las claves vecinas
    return (2 * before * after) / (before + after);
  });
  return (p: number) => {
    if (p <= keys[0][0]) return keys[0][1];
    const last = keys.length - 1;
    if (p >= keys[last][0]) return keys[last][1];
    let index = 0;
    while (keys[index + 1][0] < p) index++;
    const [x0, y0] = keys[index];
    const [x1, y1] = keys[index + 1];
    const span = x1 - x0;
    const t = (p - x0) / span;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * y0 +
      (t3 - 2 * t2 + t) * span * slopes[index] +
      (-2 * t3 + 3 * t2) * y1 +
      (t3 - t2) * span * slopes[index + 1]
    );
  };
};

/* Distancia al agujero, en radios del horizonte: de lejos, a rozar el
   borde del disco, y la caída */
const DISTANCE = track([
  [0.02, 62],
  [0.07, 36],
  [0.12, 19],
  [0.17, 13.2],
  [0.205, 11],
  [0.29, 8.4],
]);
// Altura sobre el plano del disco (grados): casi de canto, rasante al volar
// sobre él, y al caer subimos sobre el remolino
const INCLINATION = track([
  [0.02, 11],
  [0.07, 7],
  [0.12, 2.2],
  [0.155, 0.85],
  [0.185, 1.6],
  [0.205, 6],
  [0.24, 34],
  [0.29, 62],
  [0.4, 72],
  [0.56, 78],
]);
// Cuánto lo hemos rodeado (grados): siempre a contracorriente del disco
const AZIMUTH = track([
  [0.02, 40],
  [0.07, 22],
  [0.17, -55],
  [0.29, -125],
  [0.56, -175],
]);
// Hacia dónde miramos respecto del agujero (grados): al llegar, de reojo;
// sobre el disco, una S como un piloto: hacia donde volamos y de vuelta;
// al caer, de frente
const LOOK_YAW = track([
  [0.02, 17],
  [0.07, 0],
  [0.095, 0],
  [0.135, -16],
  [0.172, 9],
  [0.205, 0],
]);
const LOOK_PITCH = track([
  [0.02, -10],
  [0.07, 0],
  [0.1, 0],
  [0.14, -6],
  [0.205, 0],
]);
// Ladeo de la cámara (grados): entra muy ladeada, se inclina hacia cada
// curva de la S sobre el disco y al caer gira con el remolino
const ROLL = track([
  [0.02, -24],
  [0.07, -6],
  [0.095, -2],
  [0.13, 11],
  [0.168, -10],
  [0.2, -2],
  [0.24, -45],
  [0.29, -135],
  [0.56, -250],
]);
// Exposición: el disco lejano brilla; cerca, llenando el cuadro, se baja
const EXPOSURE = track([
  [0.12, 1.4],
  [0.2, 1.05],
  [0.26, 0.72],
]);
// Rasante sobre el disco, el gas sacude la cámara
const TREMOR: Range = [0.1, 0.19];

// Distancia focal respecto del lado corto: gran angular al llegar y sobre el
// disco, para sentir la velocidad y la escala; al caer se cierra, así la
// sombra crece de golpe y el remolino entero queda alrededor sin pegarse a
// la cámara
const FOCAL = track([
  [0.19, 0.75],
  [0.29, 1.25],
]);
const focalPx = (p: number, width: number, height: number) => FOCAL(p) * Math.min(width, height);

// Radio angular de la sombra para quien está quieto a distancia `distance`
// (en radios del horizonte): sin α = (3√3/2)·√(1 − 1/r)/r
const shadowSine = (distance: number) => Math.min(1, ((3 * Math.sqrt(3)) / 2) * Math.sqrt(Math.max(0, 1 - 1 / distance)) / distance);
const shadowPx = (distance: number, focal: number) => {
  const sine = shadowSine(distance);
  return sine >= 1 ? Number.POSITIVE_INFINITY : focal * (sine / Math.sqrt(1 - sine * sine));
};
// Y al revés: a qué distancia la sombra mide `radius` píxeles
const distanceFor = (radius: number, focal: number) => {
  const sine = Math.sin(Math.atan(radius / focal));
  let near = 1.5;
  let far = 4000;
  for (let step = 0; step < 40; step++) {
    const middle = (near + far) / 2;
    if (shadowSine(middle) > sine) near = middle;
    else far = middle;
  }
  return (near + far) / 2;
};

/* Radio de la sombra en píxeles, antes de que la ventana cubra la pantalla.
   Desde que la cámara mira de frente, es la sombra que traza el shader */
export const holeRadius = (p: number, width: number, height: number) =>
  shadowPx(DISTANCE(p), focalPx(p, width, height));

// Ladeo de la cámara (rad), para girar el cielo de la página con ella
export const holeRoll = (p: number) => ROLL(p) * RAD;

// Las constelaciones de la página no pasan por la lente: se apagan mientras
// el cielo es el del agujero y vuelven cuando la ventana ya cubre
export const holeSkyHidden = (p: number) => seg(p, [0.02, 0.05]) * (1 - seg(p, [0.44, 0.52]));

/* ---------------- La cámara ---------------- */

type Vec3 = [number, number, number];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const normalize = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

interface Camera {
  eye: Vec3;
  right: Vec3;
  up: Vec3;
  forward: Vec3;
  focal: number;
}

// `radius`: si la ventana ya crece más que la sombra (al cubrir), la cámara
// sigue cayendo hasta que la sombra la iguale
const cameraAt = (p: number, width: number, height: number, time: number, radius = 0): Camera => {
  const focal = focalPx(p, width, height);
  let distance = DISTANCE(p);
  if (radius > shadowPx(distance, focal) + 0.5) distance = distanceFor(radius, focal);
  const tilt = INCLINATION(p) * RAD;
  const turn = AZIMUTH(p) * RAD;
  const eye: Vec3 = [distance * Math.cos(tilt) * Math.sin(turn), distance * Math.sin(tilt), distance * Math.cos(tilt) * Math.cos(turn)];
  // El temblor: dos o tres senos lentos, solo mientras rozamos el disco
  const tremor = Math.sin(Math.PI * seg(p, TREMOR)) ** 2 * 0.35 * RAD;
  const shakeYaw = tremor * (Math.sin(time * 7.3) + 0.6 * Math.sin(time * 13.1 + 1.7));
  const shakePitch = tremor * (Math.sin(time * 8.9 + 0.4) + 0.5 * Math.sin(time * 15.7 + 2.3));
  // De frente al agujero, y desde ahí el giro de la cabeza
  const toHole = normalize(scale(eye, -1));
  const sideways = normalize(cross(toHole, [0, 1, 0]));
  const above = cross(sideways, toHole);
  const yaw = LOOK_YAW(p) * RAD + shakeYaw;
  const pitch = LOOK_PITCH(p) * RAD + shakePitch;
  const forward = normalize(
    add(add(scale(toHole, Math.cos(yaw) * Math.cos(pitch)), scale(sideways, Math.sin(yaw) * Math.cos(pitch))), scale(above, Math.sin(pitch))),
  );
  const level = normalize(cross(forward, [0, 1, 0]));
  const lift = cross(level, forward);
  const roll = holeRoll(p);
  const right = add(scale(level, Math.cos(roll)), scale(lift, Math.sin(roll)));
  const up = add(scale(lift, Math.cos(roll)), scale(level, -Math.sin(roll)));
  return { eye, right, up, forward, focal };
};

/* Dónde cae el agujero en pantalla (px desde el centro), para girar el
   cielo de la página a su alrededor */
export const holeCenter = (p: number, width: number, height: number): [number, number] => {
  const { eye, right, up, forward, focal } = cameraAt(p, width, height, 0);
  const toHole = normalize(scale(eye, -1));
  const ahead = Math.max(0.05, dot(toHole, forward));
  return [(focal * dot(toHole, right)) / ahead, (-focal * dot(toHole, up)) / ahead];
};

/* ---------------- El shader ---------------- */

const VERT = `
attribute vec2 a_pos;
uniform vec2 u_view;
varying vec2 v_px;
void main() {
  // En píxeles CSS desde el centro, con y hacia abajo
  v_px = vec2(a_pos.x, -a_pos.y) * 0.5 * u_view;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 u_view;
uniform float u_focal;
uniform vec3 u_eye;
uniform vec3 u_right;
uniform vec3 u_up;
uniform vec3 u_forward;
// Hasta qué ángulo del agujero llega su cielo curvado (rad)
uniform float u_spread;
// Más allá de este radio, un rayo que se aleja ya no vuelve
uniform float u_escape;
// Tiempo del gas (s) y cuánto brilla el disco
uniform float u_time;
uniform float u_disk;
// Exposición: baja cuando el disco llena el cuadro, para que no se queme
uniform float u_exposure;
// La ventana (px CSS desde el centro) y el anillo que la bordea
uniform float u_window;
uniform float u_ring;
uniform float u_ringLight;
varying vec2 v_px;

const float R_IN = 3.0;
const float R_OUT = 24.0;
// Franjas del disco por cada radio del horizonte
const float LANES = 1.6;
const int STEPS = 180;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
float fbm3(vec3 p) {
  return 0.5 * noise(p) + 0.3 * noise(p * 2.03 + 17.1) + 0.2 * noise(p * 4.1 + 31.7);
}
float fbm(vec3 p) {
  float value = 0.0;
  float weight = 0.5;
  for (int octave = 0; octave < 4; octave++) {
    value += weight * noise(p);
    p = p * 2.03 + 17.1;
    weight *= 0.5;
  }
  return value;
}

// La temperatura del gas: blanco dorado adentro, naranjo al medio y rojo
// profundo afuera
vec3 heat(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.2) return mix(vec3(1.0, 0.94, 0.84), vec3(1.0, 0.81, 0.44), t / 0.2);
  if (t < 0.45) return mix(vec3(1.0, 0.81, 0.44), vec3(1.0, 0.55, 0.23), (t - 0.2) / 0.25);
  if (t < 0.75) return mix(vec3(1.0, 0.55, 0.23), vec3(0.93, 0.31, 0.16), (t - 0.45) / 0.3);
  return mix(vec3(0.93, 0.31, 0.16), vec3(0.6, 0.13, 0.1), (t - 0.75) / 0.25);
}

/* Una franja del disco: gira entera a la velocidad de Kepler de su radio
   (las de adentro mucho más rápido). Mezclando cada franja con la vecina el
   gas corre sin costuras y sin enrollarse sin fin. El ruido es largo a lo
   largo del giro y fino a lo ancho: vetas */
float lane(float index, float r, float azimuth) {
  float center = (index + 0.5) / LANES;
  float angle = azimuth + 1.3 * pow(R_IN / max(center, R_IN), 1.5) * u_time;
  vec2 around = vec2(cos(angle), sin(angle));
  float streaks = fbm(vec3(around * 2.3, r * 5.6 + index * 0.37));
  // Y grumos a lo largo del giro: dejan ver cuánto corre el gas
  float knots = noise(vec3(around * 9.0, r * 7.0 + index));
  return streaks * (0.8 + 0.4 * knots);
}

/* El disco donde el rayo lo cruza: luz y opacidad */
vec4 disk(vec3 hit, float r, vec3 ray) {
  float azimuth = atan(hit.z, hit.x);
  float band = r * LANES - 0.5;
  float index = floor(band);
  float gas = mix(lane(index, r, azimuth), lane(index + 1.0, r, azimuth), smoothstep(0.0, 1.0, fract(band)));
  float dense = smoothstep(0.22, 0.78, gas);
  // Filamentos: hebras finas y brillantes que siguen las vetas
  float ridge = 1.0 - abs(2.0 * fract(gas * 3.5) - 1.0);
  float strands = pow(ridge, 7.0);

  // El brillo cae hacia afuera; el borde de adentro se enciende de golpe
  float glow = smoothstep(R_IN, R_IN + 0.45, r) * pow(R_IN / r, 1.05) * (1.0 - smoothstep(12.0, R_OUT, r));
  // Doppler: el gas que viene hacia nosotros brilla más y más blanco
  vec3 flow = vec3(hit.z, 0.0, -hit.x) / r;
  float beta = min(0.62, sqrt(0.5 / r));
  float shift = sqrt(1.0 - beta * beta) / (1.0 + beta * dot(flow, normalize(ray)));
  shift *= sqrt(1.0 - 1.0 / r);
  float beam = mix(1.0, shift * shift * shift, 0.75);
  vec3 tone = heat((r - R_IN) / 9.0 + 0.1 - (shift - 0.9) * 0.5);
  vec3 light = tone * glow * beam * (0.3 + 1.1 * dense + 0.9 * strands) * 2.4;
  float cover = clamp(glow * (0.25 + 0.95 * dense) * 1.3, 0.0, 0.9);
  return vec4(light, cover);
}

vec3 starLayer(vec3 dir, float footprint, float cells, float density, float size, float gain) {
  vec3 at = dir * cells;
  vec3 cell = floor(at);
  vec3 seed = hash33(cell);
  if (seed.x > density) return vec3(0.0);
  vec3 offset = at - (cell + 0.3 + 0.4 * hash33(cell + 7.7));
  offset -= dir * dot(offset, dir);
  // Cada estrella mide al menos un píxel: lo que la lente achica no titila
  float spread = clamp(footprint * cells * 0.6, size, 0.22);
  float light = gain * (size * size) / (spread * spread) * exp(-dot(offset, offset) / (spread * spread));
  float bright = 0.12 + 2.4 * pow(seed.y, 9.0);
  vec3 tone = seed.z > 0.72 ? vec3(1.0, 0.86, 0.72) : seed.z < 0.22 ? vec3(0.78, 0.86, 1.0) : vec3(1.0, 0.98, 0.95);
  return tone * light * bright;
}

// El cielo de fondo: estrellas y una banda de galaxia, que la lente dobla
vec3 sky(vec3 dir, float footprint) {
  vec3 pole = normalize(vec3(0.3, 0.9, -0.32));
  float height = dot(dir, pole);
  float band = exp(-height * height / 0.03);
  float clouds = fbm(dir * 3.2);
  float dust = smoothstep(0.48, 0.68, fbm(dir * 7.0 + 3.1));
  float core = smoothstep(-0.2, 0.9, dot(dir, normalize(vec3(-0.7, 0.1, -0.7))));
  vec3 milky = mix(vec3(0.32, 0.4, 0.62), vec3(0.85, 0.66, 0.46), core);
  vec3 color = vec3(0.026, 0.028, 0.036) + milky * band * (0.05 + 0.26 * clouds * clouds) * (1.0 - 0.75 * dust);
  color += vec3(0.05, 0.07, 0.12) * exp(-height * height / 0.2) * clouds * 0.25;
  color += starLayer(dir, footprint, 150.0, 0.2, 0.06, 1.3);
  color += starLayer(dir, footprint, 52.0, 0.14, 0.05, 2.6);
  return color;
}

void main() {
  float from = length(v_px);
  // Dentro de la ventana no hay nada: ahí está el otro lado
  float open = u_window > 0.0 ? smoothstep(u_window - 0.8, u_window + 0.8, from) : 1.0;

  vec3 dir = normalize(u_forward * u_focal + u_right * v_px.x - u_up * v_px.y);
  vec3 pos = u_eye;
  vec3 vel = dir;
  vec3 spin = cross(pos, vel);
  float h2 = dot(spin, spin);
  float r = length(pos);
  vec3 pull = -1.5 * h2 * pos / (r * r * r * r * r);

  vec3 color = vec3(0.0);
  float alpha = 0.0;
  float haze = 0.0;
  float fate = 0.0; // 1: se escapó; -1: cayó
  for (int i = 0; i < STEPS; i++) {
    float dt = clamp(0.09 * r, 0.02, 6.0);
    vec3 before = pos;
    vel += pull * (0.5 * dt);
    pos += vel * dt;
    r = length(pos);
    pull = -1.5 * h2 * pos / (r * r * r * r * r);
    vel += pull * (0.5 * dt);
    // El gas caliente alrededor del disco y del anillo de fotones
    float lift = pos.y * pos.y * 1.6;
    float orbit = (r - 4.2) * 0.9;
    float rim = (r - 1.55) * 9.0;
    haze += (0.05 / ((1.0 + lift * lift) * (1.0 + orbit * orbit)) + 0.12 / (1.0 + rim * rim)) * dt;
    if (before.y * pos.y <= 0.0 && before.y != pos.y) {
      vec3 hit = mix(before, pos, before.y / (before.y - pos.y));
      float across = length(hit.xz);
      if (across > R_IN && across < R_OUT) {
        vec4 gas = disk(hit, across, vel);
        color += (1.0 - alpha) * gas.rgb * u_disk;
        alpha += (1.0 - alpha) * gas.a * u_disk;
        if (alpha > 0.97) break;
      }
    }
    if (r < 1.0) { fate = -1.0; break; }
    if (r > u_escape && dot(pos, vel) > 0.0) { fate = 1.0; break; }
  }
  if (fate == 0.0) fate = r > 2.0 ? 1.0 : -1.0;

  vec3 away = normalize(vel);
  // Cuánto se abre el cielo de un píxel al siguiente: cerca del anillo, mucho
  float footprint = length(fwidth(away));

  // El cielo del agujero cubre el nuestro desde la sombra hacia afuera
  float spread = 1.0 - smoothstep(u_spread * 0.08, u_spread, acos(clamp(dot(dir, normalize(-u_eye)), -1.0, 1.0)));
  if (fate > 0.0) {
    color += (1.0 - alpha) * sky(away, footprint) * spread;
    alpha += (1.0 - alpha) * spread;
  } else {
    alpha = 1.0;
  }
  color += vec3(1.0, 0.6, 0.32) * haze * u_disk * 0.55;

  // El anillo de fotones, de borde de la ventana
  float ring = u_ring > 0.0 ? exp(-pow((from - u_ring) / 1.4, 2.0)) : 0.0;
  color += vec3(1.0, 0.86, 0.62) * ring * 1.2 * u_ringLight;

  // Como película: lo brillante conserva su color y solo lo muy brillante
  // se quema hacia el blanco
  float light = dot(color, vec3(0.3, 0.55, 0.15));
  vec3 kept = min(vec3(1.0), color * (1.0 - exp(-light * u_exposure)) / max(light, 0.0001));
  color = mix(kept, vec3(1.0) - exp(-color * u_exposure), 0.4);
  // Como tras un visor: los bordes del cuadro, un poco más oscuros
  color *= 1.0 - 0.3 * smoothstep(0.3, 1.0, from / length(u_view * 0.5));
  alpha = max(alpha, max(color.r, max(color.g, color.b)));
  gl_FragColor = vec4(color, alpha) * open;
}
`;

/* ---------------- Montaje ---------------- */

interface Mount {
  gl: WebGLRenderingContext;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

const mounts = new WeakMap<HTMLCanvasElement, Mount | null>();

const mount = (canvas: HTMLCanvasElement): Mount | null => {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
  });
  if (!gl || !gl.getExtension('OES_standard_derivatives')) return null;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(shader));
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const names = ['view', 'focal', 'eye', 'right', 'up', 'forward', 'spread', 'escape', 'time', 'disk', 'exposure', 'window', 'ring', 'ringLight'];
  const uniforms = Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, `u_${name}`)]));
  return { gl, uniforms };
};

export interface HoleFrame {
  p: number;
  // Segundos de reloj, para que el gas siga corriendo con el scroll quieto
  time: number;
  // Tamaño en píxeles CSS y cuántos píxeles reales por cada uno
  width: number;
  height: number;
  resolution: number;
  // Radio de la sombra con lo que ya cubre la ventana, y de la ventana (px)
  radius: number;
  opening: number;
}

/* Compila el shader de antemano, en un rato libre: compilarlo al llegar
   traba el primer cuadro */
export const prepareHole = (canvas: HTMLCanvasElement) => {
  if (mounts.has(canvas)) return;
  canvas.width = 1;
  canvas.height = 1;
  paintHole(canvas, { p: 0.1, time: 0, width: 1, height: 1, resolution: 1, radius: 0, opening: 0 });
};

/* Dibuja un cuadro. Devuelve false si no hay WebGL */
export const paintHole = (canvas: HTMLCanvasElement, frame: HoleFrame) => {
  if (!mounts.has(canvas)) mounts.set(canvas, mount(canvas));
  const mounted = mounts.get(canvas);
  if (!mounted) return false;
  const { gl, uniforms: u } = mounted;
  const { p, time, width, height, resolution, radius, opening } = frame;
  const pixelWidth = Math.max(1, Math.round(width * resolution));
  const pixelHeight = Math.max(1, Math.round(height * resolution));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  gl.viewport(0, 0, pixelWidth, pixelHeight);
  const camera = cameraAt(p, width, height, time, radius);
  const distance = Math.hypot(...camera.eye);
  gl.uniform2f(u.view, width, height);
  gl.uniform1f(u.focal, camera.focal);
  gl.uniform3fv(u.eye, camera.eye);
  gl.uniform3fv(u.right, camera.right);
  gl.uniform3fv(u.up, camera.up);
  gl.uniform3fv(u.forward, camera.forward);
  // El cielo curvado nace en la sombra y en un instante cubre todo
  gl.uniform1f(u.spread, 0.08 * 50 ** seg(p, HOLE.lens));
  // Fuera del disco y alejándose, ya no vuelve a cruzarlo
  gl.uniform1f(u.escape, Math.max(distance * 1.02, 26));
  // El gas corre con el reloj y, más rápido, con el scroll
  gl.uniform1f(u.time, (time % 600) + p * 60);
  gl.uniform1f(u.disk, seg(p, [0.02, 0.045]));
  gl.uniform1f(u.exposure, EXPOSURE(p));
  gl.uniform1f(u.window, opening);
  gl.uniform1f(u.ring, p > HOLE.open[0] - 0.01 ? radius * 1.005 : 0);
  gl.uniform1f(u.ringLight, seg(p, [HOLE.open[0] - 0.01, HOLE.open[0] + 0.015]));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return true;
};
