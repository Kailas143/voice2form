import json
from functools import lru_cache
from pathlib import Path

from models import Template
from utils.template_parser import parse_template_content

TEMPLATES_DIR = Path(__file__).resolve().parent / "builtin"


@lru_cache(maxsize=1)
def _load_templates() -> list[Template]:
    templates: list[Template] = []
    for path in sorted(TEMPLATES_DIR.glob("*.json")):
        with path.open("r", encoding="utf-8") as handle:
            templates.append(Template.model_validate(json.load(handle)))
    return templates


def list_templates() -> dict[str, list[Template]]:
    grouped: dict[str, list[Template]] = {}
    for template in _load_templates():
        grouped.setdefault(template.category, []).append(template)
    return grouped


def get_template(template_id: str) -> Template | None:
    for template in _load_templates():
        if template.id == template_id:
            return template
    return None


def parse_uploaded_template(content: bytes, filename: str) -> Template:
    return parse_template_content(content, filename)


def parse_uploaded_template_json(raw_template: str) -> Template:
    return Template.model_validate(json.loads(raw_template))
