from fastapi import FastAPI, HTTPException, Query, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from storage import storage_manager
from monitoring import monitoring_manager
import io
import os
import asyncio
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient

# OpenAuth service import
from auth.api import auth_api
from auth.core.database import engine, Base
from auth.api.deps import get_current_user
from auth.models.user import User

app = FastAPI(title="CloudGuard Pro - Integrated Backup System")

# Setting Turkey timezone UTC+3
LOCAL_TZ = timezone(timedelta(hours=3))

# 1. INITIALIZE DATABASES
MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DATABASE_NAME", "backup_system")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
activity_collection = db["activities"]
settings_collection = db["settings"]

# 2. GLOBAL STATE
system_settings = {
    "backup_time": "00:00",
    "storage_limit_mb": 100,
    "backup_enabled": True
}

# 3. HELPER FUNCTIONS
async def log_activity(action: str, details: str, note: str = ""):
    try:
        doc = {
            "action": action,
            "details": details,
            "timestamp": datetime.now(LOCAL_TZ).isoformat()
        }
        if note:
            doc["note"] = note
        await activity_collection.insert_one(doc)
    except Exception as e:
        print(f"[Log Error] {e}")

async def load_settings():
    global system_settings
    try:
        db_settings = await settings_collection.find_one({"type": "system"})
        if db_settings:
            db_settings.pop('_id', None)
            system_settings.update(db_settings)
            print(f"[Settings] Synced successfully: {system_settings}")
        else:
            await settings_collection.insert_one({"type": "system", **system_settings})
    except Exception as e:
        print(f"[Settings] Load error: {e}")

# 4. BACKGROUND TASK FOR AUTO BACKUP (DYNAMIC)
async def daily_backup_task():
    print(f"[Auto-Backup] Task started. Current Server Time: {datetime.now(LOCAL_TZ)}")
    last_trigger_day = None
    while True:
        try:
            now = datetime.now(LOCAL_TZ) # Server time synced to UTC+3
            time_str = system_settings.get("backup_time", "00:00")
            b_hour, b_min = map(int, time_str.split(':'))
            
            if now.second % 30 == 0:
                print(f"[Auto-Backup Check] Server: {now.strftime('%H:%M:%S')} | Target: {time_str} | Enabled: {system_settings.get('backup_enabled')}")

            if now.hour == b_hour and now.minute == b_min and last_trigger_day != now.day:
                if system_settings.get("backup_enabled", True):
                    now_str = now.isoformat()
                    system_settings["last_backup_at"] = now_str
                    await settings_collection.update_one({"type": "system"}, {"$set": {"last_backup_at": now_str}}, upsert=True)
                    
                    backup_res = await storage_manager.create_snapshot()
                    if backup_res.get("success"):
                        await log_activity("Daily Backup", f"Otomatik yedekleme tamamlandı. {backup_res['copied_count']} dosya arşivlendi.")
                    else:
                        await log_activity("Backup Error", f"Yedekleme hatası: {backup_res.get('error')}")
                    last_trigger_day = now.day
                    print(f"[Auto-Backup] TRIGGERED SUCCESS at {now_str}")
            
            await asyncio.sleep(1) # Check every second for precision
        except Exception as e:
            print(f"[Auto-Backup Loop Error] {e}")
            await asyncio.sleep(10)

@app.post("/settings/backup-now")
async def trigger_manual_backup(payload: dict = {}, current_user: User = Depends(get_current_user)):
    note = payload.get("note", "")
    now_str = datetime.now(LOCAL_TZ).isoformat()
    system_settings["last_backup_at"] = now_str
    await settings_collection.update_one({"type": "system"}, {"$set": {"last_backup_at": now_str}}, upsert=True)
    backup_res = await storage_manager.create_snapshot()
    if backup_res.get("success"):
        await log_activity(
            "Manual Backup", 
            f"{backup_res['copied_count']} dosya arşivlendi. (Kullanıcı: {current_user.email})",
            note=note
        )
    else:
        await log_activity(
            "Backup Error", 
            f"Yedekleme hatası: {backup_res.get('error')}",
            note=note
        )
    return {"success": True, "last_backup_at": now_str}

# 5. STARTUP
@app.on_event("startup")
async def startup_event():
    Base.metadata.create_all(bind=engine)
    await load_settings()
    asyncio.create_task(daily_backup_task())

# 6. MIDDLEWARE
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_api.router)

# 7. ENDPOINTS
@app.get("/settings")
async def get_settings(current_user: User = Depends(get_current_user)):
    await load_settings()
    return system_settings

@app.post("/settings")
async def update_settings(new_settings: dict, current_user: User = Depends(get_current_user)):
    global system_settings
    allowed_keys = ["backup_time", "storage_limit_mb", "backup_enabled"]
    update_data = {k: v for k, v in new_settings.items() if k in allowed_keys}
    
    system_settings.update(update_data)
    try:
        await settings_collection.update_one(
            {"type": "system"},
            {"$set": update_data},
            upsert=True
        )
        return {"success": True, "settings": system_settings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/files")
async def get_files(prefix: str = Query(None), current_user: User = Depends(get_current_user)):
    result = await storage_manager.list_files(prefix=prefix)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), folder: str = Query(None), note: str = Query(None), current_user: User = Depends(get_current_user)):
    content = await file.read()
    destination_name = f"{folder}/{file.filename}" if folder else file.filename
    destination_name = destination_name.replace("//", "/")
    
    result = await storage_manager.upload_file(
        file_content=content, 
        destination_blob_name=destination_name, 
        content_type=file.content_type,
        uploader_email=current_user.email,
        note=note
    )
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    
    await log_activity("Upload", f"{destination_name} yedeklendi. (Kullanıcı: {current_user.email})", note=note or "")
    return result

@app.get("/files/versions")
async def list_versions(name: str = Query(...), current_user: User = Depends(get_current_user)):
    result = await storage_manager.get_file_versions(name)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.get("/download")
async def download_file(name: str = Query(...), generation: str = Query(None), token: str = Query(None)):
    result = await storage_manager.download_file(name, generation)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    
    ext = name.split('.')[-1].lower()
    mime_types = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "gif": "image/gif", "webp": "image/webp", "pdf": "application/pdf"}
    media_type = mime_types.get(ext, "application/octet-stream")
    
    headers = {}
    if media_type == "application/octet-stream":
        headers["Content-Disposition"] = f"attachment; filename={name}"
        
    return StreamingResponse(io.BytesIO(result["content"]), media_type=media_type, headers=headers)

@app.get("/analytics")
async def get_analytics(current_user: User = Depends(get_current_user)):
    analytics = await storage_manager.get_global_analytics()
    if not analytics["success"]:
        raise HTTPException(status_code=500, detail=analytics["error"])
    return analytics

@app.get("/analytics/monitoring")
async def get_monitoring(current_user: User = Depends(get_current_user)):
    monitoring_data = await monitoring_manager.get_gcs_metrics()
    return monitoring_data

@app.delete("/files")
async def delete_file(name: str = Query(...), purge: bool = Query(False), current_user: User = Depends(get_current_user)):
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
async def restore_file(name: str = Query(...), current_user: User = Depends(get_current_user)):
    result = await storage_manager.restore_file(f"trash/{name}")
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
    
    await log_activity("Restore", f"{name} çöp kutusundan geri yüklendi. (Kullanıcı: {current_user.email})")
    return result

@app.get("/activities")
async def get_activities(current_user: User = Depends(get_current_user)):
    cursor = activity_collection.find().sort("timestamp", -1).limit(50)
    activities = await cursor.to_list(length=50)
    for act in activities:
        act["_id"] = str(act["_id"])
    return activities

@app.get("/health")
async def health_check():
    return {"status": "healthy", "databases": {"postgres": "ready", "mongodb": "ready"}, "timestamp": datetime.now(LOCAL_TZ).isoformat()}
