import os
import uuid
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.expense import Expense, ExpenseCategory
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseUpdate, ExpenseOut, ExpenseListOut, ExpenseCategoryOut, ExpenseCategoryCreate
from app.core.dependencies import get_current_user, require_admin
from app.services.currency_service import convert_amount
from app.services.approval_service import initiate_approval
from app.services.ocr_service import process_receipt
from app.config import get_settings

router = APIRouter(prefix="/expenses", tags=["Expenses"])
settings = get_settings()


def _expense_to_out(expense: Expense) -> ExpenseOut:
    d = ExpenseOut.model_validate(expense)
    if expense.employee:
        d.employee_name = expense.employee.full_name
    if expense.category:
        d.category_name = expense.category.name
    return d


@router.get("/categories", response_model=list[ExpenseCategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ExpenseCategory).where(
            ExpenseCategory.company_id == current_user.company_id,
            ExpenseCategory.is_active == True,
        ).order_by(ExpenseCategory.name)
    )
    return result.scalars().all()


@router.post("/categories", response_model=ExpenseCategoryOut, status_code=201)
async def create_category(
    body: ExpenseCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    cat = ExpenseCategory(company_id=current_user.company_id, **body.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


@router.get("/", response_model=ExpenseListOut)
async def list_expenses(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Expense).where(Expense.company_id == current_user.company_id)

    if current_user.role == "employee":
        query = query.where(Expense.employee_id == current_user.id)

    if status:
        query = query.where(Expense.status == status)

    count_q = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar_one()

    query = query.order_by(Expense.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    expenses = result.scalars().all()

    return ExpenseListOut(
        items=[_expense_to_out(e) for e in expenses],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/", response_model=ExpenseOut, status_code=201)
async def create_expense(
    body: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Fetch company currency for conversion
    company = current_user.company
    converted, rate = await convert_amount(
        float(body.amount), body.currency_code, company.currency_code
    )

    expense = Expense(
        company_id=current_user.company_id,
        employee_id=current_user.id,
        title=body.title,
        description=body.description,
        expense_date=body.expense_date,
        amount=body.amount,
        currency_code=body.currency_code,
        amount_in_company_currency=converted,
        exchange_rate=rate,
        category_id=body.category_id,
    )
    db.add(expense)
    try:
        await db.flush()
        await initiate_approval(db, expense)
        await db.commit()
        await db.refresh(expense)
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return _expense_to_out(expense)


@router.get("/{expense_id}", response_model=ExpenseOut)
async def get_expense(
    expense_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_id,
            Expense.company_id == current_user.company_id,
        )
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    if current_user.role == "employee" and expense.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return _expense_to_out(expense)


@router.patch("/{expense_id}", response_model=ExpenseOut)
async def update_expense(
    expense_id: UUID,
    body: ExpenseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    if expense.employee_id != current_user.id and current_user.role not in ("admin",):
        raise HTTPException(status_code=403, detail="Access denied")
    if expense.status != "pending":
        raise HTTPException(status_code=400, detail="Cannot edit expense in current status")

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(expense, k, v)

    await db.commit()
    await db.refresh(expense)
    return _expense_to_out(expense)


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    if expense.employee_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    if expense.status not in ("pending", "rejected"):
        raise HTTPException(status_code=400, detail="Cannot delete expense in current status")
    await db.delete(expense)
    await db.commit()


@router.post("/{expense_id}/receipt", response_model=ExpenseOut)
async def upload_receipt(
    expense_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense or expense.employee_id != current_user.id:
        raise HTTPException(status_code=404, detail="Expense not found")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    expense.receipt_url = f"/uploads/{filename}"

    # Run OCR
    try:
        ocr_result = await process_receipt(
            content,
            filename=file.filename,
            content_type=file.content_type,
        )
        expense.ocr_raw_text = ocr_result["raw_text"]
        expense.ocr_data = ocr_result["parsed"]
    except Exception as exc:
        expense.ocr_raw_text = None
        expense.ocr_data = {
            "status": "failed",
            "error": str(exc),
            "warnings": ["OCR failed for this receipt. Please review the receipt manually."],
        }

    await db.commit()
    await db.refresh(expense)
    return _expense_to_out(expense)


# Admin override
@router.post("/{expense_id}/override")
async def admin_override(
    expense_id: UUID,
    action: str = Query(..., pattern="^(approve|reject)$"),
    notes: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    from app.models.approval import ExpenseApproval

    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    expense.status = "approved" if action == "approve" else "rejected"
    expense.admin_notes = notes

    approval_result = await db.execute(
        select(ExpenseApproval).where(ExpenseApproval.expense_id == expense_id)
    )
    for a in approval_result.scalars().all():
        if a.status in ("pending", "waiting"):
            a.status = "cancelled"

    await db.commit()
    return {"detail": f"Expense {expense.status}"}
