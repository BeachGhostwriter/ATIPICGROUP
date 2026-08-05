"""Neptune Water Intelligence Platform — Home / Overview."""

import streamlit as st
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
import sys, os
import hashlib
import hmac
import psycopg2
sys.path.insert(0, os.path.dirname(__file__))

from utils.data_models import (
    DEFAULT_PROCESSES, DEFAULT_CONTAMINANTS, TREATMENT_OPTIONS,
    SAP_COST_CODES, RECOVERED_MATERIALS, DEFAULT_WATER_SOURCES, DEFAULT_SETTINGS,
)
from utils.calculations import (
    annual_water_costs, recommend_treatments, treatment_capex_opex,
    material_recovery_revenue, ebitda_bridge, simple_payback,
)
from utils.water_forecast import (
    build_water_availability_projection,
    build_compliance_timeline,
)

st.set_page_config(
    page_title="Neptune Water Intelligence",
    page_icon="",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Remove SVG text shadows from Plotly charts
st.markdown("""
<style>
.js-plotly-plot text { text-shadow: none !important; filter: none !important; }
.plot-container text { text-shadow: none !important; }
</style>
""", unsafe_allow_html=True)

NEPTUNE_LOGIN_KEY = "neptune_authenticated"
NEPTUNE_USER_KEY = "neptune_user"


def _password_matches(password: str, stored: str) -> bool:
    salt, hash_hex = (stored or "").split(":", 1) if ":" in (stored or "") else (None, None)
    if not salt or not hash_hex:
        return False
    candidate = hashlib.scrypt(password.encode("utf-8"), salt=salt.encode("utf-8"), n=16384, r=8, p=1, dklen=64)
    return hmac.compare_digest(candidate.hex(), hash_hex)


def _verify_neptune_user(email: str, password: str):
    dsn = os.getenv("NEPTUNE_DATABASE_URL") or os.getenv("Neptune_database_url") or ""
    if not dsn:
        return None, "Neptune database is not configured."

    try:
        with psycopg2.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT email, name, password_hash FROM neptune_users WHERE lower(email) = lower(%s)",
                    (email,),
                )
                row = cur.fetchone()
    except Exception:
        return None, "Unable to reach the Neptune database."

    if not row:
        return None, "Invalid email or password."

    stored_hash = row[2]
    if not _password_matches(password, stored_hash):
        return None, "Invalid email or password."

    return {
        "email": row[0],
        "name": row[1] or row[0],
        "role": "viewer",
    }, None


if not st.session_state.get(NEPTUNE_LOGIN_KEY):
    st.title("Neptune Water Intelligence")
    st.markdown("Secure login for the Neptune Streamlit application backed by a separate Neon database.")
    with st.form("neptune_login_form"):
        login_email = st.text_input("Email", placeholder="your@email.com")
        login_password = st.text_input("Password", type="password")
        submitted = st.form_submit_button("Sign in")
    if submitted:
        login_identifier = login_email.strip()
        user, error = _verify_neptune_user(login_identifier, login_password)
        if user:
            st.session_state[NEPTUNE_LOGIN_KEY] = True
            st.session_state[NEPTUNE_USER_KEY] = user
            st.rerun()
        st.error(error or "Sign in failed.")
    st.stop()

# ── Session state bootstrap ───────────────────────────────────────────────────
def _init():
    if "initialized" in st.session_state:
        return
    st.session_state.initialized = True
    for k, v in DEFAULT_SETTINGS.items():
        st.session_state[k] = v
    st.session_state.processes      = {k: v.copy() for k, v in DEFAULT_PROCESSES.items()}
    st.session_state.contaminants   = {k: {c: d.copy() for c, d in v.items()}
                                        for k, v in DEFAULT_CONTAMINANTS.items()}
    st.session_state.water_sources  = DEFAULT_WATER_SOURCES.copy()
    st.session_state.sap_costs      = [row.copy() for row in SAP_COST_CODES]
    st.session_state.selected_treatments = recommend_treatments(
        DEFAULT_CONTAMINANTS, target_reuse=True)
    st.session_state.capex_profile          = "front-loaded"
    st.session_state.budget_capex           = {}
    st.session_state.budget_opex            = {}
    st.session_state.pretreatment_flow_m3h  = DEFAULT_SETTINGS["pretreatment_flow_m3h"]
    st.session_state.wwt_flow_m3h           = DEFAULT_SETTINGS["wwt_flow_m3h"]
    st.session_state.concentrate_flow_m3h   = DEFAULT_SETTINGS["concentrate_flow_m3h"]
    st.session_state.open_box               = None   # Grey / Blue / Brown / Red
    st.session_state.demo_data_active       = True
    st.session_state.selected_country       = "Germany"
    # Seed with EU/Germany limits by default
    from utils.country_data import COUNTRY_LIMITS
    _de = COUNTRY_LIMITS.get("Germany", {}).get("parameters", {})
    st.session_state.discharge_limits_raw   = _de
    st.session_state.discharge_limits       = {
        k: float(str(v["limit"]).split("-")[-1]) if "-" in str(v["limit"])
           else (float(v["limit"]) if str(v["limit"]).replace(".","").isdigit() else None)
        for k, v in _de.items()
    }

_init()

# ── Helpers ───────────────────────────────────────────────────────────────────
def _tx():
    return treatment_capex_opex(
        st.session_state.selected_treatments, TREATMENT_OPTIONS,
        st.session_state.total_inlet_flow, st.session_state.operating_hours,
        pretreatment_flow=st.session_state.pretreatment_flow_m3h,
        wwt_flow=st.session_state.wwt_flow_m3h,
        concentrate_flow=st.session_state.concentrate_flow_m3h,
    )

def _costs():
    return annual_water_costs(
        st.session_state.processes,
        st.session_state.water_cost_eur_m3,
        st.session_state.discharge_cost_eur_m3,
        st.session_state.operating_hours,
        st.session_state.total_inlet_flow,
        st.session_state.discharge_flow,
    )

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("### Neptune Platform")
    current_user = st.session_state.get(NEPTUNE_USER_KEY, {})
    if current_user:
        st.caption(
            f"Signed in as {current_user.get('email', 'Neptune user')} "
            f"({current_user.get('role', 'viewer')})"
        )
        if st.button("Sign out"):
            st.session_state.pop(NEPTUNE_LOGIN_KEY, None)
            st.session_state.pop(NEPTUNE_USER_KEY, None)
            st.rerun()
    if st.session_state.get("demo_data_active", False):
        st.success("Demo data profile is active")
    st.markdown(f"**{st.session_state.company_name}**")
    st.markdown(f"*{st.session_state.site}*")
    st.markdown("---")
    st.markdown("Use the pages in the sidebar to navigate modules.")
    if st.session_state.open_box:
        st.markdown("---")
        if st.button("Return to Overview"):
            st.session_state.open_box = None
            st.rerun()

# ──────────────────────────────────────────────────────────────────────────────
# BOX DETAIL VIEWS
# ──────────────────────────────────────────────────────────────────────────────
def _return_btn():
    if st.button("← Return to Overview", type="secondary"):
        st.session_state.open_box = None
        st.rerun()

def show_grey_box():
    _return_btn()
    st.markdown("## Prefiltration — Grey Box Value Creation")
    st.markdown(
        "The Grey Box covers **supply-side pre-treatment**: preparing raw water before it "
        "enters the production facility. It protects downstream membranes, heat exchangers "
        "and process equipment from fouling, scaling and corrosion damage."
    )
    st.divider()

    hours   = st.session_state.operating_hours
    pt_flow = st.session_state.pretreatment_flow_m3h
    tx      = _tx()
    pt_det  = tx["detail"].get("Pre-treatment", {})
    tech    = st.session_state.selected_treatments.get("Pre-treatment", "—")
    tech_data = TREATMENT_OPTIONS.get("Pre-treatment", {}).get(tech, {})
    removal   = tech_data.get("removal", {})

    # Contaminant load removed
    concs = {"TSS": 80, "Fe": 20, "Oil": 5}  # mg/L typical supply water
    rem_rows = []
    for pollutant, conc_in in concs.items():
        eff = removal.get(pollutant, 0.0)
        mass_in   = conc_in / 1e6 * 1e3 * pt_flow * hours / 1e3   # tonnes/yr
        mass_out  = mass_in * (1 - eff)
        mass_rem  = mass_in * eff
        rem_rows.append({
            "Pollutant":             pollutant,
            "Inlet conc. (mg/L)":    conc_in,
            "Removal efficiency (%)": round(eff * 100),
            "Outlet conc. (mg/L)":   round(conc_in * (1 - eff), 1),
            "Mass removed (t/yr)":   round(mass_rem, 1),
        })
    rem_df = pd.DataFrame(rem_rows)

    capex = pt_det.get("capex_eur", 0)
    opex  = pt_det.get("opex_eur_yr", 0)
    # Avoided fouling: empirically ~2-4x OPEX per year in avoided maintenance
    avoided_fouling = opex * 2.5
    net_benefit = avoided_fouling - opex

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Design Flow",       f"{pt_flow:,.0f} m3/h")
    c2.metric("Technology",        tech)
    c3.metric("CAPEX",             f"EUR {capex/1e6:.1f}M")
    c4.metric("OPEX / year",       f"EUR {opex/1e6:.2f}M")

    st.subheader("Contaminant Removal Performance")
    st.dataframe(rem_df.style.format({
        "Inlet conc. (mg/L)": "{:.0f}", "Removal efficiency (%)": "{:.0f}",
        "Outlet conc. (mg/L)": "{:.1f}", "Mass removed (t/yr)": "{:,.1f}",
    }), use_container_width=True, hide_index=True)

    st.subheader("Value Creation Calculation")
    val_df = pd.DataFrame([
        ("OPEX (pre-treatment operations)",           -opex,          "Annual cost"),
        ("Avoided equipment fouling / maintenance",    avoided_fouling,"Estimated 2.5x OPEX saving"),
        ("Extended membrane/HX lifetime benefit",      capex * 0.05,  "5% of CAPEX avoided per yr"),
        ("Net annual Grey Box value",                  net_benefit + capex*0.05, ""),
    ], columns=["Item", "EUR/yr", "Note"])
    st.dataframe(val_df.style.format({"EUR/yr": "EUR {:,.0f}"}), use_container_width=True, hide_index=True)

    st.info(
        f"Pre-treating {pt_flow:,.0f} m3/h removes ~{rem_df['Mass removed (t/yr)'].sum():,.0f} t/yr "
        f"of solids and foulants, protecting the downstream treatment train worth "
        f"EUR {capex/1e6:.1f}M of capital investment."
    )


def show_blue_box():
    _return_btn()
    st.markdown("## Water Recycle — Blue Box Value Creation")
    st.markdown(
        "The Blue Box is the **core water recycling loop**: treating process wastewater to a "
        "quality that allows it to re-enter the plant as process water or cooling water, "
        "drastically cutting freshwater intake and discharge permit costs."
    )
    st.divider()

    hours          = st.session_state.operating_hours
    total_in       = st.session_state.total_inlet_flow
    wwt_flow       = st.session_state.wwt_flow_m3h
    recycle_pct    = st.session_state.target_recycle_pct
    w_cost         = st.session_state.water_cost_eur_m3
    d_cost         = st.session_state.discharge_cost_eur_m3
    tx             = _tx()
    costs          = _costs()

    volume_recycled_m3yr = total_in * (recycle_pct / 100) * hours
    water_saving         = volume_recycled_m3yr * w_cost
    discharge_saving     = st.session_state.discharge_flow * (recycle_pct / 100) * 0.60 * hours * d_cost

    # CAPEX/OPEX for secondary + tertiary (the recycle stages)
    recycle_stages = ["Secondary Treatment", "Tertiary Treatment"]
    recycle_capex  = sum(tx["detail"].get(s, {}).get("capex_eur", 0)     for s in recycle_stages)
    recycle_opex   = sum(tx["detail"].get(s, {}).get("opex_eur_yr", 0)   for s in recycle_stages)
    net_benefit    = water_saving + discharge_saving - recycle_opex
    pb             = simple_payback(recycle_capex, net_benefit) if net_benefit > 0 else float("inf")

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Recycling Target",    f"{recycle_pct:.0f} %")
    c2.metric("Volume Recycled",     f"{volume_recycled_m3yr/1e6:.1f} Mm3/yr")
    c3.metric("CAPEX (recycle stages)", f"EUR {recycle_capex/1e6:.1f}M")
    c4.metric("Simple Payback",      f"{pb:.1f} yrs" if pb < 50 else "> 50 yrs")

    st.subheader("Annual Value Creation Calculation")
    val_df = pd.DataFrame([
        ("Reduced freshwater intake",   water_saving,    f"{volume_recycled_m3yr/1e6:.1f} Mm3/yr x EUR {w_cost}/m3"),
        ("Reduced discharge permit",    discharge_saving, f"60% discharge reduction at EUR {d_cost}/m3"),
        ("Treatment OPEX (secondary + tertiary)", -recycle_opex, "Annual operating cost"),
        ("NET Blue Box annual value",   net_benefit,     ""),
    ], columns=["Item", "EUR/yr", "Basis"])
    st.dataframe(val_df.style.format({"EUR/yr": "EUR {:,.0f}"}), use_container_width=True, hide_index=True)

    st.subheader("Sensitivity: Savings vs Recycling Rate")
    import numpy as np
    import plotly.express as px
    rr_range = np.arange(10, 96, 5)
    rows_s = []
    for rr in rr_range:
        ws = total_in * (rr / 100) * hours * w_cost
        ds = st.session_state.discharge_flow * (rr / 100) * 0.60 * hours * d_cost
        rows_s.append({"Recycling Rate (%)": rr,
                        "Freshwater Saving (EURm)": ws / 1e6,
                        "Discharge Saving (EURm)": ds / 1e6,
                        "Net (after OPEX) (EURm)": (ws + ds - recycle_opex) / 1e6})
    sens_df = pd.DataFrame(rows_s)
    fig_s = px.line(sens_df, x="Recycling Rate (%)",
                    y=["Freshwater Saving (EURm)", "Discharge Saving (EURm)", "Net (after OPEX) (EURm)"],
                    title="Blue Box savings vs recycling rate",
                    color_discrete_sequence=["#4a90d9", "#2ea44f", "#e8820c"])
    fig_s.add_hline(y=0, line_dash="dash", line_color="red")
    fig_s.add_vline(x=recycle_pct, line_dash="dot", line_color="green",
                    annotation_text=f"Target: {recycle_pct:.0f}%",
                    annotation_font_size=13)
    fig_s.update_layout(height=380, font=dict(family="Arial, sans-serif", size=13),
                         paper_bgcolor="white", yaxis_tickprefix="EUR ")
    st.plotly_chart(fig_s, use_container_width=True)


def show_brown_box():
    _return_btn()
    st.markdown("## Waste Recovery — Brown Box Value Creation")
    st.markdown(
        "The Brown Box converts **waste streams into secondary raw materials**: zinc, iron oxide, "
        "oil/emulsion, acid/iron chloride from various plant processes. These streams would otherwise "
        "be disposal liabilities; with the right treatment they become revenue streams."
    )
    st.divider()

    hours    = st.session_state.operating_hours
    mat_rev  = material_recovery_revenue(RECOVERED_MATERIALS, st.session_state.processes, hours)
    tx       = _tx()
    conc_capex = tx["detail"].get("Concentrate Management", {}).get("capex_eur", 0)
    conc_opex  = tx["detail"].get("Concentrate Management", {}).get("opex_eur_yr", 0)

    st.subheader("Recoverable Material Streams")
    mat_rows = []
    for mat, v in mat_rev.items():
        mat_rows.append({
            "Material":         mat,
            f"Qty ({v['unit']})": v["quantity_yr"],
            "Revenue (EUR/yr)": v["revenue_eur_yr"],
        })
    total_rev = sum(v["revenue_eur_yr"] for v in mat_rev.values())
    mat_df = pd.DataFrame(mat_rows)
    st.dataframe(mat_df.style.format({"Revenue (EUR/yr)": "EUR {:,.0f}"}),
                 use_container_width=True, hide_index=True)

    st.subheader("Value Creation Calculation")
    net_brown = total_rev - conc_opex
    val_df = pd.DataFrame([
        ("Total material recovery revenue",          total_rev,  "Zinc, Fe, oil, acid streams"),
        ("Concentrate management OPEX",              -conc_opex, "Crystallisation / MEE operations"),
        ("Avoided disposal / hazardous waste cost",  conc_opex * 0.40, "~40% of OPEX as avoided disposal"),
        ("NET Brown Box annual value",               net_brown + conc_opex * 0.40, ""),
    ], columns=["Item", "EUR/yr", "Note"])
    st.dataframe(val_df.style.format({"EUR/yr": "EUR {:,.0f}"}), use_container_width=True, hide_index=True)

    c1, c2, c3 = st.columns(3)
    c1.metric("Total Material Revenue",   f"EUR {total_rev/1e6:.2f}M/yr")
    c2.metric("Concentrate CAPEX",        f"EUR {conc_capex/1e6:.1f}M")
    c3.metric("Net Value (after OPEX)",   f"EUR {(total_rev-conc_opex)/1e6:.2f}M/yr")

    st.subheader("Material Value Breakdown")
    import plotly.express as px
    if mat_rows:
        fig_pie = px.pie(mat_df, names="Material", values="Revenue (EUR/yr)",
                         title="Material Recovery Revenue Split",
                         color_discrete_sequence=px.colors.qualitative.Set2)
        fig_pie.update_traces(textfont_size=13, textinfo="label+percent")
        fig_pie.update_layout(font=dict(family="Arial, sans-serif", size=13),
                               paper_bgcolor="white", height=380)
        st.plotly_chart(fig_pie, use_container_width=True)

    st.info(
        "Recovered materials displace primary raw material purchases and eliminate hazardous waste "
        "disposal costs — turning an environmental liability into a circular economy asset."
    )


def show_red_box():
    _return_btn()
    st.markdown("## Emergency & Compliance — Red Box Value Creation")
    st.markdown(
        "The Red Box provides **emergency treatment capacity and regulatory compliance assurance**: "
        "a safety net ensuring the plant can always discharge within legal limits even under upset "
        "conditions, protecting the operating licence and avoiding production shutdowns."
    )
    st.divider()

    hours        = st.session_state.operating_hours
    total_in     = st.session_state.total_inlet_flow
    discharge    = st.session_state.discharge_flow
    conc_flow    = st.session_state.concentrate_flow_m3h
    tx           = _tx()

    # Risk parameters (user-adjustable)
    c1, c2, c3 = st.columns(3)
    fine_per_event   = c1.number_input("Regulatory fine per exceedance (EUR)", 10_000, 5_000_000,
                                        250_000, step=10_000)
    events_per_yr    = c2.slider("Exceedance events / yr (without Red Box)", 0.5, 10.0, 2.0, 0.5)
    shutdown_days    = c3.slider("Production shutdown days / yr (worst case)", 0, 30, 5)

    prod_margin_day  = st.number_input("Daily production margin at risk (EUR/day)", 10_000, 5_000_000,
                                        200_000, step=10_000)

    # Calculations
    annual_fine_risk     = fine_per_event * events_per_yr
    annual_shutdown_risk = shutdown_days * prod_margin_day
    total_risk_yr        = annual_fine_risk + annual_shutdown_risk
    red_capex            = conc_flow * 50_000     # emergency equalization + DAF: ~EUR 50k per m3/h
    red_opex_yr          = conc_flow * hours * 0.08  # EUR 0.08/m3 standby ops
    net_red_value        = total_risk_yr - red_opex_yr
    pb = simple_payback(red_capex, net_red_value) if net_red_value > 0 else float("inf")

    st.divider()
    st.subheader("Risk & Value Calculation")
    val_df = pd.DataFrame([
        ("Annual regulatory fine risk (probability-weighted)", annual_fine_risk,
         f"EUR {fine_per_event:,.0f} x {events_per_yr} events/yr"),
        ("Annual production shutdown risk",                   annual_shutdown_risk,
         f"{shutdown_days} days x EUR {prod_margin_day:,.0f}/day"),
        ("Total annual compliance risk value",                total_risk_yr, ""),
        ("Red Box OPEX (standby treatment)",                  -red_opex_yr,  "EUR 0.08/m3 standby"),
        ("NET Red Box annual protected value",                net_red_value, ""),
    ], columns=["Item", "EUR/yr", "Basis"])
    st.dataframe(val_df.style.format({"EUR/yr": "EUR {:,.0f}"}), use_container_width=True, hide_index=True)

    r1, r2, r3, r4 = st.columns(4)
    r1.metric("Total Risk Protected",   f"EUR {total_risk_yr/1e6:.2f}M/yr")
    r2.metric("Emergency CAPEX",        f"EUR {red_capex/1e6:.1f}M")
    r3.metric("Standby OPEX/yr",        f"EUR {red_opex_yr/1e3:.0f}k/yr")
    r4.metric("Simple Payback",         f"{pb:.1f} yrs" if pb < 50 else "> 50 yrs")

    st.info(
        "The Red Box investment typically delivers the fastest payback in the Blue Circle "
        "framework — because the risk it eliminates (fines, shutdowns, licence revocation) "
        "is immediate and high-probability without adequate emergency capacity."
    )


# ──────────────────────────────────────────────────────────────────────────────
# ROUTING: show detail view OR main overview
# ──────────────────────────────────────────────────────────────────────────────
if st.session_state.open_box == "grey":
    show_grey_box()
    st.stop()
elif st.session_state.open_box == "blue":
    show_blue_box()
    st.stop()
elif st.session_state.open_box == "brown":
    show_brown_box()
    st.stop()
elif st.session_state.open_box == "red":
    show_red_box()
    st.stop()

# ──────────────────────────────────────────────────────────────────────────────
# MAIN OVERVIEW
# ──────────────────────────────────────────────────────────────────────────────
st.markdown("# Neptune Water Intelligence Platform")
st.markdown("*Industrial water management & sustainability investment decision support*")
st.divider()

hours    = st.session_state.operating_hours
total_in = st.session_state.total_inlet_flow
total_leakage = sum(p["leakage"] for p in st.session_state.processes.values())

c1, c2, c3, c4 = st.columns([3, 1, 1, 1])
c1.markdown(f"## {st.session_state.company_name}  |  {st.session_state.site}")
c2.metric("Total Inlet Flow",  f"{total_in:,.0f} m3/h")
c3.metric("Operating Hours",   f"{hours:,} h/yr")
c4.metric("Leakage / Evap.",   f"{total_leakage:,.0f} m3/h",
          delta=f"{total_leakage/total_in*100:.1f} %", delta_color="inverse")

st.divider()

# ── Blue Circle value-creation boxes (clickable) ──────────────────────────────
st.subheader("Blue Circle — Water Value Creation Framework")
st.caption("Click a box to open its detailed value calculation.")

BOX_CFG = [
    ("grey",  "GREY BOX",  "#6c757d", "#f4f4f4",
     "Prefiltration Value Creation",
     "Raw water preparation  |  Sand & media filtration  |  Protects downstream assets from fouling"),
    ("blue",  "BLUE BOX",  "#0d6efd", "#e8f0fe",
     "Water Recycle Value Creation",
     "Process & minor-quality water recycling  |  Reduces freshwater intake  |  Lowers discharge cost"),
    ("brown", "BROWN BOX", "#795548", "#efebe9",
     "Waste Recovery Value Creation",
     "Zn, Fe oxide, oil, acid recovery as secondary raw materials  |  Converts waste into revenue"),
    ("red",   "RED BOX",   "#dc3545", "#fdecea",
     "Emergency & Compliance Value",
     "Legal-compliant emergency discharge  |  Avoids regulatory fines  |  Protects operating licence"),
]

box_cols = st.columns(4)
for col, (key, label, border, bg, heading, text) in zip(box_cols, BOX_CFG):
    with col:
        st.markdown(
            f"""<div style="background:{bg};border-left:6px solid {border};
            padding:16px 14px;border-radius:8px;margin-bottom:4px;min-height:130px">
            <span style="font-size:15px;font-weight:700;color:{border}">{label}</span><br>
            <span style="font-size:13px;font-weight:600;color:#222">{heading}</span>
            <p style="font-size:12px;margin-top:8px;color:#444;line-height:1.45">{text}</p>
            </div>""",
            unsafe_allow_html=True,
        )
        if st.button(f"Open {label} detail", key=f"btn_{key}",
                     use_container_width=True):
            st.session_state.open_box = key
            st.rerun()

st.divider()

# ── KPI dashboard ─────────────────────────────────────────────────────────────
st.subheader("Key Performance Indicators")

costs = _costs()
mat_rev_data = material_recovery_revenue(RECOVERED_MATERIALS, st.session_state.processes, hours)
total_mat_revenue = sum(v["revenue_eur_yr"] for v in mat_rev_data.values())
tx = _tx()
bridge = ebitda_bridge(costs, st.session_state.target_recycle_pct,
                        tx["total_opex_eur_yr"], total_mat_revenue)

k1, k2, k3, k4, k5, k6 = st.columns(6)
k1.metric("Annual Intake",          f"{costs['intake_m3_yr']/1e6:.1f} Mm3/yr")
k2.metric("Intake Cost",            f"EUR {costs['intake_cost_eur_yr']/1e6:.1f}M/yr")
k3.metric("Discharge Cost",         f"EUR {costs['discharge_cost_eur_yr']/1e6:.1f}M/yr")
k4.metric("Total Water Cost",       f"EUR {costs['total_cost_eur_yr']/1e6:.1f}M/yr")
k5.metric("Material Recovery",      f"EUR {total_mat_revenue/1e6:.1f}M/yr")
k6.metric("EBITDA Improvement",     f"EUR {bridge['net_improvement']/1e6:.1f}M/yr",
          delta=f"{bridge['net_improvement']/costs['total_cost_eur_yr']*100:.0f}% of water cost")

st.divider()

# ── Water availability and compliance outlook ───────────────────────────────
selected_country = st.session_state.get("selected_country", "Germany")
projection_df = build_water_availability_projection(selected_country, years=10)
timeline_df = build_compliance_timeline(selected_country, horizon_years=10)

st.subheader("10-Year Water Availability and Compliance Outlook")
st.caption(
    "Forecast combines current country stress and climate profile with trend assumptions. "
    "For site-specific precision, connect live Copernicus and local hydrology feeds."
)

forecast_col, timeline_col = st.columns([3, 2])

with forecast_col:
    fig_forecast = make_subplots(specs=[[{"secondary_y": True}]])
    fig_forecast.add_trace(
        go.Scatter(
            x=projection_df["Year"],
            y=projection_df["River Level Index"],
            mode="lines+markers",
            name="River level index",
            line=dict(color="#1d4ed8", width=2),
        ),
        secondary_y=False,
    )
    fig_forecast.add_trace(
        go.Scatter(
            x=projection_df["Year"],
            y=projection_df["Aquifer Level Index"],
            mode="lines+markers",
            name="Aquifer level index",
            line=dict(color="#0f766e", width=2),
        ),
        secondary_y=False,
    )
    fig_forecast.add_trace(
        go.Bar(
            x=projection_df["Year"],
            y=projection_df["Average Rainfall (mm)"],
            name="Average rainfall (mm)",
            marker_color="rgba(59,130,246,0.28)",
        ),
        secondary_y=True,
    )
    fig_forecast.update_yaxes(title_text="Water level index (0-130)", secondary_y=False)
    fig_forecast.update_yaxes(title_text="Rainfall (mm/year)", secondary_y=True)
    fig_forecast.update_layout(
        height=380,
        margin=dict(l=20, r=20, t=25, b=20),
        legend=dict(orientation="h", y=1.08, x=0),
        paper_bgcolor="white",
        plot_bgcolor="white",
        font=dict(family="Arial, sans-serif", size=12),
    )
    st.plotly_chart(fig_forecast, use_container_width=True)

with timeline_col:
    if timeline_df.empty:
        st.info("No compliance milestones available for this country profile.")
    else:
        status_color = {
            "Due in 12 months": "#dc2626",
            "Near-term": "#f59e0b",
            "Long-term": "#2563eb",
        }
        fig_timeline = go.Figure(
            go.Scatter(
                x=timeline_df["Deadline"],
                y=timeline_df["Milestone"],
                mode="markers+text",
                marker=dict(
                    size=11,
                    color=[status_color.get(v, "#2563eb") for v in timeline_df["Status"]],
                    line=dict(color="white", width=1),
                ),
                text=timeline_df["Status"],
                textposition="middle right",
                hovertemplate="%{y}<br>Deadline: %{x|%Y-%m-%d}<br>Status: %{text}<extra></extra>",
            )
        )
        fig_timeline.update_layout(
            title="Compliance deadline timeline",
            height=380,
            margin=dict(l=20, r=20, t=45, b=20),
            paper_bgcolor="white",
            plot_bgcolor="white",
            xaxis_title="Deadline",
            yaxis_title="",
            font=dict(family="Arial, sans-serif", size=11),
        )
        st.plotly_chart(fig_timeline, use_container_width=True)

avg_water_idx = projection_df["Water Availability Index"].mean()
end_water_idx = projection_df.iloc[-1]["Water Availability Index"]
trend_label = "declining" if end_water_idx < projection_df.iloc[0]["Water Availability Index"] else "stable-to-improving"
st.info(
    f"{selected_country}: average 10-year water availability index is {avg_water_idx:.1f}, "
    f"with a {trend_label} outlook by year {int(projection_df.iloc[-1]['Year'])}."
)

st.divider()

# ── Overview Sankey ───────────────────────────────────────────────────────────
st.subheader("Water Balance Overview")

discharge_m3h = st.session_state.discharge_flow
treatment_in  = st.session_state.pretreatment_flow_m3h

labels = [
    "River / Raw Water",
    "Water Treatment & Purification",
    "Steel Production Processes",
    "Wastewater Treatment",
    "Recycled (Internal)",
    "River Discharge",
    "Leakage / Evaporation",
]
colors = ["#1565c0","#2e7d32","#e65100","#6a1b9a","#1b5e20","#1976d2","#78909c"]

link_vals = [
    treatment_in,
    total_in - treatment_in,
    treatment_in * 0.90,
    treatment_in * 0.10,
    discharge_m3h * 0.55,
    discharge_m3h * 0.45,
    max(total_leakage, 0.1),
]
link_colors = [
    "rgba(46,125,50,0.25)", "rgba(21,101,192,0.25)",
    "rgba(106,27,154,0.25)", "rgba(27,94,32,0.25)",
    "rgba(25,118,210,0.25)", "rgba(25,118,210,0.25)",
    "rgba(120,144,156,0.25)",
]

fig_sankey = go.Figure(go.Sankey(
    arrangement="snap",
    node=dict(
        label=labels, color=colors,
        pad=22, thickness=20,
        line=dict(color="white", width=0.8),
    ),
    link=dict(
        source=[0, 0, 1, 1, 2, 2, 2],
        target=[1, 2, 2, 4, 3, 5, 6],
        value=link_vals,
        color=link_colors,
        label=[f"{v:,.0f} m3/h" for v in link_vals],
    ),
))
fig_sankey.update_layout(
    height=420,
    margin=dict(l=20, r=20, t=30, b=20),
    font=dict(family="Arial, sans-serif", size=14, color="#1a1a2e"),
    paper_bgcolor="white",
)
st.plotly_chart(fig_sankey, use_container_width=True)
st.caption(
    "Hover over links to see flow volumes (m3/h).  "
    "See the Flow Diagram page for full process-level detail with contaminant concentrations."
)
st.divider()

# ── Module guide ─────────────────────────────────────────────────────────────
st.subheader("Platform Modules")
mod_cols = st.columns(3)
modules = [
    ("1  Company Data",
     "Enter / import process water flows, water sources and contaminant concentrations for each plant unit."),
    ("2  Flow Diagram",
     "Interactive Sankey of all plant streams with flow rates and contaminant concentrations annotated."),
    ("3  Treatment Solutions",
     "Auto-recommended technology per treatment stage. Step-by-step contaminant removal chain."),
    ("4  Cost Estimation",
     "Full SAP-coded cost table. Edit unit costs inline, import from Excel, export to Excel."),
    ("5  EBITDA Bridge",
     "Waterfall chart: baseline water cost to savings to material revenue to OPEX to net EBITDA gain."),
    ("6  CapEx / OpEx",
     "3- or 5-year investment plan with phasing, NPV, IRR, payback and optimisation recommendation."),
]
for i, (title, desc) in enumerate(modules):
    mod_cols[i % 3].markdown(
        f"""<div style="background:#f0f4ff;padding:14px;border-radius:8px;margin-bottom:10px;
        border-top:3px solid #4a90d9">
        <b style="font-size:14px">{title}</b><br>
        <span style="font-size:12px;color:#444">{desc}</span></div>""",
        unsafe_allow_html=True,
    )
