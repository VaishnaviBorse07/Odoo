from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.company import Company
from app.models.token import RefreshToken
from app.schemas.user import SignupRequest, LoginRequest, TokenRefreshRequest, UserWithToken, UserOut
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token, hash_token
from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/signup", response_model=UserWithToken, status_code=201)
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create company
    company = Company(
        name=body.company_name,
        country=body.country,
        currency_code=body.currency_code,
        currency_symbol=body.currency_symbol,
    )
    db.add(company)
    await db.flush()  # get company.id

    # Create admin user
    user = User(
        company_id=company.id,
        email=body.email,
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        role="admin",
    )
    db.add(user)
    await db.flush()

    tokens = _generate_tokens(user, db)
    await db.commit()
    await db.refresh(user)
    return UserWithToken(
        access_token=tokens[0],
        refresh_token=tokens[1],
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=UserWithToken)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user: User | None = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    tokens = _generate_tokens(user, db)
    await db.commit()
    return UserWithToken(
        access_token=tokens[0],
        refresh_token=tokens[1],
        user=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=UserWithToken)
async def refresh_token(body: TokenRefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError()
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    token_hash = hash_token(body.refresh_token)
    rt_result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    rt = rt_result.scalar_one_or_none()
    if not rt:
        raise HTTPException(status_code=401, detail="Refresh token expired or revoked")

    rt.revoked = True  # rotate

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    tokens = _generate_tokens(user, db)
    await db.commit()
    return UserWithToken(
        access_token=tokens[0],
        refresh_token=tokens[1],
        user=UserOut.model_validate(user),
    )


@router.post("/logout")
async def logout(body: TokenRefreshRequest, db: AsyncSession = Depends(get_db)):
    token_hash = hash_token(body.refresh_token)
    rt_result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    rt = rt_result.scalar_one_or_none()
    if rt:
        rt.revoked = True
        await db.commit()
    return {"detail": "Logged out"}


def _generate_tokens(user: User, db: AsyncSession) -> tuple[str, str]:
    payload = {"sub": str(user.id), "role": user.role, "company_id": str(user.company_id)}
    access = create_access_token(payload)
    refresh = create_refresh_token(payload)

    rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)
    return access, refresh
