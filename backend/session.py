import secrets
from typing import Optional

_store: dict[str, dict] = {}


def create(data: dict) -> str:
    sid = secrets.token_urlsafe(16)
    _store[sid] = data
    return sid


def get(sid: str) -> Optional[dict]:
    return _store.get(sid)


def delete(sid: str) -> None:
    _store.pop(sid, None)
