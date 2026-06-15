import json

from config import GEMINI_API_KEY
from models import ExtractedField, ExtractionResult, Field

EXTRACTION_PROMPT = """
You are a form-filling assistant. Extract values for each field from the transcript below.

Fields to extract:
{fields_json}

Transcript:
"{transcript}"

Rules:
- Return ONLY valid JSON, no markdown, no explanation
- TRANSLATE ALL EXTRACTED VALUES TO ENGLISH, regardless of the original language of the transcript.
- For each field return: {{"value": "...", "confidence": 0-100}}
- confidence 90-100 = clearly stated, 70-89 = inferred, 50-69 = guessed, 0 = not found
- If a field is not mentioned, return {{"value": "", "confidence": 0}}
- Normalize phone numbers to digits only
- Normalize dates to DD-MM-YYYY format
- Extract even partial information

Return format:
{{
  "fields": {{
    "Field name": {{"value": "extracted value in english", "confidence": 95}}
  }}
}}
""".strip()


def extract(transcript: str, fields: list[Field]) -> ExtractionResult:
    if not transcript.strip():
        return _all_missing_result("", fields)

    if not GEMINI_API_KEY:
        return _all_missing_result(transcript, fields)

    payload = json.dumps(
        [
            {
                "name": field.name,
                "type": field.type,
                "required": field.required,
                "hint": field.hint,
            }
            for field in fields
        ],
        ensure_ascii=False,
    )
    prompt = EXTRACTION_PROMPT.format(fields_json=payload, transcript=transcript)

    raw_text = _generate_content(prompt)
    if raw_text is None:
        raw_text = _generate_content(prompt)
    if raw_text is None:
        return _all_missing_result(transcript, fields)

    parsed = _parse_json_payload(raw_text)
    if parsed is None:
        retry_text = _generate_content(prompt)
        parsed = _parse_json_payload(retry_text) if retry_text is not None else None
    if parsed is None:
        return _all_missing_result(transcript, fields)

    extracted: dict[str, ExtractedField] = {}
    missing: list[str] = []

    parsed_fields = parsed.get("fields", {})
    for field in fields:
        item = parsed_fields.get(field.name, {}) if isinstance(parsed_fields, dict) else {}
        value = str(item.get("value", "")).strip()
        confidence = _safe_confidence(item.get("confidence", 0))
        source = "ai" if value else "missing"
        extracted[field.name] = ExtractedField(
            value=value,
            confidence=confidence,
            source=source,
        )
        if field.required and not value:
            missing.append(field.name)

    return ExtractionResult(
        transcript=transcript,
        fields=extracted,
        missing=missing,
        audio_retained=False,
    )


def _generate_content(prompt: str) -> str | None:
    try:
        import google.generativeai as genai

        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
    except Exception:
        return None

    text = getattr(response, "text", None)
    return text.strip() if isinstance(text, str) else None


def _parse_json_payload(raw_text: str) -> dict | None:
    candidate = raw_text.strip()
    if candidate.startswith("```"):
        parts = candidate.split("```")
        candidate = parts[1] if len(parts) > 1 else candidate
        if candidate.startswith("json"):
            candidate = candidate[4:]
    candidate = candidate.strip()

    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _all_missing_result(transcript: str, fields: list[Field]) -> ExtractionResult:
    extracted: dict[str, ExtractedField] = {}
    missing: list[str] = []
    for field in fields:
        extracted[field.name] = ExtractedField(value="", confidence=0, source="missing")
        if field.required:
            missing.append(field.name)
    return ExtractionResult(
        transcript=transcript,
        fields=extracted,
        missing=missing,
        audio_retained=False,
    )


def _safe_confidence(value: object) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return 0
    return max(0, min(100, number))


def transcribe_audio(audio_bytes: bytes, mime_type: str, language: str | None = None) -> str:
    if not GEMINI_API_KEY:
        raise ValueError("Gemini API key is not configured.")
    try:
        import google.generativeai as genai

        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.5-flash")
        base_mime_type = mime_type.split(";")[0] if mime_type else "audio/wav"

        prompt = "Please transcribe the following audio. Return only the transcribed text with no other explanations or markdown."
        if language:
            prompt += f" The language is {language}."

        response = model.generate_content(
            [
                prompt,
                {"mime_type": base_mime_type, "data": audio_bytes},
            ]
        )
        text = getattr(response, "text", None)
        return text.strip() if isinstance(text, str) else ""
    except Exception as exc:
        raise ValueError(f"Gemini STT failed: {exc}") from exc


def extract_template_from_text(text: str, filename: str) -> dict | None:
    if not GEMINI_API_KEY:
        return None

    prompt = f"""
You are a form template assistant. Extract a JSON form template from the following document text.
Rules:
- Identify form fields (inputs, textareas, checkboxes, drop-downs) from the text.
- Determine the field name, field type ('text', 'phone', 'email', 'date', 'number', 'textarea'), whether it's required (boolean), and any hints.
- Output ONLY valid JSON, no markdown, no explanation.
- Use this strict JSON structure:
{{
  "form_name": "...",
  "category": "Custom",
  "fields": [
    {{"name": "...", "type": "...", "required": true, "hint": "..."}}
  ]
}}

Document Name: {filename}
Document Text:
"{text}"
""".strip()

    raw_text = _generate_content(prompt)
    if not raw_text:
        return None

    return _parse_json_payload(raw_text)
