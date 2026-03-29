"""
Core approval workflow engine.

Flow:
  1. When an expense is submitted, find the matching ApprovalRule for the company.
  2. Create ExpenseApproval rows for each step.
     - Sequential / Hybrid: first valid step → "pending", rest → "waiting".
     - Percentage / Specific-approver: all steps → "pending" (concurrent).
  3. When an approver acts:
     - Sequential: approve → activate next waiting step; reject → reject expense.
     - Percentage: count approvals; if threshold met → approve.
       If threshold becomes unreachable → reject.
     - Specific approver (key): key approve → auto-approve; key reject → auto-reject.
     - Hybrid (sequential routing + conditional decision):
       key approve or percentage met → approve.  Advance sequentially otherwise.
  4. If a step has is_manager_of_employee, the resolved manager must have
     is_manager_approver=True to be included.
"""
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.approval import ApprovalRule, ApprovalRuleStep, ExpenseApproval
from app.models.user import User, EmployeeManagerRelationship


async def _find_rule(db: AsyncSession, company_id: UUID, amount: float) -> ApprovalRule | None:
    result = await db.execute(
        select(ApprovalRule)
        .where(
            ApprovalRule.company_id == company_id,
            ApprovalRule.is_active == True,
            (ApprovalRule.min_amount == None) | (ApprovalRule.min_amount <= amount),
            (ApprovalRule.max_amount == None) | (ApprovalRule.max_amount >= amount),
        )
        .order_by(ApprovalRule.min_amount.desc().nullslast())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _get_manager(db: AsyncSession, employee_id: UUID) -> User | None:
    result = await db.execute(
        select(User)
        .join(EmployeeManagerRelationship, EmployeeManagerRelationship.manager_id == User.id)
        .where(EmployeeManagerRelationship.employee_id == employee_id)
        .limit(1)
    )
    return result.scalar_one_or_none()


def _cancel_remaining(all_approvals: list[ExpenseApproval]) -> None:
    """Mark all pending/waiting approvals as cancelled."""
    for a in all_approvals:
        if a.status in ("pending", "waiting"):
            a.status = "cancelled"


async def initiate_approval(db: AsyncSession, expense: Expense) -> None:
    """Create approval records after expense submission."""
    rule = await _find_rule(
        db, expense.company_id,
        float(expense.amount_in_company_currency or expense.amount),
    )
    if not rule:
        raise ValueError("No active approval rule matches this expense amount.")

    is_sequential = rule.rule_type in ("sequential", "hybrid")
    first_valid_step_created = False
    first_pending_step_number: int | None = None

    for step in rule.steps:
        approver_id: UUID | None = None

        if step.is_manager_of_employee:
            manager = await _get_manager(db, expense.employee_id)
            if manager and manager.is_manager_approver:
                approver_id = manager.id
        elif step.approver_user_id:
            approver_id = step.approver_user_id

        if not approver_id:
            if step.is_manager_of_employee:
                raise ValueError(
                    f"Could not resolve the manager approver for step {step.step_number}. "
                    "Make sure the employee has a manager assigned and that the manager has "
                    "'is_manager_approver' enabled."
                )
            raise ValueError(
                f"Could not resolve the approver for step {step.step_number}. "
                "Please check the configured approval stages."
            )

        if is_sequential:
            status = "pending" if not first_valid_step_created else "waiting"
        else:
            status = "pending"

        if status == "pending" and first_pending_step_number is None:
            first_pending_step_number = step.step_number

        ea = ExpenseApproval(
            expense_id=expense.id,
            rule_id=rule.id,
            step_number=step.step_number,
            approver_id=approver_id,
            status=status,
        )
        db.add(ea)
        first_valid_step_created = True

    if not first_valid_step_created:
        raise ValueError("No approvers could be resolved for the configured approval rule.")

    expense.status = "in_review"
    expense.current_approval_step = first_pending_step_number or 1


async def process_approval_action(
    db: AsyncSession,
    expense: Expense,
    approver: User,
    action: str,
    comments: str | None,
) -> None:
    """Handle an approve/reject action and advance the workflow."""

    result = await db.execute(
        select(ExpenseApproval)
        .where(
            ExpenseApproval.expense_id == expense.id,
            ExpenseApproval.approver_id == approver.id,
            ExpenseApproval.status == "pending",
        )
    )
    approval = result.scalar_one_or_none()
    if not approval:
        raise ValueError("No pending approval found for this approver")

    now = datetime.now(timezone.utc)
    approval.status = action + "d"   # "approved" | "rejected"
    approval.comments = comments
    approval.action_at = now

    result_all = await db.execute(
        select(ExpenseApproval)
        .where(ExpenseApproval.expense_id == expense.id)
    )
    all_approvals: list[ExpenseApproval] = list(result_all.scalars().all())

    rule_result = await db.execute(
        select(ApprovalRule).where(ApprovalRule.id == approval.rule_id)
    )
    rule = rule_result.scalar_one_or_none()
    if not rule:
        expense.status = "approved"
        return

    rule_type = rule.rule_type

    if rule_type == "sequential":
        await _handle_sequential(expense, approval, all_approvals, action)

    elif rule_type == "percentage":
        await _handle_percentage(expense, all_approvals, rule, action)

    elif rule_type == "specific_approver":
        await _handle_specific_approver(db, expense, approval, all_approvals, rule, action)

    elif rule_type == "hybrid":
        await _handle_hybrid(db, expense, approval, all_approvals, rule, action)


async def _handle_sequential(
    expense: Expense,
    approval: ExpenseApproval,
    all_approvals: list[ExpenseApproval],
    action: str,
) -> None:
    if action == "reject":
        expense.status = "rejected"
        _cancel_remaining(all_approvals)
        return

    waiting_steps = sorted(
        [a for a in all_approvals if a.status == "waiting"],
        key=lambda a: a.step_number,
    )
    if waiting_steps:
        next_step = waiting_steps[0]
        next_step.status = "pending"
        expense.current_approval_step = next_step.step_number
    else:
        expense.status = "approved"


async def _handle_percentage(
    expense: Expense,
    all_approvals: list[ExpenseApproval],
    rule: ApprovalRule,
    action: str,
) -> None:
    threshold = (rule.percentage_threshold or 100) / 100
    total_count = len(all_approvals)
    approved_count = sum(1 for a in all_approvals if a.status == "approved")

    if total_count > 0 and approved_count / total_count >= threshold:
        expense.status = "approved"
        _cancel_remaining(all_approvals)
        return

    if action == "reject":
        rejected_count = sum(1 for a in all_approvals if a.status == "rejected")
        max_possible_approvals = total_count - rejected_count
        if total_count > 0 and max_possible_approvals / total_count < threshold:
            expense.status = "rejected"
            _cancel_remaining(all_approvals)
            return

    pending_left = [a for a in all_approvals if a.status == "pending"]
    if not pending_left:
        expense.status = "approved" if approved_count / total_count >= threshold else "rejected"


async def _handle_specific_approver(
    db: AsyncSession,
    expense: Expense,
    approval: ExpenseApproval,
    all_approvals: list[ExpenseApproval],
    rule: ApprovalRule,
    action: str,
) -> None:
    step_result = await db.execute(
        select(ApprovalRuleStep).where(
            ApprovalRuleStep.rule_id == rule.id,
            ApprovalRuleStep.step_number == approval.step_number,
        )
    )
    step = step_result.scalar_one_or_none()
    is_key = step and step.is_key_approver

    if action == "approve" and is_key:
        expense.status = "approved"
        _cancel_remaining(all_approvals)
        return

    if action == "reject" and is_key:
        expense.status = "rejected"
        _cancel_remaining(all_approvals)
        return

    pending_left = [a for a in all_approvals if a.status == "pending"]
    if not pending_left:
        key_step_numbers = {step.step_number for step in rule.steps if step.is_key_approver}
        key_approved = any(
            approval_row.status == "approved" and approval_row.step_number in key_step_numbers
            for approval_row in all_approvals
        )
        expense.status = "approved" if key_approved else "rejected"


async def _handle_hybrid(
    db: AsyncSession,
    expense: Expense,
    approval: ExpenseApproval,
    all_approvals: list[ExpenseApproval],
    rule: ApprovalRule,
    action: str,
) -> None:
    """Sequential routing with conditional approval (percentage / key approver)."""
    step_result = await db.execute(
        select(ApprovalRuleStep).where(
            ApprovalRuleStep.rule_id == rule.id,
            ApprovalRuleStep.step_number == approval.step_number,
        )
    )
    step = step_result.scalar_one_or_none()
    is_key = step and step.is_key_approver
    threshold = (rule.percentage_threshold or 100) / 100
    total_count = len(all_approvals)
    approved_count = sum(1 for a in all_approvals if a.status == "approved")

    if action == "approve" and is_key:
        expense.status = "approved"
        _cancel_remaining(all_approvals)
        return

    if action == "reject" and is_key:
        expense.status = "rejected"
        _cancel_remaining(all_approvals)
        return

    if total_count > 0 and approved_count / total_count >= threshold:
        expense.status = "approved"
        _cancel_remaining(all_approvals)
        return

    if action == "reject":
        rejected_count = sum(1 for a in all_approvals if a.status == "rejected")
        max_possible = total_count - rejected_count
        if total_count > 0 and max_possible / total_count < threshold:
            has_key_waiting = False
            for a in all_approvals:
                if a.status == "waiting":
                    sr = await db.execute(
                        select(ApprovalRuleStep).where(
                            ApprovalRuleStep.rule_id == rule.id,
                            ApprovalRuleStep.step_number == a.step_number,
                        )
                    )
                    s = sr.scalar_one_or_none()
                    if s and s.is_key_approver:
                        has_key_waiting = True
                        break
            if not has_key_waiting:
                expense.status = "rejected"
                _cancel_remaining(all_approvals)
                return

    waiting_steps = sorted(
        [a for a in all_approvals if a.status == "waiting"],
        key=lambda a: a.step_number,
    )
    if waiting_steps:
        next_step = waiting_steps[0]
        next_step.status = "pending"
        expense.current_approval_step = next_step.step_number
    else:
        pending_left = [a for a in all_approvals if a.status == "pending"]
        if not pending_left:
            expense.status = "approved" if approved_count / total_count >= threshold else "rejected"
