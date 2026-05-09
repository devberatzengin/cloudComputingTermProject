import os
from google.cloud import storage
from dotenv import load_dotenv

load_dotenv()

class GCSManager:
    def __init__(self):
        self.bucket_name = os.getenv("GCS_BUCKET_NAME")
        self.project_id = os.getenv("GCP_PROJECT_ID")
        self.credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        
        # Initialize the storage client
        self.client = storage.Client.from_service_account_json(self.credentials_path)
        self.bucket = self.client.bucket(self.bucket_name)

    async def upload_file(self, file_content, destination_blob_name, content_type, uploader_email="Unknown"):
        """Uploads a file to the bucket with uploader metadata."""
        try:
            blob = self.bucket.blob(destination_blob_name)
            blob.metadata = {"uploader": uploader_email}
            blob.upload_from_string(file_content, content_type=content_type)
            
            return {
                "success": True,
                "name": destination_blob_name,
                "generation": blob.generation,
                "url": f"https://storage.googleapis.com/{self.bucket_name}/{destination_blob_name}"
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def list_files(self, prefix=None):
        """Lists active blobs and common prefixes (folders) in a hierarchical way."""
        try:
            # We use delimiter to get "folders"
            blobs = self.client.list_blobs(self.bucket_name, prefix=prefix, delimiter='/')
            
            # This is tricky in GCS: 
            # - blobs contains files in the current folder
            # - blobs.prefixes contains subfolders
            
            file_list = []
            
            # First, iterate to consume the generator and populate prefixes
            for b in blobs:
                # If we have a prefix like "trash/", we ignore it here
                if b.name.startswith("trash/"): continue
                
                file_list.append({
                    "name": b.name.replace(prefix if prefix else "", ""),
                    "full_path": b.name,
                    "size": b.size,
                    "updated": b.updated,
                    "generation": b.generation,
                    "is_folder": False
                })

            # Get virtual folders (prefixes)
            folder_list = []
            for p in blobs.prefixes:
                if p == "trash/": continue
                folder_list.append({
                    "name": p.replace(prefix if prefix else "", "").rstrip("/"),
                    "full_path": p,
                    "is_folder": True
                })

            # Calculate total size globally (including all versions and trash)
            all_blobs = self.client.list_blobs(self.bucket_name, versions=True)
            total_size = sum(b.size for b in all_blobs if b.size)
            
            # Count total active files (excluding those in trash)
            active_blobs = self.client.list_blobs(self.bucket_name, versions=False)
            total_count = len([b for b in active_blobs if not b.name.startswith("trash/")])
            
            return {
                "success": True,
                "items": folder_list + file_list,
                "stats": {
                    "total_size_bytes": total_size,
                    "total_count": total_count
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_file_versions(self, blob_name):
        """Lists all versions with uploader info."""
        try:
            blobs = self.client.list_blobs(self.bucket_name, versions=True, prefix=blob_name)
            versions = []
            for b in blobs:
                if b.name == blob_name:
                    # GCS stores metadata for each version
                    uploader = b.metadata.get("uploader", "System") if b.metadata else "System"
                    versions.append({
                        "generation": b.generation,
                        "updated": b.updated,
                        "size": b.size,
                        "uploader": uploader
                    })
            return {"success": True, "versions": sorted(versions, key=lambda x: x['generation'], reverse=True)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def download_file(self, blob_name, generation=None):
        """Downloads a blob from the bucket."""
        try:
            blob = self.bucket.blob(blob_name, generation=generation)
            content = blob.download_as_bytes()
            return {"success": True, "content": content}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def delete_file(self, blob_name, purge=False):
        """Soft delete (move to trash) or permanent purge."""
        try:
            if purge:
                # Permanent delete all versions
                blobs = self.client.list_blobs(self.bucket_name, versions=True, prefix=blob_name)
                for b in blobs:
                    if b.name == blob_name:
                        b.delete()
            else:
                # Soft delete: Rename/Move to trash/ prefix
                source_blob = self.bucket.blob(blob_name)
                new_name = f"trash/{blob_name}"
                self.bucket.copy_blob(source_blob, self.bucket, new_name)
                source_blob.delete()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def list_trash(self):
        """Lists files in the trash prefix."""
        try:
            blobs = self.client.list_blobs(self.bucket_name, prefix="trash/")
            trash_list = []
            for b in blobs:
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
        """Restores a file from trash back to root."""
        try:
            source_blob = self.bucket.blob(trash_path)
            new_name = trash_path.replace("trash/", "")
            self.bucket.copy_blob(source_blob, self.bucket, new_name)
            source_blob.delete()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

# Global storage manager instance
storage_manager = GCSManager()
