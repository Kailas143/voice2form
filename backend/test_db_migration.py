import asyncio
from uuid import uuid4
from database import init_db, AsyncSessionLocal, DbPlan, DbFeature, DbPlanFeature, DbOrganization
from services.access import has_feature
from services.usage import increment_audio_minutes

async def test_migration():
    print("Running init_db()...")
    await init_db()
    print("init_db() finished successfully.")

    print("Testing services...")
    async with AsyncSessionLocal() as db:
        # Create a dummy plan and feature
        plan_id = uuid4()
        feature_id = uuid4()
        org_id = uuid4()
        feature_code = f"TEST_FEATURE_{uuid4()}"

        plan = DbPlan(id=plan_id, name="Test Plan", slug=f"test-plan-{uuid4()}", price=0.0)
        feature = DbFeature(id=feature_id, code=feature_code, name="Test Feature")
        plan_feature = DbPlanFeature(plan_id=plan_id, feature_id=feature_id)
        org = DbOrganization(id=org_id, name="Test Org")
        
        db.add(plan)
        db.add(feature)
        db.add(plan_feature)
        db.add(org)
        await db.commit()
        
        # Test access.py
        has_feat = await has_feature(db, plan_id, feature_code)
        print(f"Has feature {feature_code}: {has_feat}")
        
        has_feat_false = await has_feature(db, plan_id, "OTHER_FEATURE")
        print(f"Has feature OTHER_FEATURE: {has_feat_false}")

        # Test usage.py
        await increment_audio_minutes(db, org_id, 10)
        await increment_audio_minutes(db, org_id, 5)
        print("Successfully incremented audio minutes")
        
        # Cleanup
        await db.execute(
            __import__('sqlalchemy').text("DELETE FROM usage_metrics WHERE organization_id = :org_id"),
            {"org_id": org_id}
        )
        await db.execute(
            __import__('sqlalchemy').text("DELETE FROM plan_features WHERE plan_id = :plan_id"),
            {"plan_id": plan_id}
        )
        await db.execute(
            __import__('sqlalchemy').text("DELETE FROM features WHERE id = :feature_id"),
            {"feature_id": feature_id}
        )
        await db.execute(
            __import__('sqlalchemy').text("DELETE FROM plans WHERE id = :plan_id"),
            {"plan_id": plan_id}
        )
        await db.execute(
            __import__('sqlalchemy').text("DELETE FROM organizations WHERE id = :org_id"),
            {"org_id": org_id}
        )
        await db.commit()

if __name__ == "__main__":
    asyncio.run(test_migration())
