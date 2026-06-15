from typing import Literal

from pydantic import BaseModel, Field as PydanticField


class Field(BaseModel):
    name: str
    type: Literal["text", "phone", "email", "date", "number", "textarea"]
    required: bool = True
    hint: str | None = None


class Template(BaseModel):
    id: str
    name: str
    category: str
    language: str = "hi-IN"
    fields: list[Field]


class ExtractedField(BaseModel):
    value: str
    confidence: int = PydanticField(ge=0, le=100)
    source: Literal["ai", "missing"]


class ExtractionResult(BaseModel):
    transcript: str
    fields: dict[str, ExtractedField]
    missing: list[str]
    audio_retained: bool = False


class SubmitPayload(BaseModel):
    template_id: str | None = None
    fields: dict[str, str]
    language: str = "hi-IN"
    template: Template | None = None
    access_token: str | None = None
    target_sheet_url: str | None = None
