import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_manager_approver: Mapped[bool] = mapped_column(Boolean, default=False)
    avatar_url: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    company: Mapped["Company"] = relationship("Company", back_populates="users", lazy="selectin")
    expenses: Mapped[list["Expense"]] = relationship("Expense", back_populates="employee", foreign_keys="Expense.employee_id", lazy="selectin")
    approvals: Mapped[list["ExpenseApproval"]] = relationship("ExpenseApproval", back_populates="approver", foreign_keys="ExpenseApproval.approver_id", lazy="selectin")

    managed_employees: Mapped[list["EmployeeManagerRelationship"]] = relationship(
        "EmployeeManagerRelationship", foreign_keys="EmployeeManagerRelationship.manager_id", back_populates="manager", lazy="selectin",
    )
    managers: Mapped[list["EmployeeManagerRelationship"]] = relationship(
        "EmployeeManagerRelationship", foreign_keys="EmployeeManagerRelationship.employee_id", back_populates="employee", lazy="selectin",
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class EmployeeManagerRelationship(Base):
    __tablename__ = "employee_manager_relationships"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    manager_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    employee: Mapped["User"] = relationship("User", foreign_keys=[employee_id], back_populates="managers", lazy="selectin")
    manager: Mapped["User"] = relationship("User", foreign_keys=[manager_id], back_populates="managed_employees", lazy="selectin")
