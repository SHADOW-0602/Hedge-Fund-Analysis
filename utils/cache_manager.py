import redis
import json
import pickle
from typing import Any, Optional
from datetime import timedelta
import hashlib
from utils.config import Config

class CacheManager:
    def __init__(self):
        self.redis_client = None
        if Config.REDIS_URL:
            try:
                if Config.REDIS_URL.startswith('rediss://'):
                    # Upstash Redis with SSL
                    import urllib.parse
                    parsed = urllib.parse.urlparse(Config.REDIS_URL)
                    self.redis_client = redis.Redis(
                        host=parsed.hostname,
                        port=parsed.port,
                        password=parsed.password,
                        ssl=True,
                        ssl_cert_reqs=None,
                        decode_responses=True
                    )
                else:
                    self.redis_client = redis.from_url(Config.REDIS_URL, decode_responses=True)
                
                # Test connection
                self.redis_client.ping()
            except Exception as e:
                print(f"Redis connection failed: {e}")
                self.redis_client = None
    
    def _generate_key(self, prefix: str, identifier: str) -> str:
        """Generate cache key with prefix"""
        return f"hedge_fund:{prefix}:{identifier}"
    
    def set_user_session(self, user_id: str, session_data: dict, expire_hours: int = 24):
        """Cache user session data"""
        if not self.redis_client:
            return False
        
        try:
            key = self._generate_key("session", user_id)
            self.redis_client.setex(
                key, 
                timedelta(hours=expire_hours), 
                json.dumps(session_data)
            )
            return True
        except:
            return False
    
    def get_user_session(self, user_id: str) -> Optional[dict]:
        """Get cached user session"""
        if not self.redis_client:
            return None
        
        try:
            key = self._generate_key("session", user_id)
            data = self.redis_client.get(key)
            return json.loads(data) if data else None
        except:
            return None
    
    def set_portfolio_data(self, user_id: str, portfolio_id: str, data: dict, expire_hours: int = 6):
        """Cache portfolio analysis data"""
        if not self.redis_client:
            return False
        
        try:
            key = self._generate_key("portfolio", f"{user_id}:{portfolio_id}")
            self.redis_client.setex(
                key,
                timedelta(hours=expire_hours),
                json.dumps(data, default=str)
            )
            return True
        except:
            return False
    
    def get_portfolio_data(self, user_id: str, portfolio_id: str) -> Optional[dict]:
        """Get cached portfolio data"""
        if not self.redis_client:
            return None
        
        try:
            key = self._generate_key("portfolio", f"{user_id}:{portfolio_id}")
            data = self.redis_client.get(key)
            return json.loads(data) if data else None
        except:
            return None
    
    def set_market_data(self, symbols: list, period: str, data: Any, expire_minutes: int = 15):
        """Cache market data with short expiry"""
        if not self.redis_client:
            return False
        
        try:
            # Create hash of symbols and period for key
            symbols_hash = hashlib.md5(f"{sorted(symbols)}:{period}".encode()).hexdigest()
            key = self._generate_key("market", symbols_hash)
            
            # Use pickle for pandas DataFrames
            serialized_data = pickle.dumps(data)
            self.redis_client.setex(
                key,
                timedelta(minutes=expire_minutes),
                serialized_data
            )
            return True
        except:
            return False
    
    def get_market_data(self, symbols: list, period: str) -> Optional[Any]:
        """Get cached market data"""
        if not self.redis_client:
            return None
        
        try:
            symbols_hash = hashlib.md5(f"{sorted(symbols)}:{period}".encode()).hexdigest()
            key = self._generate_key("market", symbols_hash)
            data = self.redis_client.get(key)
            return pickle.loads(data) if data else None
        except:
            return None
    
    def set_news_data(self, symbol: str, news_data: list, expire_hours: int = 2):
        """Cache news data"""
        if not self.redis_client:
            return False
        
        try:
            key = self._generate_key("news", symbol)
            self.redis_client.setex(
                key,
                timedelta(hours=expire_hours),
                json.dumps(news_data, default=str)
            )
            return True
        except:
            return False
    
    def get_news_data(self, symbol: str) -> Optional[list]:
        """Get cached news data"""
        if not self.redis_client:
            return None
        
        try:
            key = self._generate_key("news", symbol)
            data = self.redis_client.get(key)
            return json.loads(data) if data else None
        except:
            return None
    
    def invalidate_portfolio_data(self, user_id: str, portfolio_id: str):
        """Clear specific portfolio cache"""
        if not self.redis_client:
            return
        
        try:
            key = self._generate_key("portfolio", f"{user_id}:{portfolio_id}")
            self.redis_client.delete(key)
        except:
            pass
    
    def invalidate_user_cache(self, user_id: str):
        """Clear all cache for a user"""
        if not self.redis_client:
            return
        
        try:
            pattern = self._generate_key("*", f"*{user_id}*")
            keys = self.redis_client.keys(pattern)
            if keys:
                self.redis_client.delete(*keys)
        except:
            pass
    
    def delete_cache_key(self, user_id: str, cache_key: str):
        """Delete specific cache key for a user"""
        if not self.redis_client:
            return False
        
        try:
            key = self._generate_key("portfolio", f"{user_id}:{cache_key}")
            return self.redis_client.delete(key) > 0
        except:
            return False
    
    def get_cache_stats(self) -> dict:
        """Get cache statistics"""
        if not self.redis_client:
            return {"status": "disabled"}
        
        try:
            info = self.redis_client.info()
            return {
                "status": "connected",
                "used_memory": info.get("used_memory_human", "N/A"),
                "connected_clients": info.get("connected_clients", 0),
                "total_commands_processed": info.get("total_commands_processed", 0)
            }
        except:
            return {"status": "error"}

# Global cache manager
cache_manager = CacheManager()