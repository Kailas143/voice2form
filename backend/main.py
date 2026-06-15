from fastapi import FastAPI, File, Form, HTTPException, UploadFile
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


def _resolve_template(template_id: str | None, raw_template: str | None) -> Template:
    if raw_template:
        try:
            return parse_uploaded_template_json(raw_template)
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Could not read your template file. Check the format.") from exc

    if not template_id:
        raise HTTPException(status_code=400, detail="Template selection is required.")

    template = get_template(template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@app.get("/api/templates")
def get_templates():
    return list_templates()


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
):
    template_data = _resolve_template(template_id, template)
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
def submit_form(payload: SubmitPayload):
    template_data = payload.template or _resolve_template(payload.template_id, None)
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
