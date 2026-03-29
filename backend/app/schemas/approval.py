from uuid import UUID
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, field_validator, model_validator


class ApprovalRuleStepCreate(BaseModel):
    step_number: int
    approver_user_id: UUID | None = None
    approver_role_label: str | None = None
    is_manager_of_employee: bool = False
    is_key_approver: bool = False

    @model_validator(mode="after")
    def validate_step_target(self):
        if not self.is_manager_of_employee and not self.approver_user_id:
            raise ValueError("Each step must have either a direct manager or a specific approver.")
        if self.is_manager_of_employee and self.approver_user_id:
            raise ValueError("A step cannot target both the direct manager and a specific approver.")
        return self


class ApprovalRuleStepOut(ApprovalRuleStepCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    rule_id: UUID


class ApprovalRuleCreate(BaseModel):
    name: str
    description: str | None = None
    min_amount: Decimal | None = None
    max_amount: Decimal | None = None
    rule_type: str = "sequential"
    percentage_threshold: int | None = None
    steps: list[ApprovalRuleStepCreate]

    @field_validator("rule_type")
    @classmethod
    def validate_rule_type(cls, value: str) -> str:
        allowed = {"sequential", "percentage", "specific_approver", "hybrid"}
        if value not in allowed:
            raise ValueError(f"rule_type must be one of: {', '.join(sorted(allowed))}")
        return value

    @field_validator("percentage_threshold")
    @classmethod
    def validate_percentage_threshold(cls, value: int | None) -> int | None:
        if value is not None and not 1 <= value <= 100:
            raise ValueError("percentage_threshold must be between 1 and 100.")
        return value

    @model_validator(mode="after")
    def validate_rule_configuration(self):
        if not self.steps:
            raise ValueError("At least one approval step is required.")

        step_numbers = [step.step_number for step in self.steps]
        if len(step_numbers) != len(set(step_numbers)):
            raise ValueError("Approval step numbers must be unique.")

        has_key_approver = any(step.is_key_approver for step in self.steps)
        if self.rule_type in {"percentage", "hybrid"} and self.percentage_threshold is None:
            raise ValueError("percentage_threshold is required for percentage and hybrid rules.")
        if self.rule_type == "specific_approver" and not has_key_approver:
            raise ValueError("specific_approver rules require one key approver.")
        if self.rule_type == "hybrid" and not has_key_approver:
            raise ValueError("hybrid rules require one key approver for the specific approver condition.")
        return self


class ApprovalRuleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    min_amount: Decimal | None = None
    max_amount: Decimal | None = None
    rule_type: str | None = None
    percentage_threshold: int | None = None
    is_active: bool | None = None
    steps: list[ApprovalRuleStepCreate] | None = None

    @field_validator("rule_type")
    @classmethod
    def validate_rule_type(cls, value: str | None) -> str | None:
        if value is None:
            return value
        allowed = {"sequential", "percentage", "specific_approver", "hybrid"}
        if value not in allowed:
            raise ValueError(f"rule_type must be one of: {', '.join(sorted(allowed))}")
        return value

    @field_validator("percentage_threshold")
    @classmethod
    def validate_percentage_threshold(cls, value: int | None) -> int | None:
        if value is not None and not 1 <= value <= 100:
            raise ValueError("percentage_threshold must be between 1 and 100.")
        return value

    @model_validator(mode="after")
    def validate_rule_configuration(self):
        if self.steps is None:
            return self

        if not self.steps:
            raise ValueError("At least one approval step is required.")

        step_numbers = [step.step_number for step in self.steps]
        if len(step_numbers) != len(set(step_numbers)):
            raise ValueError("Approval step numbers must be unique.")

        rule_type = self.rule_type
        has_key_approver = any(step.is_key_approver for step in self.steps)
        if rule_type in {"percentage", "hybrid"} and self.percentage_threshold is None:
            raise ValueError("percentage_threshold is required when updating percentage or hybrid rules.")
        if rule_type == "specific_approver" and not has_key_approver:
            raise ValueError("specific_approver rules require one key approver.")
        if rule_type == "hybrid" and not has_key_approver:
            raise ValueError("hybrid rules require one key approver for the specific approver condition.")
        return self


class ApprovalRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_id: UUID
    name: str
    description: str | None = None
    min_amount: Decimal | None = None
    max_amount: Decimal | None = None
    rule_type: str
    percentage_threshold: int | None = None
    is_active: bool
    steps: list[ApprovalRuleStepOut] = []
    created_at: datetime


class ApprovalActionRequest(BaseModel):
    action: str         # "approve" | "reject"
    comments: str | None = None


class ExpenseApprovalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    expense_id: UUID
    step_number: int
    approver_id: UUID
    status: str
    comments: str | None = None
    action_at: datetime | None = None
    created_at: datetime

    approver_name: str | None = None
    approver_role_label: str | None = None
