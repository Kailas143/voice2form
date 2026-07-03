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
    source: str = "builtin"
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
    llm_usage: dict | None = None
    latency_ms: int | None = None


class SubmitPayload(BaseModel):
    template_id: str | None = None
    fields: dict[str, str]
    language: str = "hi-IN"
    template: Template | None = None
    access_token: str | None = None
    target_sheet_url: str | None = None
    submission_source: Literal["recording", "upload"] = "recording"


class ManualSignupPayload(BaseModel):
    name: str
    email: str
    password: str


class ManualLoginPayload(BaseModel):
    email: str
    password: str


class GoogleLoginPayload(BaseModel):
    name: str
    email: str
    avatar: str | None = None


class AuthUser(BaseModel):
    provider: str
    name: str
    email: str
    avatar: str | None = None


class AuthResponse(BaseModel):
    status: str
    access_token: str
    token_type: str = "bearer"
    user: AuthUser


class ForgotPasswordPayload(BaseModel):
    email: str


class ResetPasswordPayload(BaseModel):
    reset_token: str
    new_password: str


class WorkspaceCreatePayload(BaseModel):
    name: str | None = None
    template_id: str | None = None
    template: Template | None = None
    language: str = "hi-IN"
    sheet_sync_mode: Literal["new", "existing"] = "new"
    target_sheet_url: str | None = None
    extraction_rules: Literal["Standard", "Strict", "Lenient"] = "Standard"


class WorkspaceUpdatePayload(BaseModel):
    name: str | None = None
    template_id: str | None = None
    template: Template | None = None
    language: str | None = None
    sheet_sync_mode: Literal["new", "existing"] | None = None
    target_sheet_url: str | None = None
    extraction_rules: Literal["Standard", "Strict", "Lenient"] | None = None
    is_pinned: bool | None = None

class OrganizationSwitchPayload(BaseModel):
    organization_id: str
