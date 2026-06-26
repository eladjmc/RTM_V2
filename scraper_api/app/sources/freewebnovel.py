"""FreeWebNovel.com scrape adapter."""

import re
from urllib.parse import urljoin, urlparse, urlunparse

from bs4 import BeautifulSoup

from app.sources.base import BookMetadata, ChapterData
from app.sources.common import download_cover_as_base64, fetch

_CHAPTER_PATH_RE = re.compile(r"/novel/([^/]+)/chapter-\d+", re.IGNORECASE)
_CHAPTER_NUM_RE = re.compile(r"/chapter-(\d+)", re.IGNORECASE)


def _parse_article_content(soup: BeautifulSoup) -> str:
    article = soup.select_one("#article")
    if not article:
        return ""

    for tag in article.select("subtxt, iframe, script, ins, .read-ads"):
        tag.decompose()

    paragraphs: list[str] = []
    for el in article.find_all(["p", "h4"]):
        text = el.get_text(strip=True)
        if text:
            paragraphs.append(text)

    return "\n\n".join(paragraphs)


class FreewebnovelSource:
    name = "freewebnovel"

    def matches(self, url: str) -> bool:
        host = urlparse(url).netloc.lower()
        return "freewebnovel.com" in host

    def derive_book_url(self, chapter_url: str) -> str | None:
        parsed = urlparse(chapter_url)
        m = _CHAPTER_PATH_RE.search(parsed.path)
        if not m:
            return None
        slug = m.group(1)
        return urlunparse((parsed.scheme, parsed.netloc, f"/novel/{slug}", "", "", ""))

    def parse_chapter_page(self, html: str, base_url: str) -> ChapterData:
        soup = BeautifulSoup(html, "html.parser")

        if "page not found" in soup.title.get_text(strip=True).lower():
            return ChapterData(title="", content="")

        raw_title = ""
        chapter_span = soup.select_one("span.chapter")
        if chapter_span:
            raw_title = chapter_span.get_text(strip=True)
        if not raw_title:
            breadcrumb_links = soup.select(".m-read a[title], .crumb a[title]")
            for link in reversed(breadcrumb_links):
                href = link.get("href", "")
                if "/chapter-" in href:
                    raw_title = link.get_text(strip=True)
                    break

        chapter_number: int | None = None
        m = _CHAPTER_NUM_RE.search(urlparse(base_url).path)
        if m:
            chapter_number = int(m.group(1))

        content = _parse_article_content(soup)

        next_url: str | None = None
        next_btn = soup.select_one("#next_url")
        if next_btn and next_btn.get("href"):
            href = next_btn["href"]
            if href and not href.startswith("javascript"):
                next_url = urljoin(base_url, href)
                if next_url.rstrip("/") == base_url.rstrip("/"):
                    next_url = None

        book_title = ""
        tit_link = soup.select_one("h1.tit a")
        if tit_link:
            book_title = tit_link.get_text(strip=True)

        book_author = ""
        og_author = soup.select_one('meta[property="og:novel:author"]')
        if og_author:
            book_author = og_author.get("content", "").strip()
        if not book_author:
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

            og_title = soup.select_one('meta[property="og:title"]')
            if og_title:
                result.title = og_title.get("content", "").split(" - ")[0].strip()
            if not result.title:
                img = soup.select_one(".m-imgtxt img")
                if img:
                    result.title = img.get("alt", "").strip()

            og_author = soup.select_one('meta[property="og:novel:author"]')
            if og_author:
                result.author = og_author.get("content", "").strip()
            if not result.author:
                author_tag = soup.select_one('a[href*="/author/"]')
                if author_tag:
                    result.author = author_tag.get_text(strip=True)

            cover_url = ""
            cover_img = soup.select_one(".m-imgtxt img")
            if cover_img:
                cover_url = cover_img.get("src", "")
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
        if not data.content.strip():
            return True
        soup = BeautifulSoup(html, "html.parser")
        if "page not found" in soup.title.get_text(strip=True).lower():
            return True
        return False
