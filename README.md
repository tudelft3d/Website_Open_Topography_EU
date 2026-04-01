# The European Point Clouds website

This repository contains a static website showcasing open point cloud datasets and digital elevation models for Europe. 

You can find [our website here](https://europeanpointclouds.tudelft.nl).


# Preprocessing

## Necessary Datasets
### GADM database
The european country polygons and they subdivisions are based on the [GADM data](https://gadm.org/download_world.html). 

You can download the world database with:

```bash
wget https://geodata.ucdavis.edu/gadm/gadm4.1/gadm_410-levels.zip
unzip gadm_410-levels.zip
```
This file is used as input for the preprocessing script.

### Excel File:

You need to put the desired data in an excel format with all the desired divisions in a single column. This file is used as input for the preprocessing script.

### Special dir



## Running the script

The script for generating the geojson files can be found in scripts

First create a virtual environment and install the requirements :
```bash
cd scripts/
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Then you can run the script with:

```bash
cd script
python MapMaker.py --gadm-gpkg <path-to-gadm-db> --excel-file <path-to-excel-file>  --special-dir <path-to-special-dir> --output-dir  <path-to-output-dir>

python MapMaker.py --gadm-gpkg C:\Users\Daan\Documents\Local_Data\gadm_410_levels.gpkg --excel-file C:\Users\Daan\Documents\GitHub\Website_Open_Topography_EU\scripts\Quality_parameters_v12032026.xlsx  --special-dir C:\Users\Daan\Documents\Local_Data\special_gpkg --output-dir  C:\Users\Daan\Documents\GitHub\Website_Open_Topography_EU\data
```


# Running the website

## Locally
```
cd website
python3 -m http.server 800
```

