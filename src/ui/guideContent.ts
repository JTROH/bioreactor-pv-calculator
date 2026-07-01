// Beginner-friendly explanations for the parameters in each tab, shown in the
// collapsible "Parameter guide" side panel. Sourced from the guidance PDF and
// the textbook chapter (Hu & Wiltberger). Kept concise and practical.

export interface GuideEntry {
  /** Parameter name / label. */
  term: string;
  /** Plain-English definition. */
  def: string;
  /** Typical values or range (optional). */
  typical?: string;
  /** How the user obtains the value (optional). */
  how?: string;
}

export interface GuideSection {
  /** Optional intro sentence shown at the top of the panel. */
  intro?: string;
  entries: GuideEntry[];
}

export const SINGLE_GUIDE: GuideSection = {
  intro:
    "What each input means, roughly what to expect, and where to get it. All of these describe your vessel and broth at one operating point.",
  entries: [
    {
      term: "Power number (Np)",
      def: "A dimensionless measure of how much power an impeller draws at a given speed. It depends on the impeller design and geometry — not on the fluid.",
      typical: "Rushton turbine ~5.0 · pitched-blade ~1.3 · elephant-ear ~1.7 · Lightnin A315 ~0.84 · axial high-efficiency ~0.3.",
      how: "From the bioreactor/impeller vendor, or measured experimentally (torque vs. speed). It is not calculated from first principles — so the tool requires it as an input.",
    },
    {
      term: "Impeller diameter (D)",
      def: "The diameter of the circle the impeller blades sweep.",
      typical: "Commonly 1/3 to 1/2 of the tank diameter.",
      how: "Vendor spec sheet, or measure directly.",
    },
    {
      term: "Impeller speed (N)",
      def: "How fast the impeller turns — your agitation setpoint.",
      typical: "Cell culture is gentle: often ~0.5–5 rev/s (30–300 rpm), lower at large scale.",
      how: "Read it from your bioreactor controller.",
    },
    {
      term: "Impeller swept volume (V_zone)",
      def: "The small pocket of liquid the blades sweep, where most of the power is dissipated. Used for the localized (impeller-zone) shear check.",
      how: "Enter it directly, or switch to “From blade width” and the tool computes V_zone = (π/4)·D²·w from the diameter and blade width. Optional.",
    },
    {
      term: "Working volume (V)",
      def: "The volume of liquid in the vessel during the run.",
      how: "Your fill volume.",
    },
    {
      term: "Liquid density (ρ)",
      def: "Mass per unit volume of the broth.",
      typical: "~1000 kg/m³ — cell-culture media is close to water.",
      how: "Use ~1000, or measure.",
    },
    {
      term: "Liquid viscosity (μ)",
      def: "The broth's resistance to flow.",
      typical: "~1 cP (0.001 Pa·s) — again, close to water.",
      how: "Use ~1 cP, or measure with a viscometer.",
    },
    {
      term: "Gas flow (Q)",
      def: "The sparge-gas flow rate into the vessel (enable the Gas / sparging section).",
      typical: "Often 0.001–0.1 vvm for cell culture.",
      how: "Your mass-flow-controller setpoint.",
    },
    {
      term: "Sparger holes (count & diameter)",
      def: "The number and size of holes in the sparger. Together with the gas flow they set the gas-entrance velocity and the bubble regime.",
      how: "Sparger vendor spec, or measure.",
    },
    {
      term: "Gas density / viscosity",
      def: "Properties of the sparge gas, used for the orifice-Reynolds check.",
      typical: "Air ≈ 1.2 kg/m³ and 1.8×10⁻⁵ Pa·s (0.018 cP).",
    },
    {
      term: "Bubble-wake EDR (ε_wake)",
      def: "Advanced/optional — the energy dissipation rate behind rising bubbles, for the bubble-wake eddy-length check.",
      how: "From CFD or literature; leave blank if unknown.",
    },
  ],
};

export const SCALING_GUIDE: GuideSection = {
  intro:
    "Scaling holds one quantity constant while moving to a different vessel size (up or down), then re-checks every shear limit at the new scale.",
  entries: [
    {
      term: "Criterion (what to hold constant)",
      def: "P/V (power per volume) is the most widely used scale-up basis for cell culture. Tip speed is an alternative that caps the fastest local velocity. Holding one generally changes the other — e.g. holding tip speed lowers P/V at larger scale.",
      how: "Pick the basis your process is developed around; P/V is the common default.",
    },
    {
      term: "Target diameter (D₂)",
      def: "The impeller diameter of the vessel you're scaling to.",
      how: "Target vessel / impeller spec.",
    },
    {
      term: "Target working volume (V₂)",
      def: "The liquid volume at the target scale (larger for scale-up, smaller for scale-down).",
    },
    {
      term: "Target swept volume (V_zone)",
      def: "Optional — the impeller swept volume at the target, to evaluate localized EDR there too.",
    },
    {
      term: "Target Np override",
      def: "Defaults to the reference Np, which is right when the same impeller design is used at both scales (Np is ~constant in the turbulent regime). Override only if the target uses a different impeller.",
    },
  ],
};

export const OXYGEN_GUIDE: GuideSection = {
  intro:
    "This estimates how fast oxygen transfers into the liquid (supply) and compares it to what the cells consume (demand). P/V comes from the Single Vessel tab.",
  entries: [
    {
      term: "kLa",
      def: "The volumetric oxygen mass-transfer coefficient — how quickly O₂ moves from bubbles into the liquid. Estimated here from kLa = A·(P/V)^α·(vs)^β.",
      typical: "Cell-culture bioreactors are often around ~10 h⁻¹.",
    },
    {
      term: "kLa constants A, α, β",
      def: "System-specific fitting constants for the correlation above. Presets are provided: Van't Riet (water: coalescing / non-coalescing) and a cell-culture set (Xing 2009).",
      how: "Best obtained by fitting your own dynamic “gassing-out” kLa measurements; the presets are starting points.",
    },
    {
      term: "Gas flow (Q) & tank diameter (D_tank)",
      def: "Set the superficial gas velocity, vs = Q / (π·D_tank²/4), which is the strongest driver of kLa in cell culture.",
      how: "Flow-controller setpoint and the tank inner diameter.",
    },
    {
      term: "Saturation O₂ (C*)",
      def: "The dissolved-oxygen concentration in equilibrium with the sparge gas — the ceiling for how much O₂ the liquid can hold.",
      typical: "~0.21 mmol/L (~7 mg/L) for air at ~37°C.",
      how: "From O₂-solubility tables, or the reading at 100% air saturation.",
    },
    {
      term: "DO setpoint",
      def: "The dissolved-oxygen level you control to, as a % of saturation. It sets the transfer driving force, C*·(1−DO).",
      typical: "Commonly 30–50%.",
      how: "Your process setpoint.",
    },
    {
      term: "Specific OUR (qO₂)",
      def: "Oxygen consumed per cell per unit time — the per-cell demand.",
      typical: "~0.05–0.5 mmol/(10⁹ cells·h), i.e. ~0.5–25 pmol/cell/day.",
      how: "Measure from a stationary-phase OUR test, or use a literature value for your cell line.",
    },
    {
      term: "Viable cell density (X)",
      def: "How many live cells per volume — total demand is qO₂ × X.",
      typical: "Peaks often 5–30 ×10⁶ cells/mL in fed-batch.",
      how: "From your cell counter.",
    },
  ],
};
