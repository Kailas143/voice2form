import os
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")
GOOGLE_OAUTH_CREDENTIALS_PATH = os.getenv(
    "GOOGLE_OAUTH_CREDENTIALS_PATH", 
    os.path.join(os.path.dirname(__file__), "..", "client_secret_174819089028-8j35h9rm02uddbpgppsgsgk8i8vqc7k0.apps.googleusercontent.com.json")
)
GOOGLE_OAUTH_AUTHORIZED_USER_PATH = os.getenv(
    "GOOGLE_OAUTH_AUTHORIZED_USER_PATH", 
    os.path.join(os.path.dirname(__file__), "..", "authorized_user.json")
)
SPREADSHEET_NAME = os.getenv("SPREADSHEET_NAME", "V2F Records")
MAX_AUDIO_MB = int(os.getenv("MAX_AUDIO_MB", "50"))
DEFAULT_LANGUAGE = os.getenv("DEFAULT_LANGUAGE", "hi-IN")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-to-a-secure-secret-in-production-for-jwt-signing")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "43200"))
PASSWORD_RESET_EXPIRE_MINUTES = int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "30"))

ALLOWED_AUDIO_TYPES = {
    "audio/wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/ogg",
    "audio/m4a",
    "audio/webm",
}

SUPPORTED_LANGUAGES = ("hi-IN", "ta-IN", "te-IN", "ml-IN", "kn-IN", "en-IN")
MAX_TEMPLATE_FIELDS = 20
MAX_FIELD_NAME_LENGTH = 40
