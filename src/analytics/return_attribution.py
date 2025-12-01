import pandas as pd
import numpy as np
from typing import Dict, List
from datetime import datetime
from src.clients.market_data_client import MarketDataClient
from src.core.transactions import TransactionPortfolio
import logging

module_logger = logging.getLogger(__name__)

class ReturnAttributor:
    def __init__(self, data_client: MarketDataClient, benchmark_symbol: str = 'SPY'):
        self.data_client = data_client
        self.benchmark_symbol = benchmark_symbol
    
    def transaction_based_attribution(self, symbols: List[str], weights: Dict[str, float], 
                                    period: str = "1y", attribution_model: str = "brinson", 
                                    benchmark: str = "SPY", currency: str = "USD", 
                                    frequency: str = "daily", attribution_types: List[str] = None) -> Dict:
        """Calculate return attribution using transaction-based methodology"""
        try:
            if not symbols:
                return self._empty_attribution_result()
            
            # Get market data
            symbols_to_fetch = list(set(symbols + [benchmark]))
            data = self.data_client.get_price_data(symbols_to_fetch, period)
            
            if data.empty:
                return self._empty_attribution_result()

            # Calculate returns
            returns = data.pct_change().dropna()
            
            if returns.empty:
                return self._empty_attribution_result()

            # Calculate portfolio return
            portfolio_return = self._calculate_weighted_return(returns, symbols, weights)
            
            # Calculate benchmark return
            benchmark_return = 0.0
            if benchmark in returns.columns:
                benchmark_return = returns[benchmark].mean() * 252
                module_logger.info(f"Benchmark calculation:")
                module_logger.info(f"  Benchmark symbol: {benchmark}")
                module_logger.info(f"  Benchmark daily mean return: {returns[benchmark].mean()}")
                module_logger.info(f"  Benchmark annualized return: {benchmark_return}")
            else:
                module_logger.warning(f"Benchmark {benchmark} not found in data columns: {list(returns.columns)}")

            active_return = portfolio_return - benchmark_return

            # Calculate attribution effects with transaction-based logic
            asset_allocation = self._calculate_transaction_allocation_effect(returns, symbols, weights)
            security_selection = self._calculate_transaction_selection_effect(returns, symbols, weights, benchmark_return)
            timing_effect = self._calculate_transaction_timing_effect(returns, symbols, weights)
            
            # Debug logging
            module_logger.info(f"Attribution calculation debug:")
            module_logger.info(f"  Symbols: {symbols}")
            module_logger.info(f"  Weights: {weights}")
            module_logger.info(f"  Portfolio return: {portfolio_return}")
            module_logger.info(f"  Benchmark return: {benchmark_return}")
            module_logger.info(f"  Asset allocation: {asset_allocation}")
            module_logger.info(f"  Security selection: {security_selection}")
            module_logger.info(f"  Timing effect: {timing_effect}")
            
            # Calculate interaction effect (Brinson model)
            interaction_effect = 0.0
            total_weight = sum(weights.get(s, 0) for s in symbols)
            if total_weight > 0:
                benchmark_weight = 1.0 / len(symbols)
                module_logger.info(f"Interaction effect calculation:")
                module_logger.info(f"  Total weight: {total_weight}")
                module_logger.info(f"  Benchmark weight per symbol: {benchmark_weight}")
                for symbol in symbols:
                    if symbol in returns.columns:
                        portfolio_weight = weights.get(symbol, 0) / total_weight
                        stock_return = returns[symbol].mean() * 252
                        weight_diff = portfolio_weight - benchmark_weight
                        return_diff = stock_return - benchmark_return
                        symbol_interaction = weight_diff * return_diff
                        interaction_effect += symbol_interaction
                        module_logger.info(f"  {symbol}: pw={portfolio_weight:.4f}, wd={weight_diff:.4f}, rd={return_diff:.4f}, int={symbol_interaction:.4f}")
                interaction_effect *= 100
                module_logger.info(f"  Final interaction effect: {interaction_effect}")
            
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
                'currency_effect': 0.0 if currency == 'USD' else None,  # Zero for single USD currency
                'market_timing': timing_effect
            }
            
            module_logger.info(f"Final attribution result: {result}")
            
            return result
        
        except Exception as e:
            module_logger.error(f"Transaction attribution failed: {e}")
            import traceback
            module_logger.error(f"Traceback: {traceback.format_exc()}")
            return self._empty_attribution_result()

    def _calculate_weighted_return(self, returns: pd.DataFrame, symbols: List[str], weights: Dict[str, float]) -> float:
        """Calculate weighted portfolio return"""
        portfolio_return = 0.0
        total_weight = sum(weights.get(s, 0) for s in symbols)
        
        if total_weight == 0:
            return 0.0
        
        for symbol in symbols:
            if symbol in returns.columns:
                weight = weights.get(symbol, 0) / total_weight
                symbol_ret = returns[symbol].mean() * 252  # Annualized
                portfolio_return += weight * symbol_ret

        return portfolio_return

    def _calculate_transaction_allocation_effect(self, returns: pd.DataFrame, symbols: List[str], weights: Dict[str, float]) -> float:
        """Calculate allocation effect for transaction-based attribution"""
        try:
            if len(symbols) < 2:
                return 0.0
            
            allocation_effect = 0.0
            total_weight = sum(weights.get(s, 0) for s in symbols)
            
            if total_weight == 0:
                return 0.0
            
            # Use equal weight as benchmark
            benchmark_weight = 1.0 / len(symbols)
            
            for symbol in symbols:
                if symbol in returns.columns:
                    portfolio_weight = weights.get(symbol, 0) / total_weight
                    symbol_return = returns[symbol].mean() * 252
                    weight_diff = portfolio_weight - benchmark_weight
                    allocation_effect += weight_diff * symbol_return
            
            # Convert to percentage
            return allocation_effect * 100
            
        except Exception:
            return 0.0

    def _calculate_transaction_selection_effect(self, returns: pd.DataFrame, symbols: List[str], weights: Dict[str, float], benchmark_return: float) -> float:
        """Calculate selection effect for transaction-based attribution"""
        try:
            selection_effect = 0.0
            total_weight = sum(weights.get(s, 0) for s in symbols)
            
            if total_weight == 0:
                return 0.0
            
            for symbol in symbols:
                if symbol in returns.columns:
                    portfolio_weight = weights.get(symbol, 0) / total_weight
                    stock_return = returns[symbol].mean() * 252
                    excess_return = stock_return - benchmark_return
                    selection_effect += portfolio_weight * excess_return
            
            # Convert to percentage
            return selection_effect * 100
            
        except Exception:
            return 0.0

    def _calculate_transaction_timing_effect(self, returns: pd.DataFrame, symbols: List[str], weights: Dict[str, float]) -> float:
        """Calculate timing effect for transaction-based attribution"""
        try:
            if len(returns) < 10:  # Need minimum data
                return 0.0
            
            timing_effect = 0.0
            total_weight = sum(weights.get(s, 0) for s in symbols)
            
            if total_weight == 0:
                return 0.0
            
            # Calculate timing effect based on correlation between weights and returns
            portfolio_weights = []
            portfolio_returns = []
            
            for symbol in symbols:
                if symbol in returns.columns:
                    weight = weights.get(symbol, 0) / total_weight
                    symbol_returns = returns[symbol].values
                    
                    portfolio_weights.extend([weight] * len(symbol_returns))
                    portfolio_returns.extend(symbol_returns)
            
            if len(portfolio_weights) > 1 and len(portfolio_returns) > 1:
                correlation = np.corrcoef(portfolio_weights, portfolio_returns)[0, 1]
                if not np.isnan(correlation):
                    timing_effect = correlation * np.std(portfolio_returns) * np.sqrt(252)
            
            # Convert to percentage
            return timing_effect * 100
            
        except Exception:
            return 0.0

    def _empty_attribution_result(self) -> Dict:
        """Return empty attribution result when no data available"""
        return {
            'portfolio_return': None,
            'benchmark_return': None,
            'active_return': None,
            'asset_allocation': None,
            'security_selection': None,
            'interaction_effect': None,
            'currency_effect': None,
            'market_timing': None
        }