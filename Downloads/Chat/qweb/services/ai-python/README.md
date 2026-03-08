# AI/Python Service

FastAPI microservice for:
- AI endpoints (`smart-reply`, `voice-to-text`)
- E2EE public key storage
- Room membership authorization
- Encrypted message metadata persistence

## Run
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
