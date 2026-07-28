import asyncio
from sqlalchemy.future import select
from database import AsyncSessionLocal, DbPlan, DbPlanLimit, engine, Base

async def seed_plans():
    async with engine.begin() as conn:
        # Ensure tables exist just in case migrations were not fully applied
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Check if Free plan exists
        result = await session.execute(select(DbPlan).where(DbPlan.slug == "free"))
        if result.scalars().first():
            print("Plans already seeded.")
            return

        free_plan = DbPlan(
            name="Free",
            slug="free",
            price=0.00,
            billing_type="monthly",
            description="Basic features for personal use."
        )
        
        pro_plan = DbPlan(
            name="Pro",
            slug="pro",
            price=19.99,
            billing_type="monthly",
            description="Advanced features for professionals."
        )

        session.add_all([free_plan, pro_plan])
        await session.commit()
        await session.refresh(free_plan)
        await session.refresh(pro_plan)
        
        # Free limits
        session.add_all([
            DbPlanLimit(plan_id=free_plan.id, key="audio_minutes", value=60),
            DbPlanLimit(plan_id=free_plan.id, key="submissions", value=100),
            DbPlanLimit(plan_id=free_plan.id, key="forms_limit", value=3)
        ])
        
        # Pro limits
        session.add_all([
            DbPlanLimit(plan_id=pro_plan.id, key="audio_minutes", value=1000),
            DbPlanLimit(plan_id=pro_plan.id, key="submissions", value=-1),
            DbPlanLimit(plan_id=pro_plan.id, key="forms_limit", value=-1)
        ])
        
        await session.commit()
        print("Successfully seeded plans and limits!")

if __name__ == "__main__":
    asyncio.run(seed_plans())
