"""Application-wide configuration and default cleaning rules."""

import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI: str = os.getenv("MONGO_URI", "")
DB_NAME: str = os.getenv("DB_NAME", "rtm_v2")

# Delay (seconds) between chapter fetches to avoid rate-limiting
FETCH_DELAY: float = 1.5

# Default request headers
HEADERS: dict[str, str] = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Max retries on transient HTTP errors
MAX_RETRIES: int = 3

# Cover image settings (matches frontend compressCover)
COVER_MAX_WIDTH: int = 300
COVER_MAX_HEIGHT: int = 450
COVER_QUALITY: int = 80

# ---------------------------------------------------------------------------
# Default cleaning rules — always applied before DB rules.
# Each rule has:
#   pattern  — Python regex
#   action   — "remove_line" | "remove_match" | "replace"
#   replacement — used only when action == "replace"
# ---------------------------------------------------------------------------
DEFAULT_CLEANING_RULES: list[dict] = [
    # ── Source / credit lines ──────────────────────────────────────────────
    {"pattern": r"(?i)^source\s*:.*$", "action": "remove_line"},
    {"pattern": r"(?i)updated by \S+\.com", "action": "remove_line"},
    {"pattern": r"(?i)^translator\s*:.*$", "action": "remove_line"},

    # ── Ad / spam markers ─────────────────────────────────────────────────
    {"pattern": r"\[Pubfuture Ads\]", "action": "remove_line"},
    {"pattern": r"⚠️SYSTEM ALERT⚠️", "action": "remove_line"},
    {"pattern": r"(?i)novelbin\.com|webnovel\.com|novlove\.com|readwn\.com", "action": "remove_line"},
    {"pattern": r"(?i)read latest chapters at", "action": "remove_line"},
    {"pattern": r"(?i)visit .+\.com for the best reading experience", "action": "remove_line"},

    # ── Tiny junk lines (< 5 chars, usually ad remnants) ──────────────────
    {"pattern": r"^.{0,4}$", "action": "remove_line"},
]

# Regex for stripping duplicate chapter titles from the first few lines
# Matches lines like: "Chapter 865: Chapter 318: The Legacy of ..."
CHAPTER_TITLE_PATTERN = r"^(?:(?:Chapter|C)[\s\-]*\d+[\s:\-\–\—]*)+.*$"
