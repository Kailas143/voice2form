import os
import sys

# Ensure we can import config
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import GOOGLE_OAUTH_CREDENTIALS_PATH, GOOGLE_OAUTH_AUTHORIZED_USER_PATH
import gspread

def main():
    print("Starting OAuth setup...")
    print(f"Looking for credentials at: {GOOGLE_OAUTH_CREDENTIALS_PATH}")
    if not os.path.exists(GOOGLE_OAUTH_CREDENTIALS_PATH):
        print("Error: Credentials file not found!")
        return

    print("This will open a browser window to authenticate with Google.")
    try:
        gc = gspread.oauth(
            credentials_filename=GOOGLE_OAUTH_CREDENTIALS_PATH,
            authorized_user_filename=GOOGLE_OAUTH_AUTHORIZED_USER_PATH
        )
        print("Authentication successful!")
        print(f"Authorized user token saved to: {GOOGLE_OAUTH_AUTHORIZED_USER_PATH}")
        print("You can now start the backend server.")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
