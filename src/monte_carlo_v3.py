import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from typing import Dict, List, Optional
from clients.market_data_client import MarketDataClient

class MonteCarloEngine:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def _get_empty_results(self, market_regime='normal', volatility_adjustment=0.0, num_simulations=1000, time_horizon=63):
        """Return consistent empty results structure"""
        empty_stats = {
            'mean_return': 0.0, 'median_return': 0.0, 'std_dev': 0.0,
            'min_return': 0.0, 'max_return': 0.0,
            'value_at_risk_95': 0.0, 'percentile_95': 0.0,
            'sharpe_ratio': 0.0, 'max_drawdown': 0.0
        }
        return {
            'simulation_data': [],
            'summary_statistics': empty_stats,
            'expected_return': 0.0,
            'volatility': 0.0,
            'percentile_95': 0.0,
            'percentile_5': 0.0,
            'mean_final_value': 1.0,
            'probability_loss': 0.0,
            'sharpe_ratio': 0.0,
            'max_drawdown': 0.0,
            'confidence_intervals': {},
            'market_regime': market_regime,
            'volatility_adjustment': volatility_adjustment,
            'num_simulations': num_simulations,
            'time_horizon_days': time_horizon
        }

    def portfolio_simulation(self, symbols: List[str], weights: Dict[str, float], 
                           time_horizon: int = 63, num_simulations: int = 10000,
                           confidence_intervals: List[float] = [0.8, 0.9, 0.95, 0.99],
                           market_regime: str = 'normal', volatility_adjustment: float = 0.0,
                           forecast_period: str = '3M', initial_portfolio_value: float = 10000.0) -> Dict:
        """Multi-asset portfolio Monte Carlo simulation"""
        
        # Convert forecast period to days
        period_mapping = {
            '1M': 21, '3M': 63, '6M': 126, 
            '1Y': 252, '2Y': 504, '5Y': 1260
        }
        if forecast_period in period_mapping:
            time_horizon = period_mapping[forecast_period]
        
        # Use YFinance directly for reliable data
        import yfinance as yf
        import warnings
        
        print(f"Monte Carlo: Processing {len(symbols)} symbols")
        
        # Download data (use 2y to ensure sufficient data for covariance)
        price_data = None
        valid_symbols = []
        period = "2y"
        
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                
            if len(symbols) > 1:
                price_data = yf.download(symbols, period=period, progress=False, threads=False)
                if not price_data.empty:
                    # Handle multi-level columns
                    if isinstance(price_data.columns, pd.MultiIndex):
                        if 'Adj Close' in price_data.columns.levels[0]:
                            price_data = price_data['Adj Close']
                        elif 'Close' in price_data.columns.levels[0]:
                            price_data = price_data['Close']
                    
                    # Check which symbols have data
                    for symbol in symbols:
                        if symbol in price_data.columns:
                            symbol_data = price_data[symbol].dropna()
                            if len(symbol_data) >= 10:  # Need at least 10 data points
                                valid_symbols.append(symbol)
            else:
                # Single symbol
                ticker_data = yf.download(symbols[0], period=period, progress=False)
                if not ticker_data.empty:
                    price_col = 'Adj Close' if 'Adj Close' in ticker_data.columns else 'Close'
                    price_data = pd.DataFrame({symbols[0]: ticker_data[price_col]})
                    if len(price_data.dropna()) >= 10:
                        valid_symbols = symbols[:1]
            
            if valid_symbols and len(valid_symbols) >= 1:
                print(f"Monte Carlo: Found data for {len(valid_symbols)} symbols using {period} period")
                
        except Exception as e:
            print(f"Monte Carlo: Failed to download data: {e}")
        
        if not valid_symbols or price_data is None or price_data.empty:
            print("Monte Carlo: No valid data found")
            return self._get_empty_results(market_regime, volatility_adjustment, num_simulations, time_horizon)
        
        # Use only valid symbols
        if len(valid_symbols) > 1:
            price_data = price_data[valid_symbols]
        
        print(f"Monte Carlo: Using {len(valid_symbols)} symbols with {len(price_data)} data points")
        
        if price_data.empty:
            return self._get_empty_results(market_regime, volatility_adjustment, num_simulations, time_horizon)
        
        # Calculate returns
        returns = price_data.pct_change(fill_method=None).dropna()
        
        # Ensure we have returns data
        if returns.empty:
            print("Monte Carlo: No return data available")
            return self._get_empty_results(market_regime, volatility_adjustment, num_simulations, time_horizon)
        
        # Use all available symbols, create equal weights if needed
        available_symbols = [s for s in valid_symbols if s in returns.columns]
        
        if not available_symbols:
            available_symbols = list(returns.columns)
        
        filtered_returns = returns[available_symbols]
        print(f"Monte Carlo: Processing returns for {len(available_symbols)} symbols with {len(filtered_returns)} data points")
        
        # Calculate statistics with error handling
        with np.errstate(divide='ignore', invalid='ignore'):
            mean_returns = filtered_returns.mean()
            cov_matrix = filtered_returns.cov()
        
        # Replace NaN values with zeros
        mean_returns = mean_returns.fillna(0)
        cov_matrix = cov_matrix.fillna(0)
        
        if mean_returns.empty or cov_matrix.empty:
            return self._get_empty_results(market_regime, volatility_adjustment, num_simulations, time_horizon)
        
        # Portfolio parameters - create proper weights
        if weights and any(symbol in weights for symbol in available_symbols):
            # Use provided weights for available symbols
            weight_array = np.array([weights.get(symbol, 0) for symbol in available_symbols])
            if weight_array.sum() > 0:
                weight_array = weight_array / weight_array.sum()  # Normalize
            else:
                weight_array = np.ones(len(available_symbols)) / len(available_symbols)
        else:
            # Equal weights if no weights provided or no matching symbols
            weight_array = np.ones(len(available_symbols)) / len(available_symbols)
        
        print(f"Monte Carlo: Using weights: {dict(zip(available_symbols, weight_array))}")
        
        # Apply market regime adjustments
        regime_adjustments = {
            'bull': 0.20,    # +20% return adjustment
            'normal': 0.0,   # No adjustment
            'bear': -0.20    # -20% return adjustment
        }
        regime_adj = regime_adjustments.get(market_regime.lower(), 0.0)
        
        # Apply volatility adjustment (-50%, normal, +50%)
        vol_multiplier = max(0.1, 1.0 + volatility_adjustment)  # Ensure positive multiplier
        
        # Calculate portfolio statistics with error handling
        with np.errstate(divide='ignore', invalid='ignore'):
            portfolio_mean = np.dot(weight_array, mean_returns) + (regime_adj / 252)  # Daily adjustment
            portfolio_var = np.dot(weight_array.T, np.dot(cov_matrix, weight_array)) * (vol_multiplier ** 2)
            portfolio_std = np.sqrt(max(portfolio_var, 1e-8))  # Ensure positive value
        
        # Monte Carlo simulation with proper covariance handling
        try:
            # Validate covariance matrix before use
            if len(available_symbols) < 2 or cov_matrix.shape[0] < 2:
                raise ValueError("Insufficient data for covariance matrix")
            
            # Check for NaN or infinite values
            if np.any(np.isnan(cov_matrix.values)) or np.any(np.isinf(cov_matrix.values)):
                raise ValueError("Invalid values in covariance matrix")
            
            # Check if matrix is positive definite
            eigenvals = np.linalg.eigvals(cov_matrix)
            if np.any(eigenvals <= 0):
                # Add regularization to make positive definite
                regularized_cov = cov_matrix + np.eye(len(available_symbols)) * max(1e-6, abs(eigenvals.min()) + 1e-6)
            else:
                regularized_cov = cov_matrix
            
            # Suppress numpy warnings during simulation
            with np.errstate(divide='ignore', invalid='ignore'):
                simulated_returns = np.random.multivariate_normal(
                    mean_returns, regularized_cov, (num_simulations, time_horizon)
                )
        except (np.linalg.LinAlgError, ValueError) as e:
            print(f"Covariance matrix issue: {e}, using independent normal distributions")
            # Use independent normal distributions for each asset
            simulated_returns = np.zeros((num_simulations, time_horizon, len(available_symbols)))
            for i, symbol in enumerate(available_symbols):
                asset_std = np.sqrt(max(cov_matrix.loc[symbol, symbol], 1e-8))
                simulated_returns[:, :, i] = np.random.normal(
                    mean_returns[symbol], 
                    asset_std, 
                    (num_simulations, time_horizon)
                )
        
        # Calculate portfolio returns for each simulation
        if simulated_returns.ndim == 3:
            portfolio_returns = np.sum(simulated_returns * weight_array, axis=2)
        else:
            portfolio_returns = np.dot(simulated_returns, weight_array)
        
        # Calculate cumulative returns
        cumulative_returns = np.cumprod(1 + portfolio_returns, axis=1)
        final_values = cumulative_returns[:, -1]
        
        # Calculate confidence intervals
        confidence_percentiles = []
        for conf in confidence_intervals:
            lower = (1 - conf) / 2 * 100
            upper = (1 + conf) / 2 * 100
            confidence_percentiles.extend([lower, upper])
        
        # Statistics with custom confidence intervals
        percentiles = np.percentile(final_values, [5, 25, 50, 75, 95] + confidence_percentiles)
        
        # Build confidence intervals dict
        confidence_results = {}
        for i, conf in enumerate(confidence_intervals):
            lower_idx = 5 + i * 2  # Start after standard percentiles
            upper_idx = 5 + i * 2 + 1
            confidence_results[f'{int(conf*100)}%'] = {
                'lower': float(percentiles[lower_idx] - 1),
                'upper': float(percentiles[upper_idx] - 1)
            }
        
        # Simplified risk metrics (no scipy dependency)
        
        # Calculate VaR and other metrics from portfolio returns
        portfolio_returns_flat = portfolio_returns.flatten()
        var_5 = np.percentile(portfolio_returns_flat, 5) * 100  # Convert to percentage
        
        # Annualized Sharpe ratio using Fed rate
        from utils.fed_rate import get_risk_free_rate
        risk_free_rate = get_risk_free_rate()
        excess_return = (portfolio_mean * 252) - risk_free_rate
        sharpe_ratio = excess_return / (portfolio_std * np.sqrt(252)) if portfolio_std > 0 else 0
        
        # Max drawdown calculation from cumulative returns
        cumulative_portfolio = np.cumprod(1 + portfolio_returns, axis=1)
        running_max = np.maximum.accumulate(cumulative_portfolio, axis=1)
        drawdowns = (cumulative_portfolio - running_max) / running_max
        max_drawdown = np.min(drawdowns) * 100  # Convert to percentage
        
        # Simple skewness and kurtosis calculation
        mean_final = np.mean(final_values)
        std_final = np.std(final_values)
        skewness = float(np.mean(((final_values - mean_final) / std_final) ** 3)) if std_final > 0 else 0
        kurtosis = float(np.mean(((final_values - mean_final) / std_final) ** 4) - 3) if std_final > 0 else 0
        
        def clean_value(val):
            if np.isnan(val) or np.isinf(val):
                return 0.0
            return float(val)
        
        # Calculate more realistic metrics
        annualized_return = portfolio_mean * 252
        annualized_volatility = portfolio_std * np.sqrt(252)
        
        # Ensure we have meaningful values
        if abs(annualized_return) < 1e-6:
            # If return is essentially zero, estimate from historical data
            if len(filtered_returns) > 0:
                portfolio_historical_returns = np.dot(filtered_returns, weight_array)
                annualized_return = portfolio_historical_returns.mean() * 252
                annualized_volatility = portfolio_historical_returns.std() * np.sqrt(252)
        
        print(f"Monte Carlo Results: Return={annualized_return:.2%}, Vol={annualized_volatility:.2%}")
        
        # Ensure confidence_results is defined
        if 'confidence_results' not in locals():
            confidence_results = {}
            for conf in confidence_intervals:
                lower_pct = (1 - conf) / 2 * 100
                upper_pct = (1 + conf) / 2 * 100
                lower_val = np.percentile(final_values, lower_pct) - 1
                upper_val = np.percentile(final_values, upper_pct) - 1
                confidence_results[f'{int(conf*100)}%'] = {
                    'lower': clean_value(lower_val),
                    'upper': clean_value(upper_val)
                }
        
        # Prepare simulation data for frontend (downsample to max 100 paths for performance)
        paths_to_return = []
        num_paths_to_return = min(100, num_simulations)
        # Scale to initial value
        initial_value = initial_portfolio_value
        
        print(f"Monte Carlo Debug: Preparing {num_paths_to_return} paths from {num_simulations} simulations")
        print(f"Monte Carlo Debug: Cumulative returns shape: {cumulative_returns.shape}")
        
        # Get indices for paths to return
        indices = np.random.choice(num_simulations, num_paths_to_return, replace=False)
        
        for idx in indices:
            # Add starting point
            path = [initial_value] + (cumulative_returns[idx] * initial_value).tolist()
            paths_to_return.append(path)
            
        print(f"Monte Carlo Debug: Generated {len(paths_to_return)} paths")
        if paths_to_return:
            print(f"Monte Carlo Debug: First path length: {len(paths_to_return[0])}")
            print(f"Monte Carlo Debug: First path sample: {paths_to_return[0][:5]}...")
            
        # Construct summary statistics
        summary_stats = {
            'mean_return': clean_value(annualized_return),
            'median_return': clean_value(np.median(portfolio_returns.sum(axis=1)) * (252/time_horizon)), # Approximate annualized median
            'std_dev': clean_value(annualized_volatility),
            'min_return': clean_value(np.min(final_values) - 1),
            'max_return': clean_value(np.max(final_values) - 1),
            'value_at_risk_95': clean_value(percentiles[0] - 1), # 5th percentile
            'percentile_95': clean_value(percentiles[4] - 1),   # 95th percentile
            'sharpe_ratio': clean_value(sharpe_ratio),
            'max_drawdown': clean_value(max_drawdown / 100)
        }

        result = {
            'simulation_data': paths_to_return,
            'summary_statistics': summary_stats,
            'expected_return': clean_value(annualized_return),
            'volatility': clean_value(annualized_volatility),
            'percentile_95': clean_value(percentiles[4] - 1),
            'percentile_5': clean_value(percentiles[0] - 1),
            'mean_final_value': clean_value(np.mean(final_values)),
            'probability_loss': clean_value(np.sum(final_values < 1) / num_simulations),
            'sharpe_ratio': clean_value(sharpe_ratio),
            'max_drawdown': clean_value(max_drawdown / 100),
            'confidence_intervals': confidence_results,
            'market_regime': market_regime,
            'volatility_adjustment': volatility_adjustment,
            'num_simulations': num_simulations,
            'time_horizon_days': time_horizon
        }
        
        print(f"Monte Carlo Debug: Final result keys: {list(result.keys())}")
        print(f"Monte Carlo Debug: Simulation data in result: {len(result['simulation_data'])} paths")
        
        return result
    
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
        returns = price_data.pct_change(fill_method=None).dropna()
        
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