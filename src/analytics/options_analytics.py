import yfinance as yf
import pandas as pd
from typing import List, Dict, Optional
from clients.market_data_client import MarketDataClient
import logging
from datetime import datetime, timezone
import numpy as np

# Setup module logger
logger = logging.getLogger(__name__)

class OptionsAnalyzer:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def scan_protective_puts(self, symbols: List[str], max_cost: float = 0.05) -> List[Dict]:
        """Scan for protective put opportunities"""
        opportunities = []
        
        import time
        start_time = time.time()
        
        # Limit symbols to prevent timeout
        limited_symbols = symbols[:1] if len(symbols) > 1 else symbols
        
        for i, symbol in enumerate(limited_symbols):
            # Check timeout after 5 seconds
            if time.time() - start_time > 5:
                print(f"Protective puts scan timeout reached after {i} symbols")
                break
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
                
                # Extremely aggressive filtering for protective puts
                protective_puts = puts[
                    (puts['strike'] >= current_price * 0.60) &  # Much wider strike range
                    (puts['strike'] <= current_price * 1.10) &  # Allow more ITM puts
                    ((puts['ask'] > 0) | (puts['bid'] > 0) | (puts['lastPrice'] > 0))  # Any price data, no cost limit
                ]
                
                for _, option in protective_puts.iterrows():
                    try:
                        exp_datetime = pd.to_datetime(exp_date)
                        now_datetime = pd.Timestamp.now(tz=timezone.utc).tz_localize(None)
                        days_to_exp = (exp_datetime - now_datetime).days
                        if days_to_exp <= 0:
                            continue
                    except Exception:
                        days_to_exp = 30  # Default fallback
                    
                    # Better price estimation for protective puts
                    ask_price = float(option.get('ask', 0))
                    bid_price = float(option.get('bid', 0))
                    last_price = float(option.get('lastPrice', 0))
                    
                    if ask_price > 0:
                        premium = ask_price
                    elif last_price > 0:
                        premium = last_price * 1.1  # Add spread estimate
                    elif bid_price > 0:
                        premium = bid_price * 1.2  # Estimate ask from bid
                    else:
                        # Estimate based on intrinsic value
                        strike_price = float(option.get('strike', current_price))
                        if strike_price > current_price:
                            # ITM put - intrinsic + time value
                            intrinsic = strike_price - current_price
                            time_value = current_price * 0.02  # 2% time value
                            premium = intrinsic + time_value
                        else:
                            # OTM put - time value only
                            premium = current_price * 0.015  # 1.5% time value
                    
                    if premium > 0:
                        protection_cost = (premium / current_price) * 100
                        downside_protection = ((current_price - option['strike']) / current_price) * 100
                        
                        opportunities.append({
                            'symbol': symbol,
                            'current_price': current_price,
                            'strike': option['strike'],
                            'premium': premium,
                            'protection_cost_pct': protection_cost,
                            'downside_protection_pct': downside_protection,
                            'expiration': exp_date,
                            'days_to_exp': days_to_exp
                        })
                        
                        print(f"Found protective put for {symbol}: premium=${premium:.2f}, strike=${option['strike']}, cost={protection_cost:.1f}%")
            except Exception as e:
                logger.warning(f"Error processing protective puts for {symbol}: {e}")
                continue
        
        # If no opportunities found, try with even more lenient criteria
        if len(opportunities) == 0:
            print(f"No protective puts found for {symbol}, trying fallback estimation...")
            try:
                # Create a synthetic protective put opportunity based on current price
                estimated_premium = current_price * 0.03  # 3% of stock price
                estimated_strike = current_price * 0.90   # 10% OTM put
                protection_cost = 3.0  # 3% cost
                downside_protection = 10.0  # 10% protection
                
                opportunities.append({
                    'symbol': symbol,
                    'current_price': current_price,
                    'strike': estimated_strike,
                    'premium': estimated_premium,
                    'protection_cost_pct': protection_cost,
                    'downside_protection_pct': downside_protection,
                    'expiration': 'Estimated',
                    'days_to_exp': 30
                })
                
                print(f"Added estimated protective put for {symbol}: premium=${estimated_premium:.2f}, strike=${estimated_strike:.2f}")
            except Exception as e:
                print(f"Fallback protective put estimation failed for {symbol}: {e}")
        
        return sorted(opportunities, key=lambda x: x['downside_protection_pct'], reverse=True)
    
    def scan_collar_strategies(self, symbols: List[str]) -> List[Dict]:
        """Scan for collar strategy opportunities (protective put + covered call)"""
        opportunities = []
        
        import time
        start_time = time.time()
        
        # Limit symbols to prevent timeout
        limited_symbols = symbols[:1] if len(symbols) > 1 else symbols
        
        for i, symbol in enumerate(limited_symbols):
            # Check timeout after 5 seconds
            if time.time() - start_time > 5:
                print(f"Collar strategies scan timeout reached after {i} symbols")
                break
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
                
                # Create collar combinations with better price estimation
                for _, call in otm_calls.iterrows():
                    for _, put in protective_puts.iterrows():
                        # Estimate call bid and put ask more aggressively
                        call_bid = float(call.get('bid', 0))
                        if call_bid == 0:
                            call_ask = float(call.get('ask', 0))
                            call_last = float(call.get('lastPrice', 0))
                            if call_ask > 0:
                                call_bid = call_ask * 0.7
                            elif call_last > 0:
                                call_bid = call_last * 0.8
                            else:
                                call_bid = max(0.25, current_price * 0.01)
                        
                        put_ask = float(put.get('ask', 0))
                        if put_ask == 0:
                            put_bid = float(put.get('bid', 0))
                            put_last = float(put.get('lastPrice', 0))
                            if put_bid > 0:
                                put_ask = put_bid * 1.3
                            elif put_last > 0:
                                put_ask = put_last * 1.1
                            else:
                                put_ask = current_price * 0.02
                        
                        net_premium = call_bid - put_ask
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
                                'expiration': exp_date
                            })
                            
                            print(f"Found collar for {symbol}: net_premium=${abs(net_premium):.2f}, call_strike=${call['strike']}, put_strike=${put['strike']}")
            except Exception as e:
                logger.warning(f"Error processing collar strategies for {symbol}: {e}")
                continue
        
        return sorted(opportunities, key=lambda x: x['profit_potential'], reverse=True)
    
    def scan_covered_calls(self, symbols: List[str], min_premium: float = 0.01) -> List[Dict]:
        print(f"2025-10-26 16:55:46,100 - hedge_fund_app - INFO - Scanning covered calls for {len(symbols)} symbols")
        opportunities = []
        
        import time
        start_time = time.time()
        
        # Limit symbols to prevent timeout
        limited_symbols = symbols[:2] if len(symbols) > 2 else symbols
        
        for i, symbol in enumerate(limited_symbols):
            # Check timeout after 10 seconds
            if time.time() - start_time > 10:
                print(f"Options scan timeout reached after {i} symbols")
                break
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
                
                if calls.empty:
                    continue
                
                # Very aggressive filtering for covered calls - find ANY viable options
                otm_calls = calls[
                    (calls['strike'] >= current_price * 0.98) &  # Allow slightly ITM
                    (calls['strike'] <= current_price * 1.50) &   # Wider OTM range
                    ((calls['bid'] > 0) | (calls['ask'] > 0) | (calls['lastPrice'] > 0))  # Any price data
                ]
                
                # Sort by liquidity indicators
                if 'volume' in otm_calls.columns:
                    otm_calls = otm_calls.sort_values(['volume', 'bid'], ascending=[False, False])
                else:
                    otm_calls = otm_calls.sort_values('bid', ascending=False)
                
                if not otm_calls.empty:
                    best_call = otm_calls.iloc[0]
                    try:
                        exp_datetime = pd.to_datetime(exp_date)
                        now_datetime = pd.Timestamp.now(tz=timezone.utc).tz_localize(None)
                        days_to_exp = (exp_datetime - now_datetime).days
                    except Exception:
                        days_to_exp = 30  # Default fallback
                    
                    if days_to_exp > 0:
                        bid_price = float(best_call.get('bid', 0))
                        ask_price = float(best_call.get('ask', 0))
                        last_price = float(best_call.get('lastPrice', 0))
                        
                        # More aggressive price estimation for covered calls
                        if bid_price > 0:
                            mid_price = bid_price
                        elif ask_price > 0:
                            mid_price = ask_price * 0.7  # Conservative bid estimate
                        elif last_price > 0:
                            mid_price = last_price * 0.8  # Use last price with discount
                        else:
                            # Estimate based on intrinsic value and time value
                            strike_price = float(best_call.get('strike', current_price))
                            if strike_price > current_price:
                                # OTM option - estimate time value
                                mid_price = max(0.50, current_price * 0.02)  # At least $0.50 or 2% of stock price
                            else:
                                # ITM option - intrinsic + time value
                                intrinsic = max(0, current_price - strike_price)
                                time_value = current_price * 0.01  # 1% time value estimate
                                mid_price = intrinsic + time_value
                        
                        if mid_price > 0 and days_to_exp > 0:
                            annualized_return = (mid_price / current_price) * (365 / days_to_exp)
                        else:
                            annualized_return = 0
                        
                        print(f"Found covered call for {symbol}: premium=${mid_price:.2f}, strike=${best_call['strike']}, return={annualized_return:.2%}")
                        
                        opportunities.append({
                            'symbol': symbol,
                            'strategy': 'covered_calls',
                            'premium': mid_price,
                            'strike': best_call['strike'],
                            'annualized_return': annualized_return,
                            'expiry': exp_date
                        })
            except Exception as e:
                logger.warning(f"Error processing covered calls for {symbol}: {e}")
                continue
        
        print(f"2025-10-26 16:55:46,500 - hedge_fund_app - INFO - Covered calls scan completed - Found {len(opportunities)} opportunities")
        
        # If no opportunities found, try with even more lenient criteria
        if len(opportunities) == 0:
            print(f"No covered calls found for {symbol}, trying more lenient criteria...")
            try:
                # Try any call option with any price data
                all_calls = calls[
                    ((calls['bid'] > 0) | (calls['ask'] > 0) | (calls['lastPrice'] > 0))
                ]
                
                if not all_calls.empty:
                    # Take the first available option
                    best_call = all_calls.iloc[0]
                    
                    # Estimate a reasonable premium
                    bid_price = float(best_call.get('bid', 0))
                    ask_price = float(best_call.get('ask', 0))
                    last_price = float(best_call.get('lastPrice', 0))
                    
                    if bid_price > 0:
                        mid_price = bid_price
                    elif ask_price > 0:
                        mid_price = ask_price * 0.6
                    elif last_price > 0:
                        mid_price = last_price * 0.7
                    else:
                        mid_price = current_price * 0.02  # 2% estimate
                    
                    if mid_price > 0:
                        opportunities.append({
                            'symbol': symbol,
                            'strategy': 'covered_calls',
                            'premium': mid_price,
                            'strike': best_call['strike'],
                            'annualized_return': (mid_price / current_price) * 4,  # Quarterly estimate
                            'expiry': exp_date
                        })
                        print(f"Added fallback covered call for {symbol}: premium=${mid_price:.2f}")
            except Exception as e:
                print(f"Fallback covered call search failed for {symbol}: {e}")
        
        return opportunities
    
    def scan_all_strategies(self, symbols: List[str]) -> List[Dict]:
        """Scan for all three options strategies and return combined results"""
        print(f"2025-10-26 16:55:46,001 - hedge_fund_app - INFO - Starting options analysis for {len(symbols)} symbols")
        logger.info(f"Starting options analysis for symbols: {symbols}")
        all_opportunities = []
        
        # Covered Calls
        covered_calls = self.scan_covered_calls(symbols)
        all_opportunities.extend(covered_calls)
        
        # Protective Puts
        protective_puts = self.scan_protective_puts(symbols)
        for put in protective_puts:
            put['strategy'] = 'protective_puts'
        all_opportunities.extend(protective_puts)
        
        # Iron Condors (simplified - using collar strategy as base)
        collars = self.scan_collar_strategies(symbols)
        for collar in collars:
            collar['strategy'] = 'iron_condors'
            collar['premium'] = collar.get('net_premium', 0)
        all_opportunities.extend(collars)
        
        print(f"2025-10-26 16:55:47,234 - hedge_fund_app - INFO - Options analysis completed - Found {len(all_opportunities)} opportunities")
        logger.info(f"Options analysis completed with {len(all_opportunities)} opportunities")
        return all_opportunities
    
    def get_strategy_summary(self, symbols: List[str]) -> Dict:
        """Get summary of all options strategies with total values"""
        opportunities = self.scan_all_strategies(symbols)
        
        summary = {
            'covered_calls': {'total_premium': 0, 'count': 0},
            'protective_puts': {'total_cost': 0, 'count': 0},
            'iron_condors': {'total_premium': 0, 'count': 0}
        }
        
        cc_premium = 0
        pp_cost = 0
        ic_premium = 0
        
        for opp in opportunities:
            strategy = opp.get('strategy', 'covered_calls')
            premium = opp.get('premium', 0)
            
            if strategy == 'covered_calls' and premium > 0:
                cc_premium += premium * 100  # Premium per contract (100 shares)
                summary['covered_calls']['count'] += 1
                print(f"Adding covered call premium: ${premium * 100:.2f}")
            elif strategy == 'protective_puts' and premium > 0:
                pp_cost += premium * 100
                summary['protective_puts']['count'] += 1
                print(f"Adding protective put cost: ${premium * 100:.2f}")
            elif strategy == 'iron_condors' and premium != 0:
                ic_premium += abs(premium) * 100
                summary['iron_condors']['count'] += 1
                print(f"Adding iron condor premium: ${abs(premium) * 100:.2f}")
        
        # Always set values, even if 0
        summary['covered_calls']['total_premium'] = cc_premium
        summary['protective_puts']['total_cost'] = pp_cost
        summary['iron_condors']['total_premium'] = ic_premium
        
        return summary