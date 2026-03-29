from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from typing import Any
from pydantic import BaseModel, ConfigDict


class ExpenseCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    description: str | None = None
    is_active: bool


class ExpenseCategoryCreate(BaseModel):
    name: str
    description: str | None = None


class ExpenseCreate(BaseModel):
    title: str
    description: str | None = None
    expense_date: date
    amount: Decimal
    currency_code: str
    category_id: UUID | None = None


class ExpenseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    expense_date: date | None = None
    amount: Decimal | None = None
    currency_code: str | None = None
    category_id: UUID | None = None


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_id: UUID
    employee_id: UUID
    category_id: UUID | None = None
    title: str
    description: str | None = None
    expense_date: date
    amount: Decimal
    currency_code: str
    amount_in_company_currency: Decimal | None = None
    exchange_rate: Decimal | None = None
    status: str
    current_approval_step: int
    receipt_url: str | None = None
    ocr_data: dict | None = None
    admin_notes: str | None = None
    created_at: datetime
    updated_at: datetime

    employee_name: str | None = None
    category_name: str | None = None


class ExpenseListOut(BaseModel):
    items: list[ExpenseOut]
    total: int
    page: int
    page_size: int
