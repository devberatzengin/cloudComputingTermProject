from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from storage import storage_manager

app = FastAPI(title="Smart Backup & Recovery API")

# CORS Settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Smart Backup & Recovery API is running"}

@app.post("/upload")
async def upload_backup(file: UploadFile = File(...)):
    content = await file.read()
    result = await storage_manager.upload_file(
        file_content=content,
        destination_blob_name=file.filename,
        content_type=file.content_type
    )
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result

@app.get("/files")
async def list_backups():
    return await storage_manager.list_files()

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
