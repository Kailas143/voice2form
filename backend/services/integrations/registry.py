import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .google_sheets import GoogleSheetsIntegration
from .slack import SlackIntegration

logger = logging.getLogger(__name__)

INTEGRATION_REGISTRY = {
    "google_sheets": GoogleSheetsIntegration,
    # "webhook": WebhookIntegration,
    "slack": SlackIntegration,
}

def get_integration_handler(provider: str):
    handler_class = INTEGRATION_REGISTRY.get(provider)
    if not handler_class:
        raise ValueError(f"Integration provider '{provider}' is not supported.")
    return handler_class()

async def dispatch_event_background(workspace_id: str, event_name: str, payload: dict):
    from database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        await dispatch_event(db, workspace_id, event_name, payload)

async def dispatch_event(db: AsyncSession, workspace_id: str, event_name: str, payload: dict):
    from database import DbWorkspaceIntegration, DbIntegrationExecution
    
    # Query all active integrations for the workspace
    result = await db.execute(
        select(DbWorkspaceIntegration)
        .where(DbWorkspaceIntegration.workspace_id == workspace_id)
        .where(DbWorkspaceIntegration.is_active == True)
    )
    active_integrations = result.scalars().all()
    
    if not active_integrations:
        logger.info(f"No active integrations found for workspace {workspace_id}")
        return

    for integration in active_integrations:
        try:
            handler = get_integration_handler(integration.provider)
        except ValueError as e:
            logger.error(f"Skipping unknown integration provider: {integration.provider}")
            continue
            
        execution_log = DbIntegrationExecution(
            workspace_id=workspace_id,
            integration_id=integration.id,
            event=event_name,
            status="PENDING"
        )
        db.add(execution_log)
        await db.commit()
        await db.refresh(execution_log)
        
        try:
            config = integration.config or {}
            credentials = integration.credentials or {}
            await handler.handle_event(event_name, payload, config, credentials)
            
            execution_log.status = "SUCCESS"
        except Exception as e:
            logger.error(f"Integration {integration.provider} failed for event {event_name}: {e}")
            execution_log.status = "FAILED"
            execution_log.error = str(e)
        finally:
            await db.commit()
