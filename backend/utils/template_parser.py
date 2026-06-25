import csv
import json
from io import BytesIO, StringIO
from pathlib import Path

from config import MAX_FIELD_NAME_LENGTH, MAX_TEMPLATE_FIELDS
from models import Field, Template
from services.gemini import extract_template_from_text

from config import MAX_FIELD_NAME_LENGTH, MAX_TEMPLATE_FIELDS
from models import Field, Template

VALID_FIELD_TYPES = {"text", "phone", "email", "date", "number", "textarea"}


def parse_template_content(content: bytes, filename: str) -> tuple[Template, dict | None, int | None]:
    suffix = Path(filename).suffix.lower()
    if suffix == ".json":
        return _parse_json_template(content), None, None
    if suffix == ".csv":
        return _parse_csv_template(content, filename), None, None
    if suffix == ".pdf":
        return _parse_pdf_template(content, filename)
    if suffix == ".docx":
        return _parse_docx_template(content, filename)
    raise ValueError("Could not read your template file. Check the format.")


def _parse_json_template(content: bytes) -> Template:
    try:
        payload = json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("Could not read your template file. Check the format.") from exc

    form_name = str(payload.get("form_name", "")).strip() or "Custom form"
    category = str(payload.get("category", "Custom")).strip() or "Custom"
    fields = _normalize_fields(payload.get("fields", []))

    return Template(
        id=_slugify(form_name),
        name=form_name,
        category=category,
        source="custom",
        language="hi-IN",
        fields=fields,
    )


def _parse_csv_template(content: bytes, filename: str) -> Template:
    try:
        decoded = content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError("Could not read your template file. Check the format.") from exc

    reader = csv.DictReader(StringIO(decoded))
    if not reader.fieldnames or "field_name" not in reader.fieldnames:
        raise ValueError("Could not read your template file. Check the format.")

    fields_payload = []
    for row in reader:
        fields_payload.append(
            {
                "name": row.get("field_name", ""),
                "type": row.get("type", "text"),
                "required": row.get("required", "true"),
                "hint": row.get("hint", ""),
            }
        )

    form_name = Path(filename).stem.replace("_", " ").strip() or "Custom form"
    return Template(
        id=_slugify(form_name),
        name=form_name.title(),
        category="Custom",
        source="custom",
        language="hi-IN",
        fields=_normalize_fields(fields_payload),
    )


def _parse_pdf_template(content: bytes, filename: str) -> tuple[Template, dict | None, int | None]:
    try:
        import pypdf
        reader = pypdf.PdfReader(BytesIO(content))
        text = "\n".join(page.extract_text() for page in reader.pages if page.extract_text())
    except Exception as exc:
        raise ValueError("Could not read your PDF file. Check the format.") from exc

    extracted, usage, latency = extract_template_from_text(text, filename)
    if not extracted:
        raise ValueError("Could not extract form template from this PDF. Try uploading a JSON or CSV.")
    
    return _json_to_template(extracted, filename), usage, latency


def _parse_docx_template(content: bytes, filename: str) -> tuple[Template, dict | None, int | None]:
    try:
        import docx
        doc = docx.Document(BytesIO(content))
        text = "\n".join(paragraph.text for paragraph in doc.paragraphs)
    except Exception as exc:
        raise ValueError("Could not read your DOCX file. Check the format.") from exc

    extracted, usage, latency = extract_template_from_text(text, filename)
    if not extracted:
        raise ValueError("Could not extract form template from this DOCX. Try uploading a JSON or CSV.")
    
    return _json_to_template(extracted, filename), usage, latency


def _json_to_template(payload: dict, filename: str) -> Template:
    form_name = str(payload.get("form_name", "")).strip() or Path(filename).stem.replace("_", " ").title() or "Custom form"
    category = str(payload.get("category", "Custom")).strip() or "Custom"
    fields = _normalize_fields(payload.get("fields", []))

    return Template(
        id=_slugify(form_name),
        name=form_name,
        category=category,
        source="custom",
        language="hi-IN",
        fields=fields,
    )


def _normalize_fields(raw_fields: list[dict]) -> list[Field]:
    if not isinstance(raw_fields, list) or not raw_fields:
        raise ValueError("Template must contain at least one field.")
    if len(raw_fields) > MAX_TEMPLATE_FIELDS:
        raise ValueError(f"Template supports up to {MAX_TEMPLATE_FIELDS} fields.")

    normalized: list[Field] = []
    seen_names: dict[str, int] = {}

    for raw_field in raw_fields:
        if not isinstance(raw_field, dict):
            raise ValueError("Template fields are invalid.")

        base_name = str(raw_field.get("name", "")).strip()[:MAX_FIELD_NAME_LENGTH]
        if not base_name:
            raise ValueError("Each field must have a name.")

        count = seen_names.get(base_name, 0) + 1
        seen_names[base_name] = count
        final_name = base_name if count == 1 else f"{base_name}_{count}"

        field_type = str(raw_field.get("type", "text")).strip().lower()
        if field_type not in VALID_FIELD_TYPES:
            field_type = "text"

        normalized.append(
            Field(
                name=final_name,
                type=field_type,
                required=_parse_required(raw_field.get("required", True)),
                hint=_clean_optional_text(raw_field.get("hint")),
            )
        )

    return normalized


def _parse_required(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return True
    return str(value).strip().lower() not in {"false", "0", "no"}


def _clean_optional_text(value: object) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def _slugify(value: str) -> str:
    cleaned = "".join(char.lower() if char.isalnum() else "_" for char in value.strip())
    parts = [part for part in cleaned.split("_") if part]
    return "_".join(parts) or "custom_template"
