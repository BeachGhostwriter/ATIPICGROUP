"""
Pre-treatment
=============
Protects the RO membranes. The client's own Excel already specs the tank/
filter train (sand filter, bag filters, cartridge filters, degasser -- see
"Menu" sheet), so this module reports that equipment list and adds typical
industry dosing-cost ranges for the steps the Excel doesn't itemize
(coagulation/flocculation, dosing pumps). Ranges are flagged as ESTIMATE
and should be firmed up against the raw water analysis once available.
"""
from models import TreatmentStageResult


def build(feed_flow_m3d: float, feed_conductivity_uScm: float) -> TreatmentStageResult:
    coagulant_dose_mg_l = 5.0       # typical FeCl3/PAC range 2-10 mg/l
    coagulant_cost_eur_kg = 0.45
    coagulant_cost_eur_m3 = (coagulant_dose_mg_l / 1000) * coagulant_cost_eur_kg

    items = [
        ("Multimedia / sand filtration", "1x sand filter train + blower (per client spec)", "-"),
        ("Bag filters (inlet)", "1x inlet stage", "-"),
        ("Cartridge filters PP 160", "1x inlet stage, 5 micron nominal", "-"),
        ("Degasser", "1x, upstream of RO feed pumps", "-"),
        ("Coagulant/flocculant dosing (ESTIMATE)", round(coagulant_dose_mg_l, 2), "mg/l"),
        ("Coagulant cost (ESTIMATE)", round(coagulant_cost_eur_m3, 4), "EUR/m3"),
        ("Antiscalant dosing", "dosed continuously ahead of stage 1 -- costed under RO OPEX", "-"),
        ("Feed flow to pretreatment", round(feed_flow_m3d, 1), "m3/d"),
        ("Raw water conductivity", round(feed_conductivity_uScm, 0), "uS/cm"),
    ]
    return TreatmentStageResult(
        name="Pre-treatment",
        description="Solids removal, coagulation and feed conditioning ahead of the RO train.",
        line_items=items,
        subtotal_eur_m3=round(coagulant_cost_eur_m3, 4),
    )
