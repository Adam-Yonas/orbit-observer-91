import * as satellite from "satellite.js";

export type DebrisKind = "payload" | "rocket_body" | "debris" | "user";

export interface OrbitObject {
  id: string;
  name: string;
  kind: DebrisKind;
  country: string;
  collisionGeneration?: number;
  // SGP4 record
  satrec: satellite.SatRec;
  // cached orbital elements (km, deg)
  perigeeKm: number;
  apogeeKm: number;
  inclinationDeg: number;
  periodMin: number;
  // computed risk 0-1
  risk: number;
}

const EARTH_RADIUS_KM = 6371;
const MU = 398600.4418; // km^3/s^2

// A small curated set of real-ish TLEs (epoch-agnostic demo set).
// Mix of ISS, Starlink, debris, rocket bodies. We'll also synthesize many more.
const SEED_TLES: Array<{ name: string; kind: DebrisKind; country: string; l1: string; l2: string }> = [
  {
    name: "ISS (ZARYA)",
    kind: "payload",
    country: "INTL",
    l1: "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9994",
    l2: "2 25544  51.6400 337.6603 0007417  35.0000 100.0000 15.49000000400000",
  },
  {
    name: "HUBBLE",
    kind: "payload",
    country: "USA",
    l1: "1 20580U 90037B   24001.50000000  .00001234  00000-0  56789-4 0  9991",
    l2: "2 20580  28.4690 100.0000 0002800  90.0000 270.0000 15.10000000400000",
  },
];

function randomTLE(idx: number, kind: DebrisKind): { name: string; country: string; l1: string; l2: string } {
  const countries = ["USA", "CIS", "PRC", "ESA", "JPN", "IND", "INTL"];
  const country = countries[idx % countries.length];
  const namePrefix = kind === "payload" ? "SAT" : kind === "rocket_body" ? "R/B" : "DEB";
  const name = `${namePrefix}-${(idx + 1000).toString(36).toUpperCase()}`;

  // Vary altitude band: LEO heavy, some MEO, few GEO-ish (we cap at ~2000 km for visual density)
  const r = Math.random();
  let altKm: number;
  if (r < 0.78) altKm = 400 + Math.random() * 600; // LEO
  else if (r < 0.95) altKm = 1000 + Math.random() * 800; // upper LEO
  else altKm = 1800 + Math.random() * 200;

  const a = EARTH_RADIUS_KM + altKm; // semi-major axis km
  const periodSec = 2 * Math.PI * Math.sqrt((a * a * a) / MU);
  const meanMotion = 86400 / periodSec; // rev/day

  const ecc = Math.random() * 0.02; // near-circular
  const inc = Math.random() < 0.6
    ? 50 + Math.random() * 50 // common inclined
    : Math.random() * 100;
  const raan = Math.random() * 360;
  const argp = Math.random() * 360;
  const meanAnom = Math.random() * 360;

  const noradId = (40000 + idx).toString().padStart(5, "0");
  const epochYear = "24";
  const epochDay = "001.50000000";

  const eccStr = ecc.toFixed(7).slice(2); // 7 digits
  const incStr = inc.toFixed(4).padStart(8, " ");
  const raanStr = raan.toFixed(4).padStart(8, " ");
  const argpStr = argp.toFixed(4).padStart(8, " ");
  const maStr = meanAnom.toFixed(4).padStart(8, " ");
  const mmStr = meanMotion.toFixed(8).padStart(11, " ");

  const l1 = `1 ${noradId}U 24001A   ${epochYear}${epochDay}  .00000000  00000-0  00000-0 0  9990`;
  const l2 = `2 ${noradId} ${incStr} ${raanStr} ${eccStr} ${argpStr} ${maStr} ${mmStr}000010`;
  return { name, country, l1, l2 };
}

function tleToObject(
  id: string,
  name: string,
  kind: DebrisKind,
  country: string,
  l1: string,
  l2: string
): OrbitObject | null {
  const satrec = satellite.twoline2satrec(l1, l2);
  if (!satrec || satrec.error) return null;

  // Mean motion (rad/min) → semi-major axis (km)
  const n = satrec.no; // rad/min
  const nRadSec = n / 60;
  const a = Math.cbrt(MU / (nRadSec * nRadSec));
  const e = satrec.ecco;
  const perigeeKm = a * (1 - e) - EARTH_RADIUS_KM;
  const apogeeKm = a * (1 + e) - EARTH_RADIUS_KM;
  const inclinationDeg = (satrec.inclo * 180) / Math.PI;
  const periodMin = (2 * Math.PI) / n;

  // Risk heuristic: LEO 500-900 km is most congested; debris/rocket bodies riskier
  const altMid = (perigeeKm + apogeeKm) / 2;
  let risk = 0;
  if (altMid > 350 && altMid < 1100) {
    risk += 0.5 * (1 - Math.abs(altMid - 700) / 400);
  }
  if (kind === "debris") risk += 0.3;
  else if (kind === "rocket_body") risk += 0.15;
  risk += Math.random() * 0.2;
  risk = Math.max(0, Math.min(1, risk));

  return {
    id,
    name,
    kind,
    country,
    satrec,
    perigeeKm,
    apogeeKm,
    inclinationDeg,
    periodMin,
    risk,
  };
}

export function generateCatalog(count = 2500): OrbitObject[] {
  const out: OrbitObject[] = [];
  SEED_TLES.forEach((s, i) => {
    const obj = tleToObject(`seed-${i}`, s.name, s.kind, s.country, s.l1, s.l2);
    if (obj) out.push(obj);
  });

  for (let i = 0; i < count; i++) {
    // distribution: 18% payloads, 12% rocket bodies, 70% debris
    const r = Math.random();
    const kind: DebrisKind = r < 0.18 ? "payload" : r < 0.30 ? "rocket_body" : "debris";
    const t = randomTLE(i, kind);
    const obj = tleToObject(`gen-${i}`, t.name, kind, t.country, t.l1, t.l2);
    if (obj) out.push(obj);
  }
  return out;
}

export interface PropagatedPos {
  x: number;
  y: number;
  z: number; // ECI normalized (units of EARTH_RADIUS)
  altKm: number;
  velKms: number;
}

export function propagate(obj: OrbitObject, date: Date): PropagatedPos | null {
  const pv = satellite.propagate(obj.satrec, date);
  if (!pv || !pv.position || typeof pv.position === "boolean") return null;
  const p = pv.position as satellite.EciVec3<number>;
  const v = pv.velocity as satellite.EciVec3<number>;
  const altKm = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) - EARTH_RADIUS_KM;
  const velKms = v ? Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) : 0;
  // Normalize to Earth radius units for rendering
  const s = 1 / EARTH_RADIUS_KM;
  return { x: p.x * s, y: p.y * s, z: p.z * s, altKm, velKms };
}

export const EARTH_RADIUS_UNITS = 1; // we render Earth at radius 1
export { EARTH_RADIUS_KM };

// ---------------------------------------------------------------------------
// Kessler / NASA Standard Breakup Model (simplified)
// ---------------------------------------------------------------------------
// Real fragmentations don't randomize orbits globally — fragments inherit the
// parent's state vector at impact, then receive a delta-v "kick" distributed
// roughly isotropically. Magnitudes follow from collision energy. We:
//   1. Sample parent ECI position + velocity at impact time.
//   2. For each fragment, draw a delta-v from a power-law (most pieces small,
//      a few fast) and apply an isotropic random direction.
//   3. Convert the resulting state vector → classical orbital elements.
//   4. Synthesize a valid TLE from those elements so SGP4 propagates them.

export interface CascadeParams {
  count: number;            // number of fragments to spawn
  impactorMassKg: number;   // mass of striking object
  impactorVelKms: number;   // relative impact velocity (km/s)
  targetMassKg?: number;    // optional override for parent mass
  // Impactor approach direction in the parent's local Velocity / Normal / Co-normal
  // (VNC) frame. Each component is a fraction of the impactor velocity vector
  // along that axis. Defaults to a head-on retrograde hit (-1, 0, 0).
  // V = along parent velocity, N = orbit normal, C = radial (out from Earth).
  impactorDirVNC?: { v: number; n: number; c: number };
  // Cone half-angle (deg) around the post-collision momentum vector that the
  // ejecta is biased into. 180 = fully isotropic (default); smaller values
  // produce a focused debris jet in the direction of the impact.
  ejectaConeDeg?: number;
}

export interface ChainCollisionEvent {
  parentId: string;
  fragmentId: string;
  victimId: string;
  altKm: number;
  generation: number;
}

const J2000 = new Date(Date.UTC(2000, 0, 1, 12, 0, 0)).getTime();

function inferMassKg(kind: DebrisKind): number {
  if (kind === "payload") return 1500;       // typical comsat / Starlink-class
  if (kind === "rocket_body") return 2000;   // upper stage
  return 50;                                 // debris fragment baseline
}

interface KeplerianElements {
  a: number;        // semi-major axis (km)
  e: number;        // eccentricity
  i: number;        // inclination (rad)
  raan: number;     // right ascension of ascending node (rad)
  argp: number;     // argument of perigee (rad)
  nu: number;       // true anomaly (rad)
}

// State vector (r [km], v [km/s], ECI) → Keplerian elements.
function stateToKeplerian(
  r: { x: number; y: number; z: number },
  v: { x: number; y: number; z: number }
): KeplerianElements | null {
  const rMag = Math.hypot(r.x, r.y, r.z);
  const vMag = Math.hypot(v.x, v.y, v.z);
  if (rMag < 1e-6) return null;

  // Specific angular momentum h = r × v
  const hx = r.y * v.z - r.z * v.y;
  const hy = r.z * v.x - r.x * v.z;
  const hz = r.x * v.y - r.y * v.x;
  const hMag = Math.hypot(hx, hy, hz);
  if (hMag < 1e-6) return null;

  // Node line n = k × h, where k = (0,0,1)
  const nx = -hy;
  const ny = hx;
  const nMag = Math.hypot(nx, ny);

  // Eccentricity vector e = ((v² − μ/r)·r − (r·v)·v) / μ
  const rDotV = r.x * v.x + r.y * v.y + r.z * v.z;
  const f1 = vMag * vMag - MU / rMag;
  const ex = (f1 * r.x - rDotV * v.x) / MU;
  const ey = (f1 * r.y - rDotV * v.y) / MU;
  const ez = (f1 * r.z - rDotV * v.z) / MU;
  const e = Math.hypot(ex, ey, ez);

  // Specific energy → semi-major axis
  const energy = (vMag * vMag) / 2 - MU / rMag;
  if (energy >= 0) return null; // hyperbolic / parabolic — fragment escapes
  const a = -MU / (2 * energy);

  const i = Math.acos(Math.max(-1, Math.min(1, hz / hMag)));

  let raan = 0;
  if (nMag > 1e-9) {
    raan = Math.acos(Math.max(-1, Math.min(1, nx / nMag)));
    if (ny < 0) raan = 2 * Math.PI - raan;
  }

  let argp = 0;
  if (nMag > 1e-9 && e > 1e-9) {
    const nDotE = (nx * ex + ny * ey) / (nMag * e);
    argp = Math.acos(Math.max(-1, Math.min(1, nDotE)));
    if (ez < 0) argp = 2 * Math.PI - argp;
  }

  let nu = 0;
  if (e > 1e-9) {
    const eDotR = (ex * r.x + ey * r.y + ez * r.z) / (e * rMag);
    nu = Math.acos(Math.max(-1, Math.min(1, eDotR)));
    if (rDotV < 0) nu = 2 * Math.PI - nu;
  } else {
    // Circular orbit: use argument of latitude
    nu = Math.atan2(r.y, r.x);
  }

  return { a, e, i, raan, argp, nu };
}

// True anomaly → mean anomaly (Kepler's equation, elliptic only)
function trueToMeanAnomaly(nu: number, e: number): number {
  const cosNu = Math.cos(nu);
  const sinNu = Math.sin(nu);
  const cosE = (e + cosNu) / (1 + e * cosNu);
  const sinE = (Math.sqrt(1 - e * e) * sinNu) / (1 + e * cosNu);
  const E = Math.atan2(sinE, cosE);
  return E - e * Math.sin(E);
}

// Sample a unit vector uniformly on the sphere.
function randomUnitVector(): { x: number; y: number; z: number } {
  const u = Math.random() * 2 - 1;
  const theta = Math.random() * 2 * Math.PI;
  const s = Math.sqrt(1 - u * u);
  return { x: s * Math.cos(theta), y: s * Math.sin(theta), z: u };
}

// Power-law sample on [min, max] with exponent α (NASA SBM uses α ≈ -2.6
// for size; we apply a similar shape to delta-v magnitudes so most fragments
// are slow and a few are fast).
function powerLawSample(min: number, max: number, alpha = -2.0): number {
  const r = Math.random();
  const a1 = alpha + 1;
  return Math.pow(r * (Math.pow(max, a1) - Math.pow(min, a1)) + Math.pow(min, a1), 1 / a1);
}

export function spawnFragments(
  parent: OrbitObject,
  paramsOrCount: CascadeParams | number = 80,
  impactTime: Date = new Date()
): OrbitObject[] {
  const params: CascadeParams =
    typeof paramsOrCount === "number"
      ? { count: paramsOrCount, impactorMassKg: 100, impactorVelKms: 10 }
      : paramsOrCount;

  // Get parent ECI state at impact (km, km/s)
  const pv = satellite.propagate(parent.satrec, impactTime);
  if (!pv || !pv.position || !pv.velocity || typeof pv.position === "boolean") return [];
  const r0 = pv.position as satellite.EciVec3<number>;
  const v0 = pv.velocity as satellite.EciVec3<number>;

  // Characteristic delta-v from kinetic-energy / momentum coupling:
  //   Δv_target ≈ (m_impactor / m_target) · v_rel
  // We then spread fragment kicks over a power-law around this scale so that
  // most pieces stay near the original orbit and a small tail is hurled into
  // very different orbits — the visual signature of a real Kessler event.
  const targetMass = params.targetMassKg ?? inferMassKg(parent.kind);
  const dvScale = Math.max(
    0.05,
    Math.min(4.0, (params.impactorMassKg / targetMass) * params.impactorVelKms)
  ); // km/s, clamped so we don't immediately escape Earth

  // Build the parent's local VNC (Velocity-Normal-Co-normal) frame so the
  // impactor direction is expressed relative to how the parent is moving.
  //   V̂ = velocity unit vector
  //   N̂ = (r × v) unit  (orbit normal)
  //   Ĉ = V̂ × N̂        (completes the right-handed frame, ~radial)
  const vMag0 = Math.hypot(v0.x, v0.y, v0.z) || 1;
  const Vhat = { x: v0.x / vMag0, y: v0.y / vMag0, z: v0.z / vMag0 };
  const nx = r0.y * v0.z - r0.z * v0.y;
  const ny = r0.z * v0.x - r0.x * v0.z;
  const nz = r0.x * v0.y - r0.y * v0.x;
  const nMag0 = Math.hypot(nx, ny, nz) || 1;
  const Nhat = { x: nx / nMag0, y: ny / nMag0, z: nz / nMag0 };
  const Chat = {
    x: Vhat.y * Nhat.z - Vhat.z * Nhat.y,
    y: Vhat.z * Nhat.x - Vhat.x * Nhat.z,
    z: Vhat.x * Nhat.y - Vhat.y * Nhat.x,
  };

  const dirVNC = params.impactorDirVNC ?? { v: -1, n: 0, c: 0 };
  const dirMag = Math.hypot(dirVNC.v, dirVNC.n, dirVNC.c) || 1;
  // Impactor velocity unit vector in ECI
  const impactorHat = {
    x: (dirVNC.v * Vhat.x + dirVNC.n * Nhat.x + dirVNC.c * Chat.x) / dirMag,
    y: (dirVNC.v * Vhat.y + dirVNC.n * Nhat.y + dirVNC.c * Chat.y) / dirMag,
    z: (dirVNC.v * Vhat.z + dirVNC.n * Nhat.z + dirVNC.c * Chat.z) / dirMag,
  };

  // Momentum-balance bias: post-impact target ΔV points along (m_i v_i + m_t v_t)
  // minus v_t, normalized. We treat the parent as initially at rest in its own
  // frame, so the bias direction is simply the impactor's velocity direction.
  const biasDir = impactorHat;

  // Cone half-angle (radians) for ejecta spread around the bias direction.
  const coneDeg = Math.max(5, Math.min(180, params.ejectaConeDeg ?? 180));
  const cosConeMin = Math.cos((coneDeg * Math.PI) / 180);

  // Build an orthonormal basis around biasDir for cone sampling
  const helper =
    Math.abs(biasDir.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const bx = {
    x: biasDir.y * helper.z - biasDir.z * helper.y,
    y: biasDir.z * helper.x - biasDir.x * helper.z,
    z: biasDir.x * helper.y - biasDir.y * helper.x,
  };
  const bxMag = Math.hypot(bx.x, bx.y, bx.z) || 1;
  bx.x /= bxMag; bx.y /= bxMag; bx.z /= bxMag;
  const by = {
    x: biasDir.y * bx.z - biasDir.z * bx.y,
    y: biasDir.z * bx.x - biasDir.x * bx.z,
    z: biasDir.x * bx.y - biasDir.y * bx.x,
  };

  const stamp = Date.now();
  const epoch = (impactTime.getTime() - J2000) / 86400000 + 10957.5; // days since 1950-01-01 (TLE epoch)
  const epochYear = (impactTime.getUTCFullYear() % 100).toString().padStart(2, "0");
  const yearStart = Date.UTC(impactTime.getUTCFullYear(), 0, 1);
  const epochDay = ((impactTime.getTime() - yearStart) / 86400000 + 1).toFixed(8).padStart(12, "0");
  void epoch;

  const out: OrbitObject[] = [];
  let attempts = 0;
  let i = 0;
  while (out.length < params.count && attempts < params.count * 5) {
    attempts++;
    i++;

    // Sample a unit vector inside the cone around biasDir
    const u = cosConeMin + Math.random() * (1 - cosConeMin); // cos(theta)
    const sinT = Math.sqrt(Math.max(0, 1 - u * u));
    const phi = Math.random() * 2 * Math.PI;
    const dir = {
      x: biasDir.x * u + (bx.x * Math.cos(phi) + by.x * Math.sin(phi)) * sinT,
      y: biasDir.y * u + (bx.y * Math.cos(phi) + by.y * Math.sin(phi)) * sinT,
      z: biasDir.z * u + (bx.z * Math.cos(phi) + by.z * Math.sin(phi)) * sinT,
    };

    // Sample isotropic delta-v magnitude (power-law)
    const dvMag = powerLawSample(0.02, dvScale * 2.5, -2.0);
    const v1 = {
      x: v0.x + dir.x * dvMag,
      y: v0.y + dir.y * dvMag,
      z: v0.z + dir.z * dvMag,
    };

    const kep = stateToKeplerian(r0, v1);
    if (!kep) continue;
    if (kep.a * (1 - kep.e) < EARTH_RADIUS_KM + 120) continue; // perigee inside atmosphere

    const periodSec = 2 * Math.PI * Math.sqrt((kep.a * kep.a * kep.a) / MU);
    if (!isFinite(periodSec) || periodSec < 60) continue;
    const meanMotion = 86400 / periodSec; // rev/day
    if (meanMotion < 1 || meanMotion > 20) continue;

    const incDeg = (kep.i * 180) / Math.PI;
    const raanDeg = ((kep.raan * 180) / Math.PI + 360) % 360;
    const argpDeg = ((kep.argp * 180) / Math.PI + 360) % 360;
    const M = trueToMeanAnomaly(kep.nu, kep.e);
    const maDeg = ((M * 180) / Math.PI + 360) % 360;

    const noradId = (80000 + ((stamp + i) % 9999)).toString();
    const eccStr = Math.min(0.9999999, Math.max(0, kep.e)).toFixed(7).slice(2);
    const incStr = incDeg.toFixed(4).padStart(8, " ");
    const raanStr = raanDeg.toFixed(4).padStart(8, " ");
    const argpStr = argpDeg.toFixed(4).padStart(8, " ");
    const maStr = maDeg.toFixed(4).padStart(8, " ");
    const mmStr = meanMotion.toFixed(8).padStart(11, " ");

    const l1 = `1 ${noradId}U 24001A   ${epochYear}${epochDay}  .00000000  00000-0  00000-0 0  9990`;
    const l2 = `2 ${noradId} ${incStr} ${raanStr} ${eccStr} ${argpStr} ${maStr} ${mmStr}000010`;
    const obj = tleToObject(
      `frag-${stamp}-${i}`,
      `FRAG-${i}`,
      "debris",
      parent.country,
      l1,
      l2
    );
    if (!obj) continue;
    const test = propagate(obj, impactTime);
    if (!test || !isFinite(test.x) || !isFinite(test.y) || !isFinite(test.z)) continue;
    obj.risk = 0.9;
    out.push(obj);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Chain-reaction conjunction screening
// ---------------------------------------------------------------------------
// After a breakup we step the simulation forward in coarse intervals and check
// whether any new fragment passes within a chosen miss-distance of another
// catalog object. Each hit shatters the victim using a smaller secondary event
// (less momentum than the user-defined primary impact). This is what makes a
// real Kessler scenario "cascade" — one breakup seeds the next.

export interface ChainOptions {
  horizonMin: number;          // how far forward (sim minutes) to screen
  stepSec: number;             // sampling step size (seconds)
  missDistanceKm: number;      // Euclidean distance counted as a hit
  maxGenerations: number;      // recursion depth cap
  maxNewFragments: number;     // safety cap to keep render stable
  fragmentsPerHit: number;     // fragments produced by each secondary breakup
  fragmentMassKg?: number;     // assumed mass of a fragment striking a target
  fragmentVelKms?: number;     // assumed relative velocity at secondary impact
}

export interface ChainResult {
  newFragments: OrbitObject[];
  destroyedIds: string[];
  events: ChainCollisionEvent[];
}

const DEFAULT_CHAIN: ChainOptions = {
  horizonMin: 90,
  stepSec: 30,
  missDistanceKm: 5,
  maxGenerations: 3,
  maxNewFragments: 600,
  fragmentsPerHit: 30,
  fragmentMassKg: 2,
  fragmentVelKms: 12,
};

// Quick ECI position in km (no normalization) at a specific time.
function positionKm(obj: OrbitObject, date: Date): { x: number; y: number; z: number } | null {
  const pv = satellite.propagate(obj.satrec, date);
  if (!pv || !pv.position || typeof pv.position === "boolean") return null;
  const p = pv.position as satellite.EciVec3<number>;
  if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) return null;
  return { x: p.x, y: p.y, z: p.z };
}

interface PositionedObject {
  obj: OrbitObject;
  pos: { x: number; y: number; z: number };
}

function cellKey(pos: { x: number; y: number; z: number }, cellSize: number) {
  return [
    Math.floor(pos.x / cellSize),
    Math.floor(pos.y / cellSize),
    Math.floor(pos.z / cellSize),
  ].join(":");
}

function buildVictimGrid(victims: OrbitObject[], time: Date, cellSize: number) {
  const grid = new Map<string, PositionedObject[]>();

  for (const victim of victims) {
    const pos = positionKm(victim, time);
    if (!pos) continue;
    const key = cellKey(pos, cellSize);
    const bucket = grid.get(key);
    if (bucket) bucket.push({ obj: victim, pos });
    else grid.set(key, [{ obj: victim, pos }]);
  }

  return grid;
}

function findCollisionCandidate(
  fragPos: { x: number; y: number; z: number },
  grid: Map<string, PositionedObject[]>,
  missSq: number,
  cellSize: number,
  blockedVictimIds: Set<string>
) {
  const cx = Math.floor(fragPos.x / cellSize);
  const cy = Math.floor(fragPos.y / cellSize);
  const cz = Math.floor(fragPos.z / cellSize);

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        const bucket = grid.get([cx + dx, cy + dy, cz + dz].join(":"));
        if (!bucket) continue;

        for (const candidate of bucket) {
          if (blockedVictimIds.has(candidate.obj.id)) continue;
          const px = fragPos.x - candidate.pos.x;
          const py = fragPos.y - candidate.pos.y;
          const pz = fragPos.z - candidate.pos.z;
          if (px * px + py * py + pz * pz <= missSq) {
            return candidate;
          }
        }
      }
    }
  }

  return null;
}

export function runChainReaction(
  catalog: OrbitObject[],
  initialFragments: OrbitObject[],
  startTime: Date,
  options: Partial<ChainOptions> = {}
): ChainResult {
  const opts = { ...DEFAULT_CHAIN, ...options };
  const aliveCatalog = new Map(catalog.map((o) => [o.id, o]));
  const fragmentIds = new Set(initialFragments.map((f) => f.id));
  const destroyedIdSet = new Set<string>();
  const destroyedIds: string[] = [];
  const events: ChainCollisionEvent[] = [];
  const newFragments: OrbitObject[] = [];
  const missSq = opts.missDistanceKm * opts.missDistanceKm;
  const cellSize = Math.max(opts.missDistanceKm * 2, 25);
  const stepMs = opts.stepSec * 1000;
  const horizonMs = opts.horizonMin * 60 * 1000;

  let generation = 1;
  let activeFragments = initialFragments.slice();

  while (
    generation <= opts.maxGenerations &&
    activeFragments.length > 0 &&
    newFragments.length < opts.maxNewFragments
  ) {
    const nextGenFragments: OrbitObject[] = [];
    let unresolvedFragments = activeFragments.slice();

    for (let dt = stepMs; dt <= horizonMs && unresolvedFragments.length > 0; dt += stepMs) {
      const t = new Date(startTime.getTime() + dt);
      const victims = Array.from(aliveCatalog.values()).filter(
        (o) => !fragmentIds.has(o.id) && !destroyedIdSet.has(o.id)
      );
      if (victims.length === 0) break;

      const blockedVictimIds = new Set<string>();
      const grid = buildVictimGrid(victims, t, cellSize);
      const remainingFragments: OrbitObject[] = [];

      for (const frag of unresolvedFragments) {
        if (newFragments.length >= opts.maxNewFragments) break;

        const fragPos = positionKm(frag, t);
        if (!fragPos) {
          remainingFragments.push(frag);
          continue;
        }

        const hit = findCollisionCandidate(fragPos, grid, missSq, cellSize, blockedVictimIds);
        if (!hit) {
          remainingFragments.push(frag);
          continue;
        }

        const secondary = spawnFragments(
          hit.obj,
          {
            count: opts.fragmentsPerHit,
            impactorMassKg: opts.fragmentMassKg ?? 2,
            impactorVelKms: opts.fragmentVelKms ?? 12,
            ejectaConeDeg: 180,
            impactorDirVNC: (() => {
              const dir = randomUnitVector();
              return { v: dir.x, n: dir.y, c: dir.z };
            })(),
          },
          t
        );

        if (secondary.length === 0) {
          remainingFragments.push(frag);
          continue;
        }

        blockedVictimIds.add(hit.obj.id);
        destroyedIdSet.add(hit.obj.id);
        destroyedIds.push(hit.obj.id);
        aliveCatalog.delete(hit.obj.id);

        const altKm = Math.hypot(hit.pos.x, hit.pos.y, hit.pos.z) - EARTH_RADIUS_KM;
        events.push({
          parentId: frag.id,
          fragmentId: frag.id,
          victimId: hit.obj.id,
          altKm,
          generation,
        });

        secondary.forEach((s) => {
          s.risk = 1;
          s.collisionGeneration = generation;
          fragmentIds.add(s.id);
          newFragments.push(s);
          nextGenFragments.push(s);
        });
      }

      unresolvedFragments = remainingFragments;
    }

    activeFragments = nextGenFragments;
    generation++;
  }

  return { newFragments, destroyedIds, events };
}

export async function runChainReactionAsync(
  catalog: OrbitObject[],
  initialFragments: OrbitObject[],
  startTime: Date,
  options: Partial<ChainOptions> = {}
) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return runChainReaction(catalog, initialFragments, startTime, options);
}

// Build an OrbitObject from a raw TLE pair coming from CelesTrak
export function objectFromTle(
  id: string,
  name: string,
  kind: DebrisKind,
  country: string,
  l1: string,
  l2: string
): OrbitObject | null {
  return tleToObject(id, name, kind, country, l1, l2);
}

interface LiveTleRow {
  name: string;
  noradId: string;
  line1: string;
  line2: string;
  group: string;
}

function classifyFromName(name: string): DebrisKind {
  const n = name.toUpperCase();
  if (n.includes("DEB")) return "debris";
  if (n.includes("R/B") || n.includes("ROCKET")) return "rocket_body";
  return "payload";
}

export async function fetchLiveCatalog(
  groups: string[] = ["active", "iridium-33-debris", "cosmos-1408-debris"],
  supabaseUrl?: string
): Promise<OrbitObject[]> {
  const base =
    supabaseUrl ?? (import.meta as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL;
  if (!base) throw new Error("VITE_SUPABASE_URL not configured");

  const all: OrbitObject[] = [];
  for (const group of groups) {
    const url = `${base}/functions/v1/fetch-tle?group=${encodeURIComponent(group)}&limit=2000`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`fetch-tle failed for ${group}: ${resp.status}`);
      continue;
    }
    const json: { objects: LiveTleRow[] } = await resp.json();
    json.objects.forEach((row, i) => {
      const kind = group.includes("debris") ? "debris" : classifyFromName(row.name);
      const obj = tleToObject(
        `live-${group}-${row.noradId}-${i}`,
        row.name,
        kind,
        "INTL",
        row.line1,
        row.line2
      );
      if (obj) all.push(obj);
    });
  }
  return all;
}
