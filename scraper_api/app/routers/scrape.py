"""Scraping endpoints — kick off a job and poll its progress."""

from fastapi import APIRouter, HTTPException

from app.models.schemas import ScrapeRequest, ScrapeProgress
from app.services.scraper import start_scrape, get_job, cancel_job, get_all_jobs

router = APIRouter(prefix="/scrape", tags=["scrape"])


@router.get(
    "/",
    response_model=list[ScrapeProgress],
    summary="List all scrape jobs",
    description=(
        "Returns every job (running, completed, failed, cancelled).\n\n"
        "Useful for finding the `job_id` of a running scrape so you can poll or cancel it."
    ),
)
def list_jobs(status: str | None = None):
    """Optionally filter by status: ?status=running"""
    all_jobs = get_all_jobs()
    if status:
        all_jobs = [j for j in all_jobs if j["status"] == status]
    return [ScrapeProgress(**j) for j in all_jobs]


@router.post(
    "/",
    response_model=ScrapeProgress,
    summary="Start scraping a book",
    description=(
        "Kicks off a background scrape job.\n\n"
        "Kicks off a background scrape job.\n\n"
        "**Scrape the entire book (with cover):**\n"
        "```json\n"
        '{"url": "https://novelbin.com/b/the-beginning-after-the-end/chapter-1", '
        '"book_url": "https://novelbin.com/b/the-beginning-after-the-end"}\n'
        "```\n\n"
        "**Scrape first N chapters only** — add `max_chapters`:\n"
        "```json\n"
        '{"url": "https://novelbin.com/b/the-beginning-after-the-end/chapter-1", '
        '"book_url": "https://novelbin.com/b/the-beginning-after-the-end", "max_chapters": 5}\n'
        "```\n\n"
        "`book_url` is optional but recommended — it fetches the cover image and author.\n\n"
        "Returns a progress object with a `job_id` you can poll via `GET /scrape/{job_id}`."
    ),
)
def launch_scrape(body: ScrapeRequest):
    job_id = start_scrape(body.url, body.max_chapters, body.book_url, body.starting_chapter or 1)
    job = get_job(job_id)
    return ScrapeProgress(**job)


@router.get(
    "/{job_id}",
    response_model=ScrapeProgress,
    summary="Check scrape progress",
    description="Poll the current status of a running or finished scrape job.",
)
def scrape_status(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    return ScrapeProgress(**job)


@router.post(
    "/{job_id}/cancel",
    response_model=ScrapeProgress,
    summary="Cancel a running scrape job",
    description=(
        "Signals a running scrape job to stop after the current chapter finishes.\n\n"
        "- If the job is **running**, it will be cancelled within a few seconds.\n"
        "- If the job is already **completed**, **failed**, or **cancelled**, "
        "this is a no-op and the current status is returned.\n\n"
        "The chapters already scraped are kept in the database."
    ),
)
def cancel_scrape(job_id: str):
    job = cancel_job(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    return ScrapeProgress(**job)
