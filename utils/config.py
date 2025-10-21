import os
import logging
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from multiple locations
load_dotenv()
load_dotenv('.env')
load_dotenv(Path.home() / '.env')

class Config:
    """Comprehensive configuration management for Hedge Fund Analysis Platform"""
    
    # ==================== API KEYS ====================
    # Market Data Providers
    FINNHUB_API_KEY: Optional[str] = os.getenv('FINNHUB_API_KEY')
    POLYGON_API_KEY: Optional[str] = os.getenv('POLYGON_API_KEY')
    ALPHA_VANTAGE_API_KEY: Optional[str] = os.getenv('ALPHA_VANTAGE_API_KEY')
    TWELVE_DATA_API_KEY: Optional[str] = os.getenv('TWELVE_DATA_API_KEY')
    EODHD_API_KEY: Optional[str] = os.getenv('EODHD_API_KEY')
    
    # News and Sentiment
    NEWSAPI_KEY: Optional[str] = os.getenv('NEWSAPI_KEY')
    
    # Brokerage Integration
    SNAPTRADE_CLIENT_ID: Optional[str] = os.getenv('SNAPTRADE_CLIENT_ID')
    SNAPTRADE_SECRET: Optional[str] = os.getenv('SNAPTRADE_SECRET')
    SNAPTRADE_API_KEY: Optional[str] = os.getenv('SNAPTRADE_API_KEY')
    
    # Portfolio Management
    PORTSEIDO_API_KEY: Optional[str] = os.getenv('PORTSEIDO_API_KEY')
    
    # ==================== DATABASE ====================
    SUPABASE_URL: Optional[str] = os.getenv('SUPABASE_URL')
    SUPABASE_ANON_KEY: Optional[str] = os.getenv('SUPABASE_ANON_KEY')
    DATABASE_URL: Optional[str] = os.getenv('DATABASE_URL')
    
    # ==================== CACHE ====================
    REDIS_URL: Optional[str] = os.getenv('REDIS_URL')
    CACHE_TTL_MARKET_DATA: int = int(os.getenv('CACHE_TTL_MARKET_DATA', '900'))  # 15 minutes
    CACHE_TTL_NEWS: int = int(os.getenv('CACHE_TTL_NEWS', '7200'))  # 2 hours
    CACHE_TTL_PORTFOLIO: int = int(os.getenv('CACHE_TTL_PORTFOLIO', '21600'))  # 6 hours
    
    # ==================== SECURITY ====================
    JWT_SECRET_KEY: str = os.getenv('JWT_SECRET_KEY', 'hedge_fund_secret_key_2024')
    FLASK_SECRET_KEY: str = os.getenv('FLASK_SECRET_KEY', 'flask_secret_key_2024')
    SESSION_TIMEOUT_HOURS: int = int(os.getenv('SESSION_TIMEOUT_HOURS', '24'))
    PASSWORD_MIN_LENGTH: int = int(os.getenv('PASSWORD_MIN_LENGTH', '8'))
    MAX_LOGIN_ATTEMPTS: int = int(os.getenv('MAX_LOGIN_ATTEMPTS', '5'))
    
    # ==================== EMAIL ====================
    SMTP_SERVER: Optional[str] = os.getenv('SMTP_SERVER')
    SMTP_PORT: int = int(os.getenv('SMTP_PORT', '587'))
    SMTP_USERNAME: Optional[str] = os.getenv('SMTP_USERNAME')
    SMTP_PASSWORD: Optional[str] = os.getenv('SMTP_PASSWORD')
    SMTP_USE_TLS: bool = os.getenv('SMTP_USE_TLS', 'true').lower() == 'true'
    EMAIL_FROM_NAME: str = os.getenv('EMAIL_FROM_NAME', 'Hedge Fund Analysis')
    EMAIL_ENABLED: bool = all([SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD])
    
    # ==================== PLAID ====================
    PLAID_CLIENT_ID: Optional[str] = os.getenv('PLAID_CLIENT_ID')
    PLAID_SECRET: Optional[str] = os.getenv('PLAID_SECRET')
    PLAID_ENVIRONMENT: str = os.getenv('PLAID_ENVIRONMENT', 'sandbox')
    PLAID_WEBHOOK_URL: Optional[str] = os.getenv('PLAID_WEBHOOK_URL')
    
    # ==================== APPLICATION ====================
    FLASK_ENV: str = os.getenv('FLASK_ENV', 'production')
    DEBUG: bool = os.getenv('DEBUG', 'false').lower() == 'true'
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    HOST: str = os.getenv('HOST', '0.0.0.0')
    PORT: int = int(os.getenv('PORT', '8000'))
    
    # ==================== RATE LIMITING ====================
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv('RATE_LIMIT_PER_MINUTE', '60'))
    MAX_CONCURRENT_REQUESTS: int = int(os.getenv('MAX_CONCURRENT_REQUESTS', '10'))
    
    # API-specific rate limits (calls per minute)
    YFINANCE_RATE_LIMIT: int = int(os.getenv('YFINANCE_RATE_LIMIT', '60'))
    POLYGON_RATE_LIMIT: int = int(os.getenv('POLYGON_RATE_LIMIT', '5'))
    ALPHA_VANTAGE_RATE_LIMIT: int = int(os.getenv('ALPHA_VANTAGE_RATE_LIMIT', '5'))
    TWELVE_DATA_RATE_LIMIT: int = int(os.getenv('TWELVE_DATA_RATE_LIMIT', '8'))
    FINNHUB_RATE_LIMIT: int = int(os.getenv('FINNHUB_RATE_LIMIT', '60'))
    
    # ==================== RISK ANALYSIS ====================
    DEFAULT_PERIOD: str = os.getenv('DEFAULT_PERIOD', '1y')
    TRADING_DAYS_PER_YEAR: int = int(os.getenv('TRADING_DAYS_PER_YEAR', '252'))
    CONFIDENCE_LEVEL: float = float(os.getenv('CONFIDENCE_LEVEL', '0.95'))
    MONTE_CARLO_SIMULATIONS: int = int(os.getenv('MONTE_CARLO_SIMULATIONS', '10000'))
    
    # ==================== OPTIONS ====================
    MIN_OPTION_PREMIUM: float = float(os.getenv('MIN_OPTION_PREMIUM', '0.5'))
    MIN_OPTION_VOLUME: int = int(os.getenv('MIN_OPTION_VOLUME', '10'))
    MAX_OPTION_DAYS_TO_EXPIRY: int = int(os.getenv('MAX_OPTION_DAYS_TO_EXPIRY', '60'))
    
    # ==================== DATA PROVIDERS ====================
    PROVIDER_PRIORITY: List[str] = os.getenv('PROVIDER_PRIORITY', 'yfinance,polygon,alpha_vantage,twelve_data').split(',')
    FALLBACK_TO_YFINANCE: bool = os.getenv('FALLBACK_TO_YFINANCE', 'true').lower() == 'true'
    
    # ==================== FILE HANDLING ====================
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv('MAX_UPLOAD_SIZE_MB', '50'))
    ALLOWED_EXTENSIONS: List[str] = os.getenv('ALLOWED_EXTENSIONS', 'csv,xlsx,xls').split(',')
    TEMP_DIR: str = os.getenv('TEMP_DIR', 'temp')
    
    # ==================== NOTIFICATIONS ====================
    ENABLE_RISK_ALERTS: bool = os.getenv('ENABLE_RISK_ALERTS', 'true').lower() == 'true'
    RISK_THRESHOLD_HIGH: float = float(os.getenv('RISK_THRESHOLD_HIGH', '0.05'))  # 5% VaR
    RISK_THRESHOLD_CRITICAL: float = float(os.getenv('RISK_THRESHOLD_CRITICAL', '0.10'))  # 10% VaR
    
    @classmethod
    def validate_config(cls) -> Dict[str, Any]:
        """Validate configuration and return status"""
        status = {
            'valid': True,
            'warnings': [],
            'errors': [],
            'services': {}
        }
        
        # Check database
        if cls.SUPABASE_URL and cls.SUPABASE_ANON_KEY:
            status['services']['database'] = 'configured'
        else:
            status['services']['database'] = 'missing'
            status['warnings'].append('Database not configured - using local storage')
        
        # Check cache
        if cls.REDIS_URL:
            status['services']['cache'] = 'configured'
        else:
            status['services']['cache'] = 'missing'
            status['warnings'].append('Redis cache not configured - performance may be impacted')
        
        # Check email
        status['services']['email'] = 'configured' if cls.EMAIL_ENABLED else 'disabled'
        
        # Check market data providers
        providers = []
        if cls.EODHD_API_KEY: providers.append('eodhd')
        if cls.FINNHUB_API_KEY: providers.append('finnhub')
        if cls.POLYGON_API_KEY: providers.append('polygon')
        if cls.ALPHA_VANTAGE_API_KEY: providers.append('alpha_vantage')
        if cls.TWELVE_DATA_API_KEY: providers.append('twelve_data')
        
        status['services']['market_data'] = providers if providers else ['yfinance_only']
        
        # Check security
        if cls.JWT_SECRET_KEY == 'hedge_fund_secret_key_2024':
            status['warnings'].append('Using default JWT secret - change in production')
        
        return status
    
    @classmethod
    def get_api_keys(cls) -> Dict[str, Optional[str]]:
        """Get all configured API keys"""
        return {
            'eodhd': cls.EODHD_API_KEY,
            'finnhub': cls.FINNHUB_API_KEY,
            'polygon': cls.POLYGON_API_KEY,
            'alpha_vantage': cls.ALPHA_VANTAGE_API_KEY,
            'twelve_data': cls.TWELVE_DATA_API_KEY,
            'newsapi': cls.NEWSAPI_KEY,
            'plaid_client_id': cls.PLAID_CLIENT_ID,
            'snaptrade_client_id': cls.SNAPTRADE_CLIENT_ID
        }
    
    @classmethod
    def is_production(cls) -> bool:
        """Check if running in production"""
        return cls.FLASK_ENV == 'production' and not cls.DEBUG
    
    @classmethod
    def setup_logging(cls):
        """Setup logging configuration"""
        logging.basicConfig(
            level=getattr(logging, cls.LOG_LEVEL.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    
    @classmethod
    def get_rate_limit(cls, provider: str) -> int:
        """Get rate limit for specific provider"""
        limits = {
            'yfinance': cls.YFINANCE_RATE_LIMIT,
            'polygon': cls.POLYGON_RATE_LIMIT,
            'alpha_vantage': cls.ALPHA_VANTAGE_RATE_LIMIT,
            'twelve_data': cls.TWELVE_DATA_RATE_LIMIT,
            'finnhub': cls.FINNHUB_RATE_LIMIT
        }
        return limits.get(provider, 60)

# Initialize logging
Config.setup_logging()