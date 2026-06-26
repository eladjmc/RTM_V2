"""Novellunar.com scrape adapter."""

import re
from urllib.parse import urlparse, urlunparse

from bs4 import BeautifulSoup

from app.sources.base import BookMetadata, ChapterData
from app.sources.common import download_cover_as_base64, fetch

_CHAPTER_URL_RE = re.compile(
    r"novellunar\.com/novel/([^/]+)/chapter/(\d+)",
    re.IGNORECASE,
)
_PLACEHOLDER_RE = re.compile(r"being updated|please come back later", re.IGNORECASE)
_AUTHOR_RE = re.compile(r"written by the author\s+(.+?),", re.IGNORECASE)


class NovellunarSource:
    name = "novellunar"

    def matches(self, url: str) -> bool:
        host = urlparse(url).netloc.lower()
        return "novellunar.com" in host

    def derive_book_url(self, chapter_url: str) -> str | None:
        m = _CHAPTER_URL_RE.search(chapter_url)
        if not m:
            return None
        parsed = urlparse(chapter_url)
        slug = m.group(1)
        return urlunparse((parsed.scheme, parsed.netloc, f"/novel/{slug}", "", "", ""))

    def _parse_url_parts(self, url: str) -> tuple[str, int] | None:
        m = _CHAPTER_URL_RE.search(url)
        if not m:
            return None
        return m.group(1), int(m.group(2))

    def parse_chapter_page(self, html: str, base_url: str) -> ChapterData:
        soup = BeautifulSoup(html, "html.parser")

        title_tag = soup.select_one("h1.text-lg")
        raw_title = title_tag.get_text(strip=True) if title_tag else ""

        chapter_number: int | None = None
        url_parts = self._parse_url_parts(base_url)
        if url_parts:
            chapter_number = url_parts[1]
        elif raw_title:
            m = re.search(r"Chapter\s+(\d+)", raw_title, re.IGNORECASE)
            if m:
                chapter_number = int(m.group(1))

        paragraphs: list[str] = []
        content_root = soup.select_one('article div[style*="pre-wrap"]')
        if content_root:
            current_parts: list[str] = []
            for span in content_root.find_all("span", recursive=False):
                text = span.get_text()
                stripped = text.strip()
                if not stripped:
                    if current_parts:
                        paragraphs.append(" ".join(current_parts))
                        current_parts = []
                    continue
                current_parts.append(stripped)
            if current_parts:
                paragraphs.append(" ".join(current_parts))

        content = "\n\n".join(paragraphs)

        book_title = ""
        breadcrumb_links = soup.select("a.hover\\:text-blue-600")
        for link in breadcrumb_links:
            href = link.get("href", "")
            if href.startswith("/novel/") and "/chapter/" not in href:
                book_title = link.get_text(strip=True)
                break
        if not book_title:
            og_title = soup.select_one("meta[property='og:title']")
            if og_title:
                book_title = re.sub(
                    r"\s+Chapter\s+\d+.*$",
                    "",
                    og_title.get("content", ""),
                    flags=re.IGNORECASE,
                ).strip()

        return ChapterData(
            title=raw_title,
            content=content,
            next_url=self._build_next_url(base_url, chapter_number),
            book_title=book_title,
            book_author="",
            chapter_number=chapter_number,
        )

    def _build_next_url(self, current_url: str, chapter_number: int | None) -> str | None:
        if chapter_number is None:
            return None
        url_parts = self._parse_url_parts(current_url)
        if not url_parts:
            return None
        slug, _ = url_parts
        parsed = urlparse(current_url)
        next_num = chapter_number + 1
        return urlunparse(
            (parsed.scheme, parsed.netloc, f"/novel/{slug}/chapter/{next_num}", "", "", "")
        )

    def fetch_book_metadata(self, book_url: str) -> BookMetadata:
        result = BookMetadata()
        try:
            html = fetch(book_url)
            soup = BeautifulSoup(html, "html.parser")

            title_tag = soup.select_one("h1.text-2xl") or soup.select_one("h1")
            if title_tag:
                result.title = title_tag.get_text(strip=True)

            meta_desc = soup.select_one('meta[name="description"]')
            if meta_desc:
                m = _AUTHOR_RE.search(meta_desc.get("content", ""))
                if m:
                    result.author = m.group(1).strip()

            cover_url = ""
            cover_img = soup.select_one('img[src*="img.novellunar.com"]')
            if cover_img:
                cover_url = cover_img.get("src", "")
            if not cover_url:
                og = soup.select_one("meta[property='og:image']")
                if og:
                    cover_url = og.get("content", "")

            if cover_url:
                result.cover = download_cover_as_base64(cover_url)
        except Exception:
            pass
        return result

    def get_next_chapter_url(self, current_url: str, data: ChapterData) -> str | None:
        return data.next_url

    def is_placeholder_chapter(self, html: str, data: ChapterData) -> bool:
        if not data.content.strip():
            return True
        soup = BeautifulSoup(html, "html.parser")
        meta_desc = soup.select_one('meta[name="description"]')
        if meta_desc and _PLACEHOLDER_RE.search(meta_desc.get("content", "")):
            return True
        return False
