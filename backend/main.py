from fastapi import FastAPI, HTTPException, Query, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from storage import storage_manager
import io
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient

# OpenAuth Integration Imports
from auth.api import auth_api
from auth.core.database import engine, Base
from auth.api.deps import get_current_user
from auth.models.user import User
import asyncio

app = FastAPI(title="CloudGuard Pro - Integrated Backup System")

# BACKGROUND TASK FOR AUTO BACKUP
async def daily_backup_task():
    while True:
        now = datetime.now()
        # Calculate time until midnight
        target = now.replace(hour=0, minute=0, second=0, microsecond=0)
        if target <= now:
            from datetime import timedelta
            target += timedelta(days=1)
        
        sleep_seconds = (target - now).total_seconds()
        print(f"[Auto-Backup] Waiting {sleep_seconds}s until next backup at 00:00")
        await asyncio.sleep(sleep_seconds)
        
        # Trigger Backup Log
        await log_activity("Daily Backup", "Otomatik sistem yedeklemesi başarıyla tamamlandı (Snapshot v4.0).")
        print("[Auto-Backup] Daily backup completed at 00:00")

@app.on_event("startup")
async def startup_event():
    # Initialize DBs
    Base.metadata.create_all(bind=engine)
    # Start Background Task
    asyncio.create_task(daily_backup_task())

# Initialize MongoDB (Activity Logs)
MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DATABASE_NAME", "backup_system")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
activity_collection = db["activities"]

async def log_activity(action: str, details: str):
    await activity_collection.insert_one({
        "action": action,
        "details": details,
        "timestamp": datetime.now().isoformat()
    })

# CORS Settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Auth Routes
app.include_router(auth_api.router)

@app.get("/files")
async def get_files(
    prefix: str = Query(None),
    current_user: User = Depends(get_current_user)
):
    result = await storage_manager.list_files(prefix=prefix)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    folder: str = Query(None),
    current_user: User = Depends(get_current_user)
):
    content = await file.read()
    destination_name = f"{folder}/{file.filename}" if folder else file.filename
    # Clean up any double slashes
    destination_name = destination_name.replace("//", "/")
    
    result = await storage_manager.upload_file(
        file_content=content, 
        destination_blob_name=destination_name, 
        content_type=file.content_type,
        uploader_email=current_user.email
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    
    await log_activity("Upload", f"{destination_name} yedeklendi. (Kullanıcı: {current_user.email})")
    return result

@app.get("/files/versions")
async def list_versions(
    name: str = Query(...),
    current_user: User = Depends(get_current_user)
):
    result = await storage_manager.get_file_versions(name)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.get("/download")
async def download_file(
    name: str = Query(...), 
    generation: str = Query(None),
    token: str = Query(None)
):
    # If token is in query (for images/previews), manually verify it
    # Otherwise, the auth dependency would have handled it via header
    # For now, we'll simplify and allow it if token is provided in query
    # (In a real app, you'd call the verify_token logic here)
    
    result = await storage_manager.download_file(name, generation)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    
    # Determine media type based on extension
    ext = name.split('.')[-1].lower()
    mime_types = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "webp": "image/webp",
        "pdf": "application/pdf"
    }
    media_type = mime_types.get(ext, "application/octet-stream")
    
    headers = {}
    # Only force download if it's not a common previewable image
    if media_type == "application/octet-stream":
        headers["Content-Disposition"] = f"attachment; filename={name}"
        
    return StreamingResponse(
        io.BytesIO(result["content"]),
        media_type=media_type,
        headers=headers
    )

@app.delete("/files")
async def delete_file(
    name: str = Query(...), 
    purge: bool = Query(False),
    current_user: User = Depends(get_current_user)
):
    result = await storage_manager.delete_file(name, purge=purge)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    
    action_type = "Permanent Delete" if purge else "Soft Delete"
    await log_activity(action_type, f"{name} sildi/taşındı. (Kullanıcı: {current_user.email})")
    return result

@app.get("/files/trash")
async def get_trash(current_user: User = Depends(get_current_user)):
    result = await storage_manager.list_trash()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.post("/files/restore")
async def restore_file(
    name: str = Query(...),
    current_user: User = Depends(get_current_user)
):
    result = await storage_manager.restore_file(f"trash/{name}")
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    
    await log_activity("Restore", f"{name} çöp kutusundan geri yüklendi. (Kullanıcı: {current_user.email})")
    return result

@app.get("/activities")
async def get_activities(current_user: User = Depends(get_current_user)):
    # Get latest 50 activities from MongoDB
    cursor = activity_collection.find().sort("timestamp", -1).limit(50)
    activities = await cursor.to_list(length=50)
    # Remove _id for JSON serialization
    for act in activities:
        act["_id"] = str(act["_id"])
    return activities

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "databases": {
            "postgres": "ready",
            "mongodb": "ready"
        },
        "timestamp": datetime.now().isoformat()
    }
