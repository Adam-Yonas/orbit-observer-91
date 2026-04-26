# Compatibility shim: some hosts default to `uvicorn main:app`.
# The real FastAPI application is defined in app.py.
from app import app  # noqa: F401

