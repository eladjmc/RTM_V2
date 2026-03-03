"""Core scraping logic for novelbin.com chapter pages.

Flow:
  1. Fetch the first-chapter URL.
  2. Parse: title, content (the main #chr-content div), and the "next"
     chapter link.
  3. Clean the content via cleaner.py.
  4. Upsert into MongoDB.
  5. Follow the next link; repeat until there are no more chapters or
     max_chapters is reached.

All scraping runs in a background thread so the FastAPI endpoint can
return immediately with a job_id for polling.
"""

import base64
import io
import re
import time
import uuid
import threading
from urllib.parse import urljoin

import cloudscraper
from bs4 import BeautifulSoup, NavigableString, Tag

from app.config import HEADERS, FETCH_DELAY, MAX_RETRIES, COVER_MAX_WIDTH, COVER_MAX_HEIGHT, COVER_QUALITY
from app.services.db import upsert_book, upsert_chapter
from app.services.cleaner import clean_content

# Shared cloudscraper session (handles Cloudflare challenges)
_scraper = cloudscraper.create_scraper(browser={"browser": "chrome", "platform": "windows"})

# ── In-memory job registry ────────────────────────────────────────────────────
# Keyed by job_id → dict with status fields matching ScrapeProgress.
jobs: dict[str, dict] = {}


def _fetch(url: str) -> cloudscraper.requests.models.Response:
    """GET with retries, polite delay, and Cloudflare bypass."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = _scraper.get(url, timeout=20)
            resp.raise_for_status()
            return resp
        except Exception as exc:
            if attempt == MAX_RETRIES:
                raise
            time.sleep(FETCH_DELAY * attempt)  # back-off
    raise RuntimeError("unreachable")


def _parse_chapter_page(html: str, base_url: str) -> dict:
    """Extract title, content paragraphs, and next-chapter URL.

    Returns:
        {
            "title": str,
            "content": str,          # newline-joined paragraph text
            "next_url": str | None,  # absolute URL of next chapter
            "book_title": str,       # from the breadcrumb / header
            "book_author": str,
        }
    """
    soup = BeautifulSoup(html, "html.parser")

    # ── Chapter title ─────────────────────────────────────────────────────
    title_tag = soup.select_one("a.chr-title") or soup.select_one(".chr-text span")
    raw_title = title_tag.get_text(strip=True) if title_tag else ""

    # ── Content ───────────────────────────────────────────────────────────
    content_div = soup.select_one("#chr-content")
    paragraphs: list[str] = []
    if content_div:
        for child in content_div.children:
            if isinstance(child, Tag):
                # Replace <br> inside this element with newline markers
                for br in child.find_all("br"):
                    br.replace_with(NavigableString("\n"))
                # get_text preserves our \n markers
                text = child.get_text()
                # Split on newlines so <br>-separated lines become paragraphs
                for line in text.split("\n"):
                    stripped = line.strip()
                    if stripped:
                        paragraphs.append(stripped)
            elif isinstance(child, NavigableString):
                # Handle bare text nodes (also split on \n for <br> remnants)
                for line in str(child).split("\n"):
                    stripped = line.strip()
                    if stripped:
                        paragraphs.append(stripped)

    content = "\n\n".join(paragraphs)

    # ── Next chapter link ─────────────────────────────────────────────────
    next_btn = soup.select_one("#next_chap")
    next_url: str | None = None
    if next_btn and next_btn.get("href"):
        href = next_btn["href"]
        if href and not href.endswith("#"):  # "#" means no next chapter
            next_url = urljoin(base_url, href)
            # Avoid infinite loops: if next points back to same page, stop
            if next_url.rstrip("/") == base_url.rstrip("/"):
                next_url = None

    # ── Book metadata (best-effort from page elements) ────────────────
    book_title = ""
    book_author = ""

    # Prefer .novel-title, fall back to breadcrumb[1]
    novel_title_tag = soup.select_one(".novel-title")
    if novel_title_tag:
        book_title = novel_title_tag.get_text(strip=True)
    else:
        breadcrumb = soup.select("ol.breadcrumb li")
        if len(breadcrumb) >= 2:
            book_link = breadcrumb[1].select_one("a")
            if book_link:
                book_title = book_link.get_text(strip=True)

    author_tag = (
        soup.select_one(".novel-author a")
        or soup.select_one("a[href*='/author/']")
        or soup.select_one(".author")
    )
    if author_tag:
        book_author = author_tag.get_text(strip=True)

    return {
        "title": raw_title,
        "content": content,
        "next_url": next_url,
        "book_title": book_title,
        "book_author": book_author,
    }


def _fetch_book_page_metadata(book_url: str) -> dict:
    """Fetch the book's main page and extract cover (base64), title, author."""
    result = {"cover": "", "title": "", "author": ""}
    try:
        html = _fetch(book_url).text
        soup = BeautifulSoup(html, "html.parser")

        # Title: h3.title or h1
        title_tag = soup.select_one("h3.title") or soup.select_one("h1")
        if title_tag:
            result["title"] = title_tag.get_text(strip=True)

        # Author: .info a (first one)
        info_links = soup.select(".info a")
        if info_links:
            result["author"] = info_links[0].get_text(strip=True)

        # Cover image: .book img or og:image
        cover_url = ""
        cover_img = soup.select_one(".book img")
        if cover_img:
            cover_url = cover_img.get("src") or cover_img.get("data-src") or ""
        if not cover_url:
            og = soup.select_one("meta[property='og:image']")
            if og:
                cover_url = og.get("content", "")

        if cover_url:
            result["cover"] = _download_cover_as_base64(cover_url)

    except Exception:
        pass  # best-effort; book will just have no cover
    return result


def _download_cover_as_base64(image_url: str) -> str:
    """Download an image and return it as a data:image/jpeg;base64,... string.

    Resizes to fit within COVER_MAX_WIDTH x COVER_MAX_HEIGHT, matching
    the frontend's compressCover behavior.
    """
    try:
        from PIL import Image

        resp = _scraper.get(image_url, timeout=15)
        resp.raise_for_status()

        img = Image.open(io.BytesIO(resp.content))
        img = img.convert("RGB")

        w, h = img.size
        if w > COVER_MAX_WIDTH or h > COVER_MAX_HEIGHT:
            ratio = min(COVER_MAX_WIDTH / w, COVER_MAX_HEIGHT / h)
            img = img.resize((round(w * ratio), round(h * ratio)), Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=COVER_QUALITY)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        return f"data:image/jpeg;base64,{b64}"
    except Exception:
        return ""


def _extract_chapter_number(title: str, fallback: int) -> int:
    """Try to pull an integer chapter number from the title string.

    Handles formats: "Chapter 5", "C5", "c-5: ...", "chapter-5"
    Falls back to a sequential counter when no number is found.
    """
    m = re.search(r"(?:Chapter|C)[\s\-]*(\d+)", title, re.IGNORECASE)
    return int(m.group(1)) if m else fallback


def _scrape_worker(
    job_id: str,
    start_url: str,
    max_chapters: int | None,
    book_url: str | None,
    starting_chapter: int,
) -> None:
    """Long-running worker executed in a background thread."""
    job = jobs[job_id]
    url: str | None = start_url
    seq = 0  # sequential counter (how many we've scraped)
    chapter_num_offset = starting_chapter - 1  # so first chapter = starting_chapter

    book_id = None

    # Pre-fetch book page metadata (cover, title, author) if provided
    book_meta = {"cover": "", "title": "", "author": ""}
    if book_url:
        job["message"] = "Fetching book page for cover & metadata…"
        book_meta = _fetch_book_page_metadata(book_url)

    try:
        while url:
            if job.get("cancelled"):
                job["status"] = "cancelled"
                job["message"] = f"Cancelled by user after {seq} chapter(s)."
                return

            if max_chapters and seq >= max_chapters:
                break

            html = _fetch(url).text
            data = _parse_chapter_page(html, url)

            if not data["content"]:
                job["message"] = f"Empty content at {url}, stopping."
                break

            # Lazily create or find the book on the first chapter
            if book_id is None:
                b_title = book_meta["title"] or data["book_title"] or "Unknown Book"
                b_author = book_meta["author"] or data["book_author"]
                job["book_title"] = b_title
                book_id = upsert_book(
                    title=b_title,
                    author=b_author,
                    cover=book_meta["cover"],
                )

            seq += 1
            chapter_num = _extract_chapter_number(data["title"], seq + chapter_num_offset)
            chapter_title = f"Chapter {chapter_num}"
            clean_body = clean_content(data["content"], str(book_id))

            upsert_chapter(
                book_id=book_id,
                chapter_number=chapter_num,
                title=chapter_title,
                content=clean_body,
            )

            job["chapters_scraped"] = seq
            job["message"] = f"Scraped Chapter {chapter_num}"

            url = data["next_url"]
            if url:
                time.sleep(FETCH_DELAY)

        # Done
        job["status"] = "completed"
        job["message"] = f"Finished. {seq} chapter(s) scraped."

    except Exception as exc:
        job["status"] = "failed"
        job["message"] = str(exc)


# ── Public API ────────────────────────────────────────────────────────────────

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
    """Return the current progress dict for a job, or None."""
    return jobs.get(job_id)


def cancel_job(job_id: str) -> dict | None:
    """Signal a running job to stop. Returns the job dict, or None if not found."""
    job = jobs.get(job_id)
    if job is None:
        return None
    if job["status"] == "running":
        job["cancelled"] = True
        # The worker will pick this up on the next iteration
    return job


def get_all_jobs() -> list[dict]:
    """Return all jobs, newest first."""
    return list(reversed(jobs.values()))
