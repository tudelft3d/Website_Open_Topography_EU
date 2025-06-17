from pathlib import Path

def test_index_exists():
    assert Path('SRC/index.html').is_file()
