import hashlib
from datetime import datetime, timedelta, timezone
from jose import jwt
from app.config import get_settings

settings = get_settings()

# Dev-only: passwords stored and compared as plain text in `users.password_hash`.
# Do not use this pattern in production.


def hash_password(password: str) -> str:
    """Store password as-is (column name is legacy `password_hash`)."""
    return password


def verify_password(plain: str, stored: str) -> bool:
    if plain is None or stored is None:
        return False
    return plain == stored


def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload["type"] = "access"
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload["type"] = "refresh"
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
