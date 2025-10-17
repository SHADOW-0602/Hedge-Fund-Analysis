import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from clients.market_data_client import MarketDataClient
from scipy.stats import norm

class OptionsTrader:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def black_scholes(self, S: float, K: float, T: float, r: float, sigma: float, option_type: str = 'call') -> Dict:
        """Black-Scholes option pricing"""
        d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
        d2 = d1 - sigma * np.sqrt(T)
        
        if option_type.lower() == 'call':
            price = S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
            delta = norm.cdf(d1)
            gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
        else:  # put
            price = K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)
            delta = -norm.cdf(-d1)
            gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
        
        theta = -(S * norm.pdf(d1) * sigma) / (2 * np.sqrt(T)) - r * K * np.exp(-r * T) * norm.cdf(d2 if option_type.lower() == 'call' else -d2)
        vega = S * norm.pdf(d1) * np.sqrt(T)
        
        return {
            'price': price,
            'delta': delta,
            'gamma': gamma,
            'theta': theta / 365,  # Daily theta
            'vega': vega / 100    # Vega per 1% vol change
        }
    
    def implied_volatility(self, market_price: float, S: float, K: float, T: float, r: float, option_type: str = 'call') -> float:
        """Calculate implied volatility using Newton-Raphson method"""
        sigma = 0.3  # Initial guess
        
        for _ in range(100):  # Max iterations
            bs_price = self.black_scholes(S, K, T, r, sigma, option_type)['price']
            vega = self.black_scholes(S, K, T, r, sigma, option_type)['vega']
            
            if abs(bs_price - market_price) < 0.001 or vega == 0:
                break
                
            sigma = sigma - (bs_price - market_price) / vega
            sigma = max(0.001, min(5.0, sigma))  # Keep within reasonable bounds
        
        return sigma
    
    def analyze_option_chain(self, symbol: str) -> Dict:
        """Complete options chain analysis"""
        options_chain = self.data_client.get_options_chain(symbol)
        if options_chain is None or options_chain.empty:
            return {}
        
        current_price = self.data_client.get_current_prices([symbol]).get(symbol, 0)
        if current_price == 0:
            return {}
        
        # Calculate Greeks and IV for each option
        analyzed_options = []
        
        for _, option in options_chain.iterrows():
            strike = option.get('strike', 0)
            bid = option.get('bid', 0)
            ask = option.get('ask', 0)
            mid_price = (bid + ask) / 2 if bid > 0 and ask > 0 else 0
            
            if mid_price > 0 and strike > 0:
                # Estimate time to expiration (simplified)
                T = 30 / 365  # Assume 30 days
                r = 0.05      # Risk-free rate
                
                try:
                    iv = self.implied_volatility(mid_price, current_price, strike, T, r, 'call')
                    greeks = self.black_scholes(current_price, strike, T, r, iv, 'call')
                    
                    analyzed_options.append({
                        'strike': strike,
                        'bid': bid,
                        'ask': ask,
                        'mid_price': mid_price,
                        'implied_vol': iv,
                        'delta': greeks['delta'],
                        'gamma': greeks['gamma'],
                        'theta': greeks['theta'],
                        'vega': greeks['vega'],
                        'moneyness': current_price / strike,
                        'intrinsic_value': max(0, current_price - strike),
                        'time_value': mid_price - max(0, current_price - strike)
                    })
                except:
                    continue
        
        return {
            'symbol': symbol,
            'current_price': current_price,
            'options': analyzed_options,
            'atm_iv': self._get_atm_iv(analyzed_options, current_price),
            'iv_skew': self._calculate_iv_skew(analyzed_options)
        }
    
    def covered_call_strategy(self, symbol: str, position_size: int) -> List[Dict]:
        """Analyze covered call opportunities"""
        analysis = self.analyze_option_chain(symbol)
        if not analysis or not analysis['options']:
            return []
        
        current_price = analysis['current_price']
        opportunities = []
        
        for option in analysis['options']:
            if option['moneyness'] > 1.02:  # OTM calls only
                annual_return = (option['mid_price'] / current_price) * (365 / 30)  # Annualized
                
                opportunities.append({
                    'strike': option['strike'],
                    'premium': option['mid_price'],
                    'annual_return': annual_return,
                    'delta': option['delta'],
                    'theta': option['theta'],
                    'max_profit': option['mid_price'] + (option['strike'] - current_price),
                    'breakeven': current_price - option['mid_price'],
                    'probability_profit': 1 - option['delta']  # Approximate
                })
        
        return sorted(opportunities, key=lambda x: x['annual_return'], reverse=True)
    
    def _get_atm_iv(self, options: List[Dict], current_price: float) -> float:
        """Get at-the-money implied volatility"""
        atm_options = [opt for opt in options if abs(opt['moneyness'] - 1.0) < 0.05]
        return np.mean([opt['implied_vol'] for opt in atm_options]) if atm_options else 0
    
    def _calculate_iv_skew(self, options: List[Dict]) -> Dict:
        """Calculate implied volatility skew"""
        if len(options) < 3:
            return {}
        
        otm_puts = [opt for opt in options if opt['moneyness'] < 0.95]
        otm_calls = [opt for opt in options if opt['moneyness'] > 1.05]
        
        put_iv = np.mean([opt['implied_vol'] for opt in otm_puts]) if otm_puts else 0
        call_iv = np.mean([opt['implied_vol'] for opt in otm_calls]) if otm_calls else 0
        
        return {
            'put_call_skew': put_iv - call_iv,
            'put_iv': put_iv,
            'call_iv': call_iv
        }