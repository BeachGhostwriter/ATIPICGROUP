"""Page 4 – Cost Estimation: SAP-coded cost table, import/export, running cost summary."""

import streamlit as st
import pandas as pd
import io, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.data_models import SAP_COST_CODES, TREATMENT_OPTIONS
from utils.calculations import treatment_capex_opex

st.set_page_config(page_title="Cost Estimation | Neptune", layout="wide")
st.title("💰 Cost Estimation")
st.markdown(
    "SAP-coded unit cost library. Edit values inline, import from Excel/CSV or export for budget review."
)
st.divider()

if "initialized" not in st.session_state:
    st.warning("Please visit the **Home** page first.")
    st.stop()

hours    = st.session_state.operating_hours
total_in = st.session_state.total_inlet_flow

# ── Cost rate settings ────────────────────────────────────────────────────────
with st.expander("🔧 Base Rate Settings", expanded=False):
    c1, c2, c3 = st.columns(3)
    st.session_state.water_cost_eur_m3 = c1.number_input(
        "Fresh Water Cost (€/m³)", 0.0, 10.0, st.session_state.water_cost_eur_m3, 0.01,
        format="%.3f")
    st.session_state.discharge_cost_eur_m3 = c2.number_input(
        "Discharge Permit Cost (€/m³)", 0.0, 10.0, st.session_state.discharge_cost_eur_m3, 0.01,
        format="%.3f")
    st.session_state.electricity_cost_eur_kwh = c3.number_input(
        "Electricity Cost (€/kWh)", 0.0, 1.0, st.session_state.electricity_cost_eur_kwh, 0.001,
        format="%.4f")

st.divider()

# ── SAP cost table ────────────────────────────────────────────────────────────
st.subheader("SAP Cost Code Library")
st.markdown(
    "All unit costs can be edited directly. Changes flow through to EBITDA and CapEx/OpEx pages."
)

sap_df = pd.DataFrame(st.session_state.sap_costs)
edited_sap = st.data_editor(
    sap_df,
    use_container_width=True,
    hide_index=True,
    num_rows="dynamic",
    key="sap_editor",
    column_config={
        "sap_code":    st.column_config.TextColumn("SAP Code", width="small"),
        "description": st.column_config.TextColumn("Description", width="large"),
        "unit":        st.column_config.TextColumn("Unit", width="medium"),
        "unit_cost":   st.column_config.NumberColumn("Unit Cost", format="%.4f", width="medium"),
    },
)

# Persist edits
new_sap = []
for _, row in edited_sap.iterrows():
    if pd.notna(row.get("sap_code")) and str(row["sap_code"]).strip():
        new_sap.append({
            "sap_code":    str(row["sap_code"]).strip(),
            "description": str(row.get("description", "")),
            "unit":        str(row.get("unit", "")),
            "unit_cost":   float(row.get("unit_cost", 0) or 0),
        })
if new_sap:
    st.session_state.sap_costs = new_sap

st.divider()

# ── Running cost calculator ───────────────────────────────────────────────────
st.subheader("Running Annual Cost Summary")

def get_cost(code):
    for row in st.session_state.sap_costs:
        if row["sap_code"] == code:
            return row["unit_cost"]
    return 0.0

intake_cost   = total_in * hours * get_cost("3100")
pre_cost      = total_in * hours * get_cost("3110")
pri_cost      = total_in * hours * get_cost("3120")
sec_cost      = total_in * hours * get_cost("3130")
ter_cost      = total_in * hours * get_cost("3140")
conc_cost     = total_in * hours * 0.15 * get_cost("3150")  # 15% of flow as concentrate
pump_cost     = total_in * hours * get_cost("3200")
ww_cost       = st.session_state.discharge_flow * hours * get_cost("7200")

elec_kw       = total_in * 0.35  # ~0.35 kWh/m³ average
elec_cost     = elec_kw * hours * get_cost("6100")
chem_cost     = total_in * hours * get_cost("6200")
sludge_t_yr   = total_in * hours * 0.001 / 1000  # ~1 kg/m³ sludge
sludge_cost   = sludge_t_yr * get_cost("3400")

total_opex = (intake_cost + pre_cost + pri_cost + sec_cost + ter_cost +
              conc_cost + pump_cost + ww_cost + elec_cost + chem_cost + sludge_cost)

cost_summary = pd.DataFrame([
    ("3100", "Raw Water Intake",          intake_cost),
    ("3110", "Pre-treatment",             pre_cost),
    ("3120", "Primary Treatment",         pri_cost),
    ("3130", "Secondary Treatment",       sec_cost),
    ("3140", "Tertiary Treatment",        ter_cost),
    ("3150", "Concentrate Management",    conc_cost),
    ("3200", "Pumping / Distribution",    pump_cost),
    ("7200", "Wastewater Discharge Permit", ww_cost),
    ("6100", "Electricity",               elec_cost),
    ("6200", "Chemicals",                 chem_cost),
    ("3400", "Sludge Disposal",           sludge_cost),
    ("—",    "TOTAL ANNUAL OPEX",         total_opex),
], columns=["SAP Code", "Cost Item", "Annual Cost (€)"])

def highlight_total(row):
    return ["font-weight:bold;background-color:#dce8f5" if row["SAP Code"] == "—" else ""] * 3

st.dataframe(
    cost_summary.style.apply(highlight_total, axis=1)
              .format({"Annual Cost (€)": "€{:,.0f}"}),
    use_container_width=True, hide_index=True,
)

st.info(f"**Total indicative annual OPEX: €{total_opex/1e6:.2f}M / year**  |  "
        f"Unit cost: €{total_opex/(total_in*hours):.3f} / m³")

st.divider()

# ── Treatment-technology-level cost roll-up ───────────────────────────────────
st.subheader("Technology OPEX Roll-Up (from Treatment Solutions page)")
tx = treatment_capex_opex(
    st.session_state.selected_treatments,
    TREATMENT_OPTIONS, total_in, hours,
    pretreatment_flow=st.session_state.get("pretreatment_flow_m3h", 2764.30),
    wwt_flow=st.session_state.get("wwt_flow_m3h", 2000.0),
    concentrate_flow=st.session_state.get("concentrate_flow_m3h", 300.0),
)
if tx["detail"]:
    tech_rows = []
    for stage, d in tx["detail"].items():
        tech_rows.append({
            "Stage": stage, "Technology": d["technology"],
            "CAPEX (€M)": round(d["capex_eur"]/1e6, 2),
            "OPEX €M/yr": round(d["opex_eur_yr"]/1e6, 3),
            "Energy kWh/yr (M)": round(d["energy_kwh_yr"]/1e6, 2),
            "Energy Cost €M/yr": round(d["energy_kwh_yr"] *
                                        get_cost("6100") / 1e6, 3),
        })
    tech_df = pd.DataFrame(tech_rows)
    st.dataframe(tech_df.style.format({
        "CAPEX (€M)": "{:,.2f}", "OPEX €M/yr": "{:,.3f}",
        "Energy kWh/yr (M)": "{:,.2f}", "Energy Cost €M/yr": "{:,.3f}",
    }), use_container_width=True, hide_index=True)
    st.metric("Combined Treatment CAPEX",
              f"€{tx['total_capex_eur']/1e6:.1f}M")
else:
    st.info("No treatment technologies selected — go to Treatment Solutions page.")

st.divider()

# ── Import / Export ───────────────────────────────────────────────────────────
st.subheader("Import / Export SAP Cost Table")
tab_imp, tab_exp = st.tabs(["📥 Import", "📤 Export"])

with tab_imp:
    st.markdown("Upload an Excel (.xlsx) or CSV file with columns: `sap_code`, `description`, `unit`, `unit_cost`")
    up = st.file_uploader("Choose file", type=["xlsx", "csv"], key="sap_upload")
    if up:
        try:
            if up.name.endswith(".csv"):
                df_imp = pd.read_csv(up)
            else:
                df_imp = pd.read_excel(up)
            needed = {"sap_code", "description", "unit", "unit_cost"}
            if needed.issubset(set(df_imp.columns)):
                st.session_state.sap_costs = df_imp[list(needed)].to_dict("records")
                st.success(f"Imported {len(st.session_state.sap_costs)} cost codes.")
                st.rerun()
            else:
                st.error(f"File must contain columns: {needed}")
        except Exception as e:
            st.error(f"Import error: {e}")

with tab_exp:
    buf = io.BytesIO()
    sap_df.to_excel(buf, index=False, engine="xlsxwriter")
    st.download_button(
        "⬇️ Download SAP Cost Table (Excel)",
        data=buf.getvalue(),
        file_name="neptune_sap_costs.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    csv_buf = sap_df.to_csv(index=False).encode()
    st.download_button(
        "⬇️ Download SAP Cost Table (CSV)",
        data=csv_buf,
        file_name="neptune_sap_costs.csv",
        mime="text/csv",
    )

st.divider()
if st.button("↺ Reset SAP Costs to Defaults"):
    st.session_state.sap_costs = [row.copy() for row in SAP_COST_CODES]
    st.rerun()
