import random

from .config import ADJECTIVES, NOUNS


def generate_random_alias() -> str:
    return f"{random.choice(ADJECTIVES)}{random.choice(NOUNS)}_{random.randint(100, 999)}"


def make_dm_room_id(u1: str, u2: str) -> str:
    pair = sorted([u1.lower(), u2.lower()])
    return f"dm_{pair[0]}__{pair[1]}"


def parse_dm_target(room_id: str, my_username: str) -> str:
    raw = room_id.replace("dm_", "")
    parts = raw.split("__") if "__" in raw else raw.split("_")
    my_clean = my_username.strip().lower()
    for p in parts:
        if p.lower() != my_clean:
            return p
    return parts[0]
