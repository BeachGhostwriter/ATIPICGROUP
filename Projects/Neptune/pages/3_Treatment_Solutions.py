"""Page 3 – Treatment Solutions: treatment train, per-stage contaminant removal, dropdowns."""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import numpy as np
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.data_models import TREATMENT_OPTIONS
from utils.calculations import recommend_treatments, treatment_capex_opex

st.set_page_config(page_title="Treatment Solutions | Neptune", layout="wide")

st.markdown("""
<style>
.js-plotly-plot text { text-shadow: none !important; filter: none !important; }
.plot-container text { text-shadow: none !important; }
</style>
""", unsafe_allow_html=True)

st.title("Treatment Solutions")
st.markdown(
    "Select the technology for each treatment stage. "
    "The treatment chain below shows which contaminants are removed at each step, "
    "with the site-wide WWT unit acting as a safety catch-all for any residuals."
)
st.divider()

if "initialized" not in st.session_state:
    st.warning("Please visit the Home page first.")
    st.stop()

total_in  = st.session_state.total_inlet_flow
hours     = st.session_state.operating_hours
pt_flow   = st.session_state.get("pretreatment_flow_m3h", 2764.30)
wwt_flow  = st.session_state.get("wwt_flow_m3h", 2000.0)
conc_flow = st.session_state.get("concentrate_flow_m3h", 300.0)

def _tx(sel):
    return treatment_capex_opex(sel, TREATMENT_OPTIONS, total_in, hours,
                                 pretreatment_flow=pt_flow,
                                 wwt_flow=wwt_flow,
                                 concentrate_flow=conc_flow)

# ── Auto-recommend ────────────────────────────────────────────────────────────
col_btn1, col_btn2 = st.columns([1, 5])
if col_btn1.button("Auto-Recommend"):
    st.session_state.selected_treatments = recommend_treatments(
        st.session_state.contaminants, target_reuse=True)
    st.success("Technologies updated based on contaminant profile.")
col_btn2.markdown(
    "*Auto-recommendation is driven by the highest contaminant concentrations "
    "found on the Company Data page.*"
)
st.divider()

# ──────────────────────────────────────────────────────────────────────────────
# TREATMENT TRAIN — CONTAMINANT REMOVAL CHAIN
# ──────────────────────────────────────────────────────────────────────────────
st.subheader("Treatment Train — Contaminant Removal Chain")
st.markdown(
    "Each row shows the contaminants targeted at that stage, the removal efficiency of the "
    "selected technology, and the residual concentration passing to the next stage. "
    "The final **Site WWT** row is the safety catch-all."
)

selected = st.session_state.selected_treatments

# Typical influent concentrations (mg/L) entering the WWT system
INFLUENT = {
    "TSS":              150.0,
    "Oil / Grease":      30.0,
    "Fe":                40.0,
    "Zn":                 5.0,
    "COD":              500.0,
    "BOD":              200.0,
    "Heavy Metals":       5.0,
    "TDS":             1200.0,
    "Micropollutants":    0.5,
}

# Discharge limits — loaded from Country/Region setup page (session state)
# Falls back to EU/German defaults if not yet configured
_DEFAULT_LIMITS = {
    "TSS": 30.0, "Oil / Grease": 5.0, "Fe": 2.0, "Zn": 1.0,
    "COD": 100.0, "BOD": 25.0, "Heavy Metals": 0.2,
    "TDS": 2500.0, "Micropollutants": 0.1,
}
_session_limits = st.session_state.get("discharge_limits", {})
DISCHARGE_LIMITS = {**_DEFAULT_LIMITS, **{k: v for k, v in _session_limits.items() if v is not None}}

_country = st.session_state.get("selected_country", "Germany (default)")
st.info(
    f"Discharge limits applied: **{_country}** — "
    "Configure on the **Country & Region** page."
)

# Which parameters each stage primarily targets
STAGE_TARGETS = {
    "Pre-treatment": {
        "TSS": ("TSS", "Oil / Grease", "Fe"),
        "description": "Gross solids, particulate iron, oils",
    },
    "Primary Treatment": {
        "targets": ("TSS", "Oil / Grease", "Fe"),
        "description": "Settleable solids, floating oils/fats, heavy particles",
    },
    "Secondary Treatment": {
        "targets": ("COD", "BOD", "TSS"),
        "description": "Dissolved organics, biological oxygen demand, suspended solids",
    },
    "Tertiary Treatment": {
        "targets": ("TDS", "Heavy Metals", "Zn", "Micropollutants", "TSS"),
        "description": "Dissolved salts, heavy metals, trace pollutants",
    },
    "Concentrate Management": {
        "targets": ("TDS", "Heavy Metals", "Zn"),
        "description": "Concentrate / brine volume reduction, salt and metal recovery",
    },
}

# Build step-by-step concentration cascade
chain_rows = []
current_concs = INFLUENT.copy()

for stage, stage_info in STAGE_TARGETS.items():
    tech_name = selected.get(stage, "")
    if not tech_name or "None" in str(tech_name):
        continue
    tech_data = TREATMENT_OPTIONS.get(stage, {}).get(tech_name, {})
    removal   = tech_data.get("removal", {})
    targets   = stage_info.get("targets", ())

    for pollutant in targets:
        c_in  = current_concs.get(pollutant, 0.0)
        eff   = removal.get(pollutant, removal.get("TSS", 0.0) if pollutant in ("Fe",) else 0.0)
        # Fall back: if not explicitly listed, use a fraction of the most relevant removal
        if eff == 0 and pollutant == "Fe" and "TSS" in removal:
            eff = removal["TSS"] * 0.80
        if eff == 0 and pollutant == "Zn" and "Heavy Metals" in removal:
            eff = removal["Heavy Metals"]
        c_out = c_in * (1 - eff) if eff > 0 else c_in
        limit = DISCHARGE_LIMITS.get(pollutant, None)
        meets = "YES" if limit and c_out <= limit else ("--" if limit is None else "NO")
        chain_rows.append({
            "Stage":                stage,
            "Technology":           tech_name,
            "Pollutant":            pollutant,
            "Stage description":    stage_info.get("description", ""),
            "Inlet conc. (mg/L)":   round(c_in, 2),
            "Removal (%)":          round(eff * 100, 0),
            "Outlet conc. (mg/L)":  round(c_out, 3),
            "Discharge limit":      f"{limit} mg/L" if limit else "n/a",
            "Meets limit?":         meets,
        })
        current_concs[pollutant] = c_out

# Site-wide WWT catch-all
SITE_WWT_REMOVAL = {
    "TSS": 0.80, "Oil / Grease": 0.70, "Fe": 0.70, "Zn": 0.60,
    "COD": 0.70, "BOD": 0.80, "Heavy Metals": 0.60, "Micropollutants": 0.50,
}
for pollutant, c_in in current_concs.items():
    eff   = SITE_WWT_REMOVAL.get(pollutant, 0.40)
    c_out = c_in * (1 - eff)
    limit = DISCHARGE_LIMITS.get(pollutant, None)
    meets = "YES" if limit and c_out <= limit else ("--" if limit is None else "NO")
    chain_rows.append({
        "Stage":                "Site WWT (Safety Catch-All)",
        "Technology":           "Filtration / Neutralisation / DAF",
        "Pollutant":            pollutant,
        "Stage description":    "Safety polishing — catches all residuals before final discharge",
        "Inlet conc. (mg/L)":   round(c_in, 2),
        "Removal (%)":          round(eff * 100, 0),
        "Outlet conc. (mg/L)":  round(c_out, 3),
        "Discharge limit":      f"{limit} mg/L" if limit else "n/a",
        "Meets limit?":         meets,
    })

chain_df = pd.DataFrame(chain_rows)

def _color_meets(val):
    if val == "YES":
        return "background-color:#d4edda;color:#155724;font-weight:bold"
    if val == "NO":
        return "background-color:#f8d7da;color:#721c24;font-weight:bold"
    return ""

def _color_stage(val):
    stage_colors = {
        "Pre-treatment":               "background-color:#fff9c4",
        "Primary Treatment":           "background-color:#e8f5e9",
        "Secondary Treatment":         "background-color:#e3f2fd",
        "Tertiary Treatment":          "background-color:#f3e5f5",
        "Concentrate Management":      "background-color:#fce4ec",
        "Site WWT (Safety Catch-All)": "background-color:#eceff1;font-weight:bold",
    }
    return stage_colors.get(val, "")

st.dataframe(
    chain_df.style
        .map(_color_meets, subset=["Meets limit?"])
        .map(_color_stage, subset=["Stage"])
        .format({
            "Inlet conc. (mg/L)":  "{:.2f}",
            "Removal (%)":         "{:.0f}",
            "Outlet conc. (mg/L)": "{:.3f}",
        }),
    use_container_width=True,
    hide_index=True,
    height=520,
)

# Final compliance summary
final_df = chain_df[chain_df["Stage"] == "Site WWT (Safety Catch-All)"][
    ["Pollutant", "Outlet conc. (mg/L)", "Discharge limit", "Meets limit?"]
].reset_index(drop=True)
no_meet = final_df[final_df["Meets limit?"] == "NO"]
if len(no_meet) == 0:
    st.success("All parameters meet discharge limits after the full treatment train including Site WWT catch-all.")
else:
    st.error(
        f"{len(no_meet)} parameter(s) still exceed discharge limits after the treatment train: "
        f"{', '.join(no_meet['Pollutant'].tolist())}. "
        "Consider upgrading the relevant treatment stage or adding a polishing step."
    )
st.divider()

# ── Concentration cascade bar chart ───────────────────────────────────────────
st.subheader("Concentration Profile Through Treatment Train")

pivot_rows = []
for row in chain_rows:
    pivot_rows.append({
        "Stage":    row["Stage"],
        "Pollutant": row["Pollutant"],
        "Outlet":   row["Outlet conc. (mg/L)"],
    })
pv_df = pd.DataFrame(pivot_rows)

pollutants_with_limits = [p for p in DISCHARGE_LIMITS if p in pv_df["Pollutant"].unique()]
sel_poll = st.selectbox("Select pollutant to trace through treatment train:",
                         pollutants_with_limits, index=0)

trace_df = pv_df[pv_df["Pollutant"] == sel_poll].copy()
inlet_row = pd.DataFrame([{"Stage": "Influent (inlet)", "Pollutant": sel_poll,
                            "Outlet": INFLUENT.get(sel_poll, 0)}])
trace_df = pd.concat([inlet_row, trace_df], ignore_index=True)

fig_trace = go.Figure()
fig_trace.add_trace(go.Bar(
    x=trace_df["Stage"],
    y=trace_df["Outlet"],
    marker_color=["#78909c"] + ["#4a90d9"] * (len(trace_df) - 2) + ["#2e7d32"],
    text=[f"{v:.3g} mg/L" for v in trace_df["Outlet"]],
    textposition="outside",
    textfont=dict(size=13),
))
limit_val = DISCHARGE_LIMITS.get(sel_poll)
if limit_val:
    fig_trace.add_hline(
        y=limit_val, line_dash="dash", line_color="red", line_width=2,
        annotation_text=f"Discharge limit: {limit_val} mg/L",
        annotation_font_size=13, annotation_font_color="red",
    )
fig_trace.update_layout(
    title=dict(text=f"{sel_poll} — concentration after each treatment stage",
               font=dict(family="Arial, sans-serif", size=15, color="#1a1a2e")),
    yaxis_title="Concentration (mg/L)",
    xaxis_title="Treatment Stage",
    height=420,
    font=dict(family="Arial, sans-serif", size=13, color="#1a1a2e"),
    paper_bgcolor="white",
    plot_bgcolor="white",
    margin=dict(l=20, r=20, t=60, b=100),
    xaxis=dict(tickangle=-20),
    yaxis=dict(gridcolor="#eeeeee"),
)
st.plotly_chart(fig_trace, use_container_width=True)
st.divider()

# ──────────────────────────────────────────────────────────────────────────────
# STAGE SELECTORS
# ──────────────────────────────────────────────────────────────────────────────
st.subheader("Treatment Stage Configuration")
st.markdown(
    "Select the technology for each stage. The treatment chain table above updates automatically. "
    "Use **Auto-Recommend** to reset to the optimum based on your contaminant profile."
)

STAGE_INFO = {
    "Pre-treatment": {
        "purpose":   "Protect downstream equipment — remove gross solids, oils, particulates from supply water.",
        "flow_note": f"Design flow: {pt_flow:,.0f} m3/h (supply-side water)",
        "contams":   "TSS, Oil/Grease, Particulate Fe",
    },
    "Primary Treatment": {
        "purpose":   "Remove settleable solids and emulsified oils from process wastewater.",
        "flow_note": f"Design flow: {wwt_flow:,.0f} m3/h (process wastewater)",
        "contams":   "TSS, Oil/Grease, Suspended Fe",
    },
    "Secondary Treatment": {
        "purpose":   "Biological or advanced-oxidation removal of dissolved organics.",
        "flow_note": f"Design flow: {wwt_flow:,.0f} m3/h (process wastewater)",
        "contams":   "COD, BOD, Ammonia, Residual TSS",
    },
    "Tertiary Treatment": {
        "purpose":   "Polishing to reuse or discharge quality — removes ions, metals, micropollutants.",
        "flow_note": f"Design flow: {wwt_flow:,.0f} m3/h (polishing)",
        "contams":   "TDS, Heavy Metals, Zn, Micropollutants",
    },
    "Concentrate Management": {
        "purpose":   "Handle RO/NF reject — concentrate or recover valuable salts and metals.",
        "flow_note": f"Design flow: {conc_flow:,.0f} m3/h (concentrate stream)",
        "contams":   "TDS, Zn, Fe, Salts",
    },
    "ZLD (Zero Liquid Discharge)": {
        "purpose":   "Eliminate liquid discharge entirely — maximum water recovery.",
        "flow_note": f"Design flow: {conc_flow:,.0f} m3/h (brine)",
        "contams":   "All remaining dissolved solids",
    },
}

for stage, info in STAGE_INFO.items():
    options = list(TREATMENT_OPTIONS.get(stage, {}).keys())
    if not options:
        continue
    current = selected.get(stage, options[0])
    if current not in options:
        current = options[0]

    with st.expander(f"{stage}", expanded=False):
        st.markdown(
            f"**Purpose:** {info['purpose']}  \n"
            f"**{info['flow_note']}**  \n"
            f"**Targets:** {info['contams']}"
        )
        col_sel, col_detail = st.columns([2, 3])
        chosen = col_sel.selectbox(
            "Select technology:",
            options,
            index=options.index(current),
            key=f"sel_{stage}",
        )
        selected[stage] = chosen

        if chosen in TREATMENT_OPTIONS.get(stage, {}):
            tech = TREATMENT_OPTIONS[stage][chosen]
            flow_key_map = {
                "Pre-treatment": pt_flow, "Primary Treatment": wwt_flow,
                "Secondary Treatment": wwt_flow, "Tertiary Treatment": wwt_flow,
                "Concentrate Management": conc_flow, "ZLD (Zero Liquid Discharge)": conc_flow,
            }
            design_flow = flow_key_map.get(stage, wwt_flow)
            capex = tech.get("capex_eur_per_m3h", 0) * design_flow
            opex  = tech.get("opex_eur_per_m3", 0) * design_flow * hours
            nrg   = tech.get("energy_kwh_m3", 0) * design_flow * hours

            col_detail.markdown(
                f"**{chosen}**  *(Tier: {tech.get('tier','—')})*  \n"
                f"_{tech.get('description', '')}_"
            )
            m1, m2, m3 = col_detail.columns(3)
            m1.metric("CAPEX",        f"EUR {capex/1e6:.1f}M")
            m2.metric("OPEX / yr",    f"EUR {opex/1e6:.2f}M")
            if nrg < 0:
                m3.metric("Net Energy", f"{abs(nrg)/1e6:.1f}M kWh/yr",
                          delta="energy source", delta_color="normal")
            else:
                m3.metric("Energy",   f"{nrg/1e6:.1f}M kWh/yr")

            # Removal efficiency mini-bar chart
            rem = tech.get("removal", {})
            if rem:
                rem_df = pd.DataFrame({
                    "Pollutant": list(rem.keys()),
                    "Removal (%)": [v * 100 for v in rem.values()],
                })
                fig_rem = go.Figure(go.Bar(
                    x=rem_df["Pollutant"],
                    y=rem_df["Removal (%)"],
                    marker_color="#4a90d9",
                    text=[f"{v:.0f}%" for v in rem_df["Removal (%)"]],
                    textposition="outside",
                    textfont=dict(size=12),
                ))
                fig_rem.update_layout(
                    height=200,
                    margin=dict(l=0, r=0, t=10, b=40),
                    yaxis=dict(range=[0, 110], title="Removal %", gridcolor="#eeeeee"),
                    xaxis=dict(title=""),
                    font=dict(family="Arial, sans-serif", size=12, color="#1a1a2e"),
                    paper_bgcolor="white",
                    plot_bgcolor="white",
                    showlegend=False,
                )
                col_detail.plotly_chart(fig_rem, use_container_width=True)

st.session_state.selected_treatments = selected
st.divider()

# ── Site WWT safety catch-all explanation ────────────────────────────────────
st.subheader("Site WWT — Safety Catch-All Unit")
st.markdown(
    """
The **Site-Wide Water Treatment (Site WWT)** unit receives **all process effluents**
before final discharge to river. It acts as a safety catch-all regardless of what happened
upstream — ensuring legal compliance even if an upstream stage is underperforming.

**Technologies typically included:**
- Screening and grit removal (solids)
- pH correction / neutralisation
- Dissolved Air Flotation (DAF) for residual oils and suspended solids
- Sand or multi-media filtration for final TSS polishing
- Online monitoring with automated diversion if limits are approached

**Key residuals it handles:**
"""
)
resid_rows = []
for pollutant, c_final in current_concs.items():
    limit = DISCHARGE_LIMITS.get(pollutant)
    eff   = SITE_WWT_REMOVAL.get(pollutant, 0.40)
    c_out = c_final * (1 - eff)
    resid_rows.append({
        "Pollutant":                   pollutant,
        "Entering Site WWT (mg/L)":    round(c_final, 3),
        "Site WWT removal (%)":        round(eff * 100),
        "Final effluent (mg/L)":       round(c_out, 4),
        "Discharge limit (mg/L)": limit if limit else "n/a",
        "Compliance":                  "OK" if (limit and c_out <= limit) else ("n/a" if not limit else "REVIEW"),
    })
resid_df = pd.DataFrame(resid_rows)
st.dataframe(
    resid_df.style.map(
        lambda v: ("background-color:#d4edda;color:#155724" if v == "OK" else
                   ("background-color:#fff3cd;color:#856404" if v == "REVIEW" else "")),
        subset=["Compliance"]
    ).format({
        "Entering Site WWT (mg/L)":    "{:.3f}",
        "Site WWT removal (%)":        "{:.0f}",
        "Final effluent (mg/L)":       "{:.4f}",
    }),
    use_container_width=True,
    hide_index=True,
)
st.divider()

# ── All-stage cost summary ────────────────────────────────────────────────────
st.subheader("All-Stage Cost Summary")

tx = _tx(selected)
rows = []
for stage, detail in tx["detail"].items():
    rows.append({
        "Stage":             stage,
        "Technology":        detail["technology"],
        "Design flow m3/h":  round(detail.get("design_flow_m3h", 0)),
        "Tier":              detail["tier"],
        "CAPEX (EUR M)":     round(detail["capex_eur"] / 1e6, 2),
        "OPEX EUR M/yr":     round(detail["opex_eur_yr"] / 1e6, 2),
        "Energy MWh/yr":     round(detail["energy_kwh_yr"] / 1e3, 0),
    })
if rows:
    sum_df = pd.DataFrame(rows)
    tot    = {
        "Stage": "TOTAL", "Technology": "", "Design flow m3/h": "",
        "Tier": "",
        "CAPEX (EUR M)":  sum_df["CAPEX (EUR M)"].sum(),
        "OPEX EUR M/yr":  sum_df["OPEX EUR M/yr"].sum(),
        "Energy MWh/yr":  sum_df["Energy MWh/yr"].sum(),
    }
    sum_df = pd.concat([sum_df, pd.DataFrame([tot])], ignore_index=True)

    def _bold_total(row):
        return ["font-weight:bold;background-color:#e8f0fe" if row["Stage"] == "TOTAL"
                else ""] * len(row)

    st.dataframe(
        sum_df.style
              .apply(_bold_total, axis=1)
              .format({"CAPEX (EUR M)": "{:,.2f}", "OPEX EUR M/yr": "{:,.2f}",
                        "Energy MWh/yr": "{:,.0f}"}),
        use_container_width=True, hide_index=True,
    )
    c1, c2, c3 = st.columns(3)
    c1.metric("Total CAPEX",    f"EUR {tx['total_capex_eur']/1e6:.1f}M")
    c2.metric("Total OPEX/yr",  f"EUR {tx['total_opex_eur_yr']/1e6:.2f}M")
    c3.metric("Energy/yr",      f"{tx['total_energy_kwh_yr']/1e6:.1f}M kWh")
st.divider()

# ── Technology comparison (all options per stage) ─────────────────────────────
st.subheader("Compare All Technologies for a Stage")
compare_stage = st.selectbox("Stage:", list(TREATMENT_OPTIONS.keys()))
comp_rows = []
for tech_name, tech in TREATMENT_OPTIONS[compare_stage].items():
    flow_map2 = {
        "Pre-treatment": pt_flow, "Primary Treatment": wwt_flow,
        "Secondary Treatment": wwt_flow, "Tertiary Treatment": wwt_flow,
        "Concentrate Management": conc_flow, "ZLD (Zero Liquid Discharge)": conc_flow,
    }
    df2 = flow_map2.get(compare_stage, wwt_flow)
    comp_rows.append({
        "Technology":         tech_name,
        "Tier":               tech.get("tier", ""),
        "Description":        tech.get("description", ""),
        "CAPEX EUR/m3h":      tech.get("capex_eur_per_m3h", 0),
        "OPEX EUR/m3":        tech.get("opex_eur_per_m3", 0),
        "Energy kWh/m3":      tech.get("energy_kwh_m3", 0),
        "Total CAPEX (EUR M)": round(tech.get("capex_eur_per_m3h", 0) * df2 / 1e6, 2),
        "OPEX/yr (EUR M)":    round(tech.get("opex_eur_per_m3", 0) * df2 * hours / 1e6, 2),
        "Selected":           "YES" if tech_name == selected.get(compare_stage) else "",
    })
comp_df = pd.DataFrame(comp_rows)

def _hi_sel(row):
    return ["background-color:#d4edda" if row["Selected"] == "YES" else ""] * len(row)

st.dataframe(
    comp_df.style.apply(_hi_sel, axis=1)
           .format({"CAPEX EUR/m3h": "{:,.0f}", "OPEX EUR/m3": "{:.3f}",
                    "Energy kWh/m3": "{:.2f}", "Total CAPEX (EUR M)": "{:,.2f}",
                    "OPEX/yr (EUR M)": "{:,.2f}"}),
    use_container_width=True, hide_index=True,
)
