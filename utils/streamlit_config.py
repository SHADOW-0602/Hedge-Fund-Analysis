import os
import streamlit as st
from typing import Optional, Dict, Any, List

def get_config(key: str, default: Any = None) -> Any:
    """Get configuration from Streamlit secrets or environment variables"""
    try:
        return st.secrets[key]
    except (KeyError, FileNotFoundError):
        return os.getenv(key, default)

class StreamlitConfig:
    """Streamlit-optimized configuration management"""
    
    # ==================== API KEYS ====================
    @property
    def FINNHUB_API_KEY(self) -> Optional[str]:
        return get_config('FINNHUB_API_KEY')
    
    @property
    def POLYGON_API_KEY(self) -> Optional[str]:
        return get_config('POLYGON_API_KEY')
    
    @property
    def ALPHA_VANTAGE_API_KEY(self) -> Optional[str]:
        return get_config('ALPHA_VANTAGE_API_KEY')
    
    @property
    def TWELVE_DATA_API_KEY(self) -> Optional[str]:
        return get_config('TWELVE_DATA_API_KEY')
    
    @property
    def EODHD_API_KEY(self) -> Optional[str]:
        return get_config('EODHD_API_KEY')
    
    @property
    def NEWSAPI_KEY(self) -> Optional[str]:
        return get_config('NEWSAPI_KEY')
    
    # ==================== DATABASE ====================
    @property
    def SUPABASE_URL(self) -> Optional[str]:
        return get_config('SUPABASE_URL')
    
    @property
    def SUPABASE_ANON_KEY(self) -> Optional[str]:
        return get_config('SUPABASE_ANON_KEY')
    
    @property
    def SUPABASE_SERVICE_ROLE_KEY(self) -> Optional[str]:
        return get_config('SUPABASE_SERVICE_ROLE_KEY')
    
    # ==================== CACHE ====================
    @property
    def REDIS_URL(self) -> Optional[str]:
        return get_config('REDIS_URL')
    
    @property
    def REDIS_PASSWORD(self) -> Optional[str]:
        return get_config('REDIS_PASSWORD')
    
    @property
    def REDIS_HOST(self) -> Optional[str]:
        return get_config('REDIS_HOST')
    
    @property
    def REDIS_PORT(self) -> int:
        return int(get_config('REDIS_PORT', '6379'))
    
    # ==================== BROKERAGE ====================
    @property
    def PLAID_CLIENT_ID(self) -> Optional[str]:
        return get_config('PLAID_CLIENT_ID')
    
    @property
    def PLAID_SECRET(self) -> Optional[str]:
        return get_config('PLAID_SECRET')
    
    @property
    def PLAID_ENVIRONMENT(self) -> str:
        return get_config('PLAID_ENVIRONMENT', 'sandbox')
    
    @property
    def SNAPTRADE_CLIENT_ID(self) -> Optional[str]:
        return get_config('SNAPTRADE_CLIENT_ID')
    
    @property
    def SNAPTRADE_SECRET(self) -> Optional[str]:
        return get_config('SNAPTRADE_SECRET')
    
    # ==================== EMAIL ====================
    @property
    def EMAIL_SMTP_SERVER(self) -> Optional[str]:
        return get_config('EMAIL_SMTP_SERVER')
    
    @property
    def EMAIL_USERNAME(self) -> Optional[str]:
        return get_config('EMAIL_USERNAME')
    
    @property
    def EMAIL_PASSWORD(self) -> Optional[str]:
        return get_config('EMAIL_PASSWORD')
    
    # ==================== SECURITY ====================
    @property
    def SECRET_KEY(self) -> str:
        return get_config('SECRET_KEY', 'default_secret_key')
    
    @property
    def JWT_SECRET_KEY(self) -> str:
        return get_config('JWT_SECRET_KEY', 'default_jwt_key')

# Global config instance
config = StreamlitConfig()