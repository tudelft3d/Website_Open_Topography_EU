# -*- coding: utf-8 -*-
"""
Created on Thu Apr  3 11:45:59 2025

@author: Daan
"""

import os
import numpy as np
import pandas as pd
import geopandas as gpd
import fiona   # voor fiona.listlayers
import datetime
def AMD_reader(matched_rows, adm_match, row, special_dir):
    """
    Verwerk een match uit ADM-lagen of zoek in de speciale map als er geen match is.
    """
    if adm_match.empty:
        # Zoek in special_dir naar een .gpkg met dezelfde naam
        lookup_name = row['match_name'].lower().replace(" ", "_")
        gpkg_path = os.path.join(special_dir, f"{lookup_name}.gpkg")

        if os.path.exists(gpkg_path):
            try:
                # Lees alle features van de eerste laag van de gevonden gpkg
                layers = fiona.listlayers(gpkg_path)
                special_gdf = gpd.read_file(gpkg_path, layer=layers[0])

                for _, feat in special_gdf.iterrows():
                    matched_row = row.drop('match_name').to_dict()
                    matched_row['geometry'] = feat.geometry
                    # gebruik Excel match_name als "country" label
                    matched_row['country'] = row['match_name']  
                    matched_rows.append(matched_row)

                print(f"Special match gevonden in {gpkg_path} ({len(special_gdf)} features)")
                return matched_rows
            except Exception as e:
                print(f"Fout bij lezen van {gpkg_path}: {e}")
                return matched_rows
        else:
            print(f"Geen match gevonden voor {row['match_name']} en geen gpkg in {special_dir}")
            return matched_rows
    else:
        # Normale match
        _nation = adm_match.COUNTRY
        geometry = adm_match.iloc[0].geometry
        matched_row = row.drop('match_name').to_dict()
        matched_row['geometry'] = geometry
        matched_row['country'] = _nation.iloc[0]
        matched_rows.append(matched_row)
        return matched_rows


def match_names_and_export(gpkg_path, excel_path, name_column, output_gpkg, special_dir):
    import datetime

    # --- maak datum-directory ---
    today_str = datetime.datetime.now().strftime("%d_%m_%Y")
    base_out_dir = os.path.dirname(output_gpkg)
    dated_out_dir = os.path.join(base_out_dir, today_str)
    os.makedirs(dated_out_dir, exist_ok=True)

    # update output pad naar nieuwe directory
    output_gpkg = os.path.join(dated_out_dir, os.path.basename(output_gpkg))

    # Load specific layers
    adm0 = gpd.read_file(gpkg_path, layer='ADM_0')
    adm1 = gpd.read_file(gpkg_path, layer='ADM_1')
    adm2 = gpd.read_file(gpkg_path, layer='ADM_2')
    adm3 = gpd.read_file(gpkg_path, layer='ADM_3')

    adm0['name'] = adm0['COUNTRY'].str.upper()
    adm1['name'] = adm1['NAME_1'].str.upper()
    adm2['name'] = adm2['NAME_1'].str.upper()
    adm3['name'] = adm3['VARNAME_3'].str.upper()

    df = pd.read_excel(excel_path)
    df['match_name'] = df[name_column].str.upper()

    matched_rows = []

    for _, row in df.iterrows():
        AMD_val = int(row['ADM'])
        name = row['match_name']

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
            print('No ADM level found!')

    # ---- OUTPUT ----
    if matched_rows:
        result_gdf = gpd.GeoDataFrame(matched_rows, geometry='geometry', crs=adm0.crs)

        region_gdf = result_gdf[result_gdf['ADM'] > 0]
        nations_gdf = result_gdf[result_gdf['ADM'] == 0]

        # per land regionaal bestand
        for nation in result_gdf['country'].unique():
            region_match = result_gdf[result_gdf['country'].str.lower() == nation.lower()]
            output_region_geojson = os.path.join(
                dated_out_dir,
                f"region_map_data_{nation.lower()}.geojson"
            )
            region_match.to_file(output_region_geojson, driver='GeoJSON')

        # totaalbestanden
        output_region_final_geojson = os.path.join(
            dated_out_dir,
            "region_map_data_Europe.geojson"
        )

        keep_cols = [c for c in ['Name', 'Data', 'geometry'] if c in nations_gdf.columns]
        if not keep_cols:
            keep_cols = nations_gdf.columns

        nations_gdf[keep_cols].to_file(output_gpkg, driver='GeoJSON')
        region_gdf.to_file(output_region_final_geojson, driver='GeoJSON')
    else:
        print("Geen matches gevonden, niets geëxporteerd.")




match_names_and_export(
    gpkg_path=r'C:\Users\Daan\Documents\data\RS1\gadm_410_levels.gpkg',
    excel_path=r'C:\Users\Daan\Documents\data\RS1\Quality_parameters.xlsx',
    name_column='Name',
    output_gpkg=r'C:\Users\Daan\Documents\data\website\data\map_data_overview.geojson',
    special_dir=r'C:\Users\Daan\Documents\data\RS1\special_gpkg'   # <--- map waar je losse gpkg's bewaart
)
