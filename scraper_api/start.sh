#!/usr/bin/env bash
# Start the scraper API service (FastAPI + Uvicorn)
cd "$(dirname "$0")"
poetry run uvicorn app.main:app --reload --port 8001
