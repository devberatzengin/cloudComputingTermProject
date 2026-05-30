import os
import random
import time
from datetime import datetime, timedelta, timezone
from google.cloud import monitoring_v3
from google.protobuf import duration_pb2

class GCMonitoringManager:
    def __init__(self):
        self.project_id = os.getenv("GCP_PROJECT_ID")
        self.bucket_name = os.getenv("GCS_BUCKET_NAME")
        
    def _generate_mock_data(self):
        """Generates realistic monitoring data for demo purposes when GCP is not reachable/empty."""
        data_list = []
        # Seed by project_id to have a deterministic but realistic pattern
        seed_val = sum(ord(c) for c in (self.project_id or "cloudguard"))
        random.seed(seed_val)
        
        now_utc = datetime.now(timezone.utc)
        for i in range(29, -1, -1):
            d = (now_utc - timedelta(days=i)).date()
            is_weekend = d.weekday() >= 5
            
            # Base requests
            base_read = 75 if is_weekend else 280
            base_write = 12 if is_weekend else 55
            
            # Add some random noise
            read_req = int(base_read + random.normalvariate(0, base_read * 0.15))
            write_req = int(base_write + random.normalvariate(0, base_write * 0.15))
            
            read_req = max(0, read_req)
            write_req = max(0, write_req)
            
            # Errors (mostly 4xx client side like 404s, very few 5xx server side)
            client_err = 0
            if random.random() < 0.35:
                client_err = random.randint(1, 5)
                
            server_err = 0
            if random.random() < 0.08:
                server_err = 1
                
            total_req = read_req + write_req
            
            data_list.append({
                "date": d.isoformat(),
                "read_requests": read_req,
                "write_requests": write_req,
                "client_errors": client_err,
                "server_errors": server_err,
                "total_requests": total_req
            })
        return data_list

    async def get_gcs_metrics(self):
        """
        Queries Cloud Monitoring for request count and error metrics of the bucket.
        Falls back to mock data if the API call fails or returns empty results.
        """
        if not self.project_id or not self.bucket_name:
            print("[Monitoring] Project ID or Bucket name is missing. Using mock data.")
            return {
                "success": True,
                "is_mock": True,
                "data": self._generate_mock_data(),
                "project_id": self.project_id or "N/A",
                "bucket_name": self.bucket_name or "N/A"
            }

        try:
            client = monitoring_v3.MetricServiceClient()
            project_name = f"projects/{self.project_id}"
            
            # Query interval (last 30 days)
            now = time.time()
            seconds = int(now)
            nanos = int((now - seconds) * 10**9)
            
            interval = monitoring_v3.TimeInterval(
                {
                    "end_time": {"seconds": seconds, "nanos": nanos},
                    "start_time": {"seconds": seconds - 30 * 24 * 3600, "nanos": nanos},
                }
            )

            # Filter for GCS Bucket request count metric
            filter_str = (
                f'metric.type = "storage.googleapis.com/api/request_count" '
                f'AND resource.type = "gcs_bucket" '
                f'AND resource.labels.bucket_name = "{self.bucket_name}"'
            )

            # Aggregate daily (86400 seconds)
            aggregation = monitoring_v3.Aggregation(
                alignment_period=duration_pb2.Duration(seconds=86400),
                per_series_aligner=monitoring_v3.Aggregation.Aligner.ALIGN_SUM,
                cross_series_reducer=monitoring_v3.Aggregation.Reducer.REDUCE_SUM,
                group_by_fields=["metric.label.method", "metric.label.response_code"]
            )

            # Execute API call. Run in run_in_executor since GCM client is synchronous
            import asyncio
            loop = asyncio.get_event_loop()
            
            def call_api():
                return client.list_time_series(
                    request={
                        "name": project_name,
                        "filter": filter_str,
                        "interval": interval,
                        "view": monitoring_v3.ListTimeSeriesRequest.TimeSeriesView.FULL,
                        "aggregation": aggregation,
                    }
                )
                
            results = await loop.run_in_executor(None, call_api)
            
            # Prepopulate daily records for last 30 days to avoid missing date gaps
            daily_map = {}
            now_utc = datetime.now(timezone.utc)
            for i in range(30):
                d = (now_utc - timedelta(days=i)).date()
                d_str = d.isoformat()
                daily_map[d_str] = {
                    "date": d_str,
                    "read_requests": 0,
                    "write_requests": 0,
                    "client_errors": 0,
                    "server_errors": 0,
                    "total_requests": 0
                }

            has_data = False
            for result in results:
                has_data = True
                method = result.metric.labels.get("method", "").lower()
                response_code = result.metric.labels.get("response_code", "").lower()
                
                # Classify method: read vs write
                # Common GCS methods: ReadObject, GetObjectMetadata, ListObjects, WriteObject, ComposeObjects, etc.
                is_read = any(kw in method for kw in ["read", "get", "list"])
                
                # Classify response code: client error (4xx) vs server error (5xx)
                is_client_error = response_code.startswith("4") or response_code in ["not_found", "bad_request", "unauthorized", "forbidden", "precondition_failed"]
                is_server_error = response_code.startswith("5") or response_code in ["internal_server_error", "service_unavailable"]

                for point in result.points:
                    pt_time = point.interval.end_time
                    # Get Date string in UTC
                    pt_date = datetime.fromtimestamp(pt_time.timestamp(), tz=timezone.utc).date()
                    pt_date_str = pt_date.isoformat()
                    
                    if pt_date_str in daily_map:
                        val = point.value.int64_value
                        daily_map[pt_date_str]["total_requests"] += val
                        
                        if is_read:
                            daily_map[pt_date_str]["read_requests"] += val
                        else:
                            daily_map[pt_date_str]["write_requests"] += val
                            
                        if is_client_error:
                            daily_map[pt_date_str]["client_errors"] += val
                        elif is_server_error:
                            daily_map[pt_date_str]["server_errors"] += val

            # If the GCM API returned empty results, fallback to mock data
            if not has_data:
                print(f"[Monitoring] No GCM data found for bucket {self.bucket_name}. Using mock data.")
                return {
                    "success": True,
                    "is_mock": True,
                    "data": self._generate_mock_data(),
                    "project_id": self.project_id,
                    "bucket_name": self.bucket_name
                }
            
            # Format and sort from oldest to newest for charts
            sorted_data = [daily_map[k] for k in sorted(daily_map.keys())]
            return {
                "success": True,
                "is_mock": False,
                "data": sorted_data,
                "project_id": self.project_id,
                "bucket_name": self.bucket_name
            }

        except Exception as e:
            print(f"[Monitoring] Failed to query GCM API: {e}. Falling back to mock data.")
            return {
                "success": True,
                "is_mock": True,
                "error_details": str(e),
                "data": self._generate_mock_data(),
                "project_id": self.project_id,
                "bucket_name": self.bucket_name
            }

# Global monitoring manager instance
monitoring_manager = GCMonitoringManager()
