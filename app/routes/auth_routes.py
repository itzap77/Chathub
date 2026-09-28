import secrets

from typing import Optional

from fastapi import APIRouter, Form, HTTPException, Query

from ..auth import create_session, get_user_by_token, hash_pass
from ..config import USERNAME_RE
from ..db import get_conn

router = APIRouter()


@router.post("/api/register")
async def register(username: str = Form(...), password: str = Form(...)):
    username = username.strip().lower()
    if not USERNAME_RE.match(username) or len(password) < 6:
        raise HTTPException(status_code=400, detail="Username 2-25 chars, password 6+ chars.")
    salt, pwd_hash = hash_pass(password)
    try:
        async with get_conn() as conn:
            await conn.execute(
                "INSERT INTO users (username, salt, password_hash) VALUES (?, ?, ?)",
                (username, salt, pwd_hash)
            )
            await conn.commit()
        return {"status": "ok", "detail": "Account created successfully! Please sign in."}
    except Exception:
        raise HTTPException(status_code=409, detail="Username already exists.")


@router.post("/api/login")
async def login(username: str = Form(...), password: str = Form(...)):
    username = username.strip().lower()
    async with get_conn() as conn:
        async with conn.execute("SELECT salt, password_hash FROM users WHERE username = ?", (username,)) as cursor:
            row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    salt, stored_hash = row
    _, computed_hash = hash_pass(password, salt)
    if not secrets.compare_digest(computed_hash, stored_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    token = await create_session(username)
    return {"status": "ok", "username": username, "token": token}


@router.post("/api/logout")
async def logout(token: str = Form(...)):
    async with get_conn() as conn:
        await conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        await conn.commit()
    return {"status": "ok"}


@router.get("/api/account/profile")
async def get_account_profile(token: str = Query(...)):
    user = await get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    async with get_conn() as conn:
        async with conn.execute(
            "SELECT display_name, bio, show_display_name, show_bio FROM users WHERE username = ?", (user,)
        ) as cursor:
            row = await cursor.fetchone()
    display_name, bio, show_display_name, show_bio = row if row else (None, None, 0, 0)
    return {
        "status": "ok",
        "username": user,
        "display_name": display_name,
        "bio": bio,
        "show_display_name": bool(show_display_name),
        "show_bio": bool(show_bio),
    }


@router.post("/api/account/update_profile")
async def update_profile(
    token: str = Form(...),
    display_name: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    show_display_name: Optional[str] = Form(None),
    show_bio: Optional[str] = Form(None)
):
    user = await get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    clean_name = (display_name or "").strip()[:50] or None
    clean_bio = (bio or "").strip()[:160] or None
    flag_display = 1 if show_display_name in ("true", "1", "on") else 0
    flag_bio = 1 if show_bio in ("true", "1", "on") else 0

    async with get_conn() as conn:
        await conn.execute(
            "UPDATE users SET display_name = ?, bio = ?, show_display_name = ?, show_bio = ? WHERE username = ?",
            (clean_name, clean_bio, flag_display, flag_bio, user)
        )
        await conn.commit()
    return {
        "status": "ok",
        "display_name": clean_name,
        "bio": clean_bio,
        "show_display_name": bool(flag_display),
        "show_bio": bool(flag_bio),
    }


@router.post("/api/account/change_password")
async def change_password(
    token: str = Form(...),
    current_password: str = Form(...),
    new_password: str = Form(...)
):
    user = await get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be 6+ characters.")

    async with get_conn() as conn:
        async with conn.execute("SELECT salt, password_hash FROM users WHERE username = ?", (user,)) as cursor:
            row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Account not found.")
        salt, stored_hash = row
        _, check_hash = hash_pass(current_password, salt)
        if not secrets.compare_digest(check_hash, stored_hash):
            raise HTTPException(status_code=403, detail="Current password is incorrect.")

        new_salt, new_hash = hash_pass(new_password)
        await conn.execute(
            "UPDATE users SET salt = ?, password_hash = ? WHERE username = ?",
            (new_salt, new_hash, user)
        )
        await conn.commit()

    return {"status": "ok", "detail": "Password updated successfully."}
