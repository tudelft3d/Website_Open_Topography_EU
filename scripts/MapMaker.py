# -*- coding: utf-8 -*-
"""
Created on Thu Apr  3 11:45:59 2025

Copyright © 2025-2026 3D geoinformation group, TU Delft and Daan van den Heide. All rights reserved.
"""

import os
import re
import pandas as pd
import geopandas as gpd
import fiona
import click
import logging

logging.basicConfig(level=logging.WARNING, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
MERGED_VALUE_SEPARATOR = " || "
ADM_COLUMN_CANDIDATES = ('ADM', 'AMD', 'adm', 'amd', 'ADM_LEVEL', 'admin_level', 'Admin Level')
MAIN_COUNTRY_COLUMN_CANDIDATES = ('main_country', 'Main Country', 'country', 'Country')
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
    for candidate in candidates:
        if candidate in df.columns:
            if candidate != canonical_name and canonical_name not in df.columns:
                df[canonical_name] = df[candidate]
            return


def combine_year_columns(row):
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


def resolve_adm_column(df):
    """
    Resolve the administrative-level column from common header variants.
    """
    for candidate in ADM_COLUMN_CANDIDATES:
        if candidate in df.columns:
            return candidate

    raise click.BadParameter(
        "Input file is missing an ADM level column. "
        f"Tried: {', '.join(ADM_COLUMN_CANDIDATES)}. "
        f"Available columns: {', '.join(map(str, df.columns))}"
    )


def resolve_main_country_column(df):
    """
    Resolve the parent-country column if present.
    """
    for candidate in MAIN_COUNTRY_COLUMN_CANDIDATES:
        if candidate in df.columns:
            return candidate
    return None


def normalize_name(value):
    if value is None or pd.isna(value):
        return ''
    return str(value).strip().upper()


def normalize_special_lookup(value):
    if value is None or pd.isna(value):
        return ''
    text = str(value).strip().lower()
    text = re.sub(r'\.gpkg$', '', text)
    text = re.sub(r'[^a-z0-9]+', '_', text)
    return text.strip('_')


def resolve_adm_value(raw_value):
    """
    Return a numeric ADM level when possible, otherwise keep the original string
    as a special-boundary lookup key.
    """
    if raw_value is None or pd.isna(raw_value):
        return None, ''

    text = str(raw_value).strip()
    if not text:
        return None, ''

    try:
        return int(float(text)), ''
    except (TypeError, ValueError):
        return None, text


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


def layer_match_mask(layer_gdf, name, country_name=None):
    """
    Match a region name against several possible GADM name fields, optionally
    constrained to a parent country.
    """
    name = normalize_name(name)
    if not name:
        return pd.Series(False, index=layer_gdf.index)

    candidate_columns = [col for col in ['COUNTRY', 'NAME_1', 'NAME_2', 'NAME_3', 'VARNAME_1', 'VARNAME_2', 'VARNAME_3'] if col in layer_gdf.columns]
    if not candidate_columns:
        return pd.Series(False, index=layer_gdf.index)

    mask = pd.Series(False, index=layer_gdf.index)
    for column in candidate_columns:
        values = layer_gdf[column].fillna('').astype(str).str.upper()
        mask = mask | values.eq(name) | values.str.contains(rf'(?:^|[|,;])\s*{re.escape(name)}\s*(?:$|[|,;])', regex=True)

    if country_name and 'COUNTRY' in layer_gdf.columns:
        mask = mask & layer_gdf['COUNTRY'].fillna('').astype(str).str.upper().eq(normalize_name(country_name))

    return mask


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


def merge_duplicate_rows(result_gdf):
    """
    Merge duplicate dataset rows for the same country/name/ADM combination while
    preserving row order inside each field.
    """
    if result_gdf.empty:
        return result_gdf

    grouped_rows = []
    group_cols = [col for col in ['ADM', 'country', 'main_country', 'Name'] if col in result_gdf.columns]
    geometry_col = result_gdf.geometry.name if hasattr(result_gdf, 'geometry') else 'geometry'

    def is_missing(value):
        return value is None or pd.isna(value) or (isinstance(value, str) and not value.strip())

    for _, group in result_gdf.groupby(group_cols, sort=False, dropna=False):
        merged = {}
        for col in group.columns:
            if col == geometry_col:
                merged[col] = group.iloc[0][col]
                continue

            values = [value for value in group[col].tolist() if not is_missing(value)]
            if not values:
                merged[col] = None
                continue

            if col in group_cols:
                merged[col] = values[0]
                continue

            unique_values = []
            seen = set()
            for value in values:
                key = str(value).strip()
                if key in seen:
                    continue
                seen.add(key)
                unique_values.append(value)

            merged[col] = unique_values[0] if len(unique_values) == 1 else MERGED_VALUE_SEPARATOR.join(str(v) for v in unique_values)

        grouped_rows.append(merged)

    return gpd.GeoDataFrame(grouped_rows, geometry=geometry_col, crs=result_gdf.crs)

def AMD_reader(matched_rows, adm_match, row, special_dir, special_lookup=None, target_crs=None):
    """
    Process a match from ADM layers or search in special directory if no match is found.
    """
    if adm_match.empty:
        logger.info(f'No ADM match found for {row}, searching in special directory...')
        lookup_name = special_lookup or row['match_name']
        gadm_gpkg = find_special_gpkg(special_dir, lookup_name)

        if gadm_gpkg and os.path.exists(gadm_gpkg):
            try:
                special_gdf = load_special_features(gadm_gpkg, target_crs=target_crs)
                special_mask = special_match_mask(special_gdf, row['match_name'])
                if special_mask.any():
                    special_gdf = special_gdf[special_mask].copy()
                elif any(col in special_gdf.columns for col in ['place', 'Place', 'PLACE', 'name', 'Name', 'NAME']):
                    logger.warning(
                        f'No special feature name match found for {row["match_name"]} in {gadm_gpkg}'
                    )
                    return matched_rows

                for _, feat in special_gdf.iterrows():
                    matched_row = row.drop('match_name').to_dict()
                    matched_row['geometry'] = feat.geometry
                    matched_row['country'] = row.get('main_country', row['match_name'])
                    matched_rows.append(matched_row)

                logger.info(f"Special match found in {gadm_gpkg} ({len(special_gdf)} features)")
                return matched_rows
            except Exception as e:
                logger.error(f"Error reading {gadm_gpkg}: {e}")
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


def match_names_and_export(gadm_gpkg, input_file, name_column, output_dir, special_dir):
    # Load specific layers
    adm0 = gpd.read_file(gadm_gpkg, layer='ADM_0')
    adm1 = gpd.read_file(gadm_gpkg, layer='ADM_1')
    adm2 = gpd.read_file(gadm_gpkg, layer='ADM_2')
    adm3 = gpd.read_file(gadm_gpkg, layer='ADM_3')

    adm0['name'] = adm0['COUNTRY'].str.upper()
    adm1['name'] = adm1['NAME_1'].str.upper()
    adm2['name'] = adm2['NAME_1'].str.upper()
    adm3['name'] = adm3['VARNAME_3'].str.upper()

    df = load_input_table(input_file)
    adm_column = resolve_adm_column(df)
    main_country_column = resolve_main_country_column(df)
    if adm_column != 'ADM':
        df['ADM'] = df[adm_column]
    if main_country_column and main_country_column != 'main_country':
        df['main_country'] = df[main_country_column]
    df['match_name'] = df[name_column].str.upper()

    matched_rows = []

    for _, row in df.iterrows():
        row = row.copy()
        AMD_val, special_lookup = resolve_adm_value(row['ADM'])
        name = row['match_name']
        main_country = row['main_country'] if 'main_country' in row.index else None

        if name is None or pd.isna(name):
            logger.warning(f'Skipping empty name for row: {row}')
            continue

        if special_lookup:
            logger.info(f'Processing {name} via special boundary lookup "{special_lookup}"...')
            row['ADM_lookup'] = special_lookup
            row['ADM'] = '1'
            matched_rows = AMD_reader(matched_rows, adm0.iloc[0:0], row, special_dir, special_lookup=special_lookup, target_crs=adm0.crs)
            continue

        logger.info(f'Processing {name} at ADM level {AMD_val}...')

        if AMD_val == 0:
            adm_match = adm0[adm0['name'] == name]
            matched_rows = AMD_reader(matched_rows, adm_match, row, special_dir, target_crs=adm0.crs)
        elif AMD_val == 1:
            regional_matches = []
            for layer_gdf in (adm1, adm2, adm3):
                mask = layer_match_mask(layer_gdf, name, main_country)
                if mask.any():
                    regional_matches.append(layer_gdf[mask])
            if regional_matches:
                adm_match = pd.concat(regional_matches, ignore_index=False)
            else:
                adm_match = adm1.iloc[0:0]
            matched_rows = AMD_reader(matched_rows, adm_match, row, special_dir, target_crs=adm0.crs)
        elif AMD_val == 2:
            adm_match = adm2[adm2['name'] == name]
            matched_rows = AMD_reader(matched_rows, adm_match, row, special_dir, target_crs=adm0.crs)
        elif AMD_val == 3:
            adm_match = adm3[adm3['name'] == name]
            matched_rows = AMD_reader(matched_rows, adm_match, row, special_dir, target_crs=adm0.crs)
        else:
            logger.error(f'No ADM level found for {name}!')

    # ---- OUTPUT ----
    if matched_rows:
        result_gdf = gpd.GeoDataFrame(matched_rows, geometry='geometry', crs=adm0.crs)
        result_gdf = merge_duplicate_rows(result_gdf)
        adm_numeric = pd.to_numeric(result_gdf['ADM'], errors='coerce')

        # Split regional vs national
        region_gdf = result_gdf[adm_numeric > 0]
        nations_gdf = result_gdf[adm_numeric == 0]

        # Export regional file per country
        for nation in result_gdf['country'].unique():
            region_match = result_gdf[result_gdf['country'].str.lower() == nation.lower()]
            # Simplify geometries to reduce file size (tolerance in degrees)
            region_match = region_match.copy()
            region_match['geometry'] = region_match['geometry'].simplify(tolerance=0.001)
            output_region_gpkg = os.path.join(
                output_dir,
                f"region_map_data_{nation.lower()}.geojson"
            )
            region_match.to_file(output_region_gpkg, driver='GeoJSON')

        # Export total files
        output_region_final_geojson = os.path.join(
            output_dir,
            "region_map_data_Europe.geojson"
        )

        # Simplify geometries before saving
        nations_simplified = nations_gdf.copy()
        nations_simplified['geometry'] = nations_simplified['geometry'].simplify(tolerance=0.001)
        main_output_file = os.path.join(output_dir, 'map_data_overview.geojson')
        nations_simplified.to_file(main_output_file, driver='GeoJSON')
        
        # Simplify regional geometries before saving
        region_simplified = region_gdf.copy()
        region_simplified['geometry'] = region_simplified['geometry'].simplify(tolerance=0.001)
        region_simplified.to_file(output_region_final_geojson, driver='GeoJSON')
    else:
        logger.warning("No matches found, nothing to export.")


@click.command()
@click.option('--gadm-gpkg', required=True, type=click.Path(exists=True), 
              help='Path to the GADM database file with administrative boundaries for all countries')
@click.option('--excel-file', 'input_file', required=True, type=click.Path(exists=True),
              help='Path to the Excel or CSV file with dataset information')
@click.option('--name-column', default='Name', 
              help='Column name in Excel file containing region names (default: Name)')
@click.option('--output-dir', type=click.Path(), 
              help='Output directory for GeoJSON files')
@click.option('--special-dir', type=click.Path(exists=True),
              help='Directory containing special/custom GPKG files for edge cases')
def main(gadm_gpkg, input_file, name_column, output_dir, special_dir):
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
        name_column=name_column,
        output_dir=output_dir,
        special_dir=special_dir
    )
    
    logger.info("Processing complete!")
    logger.info(f"  Data saved in: {output_dir}")


if __name__ == "__main__":
    main()
