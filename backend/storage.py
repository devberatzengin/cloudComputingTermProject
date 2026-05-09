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

    async def list_files(self):
        """Lists active blobs and calculates total storage including all versions."""
        try:
            active_blobs = self.client.list_blobs(self.bucket_name, versions=False)
            file_list = []
            for b in active_blobs:
                file_list.append({
                    "name": b.name,
                    "size": b.size,
                    "updated": b.updated,
                    "generation": b.generation,
                    "is_latest": True
                })

            all_blobs = self.client.list_blobs(self.bucket_name, versions=True)
            total_size = sum(b.size for b in all_blobs if b.size)
            total_count = len(file_list)
            
            return {
                "success": True,
                "files": file_list,
                "stats": {
                    "total_count": total_count,
                    "total_size_bytes": total_size
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
        """Deletes a blob. If purge is True, deletes all versions."""
        try:
            if purge:
                # List all generations of the blob and delete each one
                blobs = self.client.list_blobs(self.bucket_name, versions=True, prefix=blob_name)
                for b in blobs:
                    if b.name == blob_name:
                        b.delete()
            else:
                # Regular delete (creates a delete marker in versioned buckets)
                blob = self.bucket.blob(blob_name)
                blob.delete()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

# Global storage manager instance
storage_manager = GCSManager()
