from typing import Dict, List, Optional

from .db import get_conn


async def get_public_identity(username: str) -> Optional[dict]:
    """Returns {"username", "display_name", "bio"} honoring each field's own
    visibility flag. display_name/bio are None when the user hasn't opted to
    show them, or hasn't set them. Returns None if the user doesn't exist."""
    async with get_conn() as conn:
        async with conn.execute(
            "SELECT display_name, bio, show_display_name, show_bio FROM users WHERE username = ?",
            (username,)
        ) as cursor:
            row = await cursor.fetchone()
    if not row:
        return None
    display_name, bio, show_display_name, show_bio = row
    return {
        "username": username,
        "display_name": display_name if show_display_name else None,
        "bio": bio if show_bio else None,
    }


async def get_public_display_names(usernames: List[str]) -> Dict[str, Optional[str]]:
    """Batch lookup: username -> display_name (or None if not shown/not set).
    Used when rendering a list of messages/users without one query per row."""
    if not usernames:
        return {}
    unique = list(set(usernames))
    placeholders = ",".join("?" for _ in unique)
    async with get_conn() as conn:
        async with conn.execute(
            f"SELECT username, display_name, show_display_name FROM users WHERE username IN ({placeholders})",
            unique
        ) as cursor:
            rows = await cursor.fetchall()
    result = {u: None for u in unique}
    for username, display_name, show_display_name in rows:
        result[username] = display_name if show_display_name else None
    return result
