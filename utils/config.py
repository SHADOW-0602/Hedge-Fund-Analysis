import os
from typing import Optional

class Config:
    # Data Provider API Keys
    FINNHUB_API_KEY: Optional[str] = os.getenv('FINNHUB_API_KEY')
    POLYGON_API_KEY: Optional[str] = os.getenv('POLYGON_API_KEY')
    ALPHA_VANTAGE_API_KEY: Optional[str] = os.getenv('ALPHA_VANTAGE_API_KEY')
    TWELVE_DATA_API_KEY: Optional[str] = os.getenv('TWELVE_DATA_API_KEY')
    
    # News API
    NEWSAPI_KEY: Optional[str] = os.getenv('NEWSAPI_KEY')
    
    # Portseido API
    PORTSEIDO_API_KEY: Optional[str] = os.getenv('PORTSEIDO_API_KEY')
    
    # Database Configuration
    SUPABASE_URL: Optional[str] = os.getenv('SUPABASE_URL')
    SUPABASE_ANON_KEY: Optional[str] = os.getenv('SUPABASE_ANON_KEY')
    DATABASE_URL: Optional[str] = os.getenv('DATABASE_URL')
    
    # Redis Configuration
    REDIS_URL: Optional[str] = os.getenv('REDIS_URL')
    
    # Security
    JWT_SECRET_KEY: str = os.getenv('JWT_SECRET_KEY', 'hedge_fund_secret_key_2024')
    FLASK_SECRET_KEY: str = os.getenv('FLASK_SECRET_KEY', 'flask_secret_key_2024')
    
    # Email Configuration (Optional)
    SMTP_SERVER: Optional[str] = os.getenv('SMTP_SERVER')
    SMTP_PORT: int = int(os.getenv('SMTP_PORT', '587'))
    SMTP_USERNAME: Optional[str] = os.getenv('SMTP_USERNAME')
    SMTP_PASSWORD: Optional[str] = os.getenv('SMTP_PASSWORD')
    EMAIL_ENABLED: bool = all([SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD])
    
    # Plaid Configuration
    PLAID_CLIENT_ID: Optional[str] = os.getenv('PLAID_CLIENT_ID')
    PLAID_SECRET: Optional[str] = os.getenv('PLAID_SECRET')
    PLAID_ENVIRONMENT: str = os.getenv('PLAID_ENVIRONMENT', 'sandbox')
    
    # Rate Limiting (calls per minute)
    YFINANCE_RATE_LIMIT = 60
    POLYGON_RATE_LIMIT = 5  # Free tier
    ALPHA_VANTAGE_RATE_LIMIT = 5  # Free tier
    TWELVE_DATA_RATE_LIMIT = 8  # Free tier
    
    # Risk calculation defaults
    DEFAULT_PERIOD = "1y"
    TRADING_DAYS_PER_YEAR = 252
    
    # Options scanning defaults
    MIN_OPTION_PREMIUM = 0.5
    MIN_OPTION_VOLUME = 10
    
    # Data provider priority order
    PROVIDER_PRIORITY = ['yfinance', 'polygon', 'alpha_vantage', 'twelve_data']