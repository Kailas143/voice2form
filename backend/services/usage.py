from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
import datetime

from database import DbUsageMetric

async def get_or_create_usage_metric(db: AsyncSession, organization_id: UUID, month: int, year: int) -> DbUsageMetric:
    stmt = select(DbUsageMetric).where(
        DbUsageMetric.organization_id == organization_id,
        DbUsageMetric.month == month,
        DbUsageMetric.year == year
    )
    result = await db.execute(stmt)
    metric = result.scalars().first()
    
    if not metric:
        metric = DbUsageMetric(
            organization_id=organization_id,
            month=month,
            year=year,
            submissions_used=0,
            audio_minutes_used=0,
            ai_requests_used=0
        )
        db.add(metric)
        await db.commit()
        await db.refresh(metric)
        
    return metric

async def increment_audio_minutes(db: AsyncSession, organization_id: UUID, amount: int = 1):
    if not organization_id:
        return
    now = datetime.datetime.now()
    metric = await get_or_create_usage_metric(db, organization_id, now.month, now.year)
    metric.audio_minutes_used += amount
    await db.commit()

async def increment_submissions(db: AsyncSession, organization_id: UUID, amount: int = 1):
    if not organization_id:
        return
    now = datetime.datetime.now()
    metric = await get_or_create_usage_metric(db, organization_id, now.month, now.year)
    metric.submissions_used += amount
    await db.commit()

async def increment_ai_requests(db: AsyncSession, organization_id: UUID, amount: int = 1):
    if not organization_id:
        return
    now = datetime.datetime.now()
    metric = await get_or_create_usage_metric(db, organization_id, now.month, now.year)
    metric.ai_requests_used += amount
    await db.commit()
