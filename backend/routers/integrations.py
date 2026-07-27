from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid

from database import get_db, DbWorkspaceIntegration, DbUserAuth, DbWorkspace
from main import _get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/api/workspaces", tags=["integrations"])

class IntegrationCreatePayload(BaseModel):
    provider: str
    credentials: dict | None = None
    config: dict | None = None

class IntegrationUpdatePayload(BaseModel):
    credentials: dict | None = None
    config: dict | None = None
    is_active: bool | None = None

class SlackOAuthPayload(BaseModel):
    code: str
    redirect_uri: str

class IntegrationResponse(BaseModel):
    id: uuid.UUID
    workspace_id: str
    provider: str
    is_active: bool
    config: dict | None

async def _get_workspace_for_user(workspace_id: str, db: AsyncSession, current_user: DbUserAuth) -> DbWorkspace:
    result = await db.execute(select(DbWorkspace).where(DbWorkspace.id == workspace_id))
    workspace = result.scalars().first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    # For MVP, check if the workspace belongs to the user's current org
    if workspace.organization_id != current_user.current_organization_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this workspace")
    return workspace

@router.get("/{workspace_id}/integrations", response_model=List[IntegrationResponse])
async def list_integrations(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: DbUserAuth = Depends(_get_current_user)
):
    await _get_workspace_for_user(workspace_id, db, current_user)
    
    result = await db.execute(select(DbWorkspaceIntegration).where(DbWorkspaceIntegration.workspace_id == workspace_id))
    integrations = result.scalars().all()
    
    return [
        IntegrationResponse(
            id=i.id,
            workspace_id=i.workspace_id,
            provider=i.provider,
            is_active=i.is_active,
            config=i.config
        ) for i in integrations
    ]

@router.post("/{workspace_id}/integrations", response_model=IntegrationResponse)
async def add_integration(
    workspace_id: str,
    payload: IntegrationCreatePayload,
    db: AsyncSession = Depends(get_db),
    current_user: DbUserAuth = Depends(_get_current_user)
):
    await _get_workspace_for_user(workspace_id, db, current_user)
    
    # Optional: Validate provider against registry
    from services.integrations.registry import INTEGRATION_REGISTRY
    if payload.provider not in INTEGRATION_REGISTRY:
        raise HTTPException(status_code=400, detail=f"Provider {payload.provider} not supported.")
        
    # Check for existing integration for the same provider
    existing = await db.execute(
        select(DbWorkspaceIntegration)
        .where(DbWorkspaceIntegration.workspace_id == workspace_id)
        .where(DbWorkspaceIntegration.provider == payload.provider)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail=f"Integration for {payload.provider} already exists in this workspace.")

    integration = DbWorkspaceIntegration(
        workspace_id=workspace_id,
        provider=payload.provider,
        credentials=payload.credentials,
        config=payload.config,
        is_active=True
    )
    db.add(integration)
    await db.commit()
    await db.refresh(integration)
    
    return IntegrationResponse(
        id=integration.id,
        workspace_id=integration.workspace_id,
        provider=integration.provider,
        is_active=integration.is_active,
        config=integration.config
    )

@router.put("/{workspace_id}/integrations/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    workspace_id: str,
    integration_id: uuid.UUID,
    payload: IntegrationUpdatePayload,
    db: AsyncSession = Depends(get_db),
    current_user: DbUserAuth = Depends(_get_current_user)
):
    await _get_workspace_for_user(workspace_id, db, current_user)
    
    result = await db.execute(
        select(DbWorkspaceIntegration)
        .where(DbWorkspaceIntegration.id == integration_id)
        .where(DbWorkspaceIntegration.workspace_id == workspace_id)
    )
    integration = result.scalars().first()
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
        
    if payload.credentials is not None:
        integration.credentials = payload.credentials
    if payload.config is not None:
        integration.config = payload.config
    if payload.is_active is not None:
        integration.is_active = payload.is_active
        
    await db.commit()
    await db.refresh(integration)
    
    return IntegrationResponse(
        id=integration.id,
        workspace_id=integration.workspace_id,
        provider=integration.provider,
        is_active=integration.is_active,
        config=integration.config
    )

@router.delete("/{workspace_id}/integrations/{integration_id}")
async def remove_integration(
    workspace_id: str,
    integration_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: DbUserAuth = Depends(_get_current_user)
):
    await _get_workspace_for_user(workspace_id, db, current_user)
    
    result = await db.execute(
        select(DbWorkspaceIntegration)
        .where(DbWorkspaceIntegration.id == integration_id)
        .where(DbWorkspaceIntegration.workspace_id == workspace_id)
    )
    integration = result.scalars().first()
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
        
    await db.delete(integration)
    await db.commit()
    
    return {"status": "ok"}

@router.post("/{workspace_id}/integrations/slack/oauth", response_model=IntegrationResponse)
async def connect_slack_oauth(
    workspace_id: str,
    payload: SlackOAuthPayload,
    db: AsyncSession = Depends(get_db),
    current_user: DbUserAuth = Depends(_get_current_user)
):
    await _get_workspace_for_user(workspace_id, db, current_user)
    
    import requests
    from config import SLACK_CLIENT_ID, SLACK_CLIENT_SECRET
    
    # Exchange code for access token and webhook URL
    response = requests.post("https://slack.com/api/oauth.v2.access", data={
        "client_id": SLACK_CLIENT_ID,
        "client_secret": SLACK_CLIENT_SECRET,
        "code": payload.code,
        "redirect_uri": payload.redirect_uri
    })
    
    if not response.ok:
        raise HTTPException(status_code=400, detail="Failed to connect to Slack")
        
    data = response.json()
    if not data.get("ok"):
        raise HTTPException(status_code=400, detail=f"Slack OAuth error: {data.get('error', 'unknown')}")
        
    incoming_webhook = data.get("incoming_webhook")
    if not incoming_webhook or "url" not in incoming_webhook:
        raise HTTPException(status_code=400, detail="No incoming webhook provided by Slack. Ensure the 'incoming-webhook' scope was requested.")
        
    webhook_url = incoming_webhook["url"]
    
    # Check if Slack integration already exists
    existing = await db.execute(
        select(DbWorkspaceIntegration)
        .where(DbWorkspaceIntegration.workspace_id == workspace_id)
        .where(DbWorkspaceIntegration.provider == "slack")
    )
    integration = existing.scalars().first()
    
    if integration:
        integration.config = {"webhook_url": webhook_url}
        integration.is_active = True
    else:
        integration = DbWorkspaceIntegration(
            workspace_id=workspace_id,
            provider="slack",
            credentials={},
            config={"webhook_url": webhook_url},
            is_active=True
        )
        db.add(integration)
        
    await db.commit()
    await db.refresh(integration)
    
    return IntegrationResponse(
        id=integration.id,
        workspace_id=integration.workspace_id,
        provider=integration.provider,
        is_active=integration.is_active,
        config=integration.config
    )
