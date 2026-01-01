
import os
import json
import hashlib
import requests
import logging
from typing import Optional, Any, Dict

logger = logging.getLogger(__name__)

class CacheManager:
    """
    Manages caching of analysis results using Upstash Redis REST API.
    Uses SHA256 of the input data (options + transaction identifiers) as the cache key.
    """
    
    def __init__(self):
        self.url = os.getenv('UPSTASH_REDIS_REST_URL')
        self.token = os.getenv('UPSTASH_REDIS_REST_TOKEN')
        self.enabled = bool(self.url and self.token)
        
        if not self.enabled:
            logger.warning("Upstash Redis credentials not found. Caching is disabled.")
        else:
            logger.info("Upstash Redis caching enabled.")

    def generate_key(self, endpoint: str, data: Dict[str, Any]) -> str:
        """
        Generates a deterministic cache key based on the endpoint and input data.
        The data dictionary is serialized with sorted keys to ensuring consistent hashing.
        """
        if not data:
            data = {}
            
        # Serialize data deterministically
        serialized = json.dumps(data, sort_keys=True, default=str)
        
        # Create SHA256 hash
        data_hash = hashlib.sha256(serialized.encode('utf-8')).hexdigest()
        
        return f"analysis:{endpoint}:{data_hash}"

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves data from the cache.
        Returns deserialized JSON data or None if miss/error.
        """
        if not self.enabled:
            return None
            
        try:
            # Upstash REST: GET /get/{key}
            # Headers: Authorization: Bearer {token}
            response = requests.get(
                f"{self.url}/get/{key}",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=2.0 # Fast timeout to avoid blocking main thread
            )
            
            if response.status_code == 200:
                result = response.json()
                # Upstash response format: {"result": "serialized_string"} or {"result": null}
                cached_str = result.get('result')
                
                if cached_str:
                    logger.debug(f"Cache HIT for {key}")
                    return json.loads(cached_str)
            
            logger.debug(f"Cache MISS for {key}")
            return None
            
        except Exception as e:
            logger.error(f"Cache GET error for {key}: {e}")
            return None

    def set(self, key: str, value: Any, ttl_seconds: int = 3600) -> bool:
        """
        Stores data in the cache with a TTL (default 1 hour).
        """
        if not self.enabled:
            return False
            
        try:
            serialized_value = json.dumps(value, default=str)
            
            # Upstash REST: POST /set/{key}?EX={ttl}
            # Body: raw string value
            response = requests.post(
                f"{self.url}/set/{key}?EX={ttl_seconds}",
                headers={"Authorization": f"Bearer {self.token}"},
                data=serialized_value,
                timeout=2.0
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('result') == 'OK':
                    logger.debug(f"Cache SET success for {key} (TTL: {ttl_seconds}s)")
                    return True
            
            logger.warning(f"Cache SET failed for {key}: {response.text}")
            return False
            
        except Exception as e:
            logger.error(f"Cache SET error for {key}: {e}")
            return False

    def clear_all(self) -> bool:
        """
        Clears all keys in the database (FLUSHDB).
        """
        if not self.enabled:
            return False
            
        try:
            # Upstash REST: POST /flushdb
            response = requests.post(
                f"{self.url}/flushdb",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=5.0
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('result') == 'OK':
                    logger.info("Cache FLUSHDB success - All keys cleared")
                    return True
            
            logger.warning(f"Cache FLUSHDB failed: {response.text}")
            return False
            
        except Exception as e:
            logger.error(f"Cache FLUSHDB error: {e}")
            return False

# Global instance
cache_manager = CacheManager()