"""MongoDB connection and data-access helpers.

Uses the same cloud MongoDB as the main RTM backend
so books scraped locally appear for all users immediately.
"""

from pymongo import MongoClient
from pymongo.database import Database
from bson import ObjectId
from datetime import datetime, timezone

from app.config import MONGO_URI, DB_NAME

_client: MongoClient | None = None


def get_db() -> Database:
    """Return (and lazily create) the shared pymongo Database handle."""
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI)
    return _client[DB_NAME]


# ── Book helpers ──────────────────────────────────────────────────────────────

def upsert_book(
    title: str,
    author: str = "",
    cover: str = "",
) -> ObjectId:
    """Create a book if it doesn't exist (by title). Return its _id."""
    db = get_db()
    existing = db.books.find_one({"title": title})
    if existing:
        return existing["_id"]

    now = datetime.now(timezone.utc)
    result = db.books.insert_one({
        "title": title,
        "author": author,
        "cover": cover,
        "startingChapterNumber": 1,
        "lastReadChapter": None,
        "lastReadChapterNumber": 0,
        "lastReadAt": None,
        "lastReadPosition": {"paragraphIndex": 0, "wordIndex": 0},
        "createdAt": now,
        "updatedAt": now,
    })
    return result.inserted_id


# ── Chapter helpers ───────────────────────────────────────────────────────────

def upsert_chapter(
    book_id: ObjectId,
    chapter_number: int,
    title: str,
    content: str,
) -> bool:
    """Insert or update a chapter. Returns True if a new chapter was created."""
    db = get_db()
    now = datetime.now(timezone.utc)
    result = db.chapters.update_one(
        {"book": book_id, "chapterNumber": chapter_number},
        {
            "$set": {
                "title": title,
                "content": content,
                "updatedAt": now,
            },
            "$setOnInsert": {
                "book": book_id,
                "chapterNumber": chapter_number,
                "createdAt": now,
            },
        },
        upsert=True,
    )
    return result.upserted_id is not None


def chapter_exists(book_id: ObjectId, chapter_number: int) -> bool:
    """Check whether a chapter already exists in the DB."""
    db = get_db()
    return db.chapters.count_documents(
        {"book": book_id, "chapterNumber": chapter_number}, limit=1
    ) > 0


# ── Cleaning-rules helpers ────────────────────────────────────────────────────

def get_cleaning_rules(book_id: str | None = None) -> list[dict]:
    """Return all enabled rules that apply globally or to a specific book."""
    db = get_db()
    query: dict = {"enabled": True}
    if book_id:
        query["$or"] = [
            {"bookId": None},
            {"bookId": book_id},
        ]
    else:
        query["bookId"] = None
    return list(db.cleaning_rules.find(query))


def insert_cleaning_rule(rule: dict) -> str:
    db = get_db()
    rule["createdAt"] = datetime.now(timezone.utc)
    result = db.cleaning_rules.insert_one(rule)
    return str(result.inserted_id)


def update_cleaning_rule(rule_id: str, data: dict) -> bool:
    db = get_db()
    result = db.cleaning_rules.update_one(
        {"_id": ObjectId(rule_id)},
        {"$set": data},
    )
    return result.modified_count > 0


def delete_cleaning_rule(rule_id: str) -> bool:
    db = get_db()
    result = db.cleaning_rules.delete_one({"_id": ObjectId(rule_id)})
    return result.deleted_count > 0
