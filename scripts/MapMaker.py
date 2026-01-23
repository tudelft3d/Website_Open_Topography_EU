# -*- coding: utf-8 -*-
"""
Created on Thu Apr  3 11:45:59 2025

Copyright © 2025-2026 3D geoinformation group, TU Delft and Daan van den Heide. All rights reserved.
"""

import os
import pandas as pd
import geopandas as gpd
import fiona
import click
import logging

logging.basicConfig(level=logging.WARNING, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

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
                    # use Excel match_name as "country" label
                    matched_row['country'] = row['match_name']  
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


def match_names_and_export(gadm_gpkg, excel_file, name_column, output_dir, special_dir):
    # Load specific layers
    adm0 = gpd.read_file(gadm_gpkg, layer='ADM_0')
    adm1 = gpd.read_file(gadm_gpkg, layer='ADM_1')
    adm2 = gpd.read_file(gadm_gpkg, layer='ADM_2')
    adm3 = gpd.read_file(gadm_gpkg, layer='ADM_3')

    adm0['name'] = adm0['COUNTRY'].str.upper()
    adm1['name'] = adm1['NAME_1'].str.upper()
    adm2['name'] = adm2['NAME_1'].str.upper()
    adm3['name'] = adm3['VARNAME_3'].str.upper()

    df = pd.read_excel(excel_file)
    df['match_name'] = df[name_column].str.upper()

    matched_rows = []

    for _, row in df.iterrows():
        AMD_val = int(row['ADM'])
        name = row['match_name']

        if name is None or pd.isna(name):
            logger.warning(f'Skipping empty name for row: {row}')
            continue

        logger.info(f'Processing {name} at ADM level {AMD_val}...')

        if AMD_val == 0:
            adm_match = adm0[adm0['name'] == name]
            matched_rows = AMD_reader(matched_rows, adm_match, row, special_dir)
        elif AMD_val == 1:
            adm_match = adm1[adm1['name'] == name]
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
        output_region_final_gpkg = os.path.join(
            output_dir,
            "region_map_data_Europe.geojson"
        )

        # keep standard columns if they exist, otherwise all
        keep_cols = [c for c in ['Name', 'Data', 'geometry'] if c in nations_gdf.columns]
        if not keep_cols:
            keep_cols = nations_gdf.columns

        # Simplify geometries before saving
        nations_simplified = nations_gdf[keep_cols].copy()
        nations_simplified['geometry'] = nations_simplified['geometry'].simplify(tolerance=0.001)
        main_output_file = os.path.join(output_dir, 'map_data_overview.geojson')
        nations_simplified.to_file(main_output_file, driver='GeoJSON')
        
        # Simplify regional geometries before saving
        region_simplified = region_gdf.copy()
        region_simplified['geometry'] = region_simplified['geometry'].simplify(tolerance=0.001)
        region_simplified.to_file(output_region_final_gpkg, driver='GeoJSON')
    else:
        logger.warning("No matches found, nothing to export.")


@click.command()
@click.option('--gadm-gpkg', required=True, type=click.Path(exists=True), 
              help='Path to the GADM database file with administrative boundaries for all countries')
@click.option('--excel-file', required=True, type=click.Path(exists=True),
              help='Path to the Excel file with dataset information')
@click.option('--name-column', default='Name', 
              help='Column name in Excel file containing region names (default: Name)')
@click.option('--output-dir', type=click.Path(), 
              help='Output directory for GeoJSON files')
@click.option('--special-dir', type=click.Path(exists=True),
              help='Directory containing special/custom GPKG files for edge cases')
def main(gadm_gpkg, excel_file, name_column, output_dir, special_dir):
    """
    Process geographic data and create map files for the European Point Clouds website.
    """
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Default output path if not provided
    if not output_dir:
        default_output_dir = os.path.join(os.path.dirname(script_dir), 'data', 'boundaries')
        output_dir = default_output_dir
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    logger.info(f"Processing data...")
    
    if special_dir:
        logger.info(f"Special dir: {special_dir}")
    
    match_names_and_export(
        gadm_gpkg=gadm_gpkg,
        excel_file=excel_file,
        name_column=name_column,
        output_dir=output_dir,
        special_dir=special_dir
    )
    
    logger.info("Processing complete!")
    logger.info(f"  Data saved in: {output_dir}")


if __name__ == "__main__":
    main()