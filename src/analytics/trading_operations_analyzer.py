#!/usr/bin/env python3
"""Trading Operations Analyzer for execution quality analysis"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from datetime import datetime
from core.transactions import Transaction

class TradingOperationsAnalyzer:
    def __init__(self, data_client):
        self.data_client = data_client
    
    def analyze_execution_quality(self, transactions: List[Transaction]) -> Dict:
        """Analyze trade execution quality"""
        if not transactions:
            return self._empty_execution_analysis()
        
        # Group transactions by symbol
        symbol_analysis = {}
        total_volume = 0
        total_fees = 0
        
        for transaction in transactions:
            symbol = transaction.symbol
            if symbol not in symbol_analysis:
                symbol_analysis[symbol] = {
                    'trades': [],
                    'total_volume': 0,
                    'total_fees': 0,
                    'buy_count': 0,
                    'sell_count': 0
                }
            
            trade_volume = abs(transaction.quantity * transaction.price)
            symbol_analysis[symbol]['trades'].append({
                'date': transaction.date,
                'quantity': transaction.quantity,
                'price': transaction.price,
                'volume': trade_volume,
                'fees': transaction.fees,
                'type': transaction.transaction_type
            })
            
            symbol_analysis[symbol]['total_volume'] += trade_volume
            symbol_analysis[symbol]['total_fees'] += transaction.fees
            total_volume += trade_volume
            total_fees += transaction.fees
            
            if transaction.transaction_type == 'BUY':
                symbol_analysis[symbol]['buy_count'] += 1
            elif transaction.transaction_type == 'SELL':
                symbol_analysis[symbol]['sell_count'] += 1
        
        # Calculate execution metrics
        execution_metrics = {}
        for symbol, data in symbol_analysis.items():
            trades = data['trades']
            
            # Calculate average trade size
            avg_trade_size = data['total_volume'] / len(trades) if trades else 0
            
            # Calculate fee rate
            fee_rate = (data['total_fees'] / data['total_volume']) * 10000 if data['total_volume'] > 0 else 0  # in bps
            
            # Calculate trade frequency
            if len(trades) > 1:
                date_range = (max(t['date'] for t in trades) - min(t['date'] for t in trades)).days
                trade_frequency = len(trades) / max(date_range, 1)  # trades per day
            else:
                trade_frequency = 0
            
            execution_metrics[symbol] = {
                'total_trades': len(trades),
                'buy_trades': data['buy_count'],
                'sell_trades': data['sell_count'],
                'total_volume': data['total_volume'],
                'total_fees': data['total_fees'],
                'avg_trade_size': avg_trade_size,
                'fee_rate_bps': fee_rate,
                'trade_frequency': trade_frequency,
                'execution_score': self._calculate_execution_score(fee_rate, avg_trade_size)
            }
        
        # Overall portfolio metrics
        portfolio_metrics = {
            'total_symbols': len(symbol_analysis),
            'total_trades': len(transactions),
            'total_volume': total_volume,
            'total_fees': total_fees,
            'avg_fee_rate_bps': (total_fees / total_volume) * 10000 if total_volume > 0 else 0,
            'avg_trade_size': total_volume / len(transactions) if transactions else 0
        }
        
        return {
            'symbol_analysis': execution_metrics,
            'portfolio_metrics': portfolio_metrics,
            'execution_summary': self._generate_execution_summary(execution_metrics),
            'recommendations': self._generate_recommendations(execution_metrics, portfolio_metrics)
        }
    
    def _calculate_execution_score(self, fee_rate_bps: float, avg_trade_size: float) -> float:
        """Calculate execution quality score (0-100)"""
        # Base score
        score = 100
        
        # Penalize high fees
        if fee_rate_bps > 10:  # > 10 bps
            score -= min(30, (fee_rate_bps - 10) * 2)
        
        # Reward larger trade sizes (better execution)
        if avg_trade_size < 1000:  # Small trades
            score -= 10
        elif avg_trade_size > 10000:  # Large trades
            score += 5
        
        return max(0, min(100, score))
    
    def _generate_execution_summary(self, execution_metrics: Dict) -> Dict:
        """Generate execution quality summary"""
        if not execution_metrics:
            return {}
        
        scores = [metrics['execution_score'] for metrics in execution_metrics.values()]
        fee_rates = [metrics['fee_rate_bps'] for metrics in execution_metrics.values()]
        
        return {
            'avg_execution_score': np.mean(scores),
            'best_execution_symbol': max(execution_metrics.keys(), key=lambda k: execution_metrics[k]['execution_score']),
            'worst_execution_symbol': min(execution_metrics.keys(), key=lambda k: execution_metrics[k]['execution_score']),
            'avg_fee_rate_bps': np.mean(fee_rates),
            'total_symbols_traded': len(execution_metrics)
        }
    
    def _generate_recommendations(self, execution_metrics: Dict, portfolio_metrics: Dict) -> List[str]:
        """Generate trading recommendations"""
        recommendations = []
        
        # High fee analysis
        if portfolio_metrics['avg_fee_rate_bps'] > 15:
            recommendations.append("Consider consolidating trades to reduce fee impact")
        
        # Small trade size analysis
        if portfolio_metrics['avg_trade_size'] < 1000:
            recommendations.append("Increase minimum trade size to improve execution efficiency")
        
        # Frequency analysis
        high_freq_symbols = [symbol for symbol, metrics in execution_metrics.items() 
                           if metrics['trade_frequency'] > 1]  # More than 1 trade per day
        if high_freq_symbols:
            recommendations.append(f"High frequency trading detected in {len(high_freq_symbols)} symbols - consider batch execution")
        
        # Execution score analysis
        poor_execution_symbols = [symbol for symbol, metrics in execution_metrics.items() 
                                if metrics['execution_score'] < 70]
        if poor_execution_symbols:
            recommendations.append(f"Poor execution quality in {len(poor_execution_symbols)} symbols - review execution strategy")
        
        if not recommendations:
            recommendations.append("Execution quality is within acceptable parameters")
        
        return recommendations
    
    def _empty_execution_analysis(self) -> Dict:
        """Return empty execution analysis"""
        return {
            'symbol_analysis': {},
            'portfolio_metrics': {
                'total_symbols': 0,
                'total_trades': 0,
                'total_volume': 0,
                'total_fees': 0,
                'avg_fee_rate_bps': 0,
                'avg_trade_size': 0
            },
            'execution_summary': {},
            'recommendations': ['No transactions to analyze']
        }