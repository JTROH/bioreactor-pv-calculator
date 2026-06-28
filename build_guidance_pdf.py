#!/usr/bin/env python3
"""Generate the Shear-Proof Design Space guidance PDF for the P/V calculation tool."""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)

OUT = "Shear-Proof_Design_Space_Guidance.pdf"

# ---------------------------------------------------------------- styles
styles = getSampleStyleSheet()
PRIMARY = colors.HexColor("#1B5E7E")
ACCENT = colors.HexColor("#2E7D32")
LIGHT = colors.HexColor("#EAF2F5")
GREY = colors.HexColor("#555555")

styles.add(ParagraphStyle(
    "DocTitle", parent=styles["Title"], fontSize=22, leading=26,
    textColor=PRIMARY, spaceAfter=6))
styles.add(ParagraphStyle(
    "SubTitle", parent=styles["Normal"], fontSize=11, leading=15,
    textColor=GREY, alignment=TA_CENTER, spaceAfter=4))
styles.add(ParagraphStyle(
    "H1", parent=styles["Heading1"], fontSize=15, leading=19,
    textColor=PRIMARY, spaceBefore=16, spaceAfter=6))
styles.add(ParagraphStyle(
    "H2", parent=styles["Heading2"], fontSize=12.5, leading=16,
    textColor=ACCENT, spaceBefore=10, spaceAfter=4))
styles.add(ParagraphStyle(
    "Body", parent=styles["Normal"], fontSize=10, leading=15,
    alignment=TA_JUSTIFY, spaceAfter=6))
styles.add(ParagraphStyle(
    "Blt", parent=styles["Body"], leftIndent=16, bulletIndent=4, spaceAfter=3))
styles.add(ParagraphStyle(
    "EqStyle", parent=styles["Body"], fontName="Helvetica-Bold",
    backColor=LIGHT, borderPadding=6, leftIndent=4, rightIndent=4,
    spaceBefore=4, spaceAfter=6, alignment=TA_CENTER, fontSize=10.5))
styles.add(ParagraphStyle(
    "Note", parent=styles["Body"], fontSize=8.5, textColor=GREY, leading=12))
styles.add(ParagraphStyle(
    "Cell", parent=styles["Normal"], fontSize=9, leading=12))
styles.add(ParagraphStyle(
    "CellH", parent=styles["Normal"], fontSize=9, leading=12,
    textColor=colors.white, fontName="Helvetica-Bold"))

story = []


def P(text, style="Body"):
    story.append(Paragraph(text, styles[style]))


def bullets(items, style="Blt"):
    for it in items:
        story.append(Paragraph(it, styles[style], bulletText="•"))


def eq(text):
    story.append(Paragraph(text, styles["EqStyle"]))


def rule():
    story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#CCCCCC"),
                            spaceBefore=8, spaceAfter=8))


def make_table(data, col_widths, header=True):
    tbl = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
    ts = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#BBBBBB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
    ]
    if header:
        ts += [("BACKGROUND", (0, 0), (-1, 0), PRIMARY)]
    tbl.setStyle(TableStyle(ts))
    story.append(tbl)


# ================================================================ COVER
P("Shear-Proof Design Space", "DocTitle")
P("Scaling Stirred-Tank Bioreactors for Cell Culture Processes", "SubTitle")
P("Engineering Guidance for a Power-Input-per-Unit-Volume (P/V) Calculation Tool", "SubTitle")
story.append(Spacer(1, 10))
rule()
P("<b>Source article:</b> Muralidharan, N. \"Shear-Proof Design Space: Scaling "
  "Stirred-Tank Bioreactors for Cell Culture Processes.\" "
  "<i>BioProcess International</i>, 9 February 2023.", "Note")
P("<b>Compiled:</b> 27 June 2026 &nbsp;|&nbsp; Purpose: reference basis for a web-based "
  "P/V calculation tool. Equation forms below are reconstructed from standard "
  "stirred-tank engineering relationships; the source presents several equations as "
  "figures, so verify numerical coefficients against the original before production use.", "Note")
rule()

# ================================================================ 1. OVERVIEW
P("1. Purpose &amp; Scaling Philosophy", "H1")
P("Scaling a stirred-tank bioreactor (STBR) for mammalian cell culture means holding "
  "<b>scale-independent</b> parameters constant &mdash; pH, temperature, and dissolved "
  "oxygen (DO) &mdash; while adjusting the <b>nonlinear, scale-dependent</b> variables, "
  "principally impeller agitation and gas-flow rate. The central engineering challenge is "
  "to deliver enough mixing and oxygen transfer to satisfy cell demand while keeping "
  "hydrodynamic and bubble-burst <b>shear</b> below cell-damaging thresholds.")
P("Kinetic energy supplied by the rotating impeller and by sparged gas is ultimately "
  "dissipated as heat. The local <b>energy dissipation rate (EDR)</b> drives shear, so a "
  "robust &ldquo;shear-proof&rdquo; design space is defined by a set of normalized "
  "engineering parameters that each remain inside a safe window across scales and "
  "geometries.")

P("Key takeaway", "H2")
bullets([
    "<b>P/V</b> (power per unit volume) and <b>VVM</b> (gas volume per liquid volume per "
    "minute) are the two most widely used scale-up criteria &mdash; but neither captures "
    "<i>localized</i> shear heterogeneity inside the vessel.",
    "A complete design space must additionally constrain impeller-zone EDR, tip speed, "
    "Kolmogorov microeddy length, gas-entrance velocity, and orifice Reynolds number.",
])

# ================================================================ 2. IMPELLER PARAMS
P("2. Impeller-Side Parameters", "H1")

P("2.1 Power per Unit Volume (P/V)", "H2")
P("The primary scale-up criterion. Impeller power draw is normalized by liquid volume so "
  "that agitation intensity is comparable across vessel sizes.")
eq("P = N<sub>p</sub> &#183; &#961; &#183; N<super>3</super> &#183; D<super>5</super>"
   "&nbsp;&nbsp;&#8658;&nbsp;&nbsp; P/V = (N<sub>p</sub> &#183; &#961; &#183; "
   "N<super>3</super> &#183; D<super>5</super>) / V")
make_table([
    [Paragraph("Symbol", styles["CellH"]), Paragraph("Meaning", styles["CellH"]),
     Paragraph("Units", styles["CellH"])],
    [Paragraph("P", styles["Cell"]), Paragraph("Impeller power input", styles["Cell"]), Paragraph("W", styles["Cell"])],
    [Paragraph("N<sub>p</sub>", styles["Cell"]), Paragraph("Power number (dimensionless; specific to each impeller design)", styles["Cell"]), Paragraph("&ndash;", styles["Cell"])],
    [Paragraph("&#961;", styles["Cell"]), Paragraph("Liquid density", styles["Cell"]), Paragraph("kg/m<super>3</super>", styles["Cell"])],
    [Paragraph("N", styles["Cell"]), Paragraph("Impeller rotational speed", styles["Cell"]), Paragraph("rev/s (s<super>-1</super>)", styles["Cell"])],
    [Paragraph("D", styles["Cell"]), Paragraph("Impeller diameter", styles["Cell"]), Paragraph("m", styles["Cell"])],
    [Paragraph("V", styles["Cell"]), Paragraph("Liquid working volume", styles["Cell"]), Paragraph("m<super>3</super>", styles["Cell"])],
], [1.0*inch, 3.7*inch, 1.3*inch])
story.append(Spacer(1, 4))
P("<b>Constraint:</b> keep average P/V at or below ~<b>50 W/m<super>3</super></b> to avoid "
  "deleterious effects on the cells. <b>Validity condition:</b> the impeller Reynolds "
  "number must exceed 10,000 (fully turbulent) for N<sub>p</sub> to be independent of "
  "speed &mdash; a prerequisite for using P/V as a scale-up strategy.", "Body")

P("2.2 Impeller Reynolds Number (N<sub>Re</sub>)", "H2")
P("Ratio of inertial (impeller drag) to viscous forces; confirms the turbulent regime in "
  "which P/V scaling is valid.")
eq("N<sub>Re</sub> = (&#961; &#183; N &#183; D<super>2</super>) / &#956;")
P("&#956; = dynamic viscosity (Pa&#183;s). <b>Constraint:</b> N<sub>Re</sub> &gt; "
  "<b>10,000</b> &#8658; fully turbulent regime.", "Body")

P("2.3 Impeller-Zone Energy Dissipation Rate (&#949;<sub>Imp,Zone</sub>)", "H2")
P("Average P/V hides the fact that power is not dissipated uniformly. For a pitched-blade "
  "impeller, roughly <b>70.5%</b> of total power is dissipated in the liquid volume "
  "immediately swept by the impeller. The localized (impeller-zone) EDR is therefore the "
  "more conservative shear metric.")
eq("&#949;<sub>Imp,Zone</sub> = (fraction &#183; P) / (&#961; &#183; "
   "V<sub>Imp,Zone</sub>)&nbsp;&nbsp;[m<super>2</super>/s<super>3</super>]")
P("<b>Constraint:</b> studies report no lethal effects up to a maximum local energy input "
  "as high as <b>1 &#215; 10<super>5</super> W/m<super>3</super></b> (when shear-protecting "
  "surfactant is present). Treat this as an extreme upper bound, not a routine setpoint.", "Body")

P("2.4 Impeller Tip Speed (v<sub>tip</sub>)", "H2")
P("The highest fluid velocity occurs at the blade tip; tip speed is a simple, "
  "geometry-aware shear surrogate.")
eq("v<sub>tip</sub> = &#960; &#183; N &#183; D&nbsp;&nbsp;[m/s]")
P("<b>Constraint:</b> v<sub>tip</sub> &lt; <b>1.5 m/s</b> to prevent adverse effects on "
  "cell growth.", "Body")

P("2.5 Shear Rate at the Blade Tip", "H2")
P("Estimated using a drag-coefficient (C<sub>d</sub>) formulation that depends on impeller "
  "flow type.")
make_table([
    [Paragraph("Impeller type", styles["CellH"]), Paragraph("Drag coefficient C<sub>d</sub>", styles["CellH"])],
    [Paragraph("General range", styles["Cell"]), Paragraph("0.004 &ndash; 0.010", styles["Cell"])],
    [Paragraph("Axial-flow impeller", styles["Cell"]), Paragraph("0.007", styles["Cell"])],
    [Paragraph("Radial-flow impeller (max)", styles["Cell"]), Paragraph("0.0095", styles["Cell"])],
], [3.0*inch, 3.0*inch])

P("2.6 Kolmogorov (Microeddy) Length (&#955;)", "H2")
P("Turbulence cascades energy down to ever-smaller eddies. Eddies of a size comparable to "
  "or smaller than a cell can damage it. Most mammalian cells are &lt;20 &#956;m.")
eq("&#955; = (&#957;<super>3</super> / &#949;)<super>1/4</super>&nbsp;&nbsp;[m]")
P("&#957; = kinematic viscosity (m<super>2</super>/s); &#949; = local energy dissipation "
  "rate (m<super>2</super>/s<super>3</super>). <b>Constraint:</b> keep &#955; &gt; "
  "<b>20 &#956;m</b> for mammalian cells.", "Body")

story.append(PageBreak())

# ================================================================ 3. GAS PARAMS
P("3. Gas-Sparging Parameters", "H1")
P("Most cell death in bioreactors is caused by shear generated when bubbles <b>burst</b> "
  "at the liquid surface &mdash; not by the impeller. Sparging parameters therefore need "
  "their own constraints.")

P("3.1 Gas Volumetric Rate (VVM)", "H2")
P("Volume of gas per unit volume of liquid per minute &mdash; the second most common "
  "scale-up criterion alongside P/V. Like P/V, it does not account for localized shear.", "Body")
eq("VVM = Q<sub>gas</sub> / V<sub>liquid</sub>&nbsp;&nbsp;[min<super>-1</super>]")

P("3.2 Gas-Entrance (Sparger-Hole) Velocity", "H2")
P("Velocity of gas leaving each sparger orifice.")
eq("v<sub>gas</sub> = Q<sub>gas</sub> / (n<sub>holes</sub> &#183; A<sub>hole</sub>)"
   "&nbsp;&nbsp;[m/s]")
P("<b>Constraint:</b> v<sub>gas</sub> &lt; <b>30 m/s</b>; above this, cell viability and "
  "productivity decline.", "Body")

P("3.3 Orifice Reynolds Number", "H2")
P("Characterizes the bubble-formation regime at the sparger hole.")
eq("N<sub>Re,orifice</sub> = (&#961;<sub>gas</sub> &#183; v<sub>gas</sub> &#183; "
   "d<sub>hole</sub>) / &#956;<sub>gas</sub>")
P("Four regimes occur as flow increases: <b>discrete bubble &#8594; chain bubble &#8594; "
  "jetting &#8594; turbulent</b>. Near ~2,000 the system approaches the jetting regime, "
  "where bubbles are poorly dispersed by the impeller. <b>Constraint:</b> keep "
  "N<sub>Re,orifice</sub> &lt; <b>2,000</b>.", "Body")

P("3.4 Bubble-Wake Eddy Length", "H2")
P("EDR in the wake behind a rising bubble produces microeddies; as with impeller eddies, "
  "keep them &gt; <b>20 &#956;m</b> to avoid harming cell growth.", "Body")

P("3.5 Bubble-Bursting Stress &amp; Cell Death", "H2")
P("Cell-death rate scales with the number of cells attached to the bubble-film volume per "
  "bioreactor volume. Surfactants (e.g., Pluronic) reduce cell&ndash;bubble attachment.")
make_table([
    [Paragraph("Parameter", styles["CellH"]), Paragraph("Typical value", styles["CellH"])],
    [Paragraph("Pluronic concentration", styles["Cell"]), Paragraph("1 g/L", styles["Cell"])],
    [Paragraph("Bubble film thickness (&#948;)", styles["Cell"]), Paragraph("50 &#956;m", styles["Cell"])],
    [Paragraph("Film-to-cell attachment factor (&#949;)", styles["Cell"]), Paragraph("0.4 per 10<super>6</super> cells/mL", styles["Cell"])],
], [3.4*inch, 2.6*inch])
story.append(Spacer(1, 4))
P("<b>Sparger choice:</b> cells tolerate shear from drilled-hole or open-pipe spargers "
  "better than from microspargers (which create many small, high-curvature bubbles).", "Note")

# ================================================================ 4. SUMMARY TABLE
P("4. Design-Space Constraint Summary", "H1")
P("The shear-proof operating window is the intersection of all of the following. A valid "
  "operating point must satisfy <i>every</i> row simultaneously.")
make_table([
    [Paragraph("Parameter", styles["CellH"]), Paragraph("Method / basis", styles["CellH"]),
     Paragraph("Unit", styles["CellH"]), Paragraph("Constraint", styles["CellH"])],
    [Paragraph("Average impeller EDR", styles["Cell"]), Paragraph("P/V", styles["Cell"]), Paragraph("W/m<super>3</super>", styles["Cell"]), Paragraph("&#8804; 50", styles["Cell"])],
    [Paragraph("Localized impeller EDR", styles["Cell"]), Paragraph("Impeller-zone calc.", styles["Cell"]), Paragraph("W/m<super>3</super>", styles["Cell"]), Paragraph("&#8804; 1&#215;10<super>5</super>", styles["Cell"])],
    [Paragraph("Impeller Reynolds no.", styles["Cell"]), Paragraph("N<sub>Re</sub>", styles["Cell"]), Paragraph("&ndash;", styles["Cell"]), Paragraph("&gt; 10,000", styles["Cell"])],
    [Paragraph("Tip speed", styles["Cell"]), Paragraph("&#960;ND", styles["Cell"]), Paragraph("m/s", styles["Cell"]), Paragraph("&lt; 1.5", styles["Cell"])],
    [Paragraph("Microeddy length", styles["Cell"]), Paragraph("Kolmogorov", styles["Cell"]), Paragraph("&#956;m", styles["Cell"]), Paragraph("&gt; 20", styles["Cell"])],
    [Paragraph("Gas-entrance velocity", styles["Cell"]), Paragraph("Flow / orifice area", styles["Cell"]), Paragraph("m/s", styles["Cell"]), Paragraph("&lt; 30", styles["Cell"])],
    [Paragraph("Orifice Reynolds no.", styles["Cell"]), Paragraph("Gas-velocity based", styles["Cell"]), Paragraph("&ndash;", styles["Cell"]), Paragraph("&lt; 2,000", styles["Cell"])],
    [Paragraph("Bubble-wake eddy length", styles["Cell"]), Paragraph("Wake EDR", styles["Cell"]), Paragraph("&#956;m", styles["Cell"]), Paragraph("&gt; 20", styles["Cell"])],
], [1.55*inch, 1.7*inch, 0.8*inch, 1.35*inch])

# ================================================================ 5. IMPLICATIONS
P("5. Implications for the P/V Calculation Tool", "H1")
P("The article points to a tool that does more than compute a single P/V number. "
  "Recommended capabilities:")
bullets([
    "<b>Inputs:</b> impeller geometry (type, diameter D, power number N<sub>p</sub>), "
    "speed N, liquid density &#961; and viscosity &#956;, working volume V, sparger "
    "geometry (hole count, hole diameter), and gas flow Q<sub>gas</sub>.",
    "<b>Core output:</b> P and P/V, with a pass/fail flag against the 50 W/m<super>3</super> "
    "guideline.",
    "<b>Validity check:</b> automatically compute N<sub>Re</sub> and warn the user if "
    "&#8804; 10,000 (P/V scaling not valid).",
    "<b>Localized shear:</b> report impeller-zone EDR (using the ~70.5% power fraction for "
    "pitched-blade designs) against the 1&#215;10<super>5</super> W/m<super>3</super> bound.",
    "<b>Derived metrics:</b> tip speed, Kolmogorov microeddy length, gas-entrance velocity, "
    "and orifice Reynolds number, each with its own pass/fail indicator.",
    "<b>Scale-up mode:</b> given a reference vessel, solve for the agitation speed at a new "
    "scale that holds P/V (or tip speed) constant, then re-check all constraints.",
    "<b>Design-space view:</b> visualize the feasible window where every constraint is "
    "simultaneously satisfied.",
])

P("6. Conclusions from the Source", "H1")
bullets([
    "P/V and VVM are the most widely used scale-up methods but ignore localized shear "
    "heterogeneity that is present at every scale.",
    "Multiple normalized engineering parameters are required to accommodate geometric and "
    "design differences among bioreactors.",
    "Operating conditions must simultaneously satisfy oxygen-transfer demand (cell "
    "respiration) and CO<sub>2</sub>-transfer demand (efficient pH control).",
    "A successful design space assesses both impeller and gas-sparging shear contributions "
    "&mdash; especially localized impeller shear for pitched-blade STBRs.",
])

rule()
P("Disclaimer: This guidance summarizes a single trade publication for engineering "
  "reference. Equation coefficients and thresholds should be validated against primary "
  "literature and your own process data before use in GMP or design-of-experiment work.", "Note")


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(GREY)
    canvas.drawString(0.75*inch, 0.5*inch,
                      "Shear-Proof Design Space — P/V Tool Guidance")
    canvas.drawRightString(7.75*inch, 0.5*inch, "Page %d" % doc.page)
    canvas.restoreState()


doc = SimpleDocTemplate(
    OUT, pagesize=letter,
    leftMargin=0.75*inch, rightMargin=0.75*inch,
    topMargin=0.7*inch, bottomMargin=0.7*inch,
    title="Shear-Proof Design Space - P/V Tool Guidance",
    author="Compiled from BioProcess International (Muralidharan, 2023)")
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("WROTE", OUT)
