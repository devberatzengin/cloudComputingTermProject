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

    async def upload_file(self, file_content, destination_blob_name, content_type):
        """Uploads a file to the bucket."""
        try:
            blob = self.bucket.blob(destination_blob_name)
            blob.upload_from_string(file_content, content_type=content_type)
            
            # Get version ID (if versioning is enabled)
            # Generation is the GCS equivalent of S3 Version ID
            generation = blob.generation
            
            return {
                "success": True,
                "name": destination_blob_name,
                "generation": generation,
                "url": f"https://storage.googleapis.com/{self.bucket_name}/{destination_blob_name}"
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def list_files(self):
        """Lists all the blobs in the bucket."""
        try:
            blobs = self.client.list_blobs(self.bucket_name)
            return [{"name": b.name, "size": b.size, "updated": b.updated, "generation": b.generation} for b in blobs]
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

    async def delete_file(self, blob_name):
        """Deletes a blob from the bucket."""
        try:
            blob = self.bucket.blob(blob_name)
            blob.delete()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

# Global storage manager instance
storage_manager = GCSManager()
