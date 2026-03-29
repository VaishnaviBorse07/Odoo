import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, Boolean, Date, DateTime, ForeignKey, Numeric, Text, Integer, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ExpenseCategory(Base):
    __tablename__ = "expense_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    company: Mapped["Company"] = relationship("Company", back_populates="expense_categories", lazy="selectin")
    expenses: Mapped[list["Expense"]] = relationship("Expense", back_populates="category", lazy="selectin")


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("expense_categories.id", ondelete="SET NULL"))

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)

    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    currency_code: Mapped[str] = mapped_column(String(10), nullable=False)
    amount_in_company_currency: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    exchange_rate: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))

    status: Mapped[str] = mapped_column(String(20), default="pending")
    current_approval_step: Mapped[int] = mapped_column(Integer, default=0)

    receipt_url: Mapped[str | None] = mapped_column(Text)
    ocr_raw_text: Mapped[str | None] = mapped_column(Text)
    ocr_data: Mapped[dict | None] = mapped_column(JSONB)
    admin_notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    company: Mapped["Company"] = relationship("Company", lazy="selectin")
    employee: Mapped["User"] = relationship("User", foreign_keys=[employee_id], back_populates="expenses", lazy="selectin")
    category: Mapped["ExpenseCategory | None"] = relationship("ExpenseCategory", back_populates="expenses", lazy="selectin")
    approvals: Mapped[list["ExpenseApproval"]] = relationship("ExpenseApproval", back_populates="expense", cascade="all, delete-orphan", lazy="selectin")
