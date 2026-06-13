## Goal

When a Kessler cascade is triggered, run an actual rigid-body impact model between two steel bodies — a cube impactor and a rough-shaped target — then use the per-fragment velocity vectors that model produces to (a) play a short visual "break-apart" of the two bodies at the impact point and (b) seed the orbital fragment cloud with those exact directions.

## How the collision is modeled (steel-on-steel)

A new module `src/lib/collision.ts` computes the physics deterministically:

1. **Geometry from mass + material.** Steel density ρ = 7850 kg/m³.
   - Impactor: cube, side `a = (m_i/ρ)^(1/3)`.
   - Target: rough primitive by kind — `payload` → box/slab, `rocket_body` → cylinder, `debris` → blocky chunk — sized from its inferred mass and ρ.
2. **Impact geometry.** Relative velocity vector from the VNC approach direction the user already selects. Ray-cast the impactor onto the target surface to get the impact point and surface normal.
3. **Momentum & energy partition.**
   - Net COM kick (momentum conservation): `Δv_com = m_i · v_rel / (m_i + m_t)` along the impact direction — the whole cloud drifts this way.
   - Specific energy `E_p/M_t` (already used for catastrophic vs non-catastrophic) sets how violently it shatters.
4. **Per-fragment ejection field.** Each fragment is seeded from a point in one of the two bodies. Its ejection velocity = blend of:
   - **shock radial term**: outward from the impact point, magnitude attenuating with distance (near the impact = fast),
   - **spall cone**: back-splash toward the impactor side (the classic ejecta cone),
   - **downrange plume**: forward through the target along `v_rel`,
   - plus the COM kick.
   Magnitude is still drawn from the validated NASA SBM (`sampleDeltaV`, A/M-coupled) but its **direction now comes from the collision geometry** instead of a random cone — so light near-impact fragments fly fast off the impact face, exactly as in a real hypervelocity test.

## Wiring into the cascade

- `spawnFragments` (orbital.ts) calls `simulateImpact(...)` once, then for each fragment pulls a seed point + direction from the returned field, applies `Δv` along it, and runs the existing state-vector → Keplerian → SGP4 pipeline unchanged. Physics validation (decay, in-plane torus) stays intact.
- `simulateImpact` also returns a lightweight `CollisionEvent` (two body meshes, impact point, chunk list with velocity vectors, parent ECI position) that Index passes to the renderer.

## Visual break-apart

- `Globe.tsx` gains a `CollisionScene` overlay shown for ~2.5 s at cascade start, anchored at the parent's propagated ECI position:
  - the steel cube closes on the target along `v_rel`,
  - an impact flash,
  - both bodies split into ~12–20 low-poly steel chunks that fly outward along the **same velocity vectors** (scaled up for visibility), fading as the persistent point-cloud takes over.
- Driven by framer-motion / `useFrame` clock; auto-clears so it never blocks interaction.

## Files

- `src/lib/collision.ts` — new: shapes, `simulateImpact`, ejection-field math, `CollisionEvent` type.
- `src/lib/orbital.ts` — `spawnFragments` uses the collision field for directions.
- `src/components/Globe.tsx` — add `CollisionScene` overlay.
- `src/pages/Index.tsx` — capture the `CollisionEvent` from the cascade and pass it to `Globe`; clear it after the animation.

## Validation

Re-run the headless cascade sim to confirm fragments still form a physically correct torus and decay over time, and visually confirm the break-apart plays at the impact site and matches fragment directions.
