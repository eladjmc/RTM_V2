"""Resolve a chapter URL to the matching scrape source adapter."""

from app.sources.freewebnovel import FreewebnovelSource
from app.sources.novelbin import NovelbinSource
from app.sources.novelfull import NovelfullSource
from app.sources.novellunar import NovellunarSource

_SOURCES = [
    NovelbinSource(),
    NovelfullSource(),
    FreewebnovelSource(),
    NovellunarSource(),
]

SUPPORTED_SITES = ", ".join(sorted({s.name + ".com" for s in _SOURCES}))


class UnsupportedSourceError(ValueError):
    pass


def get_source(url: str):
    for source in _SOURCES:
        if source.matches(url):
            return source
    raise UnsupportedSourceError(
        f"Unsupported site. Supported: {SUPPORTED_SITES}"
    )
