import yfinance as yf
import pandas as pd
from typing import List, Dict, Optional
from clients.market_data_client import MarketDataClient

class OptionsAnalyzer:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def scan_covered_calls(self, symbols: List[str], min_premium: float = 0.5) -> List[Dict]:
        opportunities = []
        
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                current_price = ticker.info.get('currentPrice') or ticker.info.get('regularMarketPrice')
                
                if not current_price:
                    continue
                
                # Get options expiration dates
                expirations = ticker.options
                if not expirations:
                    continue
                
                # Use first available expiration (usually nearest)
                exp_date = expirations[0]
                options_chain = ticker.option_chain(exp_date)
                calls = options_chain.calls
                
                # Filter OTM calls with decent premium and volume
                otm_calls = calls[
                    (calls['strike'] > current_price) & 
                    (calls['bid'] >= min_premium) &
                    (calls['volume'] > 0)
                ]
                
                for _, option in otm_calls.iterrows():
                    days_to_exp = (pd.to_datetime(exp_date) - pd.Timestamp.now()).days
                    if days_to_exp <= 0:
                        continue
                        
                    annualized_return = (option['bid'] / current_price) * (365 / days_to_exp)
                    
                    opportunities.append({
                        'symbol': symbol,
                        'current_price': current_price,
                        'strike': option['strike'],
                        'premium': option['bid'],
                        'annualized_return': annualized_return,
                        'volume': option['volume'],
                        'expiration': exp_date,
                        'days_to_exp': days_to_exp
                    })
            except Exception as e:
                continue
        
        return sorted(opportunities, key=lambda x: x['annualized_return'], reverse=True)
    
    def _get_options_chain(self, symbol: str) -> Optional[pd.DataFrame]:
        try:
            ticker = yf.Ticker(symbol)
            expirations = ticker.options
            if expirations:
                return ticker.option_chain(expirations[0]).calls
        except:
            pass
        return None