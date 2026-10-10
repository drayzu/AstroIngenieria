import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { livingSignal, starFrame } from './livingHero';

/* Estrella viva: granulación que hierve, corona con protuberancias y un
   enjambre Dyson que se construye mientras miras. Los colectores que
   pasan delante del disco son siluetas; los de los lados brillan al
   reflejar la luz, y cerca del cursor giran sus espejos hacia ti.

   Todo el movimiento ocurre en la GPU: cada cuadro solo actualiza unos
   pocos uniforms y la cámara. */

const DEG = Math.PI / 180;
const BUILD_SECONDS = 75;

// Ruido simplex 3D (Ian McEwan, Ashima Arts; licencia MIT)
const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

/* ---------------- Disco de la estrella ---------------- */

const STAR_VERTEX = /* glsl */ `
varying vec3 vObject;
varying vec3 vViewNormal;
void main() {
  vObject = position;
  vViewNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const STAR_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uIgnite;
uniform float uFlash;
varying vec3 vObject;
varying vec3 vViewNormal;
${NOISE}
vec3 palette(float h) {
  vec3 deep = vec3(0.36, 0.03, 0.01);
  vec3 ember = vec3(0.82, 0.17, 0.03);
  vec3 orange = vec3(1.0, 0.45, 0.12);
  vec3 hot = vec3(1.0, 0.8, 0.52);
  vec3 c = mix(deep, ember, smoothstep(0.12, 0.42, h));
  c = mix(c, orange, smoothstep(0.42, 0.68, h));
  return mix(c, hot, smoothstep(0.74, 0.98, h));
}
void main() {
  vec3 p = normalize(vObject);
  float t = uTime * 0.02;
  // Granulación fina: gránulos brillantes y carriles oscuros muy delgados
  float g1 = smoothstep(0.0, 0.32, abs(snoise(p * 30.0 + vec3(t * 2.0, -t * 1.4, t))));
  float g2 = smoothstep(0.0, 0.32, abs(snoise(p * 64.0 + vec3(-t * 1.7, t * 2.2, -t))));
  float granules = g1 * 0.65 + g2 * 0.35;
  // Supergranulación y regiones activas: variaciones amplias de brillo
  float super = snoise(p * 6.0 + vec3(0.0, t * 0.8, t * 0.5));
  float activity = snoise(p * 1.7 + vec3(t * 0.3, 0.0, -t * 0.25));
  // Manchas: pocas, oscuras, donde la actividad es máxima
  float spots = smoothstep(0.8, 0.92, snoise(p * 2.2 + vec3(4.1, t * 0.2, 1.7)));
  float heat = 0.42 + granules * 0.28 + super * 0.08 + activity * 0.14 - spots * 0.3;
  float mu = clamp(vViewNormal.z, 0.0, 1.0);
  // Oscurecimiento hacia el borde y un filo rojizo en el limbo
  float limb = 0.3 + 0.7 * pow(mu, 0.55);
  vec3 color = palette(heat) * limb * 1.12;
  color += vec3(1.0, 0.24, 0.05) * pow(1.0 - mu, 2.4) * 0.38;
  color = mix(color, vec3(1.0, 0.94, 0.86) * 1.5, uFlash);
  gl_FragColor = vec4(color * uIgnite, 1.0);
}
`;

/* ---------------- Corona, protuberancias y llamaradas ---------------- */

const CORONA_RADIUS = 3.4;

const CORONA_VERTEX = /* glsl */ `
varying vec2 vPlane;
void main() {
  vPlane = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CORONA_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uIgnite;
uniform float uFlareAngle;
uniform float uFlareAge;
varying vec2 vPlane;
${NOISE}
void main() {
  float r = length(vPlane);
  if (r < 0.985) discard;
  vec2 dir = vPlane / r;
  float ang = atan(vPlane.y, vPlane.x);
  float h = r - 1.0;
  float glow = exp(-h * 3.4) * 0.8 + exp(-h * 0.9) * 0.2;
  float streams = snoise(vec3(dir * 1.7, uTime * 0.035 + h * 0.45)) * 0.5 + 0.5;
  streams = pow(streams, 2.4);
  // Espículas: un fleco fino de chorros radiales de altura cambiante
  float reach = 0.025 + 0.085 * smoothstep(0.1, 0.95, snoise(vec3(dir * 9.0, uTime * 0.06)) * 0.5 + 0.5);
  float strands = 0.55 + 0.45 * snoise(vec3(dir * 38.0, uTime * 0.12));
  float prom = (1.0 - smoothstep(0.0, reach, h)) * strands;
  // Llamarada: un chorro que nace del borde, crece hacia afuera y se apaga
  float da = atan(sin(ang - uFlareAngle), cos(ang - uFlareAngle));
  float front = 0.06 + uFlareAge * 0.65;
  float width = 0.06 + h * 0.22;
  float jet = exp(-(da * da) / (width * width))
    * (1.0 - smoothstep(front - 0.08, front + 0.06, h))
    * exp(-h * 1.6);
  float plume = jet * exp(-uFlareAge * 0.7) * step(0.0, uFlareAge) * smoothstep(0.0, 0.08, uFlareAge);
  float intensity = (glow * (0.42 + 0.78 * streams) + prom * 0.55 + plume * 3.0) * uIgnite;
  vec3 color = mix(vec3(0.95, 0.2, 0.04), vec3(1.0, 0.72, 0.44), clamp(intensity * 0.9 - 0.15, 0.0, 1.0));
  float alpha = clamp(intensity, 0.0, 1.0) * (1.0 - smoothstep(2.3, ${CORONA_RADIUS.toFixed(1)}, r));
  gl_FragColor = vec4(color, alpha);
}
`;

/* ---------------- Enjambre Dyson ---------------- */

const SWARM_VERTEX = /* glsl */ `
attribute vec4 aOrbit;
attribute vec4 aMotion;
uniform float uTime;
uniform float uBuild;
uniform float uIgnite;
uniform float uPixelRatio;
uniform float uViewHeight;
uniform float uAspect;
uniform float uScroll;
uniform vec2 uPointer;
uniform float uPointerOn;
varying float vLit;
varying float vFlash;
varying float vGlint;
varying float vAlpha;
mat3 rotX(float a) { float c = cos(a); float s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a); float s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
void main() {
  float age = uBuild - aMotion.y;
  if (age < 0.0 || uIgnite <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    return;
  }
  // Inserción: el colector llega en espiral desde fuera hasta su órbita
  float settle = 1.0 - pow(1.0 - clamp(age / 2.6, 0.0, 1.0), 3.0);
  float radius = mix(aOrbit.x * 2.3, aOrbit.x, settle);
  float angle = aOrbit.w + aMotion.x * uTime * (1.0 + uScroll * 1.4) - (1.0 - settle) * 3.0;
  vec3 pos = rotY(aOrbit.z) * rotX(aOrbit.y) * vec3(cos(angle) * radius, 0.0, sin(angle) * radius);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  // El panel mira a la estrella: de frente lo vemos encendido, de espaldas en silueta
  vec3 normal = normalize(-pos);
  vec3 view = normalize(cameraPosition - pos);
  vLit = dot(normal, view);
  // Destellos: cada espejo está algo inclinado y a veces refleja hacia nosotros
  vec3 tilt = vec3(fract(aMotion.w * 13.1), fract(aMotion.w * 7.3), fract(aMotion.w * 3.7)) - 0.5;
  vec3 reflected = reflect(normalize(pos), normalize(normal + tilt * 0.9));
  float glint = pow(max(dot(reflected, view), 0.0), 36.0);
  // Cerca del cursor los espejos giran hacia el visitante
  vec2 ndc = gl_Position.xy / gl_Position.w;
  vec2 gap = (ndc - uPointer) * vec2(uAspect, 1.0);
  float aimed = (1.0 - smoothstep(0.02, 0.26, length(gap))) * uPointerOn;
  vGlint = max(glint, aimed * (0.55 + 0.45 * fract(aMotion.w * 31.7)));
  vFlash = (1.0 - smoothstep(0.0, 0.45, age)) * 0.8;
  vAlpha = smoothstep(0.0, 0.3, age) * uIgnite;
  float size = aMotion.z * (1.0 + vFlash * 0.7 + vGlint * 1.1);
  gl_PointSize = size * uPixelRatio * (uViewHeight / 900.0) * (12.0 / -mv.z);
}
`;

const SWARM_FRAGMENT = /* glsl */ `
varying float vLit;
varying float vFlash;
varying float vGlint;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float soft = 1.0 - smoothstep(0.22, 0.5, d);
  vec3 lit = vec3(1.0, 0.78, 0.56) * (0.5 + 0.9 * smoothstep(0.0, 0.7, vLit));
  vec3 dark = vec3(0.03, 0.014, 0.01);
  vec3 color = vLit > 0.0 ? lit : dark;
  float spark = max(vFlash, vGlint);
  color = mix(color, vec3(1.0, 0.95, 0.86) * 1.5, spark);
  float alpha = max((vLit > 0.0 ? 1.0 : 0.94), spark) * soft * vAlpha;
  gl_FragColor = vec4(color, alpha);
}
`;

// Pseudoaleatorio estable: el enjambre es siempre el mismo
const seeded = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/* Familias de órbitas: anillos con su propia inclinación, como un enjambre
   que se llena por planos */
const FAMILIES = [
  { incline: 0.05, node: 0.0, inner: 1.3, outer: 1.7 },
  { incline: 0.42, node: 0.6, inner: 1.45, outer: 2.0 },
  { incline: -0.36, node: 2.1, inner: 1.55, outer: 2.2 },
  { incline: 0.78, node: 3.6, inner: 1.7, outer: 2.4 },
  { incline: -0.7, node: 4.7, inner: 1.85, outer: 2.6 },
  { incline: 1.12, node: 1.3, inner: 2.0, outer: 2.75 },
];

const buildSwarm = (count: number) => {
  const positions = new Float32Array(count * 3);
  const orbit = new Float32Array(count * 4);
  const motion = new Float32Array(count * 4);
  const seedFamily = Math.floor(count * 0.12);
  for (let index = 0; index < count; index++) {
    const family = FAMILIES[index % FAMILIES.length];
    const spread = (seeded(index + 11) - 0.5) + (seeded(index + 23) - 0.5);
    const radius = family.inner + (family.outer - family.inner) * seeded(index + 37) ** 1.3;
    orbit.set([
      radius,
      family.incline + spread * 0.07,
      family.node + (seeded(index + 53) - 0.5) * 0.12,
      seeded(index + 71) * Math.PI * 2,
    ], index * 4);
    // Unos pocos ya están en órbita; el resto llega a lo largo de la visita
    const birth = index < seedFamily ? 0 : ((index - seedFamily) / (count - seedFamily)) * BUILD_SECONDS + seeded(index + 89) * 0.8;
    motion.set([
      0.21 * radius ** -1.5,
      birth,
      0.7 + seeded(index + 97) * 1.0,
      seeded(index + 113),
    ], index * 4);
  }
  return { positions, orbit, motion };
};

const orbitGuide = (radius: number, incline: number, node: number) => {
  const points = new Float32Array(160 * 3);
  const rotation = new THREE.Matrix4().makeRotationY(node).multiply(new THREE.Matrix4().makeRotationX(incline));
  const point = new THREE.Vector3();
  for (let index = 0; index < 160; index++) {
    const angle = (index / 160) * Math.PI * 2;
    point.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius).applyMatrix4(rotation);
    points.set([point.x, point.y, point.z], index * 3);
  }
  return points;
};

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
// Se infla con un pequeño rebote, como si la presión la empujara de más
const easeOutBack = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

interface Pointer {
  x: number;
  y: number;
  on: number;
}

const Scene = ({ heroRef, count }: { heroRef: RefObject<HTMLElement | null>; count: number }) => {
  const star = useRef<THREE.Mesh>(null);
  const corona = useRef<THREE.Mesh>(null);
  const guideMaterial = useRef<THREE.LineBasicMaterial>(null);
  const pointer = useRef<Pointer>({ x: 0, y: 0, on: 0 });
  const smooth = useRef<Pointer>({ x: 0, y: 0, on: 0 });
  const readyMarked = useRef(false);

  const swarm = useMemo(() => buildSwarm(count), [count]);
  const guides = useMemo(() => FAMILIES.map((family) => orbitGuide((family.inner + family.outer) / 2, family.incline, family.node)), []);

  // Materiales propios: así los uniforms que se actualizan son los que usa la GPU
  const starUniforms = useMemo(() => ({ uTime: { value: 0 }, uIgnite: { value: 0 }, uFlash: { value: 0 } }), []);
  const coronaUniforms = useMemo(() => ({
    uTime: { value: 0 }, uIgnite: { value: 0 }, uFlareAngle: { value: 0 }, uFlareAge: { value: -1 },
  }), []);
  const swarmUniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBuild: { value: -1 },
    uIgnite: { value: 0 },
    uPixelRatio: { value: 1 },
    uViewHeight: { value: 900 },
    uAspect: { value: 1 },
    uScroll: { value: 0 },
    uPointer: { value: new THREE.Vector2() },
    uPointerOn: { value: 0 },
  }), []);
  const starMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    uniforms: starUniforms,
  }), [starUniforms]);
  const coronaMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: CORONA_VERTEX,
    fragmentShader: CORONA_FRAGMENT,
    uniforms: coronaUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [coronaUniforms]);
  const swarmMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: SWARM_VERTEX,
    fragmentShader: SWARM_FRAGMENT,
    uniforms: swarmUniforms,
    transparent: true,
    depthWrite: false,
  }), [swarmUniforms]);
  useEffect(() => () => {
    starMaterial.dispose();
    coronaMaterial.dispose();
    swarmMaterial.dispose();
  }, [starMaterial, coronaMaterial, swarmMaterial]);

  // Puntero y clics se escuchan en la ventana: el lienzo no recibe eventos
  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    let down = { x: 0, y: 0, at: 0 };
    const local = (event: PointerEvent) => {
      const hero = heroRef.current;
      if (!hero) return null;
      const rect = hero.getBoundingClientRect();
      return { rect, x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onMove = (event: PointerEvent) => {
      const point = local(event);
      if (!point) return;
      const inside = point.y >= 0 && point.y <= point.rect.height;
      pointer.current = {
        x: (point.x / point.rect.width) * 2 - 1,
        y: -((point.y / point.rect.height) * 2 - 1),
        on: inside && fine ? 1 : 0,
      };
    };
    const onDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY, at: performance.now() };
    };
    // Un clic breve sobre el hero lanza una llamarada desde el borde más cercano
    const onUp = (event: PointerEvent) => {
      if (!livingSignal.ignitedAt) return;
      if (performance.now() - down.at > 320 || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8) return;
      if (event.target instanceof Element && event.target.closest('button, a, input')) return;
      const point = local(event);
      if (!point || point.y < 0 || point.y > point.rect.height) return;
      const frame = starFrame(point.rect.width, point.rect.height);
      livingSignal.flareAngle = Math.atan2(frame.y - point.y, point.x - frame.x);
      livingSignal.flareAt = performance.now();
    };
    const onLeave = () => {
      pointer.current = { ...pointer.current, on: 0 };
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [heroRef]);

  useFrame((state) => {
    const { size, viewport } = state;
    const camera = state.camera as THREE.PerspectiveCamera;
    const now = performance.now();
    const time = state.clock.elapsedTime;
    const hero = heroRef.current;
    const root = hero?.closest<HTMLElement>('.mo-root');
    const scroll = hero && root ? clamp01(root.scrollTop / Math.max(1, hero.offsetHeight)) : 0;

    // Ignición: la estrella crece desde el punto de luz con un destello blanco
    const since = livingSignal.ignitedAt ? (now - livingSignal.ignitedAt) / 1000 : -1;
    const lit = since < 0 ? 0 : easeOut(clamp01(since / 0.7));
    const flash = since < 0 ? 0 : (1 - clamp01(since / 1.6)) ** 2;
    if (star.current) {
      star.current.visible = since >= 0;
      star.current.scale.setScalar(since < 0 ? 0.001 : 0.02 + 0.98 * easeOutBack(clamp01(since / 0.95)));
      star.current.rotation.y = time * 0.018;
    }
    if (corona.current) {
      corona.current.visible = since >= 0;
      corona.current.quaternion.copy(camera.quaternion);
      corona.current.scale.setScalar(star.current?.scale.x ?? 1);
    }

    // Cámara: el disco nace donde lo encendió la intro y luego se aparta hacia
    // su lugar junto al título (starFrame)
    const home = starFrame(size.width, size.height);
    const born = livingSignal.intro;
    const glide = since < 0 ? 0 : easeInOut(clamp01((since - 0.55) / 1.45));
    const frame = {
      x: born.fx * size.width + (home.x - born.fx * size.width) * glide,
      y: born.fy * size.height + (home.y - born.fy * size.height) * glide,
      r: born.fr * size.height + (home.r - born.fr * size.height) * glide,
    };
    const tangent = (frame.r / (size.height / 2)) * Math.tan((camera.fov * DEG) / 2);
    const distance = (Math.sqrt(1 + tangent * tangent) / tangent) * (1 + scroll * 0.85);
    const target = pointer.current;
    const current = smooth.current;
    current.x += (target.x - current.x) * 0.045;
    current.y += (target.y - current.y) * 0.045;
    current.on += (target.on - current.on) * 0.08;
    const azimuth = current.x * 0.1;
    const elevation = 0.2 + current.y * 0.05 + scroll * 0.25;
    camera.position.set(
      Math.sin(azimuth) * Math.cos(elevation) * distance,
      Math.sin(elevation) * distance,
      Math.cos(azimuth) * Math.cos(elevation) * distance,
    );
    camera.lookAt(0, 0, 0);
    const centerY = frame.y - scroll * size.height * 0.14;
    camera.setViewOffset(size.width, size.height, size.width / 2 - frame.x, size.height / 2 - centerY, size.width, size.height);
    camera.updateProjectionMatrix();

    starUniforms.uTime.value = time;
    starUniforms.uIgnite.value = lit;
    starUniforms.uFlash.value = flash;
    coronaUniforms.uTime.value = time;
    coronaUniforms.uIgnite.value = since < 0 ? 0 : easeOut(clamp01((since - 0.25) / 1.3));
    coronaUniforms.uFlareAngle.value = livingSignal.flareAngle;
    coronaUniforms.uFlareAge.value = (now - livingSignal.flareAt) / 1000;
    swarmUniforms.uTime.value = time;
    swarmUniforms.uBuild.value = since - 1.8;
    swarmUniforms.uIgnite.value = since < 0 ? 0 : clamp01((since - 1.6) / 1.2);
    swarmUniforms.uPixelRatio.value = viewport.dpr;
    swarmUniforms.uViewHeight.value = size.height;
    swarmUniforms.uAspect.value = size.width / size.height;
    swarmUniforms.uScroll.value = scroll;
    swarmUniforms.uPointer.value.set(current.x, current.y);
    swarmUniforms.uPointerOn.value = current.on;
    if (guideMaterial.current) guideMaterial.current.opacity = 0.07 * clamp01((since - 1) / 2);

    if (!readyMarked.current) {
      readyMarked.current = true;
      livingSignal.markReady();
    }
  });

  return (
    <>
      <mesh ref={star} visible={false}>
        <sphereGeometry args={[1, 160, 120]} />
        <primitive object={starMaterial} attach="material" />
      </mesh>
      <mesh ref={corona} visible={false} renderOrder={1}>
        <planeGeometry args={[CORONA_RADIUS * 2, CORONA_RADIUS * 2]} />
        <primitive object={coronaMaterial} attach="material" />
      </mesh>
      {guides.map((points, index) => (
        <lineLoop key={index} renderOrder={2}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[points, 3]} />
          </bufferGeometry>
          <lineBasicMaterial ref={index === 0 ? guideMaterial : undefined} color="#ffb48a" transparent opacity={0} depthWrite={false} />
        </lineLoop>
      ))}
      <points frustumCulled={false} renderOrder={3}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[swarm.positions, 3]} />
          <bufferAttribute attach="attributes-aOrbit" args={[swarm.orbit, 4]} />
          <bufferAttribute attach="attributes-aMotion" args={[swarm.motion, 4]} />
        </bufferGeometry>
        <primitive object={swarmMaterial} attach="material" />
      </points>
    </>
  );
};

/* Lienzo del hero: pausado fuera de pantalla; si el equipo no da abasto,
   baja la resolución */
export default function LivingStar({ heroRef, paused }: { heroRef: RefObject<HTMLElement | null>; paused: boolean }) {
  const narrow = typeof window !== 'undefined' && window.innerWidth < 720;
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio || 1, narrow ? 1.5 : 1.75));
  return (
    <Canvas
      className="mo-living-canvas"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      dpr={dpr}
      flat
      frameloop={paused ? 'never' : 'always'}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 30, near: 0.1, far: 100, position: [0, 0, 8] }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} />
      <Scene heroRef={heroRef} count={narrow ? 3600 : 7200} />
    </Canvas>
  );
}
