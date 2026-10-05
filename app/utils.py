import base64
import os
import random

from .config import ADJECTIVES, NOUNS

# Secret key for encrypting messages in the database
# You can set CHAT_SECRET_KEY in your environment or keep this default key
SECRET_KEY = os.getenv("CHAT_SECRET_KEY", "chathub-secure-key-987654321").encode()


def encrypt_text(plain_text: str) -> str:
    """Encrypts plain text message content before storing it in the database."""
    if not plain_text:
        return plain_text
    data = plain_text.encode("utf-8")
    cipher = bytes(b ^ SECRET_KEY[i % len(SECRET_KEY)] for i, b in enumerate(data))
    return base64.b64encode(cipher).decode("utf-8")


def decrypt_text(cipher_text: str) -> str:
    """Decrypts database message content back to plain text."""
    if not cipher_text:
        return cipher_text
    try:
        data = base64.b64decode(cipher_text.encode("utf-8"))
        plain = bytes(b ^ SECRET_KEY[i % len(SECRET_KEY)] for i, b in enumerate(data))
        return plain.decode("utf-8")
    except Exception:
        # Fallback to display older unencrypted messages safely
        return cipher_text


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
