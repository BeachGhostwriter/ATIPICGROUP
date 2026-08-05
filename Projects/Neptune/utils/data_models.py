"""Default data constants for the Neptune Water Intelligence Platform.
   Demo case: Bremen Steel Works (from Smart Water 4.0 case study).
"""

# ── Process water balance (m³/h) ────────────────────────────────────────────
DEFAULT_PROCESSES = {
    "Purification":      {"flow_in": 2764.30, "flow_out": 2764.30, "leakage": 0.00},
    "Desalination":      {"flow_in": 120.00,  "flow_out": 201.60,  "leakage": -81.60},
    "Sinter Plant":      {"flow_in": 197.00,  "flow_out": 194.00,  "leakage": 3.00},
    "Blast Furnace":     {"flow_in": 3751.40, "flow_out": 3566.00, "leakage": 185.40},
    "Process":           {"flow_in": 379.00,  "flow_out": 379.00,  "leakage": 0.00},
    "Converter":         {"flow_in": 433.00,  "flow_out": 350.00,  "leakage": 83.00},
    "Casting":           {"flow_in": 239.00,  "flow_out": 180.00,  "leakage": 59.00},
    "HSM":               {"flow_in": 217.60,  "flow_out": 147.00,  "leakage": 70.60},
    "CRM":               {"flow_in": 1044.20, "flow_out": 1043.00, "leakage": 1.20},
    "Galva":             {"flow_in": 11.90,   "flow_out": 11.00,   "leakage": 0.90},
    "Air Plant":         {"flow_in": 440.00,  "flow_out": 440.00,  "leakage": 0.00},
    "Hydrogen":          {"flow_in": 19.30,   "flow_out": 0.00,    "leakage": 19.30},
    "Detox":             {"flow_in": 0.00,    "flow_out": 36.00,   "leakage": -36.00},
    "Filtration":        {"flow_in": 287.00,  "flow_out": 287.00,  "leakage": 0.00},
}

# ── Influent contaminant concentrations by process (mg/L unless noted) ──────
DEFAULT_CONTAMINANTS = {
    "Blast Furnace": {
        "TSS":  {"value": 150,  "unit": "mg/L"},
        "Fe":   {"value": 35,   "unit": "mg/L"},
        "Zn":   {"value": 5,    "unit": "mg/L"},
        "pH":   {"value": 7.2,  "unit": "–"},
        "COD":  {"value": 80,   "unit": "mg/L"},
    },
    "Converter": {
        "TSS":  {"value": 200,  "unit": "mg/L"},
        "Fe":   {"value": 60,   "unit": "mg/L"},
        "pH":   {"value": 8.5,  "unit": "–"},
        "COD":  {"value": 50,   "unit": "mg/L"},
    },
    "Sinter Plant": {
        "TSS":  {"value": 300,  "unit": "mg/L"},
        "Fe":   {"value": 80,   "unit": "mg/L"},
        "NH4":  {"value": 10,   "unit": "mg/L"},
        "pH":   {"value": 7.5,  "unit": "–"},
    },
    "CRM": {
        "Oil":  {"value": 1500, "unit": "mg/L"},
        "Fe":   {"value": 100,  "unit": "mg/L"},
        "TSS":  {"value": 80,   "unit": "mg/L"},
        "COD":  {"value": 3000, "unit": "mg/L"},
    },
    "HSM": {
        "Oil":  {"value": 20,   "unit": "mg/L"},
        "TSS":  {"value": 60,   "unit": "mg/L"},
        "Fe":   {"value": 20,   "unit": "mg/L"},
        "COD":  {"value": 150,  "unit": "mg/L"},
    },
    "Galva": {
        "Zn":   {"value": 200,  "unit": "mg/L"},
        "Al":   {"value": 50,   "unit": "mg/L"},
        "pH":   {"value": 6.5,  "unit": "–"},
        "TSS":  {"value": 120,  "unit": "mg/L"},
    },
    "Casting": {
        "Oil":  {"value": 10,   "unit": "mg/L"},
        "TSS":  {"value": 50,   "unit": "mg/L"},
        "Fe":   {"value": 15,   "unit": "mg/L"},
        "COD":  {"value": 80,   "unit": "mg/L"},
    },
    "Detox": {
        "Zn":   {"value": 500,  "unit": "mg/L"},
        "CN":   {"value": 5,    "unit": "mg/L"},
        "pH":   {"value": 11.5, "unit": "–"},
        "COD":  {"value": 200,  "unit": "mg/L"},
    },
}

# ── Treatment technology library ─────────────────────────────────────────────
TREATMENT_OPTIONS = {
    "Pre-treatment": {
        "Mechanical Screening & Grit Removal": {
            "description": "Low cost – protects downstream equipment. Removes gross solids.",
            "capex_eur_per_m3h": 5_000,
            "opex_eur_per_m3": 0.02,
            "energy_kwh_m3": 0.05,
            "removal": {"TSS": 0.40, "Oil": 0.20},
            "tier": "Basic",
        },
        "Coagulation/Flocculation + Sand Filters": {
            "description": "Common for high-TSS influents. Effective removal of suspended solids.",
            "capex_eur_per_m3h": 15_000,
            "opex_eur_per_m3": 0.08,
            "energy_kwh_m3": 0.12,
            "removal": {"TSS": 0.85, "Oil": 0.50, "Fe": 0.60},
            "tier": "Standard",
        },
        "Ultrafiltration (UF)": {
            "description": "Improved solids & pathogen removal. Ideal pre-treatment before RO.",
            "capex_eur_per_m3h": 35_000,
            "opex_eur_per_m3": 0.15,
            "energy_kwh_m3": 0.25,
            "removal": {"TSS": 0.99, "Oil": 0.80, "Fe": 0.90},
            "tier": "Advanced",
        },
    },
    "Primary Treatment": {
        "Sedimentation": {
            "description": "Basic gravity settling. Often first step before biological/membrane.",
            "capex_eur_per_m3h": 8_000,
            "opex_eur_per_m3": 0.03,
            "energy_kwh_m3": 0.04,
            "removal": {"TSS": 0.60, "Fe": 0.50},
            "tier": "Basic",
        },
        "DAF (Dissolved Air Flotation)": {
            "description": "Effective for suspended solids and oils/fats. Compact footprint.",
            "capex_eur_per_m3h": 20_000,
            "opex_eur_per_m3": 0.10,
            "energy_kwh_m3": 0.20,
            "removal": {"TSS": 0.85, "Oil": 0.92, "Fe": 0.70},
            "tier": "Standard",
        },
        "MBR (Primary)": {
            "description": "High effluent quality; suitable for direct reuse or RO feed.",
            "capex_eur_per_m3h": 60_000,
            "opex_eur_per_m3": 0.25,
            "energy_kwh_m3": 0.50,
            "removal": {"TSS": 0.99, "Oil": 0.96, "Fe": 0.95},
            "tier": "Advanced",
        },
    },
    "Secondary Treatment": {
        "Activated Sludge (CAS)": {
            "description": "Biological baseline. Effective for BOD/COD removal.",
            "capex_eur_per_m3h": 25_000,
            "opex_eur_per_m3": 0.12,
            "energy_kwh_m3": 0.30,
            "removal": {"BOD": 0.90, "COD": 0.80, "TSS": 0.80},
            "tier": "Basic",
        },
        "MBBR / Biofilm": {
            "description": "Compact and robust biological process. Good for variable loads.",
            "capex_eur_per_m3h": 30_000,
            "opex_eur_per_m3": 0.14,
            "energy_kwh_m3": 0.35,
            "removal": {"BOD": 0.92, "COD": 0.85, "TSS": 0.85},
            "tier": "Standard",
        },
        "MBR (Membrane Bioreactor)": {
            "description": "Integrates bio + membrane. High quality effluent ready for reuse or RO.",
            "capex_eur_per_m3h": 65_000,
            "opex_eur_per_m3": 0.28,
            "energy_kwh_m3": 0.60,
            "removal": {"BOD": 0.98, "COD": 0.95, "TSS": 0.99, "Oil": 0.95},
            "tier": "Advanced",
        },
        "AnMBR (Anaerobic MBR)": {
            "description": "Energy recovery via biogas. Low sludge yields. Best for high-COD streams.",
            "capex_eur_per_m3h": 70_000,
            "opex_eur_per_m3": 0.20,
            "energy_kwh_m3": -0.10,  # net energy producer
            "removal": {"BOD": 0.95, "COD": 0.90, "TSS": 0.95},
            "tier": "Advanced + Energy Recovery",
        },
        "Advanced Oxidation (AOP)": {
            "description": "Ozone/H₂O₂/UV for recalcitrant organics and micropollutants.",
            "capex_eur_per_m3h": 80_000,
            "opex_eur_per_m3": 0.35,
            "energy_kwh_m3": 0.80,
            "removal": {"COD": 0.96, "BOD": 0.96, "Micropollutants": 0.99},
            "tier": "Specialised",
        },
    },
    "Tertiary Treatment": {
        "NF / RO": {
            "description": "Central for high-quality water reuse and desalination. Produces permeate + concentrate.",
            "capex_eur_per_m3h": 50_000,
            "opex_eur_per_m3": 0.30,
            "energy_kwh_m3": 0.70,
            "removal": {"TDS": 0.95, "TSS": 0.99, "Heavy Metals": 0.99, "Zn": 0.99},
            "tier": "Standard for Reuse",
        },
        "Activated Carbon + UV": {
            "description": "Polishing step for micropollutants, colour, odour and disinfection.",
            "capex_eur_per_m3h": 20_000,
            "opex_eur_per_m3": 0.12,
            "energy_kwh_m3": 0.15,
            "removal": {"Micropollutants": 0.95, "Bacteria": 0.9999, "COD": 0.60},
            "tier": "Polishing",
        },
        "Ion Exchange / Electrodialysis": {
            "description": "Selective ion removal. Ideal for heavy metals (Zn, Fe) and partial TDS control.",
            "capex_eur_per_m3h": 40_000,
            "opex_eur_per_m3": 0.20,
            "energy_kwh_m3": 0.40,
            "removal": {"Heavy Metals": 0.95, "Zn": 0.99, "Fe": 0.95, "TDS": 0.50},
            "tier": "Selective",
        },
    },
    "Concentrate Management": {
        "Brine Concentration (Membrane)": {
            "description": "Membrane-based pre-concentration before thermal. Reduces thermal load.",
            "capex_eur_per_m3h": 80_000,
            "opex_eur_per_m3": 0.40,
            "energy_kwh_m3": 1.20,
            "water_recovery": 0.85,
            "tier": "Standard ZLD Step",
        },
        "Electrodialysis": {
            "description": "Energy-efficient for moderate salinity concentration.",
            "capex_eur_per_m3h": 70_000,
            "opex_eur_per_m3": 0.35,
            "energy_kwh_m3": 0.90,
            "water_recovery": 0.80,
            "tier": "Energy Efficient",
        },
        "MEE / Thermal Evaporation (MVR)": {
            "description": "Multi-effect evaporation with mechanical vapour recompression.",
            "capex_eur_per_m3h": 150_000,
            "opex_eur_per_m3": 0.80,
            "energy_kwh_m3": 8.00,
            "water_recovery": 0.95,
            "tier": "High Concentration",
        },
        "Crystallization": {
            "description": "Salt and mineral recovery from high-TDS concentrate. ZLD endpoint.",
            "capex_eur_per_m3h": 200_000,
            "opex_eur_per_m3": 1.20,
            "energy_kwh_m3": 15.00,
            "water_recovery": 0.99,
            "tier": "ZLD Endpoint",
        },
    },
    "ZLD (Zero Liquid Discharge)": {
        "None (no ZLD)": {
            "description": "Discharge treated effluent to river within permit limits.",
            "capex_eur_per_m3h": 0,
            "opex_eur_per_m3": 0,
            "energy_kwh_m3": 0,
            "water_recovery": 0.0,
            "tier": "Standard Discharge",
        },
        "BrineX Pre-Concentration Stages": {
            "description": "Membrane pre-concentration reduces thermal evaporation energy by ~40 %.",
            "capex_eur_per_m3h": 250_000,
            "opex_eur_per_m3": 1.80,
            "energy_kwh_m3": 12.00,
            "water_recovery": 0.97,
            "tier": "Optimised ZLD",
        },
        "Multi-stage RO + Brine Concentrator + Thermal + Crystallizer": {
            "description": "Industry-standard ZLD architecture. Highest water recovery, highest cost.",
            "capex_eur_per_m3h": 400_000,
            "opex_eur_per_m3": 2.50,
            "energy_kwh_m3": 20.00,
            "water_recovery": 0.99,
            "tier": "Full ZLD",
        },
    },
}

# ── SAP cost codes ────────────────────────────────────────────────────────────
SAP_COST_CODES = [
    {"sap_code": "3100", "description": "Raw Water Intake",                       "unit": "EUR/m³",          "unit_cost": 0.35},
    {"sap_code": "3110", "description": "Pre-treatment Operations",               "unit": "EUR/m³",          "unit_cost": 0.08},
    {"sap_code": "3120", "description": "Primary Treatment Operations",           "unit": "EUR/m³",          "unit_cost": 0.10},
    {"sap_code": "3130", "description": "Secondary Treatment Operations",         "unit": "EUR/m³",          "unit_cost": 0.15},
    {"sap_code": "3140", "description": "Tertiary Treatment Operations",          "unit": "EUR/m³",          "unit_cost": 0.30},
    {"sap_code": "3150", "description": "Concentrate / ZLD Management",           "unit": "EUR/m³",          "unit_cost": 1.20},
    {"sap_code": "3200", "description": "Water Distribution & Pumping",           "unit": "EUR/m³",          "unit_cost": 0.05},
    {"sap_code": "3300", "description": "Wastewater Collection",                  "unit": "EUR/m³",          "unit_cost": 0.04},
    {"sap_code": "3400", "description": "Sludge Handling & Disposal",             "unit": "EUR/tonne",       "unit_cost": 85.00},
    {"sap_code": "3410", "description": "Sludge Dewatering",                      "unit": "EUR/tonne",       "unit_cost": 40.00},
    {"sap_code": "6100", "description": "Electricity – Treatment",                "unit": "EUR/kWh",         "unit_cost": 0.12},
    {"sap_code": "6200", "description": "Chemicals (Coagulants / Flocculants)",   "unit": "EUR/m³",          "unit_cost": 0.06},
    {"sap_code": "6210", "description": "Membrane Replacement",                   "unit": "EUR/m²/yr",       "unit_cost": 25.00},
    {"sap_code": "6300", "description": "Labour – Operations (FTE)",              "unit": "EUR/FTE/yr",      "unit_cost": 65_000},
    {"sap_code": "6400", "description": "Maintenance & Repair",                   "unit": "% of CAPEX/yr",   "unit_cost": 3.0},
    {"sap_code": "7100", "description": "Capital Depreciation",                   "unit": "% of CAPEX/yr",   "unit_cost": 10.0},
    {"sap_code": "7200", "description": "Wastewater Discharge Permit",            "unit": "EUR/m³",          "unit_cost": 0.45},
    {"sap_code": "8100", "description": "Recovered Material – Iron Oxide",        "unit": "EUR/tonne",       "unit_cost": 75.0},
    {"sap_code": "8200", "description": "Recovered Material – Zinc",              "unit": "EUR/tonne",       "unit_cost": 2_500.0},
    {"sap_code": "8300", "description": "Recovered Material – HCl / Iron Chloride","unit": "EUR/tonne",      "unit_cost": 120.0},
    {"sap_code": "8400", "description": "Recovered Material – Oil / Emulsion",   "unit": "EUR/tonne",       "unit_cost": 150.0},
    {"sap_code": "8500", "description": "Biogas Revenue (from AnMBR)",            "unit": "EUR/Nm³",         "unit_cost": 0.40},
    {"sap_code": "9100", "description": "Regulatory Fine / Penalty Avoidance",   "unit": "EUR/event",       "unit_cost": 50_000},
    {"sap_code": "9200", "description": "Carbon Cost – Water Heating Energy",    "unit": "EUR/tonne CO₂",   "unit_cost": 65.0},
]

# ── Recoverable material streams ─────────────────────────────────────────────
RECOVERED_MATERIALS = {
    "Zinc – BF & Galva Effluent": {
        "source_processes":     ["Blast Furnace", "Galva", "Detox"],
        "concentration_mg_L":   5.0,
        "recovery_efficiency":  0.85,
        "value_eur_per_tonne":  2_500,
        "required_treatment":   "Ion Exchange / Electrodialysis",
        "sap_code":             "8200",
    },
    "Iron Oxide – BF / Converter / HSM": {
        "source_processes":     ["Blast Furnace", "Converter", "HSM", "Sinter Plant"],
        "concentration_mg_L":   75.0,
        "recovery_efficiency":  0.75,
        "value_eur_per_tonne":  75,
        "required_treatment":   "DAF (Dissolved Air Flotation)",
        "sap_code":             "8100",
    },
    "Oil / Emulsion – CRM": {
        "source_processes":     ["CRM"],
        "concentration_mg_L":   1_500.0,
        "recovery_efficiency":  0.90,
        "value_eur_per_tonne":  150,
        "required_treatment":   "DAF (Dissolved Air Flotation)",
        "sap_code":             "8400",
    },
    "HCl / Iron Chloride – Pickling (CRM)": {
        "source_processes":     ["CRM"],
        "concentration_mg_L":   5_000.0,
        "recovery_efficiency":  0.80,
        "value_eur_per_tonne":  120,
        "required_treatment":   "Acid Recovery System",
        "sap_code":             "8300",
    },
    "Biogas – Anaerobic Treatment": {
        "source_processes":     ["Secondary Treatment"],
        "concentration_mg_L":   None,
        "recovery_efficiency":  0.70,
        "value_eur_per_m3_gas": 0.40,
        "required_treatment":   "AnMBR (Anaerobic MBR)",
        "sap_code":             "8500",
    },
}

# ── Water source defaults (m³/h) ─────────────────────────────────────────────
DEFAULT_WATER_SOURCES = {
    "River / Surface Water":    3_825.00,
    "Municipal / Well Water":   0.00,
    "Rainwater Harvesting":     0.00,
    "Seawater (Desalinated)":   0.00,
    "Recycled (Internal)":      2_764.30,
}

DEFAULT_SETTINGS = {
    "company_name":             "Bremen Steel Works",
    "site":                     "Bremen, Germany",
    "industry":                 "Integrated Steel Plant",
    "operating_hours":          8_760,      # h/yr (continuous)
    "total_inlet_flow":         6_589.30,   # m³/h from data
    "discharge_flow":           6_247.00,   # m³/h to river
    # Treatment sizing flows: pre-treatment = supply water; WWT = process wastewater only
    # Once-through cooling (~3,500 m³/h) goes direct to river — not treated here.
    "pretreatment_flow_m3h":    2_764.30,   # supply side (purification capacity)
    "wwt_flow_m3h":             2_000.0,    # process wastewater needing full treatment
    "concentrate_flow_m3h":     300.0,      # concentrate / brine volume
    "water_cost_eur_m3":        0.35,
    "discharge_cost_eur_m3":    0.45,
    "electricity_cost_eur_kwh": 0.12,
    "discount_rate_pct":        8.0,
    "time_horizon_yr":          5,
    "current_recycle_pct":      0.0,
    "target_recycle_pct":       70.0,
}
