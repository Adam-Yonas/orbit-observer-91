import * as satellite from "satellite.js";

export type DebrisKind = "payload" | "rocket_body" | "debris";

export interface OrbitObject {
  id: string;
  name: string;
  kind: DebrisKind;
  country: string;
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

    // Sample isotropic delta-v
    const dvMag = powerLawSample(0.02, dvScale * 2.5, -2.0);
    const dir = randomUnitVector();
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
