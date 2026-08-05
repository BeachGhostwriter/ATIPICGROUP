"""Core calculation functions for the Neptune Water Intelligence Platform."""

import numpy as np


# ── Annual water economics ────────────────────────────────────────────────────

def annual_water_costs(processes: dict, water_cost: float, discharge_cost: float,
                       hours: float, total_inlet_m3h: float, discharge_m3h: float) -> dict:
    total_leakage = sum(p["leakage"] for p in processes.values())
    intake_m3_yr = total_inlet_m3h * hours
    discharge_m3_yr = discharge_m3h * hours
    intake_cost = intake_m3_yr * water_cost
    discharge_cost_yr = discharge_m3_yr * discharge_cost
    return {
        "intake_m3_yr":        intake_m3_yr,
        "discharge_m3_yr":     discharge_m3_yr,
        "leakage_m3h":         total_leakage,
        "leakage_m3_yr":       total_leakage * hours,
        "intake_cost_eur_yr":  intake_cost,
        "discharge_cost_eur_yr": discharge_cost_yr,
        "total_cost_eur_yr":   intake_cost + discharge_cost_yr,
    }


# ── Treatment CAPEX / OPEX estimation ────────────────────────────────────────

# Design flows per treatment stage to avoid over-sizing on once-through cooling water.
STAGE_FLOW_KEY = {
    "Pre-treatment":              "pretreatment",   # supply side
    "Primary Treatment":          "wwt",            # process wastewater
    "Secondary Treatment":        "wwt",
    "Tertiary Treatment":         "wwt",
    "Concentrate Management":     "concentrate",
    "ZLD (Zero Liquid Discharge)": "concentrate",
}

def treatment_capex_opex(selected_treatments: dict, treatment_options: dict,
                          total_flow_m3h: float, hours: float,
                          pretreatment_flow: float = None,
                          wwt_flow: float = None,
                          concentrate_flow: float = None) -> dict:
    # Default: use fractions of total flow if not specified
    pt_flow   = pretreatment_flow  if pretreatment_flow  is not None else total_flow_m3h * 0.42
    ww_flow   = wwt_flow           if wwt_flow           is not None else total_flow_m3h * 0.30
    conc_flow = concentrate_flow   if concentrate_flow   is not None else total_flow_m3h * 0.045

    flow_map = {
        "pretreatment": pt_flow,
        "wwt":          ww_flow,
        "concentrate":  conc_flow,
    }

    total_capex = 0.0
    total_opex_yr = 0.0
    total_energy_kwh_yr = 0.0
    detail = {}
    for stage, tech in selected_treatments.items():
        if tech is None or "None" in str(tech):
            continue
        opts = treatment_options.get(stage, {})
        if tech not in opts:
            continue
        t = opts[tech]
        flow_key  = STAGE_FLOW_KEY.get(stage, "wwt")
        stage_flow = flow_map[flow_key]
        capex      = t.get("capex_eur_per_m3h", 0) * stage_flow
        opex_yr    = t.get("opex_eur_per_m3", 0) * stage_flow * hours
        energy_yr  = t.get("energy_kwh_m3", 0)   * stage_flow * hours
        total_capex         += capex
        total_opex_yr       += opex_yr
        total_energy_kwh_yr += energy_yr
        detail[stage] = {
            "technology": tech,
            "design_flow_m3h": stage_flow,
            "capex_eur": capex,
            "opex_eur_yr": opex_yr,
            "energy_kwh_yr": energy_yr,
            "tier": t.get("tier", ""),
        }
    return {
        "total_capex_eur":       total_capex,
        "total_opex_eur_yr":     total_opex_yr,
        "total_energy_kwh_yr":   total_energy_kwh_yr,
        "detail":                detail,
    }


# ── Recovered material revenue ────────────────────────────────────────────────

def material_recovery_revenue(recovered_materials: dict, processes: dict, hours: float) -> dict:
    results = {}
    for material, props in recovered_materials.items():
        conc = props.get("concentration_mg_L")
        if conc is None:
            # Biogas – proxy: 0.35 Nm³/kg COD removed, assume 500 mg/L COD in secondary
            flow_m3h = sum(p["flow_out"] for name, p in processes.items()
                           if name in props.get("source_processes", []))
            cod_kg_h = 0.500 * flow_m3h       # 500 mg/L → 0.5 kg/m³
            biogas_m3_yr = cod_kg_h * 0.35 * hours * props["recovery_efficiency"]
            revenue_yr = biogas_m3_yr * props.get("value_eur_per_m3_gas", 0)
            results[material] = {
                "quantity_yr": round(biogas_m3_yr, 0),
                "unit": "Nm³/yr",
                "revenue_eur_yr": round(revenue_yr, 0),
            }
        else:
            flow_m3h = sum(p["flow_out"] for name, p in processes.items()
                           if name in props.get("source_processes", []))
            if flow_m3h == 0:
                flow_m3h = sum(p["flow_out"] for p in processes.values()) * 0.30
            mass_kg_h = (conc / 1e6) * flow_m3h * 1e3   # mg/L → kg/m³ × m³/h
            mass_tonne_yr = mass_kg_h * hours / 1_000 * props["recovery_efficiency"]
            revenue_yr = mass_tonne_yr * props.get("value_eur_per_tonne", 0)
            results[material] = {
                "quantity_yr": round(mass_tonne_yr, 1),
                "unit": "tonnes/yr",
                "revenue_eur_yr": round(revenue_yr, 0),
            }
    return results


# ── EBITDA bridge ─────────────────────────────────────────────────────────────

def ebitda_bridge(current_costs: dict, target_recycle_pct: float,
                   treatment_opex_yr: float, material_revenue_yr: float,
                   energy_cost_saving_yr: float = 0.0) -> dict:
    recycle_frac = target_recycle_pct / 100.0

    # Water savings (reduced intake)
    water_saving = current_costs["intake_cost_eur_yr"] * recycle_frac
    # Discharge savings (reduced volume needing permit/treatment)
    discharge_saving = current_costs["discharge_cost_eur_yr"] * recycle_frac * 0.60

    baseline = current_costs["total_cost_eur_yr"]
    improvements = water_saving + discharge_saving + material_revenue_yr + energy_cost_saving_yr
    costs = treatment_opex_yr
    net_ebitda_improvement = improvements - costs

    return {
        "baseline_water_cost": baseline,
        "water_intake_saving": water_saving,
        "discharge_saving":    discharge_saving,
        "material_revenue":    material_revenue_yr,
        "energy_saving":       energy_cost_saving_yr,
        "treatment_opex":      treatment_opex_yr,
        "net_improvement":     net_ebitda_improvement,
        "improved_cost":       baseline - net_ebitda_improvement,
    }


# ── NPV / IRR ─────────────────────────────────────────────────────────────────

def npv(capex_schedule: list, annual_benefit: float, annual_opex: float,
        discount_rate_pct: float) -> float:
    r = discount_rate_pct / 100.0
    pv = -sum(c / (1 + r) ** (i + 1) for i, c in enumerate(capex_schedule))
    n = len(capex_schedule)
    terminal_yr = 20
    for yr in range(n + 1, terminal_yr + 1):
        pv += (annual_benefit - annual_opex) / (1 + r) ** yr
    return pv


def irr(capex_schedule: list, annual_benefit: float, annual_opex: float,
        terminal_yr: int = 20) -> float:
    cashflows = [-c for c in capex_schedule]
    n = len(capex_schedule)
    for yr in range(n + 1, terminal_yr + 1):
        cashflows.append(annual_benefit - annual_opex)

    # Newton-Raphson with overflow guard
    rate = 0.10
    for _ in range(300):
        try:
            pv  = sum(cf / (1 + rate) ** i for i, cf in enumerate(cashflows))
            dpv = sum(-i * cf / (1 + rate) ** (i + 1) for i, cf in enumerate(cashflows))
        except (OverflowError, ZeroDivisionError):
            break
        if abs(dpv) < 1e-12:
            break
        step = pv / dpv
        rate -= max(-0.5, min(0.5, step))  # cap step size
        if rate < -0.999:
            rate = -0.999
        if rate > 10.0:
            return 999.0  # uncapped positive
    return round(rate * 100, 2)


def simple_payback(total_capex: float, annual_net_benefit: float) -> float:
    if annual_net_benefit <= 0:
        return float("inf")
    return total_capex / annual_net_benefit


# ── Auto-recommendation logic ─────────────────────────────────────────────────

def recommend_treatments(contaminants: dict, target_reuse: bool = True) -> dict:
    """Score contaminant profile and return recommended technology per stage."""
    max_tss = max((p.get("TSS", {}).get("value", 0) for p in contaminants.values()), default=0)
    max_oil = max((p.get("Oil", {}).get("value", 0) for p in contaminants.values()), default=0)
    max_zn  = max((p.get("Zn", {}).get("value", 0) for p in contaminants.values()), default=0)
    max_cod = max((p.get("COD", {}).get("value", 0) for p in contaminants.values()), default=0)

    pre  = "Ultrafiltration (UF)" if max_tss > 200 else "Coagulation/Flocculation + Sand Filters"
    pri  = "DAF (Dissolved Air Flotation)" if max_oil > 50 else "Sedimentation"
    sec  = "AnMBR (Anaerobic MBR)" if max_cod > 1000 else (
           "MBR (Membrane Bioreactor)" if target_reuse else "MBBR / Biofilm")
    ter  = "Ion Exchange / Electrodialysis" if max_zn > 100 else "NF / RO"
    conc = "MEE / Thermal Evaporation (MVR)" if target_reuse else "Brine Concentration (Membrane)"
    zld  = "None (no ZLD)"

    return {
        "Pre-treatment": pre,
        "Primary Treatment": pri,
        "Secondary Treatment": sec,
        "Tertiary Treatment": ter,
        "Concentrate Management": conc,
        "ZLD (Zero Liquid Discharge)": zld,
    }


# ── CapEx phasing helper ───────────────────────────────────────────────────────

def phase_capex(total_capex: float, years: int, profile: str = "front-loaded") -> list:
    """Return a list of annual CAPEX spends (len = years)."""
    if profile == "front-loaded":
        weights = [0.40, 0.35, 0.20, 0.05, 0.00][:years]
    elif profile == "back-loaded":
        weights = [0.05, 0.10, 0.25, 0.35, 0.25][:years]
    else:  # even
        weights = [1.0 / years] * years
    weights = weights[:years]
    s = sum(weights)
    return [total_capex * w / s for w in weights]


def cumulative_opex_savings(annual_benefit: float, treatment_opex: float,
                             capex_schedule: list) -> list:
    """Cumulative net cash position year-by-year."""
    net = 0.0
    result = []
    n = len(capex_schedule)
    for i, capex in enumerate(capex_schedule):
        ramp = (i + 1) / n  # ramping up
        net += -capex + (annual_benefit - treatment_opex) * ramp
        result.append(net)
    yr_post = max(15, n + 5)
    for _ in range(yr_post - n):
        net += annual_benefit - treatment_opex
        result.append(net)
    return result
