"""Novelbin.com scrape adapter."""

import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup, NavigableString, Tag

from app.sources.base import BookMetadata, ChapterData
from app.sources.common import download_cover_as_base64, fetch


class NovelbinSource:
    name = "novelbin"

    def matches(self, url: str) -> bool:
        host = urlparse(url).netloc.lower()
        return "novelbin.com" in host

    def derive_book_url(self, chapter_url: str) -> str | None:
        m = re.search(r"(https?://[^/]+/b/[^/]+)", chapter_url, re.IGNORECASE)
        return m.group(1).rstrip("/") if m else None

    def parse_chapter_page(self, html: str, base_url: str) -> ChapterData:
        soup = BeautifulSoup(html, "html.parser")

        title_tag = soup.select_one("a.chr-title") or soup.select_one(".chr-text span")
        raw_title = title_tag.get_text(strip=True) if title_tag else ""

        content_div = soup.select_one("#chr-content")
        paragraphs: list[str] = []
        if content_div:
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

        content = "\n\n".join(paragraphs)

        next_btn = soup.select_one("#next_chap")
        if not next_btn or not next_btn.get("href"):
            next_btn = soup.select_one('a[data-chapter-nav="next"]')

        next_url: str | None = None
        if next_btn and next_btn.get("href"):
            href = next_btn["href"]
            if href and not href.endswith("#"):
                next_url = urljoin(base_url, href)
                if next_url.rstrip("/") == base_url.rstrip("/"):
                    next_url = None

        book_title = ""
        novel_title_tag = soup.select_one(".novel-title")
        if novel_title_tag:
            book_title = novel_title_tag.get_text(strip=True)
        else:
            breadcrumb = soup.select("ol.breadcrumb li")
            if len(breadcrumb) >= 2:
                book_link = breadcrumb[1].select_one("a")
                if book_link:
                    book_title = book_link.get_text(strip=True)

        book_author = ""
        author_tag = (
            soup.select_one(".novel-author a")
            or soup.select_one("a[href*='/author/']")
            or soup.select_one(".author")
        )
        if author_tag:
            book_author = author_tag.get_text(strip=True)

        return ChapterData(
            title=raw_title,
            content=content,
            next_url=next_url,
            book_title=book_title,
            book_author=book_author,
        )

    def fetch_book_metadata(self, book_url: str) -> BookMetadata:
        result = BookMetadata()
        try:
            html = fetch(book_url)
            soup = BeautifulSoup(html, "html.parser")

            title_tag = soup.select_one("h3.title") or soup.select_one("h1")
            if title_tag:
                result.title = title_tag.get_text(strip=True)

            info_links = soup.select(".info a")
            if info_links:
                result.author = info_links[0].get_text(strip=True)

            cover_url = ""
            cover_img = soup.select_one(".book img")
            if cover_img:
                cover_url = cover_img.get("src") or cover_img.get("data-src") or ""
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
        return not data.content.strip()
