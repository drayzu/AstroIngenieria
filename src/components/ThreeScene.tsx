import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

function Swarm() {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const points = useMemo(() => {
    const count = 680;
    const positions = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const radius = 2.2 + Math.random() * 4.2;
      const angle = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 1.25;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = height;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
    }

    return positions;
  }, []);

  useFrame((_state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.045;
      groupRef.current.rotation.x = Math.sin(Date.now() * 0.00008) * 0.07;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z -= delta * 0.08;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.74, 64, 64]} />
        <meshBasicMaterial color="#f9d66e" />
      </mesh>

      <mesh>
        <sphereGeometry args={[1.05, 64, 64]} />
        <meshBasicMaterial color="#f9d66e" transparent opacity={0.08} />
      </mesh>

      <mesh ref={ringRef} rotation={[Math.PI / 2.5, 0, 0]}>
        <torusGeometry args={[2.5, 0.012, 12, 180]} />
        <meshStandardMaterial color="#20d6c7" emissive="#20d6c7" emissiveIntensity={1.2} />
      </mesh>

      <mesh rotation={[Math.PI / 2.05, 0.3, 0]}>
        <torusGeometry args={[3.55, 0.008, 12, 220]} />
        <meshStandardMaterial color="#9ee66f" emissive="#9ee66f" emissiveIntensity={0.8} />
      </mesh>

      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[points, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.025}
          color="#f5f7ff"
          transparent
          opacity={0.76}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <Sparkles count={86} scale={[8, 3.4, 8]} size={2.2} speed={0.15} color="#f05cff" />
    </group>
  );
}

export function ThreeScene() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return (
    <div className="three-scene" aria-hidden="true">
      <Canvas camera={{ position: [0, 2.3, 7.2], fov: 50 }} dpr={[1, 1.8]}>
        <color attach="background" args={['#030712']} />
        <fog attach="fog" args={['#030712', 8, 16]} />
        <ambientLight intensity={0.45} />
        <pointLight position={[0, 0, 0]} intensity={7} color="#ffd166" />
        <pointLight position={[-4, 3, 4]} intensity={2} color="#20d6c7" />
        <pointLight position={[3, -2, -3]} intensity={2.2} color="#f05cff" />
        <Swarm />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate={!reducedMotion}
          autoRotateSpeed={0.35}
          minPolarAngle={1.0}
          maxPolarAngle={2.15}
        />
      </Canvas>
      <div className="scene-vignette" />
    </div>
  );
}
