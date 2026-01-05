import numpy as np
from typing import Dict, List
from datetime import datetime
from collections import defaultdict
from clients.market_data_client import MarketDataClient
from core.transactions import Transaction

class TradingOperationsAnalyzer:
    """Specialized analyzer for trading operations and performance"""
    
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def analyze_trade_performance(self, txn_portfolio, period='3M', metric='P&L') -> Dict:
        """Analyze trade performance with comprehensive metrics"""
        return self.trade_performance_analysis(txn_portfolio.transactions)
    
    def trade_performance_analysis(self, transactions: List[Transaction], options: Dict = None) -> Dict:
        """Enhanced trade performance analysis delegating to AdvancedTransactionAnalyzer"""
        from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
        
        # Delegate to the advanced analyzer which now handles filtering and advanced metrics
        analyzer = AdvancedTransactionAnalyzer(self.data_client)
        return analyzer.trade_performance_analysis(transactions, options=options)