"""Shared types for per-site scrape adapters."""

from dataclasses import dataclass


@dataclass
class ChapterData:
    title: str
    content: str
    next_url: str | None = None
    book_title: str = ""
    book_author: str = ""
    chapter_number: int | None = None


@dataclass
class BookMetadata:
    cover: str = ""
    title: str = ""
    author: str = ""
