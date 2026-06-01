# -*- coding: utf-8 -*-
"""
Created on Thu Apr  3 11:45:59 2025

Copyright © 2025-2026 3D geoinformation group, TU Delft and Daan van den Heide. All rights reserved.
"""

import json
import os
import re
import pandas as pd
import geopandas as gpd
import fiona
import click
import logging
from shapely.geometry import Point

logging.basicConfig(level=logging.WARNING, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
MERGED_VALUE_SEPARATOR = " || "
ADM_COLUMN_CANDIDATES = ('ADM', 'AMD', 'adm', 'amd', 'ADM_LEVEL', 'admin_level', 'Admin Level')
MAIN_COUNTRY_COLUMN_CANDIDATES = ('main_country', 'Main Country', 'country', 'Country')
REGION_NAME_COLUMN_CANDIDATES = ('Name', 'name', 'region', 'Region', 'region_name', 'Region Name')
ADM_NAME_COLUMN = {
    0: 'COUNTRY',
    1: 'NAME_1',
    2: 'NAME_2',
    3: 'NAME_3',
}
CANONICAL_COLUMN_ALIASES = {
    'Name': ('Name', 'name', 'region', 'Region'),
    'main_country': ('main_country', 'Main Country', 'country', 'Country'),
    'ADM': ('ADM', 'AMD', 'adm', 'amd', 'ADM_LEVEL', 'admin_level', 'Admin Level'),
    'year_begin': ('year_begin', 'Year_begin', 'start_year', 'Start year'),
    'year_end': ('year_end', 'Year_end', 'end_year', 'End year'),
    'Responsible': ('Responsible', 'responsible', 'Agency', 'agency'),
    'dataset_name': ('dataset_name', 'Dataset_name', 'Dataset Name', 'Data Name'),
    'Licence': ('Licence', 'License', 'licence', 'license'),
    'Data': ('Data', 'data'),
    'Fee': ('Fee', 'fee'),
    'DSM': ('DSM', 'dsm'),
    'DTM': ('DTM', 'dtm'),
    'DSM_scale': ('DSM_scale', 'DSM scale', 'dsm_scale'),
    'DTM_scale': ('DTM_scale', 'DTM scale', 'dtm_scale'),
    'link_info': ('link_info', 'Link_info', 'documentation_link', 'Documentation link'),
    'link_point_cloud': ('link_point_cloud', 'Link_point_cloud', 'link_point cloud', 'Link point cloud', 'dataroom', 'Dataroom'),
    'classification': ('classification', 'Classification')
}


def export_geojson_outputs(result_gdf, output_dir):
    """
    Export the single unified GeoJSON used by the website.
    """
    unified_gdf = prepare_unified_export_gdf(result_gdf)
    unified_output_file = os.path.join(output_dir, 'map_data_unified.geojson')
    unified_gdf.to_file(unified_output_file, driver='GeoJSON')
    return unified_output_file


def prepare_unified_export_gdf(result_gdf):
    """
    Prepare the website's unified export dataset.
    """
    if 'country' in result_gdf.columns:
        result_gdf = result_gdf[result_gdf['country'].astype(str).str.lower() != 'global']
    total = len(result_gdf)
    geom_col = result_gdf.geometry.name
    for i, idx in enumerate(result_gdf.index, start=1):
        result_gdf.at[idx, geom_col] = result_gdf.geometry[idx].simplify(0.001)
        if i % max(1, total // 10) == 0 or i == total:
            logger.info(f"Simplifying geometries: {i}/{total} ({100 * i // total}%)")

    return result_gdf


def load_input_table(input_file):
    """
    Load either an Excel workbook or CSV file and normalize the headers.
    """
    extension = os.path.splitext(input_file)[1].lower()
    if extension in {'.xlsx', '.xls'}:
        df = pd.read_excel(input_file)
    elif extension == '.csv':
        df = pd.read_csv(input_file, sep=None, engine='python')
    else:
        raise click.BadParameter(
            f"Unsupported input file type: {extension}. Use .xlsx, .xls or .csv."
        )

    df.columns = [str(col).strip() for col in df.columns]
    df = normalize_input_columns(df)
    return df


def ensure_canonical_column(df, canonical_name, candidates):
    """
    Ensure a canonical column exists in the DataFrame by aliasing the first
    matching candidate column.

    If one of the candidate column names is present in ``df`` and the canonical
    name is not already a column, the candidate's values are copied to a new
    column named ``canonical_name``. If the canonical column already exists,
    or no candidate is found, the DataFrame is left unchanged.

    Parameters
    ----------
    df : pandas.DataFrame
        The input DataFrame to inspect and potentially modify in-place.
    canonical_name : str
        The target column name to create if absent.
    candidates : iterable of str
        Ordered list of alternative column names to search for.
    """
    for candidate in candidates:
        if candidate in df.columns:
            if candidate != canonical_name and canonical_name not in df.columns:
                df[canonical_name] = df[candidate]
            return


def combine_year_columns(row):
    """
    Combine ``year_begin`` and ``year_end`` fields into a single human-readable
    year string for a given row.

    Rules applied:
    - If both are missing, fall back to the existing ``Year`` field.
    - If both are present and equal, return that single value.
    - If both are present and different, return ``"<start> - <end>"``.
    - If only one is present, return that value.

    Parameters
    ----------
    row : pandas.Series
        A single row from the dataset DataFrame.

    Returns
    -------
    str or None
        The combined year string, or the fallback ``Year`` value.
    """
    start = row.get('year_begin')
    end = row.get('year_end')
    if pd.isna(start) and pd.isna(end):
        return row.get('Year')
    start_text = '' if pd.isna(start) else str(start).strip()
    end_text = '' if pd.isna(end) else str(end).strip()
    if start_text and end_text:
        return start_text if start_text == end_text else f'{start_text} - {end_text}'
    return start_text or end_text or row.get('Year')


def normalize_input_columns(df):
    """
    Apply all column normalizations to the input DataFrame.

    This function:
    1. Iterates over ``CANONICAL_COLUMN_ALIASES`` and calls
       :func:`ensure_canonical_column` for each entry so that every expected
       column exists under its canonical name regardless of the source header
       used in the spreadsheet.
    2. Creates convenience aliases (``Data Provider``, ``Data Name``,
       ``Documentation link``, ``Dataroom``, ``Link``,
       ``Classification available``) expected by the website frontend.
    3. Calls :func:`combine_year_columns` row-wise to populate a unified
       ``Year`` column when ``year_begin`` / ``year_end`` are present.

    Parameters
    ----------
    df : pandas.DataFrame
        Raw DataFrame loaded from the input spreadsheet.

    Returns
    -------
    pandas.DataFrame
        The same DataFrame with normalised and aliased columns added in-place.
    """
    for canonical_name, candidates in CANONICAL_COLUMN_ALIASES.items():
        ensure_canonical_column(df, canonical_name, candidates)

    if 'Responsible' in df.columns and 'Data Provider' not in df.columns:
        df['Data Provider'] = df['Responsible']

    if 'dataset_name' in df.columns and 'Data Name' not in df.columns:
        df['Data Name'] = df['dataset_name']

    if 'link_info' in df.columns and 'Documentation link' not in df.columns:
        df['Documentation link'] = df['link_info']

    if 'link_point_cloud' in df.columns and 'Dataroom' not in df.columns:
        df['Dataroom'] = df['link_point_cloud']
    if 'link_point_cloud' in df.columns and 'Link' not in df.columns:
        df['Link'] = df['link_point_cloud']

    if 'year_begin' in df.columns or 'year_end' in df.columns:
        df['Year'] = df.apply(combine_year_columns, axis=1)

    if 'classification' in df.columns and 'Classification available' not in df.columns:
        df['Classification available'] = df['classification']

    return df

def resolve_column(df: pd.DataFrame, candidates: tuple) -> str:
    """
    Resolve a column from a list of candidate names.
    Raises ValueError if none of the candidates are found.
    """
    match = next((c for c in candidates if c in df.columns), None)
    if match is None:
        raise ValueError(
            f"Input file is missing a required column. "
            f"Expected one of: {', '.join(candidates)}. "
            f"Available columns: {', '.join(map(str, df.columns))}"
        )
    return match


def normalize_name(value):
    """
    Normalize a place name for case-insensitive comparison.

    Strips surrounding whitespace and converts to upper-case. Returns an empty
    string for ``None`` or ``NaN`` values.

    Parameters
    ----------
    value : str or None
        The raw name value from the spreadsheet or GeoPackage attribute.

    Returns
    -------
    str
        Upper-cased, whitespace-stripped version of ``value``, or ``''``.
    """
    if value is None or pd.isna(value):
        return ''
    return str(value).strip().upper()


def normalize_special_lookup(value):
    """
    Normalize a special-boundary lookup key for filename matching.

    Converts to lower-case, strips a trailing ``.gpkg`` extension if present,
    then replaces any run of non-alphanumeric characters with ``_`` and strips
    leading/trailing underscores. Used to compare the ADM field value from the
    spreadsheet against GeoPackage filenames in the special directory.

    Parameters
    ----------
    value : str or None
        The raw ADM field value (e.g. ``"research"`` or ``"My Region.gpkg"``).

    Returns
    -------
    str
        Normalised, filesystem-friendly key string, or ``''`` for empty input.
    """
    if value is None or pd.isna(value):
        return ''
    text = str(value).strip().lower()
    text = re.sub(r'\.gpkg$', '', text)
    text = re.sub(r'[^a-z0-9]+', '_', text)
    return text.strip('_')


def resolve_adm_value(raw_value: str) -> int | str | None:
    """
    Return an int ADM level, a str special-boundary lookup key, or None for
    missing/empty input. The return type indicates which case applies:
    - int  → numeric ADM level
    - str  → special-boundary lookup key
    - None → missing or empty value
    """
    if raw_value is None or pd.isna(raw_value):
        return None
    text = str(raw_value).strip()
    numeric = pd.to_numeric(text, errors='coerce')
    return int(numeric) if pd.notna(numeric) else (text or None)


def find_special_gpkg(special_dir, lookup_value):
    """
    Find a GeoPackage in the special directory by normalized stem.
    """
    if not special_dir or not os.path.isdir(special_dir):
        return None

    normalized_lookup = normalize_special_lookup(lookup_value)
    if not normalized_lookup:
        return None

    gpkg_files = [
        os.path.join(special_dir, entry)
        for entry in os.listdir(special_dir)
        if entry.lower().endswith('.gpkg')
    ]
    normalized_paths = {
        path: normalize_special_lookup(os.path.splitext(os.path.basename(path))[0])
        for path in gpkg_files
    }

    for path, normalized_name in normalized_paths.items():
        if normalized_name == normalized_lookup:
            return path

    for path, normalized_name in normalized_paths.items():
        if normalized_lookup in normalized_name or normalized_name in normalized_lookup:
            return path

    return None


def load_special_features(gpkg_path, target_crs=None):
    """
    Load all geometries from all layers of a special GeoPackage.
    """
    layers = fiona.listlayers(gpkg_path)
    loaded_layers = []

    for layer in layers:
        layer_gdf = gpd.read_file(gpkg_path, layer=layer)
        if layer_gdf.empty or 'geometry' not in layer_gdf:
            continue
        layer_gdf = layer_gdf[layer_gdf.geometry.notna()].copy()
        if layer_gdf.empty:
            continue
        loaded_layers.append(layer_gdf)

    if not loaded_layers:
        return gpd.GeoDataFrame(geometry=[], crs=None)

    special_gdf = pd.concat(loaded_layers, ignore_index=True)
    special_gdf = gpd.GeoDataFrame(special_gdf, geometry='geometry', crs=loaded_layers[0].crs)
    if target_crs and special_gdf.crs and str(special_gdf.crs) != str(target_crs):
        special_gdf = special_gdf.to_crs(target_crs)
    return special_gdf


def special_match_mask(layer_gdf, name):
    """
    Match a special-boundary feature against the dataset name, using fields such
    as `place` when present in the GeoPackage.
    """
    name = normalize_name(name)
    if not name:
        return pd.Series(False, index=layer_gdf.index)

    candidate_columns = [
        col for col in [
            'place', 'Place', 'PLACE',
            'name', 'Name', 'NAME',
            'site', 'Site', 'SITE',
            'location', 'Location', 'LOCATION'
        ] if col in layer_gdf.columns
    ]
    if not candidate_columns:
        return pd.Series(False, index=layer_gdf.index)

    mask = pd.Series(False, index=layer_gdf.index)
    for column in candidate_columns:
        values = layer_gdf[column].fillna('').astype(str).str.upper()
        mask = mask | values.eq(name) | values.str.contains(
            rf'(?:^|[|,;])\s*{re.escape(name)}\s*(?:$|[|,;])',
            regex=True
        )

    return mask


def resolve_special_feature_name(row):
    """
    Resolve the feature name to look up inside a special GeoPackage.
    For research datasets, the spreadsheet often stores the country in `Name`
    and the actual place in `Name.1`.
    """
    for key in ['Name.1', 'place', 'Place', 'location', 'Location', 'match_name']:
        if key in row.index:
            value = row.get(key)
            if value is not None and not pd.isna(value) and str(value).strip():
                return value
    return row.get('match_name')

def parse_coordinate_value(value):
    """
    Extract a decimal coordinate (latitude or longitude) from a raw cell value.

    Handles values stored as numbers, strings with units, or strings that use a
    comma as the decimal separator. Returns ``None`` when no valid numeric
    pattern is found.

    Parameters
    ----------
    value : str, int, float or None
        Raw coordinate cell value from the spreadsheet.

    Returns
    -------
    float or None
        Parsed coordinate as a float, or ``None`` if parsing fails.
    """
    if value is None or pd.isna(value):
        return None
    match = re.search(r'-?\d+(?:[,.]\d+)?', str(value).strip())
    if not match:
        return None
    try:
        return float(match.group(0).replace(',', '.'))
    except ValueError:
        return None


def get_explicit_research_point(row, target_crs=None):
    """
    Build a Point geometry from explicit latitude/longitude columns in a row.

    Searches a prioritised list of candidate column names for longitude and
    latitude values, parses them with :func:`parse_coordinate_value`, and
    validates the coordinate range. When ``target_crs`` is supplied the point
    is reprojected from ``EPSG:4326``.

    Parameters
    ----------
    row : pandas.Series
        A single row from the dataset DataFrame that may contain coordinate
        columns.
    target_crs : str or pyproj.CRS or None
        Target coordinate reference system for the returned geometry. When
        ``None`` the geometry is returned in ``EPSG:4326``.

    Returns
    -------
    shapely.geometry.Point or None
        A point geometry in the requested CRS, or ``None`` if no valid
        coordinates are found.
    """
    lon_candidates = ('longitude', 'Longitude', 'LONGITUDE', 'lng', 'Lng', 'LNG', 'lon', 'Lon', 'LON')
    lat_candidates = ('latitude', 'Latitude', 'LATITUDE', 'lat', 'Lat', 'LAT')

    lon = None
    for col in lon_candidates:
        if col not in row.index:
            continue
        lon = parse_coordinate_value(row.get(col))
        if lon is not None:
            break

    lat = None
    for col in lat_candidates:
        if col not in row.index:
            continue
        lat = parse_coordinate_value(row.get(col))
        if lat is not None:
            break

    if lon is None or lat is None or not (-180 <= lon <= 180 and -90 <= lat <= 90):
        return None

    point = Point(lon, lat)
    if target_crs:
        point = gpd.GeoSeries([point], crs='EPSG:4326').to_crs(target_crs).iloc[0]
    return point


def AMD_reader(matched_rows, adm_match, row, special_dir, special_lookup=None, target_crs=None, country_boundaries=None):
    """
    Process a match from ADM layers or search in special directory if no match is found.
    """
    if adm_match.empty:
        logger.info(f'No ADM match found for {row["match_name"]}, searching in special directory...')
        lookup_name = special_lookup or row['match_name']
        normalized_lookup = normalize_special_lookup(lookup_name)
        gadm_gpkg = find_special_gpkg(special_dir, lookup_name)

        if gadm_gpkg and os.path.exists(gadm_gpkg):
            try:
                special_gdf = load_special_features(gadm_gpkg, target_crs=target_crs)
                special_target_name = resolve_special_feature_name(row)
                special_mask = special_match_mask(special_gdf, special_target_name)
                if special_mask.any():
                    special_gdf = special_gdf[special_mask].copy()
                elif any(col in special_gdf.columns for col in ['place', 'Place', 'PLACE', 'name', 'Name', 'NAME']):
                    logger.warning(
                        f'No special feature name match found for {special_target_name} in {gadm_gpkg}'
                    )
                    return matched_rows

                for _, feat in special_gdf.iterrows():
                    matched_row = row.drop('match_name').to_dict()
                    for col in getattr(special_gdf, 'columns', []):
                        if col == 'geometry':
                            continue
                        feat_value = feat.get(col)
                        if feat_value is None or (hasattr(pd, 'isna') and pd.isna(feat_value)):
                            continue
                        if col not in matched_row or matched_row[col] is None or (isinstance(matched_row[col], str) and not str(matched_row[col]).strip()):
                            matched_row[col] = feat_value
                    matched_row['geometry'] = feat.geometry
                    matched_row['country'] = row.get('main_country', row['match_name'])
                    matched_rows.append(matched_row)

                logger.info(f"Special match found in {gadm_gpkg} ({len(special_gdf)} features)")
                return matched_rows
            except Exception as e:
                logger.error(f"Error reading {gadm_gpkg}: {e}")
                return matched_rows
        elif normalized_lookup == 'research':
            explicit_point = get_explicit_research_point(row, target_crs=target_crs)
            if explicit_point is not None:
                matched_row = row.drop('match_name').to_dict()
                matched_row['geometry'] = explicit_point
                matched_row['country'] = row.get('main_country') or row.get('country') or row.get('match_name')
                matched_rows.append(matched_row)
                logger.info(f'Created explicit research point for {row["match_name"]}')
                return matched_rows

            country_name = row.get('main_country') or row.get('country') or row.get('match_name')
            if country_boundaries is not None and country_name:
                country_mask = country_boundaries['COUNTRY'].fillna('').astype(str).str.upper().eq(normalize_name(country_name))
                country_match = country_boundaries[country_mask]
                if not country_match.empty:
                    geometry = country_match.iloc[0].geometry
                    point_geometry = geometry.representative_point() if geometry is not None else None
                    if point_geometry is not None:
                        matched_row = row.drop('match_name').to_dict()
                        matched_row['geometry'] = point_geometry
                        matched_row['country'] = country_match.iloc[0]['COUNTRY']
                        matched_rows.append(matched_row)
                        logger.info(f'Created fallback research point for {row["match_name"]} in {country_name}')
                        return matched_rows
            logger.warning(f'Could not create research point for {row["match_name"]}')
            return matched_rows
        else:
            logger.warning(f"No match found for {lookup_name} and no gpkg in {special_dir}")
            return matched_rows
    else:
        # Normal match
        _nation = adm_match.COUNTRY
        geometry = adm_match.iloc[0].geometry
        matched_row = row.drop('match_name').to_dict()
        matched_row['geometry'] = geometry
        matched_row['country'] = _nation.iloc[0]
        matched_rows.append(matched_row)
        return matched_rows

def _escape_sql_string(s):
    """Escape single quotes in an SQL string literal."""
    return s.replace("'", "''")


def _names_to_sql_in(names):
    """Return the interior of a SQL IN(...) expression for a set of uppercase names."""
    return ', '.join(f"'{_escape_sql_string(n)}'" for n in sorted(names))

def _load_gadm_layer_filtered(gadm_gpkg, layer_name, where_clause=None):
    """
    Load a single GADM layer from the GeoPackage, optionally restricted by a
    WHERE clause so that only the needed features are brought into memory.
    """
    kwargs = {'layer': layer_name}
    if where_clause:
        kwargs['where'] = where_clause
    return gpd.read_file(gadm_gpkg, **kwargs)



def get_region_list_per_level(df: pd.DataFrame, level: int) -> list:
    """Extract a list of unique, non-empty region names for a specific ADM level from the DataFrame."""
    if 'match_name' not in df.columns or 'ADM' not in df.columns:
        return []
    adm_numeric = pd.to_numeric(df['ADM'].astype(str).str.strip(), errors='coerce')
    names = (
        df.loc[adm_numeric == level, 'match_name']
        .dropna().astype(str).str.strip().str.upper()
    )
    return list(names[names != ''].unique())


def match_names_and_export(
    gadm_gpkg,
    input_file,
    output_dir,
    special_dir
):
    """
    Orchestrate the full pipeline: load inputs, match every row to a geometry,
    deduplicate, and export the unified GeoJSON.

    Steps performed:
    1. Load GADM administrative boundary layers (ADM_0 through ADM_3) from
       ``gadm_gpkg``.
    2. Load and normalise the input spreadsheet via :func:`load_input_table`.
    3. For each dataset row:
       - Resolve the ADM level or special-boundary lookup key.
       - Match the region name against the appropriate GADM layer (or delegate
         to :func:`AMD_reader` for special/research boundaries).
       - Collect matched rows with attached geometry.
    4. Assemble a ``GeoDataFrame`` and write the output with
       :func:`export_geojson_outputs`.

    Parameters
    ----------
    gadm_gpkg : str
        Path to the GADM GeoPackage containing administrative boundary layers.
    input_file : str
        Path to the Excel (.xlsx/.xls) or CSV file with dataset metadata.
    output_dir : str
        Directory where the output GeoJSON file will be written.
    special_dir : str or None
        Directory containing custom GeoPackage files for non-standard
        boundaries (may be ``None`` if not needed).
    """
    df = load_input_table(input_file)

    main_country_col = resolve_column(df, MAIN_COUNTRY_COLUMN_CANDIDATES) 
    adm_col = resolve_column(df, ADM_COLUMN_CANDIDATES)
    name_col = resolve_column(df, REGION_NAME_COLUMN_CANDIDATES) 

    logger.info(f"Using '{main_country_col}' as main country column")
    logger.info(f"Using '{adm_col}' as ADM column")
    logger.info(f"Using '{name_col}' as region name column")


    if adm_col != 'ADM':
        df['ADM'] = df[adm_col]
    if main_country_col and main_country_col != 'main_country':
        df['main_country'] = df[main_country_col]
    df['match_name'] = df[name_col].str.upper()

    adm_layers = {}

    for level in range(4):
        logging.info(f"Processing ADM_{level} layer...")
        adm_regions = get_region_list_per_level(df, level=level)
        logger.info(f"Loading {ADM_NAME_COLUMN[level]} layer: {adm_regions}")

        if adm_regions:
            adm_where = f'UPPER("{ADM_NAME_COLUMN[level]}") IN ({_names_to_sql_in(adm_regions)})'
            adm = _load_gadm_layer_filtered(gadm_gpkg, f'ADM_{level}', where_clause=adm_where)
        else:
            logger.warning(f"No valid {ADM_NAME_COLUMN[level]} region names found in the input data. Cannot proceed without region information for filtering ADM_{level} layer.")   
            continue
        adm_layers[level]=adm 
        logger.info(f"Loaded ADM_{level} layer with {len(adm_regions)} features after filtering by region.")


    matched_rows = []
    adm0=adm_layers[0] if 0 in adm_layers else None
    adm1=adm_layers[1] if 1 in adm_layers else None
    adm2=adm_layers[2] if 2 in adm_layers else None
    adm3=adm_layers[3] if 3 in adm_layers else None
    if adm0 is not None:
        adm0['name'] = adm0['COUNTRY'].str.upper()
    if adm1 is not None:
        adm1['name'] = adm1['NAME_1'].str.upper()
    if adm2 is not None:
        adm2['name'] = adm2['NAME_2'].str.upper()
    if adm3 is not None:
        adm3['name'] = adm3['NAME_3'].str.upper()

    for _, row in df.iterrows():
        row = row.copy()
        adm_level_value = resolve_adm_value(row['ADM'])
        name = row['match_name']
        main_country = row['main_country'] if 'main_country' in row.index else None

        if name is None or pd.isna(name):
            logger.warning(f'Skipping empty name for row: {row}')
            continue

        if isinstance(adm_level_value, str):
            logger.info(f'Processing {name} with special lookup "{adm_level_value}"...')
            row['ADM_lookup'] = adm_level_value
            row['ADM'] = '1'
            matched_rows = AMD_reader(
                matched_rows,
                adm0.iloc[0:0],
                row,
                special_dir,
                special_lookup=adm_level_value,
                target_crs=adm0.crs,
                country_boundaries=adm0
            )
            continue

        elif isinstance(adm_level_value, int):
            logger.info(f'Processing {name} with ADM level {adm_level_value}...')

            if adm0 is not None and adm_level_value == 0:
                adm_match0 = adm0[adm0['name'] == normalize_name(name)]
                matched_rows = AMD_reader(matched_rows, adm_match0, row, special_dir, target_crs=adm0.crs, country_boundaries=adm0)

            if adm1 is not None and adm_level_value == 1:
                adm_match1 = adm1[adm1['name'] == normalize_name(name)]
                matched_rows = AMD_reader(matched_rows, adm_match1, row, special_dir, target_crs=adm0.crs, country_boundaries=adm0)
            if adm2 is not None and adm_level_value == 2:
                adm_match2 = adm2[adm2['name'] == normalize_name(name)]
                matched_rows = AMD_reader(matched_rows, adm_match2, row, special_dir, target_crs=adm0.crs, country_boundaries=adm0)
            if adm3 is not None and adm_level_value == 3:
                adm_match3 = adm3[adm3['name'] == normalize_name(name)]
                matched_rows = AMD_reader(matched_rows, adm_match3, row, special_dir, target_crs=adm0.crs, country_boundaries=adm0)

    # ---- OUTPUT ----
    if matched_rows:
        result_gdf = gpd.GeoDataFrame(matched_rows, geometry='geometry', crs=adm0.crs)
        result_gdf['ADM'] = pd.to_numeric(result_gdf['ADM'], errors='coerce').fillna(1)

        unified_path = export_geojson_outputs(result_gdf, output_dir)
        logger.info(f"Unified GeoJSON saved to: {unified_path}")
    else:
        logger.warning("No matches found, nothing to export.")


@click.command()
@click.option('--gadm-gpkg', required=True, type=click.Path(exists=True), 
              help='Path to the GADM database file with administrative boundaries for all countries')
@click.option('--excel-file', 'input_file', required=True, type=click.Path(exists=True),
              help='Path to the Excel or CSV file with dataset information')
@click.option('--output-dir', type=click.Path(), 
              help='Output directory for GeoJSON files')
@click.option('--special-dir', type=click.Path(exists=True),
              help='Directory containing special/custom GPKG files for edge cases')
def main(gadm_gpkg, input_file, output_dir, special_dir):
    """
    Process geographic data and create map files for the European Point Clouds website.
    """
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Default output path if not provided
    if not output_dir:
        default_output_dir = os.path.join(os.path.dirname(script_dir), 'data')
        output_dir = default_output_dir
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    logger.info(f"Processing data...")
    
    if special_dir:
        logger.info(f"Special dir: {special_dir}")
    
    match_names_and_export(
        gadm_gpkg=gadm_gpkg,
        input_file=input_file,
        output_dir=output_dir,
        special_dir=special_dir
    )
    
    logger.info("Processing complete!")
    logger.info(f"  Data saved in: {output_dir}")


if __name__ == "__main__":
    main()
