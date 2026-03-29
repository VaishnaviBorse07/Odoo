from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.expense import Expense
from app.models.approval import ApprovalRule, ApprovalRuleStep, ExpenseApproval
from app.models.user import User
from app.schemas.approval import (
    ApprovalRuleCreate, ApprovalRuleUpdate, ApprovalRuleOut,
    ApprovalActionRequest, ExpenseApprovalOut,
)
from app.core.dependencies import get_current_user, require_admin, require_manager_or_admin
from app.services.approval_service import process_approval_action

router = APIRouter(prefix="/approvals", tags=["Approvals"])


def _resolve_step_label(approval: ExpenseApproval) -> str | None:
    if not approval.rule:
        return None

    matching_step = next(
        (step for step in approval.rule.steps if step.step_number == approval.step_number),
        None,
    )
    if not matching_step:
        return None
    if matching_step.approver_role_label:
        return matching_step.approver_role_label
    if matching_step.is_manager_of_employee:
        return "Manager"
    return None


# ── Approval Rules (Admin) ───────────────────────────────────────────────────

@router.get("/rules", response_model=list[ApprovalRuleOut])
async def list_rules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(ApprovalRule)
        .where(ApprovalRule.company_id == current_user.company_id)
        .order_by(ApprovalRule.created_at.desc())
    )
    return result.scalars().all()


@router.post("/rules", response_model=ApprovalRuleOut, status_code=201)
async def create_rule(
    body: ApprovalRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    rule = ApprovalRule(
        company_id=current_user.company_id,
        name=body.name,
        description=body.description,
        min_amount=body.min_amount,
        max_amount=body.max_amount,
        rule_type=body.rule_type,
        percentage_threshold=body.percentage_threshold,
    )
    db.add(rule)
    await db.flush()

    for step_data in sorted(body.steps, key=lambda s: s.step_number):
        step = ApprovalRuleStep(
            rule_id=rule.id,
            step_number=step_data.step_number,
            approver_user_id=step_data.approver_user_id,
            approver_role_label=step_data.approver_role_label,
            is_manager_of_employee=step_data.is_manager_of_employee,
            is_key_approver=step_data.is_key_approver,
        )
        db.add(step)

    await db.commit()
    await db.refresh(rule)
    return rule


@router.patch("/rules/{rule_id}", response_model=ApprovalRuleOut)
async def update_rule(
    rule_id: UUID,
    body: ApprovalRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(ApprovalRule).where(
            ApprovalRule.id == rule_id,
            ApprovalRule.company_id == current_user.company_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    update_data = body.model_dump(exclude_unset=True, exclude={"steps"})
    for k, v in update_data.items():
        setattr(rule, k, v)

    if body.steps is not None:
        for step in rule.steps:
            await db.delete(step)
        await db.flush()
        for step_data in sorted(body.steps, key=lambda s: s.step_number):
            step = ApprovalRuleStep(
                rule_id=rule.id,
                step_number=step_data.step_number,
                approver_user_id=step_data.approver_user_id,
                approver_role_label=step_data.approver_role_label,
                is_manager_of_employee=step_data.is_manager_of_employee,
                is_key_approver=step_data.is_key_approver,
            )
            db.add(step)

    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(ApprovalRule).where(
            ApprovalRule.id == rule_id,
            ApprovalRule.company_id == current_user.company_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.delete(rule)
    await db.commit()


# ── Pending approvals for current approver ───────────────────────────────────

@router.get("/pending", response_model=list[ExpenseApprovalOut])
async def my_pending_approvals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin),
):
    result = await db.execute(
        select(ExpenseApproval)
        .join(Expense, ExpenseApproval.expense_id == Expense.id)
        .where(
            ExpenseApproval.approver_id == current_user.id,
            ExpenseApproval.status == "pending",
            Expense.status == "in_review",
        )
    )
    approvals = result.scalars().all()
    out = []
    for a in approvals:
        item = ExpenseApprovalOut.model_validate(a)
        item.approver_name = current_user.full_name
        item.approver_role_label = _resolve_step_label(a)
        out.append(item)
    return out


# ── Act on an approval ───────────────────────────────────────────────────────

@router.post("/{approval_id}/action", response_model=ExpenseApprovalOut)
async def take_action(
    approval_id: UUID,
    body: ApprovalActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin),
):
    if body.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    result = await db.execute(
        select(ExpenseApproval).where(
            ExpenseApproval.id == approval_id,
            ExpenseApproval.approver_id == current_user.id,
            ExpenseApproval.status == "pending",
        )
    )
    approval = result.scalar_one_or_none()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found or not assigned to you")

    expense_result = await db.execute(select(Expense).where(Expense.id == approval.expense_id))
    expense = expense_result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    await process_approval_action(db, expense, current_user, body.action, body.comments)
    await db.commit()
    await db.refresh(approval)

    item = ExpenseApprovalOut.model_validate(approval)
    item.approver_name = current_user.full_name
    item.approver_role_label = _resolve_step_label(approval)
    return item


# ── Approval history for an expense ─────────────────────────────────────────

@router.get("/expense/{expense_id}", response_model=list[ExpenseApprovalOut])
async def expense_approval_history(
    expense_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ExpenseApproval)
        .where(ExpenseApproval.expense_id == expense_id)
        .order_by(ExpenseApproval.step_number)
    )
    approvals = result.scalars().all()
    out = []
    for a in approvals:
        item = ExpenseApprovalOut.model_validate(a)
        if a.approver:
            item.approver_name = a.approver.full_name
        item.approver_role_label = _resolve_step_label(a)
        out.append(item)
    return out
