#!/usr/bin/env python3
"""Professional Parallel Analytics Engine for Portfolio and Transaction Analysis"""

import asyncio
import concurrent.futures
from typing import Dict, List, Any, Optional
from datetime import datetime
import pandas as pd
import numpy as np
from dataclasses import dataclass
from utils.logger import logger

@dataclass
class AnalyticsResult:
    task_name: str
    success: bool
    data: Dict[str, Any]
    execution_time: float
    error: Optional[str] = None

class ParallelAnalyticsEngine:
    def __init__(self, data_client, max_workers: int = 6):
        self.data_client = data_client
        self.max_workers = max_workers
        self.executor = concurrent.futures.ThreadPoolExecutor(max_workers=max_workers)
    
    async def calculate_portfolio_analytics_parallel(self, portfolio_data: List[Dict], symbols: List[str], weights: Dict[str, float]) -> Dict[str, Any]:
        """Calculate all portfolio analytics in parallel"""
        start_time = datetime.now()
        
        tasks = [
            self._run_portfolio_task("risk_analytics", self._calculate_risk_analytics, symbols, weights),
            self._run_portfolio_task("options_analytics", self._calculate_options_analytics, symbols),
            self._run_portfolio_task("technical_analytics", self._calculate_technical_analytics, symbols),
            self._run_portfolio_task("sector_analytics", self._calculate_sector_analytics, symbols, weights),
            self._run_portfolio_task("monte_carlo", self._calculate_monte_carlo, symbols, weights),
            self._run_portfolio_task("performance_attribution", self._calculate_performance_attribution, symbols, weights)
        ]
        
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=30.0
            )
        except asyncio.TimeoutError:
            logger.warning("Portfolio analytics timeout - using partial results")
            results = []
        
        # Combine results
        analytics_data = {
            "calculation_timestamp": datetime.now().isoformat(),
            "total_execution_time": (datetime.now() - start_time).total_seconds(),
            "portfolio_symbols": symbols,
            "portfolio_weights": weights
        }
        
        for result in results:
            if isinstance(result, AnalyticsResult) and result.success:
                analytics_data[result.task_name] = result.data
            elif isinstance(result, AnalyticsResult):
                logger.warning(f"Portfolio task {result.task_name} failed: {result.error}")
                analytics_data[result.task_name] = {"error": result.error}
            else:
                logger.error(f"Unexpected result type: {type(result)}")
        
        logger.info(f"Portfolio analytics completed in {analytics_data['total_execution_time']:.2f}s")
        return analytics_data
    
    async def calculate_transaction_analytics_parallel(self, transactions_data: List[Dict]) -> Dict[str, Any]:
        """Calculate all transaction analytics in parallel"""
        start_time = datetime.now()
        
        tasks = [
            self._run_transaction_task("pnl_analysis", self._calculate_pnl_analysis, transactions_data),
            self._run_transaction_task("trade_performance", self._calculate_trade_performance, transactions_data),
            self._run_transaction_task("turnover_analysis", self._calculate_turnover_analysis, transactions_data),
            self._run_transaction_task("tax_analysis", self._calculate_tax_analysis, transactions_data),
            self._run_transaction_task("cash_flow_analysis", self._calculate_cash_flow_analysis, transactions_data),
            self._run_transaction_task("timing_analysis", self._calculate_timing_analysis, transactions_data),
            self._run_transaction_task("drawdown_analysis", self._calculate_drawdown_analysis, transactions_data),
            self._run_transaction_task("xirr_analysis", self._calculate_xirr_analysis, transactions_data),
            self._run_transaction_task("trading_operations", self._calculate_trading_operations, transactions_data)
        ]
        
        try:
            results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=30.0
            )
        except asyncio.TimeoutError:
            logger.warning("Transaction analytics timeout - using partial results")
            results = []
        
        # Combine results
        analytics_data = {
            "calculation_timestamp": datetime.now().isoformat(),
            "total_execution_time": (datetime.now() - start_time).total_seconds(),
            "total_transactions": len(transactions_data)
        }
        
        for result in results:
            if isinstance(result, AnalyticsResult) and result.success:
                analytics_data[result.task_name] = result.data
            elif isinstance(result, AnalyticsResult):
                logger.warning(f"Transaction task {result.task_name} failed: {result.error}")
                analytics_data[result.task_name] = {"error": result.error}
            else:
                logger.error(f"Unexpected result type: {type(result)}")
        
        logger.info(f"Transaction analytics completed in {analytics_data['total_execution_time']:.2f}s")
        return analytics_data
    
    async def _run_portfolio_task(self, task_name: str, func, *args) -> AnalyticsResult:
        """Run portfolio analytics task with error handling"""
        start_time = datetime.now()
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(self.executor, func, *args)
            execution_time = (datetime.now() - start_time).total_seconds()
            return AnalyticsResult(task_name, True, result, execution_time)
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            logger.error(f"Portfolio task {task_name} failed: {str(e)}")
            return AnalyticsResult(task_name, False, {}, execution_time, str(e))
    
    async def _run_transaction_task(self, task_name: str, func, *args) -> AnalyticsResult:
        """Run transaction analytics task with error handling"""
        start_time = datetime.now()
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(self.executor, func, *args)
            execution_time = (datetime.now() - start_time).total_seconds()
            return AnalyticsResult(task_name, True, result, execution_time)
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            logger.error(f"Transaction task {task_name} failed: {str(e)}")
            return AnalyticsResult(task_name, False, {}, execution_time, str(e))
    
    # Portfolio Analytics Tasks
    def _calculate_risk_analytics(self, symbols: List[str], weights: Dict[str, float]) -> Dict[str, Any]:
        from analytics.risk_analytics import RiskAnalyzer
        risk_analyzer = RiskAnalyzer(self.data_client)
        return risk_analyzer.analyze_portfolio_risk_fast(symbols, weights)
    
    def _calculate_options_analytics(self, symbols: List[str]) -> Dict[str, Any]:
        from analytics.options_analytics import OptionsAnalyzer
        options_analyzer = OptionsAnalyzer(self.data_client)
        opportunities = options_analyzer.scan_all_strategies(symbols)
        summary = options_analyzer.get_strategy_summary(symbols)
        return {"opportunities": opportunities, "summary": summary}
    
    def _calculate_technical_analytics(self, symbols: List[str]) -> Dict[str, Any]:
        from analytics.technical_indicators import TechnicalIndicators
        tech_analyzer = TechnicalIndicators(self.data_client)
        results = {}
        for symbol in symbols:
            try:
                results[symbol] = tech_analyzer.calculate_all_indicators(symbol)
            except Exception as e:
                results[symbol] = {"error": str(e)}
        return results
    
    def _calculate_sector_analytics(self, symbols: List[str], weights: Dict[str, float]) -> Dict[str, Any]:
        from analytics.sector_analysis import SectorAnalyzer
        from core.portfolio import Portfolio, Position
        sector_analyzer = SectorAnalyzer(self.data_client)
        
        # Create positions for sector analysis
        positions = [Position(symbol, weights.get(symbol, 0) * 1000, 100.0) for symbol in symbols]
        
        sector_results = sector_analyzer.analyze_sector_allocation(symbols, weights, positions)
        performance_results = sector_analyzer.get_sector_performance(symbols)
        style_results = sector_analyzer.analyze_style_factors(symbols, weights)
        
        return {
            "sector_allocation": sector_results,
            "sector_performance": performance_results,
            "style_analysis": style_results
        }
    
    def _calculate_monte_carlo(self, symbols: List[str], weights: Dict[str, float]) -> Dict[str, Any]:
        from monte_carlo_v3 import MonteCarloEngine
        mc_engine = MonteCarloEngine(self.data_client)
        return mc_engine.portfolio_simulation(symbols, weights, time_horizon=252, num_simulations=5000)
    
    def _calculate_performance_attribution(self, symbols: List[str], weights: Dict[str, float]) -> Dict[str, Any]:
        try:
            from analytics.performance_attribution import PerformanceAttributor
            attributor = PerformanceAttributor(self.data_client)
            attribution_results = attributor.factor_based_attribution(symbols, weights)
            attribution_summary = attributor.get_attribution_summary(symbols, weights)
            return {"attribution": attribution_results, "summary": attribution_summary}
        except ImportError:
            return {"error": "Performance attribution module not available"}
    
    # Transaction Analytics Tasks
    def _calculate_pnl_analysis(self, transactions_data: List[Dict]) -> Dict[str, Any]:
        from core.transactions import TransactionPortfolio, Transaction
        from analytics.transaction_processor import TransactionProcessor
        
        transactions = self._convert_to_transactions(transactions_data)
        txn_portfolio = TransactionPortfolio(transactions)
        processor = TransactionProcessor(self.data_client)
        return processor.calculate_pnl(txn_portfolio)
    
    def _calculate_trade_performance(self, transactions_data: List[Dict]) -> Dict[str, Any]:
        from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
        transactions = self._convert_to_transactions(transactions_data)
        analyzer = AdvancedTransactionAnalyzer(self.data_client)
        return analyzer.trade_performance_analysis(transactions)
    
    def _calculate_turnover_analysis(self, transactions_data: List[Dict]) -> Dict[str, Any]:
        from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
        transactions = self._convert_to_transactions(transactions_data)
        analyzer = AdvancedTransactionAnalyzer(self.data_client)
        return analyzer.turnover_analysis(transactions)
    
    def _calculate_tax_analysis(self, transactions_data: List[Dict]) -> Dict[str, Any]:
        from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
        transactions = self._convert_to_transactions(transactions_data)
        analyzer = AdvancedTransactionAnalyzer(self.data_client)
        return analyzer.tax_loss_harvesting_analysis(transactions)
    
    def _calculate_cash_flow_analysis(self, transactions_data: List[Dict]) -> Dict[str, Any]:
        from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
        transactions = self._convert_to_transactions(transactions_data)
        analyzer = AdvancedTransactionAnalyzer(self.data_client)
        return analyzer.cash_flow_analysis(transactions)
    
    def _calculate_timing_analysis(self, transactions_data: List[Dict]) -> Dict[str, Any]:
        from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
        transactions = self._convert_to_transactions(transactions_data)
        analyzer = AdvancedTransactionAnalyzer(self.data_client)
        return analyzer.trade_timing_analysis(transactions)
    
    def _calculate_drawdown_analysis(self, transactions_data: List[Dict]) -> Dict[str, Any]:
        from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
        transactions = self._convert_to_transactions(transactions_data)
        analyzer = AdvancedTransactionAnalyzer(self.data_client)
        return analyzer.drawdown_analysis(transactions)
    
    def _calculate_xirr_analysis(self, transactions_data: List[Dict]) -> Dict[str, Any]:
        from analytics.xirr_analyzer import DetailedXIRRAnalyzer
        from core.transactions import Transaction
        
        # Convert to Transaction objects
        transactions = self._convert_to_transactions(transactions_data)
        
        # Initialize analyzer
        analyzer = DetailedXIRRAnalyzer()
        analyzer.load_transactions(transactions)
        
        # Get current prices
        symbols = list(set(tx.symbol for tx in transactions))
        current_prices = {}
        for symbol in symbols:
            try:
                current_prices[symbol] = self.data_client.get_current_prices([symbol]).get(symbol, 100.0)
            except:
                current_prices[symbol] = 100.0
        
        # Calculate XIRR using upgraded analyzer
        detailed_metrics = analyzer.calculate_detailed_xirr(current_prices)
        
        return {
            "xirr": detailed_metrics.xirr,
            "twr": detailed_metrics.twr,
            "total_return": detailed_metrics.total_return,
            "annualized_return": detailed_metrics.annualized_return,
            "volatility": detailed_metrics.volatility,
            "sharpe_ratio": detailed_metrics.sharpe_ratio,
            "max_drawdown": detailed_metrics.max_drawdown
        }
    
    def _calculate_trading_operations(self, transactions_data: List[Dict]) -> Dict[str, Any]:
        from analytics.trading_operations_analyzer import TradingOperationsAnalyzer
        transactions = self._convert_to_transactions(transactions_data)
        analyzer = TradingOperationsAnalyzer(self.data_client)
        return analyzer.analyze_execution_quality(transactions)
    
    def _convert_to_transactions(self, transactions_data: List[Dict]) -> List:
        """Convert transaction data to Transaction objects"""
        from core.transactions import Transaction
        
        transactions = []
        for tx_data in transactions_data:
            date_str = tx_data.get('date', '')
            if isinstance(date_str, str):
                try:
                    if 'T' in date_str:
                        date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    else:
                        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                except ValueError:
                    date_obj = datetime.strptime(date_str.split('T')[0], '%Y-%m-%d')
            else:
                date_obj = tx_data.get('date')
            
            transaction = Transaction(
                symbol=tx_data.get('symbol', ''),
                quantity=float(tx_data.get('quantity', 0)),
                price=float(tx_data.get('price', 0)),
                date=date_obj,
                transaction_type=tx_data.get('transaction_type', ''),
                fees=float(tx_data.get('fees', 0)),
                portfolio=tx_data.get('portfolio', 'Main'),
                currency=tx_data.get('currency', 'USD')
            )
            transactions.append(transaction)
        
        return transactions
    
    def __del__(self):
        """Cleanup executor on deletion"""
        if hasattr(self, 'executor'):
            self.executor.shutdown(wait=False)