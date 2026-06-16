from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel

from database import init_db, get_db, DbCustomTemplate, DbTokenStore
from fastapi.middleware.cors import CORSMiddleware

from config import DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES
from models import ExtractionResult, SubmitPayload, Template
from services import gemini, sarvam, sheets
from templates.registry import (
    get_template,
    list_templates,
    parse_uploaded_template,
    parse_uploaded_template_json,
)
from utils.audio import validate_audio_upload, validate_language

app = FastAPI(title="Voice2Form API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await init_db()

class TokenRequest(BaseModel):
    token: str

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
    raise HTTPException(status_code=404, detail="Token not found")

@app.post("/api/templates/custom")
async def save_custom_template(template: Template, db: AsyncSession = Depends(get_db)):
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

@app.delete("/api/templates/custom/{template_id}")
async def delete_custom_template(template_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DbCustomTemplate).where(DbCustomTemplate.id == template_id))
    db_template = result.scalars().first()
    if db_template:
        await db.delete(db_template)
        await db.commit()
    return {"status": "deleted"}


async def _resolve_template(template_id: str | None, raw_template: str | None, db: AsyncSession) -> Template:
    if raw_template:
        try:
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


@app.post("/api/template/upload")
async def upload_template(file: UploadFile = File(...)):
    content = await file.read()
    try:
        return parse_uploaded_template(content, file.filename or "template")
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
        import os
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
                transcript = gemini.transcribe_audio(
                    audio_bytes=audio_bytes,
                    mime_type=content_type
                )
            except ValueError as e:
                print(f"Gemini failed ({e}), falling back to Whisper...")
                from services import whisper_local
                transcript = whisper_local.transcribe_audio(
                    audio_bytes=audio_bytes,
                    filename=filename or "recording.wav"
                )
        else:
            try:
                transcript = sarvam.transcribe(
                    audio_bytes=audio_bytes,
                    filename=filename or "recording.wav",
                    language=selected_language,
                    content_type=content_type,
                )
            except ValueError as e:
                print(f"Sarvam failed ({e}), falling back to Gemini...")
                try:
                    transcript = gemini.transcribe_audio(
                        audio_bytes=audio_bytes,
                        mime_type=content_type,
                        language=selected_language,
                    )
                except ValueError as e2:
                    print(f"Gemini failed ({e2}), falling back to Whisper...")
                    from services import whisper_local
                    transcript = whisper_local.transcribe_audio(
                        audio_bytes=audio_bytes,
                        filename=filename or "recording.wav"
                    )
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    finally:
        del audio_bytes

    result = gemini.extract(transcript, template_data.fields)
    if not result.transcript:
        raise HTTPException(status_code=502, detail="No speech detected. Is audio clear? Try again.")
    if all(not field.value for field in result.fields.values()):
        result.transcript = transcript
    return result


@app.post("/api/submit")
async def submit_form(payload: SubmitPayload, db: AsyncSession = Depends(get_db)):
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

    return {
        "status": "submitted",
        "sheet_tab": sheet_category,
        "sheet_url": sheet_url,
        "audio_retained": False,
    }
