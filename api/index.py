"""FastAPI entrypoint for Vercel functions looking into api/ directory."""
from api.server import app

__all__ = ["app"]
