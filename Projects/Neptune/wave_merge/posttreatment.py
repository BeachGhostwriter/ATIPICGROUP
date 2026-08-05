"""
Post-treatment
===============
Conditions permeate for its end use (discharge, reuse, or potable supply).
Costs are industry-typical dosing ranges (ESTIMATE) since the client's
Excel model stops at the permeate outlet.
"""
from models import TreatmentStageResult


def build(permeate_flow_m3d: float, permeate_conductivity_uScm: float) -> TreatmentStageResult:
    co2_dose_mg_l = 15.0
    naoh_dose_mg_l = 8.0
    co2_cost_eur_kg = 0.35
    naoh_cost_eur_kg = 0.55  # note: distinct dosing point from RO-side NaOH cleaning
    remineralisation_eur_m3 = (co2_dose_mg_l / 1000) * co2_cost_eur_kg + (naoh_dose_mg_l / 1000) * naoh_cost_eur_kg

    uv_dose_kwh_m3 = 0.02
    uv_cost_eur_m3 = uv_dose_kwh_m3 * 0.18  # assumed industrial electricity price EUR/kWh

    items = [
        ("Remineralisation (CO2 + NaOH, calcite alt. available) (ESTIMATE)",
         round(remineralisation_eur_m3, 4), "EUR/m3"),
        ("pH correction target", "6.8 - 8.5 (adjust to discharge/reuse consent)", "-"),
        ("UV disinfection (ESTIMATE)", round(uv_cost_eur_m3, 4), "EUR/m3"),
        ("Permeate flow to post-treatment", round(permeate_flow_m3d, 1), "m3/d"),
        ("Permeate conductivity (as designed)", round(permeate_conductivity_uScm, 0)
         if permeate_conductivity_uScm else "n/a", "uS/cm"),
    ]
    return TreatmentStageResult(
        name="Post-treatment",
        description="Remineralisation, pH correction and disinfection of RO permeate before discharge/reuse.",
        line_items=items,
        subtotal_eur_m3=round(remineralisation_eur_m3 + uv_cost_eur_m3, 4),
    )
