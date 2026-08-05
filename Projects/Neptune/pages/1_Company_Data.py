"""Page 1 – Company Data: water flow input, sources, contaminant concentrations, Excel import."""

import streamlit as st
import pandas as pd
import io, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.data_models import DEFAULT_PROCESSES, DEFAULT_CONTAMINANTS, DEFAULT_WATER_SOURCES

st.set_page_config(page_title="Company Data | Neptune", layout="wide")
st.title("📊 Company Data")
st.markdown("Define the plant water balance, source breakdown and contaminant concentrations.")
st.divider()

# Guard: Home must have initialised session state
if "initialized" not in st.session_state:
    st.warning("Please visit the **Home** page first to initialise the session.")
    st.stop()

if st.session_state.get("demo_data_active", False):
    st.success("Demo dataset is active (Bremen Steel Works profile).")
else:
    st.info("Custom dataset is active.")

# ── Company settings ──────────────────────────────────────────────────────────
with st.expander("🏭 Site Settings", expanded=True):
    c1, c2, c3 = st.columns(3)
    st.session_state.company_name = c1.text_input("Company / Plant Name",
                                                    st.session_state.company_name)
    st.session_state.site         = c2.text_input("Site / Location",
                                                    st.session_state.site)
    st.session_state.industry     = c3.text_input("Industry",
                                                    st.session_state.get("industry","Steel"))
    c4, c5, c6 = st.columns(3)
    st.session_state.operating_hours = c4.number_input(
        "Operating Hours / year", 1000, 8760, int(st.session_state.operating_hours))
    st.session_state.total_inlet_flow = c5.number_input(
        "Total Inlet Flow (m³/h)", 0.0, 1e6, float(st.session_state.total_inlet_flow), step=10.0)
    st.session_state.discharge_flow = c6.number_input(
        "Discharge to River (m³/h)", 0.0, 1e6, float(st.session_state.discharge_flow), step=10.0)

st.divider()

# ── Water source breakdown ────────────────────────────────────────────────────
st.subheader("Water Source Breakdown")
st.markdown("Enter the flow rate for each freshwater source (m³/h).")

src_df = pd.DataFrame(
    {"Source": list(st.session_state.water_sources.keys()),
     "Flow (m³/h)": list(st.session_state.water_sources.values())}
)
edited_src = st.data_editor(src_df, use_container_width=True, hide_index=True,
                             num_rows="fixed", key="src_editor",
                             column_config={"Flow (m³/h)": st.column_config.NumberColumn(min_value=0.0, format="%.2f")})
for _, row in edited_src.iterrows():
    st.session_state.water_sources[row["Source"]] = float(row["Flow (m³/h)"])

total_src = edited_src["Flow (m³/h)"].sum()
st.info(f"Total source flow: **{total_src:,.1f} m³/h** "
        f"(inlet set to {st.session_state.total_inlet_flow:,.1f} m³/h — adjust above if needed)")

st.divider()

# ── Process water balance ─────────────────────────────────────────────────────
st.subheader("Process Water Balance")
st.markdown("Edit flow-in, flow-out and leakage for each plant unit (m³/h).")

proc_rows = []
for name, p in st.session_state.processes.items():
    proc_rows.append({
        "Process Unit":   name,
        "Flow In (m³/h)": p["flow_in"],
        "Flow Out (m³/h)": p["flow_out"],
        "Leakage / Evap. (m³/h)": p["leakage"],
    })
proc_df = pd.DataFrame(proc_rows)

edited_proc = st.data_editor(
    proc_df, use_container_width=True, hide_index=True, num_rows="dynamic",
    key="proc_editor",
    column_config={
        "Flow In (m³/h)":           st.column_config.NumberColumn(format="%.2f"),
        "Flow Out (m³/h)":          st.column_config.NumberColumn(format="%.2f"),
        "Leakage / Evap. (m³/h)":   st.column_config.NumberColumn(format="%.2f"),
    },
)

# Persist edits
new_procs = {}
for _, row in edited_proc.iterrows():
    name = row["Process Unit"]
    if pd.notna(name) and str(name).strip():
        new_procs[str(name)] = {
            "flow_in":  float(row["Flow In (m³/h)"] or 0),
            "flow_out": float(row["Flow Out (m³/h)"] or 0),
            "leakage":  float(row["Leakage / Evap. (m³/h)"] or 0),
        }
if new_procs:
    st.session_state.processes = new_procs

total_in_proc  = edited_proc["Flow In (m³/h)"].sum()
total_out_proc = edited_proc["Flow Out (m³/h)"].sum()
total_leak     = edited_proc["Leakage / Evap. (m³/h)"].sum()

bal_cols = st.columns(3)
bal_cols[0].metric("Total Flow In",        f"{total_in_proc:,.1f} m³/h")
bal_cols[1].metric("Total Flow Out",       f"{total_out_proc:,.1f} m³/h")
bal_cols[2].metric("Net Leakage / Evap.", f"{total_leak:,.1f} m³/h",
                    delta=f"{total_leak/max(total_in_proc,1)*100:.1f} %",
                    delta_color="inverse")

st.divider()

# ── Contaminant concentrations ────────────────────────────────────────────────
st.subheader("Effluent Contaminant Concentrations by Process Unit")
st.markdown(
    "Enter the **effluent** (output) concentration of each pollutant for every process unit. "
    "These values drive the treatment technology recommendations and compliance checks. "
    "Select a process unit from the tabs below to edit its parameters, "
    "or use the **All Processes** tab for a full overview."
)

conc_state = st.session_state.contaminants

COMMON_PARAMS = [
    ("TSS",              "mg/L", "Total Suspended Solids"),
    ("COD",              "mg/L", "Chemical Oxygen Demand"),
    ("BOD",              "mg/L", "Biological Oxygen Demand"),
    ("Fe",               "mg/L", "Total Iron"),
    ("Zn",               "mg/L", "Zinc"),
    ("Oil / Grease",     "mg/L", "Oil and Grease"),
    ("NH4-N",            "mg/L", "Ammonium Nitrogen"),
    ("Heavy Metals",     "mg/L", "Combined heavy metals (Ni, Cr, Pb, Cd)"),
    ("pH",               "-",    "pH (dimensionless)"),
    ("Temperature",      "degC", "Effluent temperature"),
]

proc_names = list(st.session_state.processes.keys())
tab_labels = proc_names + ["All Processes"]
tabs = st.tabs(tab_labels)

new_conc = {k: dict(v) for k, v in conc_state.items()}

# Per-process tabs
for tab, proc in zip(tabs[:-1], proc_names):
    with tab:
        st.markdown(f"**Effluent quality from: {proc}**")
        params = new_conc.get(proc, {})

        # Build table with all COMMON_PARAMS, pre-filling existing values
        edit_rows = []
        for pname, punit, pdesc in COMMON_PARAMS:
            existing = params.get(pname, {})
            edit_rows.append({
                "Parameter":   pname,
                "Description": pdesc,
                "Value":       float(existing.get("value", 0.0)),
                "Unit":        existing.get("unit", punit),
                "Include":     pname in params,
            })
        edit_df = pd.DataFrame(edit_rows)
        edited = st.data_editor(
            edit_df, use_container_width=True, hide_index=True, num_rows="fixed",
            key=f"conc_{proc}",
            column_config={
                "Parameter":   st.column_config.TextColumn("Parameter", disabled=True, width="small"),
                "Description": st.column_config.TextColumn("Description", disabled=True, width="medium"),
                "Value":       st.column_config.NumberColumn("Value", format="%.2f", min_value=0.0),
                "Unit":        st.column_config.TextColumn("Unit", width="small"),
                "Include":     st.column_config.CheckboxColumn("Include", width="small",
                                                                help="Tick to include this parameter"),
            },
        )
        # Persist only ticked rows
        proc_conc = {}
        for _, row in edited.iterrows():
            if row["Include"] and str(row["Parameter"]).strip():
                proc_conc[str(row["Parameter"])] = {
                    "value": float(row["Value"] or 0),
                    "unit":  str(row["Unit"]),
                }
        # Also preserve any custom parameters not in COMMON_PARAMS
        for pname, meta in params.items():
            if pname not in [r[0] for r in COMMON_PARAMS]:
                proc_conc[pname] = meta
        new_conc[proc] = proc_conc

# All-processes overview tab
with tabs[-1]:
    st.markdown("**Overview of all process effluent concentrations (read-only summary)**")
    overview_rows = []
    for pname, _, _ in COMMON_PARAMS:
        row_data = {"Parameter": pname}
        for proc in proc_names:
            val = new_conc.get(proc, {}).get(pname, {})
            row_data[proc] = val.get("value", "") if val else ""
        overview_rows.append(row_data)
    ov_df = pd.DataFrame(overview_rows).set_index("Parameter")
    st.dataframe(ov_df, use_container_width=True)
    st.caption("Edit values in the per-process tabs above. Empty cells = parameter not measured / not applicable.")

st.session_state.contaminants = new_conc

# Build flat conc_df for export
conc_rows = []
for proc, params in new_conc.items():
    for param, meta in params.items():
        conc_rows.append({"Process Unit": proc, "Parameter": param,
                          "Value": meta["value"], "Unit": meta["unit"]})
conc_df = pd.DataFrame(conc_rows) if conc_rows else pd.DataFrame(
    columns=["Process Unit", "Parameter", "Value", "Unit"])

st.divider()

# ── Excel import / export ─────────────────────────────────────────────────────
st.subheader("Import / Export")
tab_imp, tab_exp = st.tabs(["📥 Import from Excel", "📤 Export to Excel"])

with tab_imp:
    st.markdown("Upload an Excel file with two sheets: **Processes** and **Concentrations**.")
    st.markdown("""
    **Processes** sheet columns: `Process Unit`, `Flow In (m³/h)`, `Flow Out (m³/h)`, `Leakage / Evap. (m³/h)`

    **Concentrations** sheet columns: `Process Unit`, `Parameter`, `Value`, `Unit`
    """)
    uploaded = st.file_uploader("Choose Excel file (.xlsx)", type=["xlsx"])
    if uploaded:
        try:
            xl = pd.ExcelFile(uploaded)
            if "Processes" in xl.sheet_names:
                df_p = xl.parse("Processes")
                new_p = {}
                for _, row in df_p.iterrows():
                    n = str(row.get("Process Unit", "")).strip()
                    if n:
                        new_p[n] = {
                            "flow_in":  float(row.get("Flow In (m³/h)", 0) or 0),
                            "flow_out": float(row.get("Flow Out (m³/h)", 0) or 0),
                            "leakage":  float(row.get("Leakage / Evap. (m³/h)", 0) or 0),
                        }
                if new_p:
                    st.session_state.processes = new_p
                    st.session_state.demo_data_active = False
                    st.success(f"Imported {len(new_p)} process rows.")
            if "Concentrations" in xl.sheet_names:
                df_c = xl.parse("Concentrations")
                new_c = {}
                for _, row in df_c.iterrows():
                    proc  = str(row.get("Process Unit", "")).strip()
                    param = str(row.get("Parameter", "")).strip()
                    if proc and param:
                        if proc not in new_c:
                            new_c[proc] = {}
                        new_c[proc][param] = {
                            "value": float(row.get("Value", 0) or 0),
                            "unit":  str(row.get("Unit", "mg/L")),
                        }
                if new_c:
                    st.session_state.contaminants = new_c
                    st.session_state.demo_data_active = False
                    st.success("Imported concentration data.")
        except Exception as e:
            st.error(f"Import error: {e}")

with tab_exp:
    st.markdown("Download current data as a ready-to-edit Excel workbook.")
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="xlsxwriter") as writer:
        proc_df.to_excel(writer, sheet_name="Processes", index=False)
        conc_df.to_excel(writer, sheet_name="Concentrations", index=False)
        edited_src.to_excel(writer, sheet_name="Water Sources", index=False)
    st.download_button(
        "⬇️ Download Excel",
        data=buf.getvalue(),
        file_name="neptune_company_data.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

st.divider()
if st.button("↺ Reset to Demo Data (Bremen Steel Works)"):
    st.session_state.processes     = {k: v.copy() for k, v in DEFAULT_PROCESSES.items()}
    st.session_state.contaminants  = {k: {c: d.copy() for c, d in v.items()}
                                       for k, v in DEFAULT_CONTAMINANTS.items()}
    st.session_state.water_sources = DEFAULT_WATER_SOURCES.copy()
    st.session_state.demo_data_active = True
    st.rerun()
