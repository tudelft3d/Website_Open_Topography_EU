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

def AMD_reader(matched_rows, adm_match, row, special_dir):
    """
    Process a match from ADM layers or search in special directory if no match is found.
    """
    if adm_match.empty:
        logger.info(f'No ADM match found for {row}, searching in special directory...')
        # Search in special_dir for a .gpkg file with the same name
        lookup_name = row['match_name'].lower().replace(" ", "_")
        gadm_gpkg = os.path.join(special_dir, f"{lookup_name}.gpkg")

        if os.path.exists(gadm_gpkg):
            try:
                # Read all features from the first layer of the found gpkg
                layers = fiona.listlayers(gadm_gpkg)
                special_gdf = gpd.read_file(gadm_gpkg, layer=layers[0])

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
            logger.warning(f"No match found for {row['match_name']} and no gpkg in {special_dir}")
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
        AMD_val = int(row['ADM'])
        name = row['match_name']
        main_country = row['main_country'] if 'main_country' in row.index else None

        if name is None or pd.isna(name):
            logger.warning(f'Skipping empty name for row: {row}')
            continue

        logger.info(f'Processing {name} at ADM level {AMD_val}...')

        if AMD_val == 0:
            adm_match = adm0[adm0['name'] == name]
            matched_rows = AMD_reader(matched_rows, adm_match, row, special_dir)
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
            matched_rows = AMD_reader(matched_rows, adm_match, row, special_dir)
        elif AMD_val == 2:
            adm_match = adm2[adm2['name'] == name]
            matched_rows = AMD_reader(matched_rows, adm_match, row, special_dir)
        elif AMD_val == 3:
            adm_match = adm3[adm3['name'] == name]
            matched_rows = AMD_reader(matched_rows, adm_match, row, special_dir)
        else:
            logger.error(f'No ADM level found for {name}!')

    # ---- OUTPUT ----
    if matched_rows:
        result_gdf = gpd.GeoDataFrame(matched_rows, geometry='geometry', crs=adm0.crs)
        result_gdf = merge_duplicate_rows(result_gdf)

        # Split regional vs national
        region_gdf = result_gdf[result_gdf['ADM'] > 0]
        nations_gdf = result_gdf[result_gdf['ADM'] == 0]

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
