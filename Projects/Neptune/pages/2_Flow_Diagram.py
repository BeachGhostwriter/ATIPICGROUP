"""Page 2 – Flow Diagram: detailed Sankey with process-level flows and contaminant concentrations."""

import streamlit as st
import plotly.graph_objects as go
import pandas as pd
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

st.set_page_config(page_title="Flow Diagram | Neptune", layout="wide")

# Remove SVG text shadows
st.markdown("""
<style>
.js-plotly-plot text { text-shadow: none !important; filter: none !important; }
.plot-container text { text-shadow: none !important; }
</style>
""", unsafe_allow_html=True)

st.title("Water Flow Diagram")
st.markdown("Full process-level Sankey and concentration data for the Bremen Steel Works case study.")
st.divider()

if "initialized" not in st.session_state:
    st.warning("Please visit the **Home** page first.")
    st.stop()

processes   = st.session_state.processes
contaminants = st.session_state.contaminants
hours        = st.session_state.operating_hours
total_in     = st.session_state.total_inlet_flow

# ── Build Sankey node/link tables ─────────────────────────────────────────────
# Node list (fixed, covers Bremen topology)
NODE_LABELS = [
    "River / Raw Water",     # 0
    "Water Purification",    # 1
    "Desalination",          # 2
    "Sinter Plant",          # 3
    "Blast Furnace",         # 4
    "Process (General)",     # 5
    "Converter",             # 6
    "Casting",               # 7
    "HSM",                   # 8
    "CRM",                   # 9
    "Galva",                 # 10
    "Air Plant",             # 11
    "Hydrogen",              # 12
    "Detox",                 # 13
    "Filtration / Neutr.",   # 14
    "River Discharge",       # 15
    "Leakage / Evaporation", # 16
    "Recycled Water",        # 17
]
NODE_COLORS = [
    "#4a90d9","#27ae60","#8e44ad",
    "#e67e22","#e74c3c","#f39c12",
    "#c0392b","#d35400","#16a085",
    "#2980b9","#8e44ad","#27ae60",
    "#1abc9c","#e91e63","#607d8b",
    "#2196f3","#9e9e9e","#4caf50",
]

# Helper – get process flow_out safely
def fo(name): return processes.get(name, {}).get("flow_out", 0.0)
def fi(name): return processes.get(name, {}).get("flow_in", 0.0)
def lk(name): return max(processes.get(name, {}).get("leakage", 0.0), 0.0)

purif_in  = fi("Purification")
desal_in  = fi("Desalination")
sinter_in = fi("Sinter Plant")
bf_in     = fi("Blast Furnace")
conv_in   = fi("Converter")
cast_in   = fi("Casting")
hsm_in    = fi("HSM")
crm_in    = fi("CRM")
galva_in  = fi("Galva")
air_in    = fi("Air Plant")
h2_in     = fi("Hydrogen")
detox_in  = desal_in * 0.99   # desalination reject ~ 118.5
filt_in   = fi("Filtration")

# Leakage values
bf_lk     = lk("Blast Furnace")
conv_lk   = lk("Converter")
cast_lk   = lk("Casting")
hsm_lk    = lk("HSM")
h2_lk     = lk("Hydrogen")

total_leakage = sum(lk(n) for n in processes)
discharge = st.session_state.discharge_flow

links = [
    # River → treatment + direct uses
    (0,  1,  purif_in,            "River to Purification"),
    (0,  3,  sinter_in,           "Raw water to Sinter"),
    (0,  4,  bf_in - 201.0,       "Raw water to Blast Furnace"),
    (0,  5,  fi("Process"),       "Raw water to Process"),
    # Purification → downstream
    (1,  2,  desal_in,            "Purified to Desalination"),
    (1,  4,  201.0,               "Pure water to BF gas washing"),
    (1,  6,  fi("Converter")*0.91,"Purified to Converter"),
    (1,  7,  cast_in,             "Purified to Casting"),
    (1,  8,  hsm_in,              "Purified to HSM"),
    (1,  9,  crm_in,              "Purified to CRM"),
    (1, 10,  galva_in,            "Purified to Galva"),
    (1, 11,  air_in,              "Cooling to Air Plant"),
    (1, 12,  h2_in,               "Purified to Hydrogen"),
    # Desalination → cooling + reject
    (2,  4,  3.4,                 "Desalinated make-up to BF cooling"),
    (2,  8,  10.6,                "Desalinated to HSM cooling"),
    (2, 14,  detox_in,            "Desal. reject to Filtration"),
    # Process effluents → Filtration / Detox / Discharge
    (3, 14,  fo("Sinter Plant"),  "Sinter effluent"),
    (4, 14,  fo("Blast Furnace") * 0.50, "BF effluent to treatment"),
    (4, 15,  fo("Blast Furnace") * 0.50, "BF cooling once-through"),
    (5, 15,  fo("Process"),       "Process effluent"),
    (6, 14,  fo("Converter"),     "Converter effluent"),
    (7, 14,  fo("Casting"),       "Casting effluent"),
    (8, 14,  fo("HSM"),           "HSM effluent"),
    (9, 14,  fo("CRM"),           "CRM effluent"),
    (10,14,  fo("Galva"),         "Galva effluent"),
    (11,15,  fo("Air Plant"),     "Air plant cooling discharge"),
    (13,14,  36.0,                "Detox to Filtration"),
    # Filtration → river + recycled
    (14,15,  filt_in * 0.80,      "Treated to river"),
    (14,17,  filt_in * 0.20,      "Recycled from treatment"),
    # Leakage
    (4, 16,  bf_lk,               "BF leakage/evap"),
    (6, 16,  conv_lk,             "Converter leakage"),
    (7, 16,  cast_lk,             "Casting leakage"),
    (8, 16,  hsm_lk,              "HSM leakage"),
    (12,16,  h2_lk,               "Hydrogen losses"),
]

# Filter out zero or negative links
links = [(s, t, max(v, 0.01), label) for s, t, v, label in links if v > 0.01]

view_mode = st.radio("Flow units", ["m³/h", "m³/year"], horizontal=True)
mult = hours if view_mode == "m³/year" else 1.0
unit_label = "m³/yr" if view_mode == "m³/year" else "m³/h"

fig = go.Figure(go.Sankey(
    arrangement="snap",
    node=dict(
        label=NODE_LABELS,
        color=NODE_COLORS,
        pad=16,
        thickness=20,
        line=dict(color="white", width=1.0),
    ),
    link=dict(
        source=[l[0] for l in links],
        target=[l[1] for l in links],
        value =[l[2] * mult for l in links],
        label =[f"{l[3]}: {l[2]*mult:,.0f} {unit_label}" for l in links],
        color =["rgba(74,144,217,0.22)"] * len(links),
    ),
))
fig.update_layout(
    title=dict(
        text=f"Bremen Steel Works — Water Flow Diagram ({unit_label})",
        font=dict(family="Arial, sans-serif", size=16, color="#1a1a2e"),
    ),
    height=680,
    margin=dict(l=20, r=20, t=50, b=20),
    font=dict(family="Arial, sans-serif", size=14, color="#1a1a2e"),
    paper_bgcolor="white",
)
st.plotly_chart(fig, use_container_width=True)

st.caption(
    "Node width = total flow through that unit. Link width = stream volume. "
    "Hover over a link for the exact flow and description."
)
st.divider()

# ── Annual flow summary table ─────────────────────────────────────────────────
st.subheader("Process Water Balance – Summary Table")
bal_rows = []
for name, p in processes.items():
    bal_rows.append({
        "Process Unit":       name,
        "Flow In (m³/h)":     p["flow_in"],
        "Flow Out (m³/h)":    p["flow_out"],
        "Leakage / Evap.":    p["leakage"],
        "Annual Vol. (Mm³)":  round(p["flow_in"] * hours / 1e6, 2),
    })
bal_df = pd.DataFrame(bal_rows)
total_row = pd.DataFrame([{
    "Process Unit": "TOTAL",
    "Flow In (m³/h)": bal_df["Flow In (m³/h)"].sum(),
    "Flow Out (m³/h)": bal_df["Flow Out (m³/h)"].sum(),
    "Leakage / Evap.": bal_df["Leakage / Evap."].sum(),
    "Annual Vol. (Mm³)": bal_df["Annual Vol. (Mm³)"].sum(),
}])
bal_df = pd.concat([bal_df, total_row], ignore_index=True)
st.dataframe(bal_df.style.format({
    "Flow In (m³/h)": "{:,.1f}", "Flow Out (m³/h)": "{:,.1f}",
    "Leakage / Evap.": "{:,.1f}", "Annual Vol. (Mm³)": "{:,.2f}",
}), use_container_width=True, hide_index=True)

st.divider()

# ── Contaminant concentration table ──────────────────────────────────────────
st.subheader("Effluent Contaminant Concentrations")
st.markdown("Concentrations on each process discharge stream. Values inform treatment technology selection.")

conc_rows = []
for proc, params in contaminants.items():
    row = {"Process": proc}
    for param, meta in params.items():
        row[f"{param} ({meta['unit']})"] = meta["value"]
    conc_rows.append(row)
conc_df = pd.DataFrame(conc_rows).set_index("Process").fillna("–")
st.dataframe(conc_df, use_container_width=True)

st.divider()

# ── Concentration & recovery zone ────────────────────────────────────────────
st.subheader("Concentrate Stream — Valuable Material Extraction")
st.markdown(
    "When concentrate/blowdown is further processed, valuable solids can be crystallised or recovered. "
    "The table below shows the theoretical mass and market value per process stream."
)

mat_cols = ["Stream", "Material", "Conc. (mg/L)", "Flow (m³/h)",
            "Potential Recovery (t/yr)", "Market Value (€/t)", "Potential Revenue (€/yr)"]
mat_rows = []
recoveries = {
    "Blast Furnace": [("Iron Oxide", 75, 0.75, 75), ("Zinc", 5, 0.85, 2500)],
    "Converter":     [("Iron Oxide", 60, 0.75, 75)],
    "HSM":           [("Iron Oxide", 20, 0.60, 75), ("Oil", 20, 0.85, 150)],
    "CRM":           [("Oil/Emulsion", 1500, 0.90, 150), ("Iron Chloride", 5000, 0.80, 120)],
    "Galva":         [("Zinc", 200, 0.85, 2500)],
    "Detox":         [("Zinc", 500, 0.85, 2500)],
    "Sinter Plant":  [("Iron Oxide", 80, 0.70, 75)],
}
for proc, materials in recoveries.items():
    flow = processes.get(proc, {}).get("flow_out", 0.0)
    for mat, conc_mgl, eff, price in materials:
        mass_t_yr = conc_mgl / 1e6 * 1e3 * flow * hours * eff / 1e3
        revenue   = mass_t_yr * price
        mat_rows.append([proc, mat, conc_mgl, flow,
                         round(mass_t_yr, 1), price, round(revenue, 0)])

mat_df = pd.DataFrame(mat_rows, columns=mat_cols)
total_rev = mat_df["Potential Revenue (€/yr)"].sum()
st.dataframe(mat_df.style.format({
    "Conc. (mg/L)": "{:,.0f}",
    "Flow (m³/h)": "{:,.1f}",
    "Potential Recovery (t/yr)": "{:,.1f}",
    "Market Value (€/t)": "{:,.0f}",
    "Potential Revenue (€/yr)": "€{:,.0f}",
}), use_container_width=True, hide_index=True)

st.success(f"**Total potential material recovery revenue: €{total_rev/1e6:.2f}M / year**")
st.caption("Assumptions: concentrations from plant data; recovery efficiencies are indicative. "
           "Actual yields depend on selected treatment technology.")
