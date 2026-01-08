# Preprocessing

## GADM database
The european country polygons and they subdivisions are based on the [GADM data](https://gadm.org/download_world.html). 

You can download the world database with:

```bash
wget https://geodata.ucdavis.edu/gadm/gadm4.1/gadm_410-levels.zip
unzip gadm_410-levels.zip
```
This file is used as input for the preprocessing script.

## Excel File:

You need to put the desired data in an excel format with all the desired divisions in a single column. This file is used as input for the preprocessing script.



## Running the script
The script for generating the geojson files can be found in SRC/process_code

First create a virtual environment and install the dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r ../requirements.txt
```

You can run it with:

```bash
cd scripts
python MapMaker.py --gadm-gpkg <path-to-gadm-db> --excel-file <path-ro-excel-file>
```
 

