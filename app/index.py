"""FastAPI application entrypoint for Project Terra on Vercel."""
from pathlib import Path
import sys

# Ensure repository root is on sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from api.server import app

__all__ = ["app"]
