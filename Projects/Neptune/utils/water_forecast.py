"""Water availability and compliance timeline helpers for Neptune."""

from __future__ import annotations

from datetime import date
from typing import Dict, List

import pandas as pd

from utils.country_data import CLIMATE_DATA, WATER_STRESS


_DEPLETION_FACTOR = {
    "Low": 0.25,
    "Medium": 0.60,
    "High": 1.00,
    "Critical": 1.40,
}

_DROUGHT_FACTOR = {
    "Low": 0.15,
    "Low-Medium": 0.35,
    "Medium": 0.60,
    "Medium-High": 0.90,
    "High": 1.20,
    "Extreme": 1.50,
}

_REGION_BY_COUNTRY = {
    "Germany": "EU",
    "France": "EU",
    "Netherlands": "EU",
    "Belgium": "EU",
    "Spain": "EU",
    "Italy": "EU",
    "Poland": "EU",
    "Czech Republic": "EU",
    "Austria": "EU",
    "Sweden": "EU",
    "UK": "UK",
    "Norway": "EEA",
    "USA": "USA",
    "India": "India",
    "China": "China",
    "Brazil": "Brazil",
    "South Africa": "South Africa",
    "UAE": "GCC",
    "Saudi Arabia": "GCC",
    "Turkey": "Turkey",
    "Japan": "Japan",
    "Australia": "Australia",
    "Mexico": "Mexico",
}

_REGION_MILESTONES = {
    "EU": [
        {"name": "Industrial Emissions Directive Recast", "deadline": "2027-01-01", "type": "Permit"},
        {"name": "Urban Wastewater Treatment revision rollout", "deadline": "2028-12-31", "type": "Discharge"},
        {"name": "Water Framework Directive basin updates", "deadline": "2030-12-31", "type": "Basin"},
        {"name": "Climate adaptation reporting cycle", "deadline": "2033-12-31", "type": "Reporting"},
    ],
    "UK": [
        {"name": "EPR permit tightening cycle", "deadline": "2027-12-31", "type": "Permit"},
        {"name": "Catchment abstraction review", "deadline": "2029-12-31", "type": "Abstraction"},
        {"name": "Storm overflow and wastewater controls", "deadline": "2032-12-31", "type": "Discharge"},
    ],
    "EEA": [
        {"name": "National pollution permit revision", "deadline": "2028-12-31", "type": "Permit"},
        {"name": "River basin management update", "deadline": "2031-12-31", "type": "Basin"},
    ],
    "USA": [
        {"name": "NPDES permit renewal cycle", "deadline": "2027-12-31", "type": "Permit"},
        {"name": "ELG and pretreatment review", "deadline": "2029-12-31", "type": "Discharge"},
        {"name": "State basin drought allocation update", "deadline": "2032-12-31", "type": "Basin"},
    ],
    "India": [
        {"name": "CPCB industrial discharge revisions", "deadline": "2027-12-31", "type": "Discharge"},
        {"name": "Groundwater extraction NOC renewal", "deadline": "2028-12-31", "type": "Abstraction"},
        {"name": "River rejuvenation compliance milestone", "deadline": "2031-12-31", "type": "Basin"},
    ],
    "China": [
        {"name": "Provincial water permit recertification", "deadline": "2027-12-31", "type": "Permit"},
        {"name": "Industrial water-use efficiency target", "deadline": "2030-12-31", "type": "Efficiency"},
        {"name": "Five-year basin quality assessment", "deadline": "2032-12-31", "type": "Basin"},
    ],
    "Brazil": [
        {"name": "CONAMA permit reassessment", "deadline": "2028-12-31", "type": "Permit"},
        {"name": "National water resources plan update", "deadline": "2032-12-31", "type": "Basin"},
    ],
    "South Africa": [
        {"name": "Water Use License review", "deadline": "2028-12-31", "type": "Permit"},
        {"name": "Catchment strategy update", "deadline": "2031-12-31", "type": "Basin"},
    ],
    "GCC": [
        {"name": "Industrial wastewater code revision", "deadline": "2027-12-31", "type": "Discharge"},
        {"name": "Groundwater abstraction allocation review", "deadline": "2029-12-31", "type": "Abstraction"},
        {"name": "Water reuse mandatory target phase", "deadline": "2032-12-31", "type": "Reuse"},
    ],
    "Turkey": [
        {"name": "Water Pollution Control compliance cycle", "deadline": "2028-12-31", "type": "Discharge"},
        {"name": "River basin management update", "deadline": "2031-12-31", "type": "Basin"},
    ],
    "Japan": [
        {"name": "Effluent standards review", "deadline": "2028-12-31", "type": "Discharge"},
        {"name": "Drought management framework update", "deadline": "2031-12-31", "type": "Basin"},
    ],
    "Australia": [
        {"name": "State EPA license update", "deadline": "2027-12-31", "type": "Permit"},
        {"name": "Murray-Darling basin extraction review", "deadline": "2030-12-31", "type": "Abstraction"},
        {"name": "Water recycling target checkpoint", "deadline": "2033-12-31", "type": "Reuse"},
    ],
    "Mexico": [
        {"name": "NOM-001 enforcement checkpoint", "deadline": "2027-12-31", "type": "Discharge"},
        {"name": "Basin concession renewal cycle", "deadline": "2031-12-31", "type": "Abstraction"},
    ],
    "Global": [
        {"name": "Corporate water-risk disclosure cadence", "deadline": "2027-12-31", "type": "Reporting"},
        {"name": "Transition plan audit checkpoint", "deadline": "2030-12-31", "type": "Reporting"},
    ],
}


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def build_water_availability_projection(country: str, years: int = 10, start_year: int | None = None) -> pd.DataFrame:
    """Build a deterministic 10-year proxy forecast for river, aquifer and rainfall."""

    today = date.today()
    start = start_year or today.year

    climate = CLIMATE_DATA.get(country, {})
    stress = float(WATER_STRESS.get(country, 2.3))
    precip = float(climate.get("precip_mm", 780))
    soil = float(climate.get("soil_moisture_pct", 50))
    depletion_label = climate.get("groundwater_depletion", "Medium")
    drought_label = climate.get("drought_risk", "Medium")

    depletion = _DEPLETION_FACTOR.get(depletion_label, 0.75)
    drought = _DROUGHT_FACTOR.get(drought_label, 0.75)

    base_river = _clamp(112.0 - stress * 7.5 + soil * 0.18, 55.0, 120.0)
    base_aquifer = _clamp(108.0 - stress * 8.2 - depletion * 7.0 + soil * 0.10, 45.0, 115.0)

    # Negative trend means tightening availability over time.
    river_trend = -(0.55 * stress + 0.40 * drought)
    aquifer_trend = -(0.75 * stress + 0.90 * depletion)
    rain_trend = -(0.30 * stress + 0.35 * drought)

    rows: List[Dict[str, float]] = []
    for idx in range(years):
        year = start + idx
        cycle = ((idx % 4) - 1.5) * 0.8

        river_idx = _clamp(base_river + idx * river_trend + cycle, 20.0, 130.0)
        aquifer_idx = _clamp(base_aquifer + idx * aquifer_trend - cycle * 0.6, 15.0, 125.0)
        rainfall_mm = _clamp(precip + idx * rain_trend * 3.2 + cycle * 11.0, 40.0, 3000.0)

        combined = _clamp(river_idx * 0.45 + aquifer_idx * 0.45 + (rainfall_mm / max(precip, 1.0)) * 10.0, 10.0, 125.0)
        stress_risk = _clamp(100.0 - combined + stress * 6.0, 5.0, 100.0)

        rows.append(
            {
                "Year": year,
                "River Level Index": round(river_idx, 1),
                "Aquifer Level Index": round(aquifer_idx, 1),
                "Average Rainfall (mm)": round(rainfall_mm, 1),
                "Water Availability Index": round(combined, 1),
                "Water Stress Risk Index": round(stress_risk, 1),
            }
        )

    return pd.DataFrame(rows)


def build_compliance_timeline(country: str, start_year: int | None = None, horizon_years: int = 10) -> pd.DataFrame:
    """Return compliance and regulatory milestones for dashboard plotting."""

    today = date.today()
    start = start_year or today.year
    end = start + horizon_years

    region = _REGION_BY_COUNTRY.get(country, "Global")
    milestones = list(_REGION_MILESTONES.get(region, [])) + list(_REGION_MILESTONES["Global"])

    rows = []
    for item in milestones:
        deadline = pd.to_datetime(item["deadline"]).date()
        if start <= deadline.year <= end:
            days_left = (deadline - today).days
            if days_left <= 365:
                status = "Due in 12 months"
            elif days_left <= 3 * 365:
                status = "Near-term"
            else:
                status = "Long-term"

            rows.append(
                {
                    "Country": country,
                    "Region": region,
                    "Milestone": item["name"],
                    "Deadline": deadline,
                    "Type": item["type"],
                    "Status": status,
                    "Days Left": days_left,
                }
            )

    if not rows:
        return pd.DataFrame(columns=["Country", "Region", "Milestone", "Deadline", "Type", "Status", "Days Left"])

    return pd.DataFrame(rows).sort_values("Deadline").reset_index(drop=True)
