import pandas as pd
import numpy as np
from typing import Dict, List, Tuple
from clients.market_data_client import MarketDataClient

class StatisticalAnalyzer:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def correlation_analysis(self, symbols: List[str], period: str = "3mo") -> Dict:
        """Real market data correlation analysis - NO FALLBACK DATA"""
        try:
            # Fetch REAL market data only
            price_data = self.data_client.get_price_data(symbols, period)
            
            # Strict validation - NO EMPTY OR DUMMY DATA
            if price_data is None or price_data.empty:
                return {'error': 'No real market data available for correlation analysis'}
            
            # Validate minimum data requirements
            if len(price_data) < 10:
                return {'error': f'Insufficient real market data: {len(price_data)} data points (minimum 10 required)'}
            
            # Calculate returns from real price data
            returns = price_data.pct_change().dropna()
            if returns.empty or len(returns) < 5:
                return {'error': 'Insufficient return data for correlation calculation'}
            
            # Calculate correlation matrix from real data only
            correlation_matrix = returns.corr(method='pearson')
            
            # Validate correlation matrix
            if correlation_matrix.empty or correlation_matrix.isna().all().all():
                return {'error': 'Unable to calculate valid correlations from real market data'}
            
            # Calculate statistics from real correlations
            valid_corrs = correlation_matrix.values[~np.isnan(correlation_matrix.values)]
            if len(valid_corrs) == 0:
                return {'error': 'No valid correlation values calculated'}
            
            avg_correlation = float(np.nanmean(correlation_matrix.values))
            max_correlation = float(np.nanmax(correlation_matrix.values))
            min_correlation = float(np.nanmin(correlation_matrix.values))
            
            # Find highly correlated pairs from real data
            high_corr_pairs = []
            for i in range(len(correlation_matrix.columns)):
                for j in range(i+1, len(correlation_matrix.columns)):
                    corr = correlation_matrix.iloc[i, j]
                    if not np.isnan(corr) and abs(corr) > 0.7:
                        high_corr_pairs.append({
                            'pair': [correlation_matrix.columns[i], correlation_matrix.columns[j]],
                            'correlation': float(corr)
                        })
            
            return {
                'correlation_matrix': correlation_matrix.to_dict(),
                'avg_correlation': avg_correlation,
                'max_correlation': max_correlation,
                'min_correlation': min_correlation,
                'high_correlation_pairs': sorted(high_corr_pairs, key=lambda x: abs(x['correlation']), reverse=True)[:10],
                'data_source': 'Real Market Data',
                'data_points': len(returns),
                'symbols_analyzed': len(correlation_matrix.columns)
            }
        except Exception as e:
            return {'error': f'Real market data correlation analysis failed: {str(e)}'}
    
    def diversification_ratio(self, symbols: List[str], weights: Dict[str, float], period: str = "3mo") -> float:
        """Portfolio diversification effectiveness measurement"""
        price_data = self.data_client.get_price_data(symbols, period)
        returns = price_data.pct_change().dropna()
        
        # Individual volatilities
        individual_vols = returns.std() * np.sqrt(252)
        
        # Weighted average of individual volatilities
        weight_array = np.array([weights.get(symbol, 0) for symbol in symbols])
        weighted_avg_vol = np.sum(weight_array * individual_vols)
        
        # Portfolio volatility
        cov_matrix = returns.cov() * 252
        portfolio_vol = np.sqrt(np.dot(weight_array.T, np.dot(cov_matrix, weight_array)))
        
        # Diversification ratio
        return weighted_avg_vol / portfolio_vol if portfolio_vol > 0 else 0
    
    def effective_number_of_assets(self, weights: Dict[str, float]) -> float:
        """Concentration risk assessment"""
        weight_values = list(weights.values())
        herfindahl_index = sum(w**2 for w in weight_values)
        return 1 / herfindahl_index if herfindahl_index > 0 else 0
    
    def simple_clustering(self, symbols: List[str], period: str = "3mo") -> Dict:
        """Simple correlation-based grouping"""
        try:
            price_data = self.data_client.get_price_data(symbols, period)
            returns = price_data.pct_change().dropna()
            correlation_matrix = returns.corr()
            
            # Simple clustering based on correlation threshold
            clusters = {}
            used_symbols = set()
            cluster_id = 1
            
            for symbol in symbols:
                if symbol in used_symbols:
                    continue
                
                cluster = [symbol]
                used_symbols.add(symbol)
                
                for other_symbol in symbols:
                    if other_symbol != symbol and other_symbol not in used_symbols:
                        if symbol in correlation_matrix.columns and other_symbol in correlation_matrix.columns:
                            corr = abs(correlation_matrix.loc[symbol, other_symbol])
                            if corr > 0.7:
                                cluster.append(other_symbol)
                                used_symbols.add(other_symbol)
                
                clusters[cluster_id] = cluster
                cluster_id += 1
            
            return {'clusters': clusters}
        except Exception:
            return {'clusters': {1: symbols}}
    
    def comprehensive_analysis(self, symbols: List[str], weights: Dict[str, float]) -> Dict:
        """Comprehensive statistical analysis with all metrics"""
        try:
            # Basic correlation analysis
            correlation_results = self.correlation_analysis(symbols)
            
            # Diversification metrics
            diversification_ratio = self.diversification_ratio(symbols, weights)
            effective_assets = self.effective_number_of_assets(weights)
            
            # Clustering analysis
            clustering_results = self.simple_clustering(symbols)
            
            return {
                'correlation_analysis': correlation_results,
                'diversification_ratio': diversification_ratio,
                'effective_number_of_assets': effective_assets,
                'clustering': clustering_results,
                'portfolio_statistics': {
                    'total_symbols': len(symbols),
                    'total_weight': sum(weights.values())
                }
            }
        except Exception as e:
            return {'error': str(e)}