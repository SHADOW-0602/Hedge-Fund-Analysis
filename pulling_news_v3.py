import requests
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from textblob import TextBlob
import re
import time
import os
from dotenv import load_dotenv

load_dotenv()

class NewsAnalyzer:
    def __init__(self):
        self.news_cache = {}
        self.sentiment_cache = {}
        self.api_key = os.getenv('NEWSAPI_KEY')
        self.base_url = 'https://newsapi.org/v2'
    
    def get_real_news(self, symbol: str, limit: int = 20) -> List[Dict]:
        """Get real news from NewsAPI"""
        if not self.api_key:
            return []
        
        try:
            # Get company name mapping
            company_names = {
                'AAPL': 'Apple',
                'MSFT': 'Microsoft', 
                'GOOGL': 'Google',
                'TSLA': 'Tesla',
                'NVDA': 'NVIDIA',
                'AMZN': 'Amazon',
                'META': 'Meta',
                'SPY': 'S&P 500',
                'QQQ': 'NASDAQ'
            }
            
            query = company_names.get(symbol, symbol)
            
            params = {
                'q': query,
                'apiKey': self.api_key,
                'language': 'en',
                'sortBy': 'publishedAt',
                'pageSize': min(limit, 100)
            }
            
            response = requests.get(f'{self.base_url}/everything', params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                news_items = []
                
                for article in data.get('articles', []):
                    if article.get('title') and article.get('description'):
                        # Parse timestamp and make it timezone-naive
                        pub_time = datetime.fromisoformat(article['publishedAt'].replace('Z', '+00:00'))
                        if pub_time.tzinfo is not None:
                            pub_time = pub_time.replace(tzinfo=None)
                        
                        news_items.append({
                            'symbol': symbol,
                            'title': article['title'],
                            'content': article.get('description', ''),
                            'timestamp': pub_time,
                            'source': article.get('source', {}).get('name', 'Unknown'),
                            'url': article.get('url', '')
                        })
                
                return news_items[:limit]
            
        except Exception as e:
            print(f"Error fetching news for {symbol}: {e}")
        
        return []
    
    def analyze_sentiment(self, text: str) -> Dict:
        """Analyze sentiment using TextBlob"""
        if text in self.sentiment_cache:
            return self.sentiment_cache[text]
        
        try:
            blob = TextBlob(text)
            polarity = blob.sentiment.polarity  # -1 to 1
            subjectivity = blob.sentiment.subjectivity  # 0 to 1
            
            # Classify sentiment
            if polarity > 0.1:
                sentiment_label = 'POSITIVE'
            elif polarity < -0.1:
                sentiment_label = 'NEGATIVE'
            else:
                sentiment_label = 'NEUTRAL'
            
            result = {
                'polarity': polarity,
                'subjectivity': subjectivity,
                'sentiment': sentiment_label,
                'confidence': abs(polarity)
            }
            
            self.sentiment_cache[text] = result
            return result
            
        except Exception as e:
            return {
                'polarity': 0,
                'subjectivity': 0,
                'sentiment': 'NEUTRAL',
                'confidence': 0
            }
    
    def get_portfolio_news_sentiment(self, symbols: List[str], days_back: int = 7) -> Dict:
        """Get news sentiment for portfolio positions"""
        portfolio_sentiment = {}
        
        for symbol in symbols:
            news_items = self.get_real_news(symbol, limit=20)
            
            # Filter by date - make both datetimes timezone-naive
            cutoff_date = datetime.now().replace(tzinfo=None) - timedelta(days=days_back)
            recent_news = []
            for item in news_items:
                item_time = item['timestamp']
                if hasattr(item_time, 'tzinfo') and item_time.tzinfo is not None:
                    item_time = item_time.replace(tzinfo=None)
                if item_time >= cutoff_date:
                    recent_news.append(item)
            
            if not recent_news:
                portfolio_sentiment[symbol] = {
                    'sentiment_score': 0,
                    'sentiment_trend': 'NEUTRAL',
                    'news_count': 0,
                    'latest_news': [],
                    'sentiment_distribution': {
                        'positive': 0,
                        'negative': 0,
                        'neutral': 0
                    }
                }
                continue
            
            # Analyze sentiment for each news item
            sentiments = []
            analyzed_news = []
            
            for news_item in recent_news:
                full_text = f"{news_item['title']} {news_item['content']}"
                sentiment = self.analyze_sentiment(full_text)
                sentiments.append(sentiment['polarity'])
                
                analyzed_news.append({
                    'title': news_item['title'],
                    'timestamp': news_item['timestamp'],
                    'sentiment': sentiment['sentiment'],
                    'polarity': sentiment['polarity'],
                    'url': news_item['url']
                })
            
            # Calculate aggregate sentiment
            avg_sentiment = np.mean(sentiments) if sentiments else 0
            
            # Determine trend
            if avg_sentiment > 0.1:
                trend = 'BULLISH'
            elif avg_sentiment < -0.1:
                trend = 'BEARISH'
            else:
                trend = 'NEUTRAL'
            
            # Calculate sentiment distribution
            positive_count = len([s for s in sentiments if s > 0.1]) if sentiments else 0
            negative_count = len([s for s in sentiments if s < -0.1]) if sentiments else 0
            neutral_count = len([s for s in sentiments if -0.1 <= s <= 0.1]) if sentiments else 0
            
            portfolio_sentiment[symbol] = {
                'sentiment_score': avg_sentiment,
                'sentiment_trend': trend,
                'news_count': len(recent_news),
                'latest_news': analyzed_news[:5],  # Top 5 recent news
                'sentiment_distribution': {
                    'positive': positive_count,
                    'negative': negative_count,
                    'neutral': neutral_count
                }
            }
        
        return portfolio_sentiment
    
    def detect_market_events(self, symbols: List[str]) -> Dict:
        """Detect earnings, announcements, and market-moving events"""
        events = {}
        
        for symbol in symbols:
            news_items = self.get_real_news(symbol, limit=30)
            
            detected_events = []
            
            for news_item in news_items:
                title_lower = news_item['title'].lower()
                content_lower = news_item['content'].lower()
                
                # Event detection keywords
                earnings_keywords = ['earnings', 'quarterly', 'q1', 'q2', 'q3', 'q4', 'revenue', 'eps']
                announcement_keywords = ['announces', 'acquisition', 'merger', 'partnership', 'launch']
                regulatory_keywords = ['fda', 'sec', 'regulatory', 'approval', 'investigation']
                
                event_type = None
                if any(keyword in title_lower or keyword in content_lower for keyword in earnings_keywords):
                    event_type = 'EARNINGS'
                elif any(keyword in title_lower or keyword in content_lower for keyword in announcement_keywords):
                    event_type = 'ANNOUNCEMENT'
                elif any(keyword in title_lower or keyword in content_lower for keyword in regulatory_keywords):
                    event_type = 'REGULATORY'
                
                if event_type:
                    sentiment = self.analyze_sentiment(f"{news_item['title']} {news_item['content']}")
                    
                    detected_events.append({
                        'type': event_type,
                        'title': news_item['title'],
                        'timestamp': news_item['timestamp'],
                        'sentiment': sentiment['sentiment'],
                        'impact_score': abs(sentiment['polarity']) * sentiment['confidence']
                    })
            
            events[symbol] = sorted(detected_events, key=lambda x: x['timestamp'], reverse=True)[:10]
        
        return events
    
    def export_news_data(self, symbols: List[str], filename: str = 'news_analysis.csv') -> pd.DataFrame:
        """Export structured news data to CSV"""
        all_news_data = []
        
        for symbol in symbols:
            sentiment_data = self.get_portfolio_news_sentiment([symbol])
            
            if symbol in sentiment_data:
                for news_item in sentiment_data[symbol]['latest_news']:
                    all_news_data.append({
                        'Symbol': symbol,
                        'Title': news_item['title'],
                        'Timestamp': news_item['timestamp'],
                        'Sentiment': news_item['sentiment'],
                        'Polarity': news_item['polarity'],
                        'URL': news_item['url']
                    })
        
        df = pd.DataFrame(all_news_data)
        df.to_csv(filename, index=False)
        print(f"News data exported to {filename}")
        return df
    
    def real_time_sentiment_monitor(self, symbols: List[str], update_interval: int = 300) -> None:
        """Real-time sentiment monitoring (simplified)"""
        print(f"Starting real-time sentiment monitoring for {symbols}")
        print(f"Update interval: {update_interval} seconds")
        
        while True:
            try:
                sentiment_data = self.get_portfolio_news_sentiment(symbols, days_back=1)
                
                print(f"\n--- Sentiment Update {datetime.now().strftime('%H:%M:%S')} ---")
                for symbol, data in sentiment_data.items():
                    trend = data['sentiment_trend']
                    score = data['sentiment_score']
                    count = data['news_count']
                    print(f"{symbol}: {trend} (Score: {score:.3f}, News: {count})")
                
                time.sleep(update_interval)
                
            except KeyboardInterrupt:
                print("\nSentiment monitoring stopped")
                break
            except Exception as e:
                print(f"Error in sentiment monitoring: {e}")
                time.sleep(60)

# Example usage
if __name__ == "__main__":
    analyzer = NewsAnalyzer()
    
    # Example portfolio
    symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA']
    
    print("Analyzing portfolio sentiment...")
    sentiment_data = analyzer.get_portfolio_news_sentiment(symbols)
    
    for symbol, data in sentiment_data.items():
        print(f"\n{symbol}:")
        print(f"  Sentiment: {data['sentiment_trend']} ({data['sentiment_score']:.3f})")
        print(f"  News Count: {data['news_count']}")
        
        if data['latest_news']:
            print(f"  Latest: {data['latest_news'][0]['title']}")
    
    # Detect events
    print("\nDetecting market events...")
    events = analyzer.detect_market_events(symbols)
    
    for symbol, symbol_events in events.items():
        if symbol_events:
            print(f"\n{symbol} Events:")
            for event in symbol_events[:3]:
                print(f"  {event['type']}: {event['title'][:50]}...")
    
    # Export data
    analyzer.export_news_data(symbols)