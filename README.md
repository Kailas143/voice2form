# Voice2Form

Voice2Form is a voice-driven form filling MVP with a FastAPI backend and a React frontend.

## Structure

- `backend/`: FastAPI API, template registry, audio pipeline, extraction services, Sheets sync
- `frontend/`: React + Vite client with the 4-step Voice2Form flow

## Backend setup

Create and activate the virtual environment:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

Set environment variables:

```bash
export SARVAM_API_KEY="your_sarvam_key"
export GEMINI_API_KEY="your_gemini_key"
export GOOGLE_CREDENTIALS_JSON='{"type":"service_account"}'
export SPREADSHEET_NAME="Voice2Form Records"
export MAX_AUDIO_MB="50"
export DEFAULT_LANGUAGE="hi-IN"
```

Run the backend:

```bash
uvicorn main:app --reload
```

## Frontend setup

Install frontend dependencies:

```bash
cd frontend
npm install
```

Optional frontend environment values:

```bash
export VITE_API_BASE_URL="http://localhost:8000"
export VITE_SHEETS_URL="https://docs.google.com/spreadsheets/..."
```

Run the frontend:

```bash
npm run dev
```

Build the frontend:

```bash
npm run build
```

## Verified locally

- Backend app import check passed from `backend/`
- Frontend production build passed from `frontend/`

