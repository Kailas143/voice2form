import os
import logging
import hashlib
import secrets
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import asyncio
import json
import websockets
import jwt
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Depends, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc, delete
from pydantic import BaseModel

from database import init_db, get_db, AsyncSessionLocal, DbCustomTemplate, DbTokenStore, DbUserAuth, DbRecentRecord, DbWorkspace, DbLlmLog
from fastapi.middleware.cors import CORSMiddleware

from config import (
    DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGES,
    JWT_SECRET_KEY,
    JWT_ALGORITHM,
    JWT_EXPIRE_MINUTES,
    PASSWORD_RESET_EXPIRE_MINUTES,
    DEEPGRAM_API_KEY,
)
from models import (
    ExtractionResult,
    SubmitPayload,
    Template,
    ManualSignupPayload,
    ManualLoginPayload,
    GoogleLoginPayload,
    AuthUser,
    AuthResponse,
    ForgotPasswordPayload,
    ResetPasswordPayload,
    WorkspaceCreatePayload,
    WorkspaceUpdatePayload,
)
from services import gemini, sarvam, sheets
from templates.registry import (
    get_template,
    list_templates,
    parse_uploaded_template,
    parse_uploaded_template_json,
)
from utils.audio import validate_audio_upload, validate_language

app = FastAPI(title="Voice2Form API")
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    force=True  # override any existing config
)
logger = logging.getLogger("voice2form")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _periodic_cleanup():
    while True:
        try:
            async with AsyncSessionLocal() as session:
                cutoff = datetime.now(timezone.utc) - timedelta(days=30)
                
                await session.execute(delete(DbRecentRecord).where(DbRecentRecord.created_at < cutoff))
                await session.execute(delete(DbLlmLog).where(DbLlmLog.created_at < cutoff))
                
                await session.commit()
                logger.info("Executed periodic cleanup of records older than 30 days.")
        except Exception as e:
            logger.error(f"Error during periodic cleanup: {e}")
            
        await asyncio.sleep(86400)


@app.on_event("startup")
async def on_startup():
    await init_db()
    asyncio.create_task(_periodic_cleanup())

class TokenRequest(BaseModel):
    token: str


bearer_scheme = HTTPBearer(auto_error=False)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _validate_basic_email(email: str) -> bool:
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email))


def _hash_password(password: str, salt: str) -> str:
    raw = f"{salt}:{password}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _build_user_payload(user: DbUserAuth) -> AuthUser:
    provider = "google" if user.google_linked and not user.password_hash else "manual"
    return AuthUser(
        provider=provider,
        name=user.name,
        email=user.email,
        avatar=user.google_avatar,
    )


def _create_access_token(user: DbUserAuth) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.email,
        "uid": user.id,
        "provider": user.primary_provider,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_EXPIRE_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


async def _get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> DbUserAuth:
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Authentication required.")

    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        email = _normalize_email(str(payload.get("sub", "")))
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token.") from exc

    result = await db.execute(select(DbUserAuth).where(DbUserAuth.email == email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user


def _auth_response(user: DbUserAuth) -> AuthResponse:
    return AuthResponse(
        status="ok",
        access_token=_create_access_token(user),
        token_type="bearer",
        user=_build_user_payload(user),
    )


def _serialize_workspace(workspace: DbWorkspace) -> dict:
    return {
        "id": workspace.id,
        "name": workspace.name,
        "template_id": workspace.template_id,
        "template_source": workspace.template_source,
        "template": workspace.template_data,
        "language": workspace.language,
        "sheet_sync_mode": workspace.sheet_sync_mode,
        "target_sheet_url": workspace.target_sheet_url,
        "extraction_rules": workspace.extraction_rules,
        "is_pinned": bool(workspace.is_pinned),
        "created_at": workspace.created_at.isoformat() if workspace.created_at else None,
        "updated_at": workspace.updated_at.isoformat() if workspace.updated_at else None,
        "last_opened_at": workspace.last_opened_at.isoformat() if workspace.last_opened_at else None,
    }


async def _log_llm_usage(db: AsyncSession, model_name: str, flow: str, usage_dict: dict | None, latency_ms: int | None):
    if latency_ms is None:
        return
    log_entry = DbLlmLog(
        model_name=model_name,
        flow=flow,
        token_usage=usage_dict or {},
        latency_ms=latency_ms,
    )
    db.add(log_entry)



def _deepgram_connect(url: str):
    return websockets.connect(
        url,
        additional_headers={"Authorization": f"Token {DEEPGRAM_API_KEY}"}
    )


def _deepgram_language_for(language: str) -> str:
    normalized = validate_language(language or DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES)
    mapping = {
        "en-IN": "en",
        "hi-IN": "hi",
        "ta-IN": "ta",
        "te-IN": "te",
        "ml-IN": "hi", # Deepgram does not support Malayalam, fallback to Hindi for live UI feedback
        "kn-IN": "hi", # Deepgram does not support Kannada, fallback to Hindi for live UI feedback
    }
    return mapping.get(normalized, "en")


def _pick_record_name(fields: dict[str, str]) -> str:
    preferred_keys = (
        "Customer Name",
        "Name",
        "Patient Name",
        "Candidate name",
        "Candidate Name",
        "Full Name",
    )
    for key in preferred_keys:
        value = str(fields.get(key, "")).strip()
        if value:
            return value

    for key, value in fields.items():
        if "name" in key.lower() and str(value).strip():
            return str(value).strip()

    return "Anonymous"


@app.post("/api/auth/manual/signup", response_model=AuthResponse)
async def manual_signup(payload: ManualSignupPayload, db: AsyncSession = Depends(get_db)):
    name = payload.name.strip()
    email = _normalize_email(payload.email)
    password = payload.password.strip()

    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    if not _validate_basic_email(email):
        raise HTTPException(status_code=400, detail="A valid email is required.")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    existing = await db.execute(select(DbUserAuth).where(DbUserAuth.email == email))
    existing_user = existing.scalars().first()
    salt = secrets.token_hex(16)
    hashed = _hash_password(password, salt)

    if existing_user:
        if existing_user.password_hash:
            raise HTTPException(status_code=409, detail="An account with this email already exists.")

        # Link a manual password to an existing Google account.
        existing_user.password_hash = hashed
        existing_user.password_salt = salt
        existing_user.name = name or existing_user.name
        if not existing_user.primary_provider:
            existing_user.primary_provider = "manual"
        await db.commit()
        await db.refresh(existing_user)
        return _auth_response(existing_user)

    user = DbUserAuth(
        primary_provider="manual",
        name=name,
        email=email,
        google_avatar=None,
        google_linked=False,
        password_hash=hashed,
        password_salt=salt,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _auth_response(user)


@app.post("/api/auth/manual/login", response_model=AuthResponse)
async def manual_login(payload: ManualLoginPayload, db: AsyncSession = Depends(get_db)):
    email = _normalize_email(payload.email)
    password = payload.password.strip()

    if not _validate_basic_email(email):
        raise HTTPException(status_code=400, detail="A valid email is required.")
    if not password:
        raise HTTPException(status_code=400, detail="Password is required.")

    existing = await db.execute(select(DbUserAuth).where(DbUserAuth.email == email))
    user = existing.scalars().first()
    if not user or not user.password_hash or not user.password_salt:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if _hash_password(password, user.password_salt) != user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return _auth_response(user)


@app.post("/api/auth/google/login", response_model=AuthResponse)
async def google_login(payload: GoogleLoginPayload, db: AsyncSession = Depends(get_db)):
    name = payload.name.strip()
    email = _normalize_email(payload.email)
    avatar = (payload.avatar or "").strip() or None

    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    if not _validate_basic_email(email):
        raise HTTPException(status_code=400, detail="A valid email is required.")

    existing = await db.execute(select(DbUserAuth).where(DbUserAuth.email == email))
    user = existing.scalars().first()
    if user:
        user.name = name
        user.google_avatar = avatar
        user.google_linked = True
        if not user.primary_provider:
            user.primary_provider = "google"
    else:
        user = DbUserAuth(
            primary_provider="google",
            name=name,
            email=email,
            google_avatar=avatar,
            google_linked=True,
            password_hash=None,
            password_salt=None,
        )
        db.add(user)

    await db.commit()
    await db.refresh(user)
    return _auth_response(user)


@app.get("/api/auth/me")
async def get_current_auth_user(current_user: DbUserAuth = Depends(_get_current_user)):
    return {"status": "ok", "user": _build_user_payload(current_user).model_dump()}


@app.post("/api/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordPayload, db: AsyncSession = Depends(get_db)):
    email = _normalize_email(payload.email)
    if not _validate_basic_email(email):
        raise HTTPException(status_code=400, detail="A valid email is required.")

    existing = await db.execute(select(DbUserAuth).where(DbUserAuth.email == email))
    user = existing.scalars().first()

    response = {
        "status": "ok",
        "message": "If this email exists, a reset token has been generated.",
    }

    if not user:
        return response

    reset_token = secrets.token_urlsafe(32)
    user.reset_token_hash = _hash_reset_token(reset_token)
    user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES)
    await db.commit()

    # MVP behavior: return token directly until email delivery is integrated.
    response["reset_token"] = reset_token
    return response


@app.post("/api/auth/reset-password")
async def reset_password(payload: ResetPasswordPayload, db: AsyncSession = Depends(get_db)):
    new_password = payload.new_password.strip()
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    token_hash = _hash_reset_token(payload.reset_token.strip())
    existing = await db.execute(select(DbUserAuth).where(DbUserAuth.reset_token_hash == token_hash))
    user = existing.scalars().first()
    if not user or not user.reset_token_expires_at:
        raise HTTPException(status_code=400, detail="Invalid reset token.")

    if user.reset_token_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired.")

    salt = secrets.token_hex(16)
    user.password_salt = salt
    user.password_hash = _hash_password(new_password, salt)
    user.reset_token_hash = None
    user.reset_token_expires_at = None
    if not user.primary_provider:
        user.primary_provider = "manual"

    await db.commit()
    return {"status": "ok", "message": "Password reset successful."}

@app.post("/api/auth/token")
async def save_token(req: TokenRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DbTokenStore).where(DbTokenStore.key == "google_token"))
    store = result.scalars().first()
    if store:
        store.token = req.token
    else:
        store = DbTokenStore(key="google_token", token=req.token)
        db.add(store)
    await db.commit()
    return {"status": "saved"}

@app.get("/api/auth/token")
async def get_token(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DbTokenStore).where(DbTokenStore.key == "google_token"))
    store = result.scalars().first()
    if store:
        return {"token": store.token}
    return {"token": None}

@app.post("/api/templates/custom")
async def save_custom_template(
    template: Template,
    db: AsyncSession = Depends(get_db),
    _: DbUserAuth = Depends(_get_current_user),
):
    fields_list = [f.model_dump() for f in template.fields]
    db_template = DbCustomTemplate(
        id=template.id,
        name=template.name,
        category="Saved",
        source="custom",
        fields_data=fields_list
    )
    db.add(db_template)
    await db.commit()
    return {"status": "saved"}


@app.get("/api/workspaces")
async def list_workspaces(
    db: AsyncSession = Depends(get_db),
    current_user: DbUserAuth = Depends(_get_current_user),
):
    result = await db.execute(
        select(DbWorkspace)
        .where(DbWorkspace.user_email == current_user.email)
        .order_by(
            desc(DbWorkspace.is_pinned),
            DbWorkspace.last_opened_at.desc().nullslast(),
            DbWorkspace.updated_at.desc(),
            DbWorkspace.created_at.desc(),
        )
    )
    items = result.scalars().all()
    return {"status": "ok", "workspaces": [_serialize_workspace(item) for item in items]}


@app.post("/api/workspaces")
async def create_workspace(
    payload: WorkspaceCreatePayload,
    db: AsyncSession = Depends(get_db),
    current_user: DbUserAuth = Depends(_get_current_user),
):
    if payload.template is None and not payload.template_id:
        raise HTTPException(status_code=400, detail="Template selection is required to create a workspace.")

    template_obj = payload.template or await _resolve_template(payload.template_id, None, db)
    now = datetime.now(timezone.utc)
    workspace = DbWorkspace(
        id=secrets.token_hex(12),
        user_email=current_user.email,
        name=(payload.name or f"{template_obj.name} Workspace").strip(),
        template_id=template_obj.id,
        template_source="custom" if template_obj.category in ("Saved", "Custom") else "builtin",
        template_data=template_obj.model_dump(),
        language=payload.language,
        sheet_sync_mode=payload.sheet_sync_mode,
        target_sheet_url=(payload.target_sheet_url or "").strip() or None,
        extraction_rules=payload.extraction_rules,
        is_pinned=False,
        last_opened_at=now,
    )
    db.add(workspace)
    await db.commit()
    await db.refresh(workspace)
    return {"status": "ok", "workspace": _serialize_workspace(workspace)}


@app.get("/api/workspaces/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: DbUserAuth = Depends(_get_current_user),
):
    result = await db.execute(
        select(DbWorkspace).where(
            DbWorkspace.id == workspace_id,
            DbWorkspace.user_email == current_user.email,
        )
    )
    workspace = result.scalars().first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    workspace.last_opened_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(workspace)
    return {"status": "ok", "workspace": _serialize_workspace(workspace)}


@app.patch("/api/workspaces/{workspace_id}")
async def update_workspace(
    workspace_id: str,
    payload: WorkspaceUpdatePayload,
    db: AsyncSession = Depends(get_db),
    current_user: DbUserAuth = Depends(_get_current_user),
):
    result = await db.execute(
        select(DbWorkspace).where(
            DbWorkspace.id == workspace_id,
            DbWorkspace.user_email == current_user.email,
        )
    )
    workspace = result.scalars().first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    if payload.name is not None:
        workspace.name = payload.name.strip() or workspace.name
    if payload.template is not None or payload.template_id is not None:
        template_obj = payload.template or await _resolve_template(payload.template_id, None, db)
        workspace.template_id = template_obj.id
        workspace.template_source = "custom" if template_obj.category in ("Saved", "Custom") else "builtin"
        workspace.template_data = template_obj.model_dump()
    if payload.language is not None:
        workspace.language = payload.language
    if payload.sheet_sync_mode is not None:
        workspace.sheet_sync_mode = payload.sheet_sync_mode
    if payload.target_sheet_url is not None:
        workspace.target_sheet_url = payload.target_sheet_url.strip() or None
    if payload.extraction_rules is not None:
        workspace.extraction_rules = payload.extraction_rules
    if payload.is_pinned is not None:
        workspace.is_pinned = payload.is_pinned

    workspace.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(workspace)
    return {"status": "ok", "workspace": _serialize_workspace(workspace)}


@app.delete("/api/workspaces/{workspace_id}")
async def delete_workspace(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: DbUserAuth = Depends(_get_current_user),
):
    result = await db.execute(
        select(DbWorkspace).where(
            DbWorkspace.id == workspace_id,
            DbWorkspace.user_email == current_user.email,
        )
    )
    workspace = result.scalars().first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    await db.delete(workspace)
    await db.commit()
    return {"status": "ok", "deleted_id": workspace_id}


@app.post("/api/workspaces/cleanup-duplicates")
async def cleanup_duplicate_workspaces(
    db: AsyncSession = Depends(get_db),
    current_user: DbUserAuth = Depends(_get_current_user),
):
    result = await db.execute(
        select(DbWorkspace).where(DbWorkspace.user_email == current_user.email)
    )
    items = result.scalars().all()

    grouped: dict[tuple[str, str, str], list[DbWorkspace]] = defaultdict(list)
    for workspace in items:
        normalized_name = (workspace.name or "").strip().lower()
        template_key = (workspace.template_id or "").strip().lower()
        source_key = (workspace.template_source or "builtin").strip().lower()
        grouped[(normalized_name, template_key, source_key)].append(workspace)

    deleted_ids: list[str] = []
    duplicate_groups = 0

    for group_items in grouped.values():
        if len(group_items) <= 1:
            continue

        duplicate_groups += 1
        ordered = sorted(
            group_items,
            key=lambda item: (
                item.last_opened_at or datetime.min.replace(tzinfo=timezone.utc),
                item.updated_at or datetime.min.replace(tzinfo=timezone.utc),
                item.created_at or datetime.min.replace(tzinfo=timezone.utc),
            ),
            reverse=True,
        )
        keeper = ordered[0]
        for stale in ordered[1:]:
            if stale.id == keeper.id:
                continue
            deleted_ids.append(stale.id)
            await db.delete(stale)

    if deleted_ids:
        await db.commit()

    return {
        "status": "ok",
        "duplicate_groups": duplicate_groups,
        "deleted_count": len(deleted_ids),
        "deleted_ids": deleted_ids,
    }

@app.delete("/api/templates/custom/{template_id}")
async def delete_custom_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    _: DbUserAuth = Depends(_get_current_user),
):
    result = await db.execute(select(DbCustomTemplate).where(DbCustomTemplate.id == template_id))
    db_template = result.scalars().first()
    if db_template:
        await db.delete(db_template)
        await db.commit()
    return {"status": "deleted"}


async def _resolve_template(template_id: str | None, raw_template: str | dict | None, db: AsyncSession) -> Template:
    print(f"[TEMPLATE] id={template_id}, has_data={raw_template is not None}")
    
    if raw_template:
        if isinstance(raw_template, dict):
            print(f"[TEMPLATE] Dict keys received: {list(raw_template.keys())}")
            try:
                return Template(
                    id=raw_template.get("id"),
                    name=raw_template.get("name", "Custom Template"),
                    category=raw_template.get("category", "Custom"),
                    source=raw_template.get("source", "custom"),
                    fields=raw_template.get("fields", [])
                )
            except Exception as e:
                print(f"[TEMPLATE] Template construction failed: {e}")
                raise HTTPException(status_code=400, detail="Invalid template")
        try:
            print("[TEMPLATE] Parsing inline template data (string)")
            return parse_uploaded_template_json(raw_template)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Could not read your template file. Check the format.") from exc

    if not template_id:
        raise HTTPException(status_code=400, detail="Template selection is required.")

    template = get_template(template_id)
    if template is not None:
        return template
        
    result = await db.execute(select(DbCustomTemplate).where(DbCustomTemplate.id == template_id))
    db_template = result.scalars().first()
    if db_template:
        return Template(id=db_template.id, name=db_template.name, category=db_template.category, source=db_template.source, fields=db_template.fields_data)

    print(f"[TEMPLATE] Failed to resolve template id={template_id}")
    raise HTTPException(status_code=404, detail="Template not found")


@app.get("/api/templates")
async def get_templates(db: AsyncSession = Depends(get_db)):
    builtins = list_templates()
    result = await db.execute(select(DbCustomTemplate))
    customs = result.scalars().all()
    
    if customs:
        saved = []
        for c in customs:
            t = Template(id=c.id, name=c.name, category=c.category, source=c.source, fields=c.fields_data)
            saved.append(t)
        builtins["Saved"] = saved
        
    return builtins


@app.get("/api/records")
async def get_recent_records(
    db: AsyncSession = Depends(get_db),
    current_user: DbUserAuth = Depends(_get_current_user),
):
    result = await db.execute(
        select(DbRecentRecord)
        .where(DbRecentRecord.user_email == current_user.email)
        .order_by(DbRecentRecord.created_at.desc())
        .limit(50)
    )
    records = result.scalars().all()
    return {
        "status": "ok",
        "records": [
            {
                "id": r.id,
                "template": r.template_name,
                "name": r.customer_name,
                "confidence": r.confidence,
                "status": r.status,
                "owner_email": r.owner_email or r.user_email,
                "owner_name": r.owner_name,
                "source": r.source or "recording",
                "date": r.created_at.isoformat() if r.created_at else None,
            }
            for r in records
        ]
    }


@app.post("/api/template/upload")
async def upload_template(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    content = await file.read()
    try:
        template, usage, latency = parse_uploaded_template(content, file.filename or "template")
        if latency is not None:
            await _log_llm_usage(db, "gemini-2.5-flash", "template_generation", usage, latency)
            await db.commit()
        return template
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/transcribe", response_model=ExtractionResult)
async def transcribe_and_extract(
    audio: UploadFile = File(...),
    template_id: str | None = Form(default=None),
    template: str | None = Form(default=None),
    language: str = Form(DEFAULT_LANGUAGE),
    db: AsyncSession = Depends(get_db),
):
    template_data = await _resolve_template(template_id, template, db)
    selected_language = validate_language(language, SUPPORTED_LANGUAGES)

    audio_bytes = await audio.read()
    content_type = audio.content_type
    filename = audio.filename

    # Convert WebM/OGG/M4A to WAV for broader compatibility, especially for Sarvam
    if any(fmt in (content_type or "").lower() for fmt in ["webm", "ogg", "m4a", "mp4"]):
        from utils.audio import convert_to_wav
        ext = os.path.splitext(filename)[1] if filename else ".webm"
        audio_bytes, content_type = convert_to_wav(audio_bytes, ext)
        filename = "recording.wav"

    try:
        validate_audio_upload(content_type, len(audio_bytes))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        if selected_language == "en-IN":
            try:
                logger.info("STT provider: Gemini | language=%s", selected_language)
                transcript, usage, latency = gemini.transcribe_audio(
                    audio_bytes=audio_bytes,
                    mime_type=content_type
                )
                await _log_llm_usage(db, "gemini-2.5-flash", "transcription", usage, latency)
            except ValueError as e:
                logger.warning("Gemini failed (%s). Falling back to Whisper.", e)
                from services import whisper_local
                logger.info("STT provider: Whisper (fallback from Gemini) | language=%s", selected_language)
                transcript = whisper_local.transcribe_audio(
                    audio_bytes=audio_bytes,
                    filename=filename or "recording.wav"
                )
        else:
            try:
                if sarvam.should_use_batch(audio_bytes=audio_bytes, content_type=content_type):
                    logger.info("STT provider: Sarvam Batch | language=%s", selected_language)
                    transcript, usage, latency = sarvam.transcribe_batch(
                        audio_bytes=audio_bytes,
                        filename=filename or "recording.wav",
                        language=selected_language,
                        content_type=content_type,
                    )
                    await _log_llm_usage(db, os.getenv("SARVAM_BATCH_MODEL", "saaras:v3"), "transcription_batch", usage, latency)
                else:
                    logger.info("STT provider: Sarvam Realtime | language=%s", selected_language)
                    transcript, usage, latency = sarvam.transcribe(
                        audio_bytes=audio_bytes,
                        filename=filename or "recording.wav",
                        language=selected_language,
                        content_type=content_type,
                    )
                    await _log_llm_usage(db, "saaras:v3", "transcription", usage, latency)
            except ValueError as e:
                if sarvam.is_duration_limit_error(str(e)):
                    try:
                        logger.info("Sarvam duration limit encountered. Retrying with Sarvam Batch (language=%s)", selected_language)
                        logger.info("STT provider: Sarvam Batch (fallback from Sarvam Realtime) | language=%s", selected_language)
                        transcript, usage, latency = sarvam.transcribe_batch(
                            audio_bytes=audio_bytes,
                            filename=filename or "recording.wav",
                            language=selected_language,
                            content_type=content_type,
                        )
                        await _log_llm_usage(db, os.getenv("SARVAM_BATCH_MODEL", "saaras:v3"), "transcription_batch", usage, latency)
                    except ValueError as batch_error:
                        logger.warning("Sarvam batch failed (%s). Falling back to Gemini.", batch_error)
                        try:
                            logger.info("STT provider: Gemini (fallback from Sarvam Batch) | language=%s", selected_language)
                            transcript, usage, latency = gemini.transcribe_audio(
                                audio_bytes=audio_bytes,
                                mime_type=content_type,
                                language=selected_language,
                            )
                            await _log_llm_usage(db, "gemini-2.5-flash", "transcription", usage, latency)
                        except ValueError as e2:
                            logger.warning("Gemini failed (%s). Falling back to Whisper.", e2)
                            from services import whisper_local
                            logger.info("STT provider: Whisper (fallback from Gemini) | language=%s", selected_language)
                            transcript = whisper_local.transcribe_audio(
                                audio_bytes=audio_bytes,
                                filename=filename or "recording.wav"
                            )
                else:
                    logger.warning("Sarvam failed (%s). Falling back to Gemini.", e)
                    try:
                        logger.info("STT provider: Gemini (fallback from Sarvam) | language=%s", selected_language)
                        transcript, usage, latency = gemini.transcribe_audio(
                            audio_bytes=audio_bytes,
                            mime_type=content_type,
                            language=selected_language,
                        )
                        await _log_llm_usage(db, "gemini-2.5-flash", "transcription", usage, latency)
                    except ValueError as e2:
                        logger.warning("Gemini failed (%s). Falling back to Whisper.", e2)
                        from services import whisper_local
                        logger.info("STT provider: Whisper (fallback from Gemini) | language=%s", selected_language)
                        transcript = whisper_local.transcribe_audio(
                            audio_bytes=audio_bytes,
                            filename=filename or "recording.wav"
                        )
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    finally:
        del audio_bytes

    result = gemini.extract(transcript, template_data.fields)
    await _log_llm_usage(db, "gemini-2.5-flash", "extraction", result.llm_usage, result.latency_ms)
    await db.commit()
    if not result.transcript:
        raise HTTPException(status_code=502, detail="No speech detected. Is audio clear? Try again.")
    if all(not field.value for field in result.fields.values()):
        result.transcript = transcript
    return result


@app.websocket("/api/stream/transcribe")
async def stream_transcribe(websocket: WebSocket, db: AsyncSession = Depends(get_db)):
    await websocket.accept()
    if not DEEPGRAM_API_KEY:
        await websocket.close(code=1011, reason="Deepgram API key not configured")
        return

    # Wait for the initial configuration message
    try:
        init_data = await websocket.receive_text()
        logger.info(f"DEBUG - Raw init_data from frontend: {init_data}")
        config = json.loads(init_data)
    except Exception as e:
        logger.error(f"Failed to receive init config: {e}")
        await websocket.close(code=1003, reason="Invalid initialization data")
        return

    template_id = config.get("template_id")
    template_data = config.get("template")
    
    try:
        template_obj = await _resolve_template(template_id, template_data, db)
    except Exception as e:
        logger.error(f"Failed to resolve template: {e}")
        await websocket.close(code=1003, reason="Invalid template")
        return

    current_form_data = config.get("current_form_data", {})
    user_modified_fields = set(config.get("user_modified_fields", []))
    sample_rate = config.get("sample_rate", 16000)
    selected_language = validate_language(config.get("language", DEFAULT_LANGUAGE), SUPPORTED_LANGUAGES)
    deepgram_language = _deepgram_language_for(selected_language)
    
    dg_url = (
        f"wss://api.deepgram.com/v1/listen"
        f"?model=nova-2"
        f"&language={deepgram_language}"
        f"&encoding=linear16"
        f"&sample_rate={sample_rate}"
        f"&channels=1"
        f"&interim_results=true"
        f"&punctuate=true"
        f"&endpointing=300"
        f"&utterance_end_ms=1000"
    )
    
    full_transcript = ""
    pending_transcript = ""
    last_gemini_call_time = asyncio.get_event_loop().time()
    
    try:
        print(f"[DEBUG] About to connect to Deepgram: {dg_url}", flush=True)
        async with _deepgram_connect(dg_url) as dg_socket:
            print("[DEBUG] Deepgram connected, starting tasks", flush=True)
            
            async def sender():
                chunk_count = 0
                try:
                    while True:
                        message = await websocket.receive()
                        if "bytes" in message:
                            chunk_count += 1
                            if chunk_count <= 5:
                                logger.info(f"[SENDER] Chunk #{chunk_count}, size: {len(message['bytes'])} bytes")
                            await dg_socket.send(message["bytes"])
                        elif "text" in message:
                            data = json.loads(message["text"])
                            
                            # Handle explicit stop signal
                            if data.get("type") == "stop":
                                await dg_socket.send(json.dumps({"type": "CloseStream"}))
                                break
                            
                            # Handle dynamic config updates (e.g. user overrides)
                            if data.get("type") == "user_override":
                                field_name = data.get("field")
                                new_value = data.get("value")
                                if field_name:
                                    user_modified_fields.add(field_name)
                                    current_form_data[field_name] = new_value
                except WebSocketDisconnect:
                    logger.info("Client disconnected")
                except RuntimeError as e:
                    if 'Cannot call "receive"' in str(e):
                        logger.info("Client disconnected (RuntimeError)")
                    else:
                        logger.error(f"Sender task RuntimeError: {e}")
                except Exception as e:
                    logger.error(f"Sender task error: {e}")
                finally:
                    # Close Deepgram socket to send Close frame
                    try:
                        await dg_socket.send(json.dumps({"type": "CloseStream"}))
                    except:
                        pass
            
            async def receiver():
                nonlocal full_transcript, pending_transcript, last_gemini_call_time, current_form_data
                try:
                    while True:
                        result = await dg_socket.recv()
                        logger.info(f"[DEEPGRAM RAW] {result[:200]}")
                        res = json.loads(result)
                        
                        if res.get("type") == "Results":
                            is_final = res.get("is_final", False)
                            speech_final = res.get("speech_final", False)
                            
                            channel = res.get("channel", {})
                            alternatives = channel.get("alternatives", [])
                            if alternatives:
                                transcript = alternatives[0].get("transcript", "")
                                if transcript:
                                    # Send interim result to frontend for live display
                                    if not is_final:
                                        await websocket.send_json({
                                            "type": "interim_transcript",
                                            "transcript": f"{full_transcript} {transcript}".strip()
                                        })
                                    else:
                                        full_transcript = f"{full_transcript} {transcript}".strip()
                                        pending_transcript = f"{pending_transcript} {transcript}".strip()
                                        
                                        await websocket.send_json({
                                            "type": "final_transcript",
                                            "transcript": full_transcript
                                        })
                                        
                                        current_time = asyncio.get_event_loop().time()
                                        time_elapsed = current_time - last_gemini_call_time
                                        
                                        if speech_final or time_elapsed > 3.0 or len(pending_transcript) > 100:
                                            if pending_transcript:
                                                # Call Gemini
                                                try:
                                                    changes = gemini.extract_realtime(
                                                        transcript_chunk=pending_transcript,
                                                        fields=template_obj.fields,
                                                        current_data=current_form_data
                                                    )
                                                    
                                                    # Apply changes, respecting user overrides
                                                    applied_changes = {}
                                                    for k, v in changes.items():
                                                        if k not in user_modified_fields:
                                                            if current_form_data.get(k) != v:
                                                                current_form_data[k] = v
                                                                applied_changes[k] = v
                                                                
                                                    if applied_changes:
                                                        await websocket.send_json({
                                                            "type": "form_update",
                                                            "fields": applied_changes
                                                        })
                                                except Exception as e:
                                                    logger.error(f"Gemini extraction error: {e}")
                                                
                                                pending_transcript = ""
                                                last_gemini_call_time = asyncio.get_event_loop().time()
                        else:
                            logger.info(f"Deepgram non-Results message: {res}")
                            if res.get("type") == "Metadata":
                                duration = res.get("duration", 0.0)
                                if duration > 0:
                                    usage_dict = {"audio_duration_seconds": round(duration, 2)}
                                    await _log_llm_usage(db, "nova-2 (deepgram)", "transcription_realtime", usage_dict, 0)
                                    await db.commit()
                            
                except websockets.exceptions.ConnectionClosed:
                    logger.info("Deepgram connection closed")
                except Exception as e:
                    logger.error(f"Receiver task error: {e}")

            await asyncio.gather(sender(), receiver())
            
    except Exception as e:
        logger.error(f"Deepgram WebSocket connection failed: {e}")
        try:
            await websocket.close(code=1011, reason="Deepgram connection failed")
        except:
            pass


@app.post("/api/submit")
async def submit_form(
    payload: SubmitPayload,
    db: AsyncSession = Depends(get_db),
    current_user: DbUserAuth = Depends(_get_current_user),
):
    template_data = payload.template or await _resolve_template(payload.template_id, None, db)
    sheet_category = template_data.category if payload.template is None else "Custom"

    missing_required = [
        field.name
        for field in template_data.fields
        if field.required and not str(payload.fields.get(field.name, "")).strip()
    ]
    if missing_required:
        raise HTTPException(status_code=400, detail="Please complete all required fields before submitting.")

    normalized_fields = {
        field.name: str(payload.fields.get(field.name, "")).strip()
        for field in template_data.fields
    }

    try:
        sheet_url = sheets.append_record(
            form_name=template_data.name,
            category=sheet_category,
            fields=normalized_fields,
            access_token=payload.access_token,
            target_sheet_url=payload.target_sheet_url,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if not sheet_url:
        raise HTTPException(status_code=500, detail="Failed to write record to spreadsheet.")

    customer_name = _pick_record_name(normalized_fields)
    
    # We don't have exact confidences here in submit_form unless we change the payload
    # MVP: we can assume 100 or use a placeholder, or maybe pass it. For now, 100.
    
    recent_record = DbRecentRecord(
        id=secrets.token_hex(8),
        user_email=current_user.email,
        owner_email=current_user.email,
        owner_name=current_user.name,
        source=payload.submission_source,
        template_name=template_data.name,
        customer_name=customer_name,
        confidence=100,
        status="Processed"
    )
    db.add(recent_record)
    await db.commit()

    return {
        "status": "submitted",
        "sheet_tab": sheet_category,
        "sheet_url": sheet_url,
        "audio_retained": False,
    }
