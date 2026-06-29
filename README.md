# Power Input per Unit Volume (P/V) Calculator

A web-based tool for assessing the **shear-proof design space** of a stirred-tank
bioreactor (STBR) used for mammalian cell culture. Enter a vessel's geometry,
fluid properties, impeller, and sparger configuration; the tool computes power
input per unit volume (P/V) and the full set of shear-related engineering
parameters, and flags each against its cell-culture safety limit.

It also includes a **scale-up solver**: given a reference vessel, it finds the
target impeller speed that holds P/V (or tip speed) constant at a new scale and
re-checks every constraint there.

Built with **Bun + TypeScript + React**. The calculation engine is pure and
fully unit-tested; the UI is a thin layer over it.

**Live app:** https://JTROH.github.io/bioreactor-pv-calculator/ (auto-deployed
from `main` to GitHub Pages).

---

## Quick start

```bash
bun install        # install dependencies
bun run dev        # start with hot reload at http://localhost:3000
bun run build      # produce a static bundle in dist/ (deployed to Pages)
bun test           # run the test suite
bun run typecheck  # tsc --noEmit
```

`bun run start` runs without hot reload. Set `PORT` to change the port.

---

## Features

- **Single Vessel** — enter one operating point; see P/V, impeller Reynolds, tip
  speed, localized impeller-zone EDR, microeddy length, and the gas-side metrics
  (VVM, gas-entrance velocity, orifice Reynolds, bubble-wake eddy length), each
  with a pass / fail / advisory / needs-input badge and an overall
  "inside / outside the shear-proof window" summary.
- **Scaling** — solve the target impeller speed that holds **P/V** or **tip
  speed** constant from a reference vessel to a target geometry (scale-up *or*
  scale-down), then re-evaluate all constraints at the new scale (with warnings
  for anything that becomes binding, or for an invalid scaling regime).
- **Design Space** — a 2-D feasibility map of impeller speed (N) vs. working
  volume (V), shading where all shear constraints are simultaneously satisfied,
  with the current operating point marked. Requires `Np`.
- **Oxygen (kLa/OTR)** — estimates the volumetric mass-transfer coefficient
  `kLa = A·(P/V)^α·(vs)^β` (tying into the tool's P/V), then checks oxygen supply
  (OTR_max = kLa·C\*·(1−DO)) against cell demand (OUR = qO₂·X), reporting the
  margin and the maximum sustainable cell density. Correlation constants are
  user inputs with Van't Riet (1979) presets (coalescing / non-coalescing).
- **Presets &amp; sharing** — save the full configuration (all tabs) to the
  browser, export/import it as a JSON file, or copy a shareable link that
  reopens the tool with the exact same inputs (state is encoded in the URL).
- **SI ↔ Practical units** — toggle between SI (m, rev/s, m³, Pa·s) and bench
  units (mm, rpm, L, cP). All populated fields convert live; the engine always
  computes in SI.

---

## Constraint reference

The shear-proof window is the intersection of all of these (source: guidance PDF
§4 — *BioProcess International*, Muralidharan 2023). A valid operating point
satisfies every row.

| Quantity | Formula (SI) | Limit |
|----------|--------------|-------|
| Power per volume (P/V) | `Np·ρ·N³·D⁵ / V` | typical 10–150 W/m³ (caution to 250, alert above) |
| Impeller-zone power density | `(f·P)/V_zone`, `f≈0.705` | ≤ 1×10⁵ W/m³ |
| Impeller Reynolds | `ρ·N·D²/μ` | > 10,000 (validity gate for P/V) |
| Tip speed | `π·N·D` | < 1.5 m/s |
| Microeddy length | `(ν³/ε)^¼`, `ν=μ/ρ` | > 20 µm |
| Gas-entrance velocity | `Q/(n·A_hole)` | < 30 m/s |
| Orifice Reynolds | `ρ_gas·v_gas·d/μ_gas` | < 2,000 (avoid jetting) |
| Bubble-wake eddy length | Kolmogorov on wake EDR | > 20 µm |
| Gas rate (VVM) | `(Q/V)·60` | reported (advisory) |

### Power number (Np)

`Np` is **always a required user input**. It is bioreactor/impeller specific —
determined empirically or supplied by the vendor for a given geometry. The tool
never defaults or infers it. Tip speed and impeller Reynolds are independent of
`Np`, so they (and the tip-speed alert) are computed even before `Np` is entered.

### Window logic

- **Outside** — any constraint is violated.
- **Indeterminate** — a *required* input is missing (e.g. `Np`), so a core
  constraint (P/V, microeddy length) cannot be evaluated.
- **Inside** — all evaluable constraints pass. Missing *optional* inputs
  (`V_zone`, bubble-wake EDR) do not block this; those checks are listed as
  "skipped".

---

## Project structure

```
src/engine/        Pure SI calculation engine (no DOM/React)
  units.ts           unit registry + SI↔display conversions
  impeller.ts        P, P/V, Reynolds, tip speed, zone EDR, Kolmogorov
  gas.ts             VVM, gas velocity, orifice Reynolds, wake eddy
  constraints.ts     full operating-point evaluation + window verdict
  scaleup.ts         P/V & tip-speed scale-up solvers + re-evaluation
  types.ts           domain types
src/ui/            React frontend (Bun HTML import)
  model.ts           form ↔ engine bridge (parse, convert, assemble)
  components/        VesselForm, ResultsPanel, ScaleUpPanel, NumberField, ConstraintBadge
index.ts           Bun.serve() entry
tests/             bun test suites (engine + model)
Shear-Proof_Design_Space_Guidance.pdf   reference document
build_guidance_pdf.py                    regenerates the guidance PDF
```

---

## Caveats

This tool draws on two sources: the BioProcess International "shear-proof design
space" article and the textbook chapter *Industrial Cell Culture Process Scale-up
Strategies and Considerations* (Hu & Wiltberger). Core formulas were cross-checked
against the latter; the **P/V band (10–150 typical / 250 cap)**, the kLa cell-culture
preset, and typical Np values come from it. Some thresholds (tip speed, gas-entrance
velocity, orifice Reynolds, the 20 µm eddy floor) come from the shear-proof article. Some **equation forms** are reconstructed from standard
stirred-tank correlations because the source presents them as figures — these
are noted in the guidance PDF. The bubble-wake EDR is taken as an explicit input
rather than derived (the source does not fully specify it). Validate coefficients
and thresholds against primary literature and your own process data before use in
GMP or design-of-experiment work.
