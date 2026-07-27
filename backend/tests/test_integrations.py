import os
import sys
import uuid
import json

from fastapi.testclient import TestClient

# Add current directory to path to ensure modules can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from database import AsyncSessionLocal, DbIntegrationExecution, DbWorkspaceIntegration
from sqlalchemy.future import select

import asyncio

TEST_USER_EMAIL = f"integration_test_{uuid.uuid4().hex[:6]}@example.com"
TEST_USER_PASSWORD = "password123"
TEST_WORKSPACE_ID = f"integration_workspace_{uuid.uuid4().hex[:6]}"
TEST_TEMPLATE_ID = f"integration_template_{uuid.uuid4().hex[:6]}"

def run_tests():
    print("Starting Integrations Tests...")
    
    with TestClient(app) as client:
        # 1. Login/Signup
        print("\n1. Testing Login Flow...")
        client.post("/api/auth/manual/signup", json={
            "name": "Integration Test User",
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        res_login = client.post("/api/auth/manual/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        if res_login.status_code != 200:
            print(f"❌ Login failed: {res_login.status_code} - {res_login.text}")
            return False
            
        token = res_login.json().get("access_token")
        client.headers.update({"Authorization": f"Bearer {token}"})
        print("✅ Login successful")
        
        # 1.5 Create Template
        print("\n1.5 Testing Template Creation...")
        template_payload = {
            "id": TEST_TEMPLATE_ID,
            "name": "Integration Test Template",
            "category": "Custom",
            "source": "custom",
            "language": "en-IN",
            "fields": [
                {"name": "Customer Name", "type": "text", "required": True},
            ]
        }
        res_tpl = client.post("/api/templates/custom", json=template_payload)
        if res_tpl.status_code != 200:
            print(f"❌ Template creation failed: {res_tpl.status_code} - {res_tpl.text}")
            return False
        print("✅ Template creation successful")
        
        # 2. Create Workspace
        print("\n2. Testing Workspace Creation...")
        workspace_payload = {
            "name": "Integration Test Workspace",
            "template_id": TEST_TEMPLATE_ID,
            "language": "en-IN",
            "sheet_sync_mode": "new",
            "extraction_rules": "Standard"
        }
        res_ws = client.post("/api/workspaces", json=workspace_payload)
        if res_ws.status_code != 200:
            print(f"❌ Workspace creation failed: {res_ws.status_code} - {res_ws.text}")
            return False
        
        # The workspace creation returns ID as 'id'
        workspace_id = res_ws.json().get("workspace", {}).get("id") or res_ws.json().get("id")
        # In current Voice2Form, workspace ID might be fetched differently, let's fetch list of workspaces if it's missing
        if not workspace_id:
            ws_list = client.get("/api/workspaces")
            workspace_id = ws_list.json().get("workspaces")[0].get("id")
            
        print(f"✅ Workspace creation successful (ID: {workspace_id})")
        
        # 3. Add Integration
        print("\n3. Testing Add Integration...")
        add_payload = {
            "provider": "google_sheets",
            "config": {"target_sheet_url": "https://example.com/sheet"},
            "credentials": {"access_token": "test_token"}
        }
        res_add = client.post(f"/api/workspaces/{workspace_id}/integrations", json=add_payload)
        if res_add.status_code != 200:
            print(f"❌ Add Integration failed: {res_add.status_code} - {res_add.text}")
            return False
            
        integration_id = res_add.json().get("id")
        print(f"✅ Add Integration successful (ID: {integration_id})")
        
        # 4. List Integrations
        print("\n4. Testing List Integrations...")
        res_list = client.get(f"/api/workspaces/{workspace_id}/integrations")
        if res_list.status_code != 200 or len(res_list.json()) != 1:
            print(f"❌ List Integrations failed: {res_list.status_code} - {res_list.text}")
            return False
        print("✅ List Integrations successful")
        
        # 5. Form Submission (Trigger Event)
        print("\n5. Testing Form Submission (Event Dispatch)...")
        # For simplicity, we just trigger /api/submit without audio
        submit_payload = {
            "template_id": None,
            "workspace_id": workspace_id,
            "fields": {
                "Name": "Integration Tester"
            },
            "template": {
                "id": "dummy",
                "name": "Dummy",
                "category": "Dummy",
                "fields": [{"name": "Name", "type": "text", "required": False}]
            }
        }
        res_submit = client.post("/api/submit", json=submit_payload)
        if res_submit.status_code != 200:
            print(f"❌ Form Submission failed: {res_submit.status_code} - {res_submit.text}")
            return False
            
        print("✅ Form Submission successful")
        
        # 6. Delete Integration
        print("\n6. Testing Delete Integration...")
        res_delete = client.delete(f"/api/workspaces/{workspace_id}/integrations/{integration_id}")
        if res_delete.status_code != 200:
            print(f"❌ Delete Integration failed: {res_delete.status_code} - {res_delete.text}")
            return False
        
        res_list_after = client.get(f"/api/workspaces/{workspace_id}/integrations")
        if len(res_list_after.json()) != 0:
            print("❌ Delete Integration failed: Integration still exists in list")
            return False
            
        print("✅ Delete Integration successful")

    print("\n🎉 All integration tests completed!")
    return True

if __name__ == "__main__":
    success = run_tests()
    if not success:
        sys.exit(1)
