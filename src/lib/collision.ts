// ---------------------------------------------------------------------------
// Hypervelocity impact / fragmentation model (steel-on-steel)
// ---------------------------------------------------------------------------
// When a Kessler cascade is triggered we model the event as a solid STEEL CUBE
// (the imaginary impactor mass) striking a rough-shaped STEEL target. From the
// collision geometry we derive:
//   1. a net centre-of-mass kick (momentum conservation),
//   2. a per-fragment ejection FIELD whose *direction* is set by where each
//      fragment originates relative to the impact point (shock radial + spall
//      back-splash + downrange plume), and
//   3. a small set of visible "chunks" used to animate the two bodies breaking
//      apart at the impact site.
//
// The fragment *speed* magnitudes still come from the validated NASA Standard
// Breakup Model (see orbital.ts `sampleDeltaV`); this module only decides which
// way each fragment flies, grounded in the actual collision instead of a random
// cone.

export type Vec3 = { x: number; y: number; z: number };

const STEEL_DENSITY = 7850; // kg/m^3

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
function randomUnit(): Vec3 {
  const u = Math.random() * 2 - 1;
  const t = Math.random() * 2 * Math.PI;
  const r = Math.sqrt(Math.max(0, 1 - u * u));
  return { x: r * Math.cos(t), y: r * Math.sin(t), z: u };
}

export type TargetShapeKind = "box" | "cylinder" | "chunk";

export interface BodyGeometry {
  shape: TargetShapeKind;
  // Half-extents (metres) in the local impact frame [along, t1, t2].
  half: Vec3;
  // Characteristic size (metres) — the cube-root of the volume.
  charLengthM: number;
}

export interface CollisionChunk {
  // Origin offset from the impact site (metres, ECI).
  origin: Vec3;
  // Ejection velocity direction (unit, ECI).
  dir: Vec3;
  // Relative ejection speed (0..1) used to scale the visual animation.
  speed: number;
  // Approximate chunk radius (metres) for rendering.
  radiusM: number;
  // Which body this chunk came from.
  body: "impactor" | "target";
}

export interface CollisionEvent {
  // Parent ECI position at the moment of impact (km).
  positionEci: Vec3;
  // Unit impact direction in ECI (the way the impactor travels).
  impactDirEci: Vec3;
  // Relative impact speed (km/s).
  vRelKms: number;
  // Whether the specific energy exceeded the catastrophic threshold.
  catastrophic: boolean;
  impactorSizeM: number;
  target: BodyGeometry;
  chunks: CollisionChunk[];
}

export interface CollisionModel {
  event: CollisionEvent;
  // Net centre-of-mass kick applied to every fragment (km/s, ECI).
  vComKickKms: Vec3;
  // Sample one fragment's ejection: a unit direction (ECI) plus a speed
  // multiplier that boosts material thrown from near the impact point.
  sampleFragment(): { dir: Vec3; speedScale: number };
}

interface ImpactInputs {
  r0: Vec3;             // parent ECI position (km)
  impactDirEci: Vec3;   // unit ECI direction the impactor travels
  impactorMassKg: number;
  vRelKms: number;      // relative impact speed
  targetMassKg: number;
  targetKind: "payload" | "rocket_body" | "debris" | "user";
  catastrophic: boolean;
}

// Cube-root volume → characteristic length (m) for a steel body of given mass.
function charLengthFromMass(massKg: number): number {
  return Math.cbrt(Math.max(massKg, 1) / STEEL_DENSITY);
}

function targetGeometry(massKg: number, kind: ImpactInputs["targetKind"]): BodyGeometry {
  const L = charLengthFromMass(massKg);
  if (kind === "rocket_body") {
    // Slender cylinder: long along the impact frame's first axis.
    const radius = L * 0.45;
    const halfLen = L * 1.8;
    return { shape: "cylinder", half: { x: halfLen, y: radius, z: radius }, charLengthM: L };
  }
  if (kind === "debris") {
    return { shape: "chunk", half: { x: L * 0.6, y: L * 0.5, z: L * 0.45 }, charLengthM: L };
  }
  // payload / user: boxy bus + (implied) panels.
  return { shape: "box", half: { x: L * 0.7, y: L * 0.7, z: L * 0.5 }, charLengthM: L };
}

export function simulateImpact(inp: ImpactInputs): CollisionModel {
  const n = norm(inp.impactDirEci); // penetration axis (impactor → target)
  // Orthonormal basis perpendicular to the impact axis.
  const helper = Math.abs(n.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const t1 = norm(cross(n, helper));
  const t2 = cross(n, t1);

  const target = targetGeometry(inp.targetMassKg, inp.targetKind);
  const impactorSizeM = charLengthFromMass(inp.impactorMassKg);

  // Impact point sits on the front (impactor-facing) face of the target,
  // i.e. one half-extent back along the penetration axis from the centre.
  const faceDepth = target.half.x;
  const impactPointLocal = scale(n, -faceDepth); // relative to target centre

  // Momentum conservation: the whole cloud's COM drifts along the impact axis.
  const vCom =
    (inp.impactorMassKg * inp.vRelKms) / (inp.impactorMassKg + inp.targetMassKg);
  const vComKickKms = scale(n, vCom);

  // Convert a local (along, t1, t2) offset to an ECI offset.
  const toEci = (l: Vec3): Vec3 =>
    add(add(scale(n, l.x), scale(t1, l.y)), scale(t2, l.z));

  // Core ejection-field evaluator. Given a local seed position (relative to the
  // target centre), return a unit ECI direction + a speed multiplier.
  const evalField = (localPos: Vec3): { dir: Vec3; speedScale: number } => {
    // Vector from the impact point to the fragment's origin (local frame).
    const fromImpact = sub(localPos, impactPointLocal);
    const distM = len(fromImpact) || 1e-3;
    const radial = scale(fromImpact, 1 / distM); // shock pushes material outward

    // Depth along the penetration axis relative to the impact point: negative
    // = on the impact face (spall back-splash), positive = downrange (plume).
    const depth = dot(fromImpact, n); // metres along n
    const charL = target.charLengthM || 1;
    const depthNorm = Math.max(-1, Math.min(1, depth / charL));

    // Weights: near-face material sprays back toward the impactor and sideways;
    // deep material is punched downrange. Everything also expands radially.
    const downrange = depthNorm > 0 ? depthNorm : 0;
    const spall = depthNorm < 0 ? -depthNorm : 0;
    const axial = scale(n, 0.9 * downrange - 0.7 * spall);

    // Isotropic jitter so the cloud is a realistic spray, not perfectly radial.
    const jitter = scale(randomUnit(), 0.35);

    const dirLocal = add(add(scale(radial, 1.0), axial), jitter);
    const dir = norm(toEci(dirLocal));

    // Material closest to the impact point is shocked hardest → flies fastest.
    const proximity = 1 / (1 + distM / (0.5 * charL));
    const speedScale = 0.6 + 1.4 * proximity; // ~0.6 (far) .. ~2.0 (at impact)
    return { dir, speedScale };
  };

  // Random seed position inside the target volume (rough box sampling).
  const sampleTargetLocal = (): Vec3 => ({
    x: (Math.random() * 2 - 1) * target.half.x,
    y: (Math.random() * 2 - 1) * target.half.y,
    z: (Math.random() * 2 - 1) * target.half.z,
  });

  const sampleFragment = () => {
    // ~20% of fragments come from the disintegrating impactor cube, seeded just
    // outside the impact face; the rest from the target body.
    if (Math.random() < 0.2) {
      const half = impactorSizeM * 0.5;
      const local = add(impactPointLocal, {
        x: -Math.random() * impactorSizeM,
        y: (Math.random() * 2 - 1) * half,
        z: (Math.random() * 2 - 1) * half,
      });
      const r = evalField(local);
      return { dir: r.dir, speedScale: r.speedScale * 1.15 };
    }
    return evalField(sampleTargetLocal());
  };

  // Pre-generate visible chunks for the break-apart animation.
  const chunkCount = inp.catastrophic ? 18 : 10;
  const chunks: CollisionChunk[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const fromImpactor = i < Math.round(chunkCount * 0.25);
    const local = fromImpactor
      ? add(impactPointLocal, {
          x: -Math.random() * impactorSizeM,
          y: (Math.random() * 2 - 1) * impactorSizeM * 0.5,
          z: (Math.random() * 2 - 1) * impactorSizeM * 0.5,
        })
      : sampleTargetLocal();
    const f = evalField(local);
    chunks.push({
      origin: toEci(local),
      dir: f.dir,
      speed: Math.min(1, f.speedScale / 2),
      radiusM: fromImpactor
        ? impactorSizeM * (0.18 + Math.random() * 0.18)
        : target.charLengthM * (0.12 + Math.random() * 0.16),
      body: fromImpactor ? "impactor" : "target",
    });
  }

  const event: CollisionEvent = {
    positionEci: inp.r0,
    impactDirEci: n,
    vRelKms: inp.vRelKms,
    catastrophic: inp.catastrophic,
    impactorSizeM,
    target,
    chunks,
  };

  return { event, vComKickKms, sampleFragment };
}
