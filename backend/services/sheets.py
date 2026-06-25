import json
from datetime import datetime
from functools import lru_cache

import os
from config import SPREADSHEET_NAME

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def _get_client(access_token: str | None = None):
    try:
        import gspread
        from google.oauth2.credentials import Credentials
    except Exception as exc:
        raise RuntimeError("Could not save record. Contact support. gspread missing.") from exc

    if not access_token:
        raise RuntimeError("Google access token is required to save to your Sheet.")

    try:
        creds = Credentials(token=access_token)
        return gspread.authorize(creds)
    except Exception as exc:
        raise RuntimeError(f"Authentication failed with provided token. Error: {exc}") from exc


def _get_or_create_worksheet(client, spreadsheet_name: str, sheet_name: str, target_sheet_url: str | None = None):
    if target_sheet_url:
        try:
            spreadsheet = client.open_by_url(target_sheet_url)
        except Exception as exc:
            raise RuntimeError(f"Could not open the provided Google Sheet URL. Ensure the URL is correct and the sheet is accessible. Error: {exc}") from exc
    else:
        try:
            spreadsheet = client.open(spreadsheet_name)
        except Exception:
            spreadsheet = client.create(spreadsheet_name)

    try:
        worksheet = spreadsheet.worksheet(sheet_name)
    except Exception:
        worksheet = spreadsheet.add_worksheet(title=sheet_name, rows=1000, cols=30)

    return spreadsheet, worksheet


def _ensure_headers(worksheet, headers: list[str]) -> None:
    if not worksheet.row_values(1):
        worksheet.append_row(["Timestamp"] + headers)


def append_record(form_name: str, category: str, fields: dict[str, str], access_token: str | None = None, target_sheet_url: str | None = None) -> str:
    del form_name
    client = _get_client(access_token)
    try:
        spreadsheet, worksheet = _get_or_create_worksheet(client, SPREADSHEET_NAME, category, target_sheet_url)
        _ensure_headers(worksheet, list(fields.keys()))
        row = [datetime.now().strftime("%d-%m-%Y %H:%M")] + list(fields.values())
        worksheet.append_row(row, value_input_option="USER_ENTERED")
        return spreadsheet.url
    except Exception as exc:
        error_msg = str(exc).lower()
        if "refresh" in error_msg or "credentials" in error_msg or "token" in error_msg:
            raise RuntimeError(f"Google access token expired or invalid. Please reconnect. Error: {exc}") from exc
        raise RuntimeError(f"Failed to append record to Google Sheets. Error: {exc}") from exc
