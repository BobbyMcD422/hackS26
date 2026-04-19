from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
import uuid

app = FastAPI()
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/upload-ics")
async def upload_ics(file: UploadFile = File(...)):
    if not file.filename.endswith(".ics"):
        raise HTTPException(status_code=400, detail="Only .ics files allowed")

    file_id = f"{uuid.uuid4()}.ics"
    target = UPLOAD_DIR / file_id

    contents = await file.read()
    target.write_bytes(contents)

    return {
        "id": file_id,
        "url": f"/api/ics/{file_id}"
    }

@app.get("/api/ics/{file_id}")
def get_ics(file_id: str):
    target = UPLOAD_DIR / file_id
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(target, media_type="text/calendar", filename=file_id)
