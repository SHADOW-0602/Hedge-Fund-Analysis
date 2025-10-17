import yfinance as yf
import pandas as pd
from typing import List, Dict, Optional
from clients.market_data_client import MarketDataClient

class OptionsAnalyzer:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def scan_covered_calls(self, symbols: List[str], min_premium: float = 0.5) -> List[Dict]:
        current_prices = self.data_client.get_current_prices(symbols)
        opportunities = []
        
        for symbol in symbols:
            if symbol not in current_prices:
                continue
                
            current_price = current_prices[symbol]
            options = self._get_options_chain(symbol)
            
            if options is None:
                continue
            
            # Filter OTM calls with decent premium
            otm_calls = options[
                (options['strike'] > current_price) & 
                (options['bid'] >= min_premium) &
                (options['volume'] > 0)
            ]
            
            for _, option in otm_calls.iterrows():
                annualized_return = (option['bid'] / current_price) * (365 / 30)
                
                opportunities.append({
                    'symbol': symbol,
                    'current_price': current_price,
                    'strike': option['strike'],
                    'premium': option['bid'],
                    'annualized_return': annualized_return,
                    'volume': option.get('volume', 0)
                })
        
        return sorted(opportunities, key=lambda x: x['annualized_return'], reverse=True)
    
    def _get_options_chain(self, symbol: str) -> Optional[pd.DataFrame]:
        chain = self.data_client.get_options_chain(symbol)
        if chain is not None:
            return chain
        return None