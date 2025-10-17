import requests
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from utils.config import Config

class NewsClient:
    def __init__(self):
        self.api_key = getattr(Config, 'NEWSAPI_KEY', None)
        self.base_url = "https://newsapi.org/v2"
    
    def get_stock_news(self, symbol: str, days: int = 7) -> List[Dict]:
        """Get news for a specific stock symbol"""
        if not self.api_key:
            return []
        
        # Calculate date range
        to_date = datetime.now()
        from_date = to_date - timedelta(days=days)
        
        params = {
            'q': f'{symbol} OR "{symbol}"',
            'from': from_date.strftime('%Y-%m-%d'),
            'to': to_date.strftime('%Y-%m-%d'),
            'sortBy': 'publishedAt',
            'language': 'en',
            'apiKey': self.api_key
        }
        
        try:
            response = requests.get(f"{self.base_url}/everything", params=params)
            if response.status_code == 200:
                data = response.json()
                return data.get('articles', [])[:10]  # Limit to 10 articles
        except:
            pass
        
        return []
    
    def get_market_news(self, category: str = 'business') -> List[Dict]:
        """Get general market news"""
        if not self.api_key:
            return []
        
        params = {
            'category': category,
            'country': 'us',
            'apiKey': self.api_key
        }
        
        try:
            response = requests.get(f"{self.base_url}/top-headlines", params=params)
            if response.status_code == 200:
                data = response.json()
                return data.get('articles', [])[:5]  # Limit to 5 articles
        except:
            pass
        
        return []

# Global instance
news_client = NewsClient() if hasattr(Config, 'NEWSAPI_KEY') and Config.NEWSAPI_KEY else None