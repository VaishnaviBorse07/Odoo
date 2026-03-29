from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db
from app.models.user import User, EmployeeManagerRelationship
from app.schemas.user import UserCreate, UserUpdate, UserOut, ManagerAssign
from app.core.security import hash_password
from app.core.dependencies import get_current_user, require_admin, require_manager_or_admin

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin),
):
    result = await db.execute(
        select(User).where(User.company_id == current_user.company_id).order_by(User.first_name)
    )
    return result.scalars().all()


@router.post("/", response_model=UserOut, status_code=201)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already in use")

    user = User(
        company_id=current_user.company_id,
        email=body.email,
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        role=body.role,
        is_manager_approver=body.is_manager_approver,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager_or_admin),
):
    result = await db.execute(
        select(User).where(User.id == user_id, User.company_id == current_user.company_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(User).where(User.id == user_id, User.company_id == current_user.company_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = body.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["password_hash"] = hash_password(update_data.pop("password"))
    for k, v in update_data.items():
        setattr(user, k, v)

    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(User).where(User.id == user_id, User.company_id == current_user.company_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()


# Manager assignment
@router.post("/{user_id}/managers", status_code=201)
async def assign_manager(
    user_id: UUID,
    body: ManagerAssign,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    existing = await db.execute(
        select(EmployeeManagerRelationship).where(
            EmployeeManagerRelationship.employee_id == user_id,
            EmployeeManagerRelationship.manager_id == body.manager_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Relationship already exists")

    rel = EmployeeManagerRelationship(employee_id=user_id, manager_id=body.manager_id)
    db.add(rel)
    await db.commit()
    return {"detail": "Manager assigned"}


@router.delete("/{user_id}/managers/{manager_id}", status_code=204)
async def remove_manager(
    user_id: UUID,
    manager_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    await db.execute(
        delete(EmployeeManagerRelationship).where(
            EmployeeManagerRelationship.employee_id == user_id,
            EmployeeManagerRelationship.manager_id == manager_id,
        )
    )
    await db.commit()


@router.get("/{user_id}/managers", response_model=list[UserOut])
async def get_managers(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(User)
        .join(EmployeeManagerRelationship, EmployeeManagerRelationship.manager_id == User.id)
        .where(EmployeeManagerRelationship.employee_id == user_id)
    )
    return result.scalars().all()
