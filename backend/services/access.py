from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from database import DbPlanFeature, DbFeature, DbPlanLimit

async def has_feature(db: AsyncSession, plan_id: UUID, feature_code: str) -> bool:
    """Check if a plan has a specific feature enabled."""
    if not plan_id:
        return False
        
    stmt = (
        select(DbPlanFeature)
        .join(DbFeature, DbPlanFeature.feature_id == DbFeature.id)
        .where(
            DbPlanFeature.plan_id == plan_id,
            DbFeature.code == feature_code
        )
    )
    result = await db.execute(stmt)
    return result.scalars().first() is not None

async def get_limit(db: AsyncSession, plan_id: UUID, key: str) -> int | None:
    """Get a specific limit value for a plan. Returns None if no limit exists."""
    if not plan_id:
        return None
        
    stmt = select(DbPlanLimit).where(
        DbPlanLimit.plan_id == plan_id,
        DbPlanLimit.key == key
    )
    result = await db.execute(stmt)
    limit = result.scalars().first()
    return limit.value if limit else None
