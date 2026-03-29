from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.company import Company
from app.models.user import User
from app.schemas.company import CompanyOut, CompanyUpdate
from app.core.dependencies import get_current_user, require_admin
from app.services.currency_service import get_countries_currencies

router = APIRouter(prefix="/company", tags=["Company"])


@router.get("/", response_model=CompanyOut)
async def get_company(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Company).where(Company.id == current_user.company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.patch("/", response_model=CompanyOut)
async def update_company(
    body: CompanyUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Company).where(Company.id == current_user.company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(company, k, v)
    await db.commit()
    await db.refresh(company)
    return company


@router.get("/countries")
async def list_countries():
    """Proxy for restcountries.com – used in signup dropdown."""
    return await get_countries_currencies()
