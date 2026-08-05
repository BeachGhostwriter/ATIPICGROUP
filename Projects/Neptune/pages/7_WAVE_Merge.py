"""
WAVE Merge — Neptune1 page
===========================
Drop this file into Neptune1's `pages/` folder (as `7_WAVE_Merge.py`) and
it appears in the sidebar alongside Company Data, Flow Diagram, etc.

This runs inside the same Streamlit process as Home.py, so it reads
st.session_state and utils.calculations.treatment_capex_opex directly --
no export/import round-trip needed (the neptune_export_snippet.py /
neptune_adapter.py JSON path is only for running the merge *outside*
Neptune1, e.g. on a schedule or in a separate script).

SETUP (one-time) -- see accompanying INTEGRATION.md for the full walkthrough:
1. Copy `pages/7_WAVE_Merge.py` (this file) into <Neptune1 folder>/pages/
2. Copy the whole `wave_merge/` folder into <Neptune1 folder>/wave_merge/
3. Restart Neptune1 (close and re-run launch_neptune.bat)
"""
import sys, os
_PAGES_DIR = os.path.dirname(__file__)
_NEPTUNE_ROOT = os.path.dirname(_PAGES_DIR)          # folder containing Home.py and utils/
sys.path.insert(0, _NEPTUNE_ROOT)                     # so `utils.*` imports work, same as Home.py
sys.path.insert(0, os.path.join(_NEPTUNE_ROOT, "wave_merge"))  # so `wave_merge.*` imports work

import streamlit as st
import streamlit.components.v1 as components

from wave_merge import wave_adapter, excel_cost_engine, merge_engine, report
from wave_merge.models import Neptune1SessionExport
from utils.data_models import TREATMENT_OPTIONS
from utils.calculations import treatment_capex_opex

st.set_page_config(page_title="WAVE Merge", layout="wide")
st.markdown("# WAVE ↔ Neptune1 Merge")
st.caption("Reconciles a DuPont WAVE / RO cost Excel against this session's live Neptune1 figures.")
st.divider()

if "total_inlet_flow" not in st.session_state:
    st.warning("Open Home.py first so Company Data / Treatment Solutions are populated, then come back here.")
    st.stop()

col1, col2 = st.columns(2)
with col1:
    wave_file = st.file_uploader(
        "WAVE Detailed Report export (Excel)", type=["xlsx"],
        help="Falls back to reading design figures from the cost Excel below if no WAVE export is uploaded.")
with col2:
    cost_file = st.file_uploader(
        "RO cost / chemical usage Excel (e.g. Calculation_BQ_..._master.xlsx)", type=["xlsx"])

if not cost_file:
    st.info("Upload the RO cost Excel to run the merge.")
    st.stop()

# The uploaded file needs to be read twice (design fields + cost fields);
# Streamlit's UploadedFile supports seek(0) between reads.
design_source = wave_file if wave_file else cost_file
design = wave_adapter.load_from_master_excel(design_source)
design_source.seek(0)
cost_file.seek(0)
costs = excel_cost_engine.load_chemical_costs(cost_file)

# Neptune1's own stage CAPEX/OPEX, computed with the exact same helper
# Home.py's _tx() calls -- imported directly rather than re-implemented.
try:
    tx = treatment_capex_opex(
        st.session_state.selected_treatments, TREATMENT_OPTIONS,
        st.session_state.total_inlet_flow, st.session_state.operating_hours,
        pretreatment_flow=st.session_state.pretreatment_flow_m3h,
        wwt_flow=st.session_state.wwt_flow_m3h,
        concentrate_flow=st.session_state.concentrate_flow_m3h,
    )
    stage_capex_opex = tx["detail"]
    total_opex_eur_yr = tx["total_opex_eur_yr"]
except Exception as e:
    st.warning(f"Could not compute Neptune1's stage CAPEX/OPEX ({e}). "
               f"Showing WAVE/Excel figures only; Blue Circle values will be skipped.")
    stage_capex_opex, total_opex_eur_yr = {}, 0.0

neptune = Neptune1SessionExport(
    company_name=st.session_state.company_name,
    site=st.session_state.site,
    country=st.session_state.selected_country,
    operating_hours=st.session_state.operating_hours,
    total_inlet_flow_m3h=st.session_state.total_inlet_flow,
    pretreatment_flow_m3h=st.session_state.pretreatment_flow_m3h,
    wwt_flow_m3h=st.session_state.wwt_flow_m3h,
    concentrate_flow_m3h=st.session_state.concentrate_flow_m3h,
    discharge_flow_m3h=st.session_state.discharge_flow,
    target_recycle_pct=st.session_state.target_recycle_pct,
    water_cost_eur_m3=st.session_state.water_cost_eur_m3,
    discharge_cost_eur_m3=st.session_state.discharge_cost_eur_m3,
    selected_treatments=st.session_state.selected_treatments,
    stage_capex_opex=stage_capex_opex,
    total_treatment_opex_eur_yr=total_opex_eur_yr,
    discharge_limits=st.session_state.get("discharge_limits", {}),
    source_file="live session_state",
) if stage_capex_opex else None

merged = merge_engine.merge(design, costs, neptune)

html = report.render(merged)
components.html(html, height=2400, scrolling=True)
