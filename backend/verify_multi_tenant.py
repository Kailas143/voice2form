import asyncio
import uuid
import secrets
from sqlalchemy.future import select

from database import (
    engine, AsyncSessionLocal, DbUserAuth, DbOrganization, 
    DbOrganizationMember, DbWorkspace, init_db, OrganizationType
)
from main import get_workspace, list_workspaces, create_workspace, switch_organization, WorkspaceCreatePayload, OrganizationSwitchPayload

async def main():
    await init_db()
    
    async with AsyncSessionLocal() as db:
        # 1. Setup a Test User
        email = f"test_{secrets.token_hex(4)}@verify.com"
        user = DbUserAuth(
            email=email,
            password_hash="test",
            name="Verify User"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        # 2. Setup Org A and Org B
        org_a = DbOrganization(name="Org A Test", organization_type=OrganizationType.PERSONAL)
        org_b = DbOrganization(name="Org B Test", organization_type=OrganizationType.BUSINESS)
        db.add_all([org_a, org_b])
        await db.commit()
        await db.refresh(org_a)
        await db.refresh(org_b)

        # 3. Add user as member to both orgs
        member_a = DbOrganizationMember(user_id=user.id, organization_id=org_a.id)
        member_b = DbOrganizationMember(user_id=user.id, organization_id=org_b.id)
        db.add_all([member_a, member_b])
        
        # 4. Set current org to Org A
        user.current_organization_id = org_a.id
        await db.commit()
        
        print(f"--- Verification Started for {email} ---")
        print(f"Active Org: Org A ({org_a.id})")
        
        # 5. Create a Workspace in Org A
        payload = WorkspaceCreatePayload(
            name="Top Secret Org A Workspace",
            template_id="patient_intake"
        )
        created_res = await create_workspace(payload=payload, db=db, current_user=user)
        workspace_id = created_res["workspace"]["id"]
        print(f"Created Workspace ID: {workspace_id} in Org A")
        
        # Verify it lists in Org A
        workspaces_a_res = await list_workspaces(db=db, current_org=org_a.id)
        workspaces_a = workspaces_a_res["workspaces"]
        assert any(w["id"] == workspace_id for w in workspaces_a), "Failed: Workspace not found in Org A!"
        print("Success: Workspace is visible in Org A")
        
        # 6. Switch to Org B
        switch_payload = OrganizationSwitchPayload(organization_id=str(org_b.id))
        await switch_organization(payload=switch_payload, db=db, current_user=user)
        print(f"Switched Active Org to: Org B ({org_b.id})")
        
        # 7. Verify Isolation (Workspace A should NOT be visible)
        workspaces_b_res = await list_workspaces(db=db, current_org=org_b.id)
        workspaces_b = workspaces_b_res["workspaces"]
        
        if any(w["id"] == workspace_id for w in workspaces_b):
            print("❌ FAILURE: Data Leak! Org A Workspace is visible in Org B.")
        else:
            print("✅ SUCCESS: Multi-Tenant Isolation Verified. Org A Workspace is completely hidden in Org B.")
            
        print("--- Verification Complete ---")

if __name__ == "__main__":
    asyncio.run(main())
