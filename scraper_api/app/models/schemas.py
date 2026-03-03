"""Pydantic schemas for API request / response bodies."""

from pydantic import BaseModel, Field


class ScrapeRequest(BaseModel):
    """POST /scrape body."""
    url: str = Field(
        ...,
        description=(
            "First chapter URL of the book on novelbin.com. "
            "Example: https://novelbin.com/b/the-beginning-after-the-end/chapter-1"
        ),
    )
    book_url: str | None = Field(
        None,
        description=(
            "Optional book main-page URL to fetch cover image and author. "
            "Example: https://novelbin.com/b/the-beginning-after-the-end"
        ),
    )
    max_chapters: int | None = Field(
        None,
        ge=1,
        description=(
            "How many chapters to scrape. "
            "Leave empty (or null) to scrape ALL chapters until the last one. "
            "Set to a number to limit, e.g. 5 = only the first 5 chapters."
        ),
    )
    starting_chapter: int | None = Field(
        None,
        ge=1,
        description=(
            "The chapter number of the first URL you provided. "
            "E.g. if you start scraping from chapter 840, set this to 840 "
            "so chapters are numbered 840, 841, 842… instead of 1, 2, 3… "
            "Defaults to 1 if not provided."
        ),
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "url": "https://novelbin.com/b/the-beginning-after-the-end/chapter-1",
                "book_url": "https://novelbin.com/b/the-beginning-after-the-end",
                "max_chapters": 5,
                "starting_chapter": 1,
            }
        }
    }


class ScrapeProgress(BaseModel):
    """Progress snapshot for a running or completed job."""
    job_id: str
    status: str = "running"  # running | completed | failed | cancelled
    chapters_scraped: int = 0
    total_expected: int | None = None
    book_title: str = ""
    message: str = ""


class CleaningRuleIn(BaseModel):
    """Body for creating / updating a cleaning rule."""
    book_id: str | None = Field(None, description="Scope to a book. None = global.")
    pattern: str = Field(..., description="Python regex pattern.")
    action: str = Field("remove_line", description="remove_line | remove_match | replace")
    replacement: str = Field("", description="Used only when action = replace.")
    description: str = ""
    enabled: bool = True


class CleaningRuleOut(CleaningRuleIn):
    """Stored cleaning rule with its Mongo ID."""
    id: str
