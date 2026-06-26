"""Novelfull.net scrape adapter (PHP template family, similar to novelbin)."""

import re
from urllib.parse import urljoin, urlparse, urlunparse

from bs4 import BeautifulSoup, NavigableString, Tag

from app.sources.base import BookMetadata, ChapterData
from app.sources.common import download_cover_as_base64, fetch

_CHAPTER_PATH_RE = re.compile(r"/([^/]+)/chapter-\d+", re.IGNORECASE)
_CHAPTER_NUM_RE = re.compile(r"/chapter-(\d+)", re.IGNORECASE)


def _parse_content_paragraphs(content_div: Tag) -> str:
    """Extract paragraph text from a chapter content div, skipping ads/embeds."""
    for tag in content_div.select("iframe, script, ins, #frame"):
        tag.decompose()

    paragraphs: list[str] = []
    for child in content_div.children:
        if isinstance(child, Tag):
            for br in child.find_all("br"):
                br.replace_with(NavigableString("\n"))
            text = child.get_text()
            for line in text.split("\n"):
                stripped = line.strip()
                if stripped:
                    paragraphs.append(stripped)
        elif isinstance(child, NavigableString):
            for line in str(child).split("\n"):
                stripped = line.strip()
                if stripped:
                    paragraphs.append(stripped)

    return "\n\n".join(paragraphs)


def _resolve_next_url(soup: BeautifulSoup, base_url: str) -> str | None:
    next_btn = soup.select_one("#next_chap")
    if not next_btn or not next_btn.get("href") or next_btn.has_attr("disabled"):
        next_btn = soup.select_one('a[data-chapter-nav="next"]')

    if not next_btn or not next_btn.get("href"):
        return None

    href = next_btn["href"]
    if not href or href.endswith("#"):
        return None

    next_url = urljoin(base_url, href)
    if next_url.rstrip("/") == base_url.rstrip("/"):
        return None
    return next_url


class NovelfullSource:
    name = "novelfull"

    def matches(self, url: str) -> bool:
        host = urlparse(url).netloc.lower()
        return "novelfull.net" in host

    def derive_book_url(self, chapter_url: str) -> str | None:
        parsed = urlparse(chapter_url)
        m = _CHAPTER_PATH_RE.search(parsed.path)
        if not m:
            return None
        slug = m.group(1)
        return urlunparse((parsed.scheme, parsed.netloc, f"/{slug}.html", "", "", ""))

    def parse_chapter_page(self, html: str, base_url: str) -> ChapterData:
        soup = BeautifulSoup(html, "html.parser")

        title_tag = (
            soup.select_one("a.chapter-title")
            or soup.select_one(".chapter-text")
            or soup.select_one("ol.breadcrumb li.active a")
        )
        raw_title = title_tag.get_text(strip=True) if title_tag else ""

        chapter_number: int | None = None
        m = _CHAPTER_NUM_RE.search(urlparse(base_url).path)
        if m:
            chapter_number = int(m.group(1))

        content_div = soup.select_one("#chapter-content") or soup.select_one("#chr-content")
        content = _parse_content_paragraphs(content_div) if content_div else ""

        next_url = _resolve_next_url(soup, base_url)

        book_title = ""
        truyen_title = soup.select_one("a.truyen-title")
        if truyen_title:
            book_title = truyen_title.get_text(strip=True)
        else:
            breadcrumb = soup.select("ol.breadcrumb li")
            if len(breadcrumb) >= 2:
                book_link = breadcrumb[1].select_one("a")
                if book_link:
                    book_title = book_link.get_text(strip=True)

        book_author = ""
        author_tag = soup.select_one('a[href*="/author/"]')
        if author_tag:
            book_author = author_tag.get_text(strip=True)

        return ChapterData(
            title=raw_title,
            content=content,
            next_url=next_url,
            book_title=book_title,
            book_author=book_author,
            chapter_number=chapter_number,
        )

    def fetch_book_metadata(self, book_url: str) -> BookMetadata:
        result = BookMetadata()
        try:
            html = fetch(book_url)
            soup = BeautifulSoup(html, "html.parser")

            title_tag = soup.select_one("h3.title") or soup.select_one("h1")
            if title_tag:
                result.title = title_tag.get_text(strip=True)

            author_tag = soup.select_one('a[href*="/author/"]')
            if author_tag:
                result.author = author_tag.get_text(strip=True)

            cover_url = ""
            cover_img = soup.select_one(".book img")
            if cover_img:
                cover_url = cover_img.get("src") or cover_img.get("data-src") or ""
            if not cover_url:
                og = soup.select_one("meta[property='og:image']")
                if og:
                    cover_url = og.get("content", "")

            if cover_url:
                cover_url = urljoin(book_url, cover_url)
                result.cover = download_cover_as_base64(cover_url)
        except Exception:
            pass
        return result

    def get_next_chapter_url(self, current_url: str, data: ChapterData) -> str | None:
        return data.next_url

    def is_placeholder_chapter(self, html: str, data: ChapterData) -> bool:
        return not data.content.strip()
