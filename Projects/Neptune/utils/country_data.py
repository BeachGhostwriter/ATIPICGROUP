"""Country-level water stress data and regulatory discharge limits.

Water stress scores: WRI Aqueduct 3.0 (2023) national averages, scale 0-5.
  0-1 = Low | 1-2 = Low-Medium | 2-3 = Medium-High | 3-4 = High | 4-5 = Extremely High

Discharge limits: compiled from publicly available national legislation.
  EU: Industrial Emissions Directive (IED) + Water Framework Directive (WFD)
  Country-specific: national transpositions and sector-specific standards.
  Steel / metals sector limits used where available; general industrial otherwise.
"""

# ── Water stress index by country (WRI Aqueduct 3.0) ─────────────────────────
WATER_STRESS = {
    "Qatar":               4.97, "Israel":              4.82, "Lebanon":             4.76,
    "Iran":                4.57, "Jordan":              4.53, "Libya":               4.42,
    "Kuwait":              4.38, "Saudi Arabia":        4.22, "Eritrea":             4.11,
    "UAE":                 4.09, "Bahrain":             4.05, "Yemen":               4.01,
    "Oman":                3.98, "Djibouti":            3.87, "Morocco":             3.12,
    "Egypt":               3.07, "India":               3.05, "Pakistan":            2.98,
    "Syria":               2.94, "Iraq":                2.91, "Afghanistan":         2.88,
    "Algeria":             2.83, "Tunisia":             2.79, "Spain":               2.62,
    "China":               2.56, "Turkey":              2.52, "Mexico":              2.48,
    "Portugal":            2.40, "South Africa":        2.37, "Chile":               2.31,
    "Australia":           2.28, "Greece":              2.21, "USA":                 2.15,
    "Italy":               2.09, "South Korea":         2.04, "Japan":               1.98,
    "Peru":                1.87, "Indonesia":           1.82, "Brazil":              1.78,
    "Argentina":           1.72, "Nigeria":             1.68, "France":              1.42,
    "Germany":             1.38, "Poland":              1.31, "UK":                  1.27,
    "Netherlands":         1.22, "Belgium":             1.18, "Czech Republic":      1.14,
    "Austria":             1.08, "Denmark":             1.02, "Ireland":             0.94,
    "Sweden":              0.81, "Finland":             0.76, "Norway":              0.68,
    "Canada":              0.63, "New Zealand":         0.55, "Iceland":             0.12,
}

WATER_STRESS_CATEGORY = {
    (0.0, 1.0): ("Low",              "#1a9850"),
    (1.0, 2.0): ("Low-Medium",       "#91cf60"),
    (2.0, 3.0): ("Medium-High",      "#fee08b"),
    (3.0, 4.0): ("High",             "#fc8d59"),
    (4.0, 5.0): ("Extremely High",   "#d73027"),
}

def stress_category(score: float) -> tuple:
    for (lo, hi), (label, color) in WATER_STRESS_CATEGORY.items():
        if lo <= score < hi:
            return label, color
    return "Extremely High", "#d73027"


# ── Soil moisture & climate indicators (annual averages, indexed data) ────────
CLIMATE_DATA = {
    "Germany":      {"precip_mm": 700,  "soil_moisture_pct": 62, "groundwater_depletion": "Low",    "drought_risk": "Low"},
    "France":       {"precip_mm": 867,  "soil_moisture_pct": 65, "groundwater_depletion": "Low",    "drought_risk": "Low-Medium"},
    "Netherlands":  {"precip_mm": 820,  "soil_moisture_pct": 70, "groundwater_depletion": "Low",    "drought_risk": "Low"},
    "Belgium":      {"precip_mm": 847,  "soil_moisture_pct": 68, "groundwater_depletion": "Low",    "drought_risk": "Low"},
    "UK":           {"precip_mm": 1154, "soil_moisture_pct": 72, "groundwater_depletion": "Low",    "drought_risk": "Low"},
    "Spain":        {"precip_mm": 636,  "soil_moisture_pct": 38, "groundwater_depletion": "Medium", "drought_risk": "High"},
    "Italy":        {"precip_mm": 832,  "soil_moisture_pct": 45, "groundwater_depletion": "Medium", "drought_risk": "Medium"},
    "Poland":       {"precip_mm": 600,  "soil_moisture_pct": 55, "groundwater_depletion": "Low",    "drought_risk": "Low-Medium"},
    "Czech Republic":{"precip_mm": 674, "soil_moisture_pct": 52, "groundwater_depletion": "Low",    "drought_risk": "Low-Medium"},
    "Austria":      {"precip_mm": 1170, "soil_moisture_pct": 68, "groundwater_depletion": "Low",    "drought_risk": "Low"},
    "India":        {"precip_mm": 1083, "soil_moisture_pct": 35, "groundwater_depletion": "High",   "drought_risk": "High"},
    "China":        {"precip_mm": 645,  "soil_moisture_pct": 40, "groundwater_depletion": "High",   "drought_risk": "High"},
    "USA":          {"precip_mm": 715,  "soil_moisture_pct": 48, "groundwater_depletion": "Medium", "drought_risk": "Medium"},
    "Brazil":       {"precip_mm": 1761, "soil_moisture_pct": 62, "groundwater_depletion": "Low",    "drought_risk": "Low"},
    "Australia":    {"precip_mm": 465,  "soil_moisture_pct": 25, "groundwater_depletion": "High",   "drought_risk": "High"},
    "South Africa": {"precip_mm": 495,  "soil_moisture_pct": 22, "groundwater_depletion": "High",   "drought_risk": "High"},
    "Saudi Arabia": {"precip_mm": 59,   "soil_moisture_pct": 5,  "groundwater_depletion": "Critical","drought_risk": "Extreme"},
    "UAE":          {"precip_mm": 78,   "soil_moisture_pct": 4,  "groundwater_depletion": "Critical","drought_risk": "Extreme"},
    "Turkey":       {"precip_mm": 593,  "soil_moisture_pct": 38, "groundwater_depletion": "Medium", "drought_risk": "Medium-High"},
    "Mexico":       {"precip_mm": 752,  "soil_moisture_pct": 32, "groundwater_depletion": "High",   "drought_risk": "High"},
    "Japan":        {"precip_mm": 1668, "soil_moisture_pct": 65, "groundwater_depletion": "Low",    "drought_risk": "Low"},
    "South Korea":  {"precip_mm": 1274, "soil_moisture_pct": 55, "groundwater_depletion": "Low",    "drought_risk": "Low"},
    "Morocco":      {"precip_mm": 346,  "soil_moisture_pct": 20, "groundwater_depletion": "High",   "drought_risk": "High"},
    "Sweden":       {"precip_mm": 624,  "soil_moisture_pct": 68, "groundwater_depletion": "Low",    "drought_risk": "Low"},
    "Norway":       {"precip_mm": 1414, "soil_moisture_pct": 75, "groundwater_depletion": "Low",    "drought_risk": "Low"},
}


# ── Discharge limits database ─────────────────────────────────────────────────
# Each entry: parameter -> {limit, unit, notes}
# Limits are MAXIMUM permissible values in final effluent to surface water.

_EU_STEEL = {
    "authority":  "EU Industrial Emissions Directive (IED) / BREF Iron & Steel 2012 + BAT conclusions",
    "standard":   "IED Annex I + BAT-AEL for iron & steel",
    "parameters": {
        "TSS":            {"limit": 30,    "unit": "mg/L",  "notes": "BAT-AEL: 5-30"},
        "COD":            {"limit": 100,   "unit": "mg/L",  "notes": "BAT-AEL: 20-100"},
        "BOD":            {"limit": 25,    "unit": "mg/L",  "notes": "BAT-AEL: 5-25"},
        "Fe (total)":     {"limit": 2.0,   "unit": "mg/L",  "notes": "BAT-AEL: 0.2-2"},
        "Zn":             {"limit": 1.0,   "unit": "mg/L",  "notes": "BAT-AEL: 0.1-1"},
        "Ni":             {"limit": 0.5,   "unit": "mg/L",  "notes": "WFD priority substance"},
        "Pb":             {"limit": 0.1,   "unit": "mg/L",  "notes": "WFD priority substance"},
        "Cd":             {"limit": 0.01,  "unit": "mg/L",  "notes": "WFD priority substance"},
        "Cr (total)":     {"limit": 0.5,   "unit": "mg/L",  "notes": "BAT-AEL"},
        "Oil / Grease":   {"limit": 5.0,   "unit": "mg/L",  "notes": "BAT-AEL: 0.5-5"},
        "NH4-N":          {"limit": 10,    "unit": "mg/L",  "notes": "Season-dependent"},
        "Cyanide (CN)":   {"limit": 0.1,   "unit": "mg/L",  "notes": "After detox"},
        "pH":             {"limit": "6-9", "unit": "-",     "notes": "Range"},
        "Temperature":    {"limit": 30,    "unit": "degC",  "notes": "Max; delta T < 3 degC"},
    },
}

COUNTRY_LIMITS = {
    # ── European Union member states — default to EU IED / BREF ──────────────
    "Germany": {
        **_EU_STEEL,
        "authority": "WHG + AbwV Anhang 29 (German Wastewater Ordinance, Steel & Metal sector)",
        "standard":  "AbwV Anhang 29 — Eisen-, Stahl- und Tempergussherstellung",
        "parameters": {
            **_EU_STEEL["parameters"],
            "TSS":          {"limit": 30,  "unit": "mg/L", "notes": "AbwV Anhang 29"},
            "COD":          {"limit": 100, "unit": "mg/L", "notes": "AbwV Anhang 29"},
            "Fe (total)":   {"limit": 3.0, "unit": "mg/L", "notes": "AbwV"},
        },
    },
    "France": {
        **_EU_STEEL,
        "authority": "Code de l'environnement + ICPE arrete du 2 fevrier 1998",
        "standard":  "ICPE — installations classees secteur metallurgie",
    },
    "Netherlands": {
        **_EU_STEEL,
        "authority": "Waterwet + Activiteitenbesluit milieubeheer",
        "standard":  "Lozingenbesluit / Activiteitenbesluit",
        "parameters": {
            **_EU_STEEL["parameters"],
            "TSS":       {"limit": 30, "unit": "mg/L", "notes": "Activiteitenbesluit"},
        },
    },
    "Belgium": {
        **_EU_STEEL,
        "authority": "VLAREM II (Flanders) / CWEA (Wallonia)",
        "standard":  "VLAREM II Bijlage 5.3 — metaalverwerkende industrie",
    },
    "UK": {
        **_EU_STEEL,
        "authority": "Environment Agency — Environmental Permitting Regulations 2016",
        "standard":  "EPR — Sector Guidance Note SGN 3.01 (Iron & Steel)",
        "parameters": {
            **_EU_STEEL["parameters"],
            "TSS":       {"limit": 30,  "unit": "mg/L", "notes": "Consent condition"},
            "COD":       {"limit": 100, "unit": "mg/L", "notes": "Consent condition"},
        },
    },
    "Spain":        {**_EU_STEEL, "authority": "Real Decreto-ley 1/2001 — Texto Refundido Ley Aguas + IED transposition"},
    "Italy":        {**_EU_STEEL, "authority": "D.Lgs. 152/2006 (Codice dell'Ambiente) + IED"},
    "Poland":       {**_EU_STEEL, "authority": "Prawo wodne + IED transposition"},
    "Czech Republic":{**_EU_STEEL,"authority": "Zakon c. 254/2001 Sb. (vodni zakon) + IED"},
    "Austria":      {**_EU_STEEL, "authority": "Wasserrechtsgesetz (WRG) 1959 + AAEV"},
    "Sweden":       {**_EU_STEEL, "authority": "Miljobalk (1998:808) — Naturvardsverket"},
    "Norway": {
        **_EU_STEEL,
        "authority": "Forurensningsloven + IPPC/IED equivalent (EEA member)",
        "parameters": {
            **_EU_STEEL["parameters"],
            "TSS": {"limit": 25, "unit": "mg/L", "notes": "Norwegian Water Authority"},
        },
    },
    # ── USA ───────────────────────────────────────────────────────────────────
    "USA": {
        "authority": "US EPA — Clean Water Act, 40 CFR Part 420 (Iron & Steel ELG)",
        "standard":  "Effluent Limitations Guidelines (ELG) — 40 CFR 420, BPT/BAT",
        "parameters": {
            "TSS":          {"limit": 30,    "unit": "mg/L",  "notes": "30-day avg; 45 daily max"},
            "Oil / Grease": {"limit": 10,    "unit": "mg/L",  "notes": "15 mg/L daily max"},
            "Fe (total)":   {"limit": 1.4,   "unit": "mg/L",  "notes": "NPDES typical permit"},
            "Zn":           {"limit": 0.65,  "unit": "mg/L",  "notes": "State-level typical"},
            "Ni":           {"limit": 0.47,  "unit": "mg/L",  "notes": "EPA freshwater criterion"},
            "Cr (total)":   {"limit": 0.57,  "unit": "mg/L",  "notes": "EPA criterion"},
            "Pb":           {"limit": 0.065, "unit": "mg/L",  "notes": "EPA criterion"},
            "Cd":           {"limit": 0.0025,"unit": "mg/L",  "notes": "EPA criterion"},
            "Cyanide (CN)": {"limit": 0.005, "unit": "mg/L",  "notes": "Free cyanide"},
            "pH":           {"limit": "6-9", "unit": "-",     "notes": "Range"},
            "Temperature":  {"limit": 30,    "unit": "degC",  "notes": "State-dependent"},
        },
    },
    # ── China ─────────────────────────────────────────────────────────────────
    "China": {
        "authority": "Ministry of Ecology and Environment — GB 13456-2012 (Iron & Steel)",
        "standard":  "GB 13456-2012 Integrated Steel Wastewater Discharge Standard",
        "parameters": {
            "TSS":          {"limit": 30,  "unit": "mg/L", "notes": "GB 13456 Class A"},
            "COD":          {"limit": 80,  "unit": "mg/L", "notes": "GB 13456 Class A"},
            "BOD":          {"limit": 20,  "unit": "mg/L", "notes": "GB 13456 Class A"},
            "Fe (total)":   {"limit": 2.0, "unit": "mg/L", "notes": "GB 13456"},
            "Zn":           {"limit": 1.0, "unit": "mg/L", "notes": "GB 13456"},
            "Ni":           {"limit": 0.5, "unit": "mg/L", "notes": "GB 13456"},
            "Pb":           {"limit": 0.1, "unit": "mg/L", "notes": "GB 13456"},
            "Cd":           {"limit": 0.01,"unit": "mg/L", "notes": "GB 13456"},
            "Oil / Grease": {"limit": 3.0, "unit": "mg/L", "notes": "GB 13456"},
            "Cyanide (CN)": {"limit": 0.5, "unit": "mg/L", "notes": "GB 13456"},
            "NH4-N":        {"limit": 8.0, "unit": "mg/L", "notes": "GB 13456"},
            "pH":           {"limit": "6-9","unit": "-",   "notes": "Range"},
        },
    },
    # ── India ─────────────────────────────────────────────────────────────────
    "India": {
        "authority": "CPCB (Central Pollution Control Board) — Schedule VI, Environment Protection Rules 1986",
        "standard":  "CPCB Effluent Standards for Iron & Steel Industry",
        "parameters": {
            "TSS":          {"limit": 100,  "unit": "mg/L", "notes": "CPCB Schedule VI"},
            "COD":          {"limit": 250,  "unit": "mg/L", "notes": "CPCB"},
            "BOD":          {"limit": 30,   "unit": "mg/L", "notes": "CPCB"},
            "Fe (total)":   {"limit": 3.0,  "unit": "mg/L", "notes": "CPCB"},
            "Zn":           {"limit": 5.0,  "unit": "mg/L", "notes": "CPCB"},
            "Oil / Grease": {"limit": 10,   "unit": "mg/L", "notes": "CPCB"},
            "Cyanide (CN)": {"limit": 0.2,  "unit": "mg/L", "notes": "CPCB"},
            "pH":           {"limit": "6.5-9","unit": "-",  "notes": "Range"},
            "Temperature":  {"limit": 40,   "unit": "degC", "notes": "CPCB"},
        },
    },
    # ── Brazil ────────────────────────────────────────────────────────────────
    "Brazil": {
        "authority": "CONAMA Resolution 430/2011",
        "standard":  "CONAMA 430 — efluentes em corpos receptores",
        "parameters": {
            "TSS":          {"limit": 100,  "unit": "mg/L", "notes": "CONAMA 430"},
            "COD":          {"limit": 200,  "unit": "mg/L", "notes": "CONAMA 430"},
            "BOD":          {"limit": 60,   "unit": "mg/L", "notes": "CONAMA 430 (80% removal)"},
            "Fe (total)":   {"limit": 15,   "unit": "mg/L", "notes": "CONAMA 430"},
            "Zn":           {"limit": 5.0,  "unit": "mg/L", "notes": "CONAMA 430"},
            "Ni":           {"limit": 2.0,  "unit": "mg/L", "notes": "CONAMA 430"},
            "Pb":           {"limit": 0.5,  "unit": "mg/L", "notes": "CONAMA 430"},
            "Oil / Grease": {"limit": 20,   "unit": "mg/L", "notes": "CONAMA 430"},
            "Cyanide (CN)": {"limit": 0.2,  "unit": "mg/L", "notes": "CONAMA 430"},
            "pH":           {"limit": "5-9","unit": "-",    "notes": "Range"},
            "Temperature":  {"limit": 40,   "unit": "degC", "notes": "CONAMA 430"},
        },
    },
    # ── South Africa ─────────────────────────────────────────────────────────
    "South Africa": {
        "authority": "Department of Water and Sanitation — National Water Act 36/1998",
        "standard":  "General Authorisation GN704 / Special Limits for metals industry",
        "parameters": {
            "TSS":          {"limit": 25,  "unit": "mg/L", "notes": "GN704"},
            "COD":          {"limit": 75,  "unit": "mg/L", "notes": "GN704"},
            "Fe (total)":   {"limit": 0.3, "unit": "mg/L", "notes": "GN704"},
            "Zn":           {"limit": 5.0, "unit": "mg/L", "notes": "GN704"},
            "Oil / Grease": {"limit": 2.5, "unit": "mg/L", "notes": "GN704"},
            "pH":           {"limit": "6-9","unit": "-",   "notes": "Range"},
        },
    },
    # ── UAE ──────────────────────────────────────────────────────────────────
    "UAE": {
        "authority": "UAE Federal Law No. 24/1999 + Local Authority (Dubai/Abu Dhabi)",
        "standard":  "UAE Ministerial Decree No. 21/2012 — Industrial Effluent Standards",
        "parameters": {
            "TSS":          {"limit": 60,   "unit": "mg/L", "notes": "UAE Decree 21"},
            "COD":          {"limit": 250,  "unit": "mg/L", "notes": "UAE Decree 21"},
            "BOD":          {"limit": 40,   "unit": "mg/L", "notes": "UAE Decree 21"},
            "Fe (total)":   {"limit": 5.0,  "unit": "mg/L", "notes": "UAE Decree 21"},
            "Zn":           {"limit": 5.0,  "unit": "mg/L", "notes": "UAE Decree 21"},
            "Oil / Grease": {"limit": 10,   "unit": "mg/L", "notes": "UAE Decree 21"},
            "pH":           {"limit": "6-9","unit": "-",    "notes": "Range"},
        },
    },
    # ── Saudi Arabia ──────────────────────────────────────────────────────────
    "Saudi Arabia": {
        "authority": "Saudi National Centre for Environmental Compliance (NCEC)",
        "standard":  "Saudi Standard SASO 1804 — Industrial Wastewater",
        "parameters": {
            "TSS":          {"limit": 40,   "unit": "mg/L", "notes": "SASO 1804"},
            "COD":          {"limit": 200,  "unit": "mg/L", "notes": "SASO 1804"},
            "Fe (total)":   {"limit": 5.0,  "unit": "mg/L", "notes": "SASO 1804"},
            "Zn":           {"limit": 5.0,  "unit": "mg/L", "notes": "SASO 1804"},
            "Oil / Grease": {"limit": 5.0,  "unit": "mg/L", "notes": "SASO 1804"},
            "pH":           {"limit": "6-9","unit": "-",    "notes": "Range"},
        },
    },
    # ── Turkey ────────────────────────────────────────────────────────────────
    "Turkey": {
        "authority": "Su Kirliligi Kontrolu Yonetmeligi (Water Pollution Control Regulation)",
        "standard":  "WPCR Table 11.1 — Iron and Steel Industry",
        "parameters": {
            "TSS":          {"limit": 30,  "unit": "mg/L", "notes": "WPCR Table 11.1"},
            "COD":          {"limit": 200, "unit": "mg/L", "notes": "WPCR Table 11.1"},
            "Fe (total)":   {"limit": 3.0, "unit": "mg/L", "notes": "WPCR"},
            "Zn":           {"limit": 3.0, "unit": "mg/L", "notes": "WPCR"},
            "Oil / Grease": {"limit": 10,  "unit": "mg/L", "notes": "WPCR"},
            "pH":           {"limit": "6-9","unit": "-",   "notes": "Range"},
        },
    },
    # ── Japan ─────────────────────────────────────────────────────────────────
    "Japan": {
        "authority": "Water Pollution Control Law (Law No. 138/1970) — Ministry of Environment",
        "standard":  "Effluent Standards — Annexed Table 2 (General effluent limits)",
        "parameters": {
            "TSS":          {"limit": 200,  "unit": "mg/L", "notes": "WPCL Annex Table 2"},
            "COD":          {"limit": 160,  "unit": "mg/L", "notes": "WPCL"},
            "BOD":          {"limit": 160,  "unit": "mg/L", "notes": "WPCL"},
            "Fe (total)":   {"limit": 10,   "unit": "mg/L", "notes": "WPCL"},
            "Zn":           {"limit": 5.0,  "unit": "mg/L", "notes": "WPCL"},
            "Ni":           {"limit": 1.0,  "unit": "mg/L", "notes": "WPCL"},
            "Pb":           {"limit": 0.1,  "unit": "mg/L", "notes": "WPCL"},
            "Cd":           {"limit": 0.03, "unit": "mg/L", "notes": "WPCL"},
            "Cyanide (CN)": {"limit": 1.0,  "unit": "mg/L", "notes": "WPCL"},
            "Oil / Grease": {"limit": 5.0,  "unit": "mg/L", "notes": "WPCL"},
            "pH":           {"limit": "5.8-8.6","unit":"-", "notes": "Range"},
        },
    },
    # ── Australia ─────────────────────────────────────────────────────────────
    "Australia": {
        "authority": "EPA State Authorities (varies by state) — ANZECC/ARMCANZ 2000",
        "standard":  "ANZECC Water Quality Guidelines 2000 / State EPA licences",
        "parameters": {
            "TSS":          {"limit": 30,   "unit": "mg/L", "notes": "Typical licence condition"},
            "COD":          {"limit": 100,  "unit": "mg/L", "notes": "Typical licence condition"},
            "Fe (total)":   {"limit": 2.0,  "unit": "mg/L", "notes": "ANZECC freshwater criterion"},
            "Zn":           {"limit": 0.5,  "unit": "mg/L", "notes": "ANZECC criterion"},
            "Oil / Grease": {"limit": 5.0,  "unit": "mg/L", "notes": "Typical"},
            "pH":           {"limit": "6-9","unit": "-",    "notes": "Range"},
        },
    },
    # ── Mexico ────────────────────────────────────────────────────────────────
    "Mexico": {
        "authority": "SEMARNAT — NOM-001-SEMARNAT-2021",
        "standard":  "NOM-001-SEMARNAT-2021 — Limites permisibles de contaminantes",
        "parameters": {
            "TSS":          {"limit": 150,  "unit": "mg/L", "notes": "NOM-001 rivers"},
            "COD":          {"limit": 150,  "unit": "mg/L", "notes": "NOM-001"},
            "BOD":          {"limit": 75,   "unit": "mg/L", "notes": "NOM-001"},
            "Fe (total)":   {"limit": 2.0,  "unit": "mg/L", "notes": "NOM-001"},
            "Zn":           {"limit": 10,   "unit": "mg/L", "notes": "NOM-001"},
            "Oil / Grease": {"limit": 15,   "unit": "mg/L", "notes": "NOM-001"},
            "pH":           {"limit": "6-9","unit": "-",    "notes": "Range"},
        },
    },
}

# Default (generic) fallback when country not in database
COUNTRY_LIMITS["(Custom / Not Listed)"] = {
    "authority": "Custom — upload your own discharge limits below",
    "standard":  "User-defined",
    "parameters": {
        "TSS":          {"limit": 30,   "unit": "mg/L", "notes": "Enter applicable limit"},
        "COD":          {"limit": 100,  "unit": "mg/L", "notes": "Enter applicable limit"},
        "BOD":          {"limit": 25,   "unit": "mg/L", "notes": "Enter applicable limit"},
        "Fe (total)":   {"limit": 2.0,  "unit": "mg/L", "notes": "Enter applicable limit"},
        "Zn":           {"limit": 1.0,  "unit": "mg/L", "notes": "Enter applicable limit"},
        "Oil / Grease": {"limit": 5.0,  "unit": "mg/L", "notes": "Enter applicable limit"},
        "pH":           {"limit": "6-9","unit": "-",    "notes": "Enter applicable limit"},
    },
}

ALL_COUNTRIES = sorted(COUNTRY_LIMITS.keys())
