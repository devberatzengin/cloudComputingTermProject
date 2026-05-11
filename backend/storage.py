import os
from google.cloud import storage
from google.api_core import exceptions
import io
from datetime import datetime

class GCSManager:
    def __init__(self):
        self.bucket_name = os.getenv("GCS_BUCKET_NAME", "bulut_proje_bucket")
        self.client = storage.Client()
        self.bucket = self.client.bucket(self.bucket_name)

    async def list_files(self, prefix=None):
        try:
            # Get only active blobs (non-versioned)
            blobs = list(self.client.list_blobs(self.bucket_name, prefix=prefix, delimiter='/'))
            
            items = []
            # Add folders
            for p in blobs:
                # list_blobs with delimiter returns folders in prefixes
                pass
            
            # prefixes is a property that populates after list()
            prefixes = self.client.list_blobs(self.bucket_name, prefix=prefix, delimiter='/').prefixes
            for p in prefixes:
                items.append({
                    "name": p.split('/')[-2],
                    "full_path": p,
                    "is_folder": True
                })

            # Add files
            for b in blobs:
                if b.name == prefix or b.name.endswith('/'): continue
                if b.name.startswith("trash/") or b.name.startswith("backups/"): continue
                
                items.append({
                    "name": b.name.split('/')[-1],
                    "full_path": b.name,
                    "size": b.size,
                    "updated": b.updated,
                    "is_folder": False
                })

            # Calculate total size of ACTIVE files only
            active_blobs = list(self.client.list_blobs(self.bucket_name, versions=False))
            total_size = sum(b.size for b in active_blobs if b.size)
            total_count = len([b for b in active_blobs if not b.name.startswith("trash/") and not b.name.startswith("backups/")])
            
            return {
                "success": True, 
                "items": items,
                "stats": {
                    "total_size_bytes": total_size,
                    "total_count": total_count
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def upload_file(self, file_content, destination_blob_name, content_type=None, uploader_email=None):
        try:
            blob = self.bucket.blob(destination_blob_name)
            if uploader_email:
                blob.metadata = {"uploader": uploader_email}
            blob.upload_from_string(file_content, content_type=content_type)
            return {"success": True, "name": destination_blob_name}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def download_file(self, blob_name, generation=None):
        try:
            blob = self.bucket.blob(blob_name, generation=generation)
            content = blob.download_as_bytes()
            return {"success": True, "content": content}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_file_versions(self, blob_name):
        try:
            blobs = self.client.list_blobs(self.bucket_name, prefix=blob_name, versions=True)
            versions = []
            for b in blobs:
                versions.append({
                    "generation": b.generation,
                    "updated": b.updated,
                    "size": b.size,
                    "uploader": b.metadata.get("uploader") if b.metadata else "Unknown"
                })
            # Sort by update time
            versions.sort(key=lambda x: x["updated"], reverse=True)
            return {"success": True, "versions": versions}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def delete_file(self, blob_name, purge=False):
        try:
            if purge:
                # Permanent delete all versions
                blobs = self.client.list_blobs(self.bucket_name, versions=True, prefix=blob_name)
                for b in blobs:
                    if b.name == blob_name:
                        b.delete()
                return {"success": True}
            else:
                # Soft delete: move to trash prefix
                source_blob = self.bucket.blob(blob_name)
                trash_name = f"trash/{blob_name}"
                self.bucket.copy_blob(source_blob, self.bucket, trash_name)
                source_blob.delete()
                return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def list_trash(self):
        try:
            blobs = self.client.list_blobs(self.bucket_name, prefix="trash/")
            trash_list = []
            for b in blobs:
                if b.name == "trash/": continue
                trash_list.append({
                    "name": b.name.replace("trash/", ""),
                    "full_path": b.name,
                    "size": b.size,
                    "updated": b.updated
                })
            return {"success": True, "files": trash_list}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def restore_file(self, trash_path):
        try:
            source_blob = self.bucket.blob(trash_path)
            new_name = trash_path.replace("trash/", "")
            self.bucket.copy_blob(source_blob, self.bucket, new_name)
            source_blob.delete()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def create_snapshot(self):
        try:
            blobs = list(self.client.list_blobs(self.bucket_name, versions=False))
            copied_count = 0
            for b in blobs:
                if b.name.startswith("trash/") or b.name.startswith("backups/"): continue
                
                # Yeni bir SÜRÜM (Version) oluşturmak için içeriği alıp sistem imzasıyla tekrar üzerine yazıyoruz
                content = b.download_as_bytes()
                new_blob = self.bucket.blob(b.name)
                new_blob.metadata = {"uploader": "Sistem Otomatik Yedekleme"}
                new_blob.upload_from_string(content, content_type=b.content_type)
                
                copied_count += 1
            return {"success": True, "copied_count": copied_count}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_global_analytics(self):
        try:
            blobs = list(self.client.list_blobs(self.bucket_name, versions=False))
            type_counts = {"Images": 0, "PDFs": 0, "Docs": 0, "Others": 0}
            type_sizes = {"Images": 0, "PDFs": 0, "Docs": 0, "Others": 0}
            largest_files = []
            
            for b in blobs:
                if b.name.startswith("trash/") or b.name.startswith("backups/"): continue
                ext = b.name.split('.')[-1].lower()
                category = "Others"
                if ext in ['png', 'jpg', 'jpeg', 'gif', 'webp']: category = "Images"
                elif ext == 'pdf': category = "PDFs"
                elif ext in ['doc', 'docx', 'txt', 'md']: category = "Docs"
                
                type_counts[category] += 1
                type_sizes[category] += b.size or 0
                largest_files.append({"name": b.name, "size": b.size or 0})

            largest_files.sort(key=lambda x: x["size"], reverse=True)
            return {
                "success": True,
                "distribution": {"counts": type_counts, "sizes": type_sizes},
                "top_files": largest_files[:5],
                "total_active_size": sum(type_sizes.values())
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

# Global storage manager instance
storage_manager = GCSManager()
