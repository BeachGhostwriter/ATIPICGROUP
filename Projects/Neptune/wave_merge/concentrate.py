"""
Concentrate Management
=======================
The reject stream is the recurring problem in RO projects: it's ~30-40% of
feed flow at very high TDS. This module lays out the standard options as
comparable cost lines so a client can weigh them, rather than picking one.

"Off-site disposal (leachate)" uses the client's OWN Excel figure
(EUR/m3), the other three are industry-typical EUR/m3 ranges (ESTIMATE)
for this concentrate volume and conductivity band.
"""
from models import TreatmentStageResult


def build(concentrate_flow_m3d: float, concentrate_conductivity_uScm: float,
          leachate_price_eur_m3: float) -> list:
    options = []

    # Option 1: off-site disposal / leachate -- client's own cost basis
    options.append(TreatmentStageResult(
        name="Option A: Off-site disposal (tanker to licensed facility)",
        description="Lowest CAPEX, highest recurring OPEX. Client's own Excel cost basis.",
        line_items=[
            ("Disposal price", leachate_price_eur_m3, "EUR/m3"),
            ("Concentrate volume", round(concentrate_flow_m3d, 1), "m3/d"),
            ("Annual disposal cost", round(leachate_price_eur_m3 * concentrate_flow_m3d * 365, 0), "EUR/y"),
        ],
        subtotal_eur_m3=leachate_price_eur_m3,
    ))

    # Option 2: further RO / booster stage to push recovery up, shrink volume
    options.append(TreatmentStageResult(
        name="Option B: Concentrate-staged RO (booster/4th pass)",
        description="Adds a high-pressure booster pass to recover further permeate and shrink reject volume "
                     "~30-45%. Cuts disposal volume, raises CAPEX and energy per m3 of extra permeate recovered.",
        line_items=[
            ("Typical volume reduction", "30-45%", "-"),
            ("Added specific energy (ESTIMATE)", 1.8, "kWh/m3 recovered"),
            ("Added OPEX (ESTIMATE)", 0.35, "EUR/m3 recovered"),
            ("Trade-off", "shifts cost from disposal fee to CAPEX + energy", "-"),
        ],
        subtotal_eur_m3=0.35,
    ))

    # Option 3: evaporation / crystallization toward ZLD
    options.append(TreatmentStageResult(
        name="Option C: Evaporation / crystallization (ZLD path)",
        description="Mechanical vapour recompression evaporator + crystallizer. Highest CAPEX, "
                     "converts concentrate to solid salt cake + distillate; eliminates ongoing disposal liability.",
        line_items=[
            ("Typical CAPEX uplift (ESTIMATE)", "3,000 - 6,000 EUR per m3/d concentrate capacity", "-"),
            ("Typical OPEX (ESTIMATE)", "8 - 15", "EUR/m3 concentrate"),
            ("Best fit", "sites with zero-discharge consent or high disposal fees", "-"),
        ],
        subtotal_eur_m3=11.5,
    ))

    # Option 4: evaporation ponds (site/climate dependent)
    options.append(TreatmentStageResult(
        name="Option D: Lined evaporation ponds",
        description="Low-tech, climate-dependent (needs high evaporation / low rainfall). "
                     "Low OPEX, large land footprint, slower payback on liner CAPEX.",
        line_items=[
            ("Land area (ESTIMATE)", "~1,000-1,500 m2 per m3/d concentrate, climate dependent", "-"),
            ("Typical OPEX (ESTIMATE)", "1 - 2.5", "EUR/m3 concentrate"),
            ("Constraint", "requires suitable climate + land availability + liner integrity monitoring", "-"),
        ],
        subtotal_eur_m3=1.75,
    ))

    return options
