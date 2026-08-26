"""Build the self-contained Python body embedded in the Yamcs MDB."""

from pathlib import Path


WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
PACKAGE_ROOT = WORKSPACE_ROOT / "packages" / "landing-prediction"


def _library_source(path: Path) -> str:
    lines = []
    for line in path.read_text().splitlines():
        if line.startswith("from __future__ import"):
            continue
        if line.startswith("from landing_prediction."):
            continue
        lines.append(line)
    return "\n".join(lines)


def landing_prediction_algorithm_text() -> str:
    """Return one copy-pasteable Yamcs Python algorithm function body."""
    config = _library_source(PACKAGE_ROOT / "landing_prediction" / "config.py")
    predictor = _library_source(PACKAGE_ROOT / "landing_prediction" / "predictor.py")
    adapter = (PACKAGE_ROOT / "yamcs" / "algorithm.py").read_text()

    # Definitions embedded inside Yamcs's generated function must be global so
    # class methods can resolve their helper functions and state survives runs.
    globals_statement = (
        "global math, LandingPredictionConfig, EARTH_RADIUS_M, _is_finite, "
        "_linear_fit, _recent, LandingPredictor\n"
    )
    return "\n\n".join((globals_statement, config, predictor, adapter))
