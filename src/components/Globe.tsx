import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { OrbitObject, propagate, EARTH_RADIUS_UNITS } from "@/lib/orbital";

interface GlobeProps {
  catalog: OrbitObject[];
  visibleIds: Set<string>;
  time: Date;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  cascadeIds: Set<string>;
}

const COLORS = {
  payload: new THREE.Color("#22d3ee"),
  rocket_body: new THREE.Color("#f59e0b"),
  debris: new THREE.Color("#a78bfa"),
  cascade: new THREE.Color("#ef4444"),
  selected: new THREE.Color("#ffffff"),
};

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
  const positions = useMemo(() => new Float32Array(catalog.length * 3), [catalog.length]);
  const colors = useMemo(() => new Float32Array(catalog.length * 3), [catalog.length]);
  const sizes = useMemo(() => new Float32Array(catalog.length), [catalog.length]);

  // initialize colors based on kind
  useEffect(() => {
    catalog.forEach((o, i) => {
      const c = COLORS[o.kind];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      sizes[i] = o.kind === "payload" ? 0.012 : 0.008;
    });
    if (pointsRef.current) {
      const geom = pointsRef.current.geometry;
      (geom.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      (geom.attributes.size as THREE.BufferAttribute).needsUpdate = true;
    }
  }, [catalog, colors, sizes]);

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

      if (cascadeIds.has(o.id)) {
        const c = COLORS.cascade;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      } else if (o.id === selectedId) {
        const c = COLORS.selected;
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
          count={catalog.length}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={catalog.length}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={catalog.length}
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
      <DebrisCloud key={props.catalog.length} {...props} />
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
