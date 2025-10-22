import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from typing import Dict, List, Optional
from clients.market_data_client import MarketDataClient

class MonteCarloEngine:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def portfolio_simulation(self, symbols: List[str], weights: Dict[str, float], 
                           time_horizon: int = 252, num_simulations: int = 10000) -> Dict:
        """Multi-asset portfolio Monte Carlo simulation"""
        
        # Get historical data for parameter estimation
        price_data = self.data_client.get_price_data(symbols, "2y")
        returns = price_data.pct_change().dropna()
        
        # Filter symbols that have data
        available_symbols = [s for s in symbols if s in returns.columns and s in weights]
        if not available_symbols:
            raise ValueError("No market data available for provided symbols")
        
        # Align data and weights
        filtered_returns = returns[available_symbols]
        mean_returns = filtered_returns.mean()
        cov_matrix = filtered_returns.cov()
        
        # Portfolio parameters - ensure alignment
        weight_array = np.array([weights.get(symbol, 0) for symbol in available_symbols])
        if weight_array.sum() == 0:
            weight_array = np.ones(len(available_symbols)) / len(available_symbols)
        else:
            weight_array = weight_array / weight_array.sum()  # Normalize weights
        
        portfolio_mean = np.dot(weight_array, mean_returns)
        portfolio_var = np.dot(weight_array.T, np.dot(cov_matrix, weight_array))
        portfolio_std = np.sqrt(portfolio_var)
        
        # Monte Carlo simulation
        simulated_returns = np.random.multivariate_normal(
            mean_returns, cov_matrix, (num_simulations, time_horizon)
        )
        
        # Calculate portfolio returns for each simulation
        portfolio_returns = np.dot(simulated_returns, weight_array)
        
        # Calculate cumulative returns
        cumulative_returns = np.cumprod(1 + portfolio_returns, axis=1)
        final_values = cumulative_returns[:, -1]
        
        # Statistics
        percentiles = np.percentile(final_values, [5, 25, 50, 75, 95])
        
        # Additional risk metrics
        from scipy import stats
        
        # Calculate VaR and other metrics from portfolio returns
        portfolio_returns_flat = portfolio_returns.flatten()
        var_5 = np.percentile(portfolio_returns_flat, 5) * 100  # Convert to percentage
        
        # Annualized Sharpe ratio
        risk_free_rate = 0.02  # 2% risk-free rate
        excess_return = (portfolio_mean * 252) - risk_free_rate
        sharpe_ratio = excess_return / (portfolio_std * np.sqrt(252)) if portfolio_std > 0 else 0
        
        # Max drawdown calculation from cumulative returns
        cumulative_portfolio = np.cumprod(1 + portfolio_returns, axis=1)
        running_max = np.maximum.accumulate(cumulative_portfolio, axis=1)
        drawdowns = (cumulative_portfolio - running_max) / running_max
        max_drawdown = np.min(drawdowns) * 100  # Convert to percentage
        
        # Calculate skewness and kurtosis from final values
        skewness = stats.skew(final_values)
        kurtosis = stats.kurtosis(final_values)
        
        return {
            'simulations': cumulative_returns,
            'final_values': final_values,
            'mean_final_value': np.mean(final_values),
            'std_final_value': np.std(final_values),
            'percentiles': {
                '5th': percentiles[0],
                '25th': percentiles[1],
                '50th': percentiles[2],
                '75th': percentiles[3],
                '95th': percentiles[4]
            },
            'probability_loss': np.sum(final_values < 1) / num_simulations,
            'expected_return': portfolio_mean * 252,  # Annualized
            'volatility': portfolio_std * np.sqrt(252),  # Annualized
            'var_5': var_5,
            'sharpe_ratio': sharpe_ratio,
            'max_drawdown': max_drawdown,
            'skewness': skewness,
            'kurtosis': kurtosis
        }
    
    def scenario_analysis(self, symbols: List[str], weights: Dict[str, float], 
                         scenarios: Dict[str, Dict]) -> Dict:
        """Historical vs projected return scenarios"""
        
        results = {}
        
        for scenario_name, scenario_params in scenarios.items():
            mean_return = scenario_params.get('mean_return', 0.08)
            volatility = scenario_params.get('volatility', 0.15)
            time_horizon = scenario_params.get('time_horizon', 252)
            num_sims = scenario_params.get('num_simulations', 1000)
            
            # Generate scenario returns
            returns = np.random.normal(mean_return/252, volatility/np.sqrt(252), 
                                     (num_sims, time_horizon))
            
            cumulative_returns = np.cumprod(1 + returns, axis=1)
            final_values = cumulative_returns[:, -1]
            
            results[scenario_name] = {
                'final_values': final_values,
                'mean_return': np.mean(final_values) - 1,
                'volatility': np.std(final_values),
                'var_5': np.percentile(final_values, 5) - 1,
                'probability_loss': np.sum(final_values < 1) / num_sims
            }
        
        return results
    
    def risk_modeling(self, symbols: List[str], weights: Dict[str, float], 
                     confidence_levels: List[float] = [0.95, 0.99]) -> Dict:
        """Advanced statistical risk assessment"""
        
        # Get historical data
        price_data = self.data_client.get_price_data(symbols, "2y")
        returns = price_data.pct_change().dropna()
        
        # Filter symbols that have data and weights
        available_symbols = [s for s in symbols if s in returns.columns and s in weights]
        if not available_symbols:
            raise ValueError("No market data available for provided symbols")
        
        # Portfolio returns - ensure alignment
        filtered_returns = returns[available_symbols]
        weight_array = np.array([weights.get(symbol, 0) for symbol in available_symbols])
        if weight_array.sum() == 0:
            weight_array = np.ones(len(available_symbols)) / len(available_symbols)
        else:
            weight_array = weight_array / weight_array.sum()  # Normalize weights
        portfolio_returns = np.dot(filtered_returns, weight_array)
        
        # Risk metrics
        risk_metrics = {}
        
        for confidence in confidence_levels:
            var = np.percentile(portfolio_returns, (1 - confidence) * 100)
            cvar = portfolio_returns[portfolio_returns <= var].mean()
            
            risk_metrics[f'VaR_{int(confidence*100)}'] = var
            risk_metrics[f'CVaR_{int(confidence*100)}'] = cvar
        
        # Additional risk measures
        from scipy import stats
        risk_metrics.update({
            'volatility': portfolio_returns.std() * np.sqrt(252),
            'skewness': stats.skew(portfolio_returns),
            'kurtosis': stats.kurtosis(portfolio_returns),
            'max_drawdown': self._calculate_max_drawdown(portfolio_returns)
        })
        
        return risk_metrics
    
    def visualize_simulation(self, simulation_results: Dict, save_path: Optional[str] = None):
        """Create visualization plots for simulation results"""
        
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
        
        # Plot 1: Simulation paths
        simulations = simulation_results['simulations']
        for i in range(min(100, len(simulations))):  # Plot first 100 paths
            ax1.plot(simulations[i], alpha=0.1, color='blue')
        ax1.set_title('Monte Carlo Simulation Paths')
        ax1.set_xlabel('Time (Days)')
        ax1.set_ylabel('Portfolio Value')
        
        # Plot 2: Final value distribution
        final_values = simulation_results['final_values']
        ax2.hist(final_values, bins=50, alpha=0.7, density=True)
        ax2.axvline(simulation_results['mean_final_value'], color='red', 
                   linestyle='--', label='Mean')
        ax2.set_title('Final Portfolio Value Distribution')
        ax2.set_xlabel('Final Value')
        ax2.set_ylabel('Density')
        ax2.legend()
        
        # Plot 3: Percentile analysis
        percentiles = simulation_results['percentiles']
        labels = list(percentiles.keys())
        values = list(percentiles.values())
        ax3.bar(labels, values)
        ax3.set_title('Portfolio Value Percentiles')
        ax3.set_ylabel('Portfolio Value')
        
        # Plot 4: Risk metrics
        prob_loss = simulation_results['probability_loss']
        expected_return = simulation_results['expected_return']
        volatility = simulation_results['volatility']
        
        metrics = ['Prob. Loss', 'Expected Return', 'Volatility']
        values = [prob_loss, expected_return, volatility]
        ax4.bar(metrics, values)
        ax4.set_title('Risk Metrics')
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path)
        else:
            plt.show()
    
    def _calculate_max_drawdown(self, returns: pd.Series) -> float:
        """Calculate maximum drawdown"""
        cumulative = (1 + returns).cumprod()
        running_max = cumulative.expanding().max()
        drawdown = (cumulative - running_max) / running_max
        return drawdown.min()

# Example usage
if __name__ == "__main__":
    from clients.market_data_client import MarketDataClient
    
    # Initialize
    data_client = MarketDataClient()
    mc_engine = MonteCarloEngine(data_client)
    
    # Example portfolio
    symbols = ['AAPL', 'MSFT', 'GOOGL']
    weights = {'AAPL': 0.4, 'MSFT': 0.4, 'GOOGL': 0.2}
    
    # Run simulation
    results = mc_engine.portfolio_simulation(symbols, weights)
    
    # Print results
    print(f"Expected Final Value: {results['mean_final_value']:.3f}")
    print(f"Probability of Loss: {results['probability_loss']:.2%}")
    print(f"95th Percentile: {results['percentiles']['95th']:.3f}")
    
    # Visualize
    mc_engine.visualize_simulation(results)