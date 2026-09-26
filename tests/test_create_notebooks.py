"""Tests for src.create_notebooks module."""

import pytest
import json
from pathlib import Path
import tempfile


def test_create_notebooks_imports():
    """Ensure the module can be imported without side effects."""
    import src.create_notebooks
    assert hasattr(src.create_notebooks, "create_notebook_03")
    assert hasattr(src.create_notebooks, "create_notebook_04")
    assert hasattr(src.create_notebooks, "main")


def test_create_notebook_03_structure():
    """Test that notebook 03 has expected structure and cells."""
    from src.create_notebooks import create_notebook_03

    nb = create_notebook_03()

    assert nb["nbformat"] == 4
    assert nb["nbformat_minor"] == 5
    assert "kernelspec" in nb["metadata"]
    assert nb["metadata"]["kernelspec"]["name"] == "python3"

    cell_types = [cell["cell_type"] for cell in nb["cells"]]
    assert cell_types[0] == "markdown"
    assert "code" in cell_types

    # Check for key sections
    markdown_cells = [c for c in nb["cells"] if c["cell_type"] == "markdown"]
    section_titles = "".join("".join(c["source"]) for c in markdown_cells)
    assert "Fase 2 & 3" in section_titles
    assert "Determinación de K" in section_titles
    assert "K-Means" in section_titles
    assert "Jerárquico" in section_titles
    assert "PCA 2D" in section_titles
    assert "Exportación" in section_titles


def test_create_notebook_04_structure():
    """Test that notebook 04 has expected structure and cells."""
    from src.create_notebooks import create_notebook_04

    nb = create_notebook_04()

    assert nb["nbformat"] == 4
    assert nb["nbformat_minor"] == 5
    assert "kernelspec" in nb["metadata"]

    markdown_cells = [c for c in nb["cells"] if c["cell_type"] == "markdown"]
    section_titles = "".join("".join(c["source"]) for c in markdown_cells)
    assert "Fase 4" in section_titles
    assert "Perfil Edafoclimático" in section_titles
    assert "Radar Chart" in section_titles or "radar" in section_titles.lower()
    assert "Soil_Type" in section_titles
    assert "Validación Agronómica" in section_titles or "Validación" in section_titles
    assert "Kruskal-Wallis" in section_titles
    assert "Conclusiones" in section_titles


def test_notebooks_have_valid_json_output(tmp_path):
    """Test that generated notebooks are valid JSON and can be written/read."""
    from src.create_notebooks import create_notebook_03, create_notebook_04

    nb3 = create_notebook_03()
    nb4 = create_notebook_04()

    # Write and read back
    nb3_path = tmp_path / "test_03.ipynb"
    nb4_path = tmp_path / "test_04.ipynb"

    for path, nb in [(nb3_path, nb3), (nb4_path, nb4)]:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(nb, f, indent=1, ensure_ascii=False)

        with open(path, "r", encoding="utf-8") as f:
            loaded = json.load(f)

        assert loaded["nbformat"] == nb["nbformat"]
        assert len(loaded["cells"]) == len(nb["cells"])