"""Core scraping logic — multi-source chapter scraping into MongoDB.

Flow:
  1. Detect site adapter from the first-chapter URL.
  2. Fetch, parse, clean, upsert each chapter.
  3. Follow next-chapter link (or constructed URL) until done.

All scraping runs in a background thread so the FastAPI endpoint can
return immediately with a job_id for polling.
"""

import time
import uuid
import threading

from app.config import FETCH_DELAY
from app.services.db import upsert_book, upsert_chapter
from app.services.cleaner import clean_content
from app.sources.common import extract_chapter_number, fetch
from app.sources.registry import UnsupportedSourceError, get_source

# ── In-memory job registry ────────────────────────────────────────────────────
jobs: dict[str, dict] = {}


def _scrape_worker(
    job_id: str,
    start_url: str,
    max_chapters: int | None,
    book_url: str | None,
    starting_chapter: int,
) -> None:
    """Long-running worker executed in a background thread."""
    job = jobs[job_id]

    try:
        source = get_source(start_url)
    except UnsupportedSourceError as exc:
        job["status"] = "failed"
        job["message"] = str(exc)
        return

    if not book_url:
        book_url = source.derive_book_url(start_url)

    url: str | None = start_url
    seq = 0
    chapter_num_offset = starting_chapter - 1
    book_id = None

    book_meta = {"cover": "", "title": "", "author": ""}
    if book_url:
        job["message"] = "Fetching book page for cover & metadata…"
        meta = source.fetch_book_metadata(book_url)
        book_meta = {"cover": meta.cover, "title": meta.title, "author": meta.author}

    try:
        while url:
            if job.get("cancelled"):
                job["status"] = "cancelled"
                job["message"] = f"Cancelled by user after {seq} chapter(s)."
                return

            if max_chapters and seq >= max_chapters:
                break

            html = fetch(url)
            data = source.parse_chapter_page(html, url)

            if source.is_placeholder_chapter(html, data):
                if seq == 0:
                    job["message"] = f"No published content at {url}, stopping."
                else:
                    job["message"] = (
                        f"Finished. {seq} chapter(s) scraped. "
                        f"Chapter {data.chapter_number or seq + 1} is not published yet on the site."
                    )
                    job["status"] = "completed"
                    return
                break

            if not data.content.strip():
                job["message"] = f"Empty content at {url}, stopping."
                break

            if book_id is None:
                b_title = book_meta["title"] or data.book_title or "Unknown Book"
                b_author = book_meta["author"] or data.book_author
                job["book_title"] = b_title
                book_id = upsert_book(
                    title=b_title,
                    author=b_author,
                    cover=book_meta["cover"],
                )

            seq += 1
            if data.chapter_number is not None:
                chapter_num = data.chapter_number
            else:
                chapter_num = extract_chapter_number(data.title, seq + chapter_num_offset)
            chapter_title = f"Chapter {chapter_num}"
            clean_body = clean_content(data.content, str(book_id))

            upsert_chapter(
                book_id=book_id,
                chapter_number=chapter_num,
                title=chapter_title,
                content=clean_body,
            )

            job["chapters_scraped"] = seq
            job["message"] = f"Scraped Chapter {chapter_num}"

            url = source.get_next_chapter_url(url, data)
            if url:
                time.sleep(FETCH_DELAY)

        job["status"] = "completed"
        job["message"] = f"Finished. {seq} chapter(s) scraped."

    except Exception as exc:
        job["status"] = "failed"
        job["message"] = str(exc)


def start_scrape(
    url: str,
    max_chapters: int | None = None,
    book_url: str | None = None,
    starting_chapter: int = 1,
) -> str:
    """Kick off a background scrape job. Returns the job_id."""
    job_id = uuid.uuid4().hex[:12]
    jobs[job_id] = {
        "job_id": job_id,
        "status": "running",
        "chapters_scraped": 0,
        "total_expected": max_chapters,
        "book_title": "",
        "message": "Starting…",
        "cancelled": False,
    }
    t = threading.Thread(
        target=_scrape_worker,
        args=(job_id, url, max_chapters, book_url, starting_chapter),
        daemon=True,
    )
    t.start()
    return job_id


def get_job(job_id: str) -> dict | None:
    return jobs.get(job_id)


def cancel_job(job_id: str) -> dict | None:
    job = jobs.get(job_id)
    if job is None:
        return None
    if job["status"] == "running":
        job["cancelled"] = True
    return job


def get_all_jobs() -> list[dict]:
    return list(reversed(jobs.values()))
