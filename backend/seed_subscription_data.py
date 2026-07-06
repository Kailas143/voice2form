import asyncio
from uuid import uuid4
from sqlalchemy import select
from database import AsyncSessionLocal, DbPlan, DbFeature, DbPlanLimit, DbPlanFeature

async def seed():
    async with AsyncSessionLocal() as db:
        print("Seeding features...")
        feature_codes = [
            "LIVE_VOICE",
            "AUDIO_UPLOAD",
            "GOOGLE_SHEETS",
            "MULTILINGUAL",
            "API_ACCESS",
            "ANALYTICS",
            "TEAM_MEMBERS",
            "PRIORITY_SUPPORT"
        ]
        
        feature_objs = {}
        for code in feature_codes:
            stmt = select(DbFeature).where(DbFeature.code == code)
            result = await db.execute(stmt)
            feat = result.scalars().first()
            if not feat:
                feat = DbFeature(id=uuid4(), code=code, name=code.replace("_", " ").title())
                db.add(feat)
            feature_objs[code] = feat
        await db.commit()

        print("Seeding plans...")
        plans_data = [
            {"name": "Free", "slug": "free", "price": 0.0},
            {"name": "Professional", "slug": "professional", "price": 19.0},
            {"name": "Business", "slug": "business", "price": 49.0},
        ]
        
        plan_objs = {}
        for data in plans_data:
            stmt = select(DbPlan).where(DbPlan.slug == data["slug"])
            result = await db.execute(stmt)
            plan = result.scalars().first()
            if not plan:
                plan = DbPlan(id=uuid4(), name=data["name"], slug=data["slug"], price=data["price"])
                db.add(plan)
            plan_objs[data["name"]] = plan
        await db.commit()
        
        print("Seeding limits...")
        limits_data = {
            "Free": {"forms_limit": 3, "submissions": 100, "audio_minutes": 10},
            "Professional": {"forms_limit": -1, "submissions": 1000, "audio_minutes": 500},
            "Business": {"forms_limit": -1, "submissions": 10000, "audio_minutes": 5000},
        }
        
        for plan_name, limits in limits_data.items():
            plan = plan_objs[plan_name]
            for key, value in limits.items():
                stmt = select(DbPlanLimit).where(
                    DbPlanLimit.plan_id == plan.id,
                    DbPlanLimit.key == key
                )
                result = await db.execute(stmt)
                limit_obj = result.scalars().first()
                if not limit_obj:
                    limit_obj = DbPlanLimit(id=uuid4(), plan_id=plan.id, key=key, value=value)
                    db.add(limit_obj)
                else:
                    limit_obj.value = value
        await db.commit()
        
        print("Seeding plan features (defaults)...")
        plan_features = {
            "Free": ["LIVE_VOICE", "AUDIO_UPLOAD", "GOOGLE_SHEETS"],
            "Professional": ["LIVE_VOICE", "AUDIO_UPLOAD", "GOOGLE_SHEETS", "MULTILINGUAL"],
            "Business": feature_codes
        }
        
        for plan_name, features in plan_features.items():
            plan = plan_objs[plan_name]
            for code in features:
                feat = feature_objs[code]
                stmt = select(DbPlanFeature).where(
                    DbPlanFeature.plan_id == plan.id,
                    DbPlanFeature.feature_id == feat.id
                )
                result = await db.execute(stmt)
                if not result.scalars().first():
                    pf = DbPlanFeature(id=uuid4(), plan_id=plan.id, feature_id=feat.id)
                    db.add(pf)
        await db.commit()
        
        print("Seed completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed())
