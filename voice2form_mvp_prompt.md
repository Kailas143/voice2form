# Voice2Form — Full MVP System Prompt
> Version 1.0 | Stack: FastAPI + React + Sarvam AI + Gemini Flash + Google Sheets
> Architecture: DRY, modular, no heavy paid dependencies

---

## 1. PRODUCT OVERVIEW

You are building **Voice2Form** — a voice-driven form filling system that:
1. Accepts audio (upload or live mic)
2. Transcribes it using Sarvam AI (Indian language STT, ₹30/hr)
3. Extracts structured fields using Gemini Flash (free tier, fast)
4. Lets the user verify/edit each field with confidence scores
5. Submits verified data to Google Sheets

**Core principle:** Audio is NEVER stored. It lives in memory only, is processed, then deleted. Only structured form data is persisted.

---

## 2. SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────┐
│                  FRONTEND (React)               │
│  TemplateSelector → AudioCapture → VerifyForm   │
│              → SubmitConfirm → SuccessView       │
└──────────────────────┬──────────────────────────┘
                       │ HTTP (multipart + JSON)
┌──────────────────────▼──────────────────────────┐
│              BACKEND (FastAPI)                  │
│                                                 │
│  /api/templates     — list built-in templates   │
│  /api/template/upload — parse custom template   │
│  /api/transcribe    — Sarvam STT (in-memory)    │
│  /api/extract       — Gemini field extraction   │
│  /api/submit        — Google Sheets append      │P
└──────┬──────────────────────────────────────────┘
       │
       ├── Sarvam AI API   (speech → text)
       ├── Gemini Flash API (text → structured JSON)
       └── Google Sheets API (gspread append row)
```

### DRY Module Structure

```
voice2form/
├── main.py                  # FastAPI app, route registration
├── config.py                # All env vars, API keys, constants
├── models.py                # Pydantic schemas (shared across routes)
│
├── services/
│   ├── sarvam.py            # STT: transcribe(audio_bytes) → str
│   ├── gemini.py            # Extraction: extract(transcript, fields) → dict
│   └── sheets.py            # Sync: append_row(form_name, data) → bool
│
├── templates/
│   ├── registry.py          # get_template(id), list_templates()
│   └── builtin/
│       ├── complaint.json
│       ├── lead_capture.json
│       ├── patient_intake.json
│       ├── service_booking.json
│       └── field_inspection.json
│
└── utils/
    ├── audio.py             # validate_audio_format(bytes) → bool
    └── template_parser.py   # parse_json/csv/pdf → List[Field]
```

---

## 3. DATA MODELS (models.py)

```python
from pydantic import BaseModel
from typing import Optional, Literal

class Field(BaseModel):
    name: str
    type: Literal["text", "phone", "email", "date", "number", "textarea"]
    required: bool = True
    hint: Optional[str] = None          # shown as placeholder

class Template(BaseModel):
    id: str
    name: str
    category: str                        # see category list below
    language: str = "hi-IN"
    fields: list[Field]

class ExtractedField(BaseModel):
    value: str
    confidence: int                      # 0–100
    source: Literal["ai", "missing"]    # ai = found in audio, missing = not found

class ExtractionResult(BaseModel):
    transcript: str
    fields: dict[str, ExtractedField]   # keyed by field name
    missing: list[str]                  # required fields not found
    audio_retained: bool = False

class SubmitPayload(BaseModel):
    template_id: str
    fields: dict[str, str]             # final verified values
    language: str = "hi-IN"
```

---

## 4. BUILT-IN TEMPLATE CATEGORIES

Each category has its own tab in Google Sheets. Templates are stored as JSON in `templates/builtin/`.

### Category A — Service & Complaints

**Template: `complaint`**
```json
{
  "id": "complaint",
  "name": "Complaint form",
  "category": "Service",
  "language": "hi-IN",
  "fields": [
    {"name": "Customer name",  "type": "text",     "required": true,  "hint": "Full name of the customer"},
    {"name": "Phone number",   "type": "phone",    "required": true,  "hint": "10-digit mobile number"},
    {"name": "Address",        "type": "text",     "required": true,  "hint": "Full address with flat/area"},
    {"name": "Issue",          "type": "textarea", "required": true,  "hint": "Describe the problem"},
    {"name": "Preferred date", "type": "date",     "required": false, "hint": "When to visit"}
  ]
}
```

**Template: `service_booking`**
```json
{
  "id": "service_booking",
  "name": "Service booking",
  "category": "Service",
  "fields": [
    {"name": "Customer name", "type": "text",     "required": true},
    {"name": "Phone",         "type": "phone",    "required": true},
    {"name": "Service type",  "type": "text",     "required": true,  "hint": "e.g. plumbing, electrical"},
    {"name": "Location",      "type": "text",     "required": true},
    {"name": "Date",          "type": "date",     "required": true},
    {"name": "Time slot",     "type": "text",     "required": false, "hint": "Morning / Afternoon / Evening"}
  ]
}
```

### Category B — Sales & Leads

**Template: `lead_capture`**
```json
{
  "id": "lead_capture",
  "name": "Lead capture",
  "category": "Sales",
  "fields": [
    {"name": "Name",        "type": "text",     "required": true},
    {"name": "Mobile",      "type": "phone",    "required": true},
    {"name": "Email",       "type": "email",    "required": false},
    {"name": "Company",     "type": "text",     "required": false},
    {"name": "Requirement", "type": "textarea", "required": true},
    {"name": "Budget",      "type": "text",     "required": false, "hint": "Approximate budget range"},
    {"name": "Follow-up",   "type": "date",     "required": false}
  ]
}
```

### Category C — Healthcare

**Template: `patient_intake`**
```json
{
  "id": "patient_intake",
  "name": "Patient intake",
  "category": "Healthcare",
  "fields": [
    {"name": "Patient name", "type": "text",     "required": true},
    {"name": "Age",          "type": "number",   "required": true},
    {"name": "Phone",        "type": "phone",    "required": true},
    {"name": "Symptoms",     "type": "textarea", "required": true},
    {"name": "Duration",     "type": "text",     "required": false, "hint": "How long — e.g. 3 days"},
    {"name": "Doctor",       "type": "text",     "required": false}
  ]
}
```

### Category D — Field Operations

**Template: `field_inspection`**
```json
{
  "id": "field_inspection",
  "name": "Field inspection",
  "category": "Operations",
  "fields": [
    {"name": "Inspector name", "type": "text",     "required": true},
    {"name": "Location",       "type": "text",     "required": true},
    {"name": "Asset ID",       "type": "text",     "required": false},
    {"name": "Condition",      "type": "textarea", "required": true,  "hint": "Describe the current state"},
    {"name": "Action needed",  "type": "textarea", "required": false},
    {"name": "Date",           "type": "date",     "required": true}
  ]
}
```

---

## 5. BACKEND SERVICES (DRY — each function does one thing)

### services/sarvam.py
```python
import requests, io
from config import SARVAM_API_KEY

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"

def transcribe(audio_bytes: bytes, filename: str, language: str = "hi-IN") -> str:
    """
    Send audio bytes to Sarvam AI.
    Returns transcript string.
    Audio bytes are passed by caller and deleted after this call returns.
    Raises ValueError on API error.
    """
    resp = requests.post(
        SARVAM_STT_URL,
        headers={"api-subscription-key": SARVAM_API_KEY},
        files={"file": (filename, io.BytesIO(audio_bytes), "audio/wav")},
        data={"model": "saaras:v3", "language_code": language},
        timeout=30
    )
    if resp.status_code != 200:
        raise ValueError(f"Sarvam STT failed: {resp.status_code} {resp.text}")
    return resp.json().get("transcript", "")
```

### services/gemini.py
```python
import google.generativeai as genai
import json
from config import GEMINI_API_KEY
from models import Field, ExtractedField, ExtractionResult

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash")   # free tier, fast

EXTRACTION_PROMPT = """
You are a form-filling assistant. Extract values for each field from the transcript below.

Fields to extract:
{fields_json}

Transcript:
"{transcript}"

Rules:
- Return ONLY valid JSON, no markdown, no explanation
- For each field return: {{"value": "...", "confidence": 0-100}}
- confidence 90-100 = clearly stated, 70-89 = inferred, 50-69 = guessed, 0 = not found
- If a field is not mentioned, return {{"value": "", "confidence": 0}}
- Normalize phone numbers to digits only
- Normalize dates to DD-MM-YYYY format
- Extract even partial information (e.g. first name only)

Return format:
{{
  "fields": {{
    "Field name": {{"value": "extracted value", "confidence": 95}},
    ...
  }}
}}
"""

def extract(transcript: str, fields: list[Field]) -> ExtractionResult:
    """
    Use Gemini Flash to extract field values from transcript.
    Returns ExtractionResult with per-field confidence scores.
    """
    fields_json = json.dumps([
        {"name": f.name, "type": f.type, "required": f.required, "hint": f.hint}
        for f in fields
    ], ensure_ascii=False)

    prompt = EXTRACTION_PROMPT.format(
        fields_json=fields_json,
        transcript=transcript
    )

    response = model.generate_content(prompt)
    raw = response.text.strip()

    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    parsed = json.loads(raw)
    extracted = {}
    missing = []

    for field in fields:
        data = parsed.get("fields", {}).get(field.name, {})
        value = data.get("value", "")
        conf  = data.get("confidence", 0)
        source = "ai" if value else "missing"
        extracted[field.name] = ExtractedField(
            value=value, confidence=conf, source=source
        )
        if field.required and not value:
            missing.append(field.name)

    return ExtractionResult(
        transcript=transcript,
        fields=extracted,
        missing=missing,
        audio_retained=False
    )
```

### services/sheets.py
```python
import gspread, os, json
from google.oauth2.service_account import Credentials
from datetime import datetime
from functools import lru_cache

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]
SPREADSHEET_NAME = "Voice2Form Records"

@lru_cache(maxsize=1)
def _get_client():
    """Cached gspread client — created once, reused."""
    creds_json = json.loads(os.environ["GOOGLE_CREDENTIALS_JSON"])
    creds = Credentials.from_service_account_info(creds_json, scopes=SCOPES)
    return gspread.authorize(creds)

def _get_or_create_worksheet(gc, spreadsheet_name: str, sheet_name: str):
    """Get worksheet by name, create if not found."""
    try:
        ss = gc.open(spreadsheet_name)
    except gspread.SpreadsheetNotFound:
        ss = gc.create(spreadsheet_name)
    try:
        return ss.worksheet(sheet_name)
    except gspread.WorksheetNotFound:
        return ss.add_worksheet(title=sheet_name, rows=1000, cols=30)

def _ensure_headers(ws, headers: list[str]):
    """Write headers on row 1 if sheet is empty."""
    if not ws.row_values(1):
        ws.append_row(["Timestamp"] + headers)

def append_record(form_name: str, category: str, fields: dict[str, str]) -> bool:
    """
    Append one row to the correct worksheet.
    Sheet tab = category name (e.g. "Service", "Sales", "Healthcare").
    Returns True on success.
    """
    gc = _get_client()
    ws = _get_or_create_worksheet(gc, SPREADSHEET_NAME, category)
    _ensure_headers(ws, list(fields.keys()))
    row = [datetime.now().strftime("%d-%m-%Y %H:%M")] + list(fields.values())
    ws.append_row(row, value_input_option="USER_ENTERED")
    return True
```

---

## 6. API ROUTES (main.py)

```python
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import SubmitPayload, ExtractionResult
from templates.registry import get_template, list_templates, parse_uploaded_template
from services import sarvam, gemini, sheets

app = FastAPI(title="Voice2Form API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

ALLOWED_AUDIO = {"audio/wav", "audio/mpeg", "audio/ogg", "audio/m4a", "audio/webm"}
MAX_AUDIO_MB = 50

# ── Templates ────────────────────────────────────────────────
@app.get("/api/templates")
def get_templates():
    """Return all built-in templates grouped by category."""
    return list_templates()

@app.post("/api/template/upload")
async def upload_template(file: UploadFile = File(...)):
    """
    Parse a user-uploaded form template.
    Supports: .json, .csv
    Returns detected fields list.
    """
    content = await file.read()
    try:
        template = parse_uploaded_template(content, file.filename)
        return template
    except Exception as e:
        raise HTTPException(400, f"Could not parse template: {e}")

# ── Transcription ─────────────────────────────────────────────
@app.post("/api/transcribe", response_model=ExtractionResult)
async def transcribe_and_extract(
    audio: UploadFile = File(...),
    template_id: str  = Form(...),
    language: str     = Form("hi-IN")
):
    """
    Main pipeline:
    1. Validate audio
    2. Read to memory only — never saved to disk
    3. Transcribe via Sarvam AI
    4. Delete audio bytes from memory
    5. Extract fields via Gemini Flash
    6. Return transcript + per-field confidence scores
    """
    # Validate
    if audio.content_type not in ALLOWED_AUDIO:
        raise HTTPException(400, "Unsupported audio format")

    audio_bytes = await audio.read()
    if len(audio_bytes) > MAX_AUDIO_MB * 1024 * 1024:
        raise HTTPException(400, f"Audio exceeds {MAX_AUDIO_MB}MB limit")

    template = get_template(template_id)
    if not template:
        raise HTTPException(404, "Template not found")

    # Transcribe
    try:
        transcript = sarvam.transcribe(audio_bytes, audio.filename, language)
    except ValueError as e:
        raise HTTPException(502, str(e))
    finally:
        del audio_bytes   # wipe from memory immediately

    # Extract
    result = gemini.extract(transcript, template.fields)
    return result

# ── Submit ────────────────────────────────────────────────────
@app.post("/api/submit")
def submit_form(payload: SubmitPayload):
    """
    Write verified form data to Google Sheets.
    Tab = template category.
    """
    template = get_template(payload.template_id)
    if not template:
        raise HTTPException(404, "Template not found")

    success = sheets.append_record(
        form_name=template.name,
        category=template.category,
        fields=payload.fields
    )
    return {"status": "submitted", "sheet_tab": template.category, "success": success}
```

---

## 7. FRONTEND UX RULES

### Step Flow (4 steps — no skipping)

```
Step 1: Template     → Step 2: Audio      → Step 3: Verify     → Step 4: Done
Choose/upload form     Record or upload     Review AI fields      Confirmation
```

### Step 1 — Template Selection
- Show built-in templates grouped by category cards
- Each card shows: icon, name, field count, language badge
- "Upload your own" option opens JSON/CSV file picker
- Uploaded template: parse fields client-side, preview detected fields
- User must select/confirm before proceeding
- Disable "Next" until template is selected

### Step 2 — Audio Capture
- Two modes: Live mic OR Upload file
- Live mic: show animated waveform bars while recording, timer, stop button
- Upload: drag-drop zone, accepted formats shown, file size limit visible
- After audio ready: auto-start processing (no extra button click needed)
- Show processing progress: Uploading → Transcribing → Extracting fields → Done
- Show privacy pill: "Audio deleted after processing — never stored"
- If Sarvam fails: show error with retry button, do not clear audio

### Step 3 — Verify Fields
- Show every field from the template
- AI-filled fields: green border + "AI filled" badge + confidence %
- Missing required fields: amber border + "Enter manually" badge
- Missing optional fields: gray + "Optional — not mentioned"
- Confidence display rules:
  - 90–100%: show "High confidence" in green
  - 70–89%:  show "Review suggested" in amber
  - 50–69%:  show "Please verify" in amber bold
  - Below 50%: show "Low — please correct" in red
- All fields are editable regardless of confidence
- Submit button locked until ALL required fields have a value
- "Re-record" button available at top — returns to Step 2, keeps template
- Show transcript in collapsible section below form (for reference)

### Step 4 — Confirmation
- Show submitted record summary (read-only)
- Show "Synced to Google Sheets" with sheet tab name
- Show "Audio retained: No"
- Two actions: "New record" (restart Step 1) and "View in Sheets" (link)

### General UX Rules
- Never show raw API errors to the user — translate to plain English
- Every loading state shows what is happening ("Sending to Sarvam AI...")
- Mobile-first layout — single column on small screens
- Language selector (hi-IN, ta-IN, te-IN, ml-IN, kn-IN, en-IN) persists across sessions in localStorage
- All form inputs support paste — user can paste values if voice missed something
- Show field count progress: "4 of 5 fields filled"

---

## 8. CONFIDENCE SCORE SYSTEM

Gemini returns a confidence integer 0–100 per field. Rules:

| Range  | Label              | UI colour | Action                        |
|--------|--------------------|-----------|-------------------------------|
| 90–100 | High confidence    | Green     | Auto-accept, editable         |
| 70–89  | Review suggested   | Amber     | Highlight, user should check  |
| 50–69  | Please verify      | Amber bold| Pre-select field for editing  |
| 1–49   | Low confidence     | Red       | Mark clearly wrong            |
| 0      | Not found          | Gray/Amber| Empty, user must type         |

Missing required fields block form submission regardless of other fields.

---

## 9. CUSTOM TEMPLATE UPLOAD SPEC

### JSON format (recommended)
```json
{
  "form_name": "Your form title",
  "category": "Custom",
  "fields": [
    {"name": "Field label", "type": "text|phone|email|date|number|textarea", "required": true, "hint": "placeholder text"}
  ]
}
```

### CSV format (simple)
```
field_name,type,required,hint
Customer name,text,true,Full name
Phone,phone,true,10-digit number
Issue,textarea,true,Describe the problem
```

### Parsing rules (utils/template_parser.py)
- Unknown `type` values → default to `"text"`
- Missing `required` → default to `true`
- Duplicate field names → deduplicate by appending `_2`, `_3`
- Max 20 fields per template — reject above with clear error
- Field name max 40 characters — truncate silently
- Strip leading/trailing whitespace from all values

---

## 10. ENVIRONMENT VARIABLES (config.py)

```python
import os

SARVAM_API_KEY         = os.environ["SARVAM_API_KEY"]
GEMINI_API_KEY         = os.environ["GEMINI_API_KEY"]
GOOGLE_CREDENTIALS_JSON = os.environ["GOOGLE_CREDENTIALS_JSON"]  # full service account JSON as string
SPREADSHEET_NAME       = os.getenv("SPREADSHEET_NAME", "Voice2Form Records")
MAX_AUDIO_MB           = int(os.getenv("MAX_AUDIO_MB", "50"))
DEFAULT_LANGUAGE       = os.getenv("DEFAULT_LANGUAGE", "hi-IN")
```

### .env file (local dev)
```
SARVAM_API_KEY=your_sarvam_key
GEMINI_API_KEY=your_gemini_key
GOOGLE_CREDENTIALS_JSON={"type":"service_account","project_id":"..."}
```

---

## 11. GEMINI FLASH — KEY NOTES

- Model: `gemini-2.5-flash` — free tier, ~1s latency, sufficient for field extraction
- Input: transcript text (avg 50–300 words) + field schema JSON
- Output: structured JSON with field values and confidence scores
- Prompt is defined once in `services/gemini.py` as a constant — never inline
- Always strip markdown code fences from response before parsing JSON
- On JSON parse failure: retry once, then return all fields as missing with confidence 0
- Do not send audio to Gemini — only the transcript text

---

## 12. GOOGLE SHEETS STRUCTURE

```
Spreadsheet: "Voice2Form Records"
├── Sheet tab: Service       ← complaint + service_booking records
├── Sheet tab: Sales         ← lead_capture records
├── Sheet tab: Healthcare    ← patient_intake records
├── Sheet tab: Operations    ← field_inspection records
└── Sheet tab: Custom        ← user-uploaded templates
```

Each tab:
- Row 1: headers (Timestamp, field names from template)
- Row 2+: one row per submitted record
- Headers auto-created on first submission to that tab
- Timestamp format: `DD-MM-YYYY HH:MM`

---

## 13. ERROR HANDLING (user-facing messages)

| Error condition                  | User message                                              |
|----------------------------------|-----------------------------------------------------------|
| Sarvam API down                  | "Could not transcribe audio. Please try again."          |
| Audio too large                  | "File too large. Max 50MB supported."                    |
| Unsupported audio format         | "Please upload WAV, MP3, OGG, or M4A."                  |
| Gemini parse failure             | "Could not extract fields. Please fill in manually."     |
| Google Sheets auth failure       | "Could not save record. Contact support."                |
| Template parse error             | "Could not read your template file. Check the format."   |
| No transcript returned           | "No speech detected. Is audio clear? Try again."         |
| All fields missing               | "Nothing extracted. Check audio language matches setting."|

---

## 14. WHAT NOT TO BUILD (MVP SCOPE LIMITS)

- No user authentication (add in Phase 2)
- No audio storage or playback after processing
- No real-time streaming STT (Sarvam REST API only — under 30s clips)
- No WhatsApp integration (Phase 2)
- No CRM sync (Phase 2)
- No multi-user team management
- No billing or usage tracking
- No PDF template parsing (JSON/CSV only in MVP)
- No multi-language in same recording (pick one language per session)
- No voice activity detection or silence trimming

---

## 15. TESTING CHECKLIST

- [ ] Upload complaint template → record "My name is Raj, phone 9876543210, water leak in flat 4B MG Road" → all 4 fields filled at 90%+
- [ ] Missing required field blocks submission
- [ ] Edit a field → confidence badge disappears (user overrode AI)
- [ ] Re-record replaces previous extraction, keeps same template
- [ ] Upload custom JSON template → fields appear correctly
- [ ] Submit → row appears in correct Google Sheets tab within 3 seconds
- [ ] Audio bytes are not present in any server log or temp file
- [ ] 50MB audio file rejected with clear error
- [ ] Tamil audio (ta-IN) extracts Tamil names correctly via Sarvam
- [ ] Gemini returns malformed JSON → app shows manual entry mode, not crash
