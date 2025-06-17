.PHONY: serve test

serve:
	python3 -m http.server --directory SRC 8000

test:
	pytest
