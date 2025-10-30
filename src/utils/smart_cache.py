import redis
import json
import pickle
import hashlib
from datetime import datetime, timedelta
from typing import Any, Optional, Dict
from functools import wraps
import os

class SmartCache:
    def __init__(self):
        self.redis_client = None
        self.setup_redis()
    
    def setup_redis(self):
        try:
            redis_url = os.getenv('REDIS_URL')
            if redis_url:
                self.redis_client = redis.from_url(redis_url)
                self.redis_client.ping()
        except Exception:
            self.redis_client = None
    
    def cache_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate cache key from function arguments"""
        key_data = f"{prefix}:{str(args)}:{str(sorted(kwargs.items()))}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached data"""
        if not self.redis_client:
            return None
        try:
            data = self.redis_client.get(key)
            return pickle.loads(data) if data else None
        except Exception:
            return None
    
    def set(self, key: str, value: Any, ttl: int = 3600):
        """Set cached data with TTL"""
        if not self.redis_client:
            return
        try:
            self.redis_client.setex(key, ttl, pickle.dumps(value))
        except Exception:
            pass
    
    def delete(self, pattern: str):
        """Delete keys matching pattern"""
        if not self.redis_client:
            return
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                self.redis_client.delete(*keys)
        except Exception:
            pass

# Global cache instance
smart_cache = SmartCache()

def cache_result(prefix: str, ttl: int = 3600):
    """Decorator for caching function results"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache_key = smart_cache.cache_key(prefix, *args, **kwargs)
            
            # Try cache first
            cached_result = smart_cache.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            smart_cache.set(cache_key, result, ttl)
            return result
        return wrapper
    return decorator