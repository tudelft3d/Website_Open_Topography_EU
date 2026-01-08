.PHONY: serve test

serve:
	python3 -m http.server --directory website 8000

test:
	pytest
