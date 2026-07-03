import asyncio
from uuid import uuid4
from sqlalchemy import select
from database import AsyncSessionLocal, DbUserAuth, DbOrganization, DbOrganizationMember

async def backfill():
    async with AsyncSessionLocal() as db:
        # Get all users who don't have a current organization
        stmt = select(DbUserAuth).where(DbUserAuth.current_organization_id.is_(None))
        result = await db.execute(stmt)
        users = result.scalars().all()
        
        if not users:
            print("No users to backfill.")
            return

        print(f"Found {len(users)} users to backfill.")
        
        for user in users:
            org_name = f"{user.name or user.email} Workspace"
            org_id = uuid4()
            
            # Create organization
            org = DbOrganization(
                id=org_id,
                name=org_name,
                organization_type="personal"
            )
            db.add(org)
            
            # Create member
            member = DbOrganizationMember(
                user_id=user.id,
                organization_id=org_id,
                role="owner"
            )
            db.add(member)
            
            # Update user
            user.current_organization_id = org_id
            
        await db.commit()
        print("Backfill completed successfully.")

if __name__ == "__main__":
    asyncio.run(backfill())
