import yfinance as yf
import pandas as pd
from typing import Dict, List
from clients.market_data_client import MarketDataClient

import requests
import os

class SectorAnalyzer:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
        self.finnhub_key = os.getenv('FINNHUB_API_KEY')
        
    def get_sector_mapping(self) -> Dict[str, str]:
        """Default sector mapping for common stocks"""
        return {
            'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Communication Services',
            'AMZN': 'Consumer Discretionary', 'TSLA': 'Consumer Discretionary', 'META': 'Communication Services',
            'NVDA': 'Technology', 'JPM': 'Financials', 'JNJ': 'Healthcare', 'PG': 'Consumer Staples',
            'V': 'Financials', 'UNH': 'Healthcare', 'HD': 'Consumer Discretionary', 'MA': 'Financials',
            'PFE': 'Healthcare', 'BAC': 'Financials', 'XOM': 'Energy', 'KO': 'Consumer Staples'
        }
    
    def analyze_sector_allocation(self, symbols: List[str], weights: Dict[str, float] = None, portfolio_positions=None) -> Dict:
        """Analyze portfolio sector and geographic allocation"""
        sector_data = {}
        country_data = {}
        sector_mapping = self.get_sector_mapping()
        
        # Default equal weights if none provided
        if weights is None:
            weights = {symbol: 1/len(symbols) for symbol in symbols}
        
        for symbol in symbols:
            try:
                # Use default mapping first
                sector = sector_mapping.get(symbol, 'Unknown')
                country = 'US'  # Default for US stocks
                
                # Try to get from portfolio positions if available
                if portfolio_positions:
                    position = next((p for p in portfolio_positions if p.symbol == symbol), None)
                    if position and hasattr(position, 'sector'):
                        sector = position.sector or sector
                        country = getattr(position, 'country', 'US') or country
                
                # Fallback to yfinance for unknown sectors
                if sector == 'Unknown':
                    try:
                        ticker = yf.Ticker(symbol)
                        info = ticker.info
                        sector = info.get('sector', 'Technology')  # Default fallback
                        country = info.get('country', 'US')
                    except:
                        sector = 'Technology'  # Final fallback
                
                weight = weights.get(symbol, 0)
                
                # Sector allocation
                if sector not in sector_data:
                    sector_data[sector] = {'weight': 0, 'symbols': []}
                sector_data[sector]['weight'] += weight
                sector_data[sector]['symbols'].append(symbol)
                
                # Geographic allocation
                if country not in country_data:
                    country_data[country] = {'weight': 0, 'symbols': []}
                country_data[country]['weight'] += weight
                country_data[country]['symbols'].append(symbol)
                
            except Exception as e:
                print(f"Error getting sector data for {symbol}: {e}")
                continue
        
        # Calculate diversification metrics
        sector_weights = [data['weight'] for data in sector_data.values()]
        herfindahl_index = sum(w**2 for w in sector_weights) if sector_weights else 0
        effective_sectors = 1 / herfindahl_index if herfindahl_index > 0 else len(sector_weights)
        
        return {
            'sector_allocation': sector_data,
            'geographic_allocation': country_data,
            'diversification_metrics': {
                'herfindahl_index': herfindahl_index,
                'effective_number_sectors': effective_sectors,
                'sector_concentration': max(sector_weights) if sector_weights else 0
            },
            'sector_performance': self.get_sector_performance_summary(sector_data)
        }
    
    def get_sector_performance_summary(self, sector_data: Dict) -> Dict:
        """Get performance summary for each sector"""
        performance = {}
        for sector, data in sector_data.items():
            performance[sector] = {
                'weight_pct': data['weight'] * 100,
                'symbol_count': len(data['symbols']),
                'top_holding': max(data['symbols'], key=lambda s: data['weight']) if data['symbols'] else None
            }
        return performance
    
    def get_sector_performance(self, symbols: List[str], period: str = "1y") -> Dict:
        """Get sector performance comparison"""
        sector_etfs = {
            'Technology': 'XLK',
            'Healthcare': 'XLV', 
            'Financials': 'XLF',
            'Consumer Discretionary': 'XLY',
            'Communication Services': 'XLC',
            'Industrials': 'XLI',
            'Consumer Staples': 'XLP',
            'Energy': 'XLE',
            'Utilities': 'XLU',
            'Real Estate': 'XLRE',
            'Materials': 'XLB'
        }
        
        # Get sector ETF performance
        sector_symbols = list(sector_etfs.values())
        price_data = self.data_client.get_price_data(sector_symbols, period)
        returns = price_data.pct_change().dropna()
        
        sector_performance = {}
        for sector, etf in sector_etfs.items():
            if etf in returns.columns:
                total_return = (1 + returns[etf]).prod() - 1
                volatility = returns[etf].std() * (252**0.5)
                sharpe = (returns[etf].mean() * 252 - 0.02) / volatility if volatility > 0 else 0
                
                sector_performance[sector] = {
                    'total_return': total_return,
                    'volatility': volatility,
                    'sharpe_ratio': sharpe
                }
        
        return sector_performance
    
    def analyze_style_factors(self, symbols: List[str], weights: Dict[str, float]) -> Dict:
        """Analyze portfolio style factors (Growth vs Value, Large vs Small cap)"""
        style_data = {
            'market_cap': {'large': 0, 'mid': 0, 'small': 0},
            'style': {'growth': 0, 'value': 0, 'blend': 0}
        }
        
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                
                market_cap = info.get('marketCap', 0)
                weight = weights.get(symbol, 0)
                
                # Market cap classification
                if market_cap > 10e9:  # > $10B
                    style_data['market_cap']['large'] += weight
                elif market_cap > 2e9:  # $2B - $10B
                    style_data['market_cap']['mid'] += weight
                else:  # < $2B
                    style_data['market_cap']['small'] += weight
                
                # Style classification (simplified)
                pe_ratio = info.get('trailingPE', 0)
                pb_ratio = info.get('priceToBook', 0)
                
                if pe_ratio > 25 or pb_ratio > 3:
                    style_data['style']['growth'] += weight
                elif pe_ratio < 15 and pb_ratio < 2:
                    style_data['style']['value'] += weight
                else:
                    style_data['style']['blend'] += weight
                    
            except Exception:
                continue
        
        return style_data