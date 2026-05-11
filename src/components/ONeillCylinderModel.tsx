import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const shellRadius = 1.16;
const shellLength = 5.4;
const openThetaStart = Math.PI * 0.18;
const openThetaEnd = Math.PI * 1.68;

function createBandGeometry(radius: number, thetaStart: number, thetaEnd: number, xInset = 0.18) {
  const lengthSegments = 20;
  const thetaSegments = 10;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let xIndex = 0; xIndex <= lengthSegments; xIndex += 1) {
    const xProgress = xIndex / lengthSegments;
    const x = -shellLength / 2 + xInset + xProgress * (shellLength - xInset * 2);

    for (let thetaIndex = 0; thetaIndex <= thetaSegments; thetaIndex += 1) {
      const thetaProgress = thetaIndex / thetaSegments;
      const theta = thetaStart + thetaProgress * (thetaEnd - thetaStart);
      const y = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      positions.push(x, y, z);
      normals.push(0, -Math.cos(theta), -Math.sin(theta));
      uvs.push(xProgress, thetaProgress);
    }
  }

  const row = thetaSegments + 1;
  for (let xIndex = 0; xIndex < lengthSegments; xIndex += 1) {
    for (let thetaIndex = 0; thetaIndex < thetaSegments; thetaIndex += 1) {
      const a = xIndex * row + thetaIndex;
      const b = a + row;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d');

  if (context) {
    const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, '#0b1320');
    gradient.addColorStop(0.35, '#d8f1ff');
    gradient.addColorStop(0.52, '#74d6ff');
    gradient.addColorStop(0.68, '#f4fff7');
    gradient.addColorStop(1, '#111827');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let index = 0; index < 90; index += 1) {
      const x = (index * 37) % canvas.width;
      const y = (index * 19) % canvas.height;
      const size = index % 7 === 0 ? 2 : 1;
      context.fillStyle = index % 5 === 0 ? 'rgba(120, 255, 214, 0.9)' : 'rgba(255,255,255,0.72)';
      context.fillRect(x, y, size, size);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 1);
  return texture;
}

function StarField() {
  const positions = useMemo(() => {
    const count = 420;
    const values = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.39996;
      const radius = 7 + ((index * 31) % 90) / 10;
      values[index * 3] = Math.cos(angle) * radius;
      values[index * 3 + 1] = (((index * 47) % 100) / 50 - 1) * 5.5;
      values[index * 3 + 2] = Math.sin(angle) * radius;
    }

    return values;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.018} color="#f4f7ff" transparent opacity={0.78} />
    </points>
  );
}

function InteriorBands() {
  const glowTexture = useMemo(() => createGlowTexture(), []);
  const bands = useMemo(
    () => [
      {
        key: 'land-a',
        geometry: createBandGeometry(1.055, Math.PI * 0.35, Math.PI * 0.54),
        color: '#657f58',
        roughness: 0.86,
      },
      {
        key: 'window-a',
        geometry: createBandGeometry(1.052, Math.PI * 0.57, Math.PI * 0.7),
        color: '#dff8ff',
        roughness: 0.2,
        emissive: '#79d8ff',
        map: glowTexture,
      },
      {
        key: 'city',
        geometry: createBandGeometry(1.05, Math.PI * 0.76, Math.PI * 0.95),
        color: '#384151',
        roughness: 0.58,
        emissive: '#223047',
      },
      {
        key: 'water',
        geometry: createBandGeometry(1.048, Math.PI * 1.0, Math.PI * 1.14),
        color: '#1f6c88',
        roughness: 0.18,
        emissive: '#0b354f',
      },
      {
        key: 'land-b',
        geometry: createBandGeometry(1.055, Math.PI * 1.2, Math.PI * 1.44),
        color: '#72865a',
        roughness: 0.82,
      },
    ],
    [glowTexture],
  );

  return (
    <>
      {bands.map((band) => (
        <mesh geometry={band.geometry} key={band.key}>
          <meshStandardMaterial
            color={band.color}
            emissive={band.emissive ?? '#000'}
            emissiveIntensity={band.emissive ? 0.55 : 0}
            map={band.map}
            metalness={0.08}
            roughness={band.roughness}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  );
}

function CityLights() {
  const blocks = useMemo(
    () =>
      Array.from({ length: 64 }, (_, index) => {
        const x = -2.35 + (index % 16) * 0.31;
        const theta = Math.PI * (0.79 + ((index * 7) % 14) * 0.01);
        const height = 0.018 + (index % 5) * 0.012;
        return {
          id: `block-${index}`,
          position: [x, Math.cos(theta) * 1.0, Math.sin(theta) * 1.0] as [number, number, number],
          rotation: [theta, 0, 0] as [number, number, number],
          height,
          lit: index % 3 === 0,
        };
      }),
    [],
  );

  return (
    <>
      {blocks.map((block) => (
        <mesh key={block.id} position={block.position} rotation={block.rotation}>
          <boxGeometry args={[0.08, block.height, 0.032]} />
          <meshStandardMaterial
            color={block.lit ? '#b9f2ff' : '#1d2532'}
            emissive={block.lit ? '#69dcff' : '#05070b'}
            emissiveIntensity={block.lit ? 1.6 : 0.25}
            roughness={0.42}
          />
        </mesh>
      ))}
    </>
  );
}

function MirrorArray() {
  const panels = [-1.95, -0.65, 0.65, 1.95];

  return (
    <group>
      {panels.map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 1.7, -1.05]} rotation={[0.2, 0, 0.16]}>
            <boxGeometry args={[1.02, 0.035, 0.48]} />
            <meshPhysicalMaterial color="#dceeff" metalness={0.62} roughness={0.16} clearcoat={0.7} />
          </mesh>
          <mesh position={[0, -1.15, 1.62]} rotation={[-0.62, 0, -0.14]}>
            <boxGeometry args={[1.02, 0.035, 0.42]} />
            <meshPhysicalMaterial color="#cce8ff" metalness={0.62} roughness={0.2} clearcoat={0.6} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.56, -0.82]} rotation={[0.2, 0, 0.16]}>
        <boxGeometry args={[5.35, 0.018, 0.035]} />
        <meshStandardMaterial color="#7cc9ff" emissive="#2487ff" emissiveIntensity={0.45} />
      </mesh>
    </group>
  );
}

function StructuralShell() {
  const ringPositions = [-2.7, -1.8, -0.9, 0, 0.9, 1.8, 2.7];
  const ribAngles = [0.26, 1.63, 3.15, 4.72];

  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry
          args={[shellRadius, shellRadius, shellLength, 96, 1, true, openThetaStart, openThetaEnd - openThetaStart]}
        />
        <meshPhysicalMaterial
          color="#202833"
          metalness={0.74}
          roughness={0.31}
          clearcoat={0.28}
          side={THREE.DoubleSide}
        />
      </mesh>

      {ringPositions.map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[1.18, 0.025, 12, 128]} />
          <meshStandardMaterial color="#7f8a98" metalness={0.78} roughness={0.28} />
        </mesh>
      ))}

      {ribAngles.map((angle) => (
        <mesh
          key={angle}
          position={[0, Math.cos(angle) * 1.2, Math.sin(angle) * 1.2]}
          rotation={[0, 0, 0]}
        >
          <boxGeometry args={[shellLength + 0.12, 0.025, 0.035]} />
          <meshStandardMaterial color="#a5b0bf" metalness={0.72} roughness={0.34} />
        </mesh>
      ))}

      <mesh position={[-2.86, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.86, 0.028, 12, 96]} />
        <meshStandardMaterial color="#c4ccd5" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[2.86, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.86, 0.028, 12, 96]} />
        <meshStandardMaterial color="#c4ccd5" metalness={0.8} roughness={0.25} />
      </mesh>
    </group>
  );
}

function Radiators() {
  const radiators = [-2.15, -1.25, -0.35, 0.55, 1.45, 2.35];

  return (
    <group>
      {radiators.map((x) => (
        <mesh key={x} position={[x, -1.52, -0.64]} rotation={[0.42, 0, 0]}>
          <boxGeometry args={[0.34, 0.025, 0.72]} />
          <meshStandardMaterial color="#151a21" emissive="#3c4c63" emissiveIntensity={0.18} roughness={0.74} />
        </mesh>
      ))}
    </group>
  );
}

function ScaleCraft() {
  return (
    <group position={[2.45, 1.28, 1.55]} rotation={[0.3, -0.45, 0.1]}>
      <mesh>
        <coneGeometry args={[0.045, 0.18, 18]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.35} roughness={0.28} />
      </mesh>
      <mesh position={[0, -0.045, 0]}>
        <boxGeometry args={[0.15, 0.025, 0.08]} />
        <meshStandardMaterial color="#8ad7ff" emissive="#49b8ff" emissiveIntensity={0.4} />
      </mesh>
      <pointLight position={[0.2, 0.05, 0]} intensity={0.8} color="#75d7ff" />
    </group>
  );
}

function ONeillCylinderAssembly({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_state, delta) => {
    if (!reducedMotion && groupRef.current) {
      groupRef.current.rotation.x += delta * 0.08;
    }
  });

  return (
    <group ref={groupRef} rotation={[0.1, -0.24, 0.2]}>
      <StructuralShell />
      <InteriorBands />
      <CityLights />
      <MirrorArray />
      <Radiators />
      <ScaleCraft />
    </group>
  );
}

export function ONeillCylinderModel() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return (
    <div className="model3d-stage" aria-label="Modelo 3D interactivo del Cilindro de O'Neill">
      <Canvas camera={{ position: [4.6, 2.7, 4.8], fov: 39 }} dpr={[1, 1.65]}>
        <color attach="background" args={['#020409']} />
        <fog attach="fog" args={['#020409', 8, 17]} />
        <ambientLight intensity={0.34} />
        <directionalLight position={[4, 5, 6]} intensity={3.2} color="#f4f8ff" />
        <pointLight position={[-3, 2.4, -3]} intensity={4.5} color="#63ccff" />
        <pointLight position={[2.8, -2.4, 2.6]} intensity={2.4} color="#ffe7a6" />
        <StarField />
        <ONeillCylinderAssembly reducedMotion={reducedMotion} />
        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.07}
          minDistance={4.0}
          maxDistance={8.2}
          minPolarAngle={0.44}
          maxPolarAngle={2.44}
          autoRotate={!reducedMotion}
          autoRotateSpeed={0.38}
        />
      </Canvas>
      <div className="model3d-vignette" />
    </div>
  );
}
