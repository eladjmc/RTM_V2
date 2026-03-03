"""FastAPI entry point for the RTM scraper API."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import scrape, rules

app = FastAPI(
    title="RTM Scraper API",
    description="Scrape novelbin.com chapters into the shared RTM MongoDB.",
    version="0.1.0",
)

# Allow local frontends / tools to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scrape.router)
app.include_router(rules.router)


@app.get("/health")
def health():
    return {"status": "ok"}
