import logging
from datetime import datetime
from config import SPREADSHEET_NAME
from .base import BaseIntegration

logger = logging.getLogger(__name__)

class GoogleSheetsIntegration(BaseIntegration):
    def _get_client(self, access_token: str | None = None):
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

    def _get_or_create_worksheet(self, client, spreadsheet_name: str, sheet_name: str, target_sheet_url: str | None = None):
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

    def _ensure_headers(self, worksheet, headers: list[str]) -> None:
        if not worksheet.row_values(1):
            worksheet.append_row(["Timestamp"] + headers)

    async def handle_event(self, event_name: str, payload: dict, config: dict, credentials: dict) -> None:
        if event_name != "submission.created":
            return
            
        access_token = credentials.get("access_token")
        target_sheet_url = config.get("target_sheet_url")
        category = payload.get("category", "Custom")
        fields = payload.get("fields", {})

        client = self._get_client(access_token)
        try:
            spreadsheet, worksheet = self._get_or_create_worksheet(client, SPREADSHEET_NAME, category, target_sheet_url)
            self._ensure_headers(worksheet, list(fields.keys()))
            row = [datetime.now().strftime("%d-%m-%Y %H:%M")] + list(fields.values())
            worksheet.append_row(row, value_input_option="USER_ENTERED")
            logger.info(f"Successfully appended record to Google Sheet: {spreadsheet.url}")
        except Exception as exc:
            error_msg = str(exc).lower()
            if "refresh" in error_msg or "credentials" in error_msg or "token" in error_msg:
                raise RuntimeError(f"Google access token expired or invalid. Please reconnect. Error: {exc}") from exc
            raise RuntimeError(f"Failed to append record to Google Sheets. Error: {exc}") from exc

    async def test_connection(self, config: dict, credentials: dict) -> bool:
        try:
            client = self._get_client(credentials.get("access_token"))
            # Just test if we can get the profile or open the sheet
            target_sheet_url = config.get("target_sheet_url")
            if target_sheet_url:
                client.open_by_url(target_sheet_url)
            return True
        except Exception as e:
            logger.error(f"Google Sheets test connection failed: {e}")
            return False
