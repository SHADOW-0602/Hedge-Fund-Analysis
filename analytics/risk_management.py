import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from clients.market_data_client import MarketDataClient
from analytics.statistical_analysis import StatisticalAnalyzer
from monte_carlo_v3 import MonteCarloEngine

class RiskManager:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
        self.statistical_analyzer = StatisticalAnalyzer(data_client)
        self.monte_carlo = MonteCarloEngine(data_client)
        
    def real_time_risk_monitoring(self, symbols: List[str], weights: Dict[str, float], 
                                 risk_limits: Dict[str, float]) -> Dict:
        """Live VaR, CVaR, and drawdown tracking"""
        
        # Get current market data
        price_data = self.data_client.get_price_data(symbols, "1y")
        returns = price_data.pct_change().dropna()
        current_prices = self.data_client.get_current_prices(symbols)
        
        # Calculate portfolio returns
        weight_array = np.array([weights.get(symbol, 0) for symbol in symbols])
        portfolio_returns = np.dot(returns, weight_array)
        
        # Risk metrics
        current_vol = portfolio_returns.std() * np.sqrt(252)
        var_5 = np.percentile(portfolio_returns, 5)
        cvar_5 = portfolio_returns[portfolio_returns <= var_5].mean()
        
        # Drawdown calculation
        cumulative = (1 + portfolio_returns).cumprod()
        running_max = cumulative.expanding().max()
        current_drawdown = (cumulative.iloc[-1] - running_max.iloc[-1]) / running_max.iloc[-1]
        max_drawdown = ((cumulative - running_max) / running_max).min()
        
        # Risk limit checks
        risk_alerts = []
        if current_vol > risk_limits.get('max_volatility', 0.25):
            risk_alerts.append(f"Volatility breach: {current_vol:.2%} > {risk_limits['max_volatility']:.2%}")
        
        if abs(current_drawdown) > risk_limits.get('max_drawdown', 0.15):
            risk_alerts.append(f"Drawdown breach: {current_drawdown:.2%}")
        
        if abs(var_5) > risk_limits.get('max_var', 0.05):
            risk_alerts.append(f"VaR breach: {var_5:.2%}")
        
        return {
            'timestamp': datetime.now(),
            'volatility': current_vol,
            'var_5': var_5,
            'cvar_5': cvar_5,
            'current_drawdown': current_drawdown,
            'max_drawdown': max_drawdown,
            'risk_alerts': risk_alerts,
            'risk_score': len(risk_alerts) / len(risk_limits)  # 0-1 scale
        }
    
    def stress_testing(self, symbols: List[str], weights: Dict[str, float], 
                      stress_scenarios: Dict[str, Dict]) -> Dict:
        """Monte Carlo scenario analysis"""
        
        results = {}
        
        for scenario_name, scenario_params in stress_scenarios.items():
            # Run Monte Carlo with stress parameters
            mc_results = self.monte_carlo.scenario_analysis(symbols, weights, {scenario_name: scenario_params})
            
            if scenario_name in mc_results:
                scenario_result = mc_results[scenario_name]
                
                results[scenario_name] = {
                    'expected_return': scenario_result['mean_return'],
                    'volatility': scenario_result['volatility'],
                    'var_5': scenario_result['var_5'],
                    'probability_loss': scenario_result['probability_loss'],
                    'stress_level': scenario_params.get('stress_multiplier', 1.0)
                }
        
        return results
    
    def concentration_risk_analysis(self, symbols: List[str], weights: Dict[str, float]) -> Dict:
        """Portfolio concentration and correlation analysis"""
        
        # Correlation analysis
        corr_analysis = self.statistical_analyzer.correlation_analysis(symbols)
        
        # Concentration metrics
        weight_values = list(weights.values())
        herfindahl_index = sum(w**2 for w in weight_values)
        effective_positions = 1 / herfindahl_index if herfindahl_index > 0 else 0
        max_weight = max(weight_values) if weight_values else 0
        
        # Diversification ratio
        diversification_ratio = self.statistical_analyzer.diversification_ratio(symbols, weights)
        
        # Risk concentration by sector/correlation clusters
        clustering = self.statistical_analyzer.hierarchical_clustering(symbols)
        
        cluster_weights = {}
        for cluster_id, cluster_data in clustering['cluster_stats'].items():
            cluster_weight = sum(weights.get(symbol, 0) for symbol in cluster_data['symbols'])
            cluster_weights[f'Cluster_{cluster_id}'] = cluster_weight
        
        return {
            'herfindahl_index': herfindahl_index,
            'effective_positions': effective_positions,
            'max_position_weight': max_weight,
            'diversification_ratio': diversification_ratio,
            'avg_correlation': corr_analysis['avg_correlation'],
            'cluster_concentrations': cluster_weights,
            'concentration_risk': 'HIGH' if max_weight > 0.2 or effective_positions < 5 else 'MEDIUM' if max_weight > 0.1 else 'LOW'
        }
    
    def liquidity_risk_assessment(self, symbols: List[str], position_sizes: Dict[str, float]) -> Dict:
        """Position-level liquidity assessment"""
        
        liquidity_metrics = {}
        
        for symbol in symbols:
            try:
                # Get volume data (simplified - would use actual volume data)
                price_data = self.data_client.get_price_data([symbol], "3m")
                
                if symbol in price_data.columns:
                    # Estimate liquidity based on price volatility (proxy for volume)
                    returns = price_data[symbol].pct_change().dropna()
                    volatility = returns.std()
                    
                    # Liquidity score (inverse of volatility)
                    liquidity_score = 1 / (1 + volatility * 100)  # Normalized 0-1
                    
                    position_size = position_sizes.get(symbol, 0)
                    
                    # Estimate days to liquidate (simplified)
                    # In reality, this would use actual volume data
                    estimated_daily_volume = 1000000  # Placeholder
                    days_to_liquidate = position_size / estimated_daily_volume if estimated_daily_volume > 0 else 999
                    
                    liquidity_risk = 'HIGH' if days_to_liquidate > 5 else 'MEDIUM' if days_to_liquidate > 1 else 'LOW'
                    
                    liquidity_metrics[symbol] = {
                        'liquidity_score': liquidity_score,
                        'days_to_liquidate': min(days_to_liquidate, 999),
                        'liquidity_risk': liquidity_risk,
                        'position_size': position_size
                    }
            except:
                liquidity_metrics[symbol] = {
                    'liquidity_score': 0.5,
                    'days_to_liquidate': 999,
                    'liquidity_risk': 'UNKNOWN',
                    'position_size': position_sizes.get(symbol, 0)
                }
        
        # Portfolio-level liquidity
        total_position_value = sum(position_sizes.values())
        weighted_liquidity = sum(
            metrics['liquidity_score'] * (position_sizes.get(symbol, 0) / total_position_value)
            for symbol, metrics in liquidity_metrics.items()
        ) if total_position_value > 0 else 0
        
        return {
            'position_liquidity': liquidity_metrics,
            'portfolio_liquidity_score': weighted_liquidity,
            'high_risk_positions': [symbol for symbol, metrics in liquidity_metrics.items() 
                                  if metrics['liquidity_risk'] == 'HIGH']
        }

class PortfolioConstructor:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
        
    def risk_parity_weights(self, symbols: List[str], target_vol: float = 0.15) -> Dict[str, float]:
        """Volatility-based position sizing"""
        
        price_data = self.data_client.get_price_data(symbols, "1y")
        returns = price_data.pct_change().dropna()
        
        # Calculate individual volatilities
        volatilities = returns.std() * np.sqrt(252)
        
        # Inverse volatility weights
        inv_vol_weights = 1 / volatilities
        normalized_weights = inv_vol_weights / inv_vol_weights.sum()
        
        # Scale to target volatility
        portfolio_vol = np.sqrt(np.dot(normalized_weights.T, np.dot(returns.cov() * 252, normalized_weights)))
        vol_scalar = target_vol / portfolio_vol if portfolio_vol > 0 else 1
        
        final_weights = normalized_weights * vol_scalar
        
        return final_weights.to_dict()
    
    def factor_exposure_analysis(self, symbols: List[str], weights: Dict[str, float]) -> Dict:
        """Systematic risk factor analysis"""
        
        # Get market data
        price_data = self.data_client.get_price_data(symbols + ['SPY'], "1y")  # SPY as market proxy
        returns = price_data.pct_change().dropna()
        
        if 'SPY' not in returns.columns:
            return {}
        
        market_returns = returns['SPY']
        factor_exposures = {}
        
        for symbol in symbols:
            if symbol in returns.columns:
                # Calculate beta (market factor exposure)
                covariance = np.cov(returns[symbol], market_returns)[0][1]
                market_variance = np.var(market_returns)
                beta = covariance / market_variance if market_variance > 0 else 0
                
                factor_exposures[symbol] = {
                    'market_beta': beta,
                    'weight': weights.get(symbol, 0)
                }
        
        # Portfolio-level factor exposure
        portfolio_beta = sum(
            exposure['market_beta'] * exposure['weight'] 
            for exposure in factor_exposures.values()
        )
        
        return {
            'individual_exposures': factor_exposures,
            'portfolio_beta': portfolio_beta,
            'market_exposure': 'HIGH' if abs(portfolio_beta) > 1.2 else 'MEDIUM' if abs(portfolio_beta) > 0.8 else 'LOW'
        }
    
    def rebalancing_triggers(self, current_weights: Dict[str, float], 
                           target_weights: Dict[str, float], threshold: float = 0.05) -> Dict:
        """Automated portfolio rebalancing triggers"""
        
        rebalancing_needed = {}
        total_drift = 0
        
        for symbol in target_weights:
            current_weight = current_weights.get(symbol, 0)
            target_weight = target_weights[symbol]
            drift = abs(current_weight - target_weight)
            
            if drift > threshold:
                rebalancing_needed[symbol] = {
                    'current_weight': current_weight,
                    'target_weight': target_weight,
                    'drift': drift,
                    'action': 'REDUCE' if current_weight > target_weight else 'INCREASE'
                }
            
            total_drift += drift
        
        return {
            'rebalancing_needed': len(rebalancing_needed) > 0,
            'positions_to_rebalance': rebalancing_needed,
            'total_drift': total_drift,
            'drift_score': total_drift / len(target_weights) if target_weights else 0
        }