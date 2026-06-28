# Power Input per Unit Volume (P/V) Calculation Tool — Project Plan

**Project:** Web-based P/V & shear-constraint calculator for stirred-tank bioreactors (cell culture)
**Reference basis:** [Shear-Proof_Design_Space_Guidance.pdf](Shear-Proof_Design_Space_Guidance.pdf) (from Muralidharan, *BioProcess International*, 2023)
**Stack:** Bun + TypeScript + React (HTML imports via `Bun.serve()`), per repo `CLAUDE.md`
**Date:** 2026-06-27

---

## 1. Goals & Scope

A browser tool that, for a stirred-tank bioreactor (STBR), computes power input per unit volume (P/V) and the full set of shear-related engineering parameters, and flags each against its cell-culture safety constraint.

**In scope (confirmed):**
1. **Single-vessel check** — enter one vessel's geometry/fluid/sparger inputs → compute every metric with pass/fail badges.
2. **Scale-up solver** — given a reference vessel, solve operating conditions at a target scale holding a chosen criterion constant (P/V or tip speed), then re-validate all constraints.
3. **Gas/sparging side** — VVM, gas-entrance velocity, orifice Reynolds number, bubble-wake eddy length, bubble-burst notes — alongside the impeller side.
4. **Units:** SI ↔ practical (RPM/L) **toggle**; engine computes in SI internally.

**Out of scope (deferred / optional later):**
- Full design-space contour plotting (feasible-window visualization) — keep a hook for it, build later.
- kLa / OTR / CO₂-stripping modeling — the article mentions these as constraints but gives no equations; out of v1.
- Persistence, accounts, multi-vessel libraries.

---

## 2. Engineering Specification (the calculation core)

All formulas, variables, and thresholds are taken from the guidance PDF §2–§4. Engine works in **SI**; UI converts.

### 2.1 Impeller side

| # | Quantity | Formula (SI) | Output unit | Constraint |
|---|----------|--------------|-------------|------------|
| 1 | Power input `P` | `P = Np · ρ · N³ · D⁵` | W | — (`Np` is a **required user input**, see note) |
| 2 | Power per volume `P/V` | `P / V` | W/m³ | ≤ 50 (warn), with note on 1×10⁵ local bound |
| 3 | Impeller Reynolds `N_Re` | `ρ · N · D² / μ` | – | > 10,000 (validity gate for P/V scaling) |
| 4 | Impeller-zone EDR `ε_zone` | `(f · P) / (ρ · V_zone)`, `f≈0.705` pitched-blade | m²/s³ (×ρ → W/m³) | local ≤ 1×10⁵ W/m³ |
| 5 | Tip speed `v_tip` | `π · N · D` | m/s | **< 1.5 — alert if exceeded** (independent of `Np`) |
| 6 | Blade-tip shear (drag form) | uses `Cd` (0.004–0.010; axial 0.007, radial max 0.0095) | 1/s | reported (advisory) |
| 7 | Kolmogorov length `λ` | `(ν³ / ε)^(1/4)`, `ν = μ/ρ` | µm | > 20 |

Notes:
- **`Np` (power number) is a required end-user input — never inferred or defaulted.** It is bioreactor-specific, determined empirically or supplied by the bioreactor vendor for a given impeller/vessel geometry. The form must make it a mandatory field (no calculation possible without it) with helper text explaining its source. No built-in lookup table will substitute for the user's value; at most, vendor-typical ranges may be shown as *non-binding guidance text* only.
- `N` is in **rev/s** inside the engine (UI accepts RPM and converts: rev/s = RPM/60).
- `ε` used in `λ` is the relevant local EDR (impeller-zone by default; expose choice).
- `V_zone` (impeller swept volume) needs a model — v1: user-supplied or estimated from D and blade width; document the assumption clearly.

### 2.2 Gas / sparging side

| # | Quantity | Formula (SI) | Output unit | Constraint |
|---|----------|--------------|-------------|------------|
| 8 | VVM | `Q_gas / V_liquid` | 1/min | reported |
| 9 | Gas-entrance velocity `v_gas` | `Q_gas / (n_holes · A_hole)` | m/s | < 30 |
| 10 | Orifice Reynolds | `ρ_gas · v_gas · d_hole / μ_gas` | – | < 2,000 (avoid jetting) |
| 11 | Bubble-wake eddy length | Kolmogorov form on wake EDR | µm | > 20 |
| 12 | Bubble-burst notes | qualitative (Pluronic 1 g/L, δ=50 µm, ε=0.4/10⁶ cells/mL; prefer drilled/open-pipe over microsparger) | — | advisory |

### 2.3 Scale-up solver logic

Inputs: a **reference** vessel (fully specified) + a **target** vessel geometry (D₂, V₂) + a **criterion** to hold constant.

- **Hold P/V constant:** solve N₂ from `Np·ρ·N₂³·D₂⁵ / V₂ = (P/V)_ref`.
- **Hold tip speed constant:** `N₂ = v_tip,ref / (π·D₂)`.
- After solving N₂, recompute the *entire* constraint set for the target and report which constraints become binding/violated at scale.
- Guard: refuse/flag if reference `N_Re ≤ 10,000` (P/V scaling invalid).

---

## 3. Architecture & File Layout

```
Power-Input-Calculation-Sheet/
├── PROJECT_PLAN.md                  # this file
├── Shear-Proof_Design_Space_Guidance.pdf
├── build_guidance_pdf.py            # PDF generator (reference doc)
├── package.json
├── tsconfig.json
├── src/
│   ├── engine/
│   │   ├── units.ts                 # SI ↔ practical conversions, unit registry
│   │   ├── impeller.ts              # P, P/V, N_Re, tip speed, EDR, Kolmogorov, shear
│   │   ├── gas.ts                   # VVM, gas velocity, orifice Re, wake eddy
│   │   ├── constraints.ts           # thresholds + pass/fail evaluation
│   │   ├── scaleup.ts               # solver (hold P/V or tip speed)
│   │   └── types.ts                 # VesselInputs, Results, ConstraintResult
│   └── ui/
│       ├── index.html               # entry (Bun HTML import)
│       ├── frontend.tsx             # React root
│       ├── components/
│       │   ├── VesselForm.tsx       # inputs + unit toggle
│       │   ├── ResultsPanel.tsx     # metrics + green/red badges
│       │   ├── ScaleUpPanel.tsx     # reference→target solver UI
│       │   └── ConstraintBadge.tsx
│       └── styles.css               # Tailwind
├── index.ts                         # Bun.serve() — serves index.html + (optional) /api
└── tests/
    ├── impeller.test.ts
    ├── gas.test.ts
    ├── constraints.test.ts
    └── scaleup.test.ts
```

**Design principle:** the `engine/` directory is pure, framework-free, fully unit-tested TypeScript with no DOM/React imports. The UI is a thin layer that calls the engine (no calculation logic in components). This makes the numbers verifiable in isolation via `bun test`.

---

## 4. UI / UX Design

- **Two tabs:** *Single Vessel* and *Scale-Up*.
- **Global unit toggle** (SI ↔ Practical) in the header; re-renders all fields and results.
- **VesselForm:** grouped inputs — Geometry (D, V, V_zone), Fluid (ρ, μ), Impeller (Np, N, type→Cd default), Gas (Q_gas, n_holes, d_hole, ρ_gas, μ_gas). Sensible cell-culture defaults pre-filled.
- **ResultsPanel:** one row per metric → value + unit + **badge** (✓ green within limit / ✗ red violated / – advisory). A top-line summary: "Operating point is INSIDE / OUTSIDE the shear-proof window," naming the binding constraint.
  - **Tip speed** is always shown as an output and carries an explicit **alert when v_tip ≥ 1.5 m/s** (red badge + message). Because it depends only on `N` and `D` (not `Np`), this alert is live even before a power number is entered.
- **ScaleUpPanel:** reference summary on the left, target inputs + chosen criterion in the middle, solved N₂ and re-validated constraint set on the right.
- Live recompute on input change (engine is cheap; no backend round-trip needed — can run entirely client-side).

---

## 5. Milestones

| # | Milestone | Deliverable | Verify by |
|---|-----------|-------------|-----------|
| M0 | ✅ Guidance PDF | Reference document | Done |
| M1 | ✅ Project scaffold | `package.json`, `tsconfig`, dirs, `Bun.serve()` "hello" | Done — server serves bundled React page; `/api/health` OK; typecheck clean |
| M2 | ✅ Units module | `units.ts` + conversions | Done — 28 tests pass; round-trips, dimension safety, quantity presets; typecheck clean |
| M3 | ✅ Impeller engine | `impeller.ts` + tests | Done — 23 impeller tests (51 total) pass; hand-calc verified; typecheck clean |
| M4 | ✅ Gas engine | `gas.ts` + tests | Done — 16 gas tests (67 total) pass; hand-calc verified; typecheck clean |
| M5 | ✅ Constraints | `constraints.ts` evaluating all rows | Done — 16 constraint tests (83 total) pass; window verdict + Np-missing handling; typecheck clean |
| M6 | ✅ Scale-up solver | `scaleup.ts` (P/V & tip-speed modes) | Done — 15 scale-up tests (98 total) pass; closed-form solvers + re-evaluation; typecheck clean |
| M7 | ✅ UI — single vessel | Form + results + badges | Done — renders & computes in browser; reactivity, Np-required, badges verified; 7 model tests (107 total) |
| M8 | ✅ UI — scale-up + unit toggle | both tabs functional | Done — tabs + SI↔practical toggle + scale-up solver verified in browser; 5 scale-up model tests (114 total) |
| M9 | ✅ Polish + validation pass | defaults, edge-case handling, README | Done — README, .gitignore, in-app disclaimer footer; final 114 tests pass, typecheck clean, browser-verified |

**Suggested build order:** M1 → M2 → M3 → M4 → M5 → M6 (engine fully tested) → M7 → M8 → M9. Engine-first so every number is trusted before UI work.

---

## 6. Validation & Testing Strategy

- **Unit tests (`bun test`)** for every engine function, including:
  - Known worked examples (compute P, P/V for a standard impeller and check against hand calc).
  - Constraint boundary cases (just inside / just outside each threshold).
  - Scale-up round-trip: scale a reference, then scale back, recover original N.
  - Unit-conversion round-trips (RPM↔rev/s, L↔m³) lose no precision.
- **Numerical sanity:** a benchmark fixture with one realistic vessel whose expected outputs are committed, so regressions surface immediately.
- **Reminder in-app + in README:** equation coefficients are reconstructed from standard correlations; thresholds are from the trade article. Validate against primary literature / process data before GMP use.

---

## 7. Open Items to Resolve During Build

1. **Impeller swept volume `V_zone`** — choose an estimation model (e.g. annular swept region from D and blade width/height) vs. user-supplied. Affects local EDR and Kolmogorov. Document the chosen assumption.
2. **Blade-tip shear-rate exact form** — the article presents it as a figure; confirm the drag-coefficient correlation before treating its output as more than advisory.
3. **Default fluid properties** — pick representative cell-culture medium ρ, μ (≈ water) and gas (air) properties as defaults.
4. **Power number `Np`** — RESOLVED: always a required end-user input (bioreactor-specific, empirical or vendor-supplied). The tool will not calculate without it and will not default it. Optional non-binding guidance text only.

---

## 8. Next Action

On approval, begin at **M1 (scaffold)** and proceed engine-first through M6, writing `bun test` coverage as each module lands, before building the UI (M7–M8).
