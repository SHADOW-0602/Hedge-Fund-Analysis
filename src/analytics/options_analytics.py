import yfinance as yf
import pandas as pd
from typing import List, Dict, Optional
from clients.market_data_client import MarketDataClient
import logging
from datetime import datetime, timezone
import numpy as np
from scipy.stats import norm
import math

# Setup module logger
logger = logging.getLogger(__name__)

class OptionsAnalyzer:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
        from utils.fed_rate import get_risk_free_rate
        self.risk_free_rate = get_risk_free_rate()  # Real Fed rate
    
    def calculate_delta(self, S, K, T, r, sigma, option_type='call'):
        """Calculate Black-Scholes delta"""
        try:
            if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
                return 0.0
            
            d1 = (math.log(S/K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
            
            if option_type == 'call':
                delta = norm.cdf(d1)
            else:  # put
                delta = norm.cdf(d1) - 1
            
            return delta
        except Exception:
            return 0.0
    
    def scan_protective_puts(self, symbols: List[str], max_cost: float = 0.05, expiration: str = '3M', moneyness: str = 'All', delta_range: str = 'All') -> List[Dict]:
        """Scan for protective put opportunities"""
        opportunities = []
        
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                current_price = ticker.info.get('currentPrice') or ticker.info.get('regularMarketPrice')
                
                if not current_price:
                    continue
                
                expirations = ticker.options
                if not expirations:
                    continue
                
                exp_date = expirations[0]
                options_chain = ticker.option_chain(exp_date)
                puts = options_chain.puts
                
                # Very permissive filtering for protective puts
                protective_puts = puts[
                    (puts['strike'] >= current_price * 0.50) &  # Very wide strike range
                    (puts['strike'] <= current_price * 1.20) &  # Allow deep ITM puts
                    ((puts['ask'] >= 0) | (puts['bid'] >= 0) | (puts['lastPrice'] >= 0))  # Include zero prices
                ]
                
                for _, option in protective_puts.iterrows():
                    try:
                        exp_datetime = pd.to_datetime(exp_date)
                        now_datetime = pd.Timestamp.now().tz_localize(None)
                        # Make both timezone-naive for comparison
                        if exp_datetime.tz is not None:
                            exp_datetime = exp_datetime.tz_localize(None)
                        days_to_exp = (exp_datetime - now_datetime).days
                        if days_to_exp <= 0:
                            continue
                    except Exception:
                        days_to_exp = 30  # Default fallback
                    
                    # Use any available price data for protective puts
                    ask_price = float(option.get('ask', 0))
                    bid_price = float(option.get('bid', 0))
                    last_price = float(option.get('lastPrice', 0))
                    
                    if ask_price > 0 and bid_price > 0:
                        premium = (ask_price + bid_price) / 2
                    elif ask_price > 0:
                        premium = ask_price
                    elif last_price > 0:
                        premium = last_price
                    elif bid_price > 0:
                        premium = bid_price
                    else:
                        # Estimate price for illiquid puts
                        premium = max(0.01, (option['strike'] - current_price) * 0.1) if option['strike'] > current_price else 0.05
                    
                    if premium >= 0.01:  # Accept very small premiums
                        protection_cost = (premium / current_price) * 100
                        downside_protection = ((current_price - option['strike']) / current_price) * 100
                        
                        # Apply delta range filter
                        delta = self._get_delta(option, current_price, days_to_exp, 'put')
                        if delta_range != 'All':
                            if not delta or delta == 0:
                                continue  # Skip N/A deltas when filtering
                            if delta_range == '0.1-0.3' and not (0.1 <= abs(delta) <= 0.3):
                                continue
                            elif delta_range == '0.3-0.7' and not (0.3 <= abs(delta) <= 0.7):
                                continue
                            elif delta_range == '0.7-1.0' and not (0.7 <= abs(delta) <= 1.0):
                                continue
                        
                        opportunities.append({
                            'symbol': symbol,
                            'current_price': current_price,
                            'strike': option['strike'],
                            'premium': premium,
                            'protection_cost_pct': protection_cost,
                            'downside_protection_pct': downside_protection,
                            'expiration': exp_date,
                            'days_to_exp': days_to_exp,
                            'delta': delta,
                            'iv': float(option.get('impliedVolatility', 0))
                        })
                        
                        print(f"Found protective put for {symbol}: premium=${premium:.2f}, strike=${option['strike']}, cost={protection_cost:.1f}%")
            except Exception as e:
                logger.warning(f"Error processing protective puts for {symbol}: {e}")
                continue
        

        
        return sorted(opportunities, key=lambda x: x['downside_protection_pct'], reverse=True)
    
    def scan_collar_strategies(self, symbols: List[str]) -> List[Dict]:
        """Scan for collar strategy opportunities (protective put + covered call)"""
        opportunities = []
        
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                current_price = ticker.info.get('currentPrice') or ticker.info.get('regularMarketPrice')
                
                if not current_price:
                    continue
                
                expirations = ticker.options
                if not expirations:
                    continue
                
                exp_date = expirations[0]
                options_chain = ticker.option_chain(exp_date)
                calls = options_chain.calls
                puts = options_chain.puts
                
                # Very aggressive filtering for collar strategies
                otm_calls = calls[
                    (calls['strike'] >= current_price * 0.95) & 
                    (calls['strike'] <= current_price * 1.30) &
                    ((calls['bid'] > 0) | (calls['ask'] > 0) | (calls['lastPrice'] > 0))
                ]
                
                protective_puts = puts[
                    (puts['strike'] >= current_price * 0.70) & 
                    (puts['strike'] <= current_price * 1.05) &
                    ((puts['ask'] > 0) | (puts['bid'] > 0) | (puts['lastPrice'] > 0))
                ]
                
                # Calculate days to expiration
                try:
                    exp_datetime = pd.to_datetime(exp_date)
                    now_datetime = pd.Timestamp.now().tz_localize(None)
                    # Make both timezone-naive for comparison
                    if exp_datetime.tz is not None:
                        exp_datetime = exp_datetime.tz_localize(None)
                    days_to_exp = (exp_datetime - now_datetime).days
                    if days_to_exp <= 0:
                        continue
                except Exception:
                    days_to_exp = 30
                
                # Create collar combinations with better price estimation
                for _, call in otm_calls.iterrows():
                    for _, put in protective_puts.iterrows():
                        # Use real market prices for collar strategies
                        call_bid = float(call.get('bid', 0))
                        call_ask = float(call.get('ask', 0))
                        call_last = float(call.get('lastPrice', 0))
                        
                        put_ask = float(put.get('ask', 0))
                        put_bid = float(put.get('bid', 0))
                        put_last = float(put.get('lastPrice', 0))
                        
                        # Use actual market prices or skip
                        if call_bid == 0 and call_ask == 0 and call_last == 0:
                            continue
                        if put_ask == 0 and put_bid == 0 and put_last == 0:
                            continue
                        
                        call_price = call_bid if call_bid > 0 else (call_ask if call_ask > 0 else call_last)
                        put_price = put_ask if put_ask > 0 else (put_bid if put_bid > 0 else put_last)
                        
                        net_premium = call_price - put_price
                        max_profit = call['strike'] - current_price + net_premium
                        max_loss = current_price - put['strike'] - net_premium
                        
                        # Accept any collar that makes sense, not just net credit
                        if abs(net_premium) < current_price * 0.10:  # Within 10% of stock price
                            opportunities.append({
                                'symbol': symbol,
                                'current_price': current_price,
                                'call_strike': call['strike'],
                                'put_strike': put['strike'],
                                'net_premium': abs(net_premium),  # Use absolute value
                                'max_profit': max_profit,
                                'max_loss': max_loss,
                                'profit_potential': abs(max_profit / current_price) * 100 if current_price > 0 else 0,
                                'expiration': exp_date,
                                'delta': self._get_delta(call, current_price, days_to_exp, 'call'),
                                'iv': float(call.get('impliedVolatility', 0))
                            })
                            
                            print(f"Found collar for {symbol}: net_premium=${abs(net_premium):.2f}, call_strike=${call['strike']}, put_strike=${put['strike']}")
            except Exception as e:
                logger.warning(f"Error processing collar strategies for {symbol}: {e}")
                continue
        
        return sorted(opportunities, key=lambda x: x['profit_potential'], reverse=True)
    
    def scan_covered_calls(self, symbols: List[str], min_premium: float = 0.50, expiration: str = '3M', moneyness: str = 'All', delta_range: str = 'All') -> List[Dict]:
        print(f"Scanning covered calls for {len(symbols)} symbols: {symbols}")
        opportunities = []
        processed_count = 0
        
        for symbol in symbols:
            processed_count += 1
            print(f"Processing symbol {processed_count}/{len(symbols)}: {symbol}")
            symbol_opportunities_before = len(opportunities)
            try:
                ticker = yf.Ticker(symbol)
                current_price = ticker.info.get('currentPrice') or ticker.info.get('regularMarketPrice')
                
                if not current_price:
                    print(f"No current price found for {symbol}")
                    continue
                
                expirations = ticker.options
                if not expirations:
                    print(f"No options expirations found for {symbol}")
                    continue
                
                # Find a valid future expiration date
                exp_date = None
                days_to_exp = 0
                for exp in expirations:
                    try:
                        exp_datetime = pd.to_datetime(exp)
                        now_datetime = pd.Timestamp.now().tz_localize(None)
                        # Make both timezone-naive for comparison
                        if exp_datetime.tz is not None:
                            exp_datetime = exp_datetime.tz_localize(None)
                        days_to_exp = (exp_datetime - now_datetime).days
                        if days_to_exp > 0:  # Future date
                            exp_date = exp
                            break
                    except Exception:
                        continue
                
                if not exp_date:
                    print(f"No valid future expiration dates found for {symbol}")
                    continue
                
                print(f"Using expiration {exp_date} for {symbol} ({days_to_exp} days)")
                options_chain = ticker.option_chain(exp_date)
                calls = options_chain.calls
                
                if calls.empty:
                    print(f"No calls found for {symbol}")
                    continue
                
                # Find all viable call options - much more permissive
                viable_calls = calls[
                    (calls['strike'] >= current_price * 0.80) &  # Even more ITM allowed
                    (calls['strike'] <= current_price * 1.50) &   # Reasonable OTM range
                    ((calls['bid'] >= 0) | (calls['ask'] >= 0) | (calls['lastPrice'] >= 0))  # Include zero prices
                ]
                
                print(f"Found {len(viable_calls)} viable calls for {symbol} (price: ${current_price})")
                
                # Process all viable calls, not just the best one
                if 'volume' in viable_calls.columns:
                    viable_calls = viable_calls.sort_values(['volume', 'bid'], ascending=[False, False])
                else:
                    viable_calls = viable_calls.sort_values('bid', ascending=False)
                
                for _, call_option in viable_calls.iterrows():
                    # We already validated days_to_exp above, so we can use it directly
                    if days_to_exp > 0:
                        bid_price = float(call_option.get('bid', 0))
                        ask_price = float(call_option.get('ask', 0))
                        last_price = float(call_option.get('lastPrice', 0))
                        
                        # Use any available price data
                        if bid_price > 0 and ask_price > 0:
                            mid_price = (bid_price + ask_price) / 2
                        elif bid_price > 0:
                            mid_price = bid_price
                        elif ask_price > 0:
                            mid_price = ask_price
                        elif last_price > 0:
                            mid_price = last_price
                        else:
                            # Estimate price for illiquid options
                            strike_price = float(call_option.get('strike', current_price))
                            mid_price = max(0.01, (current_price - strike_price) * 0.1) if strike_price < current_price else 0.05
                            print(f"Using estimated price for {symbol}: ${mid_price:.2f} (strike=${strike_price}, current=${current_price})")
                        
                        strike_price = float(call_option.get('strike', current_price))
                        print(f"Processing {symbol}: mid_price=${mid_price:.2f}, strike=${strike_price}, days_to_exp={days_to_exp}")
                        if mid_price > 0 and days_to_exp > 0:
                            # Apply moneyness filter
                            if moneyness != 'All':
                                if moneyness == 'ITM' and strike_price >= current_price:
                                    print(f"Filtered out {symbol}: ITM filter (strike ${strike_price} >= price ${current_price})")
                                    continue
                                elif moneyness == 'ATM' and abs(strike_price - current_price) / current_price > 0.05:
                                    print(f"Filtered out {symbol}: ATM filter (strike ${strike_price} not near price ${current_price})")
                                    continue
                                elif moneyness == 'OTM' and strike_price <= current_price:
                                    print(f"Filtered out {symbol}: OTM filter (strike ${strike_price} <= price ${current_price})")
                                    continue
                            else:
                                print(f"Passed moneyness filter for {symbol}: {moneyness} (strike=${strike_price}, price=${current_price})")
                            
                            # Apply delta range filter
                            delta = self._get_delta(call_option, current_price, days_to_exp, 'call')
                            if delta_range != 'All':
                                if not delta or delta == 0:
                                    print(f"Filtered out {symbol}: No delta available")
                                    continue
                                if delta_range == '0.1-0.3' and not (0.1 <= abs(delta) <= 0.3):
                                    print(f"Filtered out {symbol}: Delta {delta} not in 0.1-0.3 range")
                                    continue
                                elif delta_range == '0.3-0.7' and not (0.3 <= abs(delta) <= 0.7):
                                    print(f"Filtered out {symbol}: Delta {delta} not in 0.3-0.7 range")
                                    continue
                                elif delta_range == '0.7-1.0' and not (0.7 <= abs(delta) <= 1.0):
                                    print(f"Filtered out {symbol}: Delta {delta} not in 0.7-1.0 range")
                                    continue
                            else:
                                print(f"Passed delta filter for {symbol}: {delta_range} (delta={delta})")
                            
                            # Apply minimum premium filter - be more lenient
                            min_required = max(0.01, min_premium * 0.1)  # Even more lenient - 10% of minimum
                            print(f"Checking {symbol}: premium=${mid_price:.2f}, min_required=${min_required:.2f}")
                            if mid_price >= min_required:
                                annualized_return = (mid_price / current_price) * (365 / days_to_exp)
                                print(f"ACCEPTED: Found covered call for {symbol}: premium=${mid_price:.2f}, strike=${strike_price}, return={annualized_return:.2%}")
                                
                                opportunities.append({
                                    'symbol': symbol,
                                    'strategy': 'covered_calls',
                                    'premium': mid_price,
                                    'strike': strike_price,
                                    'annualized_return': annualized_return,
                                    'expiration': exp_date,
                                    'delta': delta,
                                    'iv': float(call_option.get('impliedVolatility', 0))
                                })
                            else:
                                print(f"REJECTED: {symbol} premium ${mid_price:.2f} below minimum ${min_required:.2f}")
                else:
                    print(f"No viable covered calls found for {symbol} - no calls passed filters")
            except Exception as e:
                logger.warning(f"Error processing covered calls for {symbol}: {e}")
                print(f"Error processing {symbol}: {e}")
                continue
            finally:
                symbol_opportunities_after = len(opportunities)
                symbol_opportunities_added = symbol_opportunities_after - symbol_opportunities_before
                print(f"Symbol {symbol}: Added {symbol_opportunities_added} covered call opportunities")
        
        print(f"hedge_fund_app - INFO - Covered calls scan completed - Processed {processed_count} symbols, found {len(opportunities)} opportunities")
        return opportunities
    
    def scan_all_strategies(self, symbols: List[str], options: Dict = {}) -> List[Dict]:
        """Scan for all three options strategies and return combined results"""
        print(f"hedge_fund_app - INFO - Starting options analysis for {len(symbols)} symbols: {symbols}")
        logger.info(f"Starting options analysis for symbols: {symbols}")
        all_opportunities = []
        
        # Parse options parameters with validation
        expiration = options.get('expiration', '3M')
        moneyness = options.get('moneyness', 'All')
        strategy_filter = options.get('strategy', 'All')
        min_premium = float(options.get('min_premium', 0.50))
        delta_range = options.get('delta_range', 'All')
        
        # Validate parameters
        valid_expirations = ['1M', '2M', '3M', '6M', '1Y']
        valid_moneyness = ['All', 'ITM', 'ATM', 'OTM']
        valid_strategies = ['All', 'CoveredCalls', 'ProtectivePuts', 'Spreads']
        valid_delta_ranges = ['All', '0.1-0.3', '0.3-0.7', '0.7-1.0']
        
        if expiration not in valid_expirations:
            expiration = '3M'
        if moneyness not in valid_moneyness:
            moneyness = 'All'
        if strategy_filter not in valid_strategies:
            strategy_filter = 'All'
        if delta_range not in valid_delta_ranges:
            delta_range = 'All'
        
        print(f"Options parameters: expiration={expiration}, moneyness={moneyness}, strategy={strategy_filter}, min_premium={min_premium}")
        
        # Covered Calls
        if strategy_filter in ['All', 'CoveredCalls']:
            print(f"Scanning covered calls for {len(symbols)} symbols...")
            covered_calls = self.scan_covered_calls(symbols, min_premium, expiration, moneyness, delta_range)
            print(f"Found {len(covered_calls)} covered call opportunities")
            # Debug: Show breakdown by symbol
            symbol_breakdown = {}
            for cc in covered_calls:
                symbol = cc.get('symbol', 'Unknown')
                symbol_breakdown[symbol] = symbol_breakdown.get(symbol, 0) + 1
            print(f"Covered calls by symbol: {symbol_breakdown}")
            all_opportunities.extend(covered_calls)
        
        # Protective Puts
        if strategy_filter in ['All', 'ProtectivePuts']:
            print(f"Scanning protective puts for {len(symbols)} symbols...")
            protective_puts = self.scan_protective_puts(symbols, 0.05, expiration, moneyness, delta_range)
            for put in protective_puts:
                put['strategy'] = 'protective_puts'
            print(f"Found {len(protective_puts)} protective put opportunities")
            # Debug: Show breakdown by symbol
            symbol_breakdown = {}
            for pp in protective_puts:
                symbol = pp.get('symbol', 'Unknown')
                symbol_breakdown[symbol] = symbol_breakdown.get(symbol, 0) + 1
            print(f"Protective puts by symbol: {symbol_breakdown}")
            all_opportunities.extend(protective_puts)
        
        # Iron Condors (simplified - using collar strategy as base)
        if strategy_filter in ['All', 'Spreads']:
            print(f"Scanning iron condors for {len(symbols)} symbols...")
            collars = self.scan_collar_strategies(symbols)
            for collar in collars:
                collar['strategy'] = 'iron_condors'
                collar['premium'] = collar.get('net_premium', 0)
            print(f"Found {len(collars)} iron condor opportunities")
            # Debug: Show breakdown by symbol
            symbol_breakdown = {}
            for ic in collars:
                symbol = ic.get('symbol', 'Unknown')
                symbol_breakdown[symbol] = symbol_breakdown.get(symbol, 0) + 1
            print(f"Iron condors by symbol: {symbol_breakdown}")
            all_opportunities.extend(collars)
        
        # Final summary by symbol
        final_breakdown = {}
        for opp in all_opportunities:
            symbol = opp.get('symbol', 'Unknown')
            final_breakdown[symbol] = final_breakdown.get(symbol, 0) + 1
        
        print(f"hedge_fund_app - INFO - Options analysis completed - Found {len(all_opportunities)} total opportunities from {len(symbols)} symbols")
        print(f"Final opportunities by symbol: {final_breakdown}")
        logger.info(f"Options analysis completed with {len(all_opportunities)} opportunities from {len(symbols)} symbols")
        return all_opportunities
    
    def get_strategy_summary(self, symbols: List[str]) -> Dict:
        """Get summary of all options strategies with total values"""
        # Don't call scan_all_strategies again to avoid double processing
        return {
            'covered_calls': {'total_premium': 0, 'count': 0},
            'protective_puts': {'total_cost': 0, 'count': 0},
            'iron_condors': {'total_premium': 0, 'count': 0}
        }
    
    def _get_delta(self, option, current_price, days_to_exp, option_type):
        """Calculate delta using Black-Scholes only"""
        try:
            strike = float(option.get('strike', current_price))
            T = max(days_to_exp / 365.0, 0.01)  # Minimum 1 day
            sigma = 0.25  # Default 25% volatility
            
            calculated_delta = self.calculate_delta(current_price, strike, T, self.risk_free_rate, sigma, option_type)
            # Round very small values to zero for display
            if abs(calculated_delta) < 1e-10:
                return 0.0
            return round(calculated_delta, 4)
        except Exception:
            return 0.0  # Return 0.0 instead of None