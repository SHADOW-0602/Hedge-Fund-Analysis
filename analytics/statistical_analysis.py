import pandas as pd
import numpy as np
from typing import Dict, List, Tuple
from scipy.cluster.hierarchy import dendrogram, linkage, fcluster
from scipy.spatial.distance import squareform
from sklearn.cluster import KMeans
from clients.market_data_client import MarketDataClient

class StatisticalAnalyzer:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def correlation_analysis(self, symbols: List[str], period: str = "1y") -> Dict:
        """Full correlation analysis with clustering"""
        price_data = self.data_client.get_price_data(symbols, period)
        returns = price_data.pct_change().dropna()
        
        correlation_matrix = returns.corr()
        
        # Correlation statistics
        avg_correlation = correlation_matrix.mean().mean()
        max_correlation = correlation_matrix.max().max()
        min_correlation = correlation_matrix.min().min()
        
        # Find highly correlated pairs
        high_corr_pairs = []
        for i in range(len(correlation_matrix.columns)):
            for j in range(i+1, len(correlation_matrix.columns)):
                corr = correlation_matrix.iloc[i, j]
                if abs(corr) > 0.7:
                    high_corr_pairs.append({
                        'pair': (correlation_matrix.columns[i], correlation_matrix.columns[j]),
                        'correlation': corr
                    })
        
        return {
            'correlation_matrix': correlation_matrix,
            'avg_correlation': avg_correlation,
            'max_correlation': max_correlation,
            'min_correlation': min_correlation,
            'high_correlation_pairs': sorted(high_corr_pairs, key=lambda x: abs(x['correlation']), reverse=True)
        }
    
    def diversification_ratio(self, symbols: List[str], weights: Dict[str, float], period: str = "1y") -> float:
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
    
    def hierarchical_clustering(self, symbols: List[str], period: str = "1y", n_clusters: int = 5) -> Dict:
        """Asset grouping based on correlation patterns"""
        price_data = self.data_client.get_price_data(symbols, period)
        returns = price_data.pct_change().dropna()
        correlation_matrix = returns.corr()
        
        # Convert correlation to distance matrix
        distance_matrix = 1 - correlation_matrix.abs()
        
        # Hierarchical clustering
        condensed_distances = squareform(distance_matrix)
        linkage_matrix = linkage(condensed_distances, method='ward')
        
        # Form clusters
        cluster_labels = fcluster(linkage_matrix, n_clusters, criterion='maxclust')
        
        # Group symbols by cluster
        clusters = {}
        for i, symbol in enumerate(symbols):
            cluster_id = cluster_labels[i]
            if cluster_id not in clusters:
                clusters[cluster_id] = []
            clusters[cluster_id].append(symbol)
        
        # Calculate cluster statistics
        cluster_stats = {}
        for cluster_id, cluster_symbols in clusters.items():
            if len(cluster_symbols) > 1:
                cluster_corr = correlation_matrix.loc[cluster_symbols, cluster_symbols]
                avg_intra_cluster_corr = cluster_corr.mean().mean()
                cluster_stats[cluster_id] = {
                    'symbols': cluster_symbols,
                    'size': len(cluster_symbols),
                    'avg_correlation': avg_intra_cluster_corr
                }
        
        return {
            'clusters': clusters,
            'cluster_stats': cluster_stats,
            'linkage_matrix': linkage_matrix,
            'distance_matrix': distance_matrix
        }