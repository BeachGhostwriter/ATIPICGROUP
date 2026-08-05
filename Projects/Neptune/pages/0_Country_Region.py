"""Page 0 – Country & Region Setup: water stress, climate data, regulatory discharge limits."""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import io, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.country_data import (
    WATER_STRESS, CLIMATE_DATA, COUNTRY_LIMITS, ALL_COUNTRIES, stress_category,
)
from utils.water_forecast import build_water_availability_projection

st.set_page_config(page_title="Country & Region Setup | Neptune", layout="wide")

st.markdown("""
<style>
.js-plotly-plot text { text-shadow: none !important; filter: none !important; }
</style>
""", unsafe_allow_html=True)

st.title("Country & Region Setup")
st.markdown(
    "Select the country where the facility is located. "
    "The platform loads the applicable **regulatory discharge limits** and displays "
    "**water stress, soil moisture and climate data** for the region. "
    "All limits can be edited inline or replaced by uploading your own data."
)
st.divider()

if "initialized" not in st.session_state:
    st.warning("Please visit the Home page first to initialise the session.")
    st.stop()

# ── Country selector ──────────────────────────────────────────────────────────
col_sel, col_ind, col_sub = st.columns([2, 2, 2])

current_country = st.session_state.get("selected_country", "Germany")
if current_country not in ALL_COUNTRIES:
    current_country = "Germany"

selected_country = col_sel.selectbox(
    "Client country / jurisdiction",
    ALL_COUNTRIES,
    index=ALL_COUNTRIES.index(current_country),
)
st.session_state.selected_country = selected_country

industry_type = col_ind.selectbox(
    "Industry sector",
    ["Integrated Steel Plant", "Mini Mill / EAF Steel", "Non-ferrous Metals",
     "Chemical / Petrochemical", "Food & Beverage", "Pulp & Paper",
     "Mining & Minerals", "Power Generation", "Pharmaceutical", "Other"],
    index=0,
)
st.session_state.industry = industry_type

col_sub.markdown("&nbsp;")   # spacer
col_sub.markdown("&nbsp;")
if col_sub.button("Apply country limits to Treatment Solutions page"):
    limit_data = COUNTRY_LIMITS.get(selected_country, COUNTRY_LIMITS["(Custom / Not Listed)"])
    limits_flat = {}
    for param, meta in limit_data["parameters"].items():
        raw = meta["limit"]
        try:
            limits_flat[param] = float(str(raw).replace("–", "-").split("-")[1]
                                        if "-" in str(raw) else raw)
        except Exception:
            limits_flat[param] = None
    st.session_state.discharge_limits = limits_flat
    st.session_state.discharge_limits_raw = limit_data["parameters"]
    st.success(f"Discharge limits for {selected_country} applied to Treatment Solutions page.")

st.divider()

# ── Water stress gauge and climate panel ─────────────────────────────────────
stress_score = WATER_STRESS.get(selected_country, 2.0)
stress_label, stress_color = stress_category(stress_score)
climate      = CLIMATE_DATA.get(selected_country, {})

st.subheader(f"Water Stress & Climate — {selected_country}")

g1, g2, g3, g4, g5 = st.columns(5)
g1.metric("Water Stress Index", f"{stress_score:.2f} / 5.00",
          delta=stress_label, delta_color="off")
g2.metric("Annual Precipitation",
          f"{climate.get('precip_mm', 'N/A')} mm/yr" if climate else "N/A")
g3.metric("Mean Soil Moisture",
          f"{climate.get('soil_moisture_pct', 'N/A')} %" if climate else "N/A")
g4.metric("Groundwater Depletion",
          climate.get("groundwater_depletion", "N/A") if climate else "N/A")
g5.metric("Drought Risk",
          climate.get("drought_risk", "N/A") if climate else "N/A")

# Stress gauge
fig_gauge = go.Figure(go.Indicator(
    mode="gauge+number+delta",
    value=stress_score,
    delta={"reference": 2.5, "valueformat": ".2f",
           "increasing": {"color": "#d73027"}, "decreasing": {"color": "#1a9850"}},
    number={"suffix": " / 5", "font": {"size": 36, "family": "Arial, sans-serif"}},
    title={"text": f"Water Stress Index<br><span style='font-size:14px'>{stress_label}</span>",
           "font": {"size": 16, "family": "Arial, sans-serif"}},
    gauge={
        "axis": {"range": [0, 5], "tickwidth": 1, "tickfont": {"size": 12}},
        "bar":  {"color": stress_color, "thickness": 0.3},
        "steps": [
            {"range": [0, 1],   "color": "#d4edda"},
            {"range": [1, 2],   "color": "#d4f5e9"},
            {"range": [2, 3],   "color": "#fff3cd"},
            {"range": [3, 4],   "color": "#fde8d8"},
            {"range": [4, 5],   "color": "#f8d7da"},
        ],
        "threshold": {"line": {"color": "#333", "width": 3},
                      "thickness": 0.8, "value": stress_score},
    },
))
fig_gauge.update_layout(
    height=300, margin=dict(l=30, r=30, t=60, b=20),
    font=dict(family="Arial, sans-serif", size=13),
    paper_bgcolor="white",
)

# Regional comparison bar chart
region_scores = sorted(WATER_STRESS.items(), key=lambda x: x[1], reverse=True)
region_countries = [c for c, _ in region_scores]
region_vals      = [v for _, v in region_scores]
bar_colors = [stress_category(v)[1] for v in region_vals]
sel_idx = region_countries.index(selected_country) if selected_country in region_countries else 0

fig_bar = go.Figure(go.Bar(
    x=region_countries, y=region_vals,
    marker_color=bar_colors,
    text=[f"{v:.1f}" for v in region_vals],
    textposition="outside",
    textfont=dict(size=10),
))
fig_bar.add_hline(y=stress_score, line_dash="dash", line_color="#333", line_width=2,
                   annotation_text=f"{selected_country}: {stress_score:.2f}",
                   annotation_font_size=12)
fig_bar.update_layout(
    title=dict(text="Water Stress Index — Global Country Comparison",
               font=dict(size=15, family="Arial, sans-serif")),
    height=340,
    margin=dict(l=20, r=20, t=50, b=80),
    xaxis=dict(tickangle=-45, tickfont=dict(size=10)),
    yaxis=dict(title="Water Stress (0-5)", range=[0, 5.3], gridcolor="#eeeeee"),
    font=dict(family="Arial, sans-serif", size=12, color="#1a1a2e"),
    paper_bgcolor="white",
    plot_bgcolor="white",
    showlegend=False,
)

col_gauge, col_cmp = st.columns([1, 3])
with col_gauge:
    st.plotly_chart(fig_gauge, use_container_width=True)
    st.markdown(
        f"""
        <div style="background:{stress_color}22;border-left:4px solid {stress_color};
        padding:10px;border-radius:6px;font-size:13px">
        <b>Category: {stress_label}</b><br>
        Score: {stress_score:.2f} / 5.00<br><br>
        {'⚠️ High competition for available freshwater. Water recycling is critical.' if stress_score > 3
         else ('Moderate water stress — recycling improves resilience.' if stress_score > 2
               else 'Lower water stress — operational efficiency still improves sustainability.')
        }
        </div>
        """, unsafe_allow_html=True,
    )
with col_cmp:
    st.plotly_chart(fig_bar, use_container_width=True)

st.divider()

# 10-year hydrology projection
st.subheader("10-Year Hydrology Prognosis")
projection_df = build_water_availability_projection(selected_country, years=10)

fig_proj = go.Figure()
fig_proj.add_trace(
    go.Scatter(
        x=projection_df["Year"],
        y=projection_df["River Level Index"],
        mode="lines+markers",
        name="River level index",
        line=dict(color="#1d4ed8", width=2),
    )
)
fig_proj.add_trace(
    go.Scatter(
        x=projection_df["Year"],
        y=projection_df["Aquifer Level Index"],
        mode="lines+markers",
        name="Aquifer level index",
        line=dict(color="#0f766e", width=2),
    )
)
fig_proj.add_trace(
    go.Scatter(
        x=projection_df["Year"],
        y=projection_df["Water Availability Index"],
        mode="lines",
        name="Combined availability index",
        line=dict(color="#f59e0b", width=2, dash="dash"),
    )
)
fig_proj.update_layout(
    title="Modeled river and aquifer outlook with combined availability",
    height=360,
    margin=dict(l=20, r=20, t=45, b=20),
    yaxis_title="Index",
    xaxis_title="Year",
    paper_bgcolor="white",
    plot_bgcolor="white",
    font=dict(family="Arial, sans-serif", size=12),
)
st.plotly_chart(fig_proj, use_container_width=True)

rain_avg = projection_df["Average Rainfall (mm)"].mean()
st.caption(
    f"Projected average rainfall across the horizon: {rain_avg:.0f} mm/year. "
    "This forecast is an indicator model based on stress, drought and climate baselines."
)

# Copernicus reference panel
with st.expander("Copernicus Satellite Data Reference", expanded=False):
    st.markdown("""
    **Copernicus Global Land Service (CGLS)** provides open-access satellite-derived indicators
    for water and soil monitoring:

    | Product | Description | Resolution | Update |
    |---|---|---|---|
    | **SWI** — Soil Water Index | Surface and root-zone soil moisture (0-100) | 1 km | Daily |
    | **FAPAR** — Fraction Absorbed PAR | Vegetation health proxy for drought stress | 300 m | 10-day |
    | **LST** — Land Surface Temperature | Heat stress / evaporation indicator | 1 km | Daily |
    | **Albedo** | Surface reflectance — snow/ice cover | 300 m | 10-day |
    | **NDVI** | Vegetation greenness — drought impact | 300 m | 10-day |

    **Access:** [land.copernicus.eu](https://land.copernicus.eu/global/products/swi) *(open access, free registration)*

    **Copernicus Climate Data Store (CDS):** Monthly/seasonal soil moisture, precipitation and
    evapotranspiration datasets for any location:
    [cds.climate.copernicus.eu](https://cds.climate.copernicus.eu)

    **Aqueduct Water Risk Atlas (WRI):** Country and basin-level water stress, drought risk
    and groundwater depletion scores used in this platform:
    [wri.org/aqueduct](https://www.wri.org/aqueduct)

    *Note: Live satellite API integration requires a Copernicus CDS API key.
    Contact Blue Circle to enable real-time regional data pull for a specific site.*
    """)

st.divider()

# ── Regulatory discharge limits ───────────────────────────────────────────────
st.subheader(f"Regulatory Discharge Limits — {selected_country}")

limit_data = COUNTRY_LIMITS.get(selected_country, COUNTRY_LIMITS["(Custom / Not Listed)"])
st.markdown(
    f"**Authority:** {limit_data['authority']}  \n"
    f"**Standard:** {limit_data['standard']}"
)

# Build editable table
limit_rows = []
for param, meta in limit_data["parameters"].items():
    limit_rows.append({
        "Parameter":    param,
        "Max. Limit":   str(meta["limit"]),
        "Unit":         meta["unit"],
        "Notes / Basis": meta.get("notes", ""),
    })
limit_df = pd.DataFrame(limit_rows)

st.markdown("**Edit values below** if site-specific permit conditions differ from national defaults:")
edited_limits = st.data_editor(
    limit_df, use_container_width=True, hide_index=True, num_rows="dynamic",
    key="limits_editor",
    column_config={
        "Parameter":    st.column_config.TextColumn("Parameter", width="small"),
        "Max. Limit":   st.column_config.TextColumn("Max. Limit", width="small",
                                                     help="Numeric value or range e.g. 6-9 for pH"),
        "Unit":         st.column_config.TextColumn("Unit", width="small"),
        "Notes / Basis": st.column_config.TextColumn("Notes / Basis", width="large"),
    },
)

# Persist custom edits
custom_limits = {}
for _, row in edited_limits.iterrows():
    param = str(row["Parameter"]).strip()
    if param:
        raw = str(row["Max. Limit"]).strip()
        try:
            num_val = float(raw.split("-")[-1] if "-" in raw and not raw.startswith("-") else raw)
        except ValueError:
            num_val = None
        custom_limits[param] = {
            "limit":  raw,
            "unit":   str(row["Unit"]),
            "notes":  str(row["Notes / Basis"]),
            "_numeric": num_val,
        }
st.session_state.discharge_limits_raw  = custom_limits
st.session_state.discharge_limits      = {
    k: v["_numeric"] for k, v in custom_limits.items() if v["_numeric"] is not None
}

st.divider()

# ── Upload custom limits ───────────────────────────────────────────────────────
st.subheader("Upload Custom Discharge Limits")
st.markdown(
    "Upload an Excel (.xlsx) or CSV file with columns: "
    "`Parameter`, `Max. Limit`, `Unit`, `Notes / Basis`. "
    "This will override the national defaults above."
)
tab_up, tab_dl = st.tabs(["Upload limits", "Download template"])

with tab_up:
    up_file = st.file_uploader("Choose file", type=["xlsx", "csv"], key="limits_upload")
    if up_file:
        try:
            if up_file.name.endswith(".csv"):
                df_up = pd.read_csv(up_file)
            else:
                df_up = pd.read_excel(up_file)
            needed = {"Parameter", "Max. Limit", "Unit"}
            if needed.issubset(set(df_up.columns)):
                new_limits = {}
                for _, row in df_up.iterrows():
                    param = str(row.get("Parameter", "")).strip()
                    if param:
                        raw = str(row.get("Max. Limit", "")).strip()
                        try:
                            num = float(raw.split("-")[-1] if "-" in raw and not raw.startswith("-") else raw)
                        except ValueError:
                            num = None
                        new_limits[param] = {
                            "limit": raw, "unit": str(row.get("Unit", "mg/L")),
                            "notes": str(row.get("Notes / Basis", "")), "_numeric": num,
                        }
                st.session_state.discharge_limits_raw = new_limits
                st.session_state.discharge_limits     = {
                    k: v["_numeric"] for k, v in new_limits.items() if v["_numeric"] is not None
                }
                st.success(f"Uploaded {len(new_limits)} discharge limit parameters.")
                st.rerun()
            else:
                st.error(f"File must contain columns: {needed}")
        except Exception as e:
            st.error(f"Upload error: {e}")

with tab_dl:
    template_df = limit_df.copy()
    buf = io.BytesIO()
    template_df.to_excel(buf, index=False, engine="xlsxwriter")
    st.download_button(
        "Download current limits as Excel template",
        data=buf.getvalue(),
        file_name=f"neptune_discharge_limits_{selected_country.replace(' ', '_')}.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

st.divider()

# ── Summary card ─────────────────────────────────────────────────────────────
n_limits = len(st.session_state.get("discharge_limits", {}))
st.info(
    f"**{selected_country}** — Water Stress: **{stress_score:.2f}/5 ({stress_label})** | "
    f"Precipitation: **{climate.get('precip_mm', 'N/A')} mm/yr** | "
    f"Soil Moisture: **{climate.get('soil_moisture_pct', 'N/A')} %** | "
    f"Active discharge limits: **{n_limits} parameters**  \n"
    f"Limits are used automatically in the **Treatment Solutions** compliance check."
)
