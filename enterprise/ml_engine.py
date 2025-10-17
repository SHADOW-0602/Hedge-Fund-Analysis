import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_squared_error, r2_score
import joblib
import asyncio
from concurrent.futures import ThreadPoolExecutor
from clients.market_data_client import MarketDataClient

class MLPredictor:
    def __init__(self, data_client: MarketDataClient):
        self.data_client = data_client
        self.models = {}
        self.scalers = {}
        self.feature_importance = {}
    
    def train_return_prediction_model(self, symbols: List[str], 
                                    lookback_days: int = 252) -> Dict:
        """Train ML model for return prediction"""
        
        # Get historical data
        price_data = self.data_client.get_price_data(symbols, "2y")
        
        if price_data.empty:
            return {}
        
        results = {}
        
        for symbol in symbols:
            if symbol in price_data.columns:
                # Prepare features and target
                features, target = self._prepare_ml_features(price_data[symbol], lookback_days)
                
                if len(features) < 100:  # Need sufficient data
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
        """Prepare ML features from price data"""
        
        df = pd.DataFrame({'price': price_series})
        
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
        rs = gain / loss
        df['rsi'] = 100 - (100 / (1 + rs))
        
        # Bollinger Bands
        df['bb_upper'] = df['ma_20'] + (df['volatility_20'] * 2)
        df['bb_lower'] = df['ma_20'] - (df['volatility_20'] * 2)
        df['bb_position'] = (df['price'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])
        
        # Target: future returns
        df['target'] = df['returns'].shift(-5)  # 5-day forward return
        
        # Select feature columns
        feature_cols = [col for col in df.columns 
                       if col not in ['price', 'returns', 'log_returns', 'target']]
        
        # Remove rows with NaN
        df_clean = df.dropna()
        
        if len(df_clean) == 0:
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
        
        # Calculate cross-asset correlations
        correlation_matrix = returns.corr()
        
        # Asset class correlations
        equity_bond_corr = correlation_matrix.loc[equity_symbols, bond_symbols].mean().mean()
        equity_commodity_corr = correlation_matrix.loc[equity_symbols, commodity_symbols].mean().mean()
        bond_commodity_corr = correlation_matrix.loc[bond_symbols, commodity_symbols].mean().mean()
        
        # Risk-on/Risk-off analysis
        risk_on_score = self._calculate_risk_on_score(returns, equity_symbols, bond_symbols)
        
        return {
            'correlation_matrix': correlation_matrix.to_dict(),
            'cross_asset_correlations': {
                'equity_bond': equity_bond_corr,
                'equity_commodity': equity_commodity_corr,
                'bond_commodity': bond_commodity_corr
            },
            'risk_on_score': risk_on_score,
            'diversification_benefit': self._calculate_diversification_benefit(correlation_matrix),
            'analysis_date': datetime.now().isoformat()
        }
    
    def _calculate_risk_on_score(self, returns: pd.DataFrame, 
                               equity_symbols: List[str], 
                               bond_symbols: List[str]) -> float:
        """Calculate risk-on/risk-off score"""
        
        if not equity_symbols or not bond_symbols:
            return 0.5
        
        # Risk-on: equities up, bonds down
        # Risk-off: equities down, bonds up
        
        equity_performance = returns[equity_symbols].mean(axis=1)
        bond_performance = returns[bond_symbols].mean(axis=1)
        
        # Correlation between equity and bond performance (negative = risk-on/off regime)
        correlation = equity_performance.corr(bond_performance)
        
        # Convert to 0-1 score (0 = risk-off, 1 = risk-on)
        risk_on_score = (1 - correlation) / 2
        
        return max(0, min(1, risk_on_score))
    
    def _calculate_diversification_benefit(self, correlation_matrix: pd.DataFrame) -> float:
        """Calculate portfolio diversification benefit"""
        
        # Average correlation across all assets
        avg_correlation = correlation_matrix.mean().mean()
        
        # Diversification benefit (lower correlation = higher benefit)
        diversification_benefit = 1 - avg_correlation
        
        return max(0, min(1, diversification_benefit))