import logging
import requests
from datetime import datetime
from .base import BaseIntegration

logger = logging.getLogger(__name__)

class SlackIntegration(BaseIntegration):
    async def handle_event(self, event_name: str, payload: dict, config: dict, credentials: dict) -> None:
        if event_name != "submission.created":
            return
            
        webhook_url = config.get("webhook_url")
        if not webhook_url:
            raise ValueError("Slack webhook URL is missing from integration configuration.")
            
        category = payload.get("category", "Custom")
        fields = payload.get("fields", {})
        
        # Build Slack message blocks
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"🎉 New Submission: {category}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Details:*"
                }
            }
        ]
        
        fields_text = ""
        for key, value in fields.items():
            # Format each field nicely
            fields_text += f"*{key}:* {value}\n"
            
        if fields_text:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": fields_text
                }
            })
            
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"Submitted via Voice2Form on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                }
            ]
        })
        
        slack_payload = {
            "blocks": blocks
        }
        
        try:
            response = requests.post(webhook_url, json=slack_payload, timeout=10)
            response.raise_for_status()
            logger.info("Successfully sent Slack notification.")
        except Exception as e:
            logger.error(f"Failed to send Slack notification: {e}")
            raise RuntimeError(f"Failed to send Slack notification: {e}") from e

    async def test_connection(self, config: dict, credentials: dict) -> bool:
        webhook_url = config.get("webhook_url")
        if not webhook_url:
            return False
            
        slack_payload = {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "✅ *Voice2Form: Slack connection successful!*"
                    }
                }
            ]
        }
        
        try:
            response = requests.post(webhook_url, json=slack_payload, timeout=5)
            response.raise_for_status()
            return True
        except Exception as e:
            logger.error(f"Slack test connection failed: {e}")
            return False
