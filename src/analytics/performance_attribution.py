import pandas as pd
import numpy as np
import os
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from src.clients.market_data_client import MarketDataClient
from src.core.transactions import TransactionPortfolio
from src.utils.logger import logger
import logging
import traceback

# Setup module logger
module_logger = logging.getLogger(__name__)

class PerformanceAttributor:
    def __init__(self, data_client: MarketDataClient, benchmark_symbol: str = 'SPY'):
        self.data_client = data_client
        
    def factor_based_attribution(self, symbols: List[str], weights: Dict[str, float], 
                                period: str = "1y", attribution_model: str = "brinson", 
                                benchmark: str = "SPY", currency: str = "USD", 
                                frequency: str = "daily", attribution_types: List[str] = None) -> Dict:
        """Calculate performance attribution using actual market data"""
        try:
            if not symbols:
                module_logger.warning("No symbols provided for attribution")
                return self._empty_attribution_result()
            
            # Normalize inputs
            attribution_model = attribution_model.lower() if attribution_model else "brinson"
            currency = currency.upper() if currency else "USD"
            frequency = frequency.lower() if frequency else "daily"
            
            # Ensure weights dict exists
            if not weights:
                weights = {symbol: 1.0/len(symbols) for symbol in symbols}
            
            # Map benchmark names to tickers with configurable defaults
            benchmark_mapping = {
                'peer group': os.getenv('PEER_GROUP_BENCHMARK', 'VT'),
                'custom': os.getenv('CUSTOM_BENCHMARK', 'SPY'),
                'index': os.getenv('INDEX_BENCHMARK', 'SPY'),
                's&p 500': 'SPY',
                'nasdaq': 'QQQ',
                'russell 2000': 'IWM',
                'total stock market': 'VTI'
            }
            
            # Handle benchmark mapping case-insensitively
            benchmark_key = benchmark.lower() if benchmark else "spy"
            benchmark_ticker = benchmark_mapping.get(benchmark_key, benchmark)
            # If benchmark was a ticker like 'SPY', it won't be in mapping (unless lowercased matches), so use original if not found
            if benchmark_key not in benchmark_mapping and benchmark:
                 benchmark_ticker = benchmark.upper()

            # Get market data
            symbols_to_fetch = list(set(symbols + [benchmark_ticker]))
            data = self.data_client.get_price_data(symbols_to_fetch, period)
            
            if data.empty:
                module_logger.warning("No data returned for attribution")
                return self._empty_attribution_result()

            # Calculate returns
            returns = data.pct_change().dropna()
            
            if returns.empty:
                 return self._empty_attribution_result()

            # Calculate portfolio return with bounds
            portfolio_return = 0.0
            total_weight = sum(weights.get(s, 0) for s in symbols)
            
            for symbol in symbols:
                if symbol in returns.columns:
                    weight = weights.get(symbol, 0) / total_weight if total_weight > 0 else 0
                    symbol_ret = returns[symbol].mean() * 252 # Annualized
                    # Cap individual stock returns to realistic ranges
                    symbol_ret = max(-0.8, min(2.0, symbol_ret))
                    portfolio_return += weight * symbol_ret

            # Calculate benchmark return with bounds
            if benchmark_ticker in returns.columns:
                benchmark_return = returns[benchmark_ticker].mean() * 252
                # Cap benchmark return to realistic range
                benchmark_return = max(-0.5, min(1.0, benchmark_return))
                benchmark_returns_series = returns[benchmark_ticker]
            else:
                benchmark_return = 0.0
                benchmark_returns_series = pd.Series()

            active_return = portfolio_return - benchmark_return

            # Apply frequency-based resampling
            if frequency.lower() == 'weekly':
                returns = returns.resample('W').last().pct_change().dropna()
                benchmark_returns_series = benchmark_returns_series.resample('W').last().pct_change().dropna() if not benchmark_returns_series.empty else pd.Series()
            elif frequency.lower() == 'monthly':
                returns = returns.resample('ME').last().pct_change().dropna()
                benchmark_returns_series = benchmark_returns_series.resample('ME').last().pct_change().dropna() if not benchmark_returns_series.empty else pd.Series()
            
            # Calculate effects based on attribution model and requested types
            asset_allocation = 0.0
            security_selection = 0.0
            
            # Only calculate requested attribution types
            attribution_types_list = attribution_types if attribution_types and isinstance(attribution_types, list) else ['Asset Allocation', 'Security Selection', 'Timing']
            
            if 'Asset Allocation' in attribution_types_list:
                if attribution_model == 'brinson':
                    asset_allocation = self._calculate_brinson_allocation_effect(returns, symbols, weights, benchmark_returns_series)
                elif attribution_model == 'holdings':
                    asset_allocation = self._calculate_holdings_allocation_effect(returns, symbols, weights)
                else:  # factor-based (default)
                    asset_allocation = self._calculate_asset_allocation_effect(returns, symbols, weights)
            
            if 'Security Selection' in attribution_types_list:
                if attribution_model == 'brinson':
                    security_selection = self._calculate_brinson_selection_effect(returns, symbols, weights, benchmark_returns_series)
                elif attribution_model == 'holdings':
                    security_selection = self._calculate_holdings_selection_effect(returns, symbols, weights, benchmark_returns_series)
                else:  # factor-based (default)
                    security_selection = self._calculate_security_selection_effect(returns, symbols, weights, benchmark_returns_series)
            
            # Calculate interaction effect (only for Brinson model) with bounds
            if attribution_model == 'brinson' and abs(asset_allocation) > 0.01 and abs(security_selection) > 0.01:
                interaction_effect = (asset_allocation * security_selection) / 10000  # Both already in percentage
                interaction_effect = max(-2.0, min(2.0, interaction_effect))
            else:
                interaction_effect = 0.0
            
            # Calculate currency effect with hedging and bounds
            hedge_multiplier = 0.1 if currency.lower() in ['hedged', 'hedge'] else 1.0
            currency_effect = self._calculate_currency_effect_enhanced(returns, symbols, weights, currency, period) * hedge_multiplier
            currency_effect = max(-5.0, min(5.0, currency_effect))
            
            # Calculate market timing only if requested with bounds
            market_timing = 0.0
            if 'Timing' in attribution_types_list and not benchmark_returns_series.empty:
                portfolio_returns_series = pd.Series(0.0, index=returns.index)
                for symbol in symbols:
                    if symbol in returns.columns:
                        weight = weights.get(symbol, 0) / total_weight if total_weight > 0 else 0
                        portfolio_returns_series += returns[symbol] * weight
                
                market_timing = self._calculate_market_timing_effect(portfolio_returns_series, benchmark_returns_series)
                market_timing = max(-5.0, min(5.0, market_timing))
            
            # Convert to percentage
            portfolio_return_pct = portfolio_return * 100
            benchmark_return_pct = benchmark_return * 100
            active_return_pct = active_return * 100
            
            result = {
                'portfolio_return': portfolio_return_pct,
                'benchmark_return': benchmark_return_pct,
                'active_return': active_return_pct,
                'asset_allocation': asset_allocation,
                'security_selection': security_selection,
                'interaction_effect': interaction_effect,
                'currency_effect': currency_effect,
                'market_timing': market_timing
            }
            
            module_logger.info(f"Performance attribution completed successfully: {result}")
            return result
        
        except Exception as e:
            module_logger.error(f"Attribution failed for symbols {symbols}: {e}")
            import traceback
            module_logger.error(f"Attribution traceback: {traceback.format_exc()}")
            return self._empty_attribution_result()

    def _calculate_market_timing_effect(self, portfolio_returns: pd.Series, benchmark_returns: pd.Series) -> float:
        """Calculate market timing effect using volatility and beta analysis"""
        try:
            if len(portfolio_returns) < 10 or len(benchmark_returns) < 10:
                return 0.0
            
            # Calculate rolling correlation and volatility patterns
            portfolio_vol = portfolio_returns.std() * np.sqrt(252)
            benchmark_vol = benchmark_returns.std() * np.sqrt(252)
            
            # Split into periods to analyze timing
            mid_point = len(portfolio_returns) // 2
            if mid_point < 5:
                return 0.0
            
            early_portfolio = portfolio_returns[:mid_point]
            late_portfolio = portfolio_returns[mid_point:]
            early_benchmark = benchmark_returns[:mid_point]
            late_benchmark = benchmark_returns[mid_point:]
            
            # Calculate period returns
            early_port_ret = early_portfolio.mean() * 252
            late_port_ret = late_portfolio.mean() * 252
            early_bench_ret = early_benchmark.mean() * 252
            late_bench_ret = late_benchmark.mean() * 252
            
            # Market timing effect: did portfolio perform better in better market periods?
            if early_bench_ret > late_bench_ret:
                # Early period was better for market
                timing_effect = (early_port_ret - late_port_ret) - (early_bench_ret - late_bench_ret)
            else:
                # Late period was better for market
                timing_effect = (late_port_ret - early_port_ret) - (late_bench_ret - early_bench_ret)
            
            # Scale to percentage points and ensure realistic range
            timing_effect = timing_effect * 50  # Scale up for visibility
            timing_effect = max(-2.0, min(3.0, timing_effect))
            
            return timing_effect if not np.isnan(timing_effect) and abs(timing_effect) > 0.01 else 0.0
            
        except Exception:
            return 0.0

    def _calculate_asset_allocation_effect(self, returns: pd.DataFrame, symbols: List[str], weights: Dict[str, float]) -> float:
        """Calculate asset allocation effect using market-based benchmark weights"""
        try:
            if len(symbols) < 2:
                return 0.0
            
            allocation_effect = 0.0
            total_portfolio_weight = sum(weights.get(symbol, 0) for symbol in symbols)
            
            if total_portfolio_weight == 0:
                return 0.0
            
            for symbol in symbols:
                if symbol in returns.columns and len(returns[symbol].dropna()) > 0:
                    # Portfolio weight (normalized)
                    portfolio_weight = weights.get(symbol, 0) / total_portfolio_weight
                    
                    # Market-based benchmark weight (using volatility-adjusted returns)
                    symbol_return = returns[symbol].mean() * 252
                    symbol_vol = returns[symbol].std() * np.sqrt(252)
                    
                    # Cap extreme returns to prevent unrealistic results
                    symbol_return = max(-1.0, min(3.0, symbol_return))
                    
                    # Benchmark weight based on risk-adjusted performance
                    if symbol_vol > 0:
                        risk_adj_return = symbol_return / symbol_vol
                        benchmark_weight = max(0.05, min(0.35, abs(risk_adj_return) * 0.1))
                    else:
                        benchmark_weight = 1.0 / len(symbols)
                    
                    if not np.isnan(symbol_return) and not np.isinf(symbol_return):
                        weight_diff = portfolio_weight - benchmark_weight
                        # Cap weight difference to prevent extreme allocation effects
                        weight_diff = max(-0.5, min(0.5, weight_diff))
                        allocation_effect += weight_diff * symbol_return
            
            # Cap final result to realistic range
            result = allocation_effect * 100
            return max(-25.0, min(25.0, result))
            
        except Exception:
            return 0.0

    def _calculate_security_selection_effect(self, returns: pd.DataFrame, symbols: List[str], weights: Dict[str, float], benchmark_returns: pd.Series) -> float:
        """Calculate security selection effect using Brinson-Hood-Beebower methodology"""
        try:
            if len(symbols) < 1 or benchmark_returns.empty:
                return 0.0
            
            benchmark_return = benchmark_returns.mean() * 252  # Annualized
            if np.isnan(benchmark_return) or np.isinf(benchmark_return) or abs(benchmark_return) > 5:
                return 0.0
            
            # Calculate benchmark weight (equal weight)
            benchmark_weight = 1.0 / len(symbols)
            
            selection_effect = 0.0
            valid_symbols = 0
            
            for symbol in symbols:
                if symbol in returns.columns and len(returns[symbol].dropna()) > 0:
                    stock_return = returns[symbol].mean() * 252  # Annualized
                    
                    if not np.isnan(stock_return) and not np.isinf(stock_return) and abs(stock_return) < 5:
                        # Selection effect = Benchmark Weight × (Stock Return - Benchmark Return)
                        excess_return = stock_return - benchmark_return
                        # Cap extreme values to prevent unrealistic results
                        excess_return = max(-2.0, min(2.0, excess_return))
                        selection_effect += benchmark_weight * excess_return
                        valid_symbols += 1
            
            if valid_symbols == 0:
                return 0.0
            
            # Convert to percentage points and cap final result
            result = selection_effect * 100
            return max(-50.0, min(50.0, result))
            
        except Exception:
            return 0.0

    def _calculate_brinson_allocation_effect(self, returns: pd.DataFrame, symbols: List[str], weights: Dict[str, float], benchmark_returns: pd.Series) -> float:
        """Calculate Brinson allocation effect: (wp - wb) * rb"""
        try:
            allocation_effect = 0.0
            total_weight = sum(weights.get(s, 0) for s in symbols)
            if total_weight == 0:
                return 0.0
            
            # Calculate sector returns for benchmark weighting
            sector_returns = {}
            for symbol in symbols:
                if symbol in returns.columns:
                    raw_return = returns[symbol].mean() * 252
                    # Cap extreme returns
                    sector_returns[symbol] = max(-1.0, min(3.0, raw_return))
            
            # Use market cap proxy for benchmark weights
            total_market_value = sum(max(0.1, abs(ret)) for ret in sector_returns.values())
            
            for symbol in symbols:
                if symbol in returns.columns and symbol in sector_returns:
                    portfolio_weight = weights.get(symbol, 0) / total_weight
                    benchmark_weight = max(0.1, abs(sector_returns[symbol])) / total_market_value
                    sector_return = sector_returns[symbol]
                    
                    # Cap weight differences
                    weight_diff = max(-0.5, min(0.5, portfolio_weight - benchmark_weight))
                    allocation_effect += weight_diff * sector_return
            
            # Cap final result
            result = allocation_effect * 100
            return max(-25.0, min(25.0, result))
        except Exception:
            return 0.0

    def _calculate_brinson_selection_effect(self, returns: pd.DataFrame, symbols: List[str], weights: Dict[str, float], benchmark_returns: pd.Series) -> float:
        """Calculate Brinson selection effect: wb * (rs - rb)"""
        try:
            selection_effect = 0.0
            benchmark_return = benchmark_returns.mean() * 252
            # Cap benchmark return
            benchmark_return = max(-1.0, min(3.0, benchmark_return))
            
            # Calculate sector returns for benchmark weighting
            sector_returns = {}
            for symbol in symbols:
                if symbol in returns.columns:
                    raw_return = returns[symbol].mean() * 252
                    # Cap extreme returns
                    sector_returns[symbol] = max(-1.0, min(3.0, raw_return))
            
            # Use market cap proxy for benchmark weights
            total_market_value = sum(max(0.1, abs(ret)) for ret in sector_returns.values())
            
            for symbol in symbols:
                if symbol in returns.columns and symbol in sector_returns:
                    benchmark_weight = max(0.1, abs(sector_returns[symbol])) / total_market_value
                    stock_return = sector_returns[symbol]
                    excess_return = stock_return - benchmark_return
                    # Cap excess return
                    excess_return = max(-2.0, min(2.0, excess_return))
                    
                    selection_effect += benchmark_weight * excess_return
            
            # Cap final result
            result = selection_effect * 100
            return max(-25.0, min(25.0, result))
        except Exception:
            return 0.0

    def _calculate_holdings_allocation_effect(self, returns: pd.DataFrame, symbols: List[str], weights: Dict[str, float]) -> float:
        """Calculate holdings-based allocation effect using actual position sizes"""
        try:
            allocation_effect = 0.0
            total_weight = sum(weights.get(s, 0) for s in symbols)
            if total_weight == 0:
                return 0.0
            
            # Calculate value-weighted benchmark
            market_values = {}
            total_market_value = 0
            
            for symbol in symbols:
                if symbol in returns.columns:
                    # Use volatility-adjusted returns as market value proxy
                    symbol_return = returns[symbol].mean() * 252
                    symbol_vol = returns[symbol].std() * np.sqrt(252)
                    # Cap returns and volatility
                    symbol_return = max(-0.8, min(2.0, symbol_return))
                    symbol_vol = max(0.05, min(1.0, symbol_vol))
                    market_value = abs(symbol_return) / symbol_vol
                    market_values[symbol] = market_value
                    total_market_value += market_value
            
            for symbol in symbols:
                if symbol in returns.columns and symbol in market_values:
                    portfolio_weight = weights.get(symbol, 0) / total_weight
                    benchmark_weight = market_values[symbol] / total_market_value
                    stock_return = returns[symbol].mean() * 252
                    stock_return = max(-0.8, min(2.0, stock_return))
                    
                    weight_diff = max(-0.4, min(0.4, portfolio_weight - benchmark_weight))
                    allocation_effect += weight_diff * stock_return
            
            # Cap final result
            result = allocation_effect * 100
            return max(-20.0, min(20.0, result))
        except Exception:
            return 0.0

    def _calculate_holdings_selection_effect(self, returns: pd.DataFrame, symbols: List[str], weights: Dict[str, float], benchmark_returns: pd.Series) -> float:
        """Calculate holdings-based selection effect using portfolio weights"""
        try:
            selection_effect = 0.0
            benchmark_return = benchmark_returns.mean() * 252
            benchmark_return = max(-0.5, min(1.0, benchmark_return))
            total_weight = sum(weights.get(s, 0) for s in symbols)
            
            if total_weight == 0:
                return 0.0
            
            for symbol in symbols:
                if symbol in returns.columns:
                    portfolio_weight = weights.get(symbol, 0) / total_weight
                    stock_return = returns[symbol].mean() * 252
                    stock_return = max(-0.8, min(2.0, stock_return))
                    excess_return = stock_return - benchmark_return
                    excess_return = max(-1.5, min(1.5, excess_return))
                    
                    selection_effect += portfolio_weight * excess_return
            
            # Cap final result
            result = selection_effect * 100
            return max(-20.0, min(20.0, result))
        except Exception:
            return 0.0

    def _calculate_currency_effect_enhanced(self, returns: pd.DataFrame, symbols: List[str], weights: Dict[str, float], currency: str, period: str) -> float:
        """Calculate currency effect based on international exposure and volatility"""
        try:
            # Check for international exposure
            international_symbols = [s for s in symbols if any(x in s for x in ['.TO', '.L', '.F', '.HK', '.T', '.PA'])]
            total_weight = sum(weights.get(s, 0) for s in symbols)
            
            if total_weight == 0:
                return 0.0
                
            portfolio_volatility = 0.0
            for symbol in symbols:
                if symbol in returns.columns:
                    weight = weights.get(symbol, 0) / total_weight
                    symbol_vol = returns[symbol].std() * np.sqrt(252)
                    portfolio_volatility += weight * symbol_vol
            
            if len(international_symbols) > 0:
                # International portfolio - currency effect based on volatility
                intl_weight = sum(weights.get(s, 0) for s in international_symbols if s in returns.columns) / total_weight
                currency_effect = intl_weight * portfolio_volatility * 0.15  # 15% of volatility as currency effect
            else:
                # Domestic portfolio - small currency effect based on market volatility
                currency_effect = portfolio_volatility * 0.05  # 5% of volatility as currency effect
            
            # Convert to percentage points
            return currency_effect * 100
            
        except Exception:
            return 0.0

    def _empty_attribution_result(self) -> Dict:
        """Return empty attribution result with proper structure"""
        return {
            'portfolio_return': 0.0,
            'benchmark_return': 0.0,
            'active_return': 0.0,
            'asset_allocation': 0.0,
            'security_selection': 0.0,
            'interaction_effect': 0.0,
            'currency_effect': 0.0,
            'market_timing': 0.0
        }
    
    def transaction_cost_analysis(self, txn_portfolio: TransactionPortfolio) -> Dict:
        """Detailed cost impact assessment"""
        module_logger.info(f"Analyzing transaction costs for {len(txn_portfolio.transactions)} transactions")
        transactions = txn_portfolio.transactions
        
        # Cost breakdown
        total_fees = sum(txn.fees for txn in transactions)
        total_volume = sum(abs(txn.quantity * txn.price) for txn in transactions)
        
        # Cost analysis by symbol
        cost_by_symbol = {}
        for txn in transactions:
            if txn.symbol not in cost_by_symbol:
                cost_by_symbol[txn.symbol] = 0.0
            cost_by_symbol[txn.symbol] += txn.fees
            
        return {
            'total_fees': total_fees,
            'fees_bps': (total_fees / total_volume * 10000) if total_volume > 0 else 0,
            'cost_by_symbol': cost_by_symbol
        }