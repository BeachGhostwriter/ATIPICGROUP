"""
Excel Cost Engine
=================
Reads chemical dosing costs, OPEX and CAPEX straight from the client's own
RO master workbook (Main INPUT-OUTPUT sheet). Cell coordinates below were
located by inspecting the actual uploaded file -- not assumed.
"""
import openpyxl
from models import ChemicalCostProfile

CELLS = {
    "membrane_exchange_eur_m3": "F171",
    "cleaner_a_eur_m3": "F172",
    "sulphuric_acid_eur_m3": "J172",
    "cleaner_s_eur_m3": "F173",
    "sodium_hydroxide_eur_m3": "J173",
    "antiscalant_eur_m3": "F174",
    "hydrochloric_acid_eur_m3": "J174",
    "parts_eur_m3": "F176",
    "labour_eur_m3": "F177",
    "energy_kwh_m3": "F178",
    "total_opex_eur_m3": "F180",
    "capex_total_eur": "F167",
    "leachate_disposal_eur_m3": "S37",  # "Leachate price per m³ ... 10 Euro"
}


def load_chemical_costs(excel_path) -> ChemicalCostProfile:
    """`excel_path` can be a filesystem path (str) or a file-like object
    (e.g. a Streamlit UploadedFile)."""
    wb = openpyxl.load_workbook(excel_path, data_only=True)
    ws = wb["Main INPUT-OUTPUT"]
    source_label = getattr(excel_path, "name", excel_path)
    values = {}
    for field, coord in CELLS.items():
        v = ws[coord].value
        values[field] = v if isinstance(v, (int, float)) else 0.0
    # Leachate price cell is inconsistent between template revisions --
    # fall back to the known default (10 EUR/m3) documented elsewhere in
    # the sheet if the lookup cell didn't resolve to a number.
    if not values["leachate_disposal_eur_m3"]:
        values["leachate_disposal_eur_m3"] = 10.0
    return ChemicalCostProfile(source_file=source_label, **values)
