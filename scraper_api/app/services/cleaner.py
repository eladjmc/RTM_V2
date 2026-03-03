"""Content and title cleaning using regex rules.

Two layers:
  1. Global defaults from config.py (always applied first).
  2. DB-stored rules (global + per-book), fetched at clean time.
"""

import re
from app.config import DEFAULT_CLEANING_RULES, CHAPTER_TITLE_PATTERN
from app.services.db import get_cleaning_rules


def _apply_rule(line: str, rule: dict) -> str | None:
    """Apply a single rule to a line.

    Returns the (possibly modified) line, or None to drop it entirely.
    Blank lines are always preserved (they serve as paragraph separators).
    """
    # Never drop blank lines — they are paragraph separators (\n\n)
    if not line.strip():
        return line

    action = rule.get("action", "remove_line")
    pattern = rule["pattern"]

    try:
        if action == "remove_line":
            if re.search(pattern, line, re.IGNORECASE):
                return None
        elif action == "remove_match":
            line = re.sub(pattern, "", line, flags=re.IGNORECASE)
        elif action == "replace":
            replacement = rule.get("replacement", "")
            line = re.sub(pattern, replacement, line, flags=re.IGNORECASE)
    except re.error:
        pass  # bad regex — skip rule silently

    return line


def clean_content(raw: str, book_id: str | None = None) -> str:
    """Clean chapter content through the two-layer rule pipeline.

    1. Strip embedded chapter titles from the first few lines.
    2. Apply default rules.
    3. Apply DB rules.
    4. Collapse blank lines.
    """
    lines = raw.split("\n")

    # ── Step 1: Remove chapter-title lines at the start ────────────────────
    cleaned_start: list[str] = []
    title_zone = True  # still in the leading title area
    for line in lines:
        stripped = line.strip()
        if title_zone:
            if not stripped:
                continue  # skip leading blank lines
            if re.match(CHAPTER_TITLE_PATTERN, stripped, re.IGNORECASE):
                continue  # skip chapter title line
            title_zone = False
        cleaned_start.append(line)
    lines = cleaned_start

    # ── Step 2: Apply default rules ────────────────────────────────────────
    for rule in DEFAULT_CLEANING_RULES:
        remaining: list[str] = []
        for line in lines:
            result = _apply_rule(line, rule)
            if result is not None:
                remaining.append(result)
        lines = remaining

    # ── Step 3: Apply DB rules ─────────────────────────────────────────────
    db_rules = get_cleaning_rules(book_id)
    for rule in db_rules:
        remaining = []
        for line in lines:
            result = _apply_rule(line, rule)
            if result is not None:
                remaining.append(result)
        lines = remaining

    # ── Step 4: Collapse multiple blank lines into one ─────────────────────
    output: list[str] = []
    prev_blank = False
    for line in lines:
        is_blank = line.strip() == ""
        if is_blank and prev_blank:
            continue
        output.append(line)
        prev_blank = is_blank

    # Trim leading/trailing blank lines
    text = "\n".join(output).strip()
    return text


def clean_chapter_title(raw_title: str) -> str:
    """Clean a chapter title string.

    Strips patterns like:
      "Chapter 865: Chapter 318: The Legacy of …_2"
    → "The Legacy of …"
    """
    title = raw_title.strip()

    # Strip trailing _1, _2, etc.
    title = re.sub(r"_\d+\s*$", "", title)

    # Strip repeated "Chapter N:", "CN", "c-N:" prefixes
    title = re.sub(
        r"^(?:(?:Chapter|C)[\s\-]*\d+[\s:\-\–\—]*)+",
        "",
        title,
        flags=re.IGNORECASE,
    ).strip()

    return title or raw_title.strip()
