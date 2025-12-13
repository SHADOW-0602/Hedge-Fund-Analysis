from flask import request, jsonify
import pandas as pd
import polars as pl
from datetime import datetime
import json
from clients.supabase_client import supabase_client


def clean_for_json(obj):
    """Ensure all values are JSON serializable"""
    import numpy as np
    import pandas as pd
    
    if isinstance(obj, (np.integer, np.floating)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, complex):
        return float(obj.real)
    elif isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_for_json(item) for item in obj]
    elif hasattr(obj, '__dict__'):
        return clean_for_json(obj.__dict__)
    try:
        if pd.isna(obj) or (isinstance(obj, (int, float)) and not np.isfinite(obj)):
            return 0.0
    except:
        pass
    return obj

def normalize_transaction_format(transactions_data):
    if not transactions_data:
        return transactions_data
    
    try:
        # Try using Polars first (requires pyarrow usually)
        df_pl = pl.DataFrame(transactions_data)
        df_pl = df_pl.rename({col: col.lower().strip() for col in df_pl.columns})
        cols = df_pl.columns
        
        if 'action' in cols:
            df_pl = df_pl.with_columns([pl.col('action').str.to_uppercase().alias('transaction_type')])
        if 'ticker' in cols:
            df_pl = df_pl.with_columns([pl.col('ticker').alias('symbol')])
        
        if 'transaction_type' in df_pl.columns and 'quantity' in df_pl.columns:
            df_pl = df_pl.with_columns([
                pl.when(pl.col('transaction_type') == 'SELL')
                .then(-pl.col('quantity').abs())
                .otherwise(pl.col('quantity').abs())
                .alias('quantity')
            ])
        
        if 'date' in df_pl.columns:
            current_date = datetime.now().strftime('%Y-%m-%d')
            df_pl = df_pl.with_columns([
                pl.when(pl.col('date').is_null() | (pl.col('date') == ''))
                .then(pl.lit(current_date))
                .otherwise(pl.col('date'))
                .alias('date')
            ])
        
        if 'fees' not in df_pl.columns:
            df_pl = df_pl.with_columns([pl.lit(0.0).alias('fees')])
        if 'portfolio' not in df_pl.columns:
            df_pl = df_pl.with_columns([pl.lit('Main').alias('portfolio')])
        if 'currency' not in df_pl.columns:
            df_pl = df_pl.with_columns([pl.lit('USD').alias('currency')])
        
        return df_pl.to_pandas().to_dict('records')
        
    except (ImportError, ModuleNotFoundError, Exception) as e:
        print(f"Polars normalization failed (likely missing pyarrow), falling back to Pandas: {e}")
        # Pandas Fallback
        import pandas as pd
        df = pd.DataFrame(transactions_data)
        df.columns = [str(c).lower().strip() for c in df.columns]
        
        if 'action' in df.columns:
            df['transaction_type'] = df['action'].str.upper()
        if 'ticker' in df.columns:
            df['symbol'] = df['ticker']
            
        if 'transaction_type' in df.columns and 'quantity' in df.columns:
            # Vectorized sell quantity handling
            is_sell = df['transaction_type'] == 'SELL'
            df.loc[is_sell, 'quantity'] = -df.loc[is_sell, 'quantity'].abs()
            df.loc[~is_sell, 'quantity'] = df.loc[~is_sell, 'quantity'].abs()
            
        if 'date' in df.columns:
            current_date = datetime.now().strftime('%Y-%m-%d')
            df['date'] = df['date'].fillna(current_date).replace('', current_date)
            
        if 'fees' not in df.columns:
            df['fees'] = 0.0
        if 'portfolio' not in df.columns:
            df['portfolio'] = 'Main'
        if 'currency' not in df.columns:
            df['currency'] = 'USD'
            
        return df.to_dict('records')

def register_transaction_routes(app):
    print("[DEBUG] Registering transaction routes")
    # Test route to verify transaction routes are working
    @app.route('/api/test-transactions', methods=['GET'])
    def test_transactions():
        return jsonify({'success': True, 'message': 'Transaction routes working'})
    @app.route('/api/upload-transactions', methods=['POST'])
    def upload_transactions():
        try:
            print(f"2025-10-26 16:55:49,000 - hedge_fund_app - INFO - Received transaction file upload request")
            if 'file' not in request.files:
                return jsonify({'success': False, 'error': 'No file uploaded'}), 400
            
            file = request.files['file']
            if not file.filename:
                return jsonify({'success': False, 'error': 'No file selected'}), 400
            
            try:
                if file.filename.lower().endswith('.csv'):
                    df = pd.read_csv(file.stream)
                    transactions_data = df.to_dict('records')
                elif file.filename.lower().endswith(('.xlsx', '.xls')):
                    df = pd.read_excel(file.stream)
                    transactions_data = df.to_dict('records')
                elif file.filename.lower().endswith('.json'):
                    import json
                    json_content = json.load(file.stream)
                    print(f"DEBUG: Loaded JSON content type: {type(json_content)}")
                    
                    # Handle Plaid-style nested structure
                    if isinstance(json_content, dict) and 'transactions' in json_content:
                        transactions_data = json_content['transactions']
                    elif isinstance(json_content, list):
                        transactions_data = json_content
                    else:
                        # Single object or other dict
                        transactions_data = [json_content] if isinstance(json_content, dict) else []
                    
                    # Enhanced normalization for JSON/Plaid data
                    normalized_js_data = []
                    for item in transactions_data:
                        if not isinstance(item, dict): continue
                        
                        # Soft normalization of keys
                        clean_item = {k.lower().strip(): v for k, v in item.items()}
                        
                        # Robust defaults and mapping
                        # Map Plaid 'amount' to 'price' if price missing, or 'quantity' contextually
                        # Plaid 'amount' is usually transaction value. Price = quantity * price. 
                        # If we have 'quantity' and 'amount', price = amount / quantity
                        
                        # 1. Date (Plaid: 'date' or 'authorized_date')
                        date_val = clean_item.get('date') or clean_item.get('authorized_date') or datetime.now().strftime('%Y-%m-%d')
                        
                        # 2. Symbol (Plaid: 'security_id' often matches ticker if enriched, else raw name)
                        norm_symbol = clean_item.get('symbol') or clean_item.get('ticker') or clean_item.get('name') or 'UNKNOWN'
                        
                        # 3. Quantity & Price Logic
                        qty = clean_item.get('quantity')
                        price = clean_item.get('price')
                        amount = clean_item.get('amount') # Plaid total value
                        
                        if qty is None: qty = 0.0
                        else: 
                            try: qty = float(qty)
                            except: qty = 0.0
                            
                        if price is None:
                            # If we have amount and quantity, calculate price
                            if amount is not None and qty != 0:
                                try: price = abs(float(amount)) / abs(qty)
                                except: price = 0.0
                            else:
                                price = 0.0
                        else:
                            try: price = float(price)
                            except: price = 0.0
                            
                        # 4. Transaction Type (Plaid: 'payment_channel', 'transaction_code', etc.)
                        # Simple fallback
                        tx_type = clean_item.get('transaction_type') or clean_item.get('type') or 'BUY'
                        if amount and float(amount) < 0: # Plaid: negative amount can imply flow direction depending on account
                             pass 
                        
                        normalized_js_data.append({
                            'symbol': norm_symbol,
                            'date': date_val,
                            'quantity': qty,
                            'price': price,
                            'transaction_type': tx_type,
                            'fees': float(clean_item.get('fees') or 0.0),
                            'currency': clean_item.get('iso_currency_code', 'USD')
                        })
                    
                    transactions_data = normalized_js_data
                    
                else:
                    return jsonify({'success': False, 'error': 'Unsupported file format'}), 400
                
                # Use existing normalization for final polars check
                normalized_data = normalize_transaction_format(transactions_data)
                
                print(f"2025-10-26 16:55:49,500 - hedge_fund_app - INFO - Transaction file upload completed successfully")
                return jsonify({
                    'success': True,
                    'transactions': normalized_data,
                    'filename': file.filename
                })
            except Exception as parse_error:
                print(f"2025-10-26 16:55:49,600 - hedge_fund_app - ERROR - Transaction file parsing failed: {str(parse_error)}")
                import traceback
                traceback.print_exc()
                return jsonify({'success': False, 'error': f'File parsing failed: {str(parse_error)}'}), 400
                
        except Exception as e:
            print(f"2025-10-26 16:55:49,700 - hedge_fund_app - ERROR - Transaction upload failed: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/analyze-transactions', methods=['POST'])
    def analyze_transactions():
        try:
            from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
            from core.transactions import Transaction
            from clients.market_data_client import MarketDataClient
            
            data = request.get_json()
            transactions_data = data.get('transactions', [])
            
            if not transactions_data:
                return jsonify({'success': False, 'error': 'No transaction data provided'}), 400
            
            # Convert to Transaction objects for enterprise analysis
            transactions = []
            positions = {}
            realized_pnl = 0
            total_fees = 0
            total_volume = 0
            buy_count = 0
            sell_count = 0
            
            for tx_data in transactions_data:
                try:
                    symbol = tx_data.get('symbol', '')
                    quantity = float(tx_data.get('quantity', 0))
                    price = float(tx_data.get('price', 0))
                    fees = float(tx_data.get('fees', 0))
                    tx_type = tx_data.get('transaction_type', '').upper()
                    date_str = tx_data.get('date', '')
                    
                    # Parse date
                    try:
                        if isinstance(date_str, str) and date_str.strip():
                            if 'T' in date_str:
                                date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                            else:
                                date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                        else:
                            date_obj = datetime.now()
                    except (ValueError, TypeError):
                        date_obj = datetime.now()
                    
                    # Create Transaction object
                    transaction = Transaction(
                        symbol=symbol,
                        quantity=quantity,
                        price=price,
                        date=date_obj,
                        transaction_type=tx_type,
                        fees=fees
                    )
                    transactions.append(transaction)
                    
                    # Enterprise-level position tracking
                    tx_value = abs(quantity) * price
                    total_fees += fees
                    total_volume += tx_value
                    
                    if tx_type == 'BUY':
                        buy_count += 1
                        if symbol not in positions:
                            positions[symbol] = {'quantity': 0, 'avg_cost': 0, 'lots': []}
                        
                        # FIFO lot tracking for enterprise compliance
                        old_value = positions[symbol]['quantity'] * positions[symbol]['avg_cost']
                        new_value = abs(quantity) * price
                        total_quantity = positions[symbol]['quantity'] + abs(quantity)
                        
                        if total_quantity > 0:
                            positions[symbol]['avg_cost'] = (old_value + new_value) / total_quantity
                        else:
                            positions[symbol]['avg_cost'] = new_value if new_value > 0 else 0
                        positions[symbol]['quantity'] = total_quantity
                        positions[symbol]['lots'].append({
                            'quantity': abs(quantity),
                            'price': price,
                            'date': date_obj,
                            'fees': fees
                        })
                        
                    elif tx_type == 'SELL':
                        sell_count += 1
                        if symbol in positions and positions[symbol]['quantity'] > 0:
                            sell_quantity = abs(quantity)
                            avg_cost = positions[symbol]['avg_cost']
                            pnl = (price - avg_cost) * sell_quantity - fees
                            realized_pnl += pnl
                            positions[symbol]['quantity'] -= sell_quantity
                            
                except Exception:
                    continue
            
            if not transactions:
                return jsonify({'success': False, 'error': 'No valid transactions found'}), 400
            
            # Enterprise-level analytics
            data_client = MarketDataClient()
            analyzer = AdvancedTransactionAnalyzer(data_client)
            
            # XIRR Analysis (temporarily disabled due to complex number issues)
            # from analytics.xirr_analyzer import DetailedXIRRAnalyzer
            # xirr_analyzer = DetailedXIRRAnalyzer(data_client)
            # xirr_analyzer.load_transactions(transactions)
            # symbols_for_xirr = list(set(t.symbol for t in transactions))
            # current_prices_xirr = data_client.get_current_prices(symbols_for_xirr) if symbols_for_xirr else {}
            # xirr_metrics = xirr_analyzer.calculate_detailed_xirr(current_prices_xirr)
            
            # XIRR Analysis with real calculation
            from analytics.xirr_analyzer import DetailedXIRRAnalyzer
            try:
                xirr_analyzer = DetailedXIRRAnalyzer(data_client)
                xirr_analyzer.load_transactions(transactions)
                symbols_for_xirr = list(set(t.symbol for t in transactions))
                current_prices_xirr = data_client.get_current_prices(symbols_for_xirr) if symbols_for_xirr else {}
                xirr_metrics = xirr_analyzer.calculate_detailed_xirr(current_prices_xirr)
            except Exception as e:
                print(f"XIRR calculation failed: {e}")
                # Only use fallback if real calculation fails
                class XIRRFallback:
                    def __init__(self):
                        self.xirr = 0.0
                        self.twr = 0.0
                        self.mwr = 0.0
                        self.total_return_pct = 0.0
                        self.annualized_return = 0.0
                        self.sharpe_ratio = 0.0
                        self.sortino_ratio = 0.0
                        self.max_drawdown = 0.0
                        self.volatility = 0.0
                        self.win_rate = 0.0
                        self.profit_factor = 0.0
                        self.holding_period_days = 0
                xirr_metrics = XIRRFallback()
            
            # Run comprehensive enterprise analytics
            enterprise_analytics = {
                'trade_performance': analyzer.trade_performance_analysis(transactions),
                'turnover_analysis': analyzer.turnover_analysis(transactions),
                'tax_loss_harvesting': analyzer.tax_loss_harvesting_analysis(transactions),
                'tax_analysis': analyzer.tax_analysis(transactions),
                'cash_flow_analysis': analyzer.cash_flow_analysis(transactions),
                'trade_timing': analyzer.trade_timing_analysis(transactions),
                'drawdown_analysis': analyzer.drawdown_analysis(transactions),
                'cost_analysis': analyzer.cost_analysis(transactions),
                'xirr_analysis': {
                    'xirr': xirr_metrics.xirr,
                    'twr': xirr_metrics.twr,
                    'mwr': xirr_metrics.mwr,
                    'total_return_pct': xirr_metrics.total_return_pct,
                    'annualized_return': xirr_metrics.annualized_return,
                    'sharpe_ratio': xirr_metrics.sharpe_ratio,
                    'sortino_ratio': xirr_metrics.sortino_ratio,
                    'max_drawdown': xirr_metrics.max_drawdown,
                    'volatility': xirr_metrics.volatility,
                    'win_rate': xirr_metrics.win_rate,
                    'profit_factor': xirr_metrics.profit_factor,
                    'holding_period_days': xirr_metrics.holding_period_days
                }
            }
            
            # Calculate current positions with market data
            current_positions = []
            unrealized_pnl = 0
            symbols_with_positions = [s for s, p in positions.items() if p['quantity'] > 0]
            
            if symbols_with_positions:
                try:
                    current_prices = data_client.get_current_prices(symbols_with_positions)
                    for symbol, position in positions.items():
                        if position['quantity'] > 0:
                            current_price = current_prices.get(symbol, position['avg_cost'])
                            if current_price and not pd.isna(current_price):
                                position_unrealized = (current_price - position['avg_cost']) * position['quantity']
                                unrealized_pnl += position_unrealized
                                
                                current_positions.append({
                                    'symbol': symbol,
                                    'quantity': position['quantity'],
                                    'avg_cost': position['avg_cost'],
                                    'current_price': float(current_price),
                                    'market_value': float(current_price * position['quantity']),
                                    'cost_basis': position['avg_cost'] * position['quantity'],
                                    'unrealized_pnl': position_unrealized,
                                    'unrealized_pnl_pct': (position_unrealized / (position['avg_cost'] * position['quantity'])) * 100,
                                    'lots_count': len(position.get('lots', []))
                                })
                except Exception:
                    pass
            
            # Enterprise summary with advanced metrics
            total_pnl = realized_pnl + unrealized_pnl
            total_cost_basis = sum(pos['cost_basis'] for pos in current_positions)
            portfolio_return = (total_pnl / total_cost_basis * 100) if total_cost_basis > 0 else 0
            
            print(f"Enterprise transaction analysis completed for {len(transactions)} transactions")
            
            result_data = {
                'success': True,
                'transactions': [{
                    'symbol': t.symbol,
                    'date': t.date.strftime('%Y-%m-%d'),
                    'type': t.transaction_type,
                    'quantity': t.quantity,
                    'price': t.price,
                    'value': abs(t.quantity) * t.price,
                    'fees': t.fees
                } for t in transactions],
                'current_positions': current_positions,
                'enterprise_analytics': enterprise_analytics,
                'summary': {
                    'total_transactions': len(transactions),
                    'total_fees': float(total_fees),
                    'total_volume': float(total_volume),
                    'total_realized_pnl': float(realized_pnl),
                    'total_unrealized_pnl': float(unrealized_pnl),
                    'total_pnl': float(total_pnl),
                    'portfolio_return_pct': float(portfolio_return),
                    'buy_count': buy_count,
                    'sell_count': sell_count,
                    'avg_fee_per_trade': float(total_fees / len(transactions) if transactions else 0),
                    'positions_count': len(current_positions),
                    'total_cost_basis': float(total_cost_basis),
                    'total_market_value': float(sum(pos['market_value'] for pos in current_positions)),
                    'win_rate': float(enterprise_analytics['trade_performance'].get('win_rate', 0) * 100),
                    'profit_factor': float(enterprise_analytics['trade_performance'].get('profit_factor', 0)),
                    'max_drawdown_pct': float(enterprise_analytics['drawdown_analysis'].get('max_drawdown_pct', 0)),
                    'annualized_turnover': float(enterprise_analytics['turnover_analysis'].get('annualized_turnover_rate', 0)),
                    'xirr': float(enterprise_analytics['xirr_analysis'].get('xirr', 0) * 100),
                    'time_weighted_return': float(enterprise_analytics['xirr_analysis'].get('twr', 0) * 100),
                    'money_weighted_return': float(enterprise_analytics['xirr_analysis'].get('mwr', 0) * 100),
                    'annualized_return': float(enterprise_analytics['xirr_analysis'].get('annualized_return', 0) * 100),
                    'sharpe_ratio': float(enterprise_analytics['xirr_analysis'].get('sharpe_ratio', 0)),
                    'sortino_ratio': float(enterprise_analytics['xirr_analysis'].get('sortino_ratio', 0)),
                    'volatility': float(enterprise_analytics['xirr_analysis'].get('volatility', 0) * 100),
                    'holding_period_days': int(enterprise_analytics['xirr_analysis'].get('holding_period_days', 0)),
                    # Tax analysis data
                    'short_term_gains': float(enterprise_analytics['tax_loss_harvesting'].get('short_term_gains', 0)),
                    'long_term_gains': float(enterprise_analytics['tax_loss_harvesting'].get('long_term_gains', 0)),
                    'estimated_tax_liability': float(enterprise_analytics['tax_loss_harvesting'].get('estimated_tax_liability', 0)),
                    'harvestable_losses': float(enterprise_analytics['tax_loss_harvesting'].get('harvestable_losses', 0)),
                    # Comprehensive tax analysis data
                    'short_term_gain_loss': float(enterprise_analytics['tax_analysis'].get('short_term_gain_loss', 0)),
                    'long_term_gain_loss': float(enterprise_analytics['tax_analysis'].get('long_term_gain_loss', 0)),
                    'total_tax_liability': float(enterprise_analytics['tax_analysis'].get('total_tax_liability', 0)),
                    'wash_sale_adjustments': float(enterprise_analytics['tax_analysis'].get('wash_sale_adjustments', 0)),
                    'effective_tax_rate': float(enterprise_analytics['tax_analysis'].get('effective_tax_rate', 0)),
                    'tax_year': int(enterprise_analytics['tax_analysis'].get('tax_year', datetime.now().year)),
                    # Cost analysis data
                    'total_commissions': float(enterprise_analytics['cost_analysis'].get('total_commissions', 0)),
                    'total_spreads': float(enterprise_analytics['cost_analysis'].get('total_spreads', 0)),
                    'total_slippage': float(enterprise_analytics['cost_analysis'].get('total_slippage', 0)),
                    'total_costs': float(enterprise_analytics['cost_analysis'].get('total_costs', 0)),
                    'cost_as_pct_volume': float(enterprise_analytics['cost_analysis'].get('cost_as_pct_volume', 0)),
                    'avg_cost_per_trade': float(enterprise_analytics['cost_analysis'].get('avg_cost_per_trade', 0)),
                    # Cost analysis data
                    'total_commissions': float(enterprise_analytics['cost_analysis'].get('total_commissions', 0)),
                    'total_spreads': float(enterprise_analytics['cost_analysis'].get('total_spreads', 0)),
                    'total_slippage': float(enterprise_analytics['cost_analysis'].get('total_slippage', 0)),
                    'total_costs': float(enterprise_analytics['cost_analysis'].get('total_costs', 0)),
                    'cost_as_pct_volume': float(enterprise_analytics['cost_analysis'].get('cost_as_pct_volume', 0)),
                    'avg_cost_per_trade': float(enterprise_analytics['cost_analysis'].get('avg_cost_per_trade', 0))
                }
            }
            
            return jsonify(clean_for_json(result_data))
        except Exception as e:
            print(f"Enterprise transaction analysis failed: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/save-transactions', methods=['POST'])
    def save_transactions():
        try:
            data = request.get_json()
            user_id = data.get('user_id')
            transaction_set_name = data.get('transaction_set_name')
            transactions_data = data.get('transactions_data')
            
            if not supabase_client or not supabase_client.client:
                return jsonify({'success': False, 'error': 'Database not available'}), 500
            
            if not user_id or not transaction_set_name or not transactions_data:
                return jsonify({'success': False, 'error': 'Missing required fields'}), 400
            
            result = supabase_client.client.table('transactions').insert({
                'user_id': user_id,
                'transaction_set_name': transaction_set_name,
                'transactions_data': transactions_data,
                'created_at': datetime.now().isoformat()
            }).execute()
            
            if result.data:
                return jsonify({'success': True, 'transaction_id': result.data[0]['id']})
            else:
                return jsonify({'success': False, 'error': 'Failed to save transactions'}), 500
                
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/load-transactions', methods=['GET'])
    def load_transactions():
        print("[DEBUG] load_transactions route called")
        try:
            user_id = request.args.get('user_id')
            print(f"[DEBUG] load_transactions user_id: {user_id}")
            
            if not supabase_client or not supabase_client.client:
                print("[DEBUG] Supabase client not available")
                return jsonify({'success': True, 'transactions': []})
            
            if not user_id:
                print("[DEBUG] No user_id provided")
                return jsonify({'success': True, 'transactions': []})
            
            try:
                print(f"[DEBUG] Querying transactions table for user_id: {user_id}")
                
                # Retry logic for intermittent HTTP/2 KeyError
                max_retries = 3
                result = None
                for attempt in range(max_retries):
                    try:
                        result = supabase_client.client.table('transactions').select('*').eq('user_id', user_id).execute()
                        break  # Success
                    except KeyError as ke:
                        print(f"[RETRY] HTTP/2 KeyError on attempt {attempt + 1}/{max_retries}: {ke}")
                        if attempt == max_retries - 1:
                            raise  # Last attempt, re-raise
                        import time
                        time.sleep(0.1 * (attempt + 1))  # Exponential backoff
                
                transactions = result.data or []
                print(f"[DEBUG] Found {len(transactions)} transactions")
                return jsonify({'success': True, 'transactions': transactions})
            except Exception as e:
                print(f"Transaction load error: {e}")
                import traceback
                traceback.print_exc()
                return jsonify({'success': True, 'transactions': []})
            
        except Exception as e:
            print(f"Transaction load outer error: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': True, 'transactions': []})

    @app.route('/api/get-transactions', methods=['GET'])
    def get_transactions():
        try:
            transaction_id = request.args.get('transaction_id')
            user_id = request.args.get('user_id')
            
            if not supabase_client or not supabase_client.client:
                return jsonify({'success': False, 'error': 'Database not available'}), 500
            
            result = supabase_client.client.table('transactions').select('*').eq('id', transaction_id).eq('user_id', user_id).execute()
            
            if result.data:
                transaction_set = result.data[0]
                transactions_data = transaction_set['transactions_data']
                
                if isinstance(transactions_data, str):
                    transactions_data = json.loads(transactions_data)
                
                return jsonify({
                    'success': True,
                    'transaction_set_name': transaction_set['transaction_set_name'],
                    'transactions_data': transactions_data
                })
            else:
                return jsonify({'success': False, 'error': 'Transaction set not found'}), 404
                
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @app.route('/api/delete-transactions', methods=['DELETE'])
    def delete_transactions():
        try:
            data = request.get_json()
            transaction_id = data.get('transaction_id')
            user_id = request.headers.get('X-User-ID')
            
            if not supabase_client or not supabase_client.client:
                return jsonify({'success': False, 'error': 'Database not available'}), 500
            
            if not transaction_id or not user_id:
                return jsonify({'success': False, 'error': 'Missing transaction ID or user ID'}), 400
            
            result = supabase_client.client.table('transactions').delete().eq('id', transaction_id).eq('user_id', user_id).execute()
            
            if result.data:
                return jsonify({'success': True, 'message': 'Transactions deleted successfully'})
            else:
                return jsonify({'success': False, 'error': 'Transaction not found or access denied'}), 404
                
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    # /api/advanced-transaction-analysis removed - duplicate of /api/analyze-transactions

