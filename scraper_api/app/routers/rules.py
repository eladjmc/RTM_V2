"""CRUD endpoints for cleaning rules."""

from fastapi import APIRouter, HTTPException
from bson import ObjectId

from app.models.schemas import CleaningRuleIn, CleaningRuleOut
from app.services.db import (
    get_db,
    insert_cleaning_rule,
    update_cleaning_rule,
    delete_cleaning_rule,
)

router = APIRouter(prefix="/rules", tags=["rules"])


def _doc_to_out(doc: dict) -> CleaningRuleOut:
    """Convert a Mongo document to the response schema."""
    return CleaningRuleOut(
        id=str(doc["_id"]),
        book_id=doc.get("bookId"),
        pattern=doc["pattern"],
        action=doc.get("action", "remove_line"),
        replacement=doc.get("replacement", ""),
        description=doc.get("description", ""),
        enabled=doc.get("enabled", True),
    )


@router.get("/", response_model=list[CleaningRuleOut])
def list_rules(book_id: str | None = None):
    """List all rules, optionally filtered by book_id."""
    db = get_db()
    query: dict = {}
    if book_id:
        query["bookId"] = book_id
    return [_doc_to_out(d) for d in db.cleaning_rules.find(query)]


@router.post("/", response_model=CleaningRuleOut, status_code=201)
def create_rule(body: CleaningRuleIn):
    """Create a new cleaning rule."""
    doc = {
        "bookId": body.book_id,
        "pattern": body.pattern,
        "action": body.action,
        "replacement": body.replacement,
        "description": body.description,
        "enabled": body.enabled,
    }
    rule_id = insert_cleaning_rule(doc)
    doc["_id"] = ObjectId(rule_id)
    return _doc_to_out(doc)


@router.put("/{rule_id}", response_model=CleaningRuleOut)
def update_rule(rule_id: str, body: CleaningRuleIn):
    """Update an existing cleaning rule."""
    data = {
        "bookId": body.book_id,
        "pattern": body.pattern,
        "action": body.action,
        "replacement": body.replacement,
        "description": body.description,
        "enabled": body.enabled,
    }
    if not update_cleaning_rule(rule_id, data):
        raise HTTPException(404, "Rule not found")
    db = get_db()
    doc = db.cleaning_rules.find_one({"_id": ObjectId(rule_id)})
    return _doc_to_out(doc)


@router.delete("/{rule_id}", status_code=204)
def remove_rule(rule_id: str):
    """Delete a cleaning rule."""
    if not delete_cleaning_rule(rule_id):
        raise HTTPException(404, "Rule not found")
