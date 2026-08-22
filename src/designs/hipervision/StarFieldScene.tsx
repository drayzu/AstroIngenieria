import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface WarpSignal {
  current: number;
}

const warpEnvelope = (nowMs: number, triggeredAtMs: number): number => {
  if (triggeredAtMs <= 0) return 0;
  const dt = (nowMs - triggeredAtMs) / 1000;
  if (dt < 0 || dt > 1.6) return 0;
  const attack = Math.min(1, dt / 0.12);
  return attack * Math.exp(-Math.max(0, dt - 0.12) * 2.6);
};

const STAR_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uWarp;
  attribute float aSeed;
  varying float vSeed;
  varying float vFade;
  void main() {
    vec3 p = position;
    float speed = 3.5 + aSeed * 4.5;
    p.z = mod(p.z + uTime * speed * (1.0 + uWarp * 34.0), 260.0) - 250.0;
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = (1.05 + aSeed * 2.3) * (1.0 + uWarp * 1.9);
    gl_PointSize = size * (150.0 / max(1.0, -mv.z));
    vFade = smoothstep(-250.0, -215.0, p.z) * smoothstep(8.0, -16.0, p.z);
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uWarp;
  varying float vSeed;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.04, d);
    vec3 cool = vec3(0.60, 0.78, 1.0);
    vec3 warm = vec3(1.0, 0.85, 0.64);
    vec3 col = mix(cool, warm, step(0.84, fract(vSeed * 13.7)));
    col = mix(col, vec3(0.86, 0.96, 1.0), 0.22);
    float twinkle = 0.72 + 0.28 * sin(uTime * (0.8 + vSeed * 2.2) + vSeed * 40.0);
    gl_FragColor = vec4(col, alpha * vFade * twinkle * mix(0.62, 1.0, uWarp));
  }
`;

function Stars({ count, warpSignal }: { count: number; warpSignal: WarpSignal }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 150;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 2] = 10 - Math.random() * 260;
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return geo;
  }, [count]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uWarp: { value: 0 } }), []);

  useFrame((state) => {
    if (!materialRef.current) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uWarp.value = warpEnvelope(performance.now(), warpSignal.current);
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={STAR_VERTEX}
        fragmentShader={STAR_FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

const STREAK_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uWarp;
  attribute float aSeed;
  attribute float aEnd;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float speed = 3.5 + aSeed * 4.5;
    p.z = mod(p.z + uTime * speed * (1.0 + uWarp * 34.0), 260.0) - 250.0;
    p.z -= aEnd * (4.0 + 130.0 * uWarp);
    vAlpha = (1.0 - aEnd * 0.88) * smoothstep(-250.0, -225.0, p.z);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const STREAK_FRAGMENT = /* glsl */ `
  uniform float uWarp;
  varying float vAlpha;
  void main() {
    vec3 col = mix(vec3(0.55, 0.9, 1.0), vec3(1.0, 0.75, 0.95), 0.35);
    gl_FragColor = vec4(col, vAlpha * uWarp * 0.8);
  }
`;

function WarpStreaks({ count, warpSignal }: { count: number; warpSignal: WarpSignal }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 6);
    const seeds = new Float32Array(count * 2);
    const ends = new Float32Array(count * 2);
    for (let i = 0; i < count; i += 1) {
      const x = (Math.random() - 0.5) * 120;
      const y = (Math.random() - 0.5) * 80;
      const z = 10 - Math.random() * 260;
      const seed = Math.random();
      for (let v = 0; v < 2; v += 1) {
        const o = (i * 2 + v) * 3;
        positions[o] = x;
        positions[o + 1] = y;
        positions[o + 2] = z;
        seeds[i * 2 + v] = seed;
        ends[i * 2 + v] = v;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
    return geo;
  }, [count]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uWarp: { value: 0 } }), []);

  useFrame((state) => {
    if (!materialRef.current) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uWarp.value = warpEnvelope(performance.now(), warpSignal.current);
  });

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={STREAK_VERTEX}
        fragmentShader={STREAK_FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

const makeGlowTexture = (core: string, mid: string): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, core);
  gradient.addColorStop(0.35, mid);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

function Nebula() {
  const groupRef = useRef<THREE.Group>(null);

  const sprites = useMemo(() => {
    const blue = makeGlowTexture('rgba(38,68,160,0.85)', 'rgba(20,34,90,0.35)');
    const violet = makeGlowTexture('rgba(120,42,168,0.7)', 'rgba(58,18,92,0.3)');
    const teal = makeGlowTexture('rgba(24,140,150,0.6)', 'rgba(12,66,74,0.26)');
    const sun = makeGlowTexture('rgba(255,238,210,0.95)', 'rgba(255,190,120,0.32)');
    return [
      { map: blue, position: [-70, 26, -190] as const, scale: 240, opacity: 0.5 },
      { map: violet, position: [86, -30, -220] as const, scale: 300, opacity: 0.44 },
      { map: teal, position: [30, 52, -170] as const, scale: 200, opacity: 0.36 },
      { map: sun, position: [10, 6, -230] as const, scale: 70, opacity: 0.85 },
    ];
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.02) * 0.05;
  });

  return (
    <group ref={groupRef}>
      {sprites.map((sprite, index) => (
        <sprite key={index} position={[...sprite.position]} scale={[sprite.scale, sprite.scale, 1]}>
          <spriteMaterial
            map={sprite.map}
            opacity={sprite.opacity}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </group>
  );
}

function CameraRig({ warpSignal }: { warpSignal: WarpSignal }) {
  const { camera } = useThree();

  useFrame((state) => {
    const cam = camera as THREE.PerspectiveCamera;
    const env = warpEnvelope(performance.now(), warpSignal.current);
    const t = state.clock.elapsedTime;

    const targetX = state.pointer.x * 2.4 + Math.sin(t * 0.06) * 0.7;
    const targetY = -state.pointer.y * 1.5 + Math.cos(t * 0.05) * 0.45;
    cam.position.x += (targetX - cam.position.x) * 0.045;
    cam.position.y += (targetY + 1.1 - cam.position.y) * 0.045;
    cam.lookAt(0, 0, -80);
    cam.rotation.z += env * Math.sin(t * 24) * 0.018;

    const fovTarget = 72 + env * 27;
    cam.fov += (fovTarget - cam.fov) * 0.14;
    cam.updateProjectionMatrix();
  });

  return null;
}

export default function StarFieldScene({ warpSignal }: { warpSignal: WarpSignal }) {
  const isCompact = typeof window !== 'undefined' && window.innerWidth < 900;

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 1.1, 16], fov: 72, near: 0.1, far: 700 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <color attach="background" args={['#03040a']} />
      <Nebula />
      <Stars count={isCompact ? 2600 : 5200} warpSignal={warpSignal} />
      <WarpStreaks count={isCompact ? 180 : 420} warpSignal={warpSignal} />
      <CameraRig warpSignal={warpSignal} />
    </Canvas>
  );
}
