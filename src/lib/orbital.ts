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
