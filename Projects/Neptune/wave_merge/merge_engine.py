"""
Merge Engine
============
Combines:
  - WaveDesign               (bottom-up: detailed RO membrane engineering)
  - Neptune1SessionExport     (Neptune1's own stage-level CAPEX/OPEX + Blue
                                Circle inputs -- optional)
  - ChemicalCostProfile       (client's ground-truth chemical/OPEX/CAPEX Excel)

into one MergedSystemReport covering pre-treatment -> RO -> post-treatment
-> concentrate management, plus Blue Circle value creation and stage-level
reconciliation between Neptune1's estimate and the WAVE/Excel bottom-up
figures.

Stage mapping assumption (documented, not hidden): Neptune1's
"Pre-treatment" stage maps to this pipeline's pretreatment.py; Neptune1's
"Concentrate Management" stage maps to this pipeline's concentrate.py;
the RO membrane train itself sits inside Neptune1's "Secondary/Tertiary
Treatment" categorisation. Confirm this mapping once real Neptune1 exports
are available -- your actual technology selections may split it differently.
"""
from typing import Optional
from models import WaveDesign, Neptune1SessionExport, ChemicalCostProfile, MergedSystemReport, TreatmentStageResult
import pretreatment
import posttreatment
import concentrate
import blue_circle


STAGE_GAP_WARN_PCT = 15.0


def _gap_pct(a, b):
    return ((a - b) / b * 100) if b else 0.0


def build_variance_flags(costs: ChemicalCostProfile, neptune: Optional[Neptune1SessionExport]) -> list:
    flags = []
    if neptune is None:
        flags.append({
            "level": "info",
            "message": "No Neptune1 session export supplied -- showing WAVE/Excel bottom-up figures only. "
                       "See neptune_export_snippet.py to generate one.",
        })
        return flags

    # The Excel's CAPEX covers the full RO membrane train -- in Neptune1's
    # stage split that's "Secondary Treatment" + "Tertiary Treatment"
    # combined, NOT "Pre-treatment" (that's a separate, upstream stage).
    ro_stages = ["Secondary Treatment", "Tertiary Treatment"]
    neptune_ro_capex = sum(neptune.stage_capex_opex.get(s, {}).get("capex_eur", 0) for s in ro_stages)
    if neptune_ro_capex:
        gap = _gap_pct(neptune_ro_capex, costs.capex_total_eur)
        if abs(gap) >= STAGE_GAP_WARN_PCT:
            flags.append({
                "level": "warning",
                "message": f"RO train CAPEX gap of {gap:+.1f}% between Neptune1's Secondary+Tertiary "
                           f"Treatment estimate ({neptune_ro_capex:,.0f} EUR) and the client Excel's "
                           f"detailed bottom-up figure ({costs.capex_total_eur:,.0f} EUR) -- worth "
                           f"reconciling before this goes into a client-facing number.",
            })
        else:
            flags.append({
                "level": "ok",
                "message": f"RO train CAPEX matches within tolerance: Neptune1 estimate "
                           f"{neptune_ro_capex:,.0f} EUR vs WAVE/Excel bottom-up {costs.capex_total_eur:,.0f} EUR "
                           f"({gap:+.1f}%).",
            })

    conc = neptune.stage_capex_opex.get("Concentrate Management", {})
    if conc:
        conc_opex_m3 = conc.get("opex_eur_yr", 0) / (neptune.concentrate_flow_m3h * neptune.operating_hours) \
            if neptune.concentrate_flow_m3h and neptune.operating_hours else 0
        gap = _gap_pct(conc_opex_m3, costs.leachate_disposal_eur_m3)
        flags.append({
            "level": "info",
            "message": f"Concentrate management cost basis differs by design, not error: Neptune1's "
                       f"Brown Box assumes on-site treatment/recovery ({conc_opex_m3:.2f} EUR/m3), the "
                       f"client Excel assumes tankered disposal ({costs.leachate_disposal_eur_m3:.2f} EUR/m3). "
                       f"{'On-site recovery looks cheaper' if conc_opex_m3 < costs.leachate_disposal_eur_m3 else 'Tankered disposal looks cheaper'} "
                       f"at this volume -- see the Concentrate Management options below for the full comparison.",
        })

    if not flags:
        flags.append({"level": "ok", "message": "Neptune1's stage-level estimates and the WAVE/Excel "
                                                   "bottom-up figures are within tolerance of each other."})
    return flags


def merge(design: WaveDesign, costs: ChemicalCostProfile,
          neptune: Optional[Neptune1SessionExport] = None,
          material_revenue_eur_yr: float = None) -> MergedSystemReport:

    pre = pretreatment.build(design.feed_flow_m3d, design.feed_conductivity_uScm)
    post = posttreatment.build(design.permeate_flow_m3d, design.permeate_conductivity_uScm)
    conc_options = concentrate.build(design.concentrate_flow_m3d,
                                      design.concentrate_conductivity_uScm,
                                      costs.leachate_disposal_eur_m3)

    ro_items = [
        ("Feed flow", round(design.feed_flow_m3d, 1), "m3/d"),
        ("Permeate flow", round(design.permeate_flow_m3d, 1), "m3/d"),
        ("Concentrate flow", round(design.concentrate_flow_m3d, 1), "m3/d"),
        ("System recovery (design)", round(design.recovery_pct, 1), "%"),
        ("Number of stages", design.num_stages, "-"),
        ("Feed pressure", design.feed_pressure_bar, "bar"),
        ("Membrane exchange", costs.membrane_exchange_eur_m3, "EUR/m3"),
        ("Cleaner A", costs.cleaner_a_eur_m3, "EUR/m3"),
        ("Cleaner S", costs.cleaner_s_eur_m3, "EUR/m3"),
        ("Antiscalant", costs.antiscalant_eur_m3, "EUR/m3"),
        ("Sulphuric acid", costs.sulphuric_acid_eur_m3, "EUR/m3"),
        ("Sodium hydroxide", costs.sodium_hydroxide_eur_m3, "EUR/m3"),
        ("Parts", costs.parts_eur_m3, "EUR/m3"),
        ("Labour", costs.labour_eur_m3, "EUR/m3"),
        ("Energy", costs.energy_kwh_m3, "kWh/m3"),
    ]
    ro_stage = TreatmentStageResult(
        name="RO treatment (3-stage)",
        description="Core reverse osmosis train, chemical/OPEX figures sourced from client Excel model.",
        line_items=ro_items,
        subtotal_eur_m3=costs.total_opex_eur_m3,
    )

    total_opex_eur_m3 = (
        (pre.subtotal_eur_m3 or 0) + costs.total_opex_eur_m3 + (post.subtotal_eur_m3 or 0)
    )
    total_opex_eur_year = total_opex_eur_m3 * design.permeate_flow_m3d * 365

    bc = blue_circle.compute_all(neptune, material_revenue_eur_yr) if neptune else None

    return MergedSystemReport(
        project_name=design.project_name,
        design=design,
        neptune=neptune,
        blue_circle=bc,
        costs=costs,
        pretreatment=pre,
        ro_treatment=ro_stage,
        posttreatment=post,
        concentrate_management=conc_options,
        variance_flags=build_variance_flags(costs, neptune),
        total_opex_eur_m3=round(total_opex_eur_m3, 4),
        total_opex_eur_year=round(total_opex_eur_year, 0),
    )
