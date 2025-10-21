import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
try:
    import xgboost as xgb
    import lightgbm as lgb
    ADVANCED_ML_AVAILABLE = True
except ImportError:
    ADVANCED_ML_AVAILABLE = False

try:
    import catboost as cb
    CATBOOST_AVAILABLE = True
except ImportError:
    CATBOOST_AVAILABLE = False

try:
    import pycaret.regression as pycaret_reg
    PYCARET_AVAILABLE = True
except ImportError:
    PYCARET_AVAILABLE = False

from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_squared_error, r2_score
import joblib
import asyncio
from concurrent.futures import ThreadPoolExecutor
from clients.market_data_client import MarketDataClient
from utils.logger import logger

class MLPredictor:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
        self.models = {}
        self.scalers = {}
        self.feature_importance = {}
    
    def train_return_prediction_model(self, symbols: List[str], 
                                    lookback_days: int = 252) -> Dict:
        """Train ML model for return prediction using real market data"""
        
        # Get real historical data
        try:
            price_data = self.data_client.get_price_data(symbols, "2y")
        except Exception as e:
            logger.error(f"Failed to fetch market data: {e}")
            return {}
        
        if price_data.empty:
            logger.warning("No market data available for ML training")
            return {}
        
        results = {}
        
        for symbol in symbols:
            if symbol in price_data.columns:
                # Prepare features and target
                features, target = self._prepare_ml_features(price_data[symbol], lookback_days)
                
                if len(features) < 100:  # Need sufficient real data
                    logger.warning(f"Insufficient data for {symbol}: {len(features)} rows")
                    continue
                
                # Split data
                X_train, X_test, y_train, y_test = train_test_split(
                    features, target, test_size=0.2, random_state=42
                )
                
                # Scale features
                scaler = StandardScaler()
                X_train_scaled = scaler.fit_transform(X_train)
                X_test_scaled = scaler.transform(X_test)
                
                # Train multiple models
                models = {
                    'random_forest': RandomForestRegressor(n_estimators=100, random_state=42),
                    'gradient_boosting': GradientBoostingRegressor(n_estimators=100, random_state=42),
                    'ridge': Ridge(alpha=1.0)
                }
                
                # Add advanced models if available
                if ADVANCED_ML_AVAILABLE:
                    models.update({
                        'xgboost': xgb.XGBRegressor(n_estimators=100, random_state=42, verbosity=0),
                        'lightgbm': lgb.LGBMRegressor(n_estimators=100, random_state=42, verbosity=-1)
                    })
                
                # Add CatBoost if available
                if CATBOOST_AVAILABLE:
                    models['catboost'] = cb.CatBoostRegressor(
                        iterations=100, random_seed=42, verbose=False
                    )
                
                model_results = {}
                
                for model_name, model in models.items():
                    # Train model
                    model.fit(X_train_scaled, y_train)
                    
                    # Predictions
                    y_pred = model.predict(X_test_scaled)
                    
                    # Metrics
                    mse = mean_squared_error(y_test, y_pred)
                    r2 = r2_score(y_test, y_pred)
                    
                    model_results[model_name] = {
                        'model': model,
                        'mse': mse,
                        'r2': r2,
                        'feature_importance': getattr(model, 'feature_importances_', None)
                    }
                
                # Select best model
                best_model_name = max(model_results.keys(), 
                                    key=lambda k: model_results[k]['r2'])
                best_model = model_results[best_model_name]
                
                # Store model and scaler
                self.models[symbol] = best_model['model']
                self.scalers[symbol] = scaler
                
                if best_model['feature_importance'] is not None:
                    self.feature_importance[symbol] = best_model['feature_importance']
                
                results[symbol] = {
                    'best_model': best_model_name,
                    'r2_score': best_model['r2'],
                    'mse': best_model['mse'],
                    'model_comparison': {k: {'r2': v['r2'], 'mse': v['mse']} 
                                       for k, v in model_results.items()}
                }
        
        return results
    
    def predict_returns(self, symbols: List[str], horizon_days: int = 5) -> Dict:
        """Predict future returns using trained models"""
        
        predictions = {}
        
        for symbol in symbols:
            if symbol in self.models:
                # Get recent data for features
                recent_data = self.data_client.get_price_data([symbol], "3m")
                
                if symbol in recent_data.columns:
                    # Prepare features
                    features, _ = self._prepare_ml_features(recent_data[symbol], 
                                                          lookback_days=30)
                    
                    if len(features) > 0:
                        # Use latest features
                        latest_features = features.iloc[-1:].values
                        
                        # Scale features
                        scaled_features = self.scalers[symbol].transform(latest_features)
                        
                        # Predict
                        prediction = self.models[symbol].predict(scaled_features)[0]
                        
                        # Calculate confidence (simplified)
                        confidence = min(0.95, max(0.5, 
                                       self.feature_importance.get(symbol, [0.5])[0]))
                        
                        predictions[symbol] = {
                            'predicted_return': prediction,
                            'confidence': confidence,
                            'horizon_days': horizon_days,
                            'prediction_date': datetime.now().isoformat()
                        }
        
        return predictions
    
    def _prepare_ml_features(self, price_series: pd.Series, 
                           lookback_days: int) -> Tuple[pd.DataFrame, pd.Series]:
        """Prepare ML features from real market data"""
        
        if len(price_series) < 252:  # Need at least 1 year of data
            logger.warning(f"Insufficient data: {len(price_series)} days, need 252+")
            return pd.DataFrame(), pd.Series()
        
        df = pd.DataFrame({'price': price_series.dropna()})
        
        # Technical indicators as features
        df['returns'] = df['price'].pct_change()
        df['log_returns'] = np.log(df['price'] / df['price'].shift(1))
        
        # Moving averages
        for window in [5, 10, 20, 50]:
            df[f'ma_{window}'] = df['price'].rolling(window).mean()
            df[f'ma_ratio_{window}'] = df['price'] / df[f'ma_{window}']
        
        # Volatility features
        df['volatility_5'] = df['returns'].rolling(5).std()
        df['volatility_20'] = df['returns'].rolling(20).std()
        
        # Momentum features
        for period in [5, 10, 20]:
            df[f'momentum_{period}'] = df['price'].pct_change(period)
        
        # RSI
        delta = df['returns']
        gain = (delta.where(delta > 0, 0)).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / (loss + 1e-10)
        df['rsi'] = 100 - (100 / (1 + rs))
        
        # Bollinger Bands
        df['bb_upper'] = df['ma_20'] + (df['volatility_20'] * 2)
        df['bb_lower'] = df['ma_20'] - (df['volatility_20'] * 2)
        df['bb_position'] = (df['price'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'] + 1e-10)
        
        # Target: 5-day forward return
        df['target'] = df['returns'].shift(-5)
        
        # Select feature columns
        feature_cols = [col for col in df.columns 
                       if col not in ['price', 'returns', 'log_returns', 'target']]
        
        # Remove rows with NaN and infinite values
        df_clean = df.replace([np.inf, -np.inf], np.nan).dropna()
        
        if len(df_clean) < 100:
            logger.warning(f"Insufficient clean data: {len(df_clean)} rows")
            return pd.DataFrame(), pd.Series()
        
        features = df_clean[feature_cols]
        target = df_clean['target']
        
        return features, target
    
    def save_models(self, filepath: str):
        """Save trained models to disk"""
        model_data = {
            'models': self.models,
            'scalers': self.scalers,
            'feature_importance': self.feature_importance,
            'saved_at': datetime.now().isoformat()
        }
        
        joblib.dump(model_data, filepath)
    
    def load_models(self, filepath: str):
        """Load trained models from disk"""
        try:
            model_data = joblib.load(filepath)
            self.models = model_data['models']
            self.scalers = model_data['scalers']
            self.feature_importance = model_data['feature_importance']
            return True
        except:
            return False

class AlternativeDataProcessor:
    def __init__(self):
        self.data_sources = {}
    
    def integrate_sentiment_data(self, sentiment_scores: Dict[str, float], 
                               symbols: List[str]) -> pd.DataFrame:
        """Integrate sentiment data as ML features"""
        
        sentiment_df = pd.DataFrame({
            'symbol': symbols,
            'sentiment_score': [sentiment_scores.get(symbol, 0) for symbol in symbols],
            'sentiment_category': [self._categorize_sentiment(sentiment_scores.get(symbol, 0)) 
                                 for symbol in symbols]
        })
        
        # Add sentiment momentum (change over time)
        sentiment_df['sentiment_momentum'] = sentiment_df['sentiment_score'].diff()
        
        return sentiment_df
    
    def integrate_fundamental_data(self, fundamental_data: Dict) -> pd.DataFrame:
        """Integrate fundamental data as ML features"""
        
        fundamental_features = []
        
        for symbol, data in fundamental_data.items():
            ratios = data.get('ratios', {})
            
            features = {
                'symbol': symbol,
                'pe_ratio': ratios.get('pe_ratio', 0),
                'roe': ratios.get('roe', 0),
                'debt_to_equity': ratios.get('debt_to_equity', 0),
                'current_ratio': ratios.get('current_ratio', 0),
                'revenue_growth': ratios.get('revenue_growth', 0)
            }
            
            fundamental_features.append(features)
        
        return pd.DataFrame(fundamental_features)
    
    def integrate_macro_data(self, macro_indicators: Dict) -> Dict:
        """Integrate macroeconomic data"""
        
        processed_macro = {
            'interest_rate': macro_indicators.get('fed_funds_rate', 0.05),
            'inflation_rate': macro_indicators.get('cpi_change', 0.02),
            'gdp_growth': macro_indicators.get('gdp_growth', 0.025),
            'vix_level': macro_indicators.get('vix', 20),
            'dollar_index': macro_indicators.get('dxy', 100)
        }
        
        # Add derived features
        processed_macro['real_interest_rate'] = (processed_macro['interest_rate'] - 
                                               processed_macro['inflation_rate'])
        processed_macro['risk_appetite'] = 1 / (1 + processed_macro['vix_level'] / 100)
        
        return processed_macro
    
    def _categorize_sentiment(self, score: float) -> str:
        """Categorize sentiment score"""
        if score > 0.1:
            return 'POSITIVE'
        elif score < -0.1:
            return 'NEGATIVE'
        else:
            return 'NEUTRAL'

class HighFrequencyAnalyzer:
    def __init__(self):
        self.tick_data = {}
        self.microstructure_metrics = {}
    
    async def process_tick_data(self, symbol: str, tick_data: List[Dict]) -> Dict:
        """Process high-frequency tick data"""
        
        df = pd.DataFrame(tick_data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp')
        
        # Microstructure metrics
        metrics = await self._calculate_microstructure_metrics(df)
        
        self.microstructure_metrics[symbol] = metrics
        
        return metrics
    
    async def _calculate_microstructure_metrics(self, df: pd.DataFrame) -> Dict:
        """Calculate microstructure metrics"""
        
        # Bid-ask spread analysis
        if 'bid' in df.columns and 'ask' in df.columns:
            df['spread'] = df['ask'] - df['bid']
            df['spread_pct'] = df['spread'] / df['ask']
            
            avg_spread = df['spread_pct'].mean()
            spread_volatility = df['spread_pct'].std()
        else:
            avg_spread = 0
            spread_volatility = 0
        
        # Price impact analysis
        df['price_change'] = df['price'].diff()
        df['volume_imbalance'] = df.get('buy_volume', 0) - df.get('sell_volume', 0)
        
        # Order flow metrics
        if 'volume' in df.columns:
            avg_trade_size = df['volume'].mean()
            volume_weighted_price = (df['price'] * df['volume']).sum() / df['volume'].sum()
        else:
            avg_trade_size = 0
            volume_weighted_price = df['price'].mean()
        
        # Volatility clustering
        returns = df['price'].pct_change().dropna()
        volatility_clustering = returns.rolling(10).std().std() if len(returns) > 10 else 0
        
        return {
            'avg_spread_pct': avg_spread,
            'spread_volatility': spread_volatility,
            'avg_trade_size': avg_trade_size,
            'vwap': volume_weighted_price,
            'volatility_clustering': volatility_clustering,
            'tick_count': len(df),
            'analysis_timestamp': datetime.now().isoformat()
        }
    
    def detect_market_regime(self, price_data: pd.Series) -> str:
        """Detect current market regime using HF data"""
        
        returns = price_data.pct_change().dropna()
        
        if len(returns) < 20:
            return "INSUFFICIENT_DATA"
        
        # Regime detection based on volatility and trend
        recent_vol = returns.tail(20).std()
        long_term_vol = returns.std()
        
        recent_trend = returns.tail(10).mean()
        
        if recent_vol > long_term_vol * 1.5:
            if recent_trend > 0:
                return "HIGH_VOLATILITY_BULL"
            else:
                return "HIGH_VOLATILITY_BEAR"
        elif recent_vol < long_term_vol * 0.7:
            return "LOW_VOLATILITY"
        else:
            if recent_trend > 0.001:
                return "TRENDING_UP"
            elif recent_trend < -0.001:
                return "TRENDING_DOWN"
            else:
                return "SIDEWAYS"

class AutoMLEngine:
    """Automated ML using PyCaret for comprehensive model comparison"""
    
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
        self.automl_models = {}
        self.experiment_results = {}
    
    def run_automl_experiment(self, symbols: List[str], target_days: int = 5) -> Dict:
        """Run automated ML experiment using PyCaret"""
        
        if not PYCARET_AVAILABLE:
            return {'error': 'PyCaret not available'}
        
        results = {}
        
        for symbol in symbols:
            try:
                # Get market data
                price_data = self.data_client.get_price_data([symbol], "2y")
                
                if symbol not in price_data.columns or len(price_data) < 500:
                    continue
                
                # Prepare dataset
                dataset = self._prepare_automl_dataset(price_data[symbol], target_days)
                
                if len(dataset) < 100:
                    continue
                
                # Setup PyCaret experiment
                exp = pycaret_reg.setup(
                    data=dataset,
                    target='target_return',
                    session_id=42,
                    train_size=0.8,
                    silent=True,
                    verbose=False
                )
                
                # Compare multiple models
                best_models = pycaret_reg.compare_models(
                    include=['rf', 'gbr', 'lr', 'ridge', 'lasso', 'en', 'dt', 'knn'],
                    sort='R2',
                    n_select=3,
                    verbose=False
                )
                
                # Create ensemble
                ensemble_model = pycaret_reg.ensemble_model(
                    best_models[0], method='Bagging', verbose=False
                )
                
                # Finalize model
                final_model = pycaret_reg.finalize_model(ensemble_model)
                
                # Get model metrics
                model_results = pycaret_reg.pull()
                
                self.automl_models[symbol] = final_model
                
                results[symbol] = {
                    'best_model_r2': float(model_results.iloc[0]['R2']),
                    'best_model_rmse': float(model_results.iloc[0]['RMSE']),
                    'best_model_mae': float(model_results.iloc[0]['MAE']),
                    'model_count': len(model_results),
                    'ensemble_method': 'Bagging',
                    'experiment_date': datetime.now().isoformat()
                }
                
            except Exception as e:
                logger.error(f"AutoML experiment failed for {symbol}: {e}")
                results[symbol] = {'error': str(e)}
        
        self.experiment_results = results
        return results
    
    def predict_with_automl(self, symbols: List[str]) -> Dict:
        """Make predictions using AutoML models"""
        
        predictions = {}
        
        for symbol in symbols:
            if symbol in self.automl_models:
                try:
                    # Get recent data
                    recent_data = self.data_client.get_price_data([symbol], "3m")
                    
                    if symbol in recent_data.columns:
                        # Prepare features
                        dataset = self._prepare_automl_dataset(recent_data[symbol], 5)
                        
                        if len(dataset) > 0:
                            # Get latest features (exclude target)
                            latest_features = dataset.drop('target_return', axis=1).iloc[-1:]
                            
                            # Predict using PyCaret
                            prediction = pycaret_reg.predict_model(
                                self.automl_models[symbol], 
                                data=latest_features,
                                verbose=False
                            )
                            
                            predicted_return = float(prediction['prediction_label'].iloc[0])
                            
                            predictions[symbol] = {
                                'predicted_return': predicted_return,
                                'model_type': 'AutoML_Ensemble',
                                'prediction_date': datetime.now().isoformat()
                            }
                            
                except Exception as e:
                    logger.error(f"AutoML prediction failed for {symbol}: {e}")
                    predictions[symbol] = {'error': str(e)}
        
        return predictions
    
    def _prepare_automl_dataset(self, price_series: pd.Series, target_days: int) -> pd.DataFrame:
        """Prepare dataset for AutoML with comprehensive features"""
        
        df = pd.DataFrame({'price': price_series.dropna()})
        
        # Price-based features
        df['returns'] = df['price'].pct_change()
        df['log_returns'] = np.log(df['price'] / df['price'].shift(1))
        
        # Moving averages and ratios
        for window in [5, 10, 20, 50, 100]:
            df[f'sma_{window}'] = df['price'].rolling(window).mean()
            df[f'price_sma_ratio_{window}'] = df['price'] / df[f'sma_{window}']
        
        # Exponential moving averages
        for span in [12, 26, 50]:
            df[f'ema_{span}'] = df['price'].ewm(span=span).mean()
            df[f'price_ema_ratio_{span}'] = df['price'] / df[f'ema_{span}']
        
        # Volatility features
        for window in [5, 10, 20, 50]:
            df[f'volatility_{window}'] = df['returns'].rolling(window).std()
            df[f'volatility_ratio_{window}'] = df[f'volatility_{window}'] / df['volatility_20']
        
        # Momentum and trend features
        for period in [1, 3, 5, 10, 20, 50]:
            df[f'momentum_{period}'] = df['price'].pct_change(period)
            df[f'trend_{period}'] = df['price'].rolling(period).apply(lambda x: 1 if x.iloc[-1] > x.iloc[0] else 0)
        
        # Technical indicators
        # RSI
        delta = df['returns']
        gain = (delta.where(delta > 0, 0)).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / (loss + 1e-10)
        df['rsi'] = 100 - (100 / (1 + rs))
        
        # MACD
        ema12 = df['price'].ewm(span=12).mean()
        ema26 = df['price'].ewm(span=26).mean()
        df['macd'] = ema12 - ema26
        df['macd_signal'] = df['macd'].ewm(span=9).mean()
        df['macd_histogram'] = df['macd'] - df['macd_signal']
        
        # Bollinger Bands
        df['bb_middle'] = df['price'].rolling(20).mean()
        bb_std = df['price'].rolling(20).std()
        df['bb_upper'] = df['bb_middle'] + (bb_std * 2)
        df['bb_lower'] = df['bb_middle'] - (bb_std * 2)
        df['bb_position'] = (df['price'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'] + 1e-10)
        df['bb_width'] = (df['bb_upper'] - df['bb_lower']) / df['bb_middle']
        
        # Volume-based features (if available)
        if 'volume' in price_series.index.names or len(price_series.shape) > 1:
            # Placeholder for volume features
            df['volume_sma_10'] = 1000000  # Default volume
            df['volume_ratio'] = 1.0
        
        # Target variable
        df['target_return'] = df['returns'].shift(-target_days)
        
        # Select feature columns (exclude intermediate calculations)
        feature_cols = [col for col in df.columns 
                       if not col.startswith(('price', 'returns', 'log_returns', 'sma_', 'ema_')) 
                       or col.endswith('_ratio') or col in ['rsi', 'macd', 'macd_signal', 'macd_histogram', 
                                                           'bb_position', 'bb_width', 'target_return']]
        
        # Clean dataset
        dataset = df[feature_cols].replace([np.inf, -np.inf], np.nan).dropna()
        
        return dataset
    
    def get_feature_importance(self, symbol: str) -> Dict:
        """Get feature importance from AutoML model"""
        
        if symbol not in self.automl_models or not PYCARET_AVAILABLE:
            return {}
        
        try:
            # Interpret model
            interpretation = pycaret_reg.interpret_model(
                self.automl_models[symbol], 
                plot='feature',
                save=False
            )
            
            return {
                'feature_importance_available': True,
                'interpretation_date': datetime.now().isoformat()
            }
            
        except Exception as e:
            return {'error': str(e)}

class CrossAssetAnalyzer:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
    
    def analyze_cross_asset_correlations(self, equity_symbols: List[str], 
                                       bond_symbols: List[str] = ['TLT', 'IEF'],
                                       commodity_symbols: List[str] = ['GLD', 'USO']) -> Dict:
        """Analyze correlations across asset classes"""
        
        all_symbols = equity_symbols + bond_symbols + commodity_symbols
        price_data = self.data_client.get_price_data(all_symbols, "1y")
        
        if price_data.empty:
            return {}
        
        returns = price_data.pct_change().dropna()
        
        # Filter symbols that actually have data
        available_symbols = list(returns.columns)
        available_equity = [s for s in equity_symbols if s in available_symbols]
        available_bonds = [s for s in bond_symbols if s in available_symbols]
        available_commodities = [s for s in commodity_symbols if s in available_symbols]
        
        if not available_equity:
            return {'error': 'No equity data available'}
        
        # Calculate cross-asset correlations
        correlation_matrix = returns.corr()
        
        # Asset class correlations (only if symbols are available)
        cross_asset_correlations = {}
        
        try:
            if available_equity and available_bonds:
                equity_bond_corr = correlation_matrix.loc[available_equity, available_bonds].mean().mean()
                cross_asset_correlations['equity_bond'] = equity_bond_corr if not pd.isna(equity_bond_corr) else 0.0
            
            if available_equity and available_commodities:
                equity_commodity_corr = correlation_matrix.loc[available_equity, available_commodities].mean().mean()
                cross_asset_correlations['equity_commodity'] = equity_commodity_corr if not pd.isna(equity_commodity_corr) else 0.0
            
            if available_bonds and available_commodities:
                bond_commodity_corr = correlation_matrix.loc[available_bonds, available_commodities].mean().mean()
                cross_asset_correlations['bond_commodity'] = bond_commodity_corr if not pd.isna(bond_commodity_corr) else 0.0
        except KeyError as e:
            # Handle case where symbols are not in correlation matrix
            cross_asset_correlations['error'] = f"Some symbols not available: {str(e)}"
        
        # Risk-on/Risk-off analysis
        try:
            risk_on_score = self._calculate_risk_on_score(returns, available_equity, available_bonds)
        except Exception as e:
            risk_on_score = 0.5  # Default neutral score
        
        return {
            'correlation_matrix': correlation_matrix.to_dict(),
            'cross_asset_correlations': cross_asset_correlations,
            'risk_on_score': risk_on_score,
            'diversification_benefit': self._calculate_diversification_benefit(correlation_matrix) if not correlation_matrix.empty else 0.0,
            'available_symbols': {
                'equity': available_equity,
                'bonds': available_bonds,
                'commodities': available_commodities
            },
            'analysis_date': datetime.now().isoformat()
        }
    
    def _calculate_risk_on_score(self, returns: pd.DataFrame, 
                               equity_symbols: List[str], 
                               bond_symbols: List[str]) -> float:
        """Calculate risk-on/risk-off score"""
        
        if not equity_symbols or not bond_symbols:
            return 0.5
        
        # Filter symbols that exist in returns data
        available_equity = [s for s in equity_symbols if s in returns.columns]
        available_bonds = [s for s in bond_symbols if s in returns.columns]
        
        if not available_equity or not available_bonds:
            return 0.5
        
        # Risk-on: equities up, bonds down
        # Risk-off: equities down, bonds up
        
        equity_performance = returns[available_equity].mean(axis=1)
        bond_performance = returns[available_bonds].mean(axis=1)
        
        # Correlation between equity and bond performance (negative = risk-on/off regime)
        correlation = equity_performance.corr(bond_performance)
        
        # Handle NaN correlation
        if pd.isna(correlation):
            return 0.5
        
        # Convert to 0-1 score (0 = risk-off, 1 = risk-on)
        risk_on_score = (1 - correlation) / 2
        
        return max(0, min(1, risk_on_score))
    
    def _calculate_diversification_benefit(self, correlation_matrix: pd.DataFrame) -> float:
        """Calculate portfolio diversification benefit"""
        
        if correlation_matrix.empty:
            return 0.0
        
        # Average correlation across all assets (excluding diagonal)
        mask = ~np.eye(correlation_matrix.shape[0], dtype=bool)
        correlations = correlation_matrix.values[mask]
        
        # Filter out NaN values
        valid_correlations = correlations[~pd.isna(correlations)]
        
        if len(valid_correlations) == 0:
            return 0.0
        
        avg_correlation = np.mean(valid_correlations)
        
        # Diversification benefit (lower correlation = higher benefit)
        diversification_benefit = 1 - abs(avg_correlation)
        
        return max(0, min(1, diversification_benefit))

class AdvancedMLPipeline:
    """Advanced ML pipeline combining all available ML libraries"""
    
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
        self.ml_predictor = MLPredictor(data_client)
        self.automl_engine = AutoMLEngine(data_client) if PYCARET_AVAILABLE else None
        self.ensemble_models = {}
    
    def run_comprehensive_analysis(self, symbols: List[str]) -> Dict:
        """Run comprehensive ML analysis using all available methods"""
        
        results = {
            'traditional_ml': {},
            'automl': {},
            'ensemble': {},
            'model_comparison': {},
            'available_libraries': {
                'xgboost': ADVANCED_ML_AVAILABLE,
                'lightgbm': ADVANCED_ML_AVAILABLE,
                'catboost': CATBOOST_AVAILABLE,
                'pycaret': PYCARET_AVAILABLE
            }
        }
        
        # Traditional ML approach
        try:
            traditional_results = self.ml_predictor.train_return_prediction_model(symbols)
            results['traditional_ml'] = traditional_results
        except Exception as e:
            results['traditional_ml'] = {'error': str(e)}
        
        # AutoML approach (if available)
        if self.automl_engine:
            try:
                automl_results = self.automl_engine.run_automl_experiment(symbols)
                results['automl'] = automl_results
            except Exception as e:
                results['automl'] = {'error': str(e)}
        
        # Model comparison and ensemble
        for symbol in symbols:
            try:
                comparison = self._compare_model_performance(symbol)
                results['model_comparison'][symbol] = comparison
            except Exception as e:
                results['model_comparison'][symbol] = {'error': str(e)}
        
        return results
    
    def _compare_model_performance(self, symbol: str) -> Dict:
        """Compare performance across different ML approaches"""
        
        comparison = {
            'traditional_ml': {},
            'automl': {},
            'best_approach': 'unknown'
        }
        
        # Get traditional ML results
        if symbol in self.ml_predictor.models:
            traditional_pred = self.ml_predictor.predict_returns([symbol])
            if symbol in traditional_pred:
                comparison['traditional_ml'] = traditional_pred[symbol]
        
        # Get AutoML results
        if self.automl_engine and symbol in self.automl_engine.automl_models:
            automl_pred = self.automl_engine.predict_with_automl([symbol])
            if symbol in automl_pred:
                comparison['automl'] = automl_pred[symbol]
        
        # Determine best approach (simplified)
        if comparison['traditional_ml'] and comparison['automl']:
            # Compare based on available confidence/performance metrics
            trad_conf = comparison['traditional_ml'].get('confidence', 0)
            automl_available = 'error' not in comparison['automl']
            
            if automl_available and trad_conf < 0.7:
                comparison['best_approach'] = 'automl'
            else:
                comparison['best_approach'] = 'traditional_ml'
        elif comparison['traditional_ml']:
            comparison['best_approach'] = 'traditional_ml'
        elif comparison['automl']:
            comparison['best_approach'] = 'automl'
        
        return comparison