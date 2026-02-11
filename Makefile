.PHONY: serve test generate

generate:
	source .venv/bin/activate && cd scripts && python MapMaker.py --gadm-gpkg input_data/gadm_410-levels.gpkg --excel-file input_data/Quality_parameters.xlsx --special-dir ../website/data/special_boundaries --output-dir ../website/data/

serve:
	python3 -m http.server --directory website 8000

test:
	pytest
