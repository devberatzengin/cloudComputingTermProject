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

app = FastAPI(title="CloudGuard Pro - Integrated Backup System")

# Initialize PostgreSQL (Auth)
Base.metadata.create_all(bind=engine)

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

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    # Read file content
    content = await file.read()
    
    # Correct call to storage_manager
    result = await storage_manager.upload_file(
        file_content=content, 
        destination_blob_name=file.filename, 
        content_type=file.content_type,
        uploader_email=current_user.email
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    
    await log_activity("Upload", f"{file.filename} yedeklendi. (Kullanıcı: {current_user.email})")
    return result

@app.get("/files")
async def list_files(current_user: User = Depends(get_current_user)):
    result = await storage_manager.list_files()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
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
    current_user: User = Depends(get_current_user)
):
    result = await storage_manager.download_file(name, generation)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    
    await log_activity("Restore", f"{name} kurtarıldı. (Kullanıcı: {current_user.email})")
    
    return StreamingResponse(
        io.BytesIO(result["content"]),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={name}"}
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
    
    action_type = "Permanent Delete" if purge else "Delete"
    await log_activity(action_type, f"{name} silindi. (Kullanıcı: {current_user.email})")
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
