from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator


class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: str
    is_manager_approver: bool = False

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("admin", "manager", "employee"):
            raise ValueError("role must be admin, manager, or employee")
        return v


class UserCreate(UserBase):
    password: str
    company_id: UUID | None = None  # provided only for admin creating users


class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    is_manager_approver: bool | None = None
    password: str | None = None


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_id: UUID
    is_active: bool
    avatar_url: str | None = None
    created_at: datetime


class UserWithToken(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


# --- Auth schemas ---
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    company_name: str
    country: str
    currency_code: str
    currency_symbol: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class ManagerAssign(BaseModel):
    manager_id: UUID
