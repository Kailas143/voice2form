import json
import logging
import re
import time
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

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
- Resolve relative dates like today, tomorrow, next Monday using the current date: {current_date}
- Normalize dates to DD-MM-YYYY format
- Extract even partial information

Return format:
{{
  "fields": {{
    "Field name": {{"value": "extracted value in english", "confidence": 95}}
  }}
}}
""".strip()

REALTIME_EXTRACTION_PROMPT = """
You are an intelligent form extraction engine.

Your task is to extract values for only the fields defined in the provided form schema.

Rules:
* Extract values only for fields present in the schema.
* Never invent data.
* Return only updated fields.
* Support partial updates.
* Handle corrections.
* Resolve relative dates like today, tomorrow, next Monday using the current date: {current_date}
* Normalize dates, phone numbers, and emails where possible.
* Return dates in YYYY-MM-DD format.
* Ignore unrelated conversation.
* Return valid JSON only.

Form Schema:
{form_schema}

Current Values:
{current_form_data}

Transcript:
{transcript_chunk}

Return only changed values as JSON.
Format the output as a simple JSON object where keys are field names and values are the new extracted values:
{{
  "Field Name": "new value",
  "Another Field": "another new value"
}}
""".strip()


def extract_realtime(transcript_chunk: str, fields: list[Field], current_data: dict[str, str]) -> dict[str, str]:
    if not transcript_chunk.strip() or not GEMINI_API_KEY:
        return {}

    form_schema = json.dumps(
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
    
    current_form_data = json.dumps(current_data, ensure_ascii=False)
    
    prompt = REALTIME_EXTRACTION_PROMPT.format(
        form_schema=form_schema,
        current_form_data=current_form_data,
        transcript_chunk=transcript_chunk,
        current_date=_current_date_iso(),
    )

    raw_text, usage_dict, latency_ms = _generate_content(prompt, flow_name="extraction_realtime")
    if not raw_text:
        raw_text, usage_dict, latency_ms = _generate_content(prompt, flow_name="extraction_realtime_retry")
    if not raw_text:
        return {}

    parsed = _parse_json_payload(raw_text)
    if parsed is None:
        retry_text, usage_dict_retry, latency_retry = _generate_content(prompt, flow_name="extraction_realtime_json_retry")
        parsed = _parse_json_payload(retry_text) if retry_text is not None else None
    
    if isinstance(parsed, dict):
        # The prompt asks for {"Field Name": "new value"}
        # Let's filter to make sure we only return string values and keys that exist in fields
        valid_field_names = {f.name for f in fields}
        field_by_name = {f.name: f for f in fields}
        changes = {}
        for k, v in parsed.items():
            if k in valid_field_names and isinstance(v, str):
                normalized = _normalize_field_value(field_by_name[k], v.strip())
                changes[k] = normalized
        return changes

    return {}


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
    prompt = EXTRACTION_PROMPT.format(
        fields_json=payload,
        transcript=transcript,
        current_date=_current_date_iso(),
    )

    raw_text, usage_dict, latency_ms = _generate_content(prompt, flow_name="extraction")
    if raw_text is None:
        raw_text, usage_dict, latency_ms = _generate_content(prompt, flow_name="extraction_retry")
    if raw_text is None:
        return _all_missing_result(transcript, fields)

    parsed = _parse_json_payload(raw_text)
    if parsed is None:
        retry_text, usage_dict_retry, latency_retry = _generate_content(prompt, flow_name="extraction_json_retry")
        if usage_dict_retry and latency_retry:
            usage_dict = usage_dict_retry
            latency_ms = latency_retry
        parsed = _parse_json_payload(retry_text) if retry_text is not None else None
    if parsed is None:
        return _all_missing_result(transcript, fields)

    extracted: dict[str, ExtractedField] = {}
    missing: list[str] = []

    parsed_fields = parsed.get("fields", {})
    for field in fields:
        item = parsed_fields.get(field.name, {}) if isinstance(parsed_fields, dict) else {}
        value = _normalize_field_value(field, str(item.get("value", "")).strip())
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
        llm_usage=usage_dict,
        latency_ms=latency_ms,
    )


def _calculate_gemini_cost(prompt: int, candidates: int) -> float:
    # Gemini 2.5 Flash pricing: $0.075 per 1M input, $0.30 per 1M output
    return (prompt * 0.075 / 1_000_000) + (candidates * 0.30 / 1_000_000)


def _generate_content(prompt: str, flow_name: str = "general") -> tuple[str | None, dict | None, int | None]:
    start_time = time.perf_counter()
    try:
        client = _gemini_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
    except Exception as exc:
        logger.error(f"Gemini API Error: {exc}")
        return None, None, None

    latency_ms = int((time.perf_counter() - start_time) * 1000)
    
    usage_metadata = getattr(response, "usage_metadata", None)
    usage_dict = {}
    if usage_metadata:
        usage_dict = {
            "prompt": getattr(usage_metadata, "prompt_token_count", 0),
            "candidates": getattr(usage_metadata, "candidates_token_count", 0),
            "total": getattr(usage_metadata, "total_token_count", 0),
        }
        usage_dict["cost_usd"] = _calculate_gemini_cost(usage_dict["prompt"], usage_dict["candidates"])
        
    logger.info(f"⚡ [LLM] Model: gemini-2.5-flash | Flow: {flow_name} | Latency: {latency_ms}ms | Tokens: {usage_dict}")

    text = _response_text(response)
    return text.strip() if isinstance(text, str) else None, usage_dict, latency_ms


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


def _current_date_iso() -> str:
    return datetime.now().date().isoformat()


def _normalize_field_value(field: Field, value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        return ""

    field_type = (field.type or "").lower()
    if field_type == "phone":
        digits = re.sub(r"\D+", "", cleaned)
        return digits

    if field_type == "date":
        normalized_date = _normalize_date_value(cleaned)
        return normalized_date or ""

    return cleaned


def _normalize_date_value(value: str) -> str | None:
    if not value:
        return None

    candidate = value.strip()
    if not candidate:
        return None

    lowered = candidate.lower()
    today = datetime.now().date()
    relative_dates = {
        "today": today,
        "tomorrow": today + timedelta(days=1),
        "yesterday": today - timedelta(days=1),
    }
    if lowered in relative_dates:
        return relative_dates[lowered].isoformat()

    compact = re.sub(r"\s+", " ", candidate.replace(",", " ")).strip()

    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(compact, fmt).date().isoformat()
        except ValueError:
            pass

    month_first_match = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", compact)
    if month_first_match:
        first = int(month_first_match.group(1))
        second = int(month_first_match.group(2))
        year = int(month_first_match.group(3))

        # Prefer day-first for Indian-style data unless it would be invalid.
        if first > 12:
            day, month = first, second
        elif second > 12:
            day, month = second, first
        else:
            day, month = second, first

        try:
            return datetime(year, month, day).date().isoformat()
        except ValueError:
            return None

    textual_patterns = (
        "%d %B %Y",
        "%d %b %Y",
        "%B %d %Y",
        "%b %d %Y",
    )
    for fmt in textual_patterns:
        try:
            return datetime.strptime(compact, fmt).date().isoformat()
        except ValueError:
            pass

    return None


def transcribe_audio(audio_bytes: bytes, mime_type: str, language: str | None = None) -> tuple[str, dict | None, int | None]:
    if not GEMINI_API_KEY:
        raise ValueError("Gemini API key is not configured.")
    start_time = time.perf_counter()
    try:
        from google.genai import types

        client = _gemini_client()
        base_mime_type = mime_type.split(";")[0] if mime_type else "audio/wav"

        prompt = "Please transcribe the following audio. Return only the transcribed text with no other explanations or markdown."
        if language:
            prompt += f" The language is {language}."

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                prompt,
                types.Part.from_bytes(data=audio_bytes, mime_type=base_mime_type),
            ]
        )
        
        latency_ms = int((time.perf_counter() - start_time) * 1000)
        usage_metadata = getattr(response, "usage_metadata", None)
        usage_dict = {}
        if usage_metadata:
            usage_dict = {
                "prompt": getattr(usage_metadata, "prompt_token_count", 0),
                "candidates": getattr(usage_metadata, "candidates_token_count", 0),
                "total": getattr(usage_metadata, "total_token_count", 0),
            }
            usage_dict["cost_usd"] = _calculate_gemini_cost(usage_dict["prompt"], usage_dict["candidates"])
        logger.info(f"⚡ [LLM] Model: gemini-2.5-flash | Flow: transcription | Latency: {latency_ms}ms | Tokens: {usage_dict}")
        
        text = _response_text(response)
        return text.strip() if isinstance(text, str) else "", usage_dict, latency_ms
    except Exception as exc:
        raise ValueError(f"Gemini STT failed: {exc}") from exc


def _gemini_client():
    from google import genai

    return genai.Client(api_key=GEMINI_API_KEY)


def _response_text(response: object) -> str | None:
    text = getattr(response, "text", None)
    if isinstance(text, str) and text.strip():
        return text

    candidates = getattr(response, "candidates", None)
    if not isinstance(candidates, list):
        return None

    parts: list[str] = []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        content_parts = getattr(content, "parts", None)
        if not isinstance(content_parts, list):
            continue
        for part in content_parts:
            part_text = getattr(part, "text", None)
            if isinstance(part_text, str) and part_text.strip():
                parts.append(part_text.strip())

    return "\n".join(parts).strip() if parts else None


def extract_template_from_text(text: str, filename: str) -> tuple[dict | None, dict | None, int | None]:
    if not GEMINI_API_KEY:
        return None, None, None

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

    raw_text, usage_dict, latency_ms = _generate_content(prompt, flow_name="template_generation")
    if not raw_text:
        return None, usage_dict, latency_ms

    return _parse_json_payload(raw_text), usage_dict, latency_ms
