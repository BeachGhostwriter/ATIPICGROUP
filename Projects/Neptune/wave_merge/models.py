"""
Shared data structures for the WAVE <-> Neptune1 merge prototype.
Kept dependency-free (stdlib dataclasses only) so it can run anywhere.
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class WaveDesign:
    """Normalized fields pulled from a DuPont WAVE Detailed Report export."""
    project_name: str
    feed_flow_m3d: float
    permeate_flow_m3d: float
    concentrate_flow_m3d: float
    recovery_pct: float
    num_stages: int
    feed_pressure_bar: float
    feed_conductivity_uScm: float
    permeate_conductivity_uScm: float
    concentrate_conductivity_uScm: float
    specific_energy_kwh_m3: float
    num_elements: int
    source_file: str


@dataclass
class Neptune1SessionExport:
    """Normalized fields from a real Neptune1 session export (verified
    against Home.py: st.session_state keys, TREATMENT_OPTIONS,
    treatment_capex_opex() output shape). This replaces the earlier
    guessed model now that the actual source was shared."""
    company_name: str
    site: str
    country: str
    operating_hours: float
    total_inlet_flow_m3h: float
    pretreatment_flow_m3h: float
    wwt_flow_m3h: float
    concentrate_flow_m3h: float
    discharge_flow_m3h: float
    target_recycle_pct: float
    water_cost_eur_m3: float
    discharge_cost_eur_m3: float
    selected_treatments: dict           # stage name -> technology name
    stage_capex_opex: dict              # stage name -> {"capex_eur":.., "opex_eur_yr":..}
    total_treatment_opex_eur_yr: float
    discharge_limits: dict = field(default_factory=dict)
    source_file: str = ""


@dataclass
class BlueCircleValues:
    """Grey/Blue/Brown/Red box value-creation results, computed with the
    same formulas as Home.py's show_grey_box/show_blue_box/show_brown_box/
    show_red_box functions (Brown Box uses placeholder rates -- exact
    parity needs utils/calculations.py's material_recovery_revenue() and
    utils/data_models.py's RECOVERED_MATERIALS, which weren't shared)."""
    grey_box_eur_yr: float
    blue_box_eur_yr: float
    brown_box_eur_yr: float
    red_box_eur_yr: float
    brown_box_is_estimate: bool = True


@dataclass
class ChemicalCostProfile:
    """Chemical usage & OPEX costs per m3 permeate, sourced from the client's
    own Excel model (Main INPUT-OUTPUT sheet)."""
    membrane_exchange_eur_m3: float
    cleaner_a_eur_m3: float
    cleaner_s_eur_m3: float
    antiscalant_eur_m3: float
    sulphuric_acid_eur_m3: float
    sodium_hydroxide_eur_m3: float
    hydrochloric_acid_eur_m3: float
    parts_eur_m3: float
    labour_eur_m3: float
    energy_kwh_m3: float
    total_opex_eur_m3: float
    capex_total_eur: float
    leachate_disposal_eur_m3: float
    source_file: str


@dataclass
class TreatmentStageResult:
    name: str
    description: str
    line_items: list  # list of (label, value, unit)
    subtotal_eur_m3: Optional[float] = None


@dataclass
class MergedSystemReport:
    project_name: str
    design: WaveDesign
    neptune: Optional[Neptune1SessionExport]
    blue_circle: Optional[BlueCircleValues]
    costs: ChemicalCostProfile
    pretreatment: TreatmentStageResult
    ro_treatment: TreatmentStageResult
    posttreatment: TreatmentStageResult
    concentrate_management: list  # list[TreatmentStageResult], several options
    variance_flags: list  # Neptune1 stage-level vs WAVE/Excel bottom-up reconciliation
    total_opex_eur_m3: float
    total_opex_eur_year: float
