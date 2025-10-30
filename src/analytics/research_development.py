import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Callable, Tuple
from datetime import datetime, timedelta
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split, cross_val_score
from clients.market_data_client import MarketDataClient
from analytics.backtesting import Backtester

class StrategyBacktester:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
        self.backtester = Backtester(data_client)
    
    def backtest_strategy(self, strategy_func: Callable, symbols: List[str], 
                         start_date: str, end_date: str, 
                         initial_capital: float = 100000) -> Dict:
        """Comprehensive strategy backtesting"""
        
        self.backtester.initial_capital = initial_capital
        results = self.backtester.add_strategy(strategy_func, symbols, start_date, end_date)
        
        if not results:
            return {}
        
        # Enhanced performance metrics
        enhanced_results = self._calculate_enhanced_metrics(results)
        
        # Risk analysis
        risk_metrics = self._calculate_risk_metrics(results)
        
        # Trade analysis
        trade_analysis = self._analyze_trades(results.get('trades', []))
        
        return {
            **results,
            'enhanced_metrics': enhanced_results,
            'risk_analysis': risk_metrics,
            'trade_analysis': trade_analysis,
            'strategy_summary': self._generate_strategy_summary(results, enhanced_results, risk_metrics)
        }
    
    def walk_forward_analysis(self, strategy_func: Callable, symbols: List[str], 
                            start_date: str, end_date: str, 
                            train_period_months: int = 12, test_period_months: int = 3) -> Dict:
        """Walk-forward analysis for strategy validation"""
        
        start = pd.to_datetime(start_date)
        end = pd.to_datetime(end_date)
        
        results = []
        current_date = start
        
        while current_date + pd.DateOffset(months=train_period_months + test_period_months) <= end:
            # Training period
            train_start = current_date
            train_end = current_date + pd.DateOffset(months=train_period_months)
            
            # Test period
            test_start = train_end
            test_end = train_end + pd.DateOffset(months=test_period_months)
            
            # Run backtest on test period
            period_result = self.backtest_strategy(
                strategy_func, symbols, 
                test_start.strftime('%Y-%m-%d'), 
                test_end.strftime('%Y-%m-%d')
            )
            
            if period_result:
                results.append({
                    'period': f"{test_start.strftime('%Y-%m')} to {test_end.strftime('%Y-%m')}",
                    'return': period_result.get('total_return', 0),
                    'sharpe': period_result.get('sharpe_ratio', 0),
                    'max_drawdown': period_result.get('max_drawdown', 0)
                })
            
            current_date = test_start
        
        # Aggregate results
        if results:
            avg_return = np.mean([r['return'] for r in results])
            avg_sharpe = np.mean([r['sharpe'] for r in results])
            consistency = np.std([r['return'] for r in results])
            
            return {
                'period_results': results,
                'average_return': avg_return,
                'average_sharpe': avg_sharpe,
                'return_consistency': consistency,
                'win_rate': len([r for r in results if r['return'] > 0]) / len(results),
                'strategy_robustness': 'HIGH' if consistency < 0.1 and avg_sharpe > 1 else 'MEDIUM' if avg_sharpe > 0.5 else 'LOW'
            }
        
        return {}
    
    def _calculate_enhanced_metrics(self, results: Dict) -> Dict:
        """Calculate enhanced performance metrics"""
        portfolio_history = results.get('portfolio_history')
        if portfolio_history is None or portfolio_history.empty:
            return {}
        
        returns = portfolio_history['returns'].dropna()
        
        # Additional metrics
        win_rate = (returns > 0).sum() / len(returns) if len(returns) > 0 else 0
        profit_factor = returns[returns > 0].sum() / abs(returns[returns < 0].sum()) if returns[returns < 0].sum() != 0 else float('inf')
        
        # Tail ratios
        upside_99 = returns.quantile(0.99)
        downside_1 = returns.quantile(0.01)
        tail_ratio = abs(upside_99 / downside_1) if downside_1 != 0 else float('inf')
        
        return {
            'win_rate': win_rate,
            'profit_factor': profit_factor,
            'tail_ratio': tail_ratio,
            'best_day': returns.max(),
            'worst_day': returns.min(),
            'consecutive_wins': self._max_consecutive(returns > 0),
            'consecutive_losses': self._max_consecutive(returns < 0)
        }
    
    def _calculate_risk_metrics(self, results: Dict) -> Dict:
        """Calculate comprehensive risk metrics"""
        portfolio_history = results.get('portfolio_history')
        if portfolio_history is None or portfolio_history.empty:
            return {}
        
        returns = portfolio_history['returns'].dropna()
        
        # VaR and CVaR
        var_95 = returns.quantile(0.05)
        cvar_95 = returns[returns <= var_95].mean()
        
        # Ulcer Index (alternative drawdown measure)
        portfolio_values = portfolio_history['portfolio_value']
        running_max = portfolio_values.expanding().max()
        drawdowns = (portfolio_values - running_max) / running_max
        ulcer_index = np.sqrt((drawdowns ** 2).mean())
        
        return {
            'var_95': var_95,
            'cvar_95': cvar_95,
            'ulcer_index': ulcer_index,
            'downside_deviation': returns[returns < 0].std() * np.sqrt(252),
            'pain_index': abs(drawdowns.mean()),
            'recovery_factor': abs(results.get('total_return', 0) / results.get('max_drawdown', 1))
        }
    
    def _analyze_trades(self, trades: List[Dict]) -> Dict:
        """Analyze individual trades"""
        if not trades:
            return {}
        
        buy_trades = [t for t in trades if t['action'] == 'BUY']
        sell_trades = [t for t in trades if t['action'] == 'SELL']
        
        # Trade frequency analysis
        if buy_trades:
            trade_dates = [t['date'] for t in buy_trades]
            trade_frequency = len(trade_dates) / ((max(trade_dates) - min(trade_dates)).days / 30) if len(trade_dates) > 1 else 0
        else:
            trade_frequency = 0
        
        return {
            'total_trades': len(buy_trades),
            'avg_trade_size': np.mean([t['value'] for t in buy_trades]) if buy_trades else 0,
            'trade_frequency_per_month': trade_frequency,
            'largest_trade': max([t['value'] for t in buy_trades]) if buy_trades else 0,
            'smallest_trade': min([t['value'] for t in buy_trades]) if buy_trades else 0
        }
    
    def _max_consecutive(self, boolean_series: pd.Series) -> int:
        """Calculate maximum consecutive True values"""
        groups = boolean_series.groupby((boolean_series != boolean_series.shift()).cumsum())
        return groups.sum().max() if not groups.sum().empty else 0
    
    def _generate_strategy_summary(self, results: Dict, enhanced: Dict, risk: Dict) -> str:
        """Generate strategy performance summary"""
        total_return = results.get('total_return', 0)
        sharpe = results.get('sharpe_ratio', 0)
        max_dd = results.get('max_drawdown', 0)
        win_rate = enhanced.get('win_rate', 0)
        
        if total_return > 0.2 and sharpe > 1.5 and abs(max_dd) < 0.15:
            return "EXCELLENT"
        elif total_return > 0.1 and sharpe > 1.0 and abs(max_dd) < 0.25:
            return "GOOD"
        elif total_return > 0 and sharpe > 0.5:
            return "ACCEPTABLE"
        else:
            return "POOR"

class FactorResearcher:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def multi_factor_model(self, symbols: List[str], factors: List[str], 
                          period: str = "2y") -> Dict:
        """Develop multi-factor model for return prediction"""
        
        # Get price data
        all_symbols = symbols + factors
        price_data = self.data_client.get_price_data(all_symbols, period)
        returns = price_data.pct_change().dropna()
        
        if returns.empty:
            return {}
        
        factor_loadings = {}
        model_performance = {}
        
        for symbol in symbols:
            if symbol in returns.columns:
                # Prepare data
                y = returns[symbol].values
                X = returns[factors].values
                
                # Split data
                X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
                
                # Fit model
                model = LinearRegression()
                model.fit(X_train, y_train)
                
                # Predictions
                y_pred = model.predict(X_test)
                
                # Performance metrics
                r2 = r2_score(y_test, y_pred)
                mse = mean_squared_error(y_test, y_pred)
                
                factor_loadings[symbol] = {
                    'intercept': model.intercept_,
                    'coefficients': dict(zip(factors, model.coef_)),
                    'r_squared': r2,
                    'mse': mse
                }
        
        return {
            'factor_loadings': factor_loadings,
            'model_summary': self._summarize_factor_model(factor_loadings),
            'factor_importance': self._calculate_factor_importance(factor_loadings, factors)
        }
    
    def factor_timing_model(self, symbols: List[str], period: str = "2y") -> Dict:
        """Develop factor timing model using machine learning"""
        
        price_data = self.data_client.get_price_data(symbols, period)
        returns = price_data.pct_change().dropna()
        
        if returns.empty or len(returns) < 50:
            return {}
        
        # Create features (technical indicators)
        features = self._create_features(price_data)
        
        # Prepare target (forward returns)
        target = returns.shift(-1).dropna()  # Next period returns
        
        # Align features and target
        common_index = features.index.intersection(target.index)
        X = features.loc[common_index]
        y = target.loc[common_index]
        
        models = {}
        
        for symbol in symbols:
            if symbol in y.columns:
                # Train model for each symbol
                X_train, X_test, y_train, y_test = train_test_split(
                    X.values, y[symbol].values, test_size=0.3, random_state=42
                )
                
                # Random Forest model
                rf_model = RandomForestRegressor(n_estimators=100, random_state=42)
                rf_model.fit(X_train, y_train)
                
                # Predictions
                y_pred = rf_model.predict(X_test)
                
                # Performance
                r2 = r2_score(y_test, y_pred)
                
                models[symbol] = {
                    'model': rf_model,
                    'r_squared': r2,
                    'feature_importance': dict(zip(X.columns, rf_model.feature_importances_))
                }
        
        return {
            'models': models,
            'average_r_squared': np.mean([m['r_squared'] for m in models.values()]),
            'top_features': self._get_top_features(models)
        }
    
    def _create_features(self, price_data: pd.DataFrame) -> pd.DataFrame:
        """Create technical features for factor models"""
        features = pd.DataFrame(index=price_data.index)
        
        for symbol in price_data.columns:
            prices = price_data[symbol]
            
            # Moving averages
            features[f'{symbol}_ma_20'] = prices.rolling(20).mean()
            features[f'{symbol}_ma_50'] = prices.rolling(50).mean()
            
            # Momentum
            features[f'{symbol}_momentum_10'] = prices.pct_change(10)
            features[f'{symbol}_momentum_20'] = prices.pct_change(20)
            
            # Volatility
            features[f'{symbol}_vol_20'] = prices.pct_change().rolling(20).std()
            
            # RSI
            delta = prices.diff()
            gain = (delta.where(delta > 0, 0)).rolling(14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
            rs = gain / loss
            features[f'{symbol}_rsi'] = 100 - (100 / (1 + rs))
        
        return features.dropna()
    
    def _summarize_factor_model(self, factor_loadings: Dict) -> Dict:
        """Summarize factor model results"""
        if not factor_loadings:
            return {}
        
        avg_r2 = np.mean([loading['r_squared'] for loading in factor_loadings.values()])
        
        return {
            'average_r_squared': avg_r2,
            'model_quality': 'HIGH' if avg_r2 > 0.3 else 'MEDIUM' if avg_r2 > 0.1 else 'LOW',
            'significant_models': len([l for l in factor_loadings.values() if l['r_squared'] > 0.2])
        }
    
    def _calculate_factor_importance(self, factor_loadings: Dict, factors: List[str]) -> Dict:
        """Calculate average factor importance across all models"""
        factor_importance = {factor: [] for factor in factors}
        
        for loading in factor_loadings.values():
            for factor in factors:
                if factor in loading['coefficients']:
                    factor_importance[factor].append(abs(loading['coefficients'][factor]))
        
        return {factor: np.mean(values) if values else 0 
                for factor, values in factor_importance.items()}
    
    def _get_top_features(self, models: Dict, n: int = 5) -> List[str]:
        """Get top features across all models"""
        all_features = {}
        
        for model_data in models.values():
            for feature, importance in model_data['feature_importance'].items():
                if feature not in all_features:
                    all_features[feature] = []
                all_features[feature].append(importance)
        
        # Average importance
        avg_importance = {feature: np.mean(values) 
                         for feature, values in all_features.items()}
        
        # Sort by importance
        sorted_features = sorted(avg_importance.items(), key=lambda x: x[1], reverse=True)
        
        return [feature for feature, _ in sorted_features[:n]]

class ModelValidator:
    def __init__(self):
        pass
    
    def cross_validation_analysis(self, model, X: np.ndarray, y: np.ndarray, 
                                 cv_folds: int = 5) -> Dict:
        """Perform cross-validation analysis"""
        
        # Cross-validation scores
        cv_scores = cross_val_score(model, X, y, cv=cv_folds, scoring='r2')
        
        return {
            'cv_scores': cv_scores,
            'mean_cv_score': cv_scores.mean(),
            'std_cv_score': cv_scores.std(),
            'cv_stability': 'HIGH' if cv_scores.std() < 0.1 else 'MEDIUM' if cv_scores.std() < 0.2 else 'LOW'
        }
    
    def out_of_sample_validation(self, model, X_train: np.ndarray, y_train: np.ndarray,
                               X_test: np.ndarray, y_test: np.ndarray) -> Dict:
        """Validate model on out-of-sample data"""
        
        # Fit model
        model.fit(X_train, y_train)
        
        # Predictions
        y_pred_train = model.predict(X_train)
        y_pred_test = model.predict(X_test)
        
        # Metrics
        train_r2 = r2_score(y_train, y_pred_train)
        test_r2 = r2_score(y_test, y_pred_test)
        
        # Overfitting check
        overfitting = train_r2 - test_r2
        
        return {
            'train_r2': train_r2,
            'test_r2': test_r2,
            'overfitting': overfitting,
            'model_stability': 'STABLE' if overfitting < 0.1 else 'MODERATE' if overfitting < 0.2 else 'OVERFITTED'
        }
    
    def statistical_significance_test(self, predictions: np.ndarray, 
                                    actual: np.ndarray) -> Dict:
        """Test statistical significance of model predictions"""
        
        from scipy import stats
        
        # Correlation test
        correlation, p_value = stats.pearsonr(predictions, actual)
        
        # T-test for mean difference
        t_stat, t_p_value = stats.ttest_1samp(predictions - actual, 0)
        
        return {
            'correlation': correlation,
            'correlation_p_value': p_value,
            'correlation_significant': p_value < 0.05,
            't_statistic': t_stat,
            't_p_value': t_p_value,
            'mean_difference_significant': t_p_value < 0.05
        }