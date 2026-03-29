from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class CompanyBase(BaseModel):
    name: str
    country: str
    currency_code: str
    currency_symbol: str | None = None


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: str | None = None
    country: str | None = None
    currency_code: str | None = None
    currency_symbol: str | None = None


class CompanyOut(CompanyBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    is_active: bool
    created_at: datetime
