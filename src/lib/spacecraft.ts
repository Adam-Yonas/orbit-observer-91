// ---------------------------------------------------------------------------
// Spacecraft body definitions for the launch-driven collision model
// ---------------------------------------------------------------------------
// The body that the user launches becomes the IMPACTOR in any collision the
// launch sim resolves. Its geometry + mass define the collision interface
// (mass for momentum/energy, characteristic length for the breakup geometry).
//
// Two ways to define the body:
//   1. A generic CubeSat form factor (1U..12U) with average CubeSat material.
//   2. A user-supplied CAD mesh (STL), from which we derive a bounding box and
//      a watertight-volume mass estimate using the same average material.

export interface SpacecraftBody {
  name: string;
  // Bounding-box dimensions in metres [x, y, z].
  dimsM: { x: number; y: number; z: number };
  // Total mass (kg).
  massKg: number;
  // Characteristic length (m) = cube-root of the bounding volume.
  charLenM: number;
  // Where the geometry came from.
  source: "cubesat" | "cad";
}

// Average CubeSat structural material: Aluminium 6061-T6.
export const AVG_MATERIAL = { name: "Aluminium 6061", densityKgM3: 2700 } as const;

// Standard CubeSat form factors. Dimensions follow the CubeSat Design Spec
// (1U = 10×10×11.35 cm); masses use the ~1.33 kg/U rule of thumb.
export interface CubeSatSpec {
  key: string;
  label: string;
  dimsM: { x: number; y: number; z: number };
  massKg: number;
}

export const CUBESAT_FORM_FACTORS: CubeSatSpec[] = [
  { key: "1U", label: "1U (10×10×11 cm)", dimsM: { x: 0.1, y: 0.1, z: 0.1135 }, massKg: 1.33 },
  { key: "2U", label: "2U (10×10×23 cm)", dimsM: { x: 0.1, y: 0.1, z: 0.227 }, massKg: 2.66 },
  { key: "3U", label: "3U (10×10×34 cm)", dimsM: { x: 0.1, y: 0.1, z: 0.341 }, massKg: 4.0 },
  { key: "6U", label: "6U (10×23×34 cm)", dimsM: { x: 0.1, y: 0.2265, z: 0.366 }, massKg: 12.0 },
  { key: "12U", label: "12U (23×23×34 cm)", dimsM: { x: 0.2265, y: 0.2265, z: 0.366 }, massKg: 24.0 },
];

function charLenFromDims(d: { x: number; y: number; z: number }): number {
  return Math.cbrt(Math.max(d.x * d.y * d.z, 1e-9));
}

export function cubeSatBody(spec: CubeSatSpec): SpacecraftBody {
  return {
    name: `${spec.key} CubeSat`,
    dimsM: spec.dimsM,
    massKg: spec.massKg,
    charLenM: charLenFromDims(spec.dimsM),
    source: "cubesat",
  };
}

// ---------------------------------------------------------------------------
// STL CAD parsing (binary + ASCII)
// ---------------------------------------------------------------------------
// We derive two things from the mesh:
//   - the axis-aligned bounding box (→ dimensions), and
//   - the signed-tetrahedron volume of the (assumed watertight) mesh (→ mass
//     via the average material density).
// STL files carry no units. We assume millimetres (by far the most common CAD
// export unit); if the model is implausibly large in mm we fall back to metres.

interface MeshStats {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
  volume: number; // in the file's native units^3
}

function parseBinaryStl(buf: ArrayBuffer): MeshStats | null {
  const dv = new DataView(buf);
  if (buf.byteLength < 84) return null;
  const triCount = dv.getUint32(80, true);
  if (84 + triCount * 50 > buf.byteLength) return null;

  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  let vol6 = 0;
  let off = 84;
  for (let i = 0; i < triCount; i++) {
    off += 12; // skip normal
    const v: number[][] = [];
    for (let j = 0; j < 3; j++) {
      const x = dv.getFloat32(off, true);
      const y = dv.getFloat32(off + 4, true);
      const z = dv.getFloat32(off + 8, true);
      off += 12;
      v.push([x, y, z]);
      min.x = Math.min(min.x, x); min.y = Math.min(min.y, y); min.z = Math.min(min.z, z);
      max.x = Math.max(max.x, x); max.y = Math.max(max.y, y); max.z = Math.max(max.z, z);
    }
    off += 2; // attribute byte count
    const [a, b, c] = v;
    vol6 +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return { min, max, volume: Math.abs(vol6) / 6 };
}

function parseAsciiStl(text: string): MeshStats | null {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  let vol6 = 0;
  const verts: number[][] = [];
  const re = /vertex\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const x = parseFloat(m[1]), y = parseFloat(m[2]), z = parseFloat(m[3]);
    verts.push([x, y, z]);
    min.x = Math.min(min.x, x); min.y = Math.min(min.y, y); min.z = Math.min(min.z, z);
    max.x = Math.max(max.x, x); max.y = Math.max(max.y, y); max.z = Math.max(max.z, z);
    if (verts.length === 3) {
      const [a, b, c] = verts;
      vol6 +=
        a[0] * (b[1] * c[2] - b[2] * c[1]) -
        a[1] * (b[0] * c[2] - b[2] * c[0]) +
        a[2] * (b[0] * c[1] - b[1] * c[0]);
      verts.length = 0;
    }
  }
  if (max.x === -Infinity) return null;
  return { min, max, volume: Math.abs(vol6) / 6 };
}

// Parse an STL ArrayBuffer into a SpacecraftBody using the average material.
export function bodyFromStl(buf: ArrayBuffer, fileName = "CAD model"): SpacecraftBody | null {
  // ASCII STL files start with "solid"; but binary files can too, so we test
  // whether the binary triangle count is consistent with the byte length.
  let stats: MeshStats | null = null;
  const dv = new DataView(buf);
  if (buf.byteLength >= 84) {
    const triCount = dv.getUint32(80, true);
    if (84 + triCount * 50 === buf.byteLength) {
      stats = parseBinaryStl(buf);
    }
  }
  if (!stats) {
    try {
      stats = parseAsciiStl(new TextDecoder().decode(buf));
    } catch {
      stats = null;
    }
  }
  if (!stats || !isFinite(stats.volume)) return null;

  let dx = stats.max.x - stats.min.x;
  let dy = stats.max.y - stats.min.y;
  let dz = stats.max.z - stats.min.z;
  let vol = stats.volume;

  // Unit heuristic: a spacecraft bounding box of >50 (in native units) is
  // almost certainly millimetres; convert to metres.
  const maxDim = Math.max(dx, dy, dz);
  let scale = 1;
  if (maxDim > 50) scale = 0.001; // mm → m
  else if (maxDim > 5) scale = 0.01; // cm → m
  dx *= scale; dy *= scale; dz *= scale;
  vol *= scale * scale * scale;

  const dimsM = { x: dx || 0.1, y: dy || 0.1, z: dz || 0.1 };
  const massKg = Math.max(0.1, vol * AVG_MATERIAL.densityKgM3);

  return {
    name: fileName.replace(/\.[^.]+$/, ""),
    dimsM,
    massKg,
    charLenM: charLenFromDims(dimsM),
    source: "cad",
  };
}
