import requests
import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from textblob import TextBlob
import re
import time

class NewsAnalyzer:
    def __init__(self):
        self.news_cache = {}
        self.sentiment_cache = {}
    
    def scrape_tradingview_news(self, symbol: str, limit: int = 50) -> List[Dict]:
        """Scrape news from TradingView (simplified implementation)"""
        # Note: This is a simplified implementation. Real implementation would use proper web scraping
        # For demonstration, we'll simulate news data
        
        news_items = []
        base_time = datetime.now()
        
        # Simulate news items
        for i in range(limit):
            news_item = {
                'symbol': symbol,
                'title': f"Market Update: {symbol} Analysis {i+1}",
                'content': f"Latest developments in {symbol} show market volatility and investor sentiment shifts.",
                'timestamp': base_time - timedelta(hours=i*2),
                'source': 'TradingView',
                'url': f"https://tradingview.com/news/{symbol.lower()}-{i}"
            }
            news_items.append(news_item)
        
        return news_items
    
    def analyze_sentiment(self, text: str) -> Dict:
        """Analyze sentiment of news text"""
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
            news_items = self.scrape_tradingview_news(symbol, limit=20)
            
            # Filter by date
            cutoff_date = datetime.now() - timedelta(days=days_back)
            recent_news = [item for item in news_items if item['timestamp'] >= cutoff_date]
            
            if not recent_news:
                portfolio_sentiment[symbol] = {
                    'sentiment_score': 0,
                    'sentiment_trend': 'NEUTRAL',
                    'news_count': 0,
                    'latest_news': []
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
            
            portfolio_sentiment[symbol] = {
                'sentiment_score': avg_sentiment,
                'sentiment_trend': trend,
                'news_count': len(recent_news),
                'latest_news': analyzed_news[:5],  # Top 5 recent news
                'sentiment_distribution': {
                    'positive': len([s for s in sentiments if s > 0.1]),
                    'negative': len([s for s in sentiments if s < -0.1]),
                    'neutral': len([s for s in sentiments if -0.1 <= s <= 0.1])
                }
            }
        
        return portfolio_sentiment
    
    def detect_market_events(self, symbols: List[str]) -> Dict:
        """Detect earnings, announcements, and market-moving events"""
        events = {}
        
        for symbol in symbols:
            news_items = self.scrape_tradingview_news(symbol, limit=30)
            
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