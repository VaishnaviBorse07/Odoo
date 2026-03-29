import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Numeric, Text, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ApprovalRule(Base):
    __tablename__ = "approval_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    min_amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    max_amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    rule_type: Mapped[str] = mapped_column(String(30), default="sequential")
    percentage_threshold: Mapped[int | None] = mapped_column(Integer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    company: Mapped["Company"] = relationship("Company", back_populates="approval_rules", lazy="selectin")
    steps: Mapped[list["ApprovalRuleStep"]] = relationship(
        "ApprovalRuleStep", back_populates="rule", order_by="ApprovalRuleStep.step_number",
        cascade="all, delete-orphan", lazy="selectin",
    )


class ApprovalRuleStep(Base):
    __tablename__ = "approval_rule_steps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("approval_rules.id", ondelete="CASCADE"), nullable=False)
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    approver_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    approver_role_label: Mapped[str | None] = mapped_column(String(100))
    is_manager_of_employee: Mapped[bool] = mapped_column(Boolean, default=False)
    is_key_approver: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    rule: Mapped["ApprovalRule"] = relationship("ApprovalRule", back_populates="steps", lazy="selectin")
    approver_user: Mapped["User | None"] = relationship("User", foreign_keys=[approver_user_id], lazy="selectin")


class ExpenseApproval(Base):
    __tablename__ = "expense_approvals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    expense_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False)
    rule_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("approval_rules.id", ondelete="SET NULL"))
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    approver_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    comments: Mapped[str | None] = mapped_column(Text)
    action_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    expense: Mapped["Expense"] = relationship("Expense", back_populates="approvals", lazy="selectin")
    approver: Mapped["User"] = relationship("User", foreign_keys=[approver_id], back_populates="approvals", lazy="selectin")
    rule: Mapped["ApprovalRule | None"] = relationship("ApprovalRule", lazy="selectin")
