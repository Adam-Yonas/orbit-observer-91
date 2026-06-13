import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { OrbitObject, propagate, EARTH_RADIUS_UNITS, EARTH_RADIUS_KM } from "@/lib/orbital";
import type { CollisionEvent } from "@/lib/orbital";

interface GlobeProps {
  catalog: OrbitObject[];
  visibleIds: Set<string>;
  time: Date;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  cascadeIds: Set<string>;
  collisionEvent?: (CollisionEvent & { key: number }) | null;
}

const COLORS = {
  payload: new THREE.Color("#22d3ee"),
  rocket_body: new THREE.Color("#f59e0b"),
  debris: new THREE.Color("#a78bfa"),
  user: new THREE.Color("#00ff44"), // bright green for launch-sim object
  cascade: new THREE.Color("#ef4444"),
  secondaryCascade: new THREE.Color("#ec4899"),
  selected: new THREE.Color("#ffffff"),
};

const MAX_RENDERED_OBJECTS = 6000;

function Earth() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.02;
  });
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[EARTH_RADIUS_UNITS, 64, 64]} />
        <meshStandardMaterial
          color="#0a2540"
          emissive="#0a4d7a"
          emissiveIntensity={0.15}
          roughness={0.9}
          metalness={0.1}
          wireframe={false}
        />
      </mesh>
      {/* Wireframe overlay for "scan" feel */}
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS_UNITS * 1.001, 32, 24]} />
        <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.12} />
      </mesh>
      {/* Atmosphere glow */}
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS_UNITS * 1.08, 64, 64]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.06} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function DebrisCloud({
  catalog,
  visibleIds,
  time,
  selectedId,
  onSelect,
  cascadeIds,
}: GlobeProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => new Float32Array(MAX_RENDERED_OBJECTS * 3), []);
  const colors = useMemo(() => new Float32Array(MAX_RENDERED_OBJECTS * 3), []);
  const sizes = useMemo(() => new Float32Array(MAX_RENDERED_OBJECTS), []);

  // initialize colors based on kind and park unused slots off-screen
  useEffect(() => {
    for (let i = 0; i < MAX_RENDERED_OBJECTS; i++) {
      if (i < catalog.length) {
        const o = catalog[i];
        const c = COLORS[o.kind];
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
        sizes[i] = o.kind === "user" ? 0.025 : o.kind === "payload" ? 0.012 : 0.008;
      } else {
        positions[i * 3] = 1e6;
        positions[i * 3 + 1] = 1e6;
        positions[i * 3 + 2] = 1e6;
        colors[i * 3] = 0;
        colors[i * 3 + 1] = 0;
        colors[i * 3 + 2] = 0;
        sizes[i] = 0;
      }
    }
    if (pointsRef.current) {
      const geom = pointsRef.current.geometry;
      (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geom.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      (geom.attributes.size as THREE.BufferAttribute).needsUpdate = true;
    }
  }, [catalog, colors, positions, sizes]);

  useFrame(() => {
    let updated = false;
    for (let i = 0; i < catalog.length; i++) {
      const o = catalog[i];
      const visible = visibleIds.has(o.id);
      if (!visible) {
        // Park hidden points far off-screen so they don't intercept clicks
        // (collapsing to the origin makes every raycast hit the same vertex).
        positions[i * 3] = 1e6;
        positions[i * 3 + 1] = 1e6;
        positions[i * 3 + 2] = 1e6;
        continue;
      }
      let p;
      try {
        p = propagate(o, time);
      } catch {
        p = null;
      }
      if (!p || !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) {
        positions[i * 3] = 1e6;
        positions[i * 3 + 1] = 1e6;
        positions[i * 3 + 2] = 1e6;
        continue;
      }
      // satellite.js ECI: x, y in equatorial plane, z toward north pole
      // three.js: y is up. Map (x, z, y) → so z-axis (north) becomes Y in scene.
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.z;
      positions[i * 3 + 2] = -p.y;

      if (o.id === selectedId) {
        const c = COLORS.selected;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      } else if ((o.collisionGeneration ?? 0) > 0) {
        const c = COLORS.secondaryCascade;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      } else if (cascadeIds.has(o.id)) {
        const c = COLORS.cascade;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      } else {
        const c = COLORS[o.kind];
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      updated = true;
    }
    if (updated && pointsRef.current) {
      const geom = pointsRef.current.geometry;
      (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geom.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    // Find nearest *visible* intersection — three.js may report hits on
    // parked (off-screen) vertices via threshold radius otherwise.
    const hits = (e.intersections ?? []).filter((h: any) => {
      const idx = h.index;
      return idx !== undefined && catalog[idx] && visibleIds.has(catalog[idx].id);
    });
    const hit = hits[0] ?? (e.index !== undefined && visibleIds.has(catalog[e.index]?.id) ? e : null);
    if (hit && hit.index !== undefined && catalog[hit.index]) {
      onSelect(catalog[hit.index].id);
    }
  };

  return (
    <points ref={pointsRef} onClick={handleClick}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={MAX_RENDERED_OBJECTS}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={MAX_RENDERED_OBJECTS}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={MAX_RENDERED_OBJECTS}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.018}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Render "user" kind objects as a separate, larger, brighter overlay so the
// launch-sim point is visually 2× the size of regular catalog points.
function UserObjects({
  catalog,
  visibleIds,
  time,
}: {
  catalog: OrbitObject[];
  visibleIds: Set<string>;
  time: Date;
}) {
  const userObjs = useMemo(
    () => catalog.filter((o) => o.kind === "user"),
    [catalog]
  );
  const MAX_USER = 32;
  const positions = useMemo(() => new Float32Array(MAX_USER * 3), []);
  const ref = useRef<THREE.Points>(null);

  useFrame(() => {
    for (let i = 0; i < MAX_USER; i++) {
      const o = userObjs[i];
      if (!o || !visibleIds.has(o.id)) {
        positions[i * 3] = 1e6;
        positions[i * 3 + 1] = 1e6;
        positions[i * 3 + 2] = 1e6;
        continue;
      }
      let p;
      try {
        p = propagate(o, time);
      } catch {
        p = null;
      }
      if (!p || !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) {
        positions[i * 3] = 1e6;
        positions[i * 3 + 1] = 1e6;
        positions[i * 3 + 2] = 1e6;
        continue;
      }
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.z;
      positions[i * 3 + 2] = -p.y;
    }
    if (ref.current) {
      (ref.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  if (userObjs.length === 0) return null;
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={MAX_USER}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.036}
        color="#00ff44"
        sizeAttenuation
        transparent
        opacity={1}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Break-apart animation: shows the steel cube striking the target body at the
// impact site, then both bodies shattering into chunks that fly out along the
// exact ejection directions the collision model produced.
// ---------------------------------------------------------------------------
const KM_TO_UNITS = EARTH_RADIUS_UNITS / EARTH_RADIUS_KM;
const COLLISION_DUR = 3; // seconds

function CollisionScene({ event }: { event: CollisionEvent & { key: number } }) {
  const group = useRef<THREE.Group>(null);
  const start = useRef(0);
  const chunkRefs = useRef<(THREE.Mesh | null)[]>([]);
  const impactorRef = useRef<THREE.Mesh>(null);
  const targetRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.Mesh>(null);

  const pos = useMemo(
    () =>
      new THREE.Vector3(
        event.positionEci.x,
        event.positionEci.z,
        -event.positionEci.y
      ).multiplyScalar(KM_TO_UNITS),
    [event.key]
  );
  const impactDirScene = useMemo(
    () =>
      new THREE.Vector3(
        event.impactDirEci.x,
        event.impactDirEci.z,
        -event.impactDirEci.y
      ).normalize(),
    [event.key]
  );
  const chunkDirs = useMemo(
    () =>
      event.chunks.map((c) =>
        new THREE.Vector3(c.dir.x, c.dir.z, -c.dir.y).normalize()
      ),
    [event.key]
  );

  useEffect(() => {
    start.current = 0;
  }, [event.key]);

  useFrame((state) => {
    if (start.current === 0) start.current = state.clock.elapsedTime;
    const e = state.clock.elapsedTime - start.current;

    // Phase 1: the impactor cube closes on the target.
    const approach = Math.min(1, e / 0.6);
    if (impactorRef.current) {
      impactorRef.current.position.copy(
        impactDirScene.clone().multiplyScalar(-0.18 * (1 - approach))
      );
      impactorRef.current.visible = e < 0.7;
    }
    if (targetRef.current) targetRef.current.visible = e < 0.65;

    // Phase 2: impact flash.
    if (flashRef.current) {
      const f = e >= 0.55 && e < 0.95 ? 1 - (e - 0.55) / 0.4 : 0;
      flashRef.current.scale.setScalar(0.03 + 0.2 * (1 - f));
      (flashRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, f);
      flashRef.current.visible = f > 0;
    }

    // Phase 3: chunks fly out along their ejection directions and fade.
    const frag = Math.max(0, (e - 0.6) / (COLLISION_DUR - 0.6));
    for (let i = 0; i < chunkRefs.current.length; i++) {
      const m = chunkRefs.current[i];
      if (!m) continue;
      const c = event.chunks[i];
      const dist = frag * (0.05 + c.speed * 0.3);
      m.position.copy(chunkDirs[i].clone().multiplyScalar(dist));
      m.visible = e > 0.55;
      (m.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 1 - frag);
    }

    if (group.current) group.current.visible = e < COLLISION_DUR;
  });

  const isCyl = event.target.shape === "cylinder";

  return (
    <group ref={group} position={pos}>
      {/* steel target body (rough shape) */}
      <mesh ref={targetRef}>
        {isCyl ? (
          <cylinderGeometry args={[0.03, 0.03, 0.1, 16]} />
        ) : (
          <boxGeometry args={[0.06, 0.06, 0.045]} />
        )}
        <meshStandardMaterial color="#9aa4b2" metalness={0.9} roughness={0.35} />
      </mesh>

      {/* steel impactor cube */}
      <mesh ref={impactorRef}>
        <boxGeometry args={[0.03, 0.03, 0.03]} />
        <meshStandardMaterial color="#dbe3ee" metalness={0.95} roughness={0.22} />
      </mesh>

      {/* impact flash */}
      <mesh ref={flashRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color="#fff1c0"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* flying steel chunks */}
      {event.chunks.map((c, i) => (
        <mesh
          key={i}
          ref={(el) => {
            chunkRefs.current[i] = el;
          }}
          visible={false}
        >
          <boxGeometry args={[0.012 + c.speed * 0.01, 0.01, 0.009]} />
          <meshStandardMaterial
            color={c.body === "impactor" ? "#dbe3ee" : "#9aa4b2"}
            metalness={0.9}
            roughness={0.4}
            transparent
            opacity={1}
          />
        </mesh>
      ))}
    </group>
  );
}

export function Globe(props: GlobeProps) {
  return (
    <Canvas
      camera={{ position: [0, 1.5, 4.5], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={["#040814"]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-5, -2, -5]} intensity={0.5} color="#22d3ee" />
      <Stars radius={50} depth={50} count={3000} factor={3} fade speed={0.5} />
      <Earth />
      <DebrisCloud {...props} />
      <UserObjects catalog={props.catalog} visibleIds={props.visibleIds} time={props.time} />
      <OrbitControls
        enablePan={false}
        minDistance={1.6}
        maxDistance={10}
        rotateSpeed={0.5}
        autoRotate={false}
      />
    </Canvas>
  );
}
