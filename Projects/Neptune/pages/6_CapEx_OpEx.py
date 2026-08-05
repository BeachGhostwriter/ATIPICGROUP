"""Page 6 – CapEx / OpEx: multi-year investment plan, NPV, IRR, optimisation."""

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import numpy as np
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.data_models import TREATMENT_OPTIONS
from utils.calculations import (
    annual_water_costs, treatment_capex_opex, material_recovery_revenue,
    ebitda_bridge, npv, irr, simple_payback, phase_capex, cumulative_opex_savings,
)
from utils.data_models import RECOVERED_MATERIALS

st.set_page_config(page_title="CapEx / OpEx | Neptune", layout="wide")
st.title("🏗️ CapEx / OpEx Investment Planning")
st.markdown(
    "Define the capital and operating expenditure plan over a 3- or 5-year horizon. "
    "The platform calculates NPV, IRR, payback and an optimised investment recommendation."
)
st.divider()

if "initialized" not in st.session_state:
    st.warning("Please visit the **Home** page first.")
    st.stop()

hours     = st.session_state.operating_hours
total_in  = st.session_state.total_inlet_flow
discharge = st.session_state.discharge_flow

# ── Plan settings ─────────────────────────────────────────────────────────────
st.subheader("Plan Configuration")
cfg1, cfg2, cfg3, cfg4 = st.columns(4)

time_horizon = cfg1.selectbox(
    "Planning Horizon", [3, 5, 10], index=1,
    key="horizon_sel",
    help="Select 3, 5 or 10 years – calculations recalculate automatically.",
)
st.session_state.time_horizon_yr = time_horizon

capex_profile = cfg2.selectbox(
    "CAPEX Deployment Profile",
    ["front-loaded", "even", "back-loaded"],
    index=0, key="capex_profile_sel",
    help="How CAPEX is spread across the investment years.",
)

discount_rate = cfg3.number_input(
    "Discount Rate (%)", 0.0, 30.0,
    st.session_state.get("discount_rate_pct", 8.0), 0.5, format="%.1f",
)
st.session_state.discount_rate_pct = discount_rate

target_recycle = cfg4.slider(
    "Target Recycling Rate (%)", 0, 95, int(st.session_state.target_recycle_pct), 5,
)
st.session_state.target_recycle_pct = float(target_recycle)
st.divider()

# ── Compute base financials ───────────────────────────────────────────────────
costs = annual_water_costs(
    st.session_state.processes,
    st.session_state.water_cost_eur_m3,
    st.session_state.discharge_cost_eur_m3,
    hours, total_in, discharge,
)
tx = treatment_capex_opex(
    st.session_state.selected_treatments,
    TREATMENT_OPTIONS, total_in, hours,
    pretreatment_flow=st.session_state.get("pretreatment_flow_m3h", 2764.30),
    wwt_flow=st.session_state.get("wwt_flow_m3h", 2000.0),
    concentrate_flow=st.session_state.get("concentrate_flow_m3h", 300.0),
)
mat_rev = material_recovery_revenue(RECOVERED_MATERIALS, st.session_state.processes, hours)
total_mat_revenue = sum(v["revenue_eur_yr"] for v in mat_rev.values())

bridge = ebitda_bridge(costs, target_recycle, tx["total_opex_eur_yr"], total_mat_revenue)
annual_benefit  = bridge["net_improvement"]
total_capex_est = tx["total_capex_eur"]

# ── CAPEX phasing ─────────────────────────────────────────────────────────────
st.subheader(f"CAPEX Phasing — {time_horizon}-Year Plan")

capex_schedule = phase_capex(total_capex_est, time_horizon, capex_profile)

st.markdown("**Budget-entry override** — adjust the planned CAPEX per year below:")
budget_rows = []
for yr in range(1, time_horizon + 1):
    budget_rows.append({
        "Year": f"Year {yr}",
        "Planned CAPEX (€M)": round(capex_schedule[yr - 1] / 1e6, 2),
        "Cumulative (€M)":    round(sum(capex_schedule[:yr]) / 1e6, 2),
    })
budget_df = pd.DataFrame(budget_rows)

edited_budget = st.data_editor(
    budget_df, use_container_width=True, hide_index=True, num_rows="fixed",
    key="capex_editor",
    column_config={
        "Year":               st.column_config.TextColumn(disabled=True),
        "Planned CAPEX (€M)": st.column_config.NumberColumn(format="%.2f"),
        "Cumulative (€M)":    st.column_config.NumberColumn(format="%.2f", disabled=True),
    },
)

# Use edited values
edited_capex = [float(r["Planned CAPEX (€M)"]) * 1e6
                for _, r in edited_budget.iterrows()]
total_planned_capex = sum(edited_capex)

st.info(f"Total planned CAPEX: **€{total_planned_capex/1e6:.1f}M** "
        f"vs system estimate: **€{total_capex_est/1e6:.1f}M**")

# ── OPEX profile ──────────────────────────────────────────────────────────────
st.subheader(f"OPEX Profile — {time_horizon}-Year Ramp-Up")

opex_rows = []
for yr in range(1, time_horizon + 1):
    ramp = min(yr / time_horizon, 1.0)
    annual_opex = tx["total_opex_eur_yr"] * ramp
    saving      = annual_benefit * ramp
    net         = saving - annual_opex
    opex_rows.append({
        "Year": f"Year {yr}",
        "Ramp (%)":           round(ramp * 100),
        "Treatment OPEX (€M)": round(annual_opex / 1e6, 2),
        "Annual Benefit (€M)": round(saving / 1e6, 2),
        "Net Cash (€M)":       round(net / 1e6, 2),
        "CAPEX Spend (€M)":    round(edited_capex[yr - 1] / 1e6, 2),
    })
opex_df = pd.DataFrame(opex_rows)
st.dataframe(opex_df.style.format({
    "Treatment OPEX (€M)": "{:,.2f}",
    "Annual Benefit (€M)": "{:,.2f}",
    "Net Cash (€M)": "{:+,.2f}",
    "CAPEX Spend (€M)": "{:,.2f}",
}).map(lambda v: "color:green" if isinstance(v, float) and v > 0 else
               ("color:red" if isinstance(v, float) and v < 0 else ""),
      subset=["Net Cash (€M)"]),
    use_container_width=True, hide_index=True,
)

st.divider()

# ── Financial returns ─────────────────────────────────────────────────────────
st.subheader("Financial Returns")

# annual_benefit = bridge['net_improvement'] which is already net of treatment OPEX
npv_val = npv(edited_capex, annual_benefit, 0.0, discount_rate)
irr_val = irr(edited_capex, annual_benefit, 0.0, terminal_yr=20)
pb_val  = simple_payback(total_planned_capex, annual_benefit)

r1, r2, r3, r4 = st.columns(4)
r1.metric("Total CAPEX (Planned)",   f"€{total_planned_capex/1e6:.1f}M")
r2.metric(f"NPV (20yr, {discount_rate:.0f}%)", f"€{npv_val/1e6:.1f}M",
          delta="positive" if npv_val > 0 else "negative")
r3.metric("IRR",                     f"{irr_val:.1f} %")
r4.metric("Simple Payback",          f"{pb_val:.1f} yrs" if pb_val < 50 else "> 50 yrs")

st.divider()

# ── Cumulative cash flow chart ────────────────────────────────────────────────
st.subheader("Cumulative Net Cash Flow")

cum_vals = cumulative_opex_savings(annual_benefit, tx["total_opex_eur_yr"], edited_capex)
years_x  = list(range(1, len(cum_vals) + 1))

fig_cum = go.Figure()
fig_cum.add_trace(go.Scatter(
    x=years_x, y=[v / 1e6 for v in cum_vals],
    mode="lines+markers", name="Cumulative Net Cash (€M)",
    fill="tozeroy",
    line=dict(color="#4a90d9", width=2),
    fillcolor="rgba(74,144,217,0.15)",
))
fig_cum.add_hline(y=0, line_dash="dash", line_color="red", annotation_text="Break-even")
# Payback line
if pb_val < len(cum_vals):
    fig_cum.add_vline(x=pb_val, line_dash="dot", line_color="green",
                       annotation_text=f"Payback: {pb_val:.1f}yr")
fig_cum.update_layout(
    title=f"Cumulative Net Cash Position — {time_horizon}-Year Investment Horizon",
    xaxis_title="Year", yaxis_title="€M",
    height=420, yaxis_tickprefix="€", yaxis_ticksuffix="M",
    margin=dict(l=10, r=10, t=50, b=10),
)
st.plotly_chart(fig_cum, use_container_width=True)

# ── Annual waterfall bar chart ────────────────────────────────────────────────
fig_bar = go.Figure()
fig_bar.add_trace(go.Bar(name="CAPEX", x=[f"Y{i+1}" for i in range(time_horizon)],
                          y=[-v / 1e6 for v in edited_capex],
                          marker_color="#e74c3c"))
fig_bar.add_trace(go.Bar(name="OPEX",
                          x=[f"Y{i+1}" for i in range(time_horizon)],
                          y=[-tx["total_opex_eur_yr"] * min((i+1)/time_horizon,1) / 1e6
                             for i in range(time_horizon)],
                          marker_color="#e67e22"))
fig_bar.add_trace(go.Bar(name="Benefit",
                          x=[f"Y{i+1}" for i in range(time_horizon)],
                          y=[annual_benefit * min((i+1)/time_horizon,1) / 1e6
                             for i in range(time_horizon)],
                          marker_color="#2ea44f"))
fig_bar.update_layout(barmode="group", title="Annual CAPEX / OPEX / Benefit (€M)",
                       height=380, yaxis_tickprefix="€", yaxis_ticksuffix="M",
                       margin=dict(l=10, r=10, t=50, b=10))
st.plotly_chart(fig_bar, use_container_width=True)

st.divider()

# ── Optimisation recommendation ───────────────────────────────────────────────
st.subheader("🔍 Optimised Investment Strategy Recommendation")

st.markdown("The optimiser ranks treatment stages by **NPV contribution per € of CAPEX** "
            "and recommends a prioritised deployment sequence.")

opt_rows = []
for stage, tech_name in st.session_state.selected_treatments.items():
    if tech_name is None or "None" in str(tech_name):
        continue
    opts = TREATMENT_OPTIONS.get(stage, {})
    if tech_name not in opts:
        continue
    tech  = opts[tech_name]
    stage_capex = tech.get("capex_eur_per_m3h", 0) * total_in
    stage_opex  = tech.get("opex_eur_per_m3", 0) * total_in * hours
    # Attribute ~proportional share of benefit
    stages_total = sum(
        TREATMENT_OPTIONS.get(s, {}).get(t, {}).get("capex_eur_per_m3h", 0) * total_in
        for s, t in st.session_state.selected_treatments.items()
        if t and "None" not in str(t) and t in TREATMENT_OPTIONS.get(s, {})
    )
    if stages_total > 0:
        benefit_share = (stage_capex / stages_total) * annual_benefit
    else:
        benefit_share = 0
    # benefit_share already net of opex proportionally; use net benefit to avoid double-count
    net_benefit_share = benefit_share - stage_opex
    stage_npv = npv([stage_capex / time_horizon] * time_horizon,
                     net_benefit_share, 0.0, discount_rate)
    npv_per_capex = stage_npv / max(stage_capex, 1)
    opt_rows.append({
        "Stage":              stage,
        "Technology":         tech_name,
        "Tier":               tech.get("tier", ""),
        "CAPEX (€M)":         round(stage_capex / 1e6, 2),
        "Annual Benefit (€M)": round(benefit_share / 1e6, 3),
        "Stage NPV (€M)":     round(stage_npv / 1e6, 2),
        "NPV/CAPEX (x)":      round(npv_per_capex, 2),
        "Priority":           "",
    })

if opt_rows:
    opt_df = pd.DataFrame(opt_rows).sort_values("NPV/CAPEX (x)", ascending=False).reset_index(drop=True)
    opt_df["Priority"] = ["⭐" * min(i + 1, 5) for i in range(len(opt_df), 0, -1)]

    def color_priority(row):
        if row["NPV/CAPEX (x)"] > 1.5:
            return ["background-color:#d4edda"] * len(row)
        elif row["NPV/CAPEX (x)"] > 0.5:
            return ["background-color:#fff3cd"] * len(row)
        else:
            return ["background-color:#f8d7da"] * len(row)

    st.dataframe(
        opt_df.style.apply(color_priority, axis=1)
              .format({"CAPEX (€M)": "{:,.2f}", "Annual Benefit (€M)": "{:,.3f}",
                        "Stage NPV (€M)": "{:,.2f}", "NPV/CAPEX (x)": "{:.2f}"}),
        use_container_width=True, hide_index=True,
    )

    # Narrative recommendation
    top_stage  = opt_df.iloc[0]["Stage"]
    top_tech   = opt_df.iloc[0]["Technology"]
    top_npv    = opt_df.iloc[0]["NPV/CAPEX (x)"]
    low_stages = opt_df[opt_df["Stage NPV (€M)"] < 0]["Stage"].tolist()

    rec_text = f"""
    **Recommended Deployment Sequence (by NPV/CAPEX ratio):**

    1. **Deploy first:** {top_stage} → {top_tech}
       *Highest NPV return per € invested ({top_npv:.2f}x). Deploy in Year 1–2.*

    2. **Deploy subsequently:** {', '.join(opt_df.iloc[1:3]["Stage"].tolist())}
       *Mid-range returns; required to achieve target recycling rate.*

    {"3. **Review carefully:** " + ", ".join(low_stages) + " show negative NPV at current assumptions. Consider deferral or alternative technology." if low_stages else ""}

    **Overall:** A {time_horizon}-year staged deployment phasing {capex_profile.replace('-',' ')} achieves
    **IRR of {irr_val:.1f}%** and **NPV of €{npv_val/1e6:.1f}M** at a {discount_rate:.0f}% discount rate.
    Simple payback is **{pb_val:.1f} years**. Proceed with full business case.
    """
    st.markdown(rec_text)
    st.caption("Green = NPV/CAPEX > 1.5 (strong). Amber = 0.5–1.5 (adequate). Red = <0.5 (review).")
else:
    st.info("No treatment technologies configured — go to Treatment Solutions page.")

st.divider()

# ── Sensitivity: NPV vs discount rate ────────────────────────────────────────
st.subheader("NPV Sensitivity vs Discount Rate")
rates = np.arange(2, 25, 1)
npv_sens = [npv(edited_capex, annual_benefit, 0.0, r) / 1e6 for r in rates]
fig_rate = px.line(
    x=rates, y=npv_sens,
    labels={"x": "Discount Rate (%)", "y": "NPV (€M)"},
    title="Project NPV vs Discount Rate",
    color_discrete_sequence=["#4a90d9"],
    markers=True,
)
fig_rate.add_hline(y=0, line_dash="dash", line_color="red", annotation_text="NPV = 0")
fig_rate.add_vline(x=discount_rate, line_dash="dot", line_color="green",
                    annotation_text=f"Selected: {discount_rate:.0f}%")
fig_rate.update_layout(height=380)
st.plotly_chart(fig_rate, use_container_width=True)
