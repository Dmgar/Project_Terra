"""Reproducible real-data ingestion pipeline for Project Terra (Colombia).

Sources (all public, no API key required):
1. AGROSAVIA — Resultados de Análisis de Laboratorio Suelos en Colombia (datos.gov.co: ch4u-f3i5)
2. UPRA / MinAgricultura — Evaluaciones Agropecuarias Municipales EVA 2019–2025 (datos.gov.co: uejq-wxrr)
3. DANE — DIVIPOLA Municipios con coordenadas (datos.gov.co: gdxc-w37w)
4. NASA POWER — Agroclimatology Climatology API (T2M, RH2M, PRECTOTCORR)

Output:
- data/processed/colombia_agroclimatic_real.csv
- data/processed/nasa_power_municipios_cache.json (cached climate per DIVIPOLA municipality)
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from pathlib import Path
import re
import time
import unicodedata
import urllib.parse
import urllib.request

import numpy as np
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DIR = ROOT_DIR / "data" / "processed"
OUTPUT_CSV = PROCESSED_DIR / "colombia_agroclimatic_real.csv"
CLIMATE_CACHE_PATH = PROCESSED_DIR / "nasa_power_municipios_cache.json"

AGROSAVIA_ID = "ch4u-f3i5"
EVA_ID = "uejq-wxrr"
DIVIPOLA_ID = "gdxc-w37w"

# Mapping from exact AGROSAVIA 'cultivo' names to Project Terra's 6 canonical crops.
CROP_MAP: dict[str, str] = {
    "Arroz": "Rice",
    "Maíz": "Maize",
    "Maíz Forrajero": "Maize",
    "Papa": "Potato",
    "Papa de año": "Potato",
    "Papa Criolla": "Potato",
    "Tomate": "Tomato",
    "Caña": "Sugarcane",
    "Caña Panelera": "Sugarcane",
    "Caña Azucarera": "Sugarcane",
    "Trigo": "Wheat",
}

# Known municipality/department naming aliases between AGROSAVIA and DANE DIVIPOLA
DEPT_ALIASES: dict[str, str] = {
    "BOGOTA D C": "BOGOTA D C",
    "BOGOTA": "BOGOTA D C",
    "SANTAFE DE BOGOTA": "BOGOTA D C",
    "NORTE DE SANTANDER": "NORTE DE SANTANDER",
    "VALLE DEL CAUCA": "VALLE DEL CAUCA",
    "ARCHIPIELAGO DE SAN ANDRES": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
    "SAN ANDRES": "ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA",
}

MUNI_ALIASES: dict[str, str] = {
    "SAN ANDRES DE TUMACO": "TUMACO",
    "TUMACO": "SAN ANDRES DE TUMACO",
    "CARTAGENA": "CARTAGENA DE INDIAS",
    "BOGOTA": "BOGOTA D C",
    "SANTAFE DE BOGOTA": "BOGOTA D C",
    "ARMERO": "ARMERO GUAYABAL",
    "GUICAN": "GUICAN DE LA SIERRA",
    "SAN SEBASTIAN DE MARIQUITA": "MARIQUITA",
    "MARIQUITA": "SAN SEBASTIAN DE MARIQUITA",
    "SAN JOSE DE CUCUTA": "CUCUTA",
    "CUCUTA": "SAN JOSE DE CUCUTA",
    "SANTIAGO DE CALI": "CALI",
    "CALI": "SANTIAGO DE CALI",
    "SANTA CRUZ DE LORICA": "LORICA",
    "LORICA": "SANTA CRUZ DE LORICA",
    "DON MATIAS": "DONMATIAS",
    "SAN VICENTE": "SAN VICENTE FERRER",
    "EL CARMEN DE VIBORAL": "CARMEN DE VIBORAL",
    "CARMEN DE VIBORAL": "EL CARMEN DE VIBORAL",
    "VILLA DE SAN DIEGO DE UBATE": "UBATE",
    "UBATE": "VILLA DE SAN DIEGO DE UBATE",
    "SANTAFE DE ANTIOQUIA": "SANTA FE DE ANTIOQUIA",
    "PIENDAMO": "PIENDAMO TUNIA",
    "LOPEZ": "LOPEZ DE MICAY",
    "CUASPUD": "CUASPUD CARLOSAMA",
}

# Atomic weight of K = 39.0983 g/mol -> 1 cmol(+)/kg = 390.983 mg/kg (ppm)
K_CMOL_TO_MG_KG = 390.983
# Plant-available / mineralizable N proxy: ~20 mg/kg per 1% organic matter
# (MO * 5% = total organic N; ~4% mineralizable pool -> 20 mg/kg per 1% MO)
MO_PCT_TO_AVAIL_N_MG_KG = 20.0
DAYS_PER_MONTH = 30.4375


def normalize_text(value: str | None) -> str:
    """Uppercase, strip accents and punctuation for robust geographic joins."""
    if not value or pd.isna(value):
        return ""
    s = unicodedata.normalize("NFKD", str(value))
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"[^A-Za-z0-9]+", " ", s).upper().strip()
    return s


def parse_lab_number(val: object) -> float:
    """Parse AGROSAVIA laboratory string values, handling '<LOD', '>ULOQ', commas, and 'ND'."""
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return np.nan
    s = str(val).strip().replace(",", ".")
    if not s or s.upper() in {"ND", "NA", "N/A", "NO INDICA", "NULL", "-"}:
        return np.nan
    if s.startswith("<"):
        try:
            # Standard left-censored substitution: LOD / 2
            return float(s[1:].strip()) * 0.5
        except ValueError:
            return np.nan
    if s.startswith(">"):
        try:
            return float(s[1:].strip())
        except ValueError:
            return np.nan
    try:
        return float(s)
    except ValueError:
        return np.nan


def fetch_json(url: str, timeout: int = 30, retries: int = 3) -> list | dict:
    """Fetch JSON with simple exponential backoff."""
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "ProjectTerra-Ingest/1.0"}
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            last_err = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Failed to fetch {url}: {last_err}")


def fetch_socrata_paginated(
    dataset_id: str,
    select: str,
    where: str | None = None,
    page_size: int = 50000,
) -> list[dict]:
    """Fetch all rows matching a SoQL query with offset pagination."""
    rows: list[dict] = []
    offset = 0
    while True:
        params: dict[str, str | int] = {
            "$select": select,
            "$limit": page_size,
            "$offset": offset,
        }
        if where:
            params["$where"] = where
        url = (
            f"https://www.datos.gov.co/resource/{dataset_id}.json?"
            + urllib.parse.urlencode(params)
        )
        batch = fetch_json(url, timeout=45)
        if not isinstance(batch, list) or not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def load_divipola() -> pd.DataFrame:
    """Download DANE DIVIPOLA municipalities with lat/lon coordinates."""
    rows = fetch_socrata_paginated(
        DIVIPOLA_ID,
        select="cod_dpto, dpto, cod_mpio, nom_mpio, longitud, latitud",
        page_size=5000,
    )
    df = pd.DataFrame(rows)
    df["latitud"] = df["latitud"].map(parse_lab_number)
    df["longitud"] = df["longitud"].map(parse_lab_number)
    df["dpto_norm"] = df["dpto"].map(normalize_text)
    df["mpio_norm"] = df["nom_mpio"].map(normalize_text)
    df = df.dropna(subset=["latitud", "longitud"]).drop_duplicates(
        subset=["cod_mpio"]
    )
    return df


def load_eva_wheat_municipalities(min_ha: float = 20.0) -> pd.DataFrame:
    """Fetch verified Colombian wheat-producing municipalities from UPRA EVA 2019-2025."""
    params = {
        "$select": (
            "departamento, municipio, c_digo_dane_municipio, "
            "sum(rea_sembrada) as total_ha, avg(rendimiento) as avg_yield_t_ha"
        ),
        "$where": "upper(cultivo) = 'TRIGO'",
        "$group": "departamento, municipio, c_digo_dane_municipio",
        "$order": "total_ha DESC",
        "$limit": 200,
    }
    url = (
        f"https://www.datos.gov.co/resource/{EVA_ID}.json?"
        + urllib.parse.urlencode(params)
    )
    rows = fetch_json(url, timeout=30)
    df = pd.DataFrame(rows)
    df["total_ha"] = df["total_ha"].map(parse_lab_number)
    df["avg_yield_t_ha"] = df["avg_yield_t_ha"].map(parse_lab_number)
    df = df[df["total_ha"] >= min_ha].copy()
    df["dpto_norm"] = df["departamento"].map(normalize_text)
    df["mpio_norm"] = df["municipio"].map(normalize_text)
    return df


def load_agrosavia_direct_crops() -> pd.DataFrame:
    """Fetch AGROSAVIA lab samples for Project Terra's 6 canonical crops."""
    crop_list = ", ".join(f"'{c}'" for c in CROP_MAP)
    select = (
        "secuencial, fecha_de_an_lisis, departamento, municipio, cultivo, "
        "topografia, drenaje, riego, ph_agua_suelo, materia_organica, "
        "fosforo_bray_ii, potasio_intercambiable, calcio_intercambiable, "
        "magnesio_intercambiable, capacidad_de_intercambio_cationico, "
        "conductividad_electrica"
    )
    where = f"cultivo in ({crop_list})"
    rows = fetch_socrata_paginated(AGROSAVIA_ID, select=select, where=where)
    df = pd.DataFrame(rows)
    df["Crop"] = df["cultivo"].map(CROP_MAP)
    df["label_source"] = "agrosavia_direct"
    return df


def load_agrosavia_wheat_enrichment(
    eva_wheat: pd.DataFrame, max_samples: int = 800
) -> pd.DataFrame:
    """Fetch real AGROSAVIA soil lab analyses in UPRA-EVA wheat-producing municipalities.

    Excludes records already labeled as one of the other 5 Project Terra crops to prevent
    duplicate samples with conflicting labels.
    """
    # Query AGROSAVIA for Boyacá and Nariño (the two main wheat departments in EVA)
    top_depts = eva_wheat["dpto_norm"].unique().tolist()
    dept_clauses = " OR ".join(
        f"upper(departamento) like '%{d[:6]}%'" for d in top_depts[:4]
    )
    select = (
        "secuencial, fecha_de_an_lisis, departamento, municipio, cultivo, "
        "topografia, drenaje, riego, ph_agua_suelo, materia_organica, "
        "fosforo_bray_ii, potasio_intercambiable, calcio_intercambiable, "
        "magnesio_intercambiable, capacidad_de_intercambio_cationico, "
        "conductividad_electrica"
    )
    rows = fetch_socrata_paginated(
        AGROSAVIA_ID, select=select, where=dept_clauses
    )
    df = pd.DataFrame(rows)
    if df.empty:
        return df

    df["dpto_norm"] = df["departamento"].map(normalize_text)
    df["mpio_norm"] = df["municipio"].map(normalize_text)

    wheat_pairs = set(
        zip(eva_wheat["dpto_norm"], eva_wheat["mpio_norm"], strict=False)
    )
    # Keep only municipalities verified in UPRA EVA as wheat producers,
    # and exclude samples already tagged with another Terra crop
    other_crops = {k for k, v in CROP_MAP.items() if v != "Wheat"}
    mask_muni = pd.Series(
        [
            (d, m) in wheat_pairs
            for d, m in zip(df["dpto_norm"], df["mpio_norm"], strict=False)
        ],
        index=df.index,
    )
    df = df[mask_muni & (~df["cultivo"].isin(other_crops))].copy()
    # Exclude direct 'Trigo' rows already fetched in load_agrosavia_direct_crops()
    df = df[df["cultivo"] != "Trigo"].copy()

    if len(df) > max_samples:
        df = df.sample(n=max_samples, random_state=42)

    df["Crop"] = "Wheat"
    df["label_source"] = "eva_wheat_municipality"
    return df.drop(columns=["dpto_norm", "mpio_norm"])


def match_divipola(df: pd.DataFrame, divipola: pd.DataFrame) -> pd.DataFrame:
    """Attach DANE cod_mpio, latitud, and longitud to AGROSAVIA records."""
    df = df.copy()
    df["dpto_norm"] = df["departamento"].map(normalize_text).replace(DEPT_ALIASES)
    df["mpio_norm"] = df["municipio"].map(normalize_text)

    # Exact (dpto, mpio) lookup
    exact_lookup: dict[tuple[str, str], tuple[str, float, float]] = {}
    mpio_only_counts = divipola["mpio_norm"].value_counts()
    unique_mpio_lookup: dict[str, tuple[str, float, float]] = {}

    for row in divipola.itertuples(index=False):
        key = (row.dpto_norm, row.mpio_norm)
        val = (str(row.cod_mpio), float(row.latitud), float(row.longitud))
        exact_lookup[key] = val
        if mpio_only_counts[row.mpio_norm] == 1:
            unique_mpio_lookup[row.mpio_norm] = val

    cods, lats, lons = [], [], []
    for d, m in zip(df["dpto_norm"], df["mpio_norm"], strict=False):
        hit = exact_lookup.get((d, m))
        if hit is None and m in MUNI_ALIASES:
            hit = exact_lookup.get((d, MUNI_ALIASES[m]))
        if hit is None:
            # Try prefix match within same department (e.g. "GUICAN" vs "GUICAN DE LA SIERRA")
            for (kd, km), val in exact_lookup.items():
                if kd == d and m and (km.startswith(m) or m.startswith(km)):
                    hit = val
                    break
        if hit is None:
            hit = unique_mpio_lookup.get(m)
        if hit is None:
            cods.append(None)
            lats.append(np.nan)
            lons.append(np.nan)
        else:
            cods.append(hit[0])
            lats.append(hit[1])
            lons.append(hit[2])

    df["cod_mpio"] = cods
    df["latitud"] = lats
    df["longitud"] = lons
    return df.drop(columns=["dpto_norm", "mpio_norm"])


def fetch_nasa_power_point(
    cod_mpio: str, lat: float, lon: float
) -> tuple[str, dict[str, float] | None]:
    """Query NASA POWER Climatology API (T2M, RH2M, PRECTOTCORR) for a coordinate."""
    url = (
        "https://power.larc.nasa.gov/api/temporal/climatology/point?"
        f"parameters=T2M,RH2M,PRECTOTCORR&community=AG"
        f"&longitude={lon:.4f}&latitude={lat:.4f}&format=JSON"
    )
    try:
        data = fetch_json(url, timeout=25, retries=3)
        params = data["properties"]["parameter"]
        t2m = float(params["T2M"]["ANN"])
        rh2m = float(params["RH2M"]["ANN"])
        prec_day = float(params["PRECTOTCORR"]["ANN"])
        if any(v <= -900 for v in (t2m, rh2m, prec_day)):
            return cod_mpio, None
        return cod_mpio, {
            "Temperature": round(t2m, 2),
            "Humidity": round(rh2m, 2),
            "Rainfall_monthly_mm": round(prec_day * DAYS_PER_MONTH, 2),
            "Rainfall_annual_mm": round(prec_day * 365.25, 1),
        }
    except Exception:
        return cod_mpio, None


def enrich_climate_nasa_power(
    df: pd.DataFrame, max_workers: int = 8
) -> pd.DataFrame:
    """Attach NASA POWER climatology per unique DIVIPOLA municipality with disk caching."""
    cache: dict[str, dict[str, float]] = {}
    if CLIMATE_CACHE_PATH.exists():
        cache = json.loads(CLIMATE_CACHE_PATH.read_text(encoding="utf-8"))

    unique_munis = (
        df[["cod_mpio", "latitud", "longitud"]]
        .dropna()
        .drop_duplicates(subset=["cod_mpio"])
    )
    missing = [
        (row.cod_mpio, row.latitud, row.longitud)
        for row in unique_munis.itertuples(index=False)
        if row.cod_mpio not in cache
    ]

    if missing:
        print(
            f"Querying NASA POWER for {len(missing)} unique municipalities "
            f"({len(cache)} cached)..."
        )
        done = 0
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            futures = [
                pool.submit(fetch_nasa_power_point, cod, lat, lon)
                for cod, lat, lon in missing
            ]
            for fut in as_completed(futures):
                cod, res = fut.result()
                if res is not None:
                    cache[cod] = res
                done += 1
                if done % 50 == 0 or done == len(missing):
                    print(f"  NASA POWER progress: {done}/{len(missing)}")
                    CLIMATE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
                    CLIMATE_CACHE_PATH.write_text(
                        json.dumps(cache, indent=2), encoding="utf-8"
                    )

    df = df.copy()
    df["Temperature"] = df["cod_mpio"].map(
        lambda c: cache[c]["Temperature"] if c in cache else np.nan
    )
    df["Humidity"] = df["cod_mpio"].map(
        lambda c: cache[c]["Humidity"] if c in cache else np.nan
    )
    df["Rainfall"] = df["cod_mpio"].map(
        lambda c: cache[c]["Rainfall_monthly_mm"] if c in cache else np.nan
    )
    df["rainfall_annual_mm"] = df["cod_mpio"].map(
        lambda c: cache[c]["Rainfall_annual_mm"] if c in cache else np.nan
    )
    return df


def derive_soil_type(row: pd.Series) -> str:
    """Derive Project Terra's 6 Soil_Type categories from real lab chemistry & drainage."""
    ce = row["ce_ds_m"]
    mo = row["materia_organica_pct"]
    cice = row["cice_cmol_kg"]
    drenaje = str(row.get("drenaje", "")).lower()

    if pd.notna(ce) and ce >= 2.0:
        return "Saline"
    if pd.notna(mo) and mo >= 12.0:
        return "Peaty"
    if (pd.notna(cice) and cice >= 25.0) or "mal drenaje" in drenaje:
        return "Clay"
    if pd.notna(cice) and cice < 8.0 and (pd.isna(mo) or mo < 2.0):
        return "Sandy"
    if "regular" in drenaje:
        return "Silt"
    return "Loamy"


def clean_and_format(df: pd.DataFrame) -> pd.DataFrame:
    """Convert raw AGROSAVIA + NASA POWER columns into Project Terra's clean 7D schema."""
    out = pd.DataFrame()
    out["secuencial"] = df["secuencial"]
    out["departamento"] = df["departamento"]
    out["municipio"] = df["municipio"]
    out["cod_mpio"] = df["cod_mpio"]
    out["latitud"] = df["latitud"]
    out["longitud"] = df["longitud"]
    out["cultivo_raw"] = df["cultivo"]
    out["label_source"] = df["label_source"]
    out["Crop"] = df["Crop"]

    # Raw lab measurements preserved for scientific traceability
    out["pH_Value"] = df["ph_agua_suelo"].map(parse_lab_number)
    out["materia_organica_pct"] = df["materia_organica"].map(parse_lab_number)
    out["Phosphorus"] = df["fosforo_bray_ii"].map(parse_lab_number)
    out["potasio_cmol_kg"] = df["potasio_intercambiable"].map(parse_lab_number)
    out["cice_cmol_kg"] = df["capacidad_de_intercambio_cationico"].map(
        parse_lab_number
    )
    out["ce_ds_m"] = df["conductividad_electrica"].map(parse_lab_number)
    out["drenaje"] = df["drenaje"]
    out["topografia"] = df["topografia"]

    # Standardized Project Terra 7D units
    out["Nitrogen"] = (out["materia_organica_pct"] * MO_PCT_TO_AVAIL_N_MG_KG).round(2)
    out["Potassium"] = (out["potasio_cmol_kg"] * K_CMOL_TO_MG_KG).round(2)
    out["Temperature"] = df["Temperature"]
    out["Humidity"] = df["Humidity"]
    out["Rainfall"] = df["Rainfall"]
    out["rainfall_annual_mm"] = df["rainfall_annual_mm"]

    # Drop rows missing any of the 7 core environmental features
    core_cols = [
        "Nitrogen",
        "Phosphorus",
        "Potassium",
        "Temperature",
        "Humidity",
        "pH_Value",
        "Rainfall",
    ]
    out = out.dropna(subset=core_cols + ["Crop"]).copy()

    # Filter physically impossible / extreme lab typos (keep realistic agronomic ranges)
    valid = (
        out["pH_Value"].between(3.0, 9.5)
        & out["Nitrogen"].between(0.0, 400.0)
        & out["Phosphorus"].between(0.0, 400.0)
        & out["Potassium"].between(0.0, 1500.0)
        & out["Temperature"].between(4.0, 40.0)
        & out["Humidity"].between(15.0, 100.0)
        & out["Rainfall"].between(10.0, 600.0)
    )
    out = out[valid].copy()

    out["Soil_Type"] = out.apply(derive_soil_type, axis=1)

    # Deduplicate by AGROSAVIA sample ID if any overlap occurred
    out = out.drop_duplicates(subset=["secuencial"]).reset_index(drop=True)

    # Order columns with Project Terra's canonical 7D features first
    ordered_cols = [
        "Nitrogen",
        "Phosphorus",
        "Potassium",
        "Temperature",
        "Humidity",
        "pH_Value",
        "Rainfall",
        "Crop",
        "Soil_Type",
        "label_source",
        "cultivo_raw",
        "departamento",
        "municipio",
        "cod_mpio",
        "latitud",
        "longitud",
        "materia_organica_pct",
        "potasio_cmol_kg",
        "cice_cmol_kg",
        "ce_ds_m",
        "rainfall_annual_mm",
        "drenaje",
        "topografia",
        "secuencial",
    ]
    return out[ordered_cols]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest real Colombian agroclimatic data for Project Terra."
    )
    parser.add_argument(
        "--wheat-max-samples",
        type=int,
        default=800,
        help="Max AGROSAVIA soil samples from UPRA-EVA wheat municipalities.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=8,
        help="Concurrent workers for NASA POWER municipality queries.",
    )
    args = parser.parse_args()

    print("1/5 Loading DANE DIVIPOLA municipalities...")
    divipola = load_divipola()
    print(f"    DIVIPOLA loaded: {len(divipola)} municipalities")

    print("2/5 Loading UPRA EVA wheat-producing municipalities...")
    eva_wheat = load_eva_wheat_municipalities(min_ha=20.0)
    print(f"    EVA wheat municipalities (>=20 ha): {len(eva_wheat)}")

    print("3/5 Loading AGROSAVIA direct crop lab samples...")
    direct_df = load_agrosavia_direct_crops()
    print(f"    AGROSAVIA direct rows: {len(direct_df)}")

    print("4/5 Enriching Wheat with real AGROSAVIA soils from EVA wheat municipalities...")
    wheat_df = load_agrosavia_wheat_enrichment(
        eva_wheat, max_samples=args.wheat_max_samples
    )
    print(f"    AGROSAVIA wheat-municipality rows: {len(wheat_df)}")

    combined = pd.concat([direct_df, wheat_df], ignore_index=True)
    combined = match_divipola(combined, divipola)
    matched = combined["cod_mpio"].notna().sum()
    print(
        f"    Georeferenced to DIVIPOLA: {matched}/{len(combined)} "
        f"({matched / len(combined) * 100:.1f}%)"
    )

    print("5/5 Enriching climate via NASA POWER Climatology API...")
    combined = enrich_climate_nasa_power(combined, max_workers=args.workers)

    clean_df = clean_and_format(combined)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    clean_df.to_csv(OUTPUT_CSV, index=False)

    print(f"\nSaved real dataset: {OUTPUT_CSV} ({len(clean_df)} rows, {clean_df['cod_mpio'].nunique()} municipalities)")
    print("\nCrop distribution:")
    print(clean_df["Crop"].value_counts().to_string())
    print("\nLabel source distribution:")
    print(clean_df["label_source"].value_counts().to_string())
    print("\nFeature summary (median / IQR):")
    feats = [
        "Nitrogen",
        "Phosphorus",
        "Potassium",
        "Temperature",
        "Humidity",
        "pH_Value",
        "Rainfall",
    ]
    print(clean_df[feats].describe().T[["min", "25%", "50%", "75%", "max"]].round(2).to_string())


if __name__ == "__main__":
    main()
