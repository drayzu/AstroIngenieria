import { startProgram, whenReady, type PendingProgram } from './glProgram';
/* Ingeniería planetaria: el suelo es Marte de verdad.

   El relieve viene del altímetro MOLA de la Mars Global Surveyor (NASA, de
   dominio público), en una franja de latitudes que va del polo norte al
   ecuador, a 4 puntos por grado: hacia el horizonte quedan las tierras bajas
   del norte (el futuro océano) y cerca, los volcanes de Tharsis. Cada altura se guarda
   en 16 bits (rojo y verde de una imagen sin pérdida).

   Un shader lo proyecta sobre la esfera del planeta, vista de canto: lo
   lejano se aprieta contra el horizonte y las formas se curvan con el borde.
   Se dibuja como un mapa topográfico: solo curvas de nivel finas.
   Con la terraformación el nivel del mar sube y el agua llena las zonas
   bajas siguiendo el relieve real; después la tierra reverdece desde la
   costa y nieva en las cumbres de los volcanes de Tharsis. */

const VERT = `
attribute vec2 a_pos;
uniform vec2 u_size;
varying vec2 v_px;
void main() {
  v_px = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5) * u_size;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform sampler2D u_height;
uniform vec2 u_texSize;
uniform vec2 u_size;
uniform float u_radius;
uniform float u_deepest;
uniform float u_turn;
uniform float u_sea;
uniform float u_seas;
uniform float u_green;
varying vec2 v_px;

// La franja del mapa (grados) y lo que se ve de ella, del horizonte hacia acá
const float NORTH = 84.0;
const float SOUTH = -20.0;
const float FAR = 74.0;
const float NEAR = 2.0;

float fetch(vec2 texel) {
  texel.x = mod(texel.x, u_texSize.x);
  texel.y = clamp(texel.y, 0.0, u_texSize.y - 1.0);
  vec4 value = texture2D(u_height, (texel + 0.5) / u_texSize);
  return floor(value.r * 255.0 + 0.5) * 256.0 + floor(value.g * 255.0 + 0.5) - 9000.0;
}

// Una línea de un píxel donde el valor cruza cada múltiplo de step
float hairline(float value, float step) {
  float c = value / step;
  float width = fwidth(c);
  float distance = abs(fract(c + 0.5) - 0.5);
  return (1.0 - smoothstep(0.5 * width, 1.5 * width, distance)) * (1.0 - smoothstep(0.25, 0.6, width));
}

// Interpolada a mano: los dos bytes de cada altura no se pueden mezclar
float heightAt(vec2 texel) {
  vec2 base = floor(texel - 0.5);
  vec2 mixAt = texel - 0.5 - base;
  float a = fetch(base);
  float b = fetch(base + vec2(1.0, 0.0));
  float c = fetch(base + vec2(0.0, 1.0));
  float d = fetch(base + vec2(1.0, 1.0));
  return mix(mix(a, b, mixAt.x), mix(c, d, mixAt.x), mixAt.y);
}

void main() {
  // La esfera, con su punto más alto en el borde de arriba al centro
  vec2 at = (v_px - vec2(u_size.x * 0.5, u_radius)) / u_radius;
  float r2 = dot(at, at);
  if (r2 >= 1.0) discard;
  float toward = sqrt(1.0 - r2);
  // 0 en el horizonte y 1 al pie del lienzo
  float depth = asin(toward) / u_deepest;
  // Más filas para lo lejano: el océano del norte no se aprieta en un hilo
  float lat = mix(FAR, NEAR, pow(depth, 1.7));
  float lon = u_turn + degrees(atan(at.x, -at.y)) * 2.0;
  vec2 texel = vec2(mod(lon, 360.0) * 4.0, (NORTH - lat) * 4.0);

  float h = heightAt(texel);
  float above = h - u_sea;
  float edge = max(fwidth(h), 1.0);
  float wet = smoothstep(edge, -edge, above);
  float coast = u_seas * (1.0 - smoothstep(0.0, 1.6 * edge, abs(above)));
  float meadow = u_green * smoothstep(-300.0, 400.0, above) * (1.0 - smoothstep(1500.0, 6500.0, above));
  float snow = u_green * smoothstep(13000.0, 17000.0, h);

  // Curvas de nivel: una cada 500 m y una más marcada cada 2500 m, de un
  // píxel. Donde el suelo se aprieta contra el horizonte se juntan: ahí se
  // apagan en vez de volverse una mancha
  float lines = hairline(h, 500.0) * 0.45 + hairline(h, 2500.0) * 0.55;
  // La tinta cambia con la terraformación: óxido, verde desde la costa y
  // blanco en las cumbres nevadas
  vec3 ink = mix(mix(vec3(0.86, 0.52, 0.36), vec3(0.62, 0.85, 0.52), meadow), vec3(0.92, 0.95, 1.0), snow);
  vec3 seaInk = vec3(0.45, 0.68, 0.85);
  vec3 color = vec3(0.03, 0.03, 0.035) + ink * lines * (1.0 - wet) * 0.85;
  // Bajo el agua las curvas casi desaparecen; la costa es la línea más
  // brillante y sube con el mar
  color += seaInk * wet * hairline(h, 1000.0) * 0.18;
  color = mix(color, vec3(0.03, 0.05, 0.08), wet * 0.5) + seaInk * coast * 1.1;

  // Hacia el horizonte el aire se espesa y apaga los detalles
  color = mix(vec3(0.03, 0.035, 0.045), color, 1.0 - pow(1.0 - depth, 4.0) * 0.6);
  gl_FragColor = vec4(color, 1.0);
}
`;

export interface MarsState {
  // Avance de la pared (px), radio del planeta (px) y la terraformación
  wall: number;
  radius: number;
  seas: number;
  green: number;
}

interface Mount {
  draw: (state: MarsState) => void;
}

const mounts = new WeakMap<HTMLCanvasElement, Mount | null>();

// La longitud del centro al empezar. El corredor recorre unos 290°: de
// noche y seco pasa Arabia Terra; el mar llena Utopía y las llanuras de
// Elysium; y al reverdecer llegan Tharsis, el Monte Olimpo nevado y la
// costa de Chryse
const START_LONGITUDE = 12;
// Nivel del mar al principio (bajo el fondo más hondo) y al final
const DRY = -8600;
const OCEAN = -2500;

interface Started {
  gl: WebGLRenderingContext;
  pending: PendingProgram;
  image: HTMLImageElement;
}

// Contexto, shader (compila en segundo plano) y relieve (se descarga)
const begin = (canvas: HTMLCanvasElement): Started | null => {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' });
  if (!gl || !gl.getExtension('OES_standard_derivatives')) return null;
  const image = new Image();
  image.decoding = 'async';
  // La versión en la dirección evita que quede en caché una franja anterior
  image.src = `${import.meta.env.BASE_URL}textures/mars-mola-band.webp?v=2`;
  return { gl, pending: startProgram(gl, VERT, FRAG), image };
};

const complete = (canvas: HTMLCanvasElement, { gl, pending, image }: Started): Mount | null => {
  const program = pending.finish();
  if (!program) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const u = {
    size: uniform('u_size'),
    texSize: uniform('u_texSize'),
    radius: uniform('u_radius'),
    deepest: uniform('u_deepest'),
    turn: uniform('u_turn'),
    sea: uniform('u_sea'),
    seas: uniform('u_seas'),
    green: uniform('u_green'),
  };

  let ready = false;
  let last: MarsState | null = null;
  const texture = gl.createTexture();
  const upload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Los bytes tal cual: son alturas, no colores
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform2f(u.texSize, image.naturalWidth, image.naturalHeight);
    ready = true;
    if (last) draw(last);
  };

  const draw = (state: MarsState) => {
    last = state;
    if (!ready) return;
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    gl.viewport(0, 0, pixelWidth, pixelHeight);
    const radius = Math.max(height + 1, state.radius);
    gl.uniform2f(u.size, width, height);
    gl.uniform1f(u.radius, radius);
    // Qué tan de frente se ve el suelo al pie del lienzo
    const below = (radius - height) / radius;
    gl.uniform1f(u.deepest, Math.asin(Math.sqrt(1 - below * below)));
    // El planeta gira con la pared: en el borde, un grado del mapa son
    // tantos píxeles como los que avanza la pared por grado
    gl.uniform1f(u.turn, START_LONGITUDE + (state.wall * 0.55 * 360) / (Math.PI * radius));
    gl.uniform1f(u.sea, DRY + (OCEAN - DRY) * state.seas);
    gl.uniform1f(u.seas, state.seas);
    gl.uniform1f(u.green, state.green);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  if (image.complete && image.naturalWidth) upload();
  else image.onload = upload;
  return { draw };
};

const linking = new WeakMap<HTMLCanvasElement, Started>();
// Lo último que se pidió dibujar mientras el shader compilaba
const waiting = new WeakMap<HTMLCanvasElement, MarsState>();

/* Lo prepara en segundo plano: compilar el shader y subir el relieve no
   traban ningún cuadro */
const prepare = (canvas: HTMLCanvasElement) => {
  if (linking.has(canvas)) return;
  const started = begin(canvas);
  if (!started) {
    mounts.set(canvas, null);
    return;
  }
  linking.set(canvas, started);
  whenReady(started.pending, () => {
    linking.delete(canvas);
    const mounted = complete(canvas, started);
    mounts.set(canvas, mounted);
    const state = waiting.get(canvas);
    waiting.delete(canvas);
    if (state) mounted?.draw(state);
  });
};

/* Si aún no está listo, lo prepara y lo dibuja apenas termine (unos
   cuadros después, como ya pasaba al llegar el relieve descargado) */
export const paintMarsGround = (canvas: HTMLCanvasElement, state: MarsState) => {
  const mounted = mounts.get(canvas);
  if (mounted !== undefined) {
    mounted?.draw(state);
    return;
  }
  waiting.set(canvas, state);
  prepare(canvas);
};
