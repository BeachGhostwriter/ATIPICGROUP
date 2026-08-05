"""
Blue Circle Value Creation
==========================
Replicates the four value-creation formulas from Neptune1's Home.py
(show_grey_box / show_blue_box / show_brown_box / show_red_box).

Grey, Blue and Red boxes are exact ports of the visible formulas.
Brown Box is an approximation: Home.py's real figure depends on
material_recovery_revenue() (in utils/calculations.py) and RECOVERED_MATERIALS
(in utils/data_models.py), neither of which were shared, so it's flagged
brown_box_is_estimate=True. Share those two files (or a Brown Box screenshot
with numbers) to make this exact.
"""
from models import Neptune1SessionExport, BlueCircleValues


def grey_box_value(n: Neptune1SessionExport) -> float:
    """Exact port of show_grey_box(): avoided fouling (~2.5x OPEX) plus
    5% of CAPEX as extended-lifetime benefit, net of pre-treatment OPEX."""
    pt = n.stage_capex_opex.get("Pre-treatment", {})
    capex = pt.get("capex_eur", 0)
    opex = pt.get("opex_eur_yr", 0)
    avoided_fouling = opex * 2.5
    net_benefit = avoided_fouling - opex
    return net_benefit + capex * 0.05


def blue_box_value(n: Neptune1SessionExport) -> float:
    """Exact port of show_blue_box(): freshwater intake saving + discharge
    permit saving, net of secondary+tertiary treatment OPEX."""
    volume_recycled_m3yr = n.total_inlet_flow_m3h * (n.target_recycle_pct / 100) * n.operating_hours
    water_saving = volume_recycled_m3yr * n.water_cost_eur_m3
    discharge_saving = n.discharge_flow_m3h * (n.target_recycle_pct / 100) * 0.60 * n.operating_hours * n.discharge_cost_eur_m3

    recycle_stages = ["Secondary Treatment", "Tertiary Treatment"]
    recycle_opex = sum(n.stage_capex_opex.get(s, {}).get("opex_eur_yr", 0) for s in recycle_stages)
    return water_saving + discharge_saving - recycle_opex


def brown_box_value(n: Neptune1SessionExport, material_revenue_eur_yr: float = None) -> float:
    """Approximation of show_brown_box(): material recovery revenue minus
    concentrate management OPEX, plus ~40% of that OPEX as avoided
    hazardous-disposal cost. material_revenue_eur_yr defaults to a rough
    placeholder (ESTIMATE) when the real material_recovery_revenue() figure
    isn't available."""
    conc = n.stage_capex_opex.get("Concentrate Management", {})
    conc_opex = conc.get("opex_eur_yr", 0)
    if material_revenue_eur_yr is None:
        # Placeholder: ~0.8x concentrate OPEX as recovered-material revenue.
        # Real figure needs RECOVERED_MATERIALS rates from utils/data_models.py.
        material_revenue_eur_yr = conc_opex * 0.8
    net_brown = material_revenue_eur_yr - conc_opex
    return net_brown + conc_opex * 0.40


def red_box_value(n: Neptune1SessionExport,
                   fine_per_event_eur: float = 250_000,
                   events_per_yr: float = 2.0,
                   shutdown_days: float = 5,
                   prod_margin_eur_day: float = 200_000) -> float:
    """Exact port of show_red_box() with Home.py's default risk-slider
    values. Override the four risk parameters with the client's real
    figures once known -- they materially change this number."""
    annual_fine_risk = fine_per_event_eur * events_per_yr
    annual_shutdown_risk = shutdown_days * prod_margin_eur_day
    total_risk_yr = annual_fine_risk + annual_shutdown_risk
    red_opex_yr = n.concentrate_flow_m3h * n.operating_hours * 0.08
    return total_risk_yr - red_opex_yr


def compute_all(n: Neptune1SessionExport, material_revenue_eur_yr: float = None) -> BlueCircleValues:
    return BlueCircleValues(
        grey_box_eur_yr=round(grey_box_value(n), 0),
        blue_box_eur_yr=round(blue_box_value(n), 0),
        brown_box_eur_yr=round(brown_box_value(n, material_revenue_eur_yr), 0),
        red_box_eur_yr=round(red_box_value(n), 0),
        brown_box_is_estimate=(material_revenue_eur_yr is None),
    )
