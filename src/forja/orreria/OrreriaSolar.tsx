import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { Canvas, createPortal, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { chapters } from '../../data/astroData';
import type { AstroConcept } from '../../types';
import { createRng } from '../shared/conceptImages';
import './orreriaSolar.css';

/**
 * Orrería Solar — el sistema solar como obra de astroingeniería: cada concepto
 * emplazado físicamente donde se construiría (tierra, luna, cinturón, órbitas
 * solares, halo exterior). Un scrubber construye el sistema por misiones y la
 * cámara vuela hacia la estructura seleccionada.
 */

interface PlanetSpec {
  id: string;
  name: string;
  radius: number;
  orbit: number;
  color: string;
  speed: number;
  ring?: boolean;
  moon?: boolean;
}

const PLANETS: PlanetSpec[] = [
  { id: 'mercurio', name: 'Mercurio', radius: 0.4, orbit: 11, color: '#9c8f84', speed: 0.62 },
  { id: 'venus', name: 'Venus', radius: 0.82, orbit: 14.5, color: '#d9b88a', speed: 0.34 },
  { id: 'tierra', name: 'Tierra', radius: 0.88, orbit: 18.5, color: '#6f9fd9', speed: 0.24, moon: true },
  { id: 'marte', name: 'Marte', radius: 0.56, orbit: 23.5, color: '#c96f4a', speed: 0.17 },
  { id: 'jupiter', name: 'Júpiter', radius: 2.05, orbit: 33, color: '#c9a077', speed: 0.075 },
  { id: 'saturno', name: 'Saturno', radius: 1.7, orbit: 42, color: '#d9c08f', speed: 0.056, ring: true },
  { id: 'urano', name: 'Urano', radius: 1.05, orbit: 51, color: '#8fd0d9', speed: 0.034 },
  { id: 'neptuno', name: 'Neptuno', radius: 1.0, orbit: 58, color: '#5f7fd9', speed: 0.024 },
];

const chapterOrder = new Map(chapters.map((chapter, index) => [chapter.id, index]));
const chapterColor = new Map(chapters.map((chapter) => [chapter.id, chapter.color]));

type AnchorKind =
  | { kind: 'planet'; planetId: string }
  | { kind: 'radius'; radius: number }
  | { kind: 'sun' }
  | { kind: 'trajectory' };

interface Placement {
  anchor: AnchorKind;
  angle: number;
  lift: number;
}

const CURATED_PLACEMENTS: Record<string, AnchorKind> = {
  'space-elevator': { kind: 'planet', planetId: 'tierra' },
  'lunar-bases': { kind: 'planet', planetId: 'luna' },
  'asteroid-mining': { kind: 'radius', radius: 28 },
  'asteroid-habitat': { kind: 'radius', radius: 28.8 },
  'terraforming-mars': { kind: 'planet', planetId: 'marte' },
  'terraforming-venus': { kind: 'planet', planetId: 'venus' },
  'venus-floating': { kind: 'planet', planetId: 'venus' },
  'domed-cities': { kind: 'planet', planetId: 'marte' },
  'orbital-mirrors': { kind: 'planet', planetId: 'marte' },
  sunshades: { kind: 'planet', planetId: 'venus' },
  magnetospheres: { kind: 'planet', planetId: 'marte' },
  ecopoiesis: { kind: 'planet', planetId: 'marte' },
  'dyson-swarm': { kind: 'radius', radius: 8.4 },
  'dyson-shell': { kind: 'radius', radius: 8.4 },
  'dyson-bubble': { kind: 'radius', radius: 9.4 },
  'partial-dyson': { kind: 'radius', radius: 8.4 },
  'matrioshka-brain': { kind: 'radius', radius: 9 },
  'stellar-engine': { kind: 'sun' },
  shkadov: { kind: 'sun' },
  caplan: { kind: 'sun' },
  'star-lifting': { kind: 'sun' },
  'stellar-husbandry': { kind: 'sun' },
  'black-hole-engineering': { kind: 'sun' },
  'orbital-ring': { kind: 'planet', planetId: 'tierra' },
  skyhooks: { kind: 'planet', planetId: 'tierra' },
  tethers: { kind: 'planet', planetId: 'tierra' },
  'mass-driver': { kind: 'planet', planetId: 'luna' },
  isru: { kind: 'planet', planetId: 'luna' },
  iss: { kind: 'planet', planetId: 'tierra' },
  'orbital-ports': { kind: 'planet', planetId: 'tierra' },
  'fuel-depots': { kind: 'planet', planetId: 'tierra' },
  shipyards: { kind: 'planet', planetId: 'tierra' },
  'reusable-launch': { kind: 'planet', planetId: 'tierra' },
  'solar-power-satellites': { kind: 'planet', planetId: 'tierra' },
};

const chapterAnchors: Record<string, (rng: ReturnType<typeof createRng>) => AnchorKind> = {
  intro: (rng) => ({ kind: 'radius', radius: rng.range(64, 80) }),
  habitats: (rng) => ({ kind: 'radius', radius: rng.range(15.8, 21.8) }),
  infrastructure: (rng) => ({ kind: 'radius', radius: rng.range(17, 31) }),
  energy: (rng) => ({ kind: 'radius', radius: rng.range(7.2, 9.8) }),
  propulsion: () => ({ kind: 'trajectory' }),
  planetary: (rng) => ({ kind: 'radius', radius: rng.range(12.5, 26) }),
  stellar: () => ({ kind: 'sun' }),
  civilizations: (rng) => ({ kind: 'radius', radius: rng.range(64, 82) }),
  complements: (rng) => ({ kind: 'radius', radius: rng.range(86, 98) }),
};

const buildPlacements = (concepts: AstroConcept[]): Map<string, Placement> => {
  const map = new Map<string, Placement>();
  concepts.forEach((concept) => {
    const rng = createRng(`orreria-${concept.id}`);
    const anchor =
      CURATED_PLACEMENTS[concept.id] ?? (chapterAnchors[concept.chapterId] ?? chapterAnchors.intro)(rng);
    map.set(concept.id, {
      anchor,
      angle: rng.range(0, Math.PI * 2),
      lift: rng.range(-1.4, 1.4),
    });
  });
  return map;
};

const createGlowTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 214, 150, 1)');
    gradient.addColorStop(0.28, 'rgba(255, 178, 96, 0.55)');
    gradient.addColorStop(0.62, 'rgba(200, 110, 50, 0.16)');
    gradient.addColorStop(1, 'rgba(120, 60, 30, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
  }
  return new THREE.CanvasTexture(canvas);
};

/* ── Glifos por capítulo ─────────────────────────────────────────────────── */

const useGlyphMaterial = (color: string) => {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.85,
        roughness: 0.5,
        metalness: 0.1,
        transparent: true,
        opacity: 1,
      }),
    [color],
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
};

interface GlyphProps {
  chapterId: string;
  built: boolean;
  selected?: boolean;
  reducedMotion: boolean;
}

const Glyph = ({ chapterId, built, selected = false, reducedMotion }: GlyphProps) => {
  const color = chapterColor.get(chapterId) ?? '#f9d66e';
  const material = useGlyphMaterial(color);
  const groupRef = useRef<THREE.Group>(null);
  const spin = useRef(0.2 + createRng(chapterId).unit() * 0.5);

  useFrame((_, dt) => {
    const targetOpacity = built ? 1 : 0.16;
    material.opacity += (targetOpacity - material.opacity) * Math.min(1, dt * 4);
    material.wireframe = !built && material.opacity < 0.6;
    if (groupRef.current) {
      if (!reducedMotion) {
        spin.current += dt * 0.4;
        groupRef.current.rotation.y = spin.current;
      }
      const targetScale = selected ? 1.6 : 1;
      const current = groupRef.current.scale.x;
      const next = current + (targetScale - current) * Math.min(1, dt * 5);
      groupRef.current.scale.setScalar(next);
    }
  });

  const shapes = () => {
    switch (chapterId) {
      case 'habitats':
        return (
          <>
            <torusGeometry args={[0.85, 0.22, 10, 28]} />
          </>
        );
      case 'infrastructure':
        return <icosahedronGeometry args={[0.8, 0]} />;
      case 'energy':
        return <torusGeometry args={[0.7, 0.16, 8, 6]} />;
      case 'planetary':
        return <sphereGeometry args={[0.8, 16, 12]} />;
      case 'stellar':
        return <octahedronGeometry args={[0.85, 0]} />;
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  return (
    <group ref={groupRef}>
      <mesh material={material} scale={0.9}>
        {shapes()}
      </mesh>
      {chapterId === 'habitats' && (
        <mesh material={material} scale={0.9}>
          <torusGeometry args={[0.35, 0.12, 8, 18]} />
        </mesh>
      )}
      {chapterId === 'energy' && (
        <mesh material={material} rotation={[Math.PI / 2.4, 0, 0]} scale={0.9}>
          <torusGeometry args={[0.7, 0.1, 8, 6]} />
        </mesh>
      )}
    </group>
  );
};

/* ── Fondo: estrellas, cinturón, órbitas ─────────────────────────────────── */

const Starfield = () => {
  const positions = useMemo(() => {
    const rng = createRng('orreria-stars');
    const count = 1500;
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const theta = rng.range(0, Math.PI * 2);
      const phi = Math.acos(rng.range(-1, 1));
      const radius = rng.range(300, 400);
      array[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      array[i * 3 + 1] = Math.cos(phi) * radius;
      array[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    }
    return array;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={1.3}
        color="#dfe9f5"
        transparent
        opacity={0.8}
        sizeAttenuation={false}
        depthWrite={false}
      />
    </points>
  );
};

const AsteroidBelt = () => {
  const positions = useMemo(() => {
    const rng = createRng('orreria-belt');
    const count = 1100;
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const angle = rng.range(0, Math.PI * 2);
      const radius = rng.range(26, 30);
      array[i * 3] = Math.cos(angle) * radius;
      array[i * 3 + 1] = rng.range(-0.7, 0.7);
      array[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return array;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.16} color="#8a7f70" transparent opacity={0.75} depthWrite={false} />
    </points>
  );
};

const OrbitLine = ({ radius }: { radius: number }) => {
  const positions = useMemo(() => {
    const segments = 128;
    const array = new Float32Array(segments * 3);
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      array[i * 3] = Math.cos(angle) * radius;
      array[i * 3 + 1] = 0;
      array[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return array;
  }, [radius]);
  return (
    <lineLoop>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#22344f" transparent opacity={0.55} />
    </lineLoop>
  );
};

/* ── Planetas ────────────────────────────────────────────────────────────── */

interface PlanetProps {
  spec: PlanetSpec;
  planetGroups: RefObject<Map<string, THREE.Group>>;
  reducedMotion: boolean;
}

const Planet = ({ spec, planetGroups, reducedMotion }: PlanetProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const baseAngle = useMemo(() => createRng(`planeta-${spec.id}`).range(0, Math.PI * 2), [spec.id]);

  useFrame((state) => {
    const t = reducedMotion ? 0 : state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.rotation.y = baseAngle + t * spec.speed;
    }
    if (innerRef.current && spec.moon && !reducedMotion) {
      innerRef.current.rotation.y = t * 0.9;
    }
  });

  return (
    <group
      ref={(group) => {
        if (group) {
          planetGroups.current?.set(spec.id, group);
          groupRef.current = group;
        } else {
          planetGroups.current?.delete(spec.id);
          groupRef.current = null;
        }
      }}
    >
      <group position={[spec.orbit, 0, 0]}>
        <mesh castShadow={false}>
          <sphereGeometry args={[spec.radius, 24, 18]} />
          <meshStandardMaterial color={spec.color} roughness={0.85} metalness={0.05} />
        </mesh>
        {spec.ring && (
          <mesh rotation={[Math.PI / 2.15, 0, 0]}>
            <torusGeometry args={[spec.radius * 1.7, spec.radius * 0.22, 2, 48]} />
            <meshStandardMaterial color={spec.color} roughness={0.9} transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
        )}
        {spec.moon && (
          <group ref={innerRef}>
            <group
              ref={(group) => {
                if (group) {
                  planetGroups.current?.set('luna', group);
                } else {
                  planetGroups.current?.delete('luna');
                }
              }}
              position={[2.4, 0, 0]}
            >
              <mesh>
                <sphereGeometry args={[0.26, 12, 10]} />
                <meshStandardMaterial color="#b9b4ac" roughness={0.95} />
              </mesh>
            </group>
          </group>
        )}
      </group>
    </group>
  );
};

/* ── Conceptos emplazados ────────────────────────────────────────────────── */

interface ConceptProps {
  concept: AstroConcept;
  placement: Placement;
  built: boolean;
  selected: boolean;
  reducedMotion: boolean;
  registerGroup: (id: string, group: THREE.Group | null) => void;
  onSelect: (id: string) => void;
  onHover: (payload: { id: string; x: number; y: number } | null) => void;
}

const TrajectoryGlyph = ({ color, built }: { color: string; built: boolean }) => {
  const material = useGlyphMaterial(color);
  useFrame((_, dt) => {
    const targetOpacity = built ? 0.55 : 0.08;
    material.opacity += (targetOpacity - material.opacity) * Math.min(1, dt * 4);
  });
  return (
    <mesh material={material} position={[64, 0, 0]}>
      <boxGeometry args={[104, 0.05, 0.05]} />
    </mesh>
  );
};

const PlacedConcept = ({
  concept,
  placement,
  built,
  selected,
  reducedMotion,
  registerGroup,
  onSelect,
  onHover,
}: ConceptProps) => {
  const color = chapterColor.get(concept.chapterId) ?? '#f9d66e';
  const carrierRef = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (carrierRef.current && !reducedMotion && placement.anchor.kind === 'radius') {
      carrierRef.current.rotation.y += dt * 0.012;
    }
  });

  const content = (
    <group
      ref={(group) => registerGroup(concept.id, group)}
      name={concept.id}
      position={
        placement.anchor.kind === 'radius'
          ? [placement.anchor.radius, placement.lift, 0]
          : placement.anchor.kind === 'sun'
            ? [7.2, placement.lift * 0.25, 0]
            : [0, placement.lift * 0.2, 0]
      }
    >
      {placement.anchor.kind === 'trajectory' ? (
        <TrajectoryGlyph color={color} built={built} />
      ) : (
        <Glyph
          chapterId={concept.chapterId}
          built={built}
          selected={selected}
          reducedMotion={reducedMotion}
        />
      )}
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(concept.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = 'pointer';
          onHover({ id: concept.id, x: event.nativeEvent.clientX, y: event.nativeEvent.clientY });
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          onHover({ id: concept.id, x: event.nativeEvent.clientX, y: event.nativeEvent.clientY });
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
          onHover(null);
        }}
      >
        <sphereGeometry args={[1.9, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );

  if (placement.anchor.kind === 'sun') {
    return <group rotation-y={placement.angle}>{content}</group>;
  }
  if (placement.anchor.kind === 'trajectory') {
    return (
      <group rotation-y={placement.angle} rotation-x={placement.lift * 0.2}>
        {content}
      </group>
    );
  }
  return (
    <group ref={carrierRef} rotation-y={placement.angle}>
      {content}
    </group>
  );
};

/* ── Cámara ──────────────────────────────────────────────────────────────── */

interface CameraRigProps {
  selectedId: string | null;
  conceptGroups: RefObject<Map<string, THREE.Group>>;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}

const CameraRig = ({ selectedId, conceptGroups, controlsRef }: CameraRigProps) => {
  const focus = useMemo(() => new THREE.Vector3(), []);
  const homeTarget = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const homePosition = useMemo(() => new THREE.Vector3(0, 44, 88), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, dt) => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }
    const blend = 1 - Math.exp(-dt * 2.6);
    const group = selectedId ? conceptGroups.current?.get(selectedId) : undefined;
    if (selectedId && group) {
      group.getWorldPosition(focus);
      controls.target.lerp(focus, blend);
      direction.copy(state.camera.position).sub(controls.target).normalize().multiplyScalar(15);
      desired.copy(focus).add(direction);
      state.camera.position.lerp(desired, blend);
    } else {
      controls.target.lerp(homeTarget, blend);
      state.camera.position.lerp(homePosition, blend);
    }
  });
  return null;
};

/* ── Escena completa ─────────────────────────────────────────────────────── */

interface SceneProps {
  concepts: AstroConcept[];
  placements: Map<string, Placement>;
  scrub: number;
  selectedId: string | null;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
  onHover: (payload: { id: string; x: number; y: number } | null) => void;
}

const Scene = ({
  concepts,
  placements,
  scrub,
  selectedId,
  reducedMotion,
  onSelect,
  onHover,
}: SceneProps) => {
  const conceptGroups = useRef<Map<string, THREE.Group>>(new Map());
  const planetGroups = useRef<Map<string, THREE.Group>>(new Map());
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const glowTexture = useMemo(createGlowTexture, []);
  const sunRef = useRef<THREE.Mesh>(null);

  useEffect(() => () => glowTexture.dispose(), [glowTexture]);

  useFrame((_, dt) => {
    if (sunRef.current && !reducedMotion) {
      sunRef.current.rotation.y += dt * 0.04;
    }
  });

  const registerGroup = (id: string, group: THREE.Group | null) => {
    if (group) {
      conceptGroups.current.set(id, group);
    } else {
      conceptGroups.current.delete(id);
    }
  };

  const planetAnchored = concepts.filter((concept) => {
    const placement = placements.get(concept.id);
    return placement?.anchor.kind === 'planet';
  });
  const freeConcepts = concepts.filter((concept) => {
    const placement = placements.get(concept.id);
    return placement?.anchor.kind !== 'planet';
  });

  return (
    <>
      <ambientLight intensity={0.32} />
      <pointLight position={[0, 0, 0]} intensity={1500} decay={2} color="#ffd9a0" />

      <mesh ref={sunRef}>
        <sphereGeometry args={[5, 48, 48]} />
        <meshBasicMaterial color="#ffc46b" />
      </mesh>
      <sprite scale={[36, 36, 1]}>
        <spriteMaterial
          map={glowTexture}
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      <Starfield />
      <AsteroidBelt />
      {PLANETS.map((planet) => (
        <OrbitLine key={planet.id} radius={planet.orbit} />
      ))}

      {PLANETS.map((planet) => (
        <Planet key={planet.id} spec={planet} planetGroups={planetGroups} reducedMotion={reducedMotion} />
      ))}

      {freeConcepts.map((concept) => {
        const placement = placements.get(concept.id);
        if (!placement) {
          return null;
        }
        const order = chapterOrder.get(concept.chapterId) ?? 0;
        return (
          <PlacedConcept
            key={concept.id}
            concept={concept}
            placement={placement}
            built={order <= scrub}
            selected={selectedId === concept.id}
            reducedMotion={reducedMotion}
            registerGroup={registerGroup}
            onSelect={onSelect}
            onHover={onHover}
          />
        );
      })}

      {PLANETS.map((planet) => {
        const anchored = planetAnchored.filter((concept) => {
          const anchor = placements.get(concept.id)?.anchor;
          return anchor?.kind === 'planet' && anchor.planetId === planet.id;
        });
        if (anchored.length === 0) {
          return null;
        }
        return (
          <group key={`anchored-${planet.id}`}>
            {anchored.map((concept) => {
              const placement = placements.get(concept.id);
              if (!placement) {
                return null;
              }
              const order = chapterOrder.get(concept.chapterId) ?? 0;
              return (
                <PlanetAnchoredConcept
                  key={concept.id}
                  concept={concept}
                  placement={placement}
                  planetGroups={planetGroups}
                  built={order <= scrub}
                  selected={selectedId === concept.id}
                  reducedMotion={reducedMotion}
                  registerGroup={registerGroup}
                  onSelect={onSelect}
                  onHover={onHover}
                />
              );
            })}
          </group>
        );
      })}

      {planetAnchored
        .filter((concept) => {
          const anchor = placements.get(concept.id)?.anchor;
          return anchor?.kind === 'planet' && anchor.planetId === 'luna';
        })
        .map((concept) => {
          const placement = placements.get(concept.id);
          if (!placement) {
            return null;
          }
          const order = chapterOrder.get(concept.chapterId) ?? 0;
          return (
            <PlanetAnchoredConcept
              key={`luna-${concept.id}`}
              concept={concept}
              placement={placement}
              planetGroups={planetGroups}
              built={order <= scrub}
              selected={selectedId === concept.id}
              reducedMotion={reducedMotion}
              registerGroup={registerGroup}
              onSelect={onSelect}
              onHover={onHover}
            />
          );
        })}

      <CameraRig selectedId={selectedId} conceptGroups={conceptGroups} controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={8}
        maxDistance={220}
        maxPolarAngle={Math.PI * 0.92}
      />
    </>
  );
};

interface PlanetAnchoredProps {
  concept: AstroConcept;
  placement: Placement;
  planetGroups: RefObject<Map<string, THREE.Group>>;
  built: boolean;
  selected: boolean;
  reducedMotion: boolean;
  registerGroup: (id: string, group: THREE.Group | null) => void;
  onSelect: (id: string) => void;
  onHover: (payload: { id: string; x: number; y: number } | null) => void;
}

const PlanetAnchoredConcept = ({
  concept,
  placement,
  planetGroups,
  built,
  selected,
  reducedMotion,
  registerGroup,
  onSelect,
  onHover,
}: PlanetAnchoredProps) => {
  const [parent, setParent] = useState<THREE.Group | null>(null);
  const anchor = placement.anchor as { kind: 'planet'; planetId: string };
  const planetId = anchor.planetId === 'luna' ? 'luna' : anchor.planetId;

  useEffect(() => {
    let mounted = true;
    const attach = () => {
      const group = planetGroups.current?.get(planetId);
      if (group && mounted) {
        setParent(group);
        return true;
      }
      return false;
    };
    if (!attach()) {
      const timer = window.setInterval(() => {
        if (attach()) {
          window.clearInterval(timer);
        }
      }, 120);
      return () => {
        mounted = false;
        window.clearInterval(timer);
      };
    }
    return () => {
      mounted = false;
    };
  }, [planetId, planetGroups]);

  if (!parent) {
    return null;
  }

  const content = (
    <group
      ref={(group) => registerGroup(concept.id, group)}
      position={[0, placement.lift * 0.4 + 1.6, 0]}
    >
      <Glyph
        chapterId={concept.chapterId}
        built={built}
        selected={selected}
        reducedMotion={reducedMotion}
      />
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(concept.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = 'pointer';
          onHover({ id: concept.id, x: event.nativeEvent.clientX, y: event.nativeEvent.clientY });
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          onHover({ id: concept.id, x: event.nativeEvent.clientX, y: event.nativeEvent.clientY });
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
          onHover(null);
        }}
      >
        <sphereGeometry args={[1.9, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );

  return createPortal(content, parent);
};

/* ── UI ──────────────────────────────────────────────────────────────────── */

export default function OrreriaSolar() {
  const [scrub, setScrub] = useState(chapters.length - 1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [playing, setPlaying] = useState(false);

  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const concepts = useMemo(() => chapters.flatMap((chapter) => chapter.concepts), []);
  const placements = useMemo(() => buildPlacements(concepts), [concepts]);

  useEffect(() => {
    if (!playing || reducedMotion) {
      return;
    }
    const timer = window.setInterval(() => {
      setScrub((current) => (current >= chapters.length - 1 ? 0 : current + 1));
    }, 2300);
    return () => window.clearInterval(timer);
  }, [playing, reducedMotion]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const conceptById = useMemo(() => new Map(concepts.map((concept) => [concept.id, concept])), [concepts]);
  const selected = selectedId ? conceptById.get(selectedId) : undefined;
  const selectedChapter = selected
    ? chapters.find((chapter) => chapter.id === selected.chapterId)
    : undefined;
  const hoverConcept = hover ? conceptById.get(hover.id) : undefined;
  const hoverChapter = hoverConcept
    ? chapters.find((chapter) => chapter.id === hoverConcept.chapterId)
    : undefined;

  const builtCount = concepts.filter(
    (concept) => (chapterOrder.get(concept.chapterId) ?? 0) <= scrub,
  ).length;
  const scrubChapter = chapters[scrub] ?? chapters[0];

  return (
    <div className="or-root">
      <Canvas
        camera={{ position: [0, 44, 88], fov: 42, near: 0.1, far: 900 }}
        dpr={[1, 1.7]}
        onPointerMissed={() => setSelectedId(null)}
      >
        <color attach="background" args={['#030711']} />
        <fog attach="fog" args={['#030711', 160, 420]} />
        <Scene
          concepts={concepts}
          placements={placements}
          scrub={scrub}
          selectedId={selectedId}
          reducedMotion={reducedMotion}
          onSelect={setSelectedId}
          onHover={setHover}
        />
      </Canvas>

      <header className="or-title">
        <p className="or-title-kicker">SISTEMA SOLAR · OBRA EN CONSTRUCCIÓN</p>
        <h2 className="or-title-name">Orrería Solar</h2>
        <p className="or-title-note">
          Cada punto es un concepto del atlas emplazado donde se construiría.
          Gira, acércate y haz clic sobre una estructura.
        </p>
      </header>

      <nav className="or-legend" aria-label="Misiones">
        {chapters.map((chapter, index) => {
          const active = index <= scrub;
          return (
            <button
              key={chapter.id}
              type="button"
              className={active ? 'or-legend-item is-built' : 'or-legend-item'}
              style={{ '--or-accent': chapter.color } as CSSProperties}
              onClick={() => {
                setScrub(index);
                setPlaying(false);
              }}
            >
              <span className="or-legend-dot" aria-hidden="true" />
              <span className="or-legend-name">{chapter.title}</span>
              <span className="or-legend-count">{chapter.concepts.length}</span>
            </button>
          );
        })}
      </nav>

      <div className="or-scrubber">
        <button
          type="button"
          className={playing ? 'or-play is-active' : 'or-play'}
          onClick={() => setPlaying((value) => !value)}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={chapters.length - 1}
          step={1}
          value={scrub}
          aria-label="Avance de construcción por misión"
          onChange={(event) => {
            setScrub(Number(event.target.value));
            setPlaying(false);
          }}
        />
        <span className="or-scrubber-label">
          MISIÓN {scrubChapter.number} · {scrubChapter.title.toUpperCase()}
        </span>
        <span className="or-scrubber-count">{builtCount}/{concepts.length}</span>
      </div>

      {hover && hoverConcept && hoverChapter && !selectedId && (
        <div
          className="or-tooltip"
          style={{ left: hover.x + 14, top: hover.y - 10 }}
        >
          <span className="or-tooltip-chapter">{hoverChapter.title}</span>
          <span className="or-tooltip-title">{hoverConcept.title}</span>
        </div>
      )}

      {selected && selectedChapter && (
        <aside
          className="or-dossier"
          style={{ '--or-accent': selectedChapter.color } as CSSProperties}
          role="dialog"
          aria-label={`Dossier de ${selected.title}`}
        >
          <button
            type="button"
            className="or-dossier-close"
            onClick={() => setSelectedId(null)}
            aria-label="Cerrar dossier"
          >
            ✕
          </button>
          <p className="or-dossier-kicker">{selectedChapter.title.toUpperCase()}</p>
          <h3 className="or-dossier-title">{selected.title}</h3>
          <div className="or-dossier-tags">
            <span className="or-tag">{selected.scale.toUpperCase()}</span>
            <span className="or-tag">{selected.plausibility.toUpperCase()}</span>
          </div>
          <p className="or-dossier-summary">{selected.summary}</p>
          <p className="or-dossier-idea">
            <span>IDEA CLAVE</span>
            {selected.keyIdea}
          </p>
          <div className="or-dossier-metrics">
            {(
              [
                ['ENERGÍA', selected.metrics.energia],
                ['MATERIALES', selected.metrics.materiales],
                ['MADUREZ', selected.metrics.madurez],
                ['MARAVILLA', selected.metrics.maravilla],
              ] as [string, number][]
            ).map(([label, value]) => (
              <div key={label} className="or-metric">
                <span className="or-metric-label">{label}</span>
                <span className="or-metric-track">
                  {Array.from({ length: 5 }, (_, i) => (
                    <i key={i} className={i < value ? 'is-on' : ''} />
                  ))}
                </span>
              </div>
            ))}
          </div>
          <p className="or-dossier-hint">
            <kbd>Esc</kbd> vuelve a la vista general · arrastra para orbitar ·
            rueda para acercarte
          </p>
        </aside>
      )}
    </div>
  );
}
