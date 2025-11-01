"""Federal Reserve Rate Data Client"""

import requests
import pandas as pd
from datetime import datetime, timedelta
import logging
import os

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logger = logging.getLogger(__name__)

class FedRateClient:
    def __init__(self):
        self.base_url = "https://api.stlouisfed.org/fred/series/observations"
        self.series_id = "FEDFUNDS"  # Federal Funds Rate
        self.api_key = os.getenv('FRED_API_KEY')
        
    def get_current_fed_rate(self):
        """Get current federal funds rate"""
        try:
            # Try FRED API first
            if self.api_key:
                return self._get_fred_rate()
            
            # Fallback to Yahoo Finance for Treasury rate
            return self._get_treasury_rate()
            
        except Exception as e:
            logger.warning(f"Failed to get Fed rate: {e}")
            return 0.05  # Default 5% if all methods fail
    
    def _get_fred_rate(self):
        """Get rate from FRED API"""
        params = {
            'series_id': self.series_id,
            'api_key': self.api_key,
            'file_type': 'json',
            'limit': 1,
            'sort_order': 'desc'
        }
        
        response = requests.get(self.base_url, params=params, timeout=10)
        data = response.json()
        
        if 'observations' in data and data['observations']:
            rate = float(data['observations'][0]['value'])
            return rate / 100  # Convert percentage to decimal
        
        raise Exception("No FRED data available")
    
    def _get_treasury_rate(self):
        """Get 3-month Treasury rate as proxy for Fed rate"""
        try:
            import yfinance as yf
            
            # Get 3-month Treasury rate
            treasury = yf.Ticker("^IRX")
            hist = treasury.history(period="5d")
            
            if not hist.empty:
                latest_rate = hist['Close'].iloc[-1]
                return latest_rate / 100  # Convert percentage to decimal
            
            raise Exception("No Treasury data available")
            
        except Exception as e:
            logger.warning(f"Treasury rate fallback failed: {e}")
            # Use hardcoded current rate as last resort
            return 0.0525  # 5.25% as of recent Fed meetings

# Global instance
fed_rate_client = FedRateClient()

def get_risk_free_rate():
    """Get current risk-free rate for calculations"""
    return fed_rate_client.get_current_fed_rate()