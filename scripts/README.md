# MapMaker.py — Technical Documentation

## Purpose

`MapMaker.py` is a CLI data-processing script that builds the GeoJSON map file
consumed by the European Open Topography website. It reads a spreadsheet of
topographic dataset metadata (e.g. aerial lidar or point-cloud surveys), looks up
the corresponding administrative boundary geometry for every dataset entry using
the [GADM](https://gadm.org/) boundary database, and exports a single unified
`map_data_unified.geojson` ready for the web map.

---

## Inputs

| Parameter | Flag | Description |
|-----------|------|-------------|
| GADM GeoPackage | `--gadm-gpkg` | Multi-layer `.gpkg` with GADM administrative boundaries (ADM_0–ADM_3) |
| Dataset spreadsheet | `--excel-file` | `.xlsx`, `.xls`, or `.csv` file with one row per topographic dataset |
| Name column | `--name-column` | Column in the spreadsheet containing the region/place name (default: `Name`) |
| Output directory | `--output-dir` | Directory where the GeoJSON output is written (default: `../data/`) |
| Special directory | `--special-dir` | Directory with custom `.gpkg` files for non-standard boundaries |

### Spreadsheet expected columns (flexible aliases supported)

| Canonical column | Aliases recognised |
|------------------|--------------------|
| `Name` | `name`, `region`, `Region` |
| `ADM` | `AMD`, `adm`, `amd`, `ADM_LEVEL`, `admin_level`, `Admin Level` |
| `main_country` | `Main Country`, `country`, `Country` |
| `year_begin` / `year_end` | `start_year`, `end_year`, `Year_begin`, `Year_end`, … |
| `Responsible` | `Agency`, `agency`, `responsible` |
| `dataset_name` | `Dataset_name`, `Dataset Name`, `Data Name` |
| `Licence` | `License`, `licence`, `license` |
| `DSM` / `DTM` | `dsm`, `dtm` |
| `DSM_scale` / `DTM_scale` | `DSM scale`, `DTM scale`, … |
| `link_info` | `documentation_link`, `Documentation link`, … |
| `link_point_cloud` | `dataroom`, `Dataroom`, `Link point cloud`, … |
| `classification` | `Classification` |

---

## Outputs

| File | Description |
|------|-------------|
| `map_data_unified.geojson` | Single GeoJSON FeatureCollection with one feature per dataset row, carrying all metadata attributes and the matched boundary/point geometry. "Global" entries are excluded and all geometries are simplified (`tolerance=0.001`). |

---

## ADM Level Logic

The `ADM` column in the spreadsheet controls which GADM layer is searched:

| ADM value | GADM layer used | Match field |
|-----------|-----------------|-------------|
| `0` | `ADM_0` (country) | `COUNTRY` |
| `1` | `ADM_1`, `ADM_2`, `ADM_3` (all tried) | `NAME_1`, `NAME_2`, `NAME_3`, `VARNAME_*` |
| `2` | `ADM_2` (sub-region) | `NAME_1` |
| `3` | `ADM_3` (municipality) | `VARNAME_3` |
| non-numeric string | Special boundary lookup (see below) | — |

When `main_country` is provided alongside `ADM=1`, the match is further constrained
to features whose `COUNTRY` / `NAME_0` matches the parent country.

---

## Special / Research Boundary Lookup

When the `ADM` value is a non-numeric string (e.g. `"research"`, `"my_region"`),
the script enters special-boundary mode:

1. **Custom GeoPackage** — the string is normalised and matched against filenames
   in `--special-dir`. All layers of the matching `.gpkg` are loaded and the
   feature whose `place` / `name` / `site` / `location` field matches the row's
   `Name` (or `Name.1`) is used as the geometry.

2. **Research point with explicit coordinates** — if `ADM` is `"research"` and
   the row has `latitude` / `longitude` columns, a `Point` geometry is created
   directly from those coordinates.

3. **Research point from country centroid** — if no explicit coordinates exist,
   the script falls back to the representative point of the matching country
   boundary from `ADM_0`.

---

## Duplicate Merging

After geometry matching, rows that share the same `ADM` / `country` /
`main_country` / `Name` combination are merged into one row. Text fields are
concatenated with ` || ` as a separator; the first geometry is kept.

For research datasets (non-numeric ADM), a finer merge key is derived from
`location`, `Name.1`, `dataset_name`, year fields, or the geometry's WKT to
avoid collapsing genuinely distinct features.

---

## Function Reference

| Function | Description |
|----------|-------------|
| `main()` | CLI entry point; parses arguments and calls `match_names_and_export`. |
| `match_names_and_export()` | Full pipeline: load GADM layers → load spreadsheet → iterate rows → collect matched geometries → export. |
| `load_input_table()` | Loads Excel or CSV, normalises column headers. |
| `normalize_input_columns()` | Applies all canonical-column aliases and creates website-expected convenience columns. |
| `ensure_canonical_column()` | Renames the first matching alias column to the canonical name. |
| `combine_year_columns()` | Merges `year_begin` / `year_end` into a single `Year` string. |
| `resolve_adm_column()` | Finds the ADM-level column from known header variants. |
| `resolve_main_country_column()` | Finds the parent-country column if present. |
| `resolve_adm_value()` | Parses the ADM cell: returns `(int_level, "")` or `(None, special_key)`. |
| `layer_match_mask()` | Boolean mask for matching a name in a GADM layer, optionally filtered by country. |
| `special_match_mask()` | Boolean mask for matching a name in a special GeoPackage layer. |
| `find_special_gpkg()` | Locates a `.gpkg` file in the special directory by normalised filename. |
| `load_special_features()` | Loads all geometries from all layers of a GeoPackage. |
| `resolve_special_feature_name()` | Picks the correct name field (`Name.1`, `place`, `location`, …) to match against a special GeoPackage. |
| `AMD_reader()` | Dispatches a row to either the normal GADM match path or the special/research fallback path. |
| `get_explicit_research_point()` | Builds a `Point` geometry from explicit latitude/longitude columns. |
| `parse_coordinate_value()` | Parses a raw coordinate cell value (handles strings, comma decimals, etc.). |
| `merge_duplicate_rows()` | Merges duplicate dataset rows by concatenating field values with ` \|\| `. |
| `normalize_name()` | Upper-cases and strips a name for comparison. |
| `normalize_special_lookup()` | Lower-cases and slugifies a value for filename matching. |
| `prepare_unified_export_gdf()` | Removes global entries and simplifies geometries for the website export. |
| `export_geojson_outputs()` | Writes `map_data_unified.geojson` to the output directory. |

---


## Usage Example

```bash
python MapMaker.py \
    --gadm-gpkg  data/gadm_410-levels.gpkg \
    --excel-file ../datasets.xlsx \
    --name-column Name \
    --output-dir ../website/data \
    --special-dir data/special_gpkg
```

The output `map_data_unified.geojson` is written to `../website/data/` and
loaded directly by the website's Leaflet/Maplibre map.
