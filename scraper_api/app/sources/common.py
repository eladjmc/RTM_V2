"""HTTP fetch and cover helpers shared across scrape sources."""

import base64
import io
import re

import cloudscraper

from app.config import COVER_MAX_HEIGHT, COVER_MAX_WIDTH, COVER_QUALITY, FETCH_DELAY, MAX_RETRIES

_scraper = cloudscraper.create_scraper(browser={"browser": "chrome", "platform": "windows"})


def fetch(url: str) -> str:
    """GET with retries and Cloudflare bypass. Returns response text."""
    import time

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = _scraper.get(url, timeout=20)
            resp.raise_for_status()
            return resp.text
        except Exception:
            if attempt == MAX_RETRIES:
                raise
            time.sleep(FETCH_DELAY * attempt)
    raise RuntimeError("unreachable")


def download_cover_as_base64(image_url: str) -> str:
    """Download an image and return a data:image/jpeg;base64,... string."""
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


def extract_chapter_number(title: str, fallback: int) -> int:
    """Pull an integer chapter number from a title string."""
    m = re.search(r"(?:Chapter|C)[\s\-]*(\d+)", title, re.IGNORECASE)
    return int(m.group(1)) if m else fallback
