"""Page 5 – EBITDA Bridge: waterfall chart showing water investment value creation."""

import streamlit as st
import plotly.graph_objects as go
import pandas as pd
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.data_models import TREATMENT_OPTIONS, RECOVERED_MATERIALS
from utils.calculations import (
    annual_water_costs, treatment_capex_opex,
    material_recovery_revenue, ebitda_bridge, simple_payback,
)

st.set_page_config(page_title="EBITDA Bridge | Neptune", layout="wide")
st.title("📈 EBITDA Bridge — Water Value Creation")
st.markdown(
    "Waterfall chart translating water treatment investment into a management-level EBITDA improvement."
)
st.divider()

if "initialized" not in st.session_state:
    st.warning("Please visit the **Home** page first.")
    st.stop()

hours      = st.session_state.operating_hours
total_in   = st.session_state.total_inlet_flow
discharge  = st.session_state.discharge_flow
w_cost     = st.session_state.water_cost_eur_m3
d_cost     = st.session_state.discharge_cost_eur_m3

# ── Scenario inputs ───────────────────────────────────────────────────────────
st.subheader("Scenario Assumptions")
s1, s2, s3, s4 = st.columns(4)
target_recycle = s1.slider(
    "Target Water Recycling Rate (%)",
    min_value=0, max_value=95, step=5,
    value=int(st.session_state.target_recycle_pct),
    help="What % of process water can be recycled after treatment?",
)
st.session_state.target_recycle_pct = float(target_recycle)

water_cost   = s2.number_input("Fresh Water Rate (€/m³)", 0.0, 5.0, w_cost, 0.01, format="%.3f")
disch_cost   = s3.number_input("Discharge Permit Rate (€/m³)", 0.0, 5.0, d_cost, 0.01, format="%.3f")
prod_penalty = s4.number_input(
    "Avoided Regulatory Penalty (€M/yr)", 0.0, 50.0, 2.0, 0.5,
    help="Annual penalty / licence-risk value avoided by achieving compliance.",
) * 1e6

st.session_state.water_cost_eur_m3    = water_cost
st.session_state.discharge_cost_eur_m3 = disch_cost
st.divider()

# ── Core calculations ─────────────────────────────────────────────────────────
costs = annual_water_costs(
    st.session_state.processes,
    water_cost, disch_cost,
    hours, total_in, discharge,
)
tx = treatment_capex_opex(
    st.session_state.selected_treatments,
    TREATMENT_OPTIONS, total_in, hours,
    pretreatment_flow=st.session_state.get("pretreatment_flow_m3h", 2764.30),
    wwt_flow=st.session_state.get("wwt_flow_m3h", 2000.0),
    concentrate_flow=st.session_state.get("concentrate_flow_m3h", 300.0),
)
mat_rev_detail = material_recovery_revenue(
    RECOVERED_MATERIALS, st.session_state.processes, hours,
)
total_mat_revenue = sum(v["revenue_eur_yr"] for v in mat_rev_detail.values())

# Energy savings: AnMBR produces energy; RO reduces pumping vs once-through
energy_saving = 0.0
if "AnMBR" in str(st.session_state.selected_treatments.get("Secondary Treatment", "")):
    energy_saving = abs(
        TREATMENT_OPTIONS["Secondary Treatment"]["AnMBR (Anaerobic MBR)"]["energy_kwh_m3"]
    ) * total_in * hours * st.session_state.electricity_cost_eur_kwh

bridge = ebitda_bridge(
    costs,
    target_recycle,
    tx["total_opex_eur_yr"],
    total_mat_revenue,
    energy_saving,
)
bridge["regulatory_saving"] = prod_penalty
bridge["net_improvement"]  += prod_penalty

# ── EBITDA Waterfall ──────────────────────────────────────────────────────────
st.subheader("EBITDA Bridge — Annual Waterfall")

labels = [
    "Baseline Water Cost",
    "Water Intake Savings",
    "Discharge Cost Savings",
    "Material Recovery Revenue",
    "Energy Savings",
    "Regulatory / Licence Value",
    "Treatment OPEX",
    "Net EBITDA Improvement",
]
measures = ["absolute", "relative", "relative", "relative", "relative", "relative", "relative", "total"]
values   = [
    bridge["baseline_water_cost"],
    bridge["water_intake_saving"],
    bridge["discharge_saving"],
    total_mat_revenue,
    energy_saving,
    prod_penalty,
    -tx["total_opex_eur_yr"],
    0,  # total is auto-calculated
]

text_vals = [f"€{v/1e6:.2f}M" for v in values]

fig_wf = go.Figure(go.Waterfall(
    name="EBITDA Bridge",
    orientation="v",
    measure=measures,
    x=labels,
    y=values,
    text=text_vals,
    textposition="outside",
    connector={"line": {"color": "#636363", "width": 1.5}},
    increasing={"marker": {"color": "#2ea44f"}},
    decreasing={"marker": {"color": "#e74c3c"}},
    totals={"marker": {"color": "#4a90d9"}},
))
fig_wf.update_layout(
    title="Annual EBITDA Impact of Water Treatment Investment",
    yaxis_title="EUR / year",
    height=520,
    yaxis=dict(tickprefix="€", tickformat=",.0f"),
    showlegend=False,
    margin=dict(l=20, r=20, t=50, b=100),
    xaxis=dict(tickangle=-20),
)
st.plotly_chart(fig_wf, use_container_width=True)

# ── KPI row ───────────────────────────────────────────────────────────────────
k1, k2, k3, k4, k5 = st.columns(5)
k1.metric("Baseline Water Cost",     f"€{bridge['baseline_water_cost']/1e6:.1f}M/yr")
k2.metric("Total Annual Savings",    f"€{(bridge['water_intake_saving']+bridge['discharge_saving']+total_mat_revenue+energy_saving+prod_penalty)/1e6:.1f}M/yr")
k3.metric("Treatment OPEX",          f"€{tx['total_opex_eur_yr']/1e6:.2f}M/yr",
          delta_color="inverse", delta="-cost")
k4.metric("Net EBITDA Improvement",  f"€{bridge['net_improvement']/1e6:.2f}M/yr",
          delta=f"{bridge['net_improvement']/bridge['baseline_water_cost']*100:.1f} %")
pb = simple_payback(tx["total_capex_eur"], bridge["net_improvement"])
k5.metric("Simple Payback",          f"{pb:.1f} yrs" if pb < 50 else ">50 yrs")

st.divider()

# ── Savings breakdown table ───────────────────────────────────────────────────
st.subheader("Savings & Revenue Breakdown")

breakdown = pd.DataFrame([
    ("Water Intake Savings",      "Reduced freshwater purchase",      bridge["water_intake_saving"],
     bridge["water_intake_saving"] / bridge["baseline_water_cost"] * 100),
    ("Discharge Cost Savings",    "Reduced permit/treatment cost",    bridge["discharge_saving"],
     bridge["discharge_saving"] / bridge["baseline_water_cost"] * 100),
    ("Material Recovery Revenue", "Zinc, Fe, oil, acid recovery",     total_mat_revenue,
     total_mat_revenue / bridge["baseline_water_cost"] * 100),
    ("Energy Savings",            "AnMBR biogas & pump energy",       energy_saving,
     energy_saving / bridge["baseline_water_cost"] * 100),
    ("Regulatory Value",          "Avoided fines & licence risk",     prod_penalty,
     prod_penalty / bridge["baseline_water_cost"] * 100),
    ("Treatment OPEX",            "Annual treatment operating cost",  -tx["total_opex_eur_yr"],
     -tx["total_opex_eur_yr"] / bridge["baseline_water_cost"] * 100),
], columns=["Item", "Description", "€/yr", "% of Baseline"])

st.dataframe(
    breakdown.style.format({"€/yr": "€{:,.0f}", "% of Baseline": "{:+.1f} %"})
             .map(lambda v: "color:green" if isinstance(v, float) and v > 0 else
                             ("color:red" if isinstance(v, float) and v < 0 else ""),
                  subset=["€/yr"]),
    use_container_width=True, hide_index=True,
)

st.divider()

# ── Material recovery detail ──────────────────────────────────────────────────
st.subheader("Material Recovery Detail")

mat_rows = []
for mat, detail in mat_rev_detail.items():
    mat_rows.append({
        "Material Stream":       mat,
        f"Quantity ({detail['unit']})": detail["quantity_yr"],
        "Revenue (€/yr)":        detail["revenue_eur_yr"],
    })
if mat_rows:
    mat_df = pd.DataFrame(mat_rows)
    total_row = {"Material Stream": "TOTAL", "Revenue (€/yr)": total_mat_revenue}
    mat_df = pd.concat([mat_df, pd.DataFrame([total_row])], ignore_index=True)
    st.dataframe(
        mat_df.style.format({"Revenue (€/yr)": "€{:,.0f)"}),
        use_container_width=True, hide_index=True,
    )
else:
    st.info("No material recovery data — configure processes on Company Data page.")

st.divider()

# ── Sensitivity analysis ──────────────────────────────────────────────────────
st.subheader("Sensitivity Analysis — EBITDA Improvement")

import plotly.express as px
import numpy as np

recycle_range = np.arange(10, 100, 5)
sens_rows = []
for rr in recycle_range:
    b = ebitda_bridge(costs, rr, tx["total_opex_eur_yr"], total_mat_revenue)
    sens_rows.append({"Recycling Rate (%)": rr,
                      "Net EBITDA Improvement (€M/yr)": b["net_improvement"] / 1e6})
sens_df = pd.DataFrame(sens_rows)
fig_sens = px.line(sens_df, x="Recycling Rate (%)", y="Net EBITDA Improvement (€M/yr)",
                   markers=True, title="Sensitivity: EBITDA improvement vs recycling rate",
                   color_discrete_sequence=["#4a90d9"])
fig_sens.add_hline(y=0, line_dash="dash", line_color="red", annotation_text="Break-even")
fig_sens.add_vline(x=target_recycle, line_dash="dot", line_color="green",
                   annotation_text=f"Selected: {target_recycle}%")
fig_sens.update_layout(height=400)
st.plotly_chart(fig_sens, use_container_width=True)
