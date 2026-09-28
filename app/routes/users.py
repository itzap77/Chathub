from fastapi import APIRouter, HTTPException, Query

from ..auth import get_user_by_token
from ..connection_manager import manager
from ..db import get_conn
from ..profile_repo import get_public_display_names, get_public_identity

router = APIRouter()


@router.get("/api/users/directory")
async def get_directory(token: str = Query(...)):
    me = await get_user_by_token(token)
    if not me:
        raise HTTPException(status_code=401, detail="Unauthorized")
    online_set = manager.get_online_users(include_ephemeral=False)
    async with get_conn() as conn:
        async with conn.execute("SELECT username FROM users ORDER BY username ASC") as cursor:
            rows = await cursor.fetchall()
            all_users = [r[0] for r in rows if r[0] != me]
    display_names = await get_public_display_names(all_users)
    user_list = [{"username": u, "online": (u in online_set), "display_name": display_names.get(u)} for u in all_users]
    user_list.sort(key=lambda x: (not x["online"], x["username"]))
    return {"total_online": len(online_set), "users": user_list}


@router.get("/api/users/search")
async def search_users(token: str = Query(...), q: str = Query("")):
    me = await get_user_by_token(token)
    if not me:
        raise HTTPException(status_code=401, detail="Unauthorized")
    needle = q.strip().lower().replace("%", "").replace("_", "")[:25]
    if len(needle) < 1:
        return {"users": []}
    online_set = manager.get_online_users(include_ephemeral=False)
    async with get_conn() as conn:
        async with conn.execute(
            "SELECT username FROM users WHERE username != ? AND username LIKE ? ORDER BY username ASC LIMIT 25",
            (me, f"%{needle}%"),
        ) as cursor:
            rows = await cursor.fetchall()
    usernames = [r[0] for r in rows]
    display_names = await get_public_display_names(usernames)
    users = [{"username": u, "online": (u in online_set), "display_name": display_names.get(u)} for u in usernames]
    users.sort(key=lambda x: (not x["online"], x["username"]))
    return {"users": users}


@router.get("/api/users/public_profile")
async def get_public_profile(username: str = Query(...), token: str = Query(...)):
    me = await get_user_by_token(token)
    if not me:
        raise HTTPException(status_code=401, detail="Unauthorized")
    identity = await get_public_identity(username.strip().lower())
    if not identity:
        raise HTTPException(status_code=404, detail="User not found.")
    return identity
