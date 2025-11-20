from flask import request, jsonify
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from .route_utils import sanitize_for_json

def register_transaction_analysis_routes(app, data_client, smart_cache=None):
    """Register transaction analysis routes"""
    
    # /api/return-attribution removed - superseded by /api/pnl-attribution in pnl_attribution_routes.py
    @app.route('/api/trade-performance', methods=['POST'])
    def trade_performance():
        try:
            data = request.get_json()
            transactions_data = data.get('transactions', [])
            options = data.get('options', {})
            
            print(f"[TRADE-PERFORMANCE] Received {len(transactions_data)} transactions")
            if transactions_data:
                print(f"[TRADE-PERFORMANCE] Sample transaction: {transactions_data[0]}")
                print(f"[TRADE-PERFORMANCE] Transaction keys: {list(transactions_data[0].keys())}")
                print(f"[TRADE-PERFORMANCE] All symbols: {list(set([t.get('symbol', 'N/A') for t in transactions_data]))}")
                print(f"[TRADE-PERFORMANCE] Transaction types: {list(set([t.get('transaction_type', 'N/A') for t in transactions_data]))}")
                print(f"[TRADE-PERFORMANCE] Total unique symbols: {len(set([t.get('symbol', 'N/A') for t in transactions_data]))}")
            
            if not transactions_data:
                return jsonify({'success': False, 'error': 'No transaction data provided'}), 400
            
            period = options.get('period', '1Y')
            trade_size_filter = options.get('tradeSize', 'All')
            ranking_filter = options.get('ranking', 'Best 5')
            type_filter = options.get('type', 'All')
            performance_metric = options.get('metric', 'P&L')
            filter_type = options.get('type', 'All')
            
            df = pd.DataFrame(transactions_data)
            if 'date' in df.columns:
                df['date'] = pd.to_datetime(df['date'], errors='coerce')
                if df['date'].dt.tz is not None:
                    df['date'] = df['date'].dt.tz_convert(None)
            
            # Remove aggressive filtering to support options and all tickers
            # df = df[~df['symbol'].str.contains(r'\d{6}[CP]\d{8}', regex=True, na=False)]
            # df = df[df['symbol'].str.len() <= 5]
            
            print(f"[TRADE-PERFORMANCE] Processing {len(df)} transactions")
            
            df = df.sort_values('date')
            
            trades = []
            # open_positions: {symbol: [{'date': ..., 'quantity': ..., 'price': ..., 'fees': ..., 'type': 'BUY'/'SELL'}]}
            open_positions = {}
            
            for _, row in df.iterrows():
                symbol = row['symbol']
                raw_quantity = float(row.get('quantity', 0))
                quantity = abs(raw_quantity)
                price = float(row.get('price', 0))
                date = row['date']
                fees = float(row.get('fees', 0))
                # Normalize transaction type
                raw_type = row.get('transaction_type', 'BUY').upper()
                if raw_type in ['BUY', 'BTC', 'BUY_TO_CLOSE', 'LONG', 'PURCHASE', 'OPEN_LONG']:
                    side = 'BUY'
                elif raw_type in ['SELL', 'STO', 'SELL_TO_OPEN', 'SHORT', 'SALE', 'OPEN_SHORT']:
                    side = 'SELL'
                elif raw_type == 'DIVIDEND':
                    print(f"[TRADE-PERFORMANCE] Processing dividend: {symbol} ${price}")
                    continue # Dividends don't create trades but could be tracked
                elif raw_type == 'TRANSFER':
                    # Handle as position transfer (quantity change without price impact)
                    if quantity > 0:
                        side = 'BUY'  # Transfer in
                        print(f"[TRADE-PERFORMANCE] Processing transfer in: {symbol} {quantity} shares")
                    else:
                        side = 'SELL'  # Transfer out
                        quantity = abs(quantity)
                        print(f"[TRADE-PERFORMANCE] Processing transfer out: {symbol} {quantity} shares")
                elif raw_type in ['CASH', 'INTEREST', 'FEE', 'DEPOSIT', 'WITHDRAWAL', 'SPLIT', 'MERGER', 'SPINOFF']:
                    print(f"[TRADE-PERFORMANCE] Skipping non-trading transaction: {raw_type} for {symbol}")
                    continue # Skip non-trading transactions
                else:
                    print(f"[TRADE-PERFORMANCE] Skipping unknown transaction type: {raw_type} for {symbol}")
                    continue # Skip unknown types
                
                if symbol not in open_positions:
                    open_positions[symbol] = []
                
                # Check if we can close existing positions
                # Closing happens if we have open positions of the OPPOSITE side
                if open_positions[symbol] and open_positions[symbol][0]['type'] != side:
                    remaining_qty = quantity
                    
                    while remaining_qty > 0 and open_positions[symbol]:
                        open_leg = open_positions[symbol][0]
                        matched_qty = min(remaining_qty, open_leg['quantity'])
                        
                        # Calculate P&L based on direction
                        if open_leg['type'] == 'BUY': # Long trade (Buy -> Sell)
                            entry_price = open_leg['price']
                            exit_price = price
                            cost_basis = matched_qty * entry_price
                            proceeds = matched_qty * exit_price
                            pnl = proceeds - cost_basis
                        else: # Short trade (Sell -> Buy)
                            entry_price = open_leg['price']
                            exit_price = price
                            cost_basis = matched_qty * entry_price # Actually proceeds from short sale
                            proceeds = matched_qty * exit_price # Cost to buy back
                            pnl = cost_basis - proceeds # Profit is (Sell Price - Buy Price)
                        
                        # Pro-rate fees
                        open_fees = open_leg['fees'] * (matched_qty / open_leg['initial_quantity']) if open_leg['initial_quantity'] > 0 else 0
                        close_fees = fees * (matched_qty / quantity) if quantity > 0 else 0
                        
                        net_pnl = pnl - open_fees - close_fees
                        return_pct = (net_pnl / cost_basis) if cost_basis > 0 else 0
                        
                        trades.append({
                            'symbol': symbol,
                            'open_date': open_leg['date'],
                            'close_date': date,
                            'quantity': matched_qty,
                            'entry_price': entry_price,
                            'exit_price': exit_price,
                            'side': 'LONG' if open_leg['type'] == 'BUY' else 'SHORT',
                            'pnl': net_pnl,
                            'return_pct': return_pct,
                            'volume': cost_basis,
                            'duration_days': (date - open_leg['date']).days
                        })
                        
                        remaining_qty -= matched_qty
                        open_leg['quantity'] -= matched_qty
                        
                        if open_leg['quantity'] <= 0.000001:
                            open_positions[symbol].pop(0)
                            
                    # If there is still quantity left, it opens a new position in the current direction
                    if remaining_qty > 0.000001:
                        open_positions[symbol].append({
                            'date': date,
                            'quantity': remaining_qty,
                            'initial_quantity': remaining_qty,
                            'price': price,
                            'fees': fees * (remaining_qty / quantity) if quantity > 0 else 0,
                            'type': side
                        })
                        
                else:
                    # No matching open positions, so we open a new position
                    open_positions[symbol].append({
                        'date': date,
                        'quantity': quantity,
                        'initial_quantity': quantity,
                        'price': price,
                        'fees': fees,
                        'type': side
                    })
            
            print(f"[TRADE-PERFORMANCE] Found {len(trades)} closed trades")
            print(f"[TRADE-PERFORMANCE] Open positions remaining: {sum(len(positions) for positions in open_positions.values())}")
            print(f"[TRADE-PERFORMANCE] Symbols with open positions: {[symbol for symbol, positions in open_positions.items() if positions]}")
            if trades:
                sample_trade = trades[0].copy()
                sample_trade['open_date'] = sample_trade['open_date'].strftime('%Y-%m-%d')
                sample_trade['close_date'] = sample_trade['close_date'].strftime('%Y-%m-%d')
                print(f"[TRADE-PERFORMANCE] Sample trade: {sample_trade}")
            
            if not trades:
                return jsonify({
                    'success': True, 
                    'trade_performance': {
                        'total_trades': 0,
                        'win_rate': 0.0,
                        'profit_factor': 0.0,
                        'sharpe_ratio': 0.0,
                        'total_pnl': 0.0,
                        'avg_pnl': 0.0,
                        'avg_trade_size': 0.0,
                        'best_trade': 0.0,
                        'worst_trade': 0.0,
                        'ranked_trades': [],
                        'message': 'No closed trades found'
                    }
                })
            
            trades_df = pd.DataFrame(trades)
            
            end_date = datetime.now()
            if period == '1M':
                start_date = end_date - timedelta(days=30)
            elif period == '3M':
                start_date = end_date - timedelta(days=90)
            elif period == '6M':
                start_date = end_date - timedelta(days=180)
            elif period == '1Y':
                start_date = end_date - timedelta(days=365)
            elif period == 'All Time':
                start_date = pd.Timestamp.min
            else:
                start_date = end_date - timedelta(days=365)
            
            # Apply period filter
            if period != 'All Time':
                trades_df = trades_df[trades_df['close_date'] >= start_date]
            
            # Apply trade size filter
            if trade_size_filter != 'All':
                if trade_size_filter == '<$1K':
                    trades_df = trades_df[trades_df['volume'] < 1000]
                elif trade_size_filter == '$1K-$10K':
                    trades_df = trades_df[(trades_df['volume'] >= 1000) & (trades_df['volume'] < 10000)]
                elif trade_size_filter == '$10K-$100K':
                    trades_df = trades_df[(trades_df['volume'] >= 10000) & (trades_df['volume'] < 100000)]
                elif trade_size_filter == '>$100K':
                    trades_df = trades_df[trades_df['volume'] >= 100000]
            
            # Apply profit/loss filter
            if type_filter == 'Profitable':
                trades_df = trades_df[trades_df['pnl'] > 0]
            elif type_filter == 'Loss-making':
                trades_df = trades_df[trades_df['pnl'] <= 0]
            
            if trades_df.empty:
                return jsonify({
                    'success': True, 
                    'trade_performance': {
                        'total_trades': 0,
                        'win_rate': 0.0,
                        'profit_factor': 0.0,
                        'sharpe_ratio': 0.0,
                        'total_pnl': 0.0,
                        'avg_pnl': 0.0,
                        'avg_trade_size': 0.0,
                        'best_trade': 0.0,
                        'worst_trade': 0.0,
                        'ranked_trades': [],
                        'message': 'No trades match filters'
                    }
                })
            
            total_trades = len(trades_df)
            winning_trades = trades_df[trades_df['pnl'] > 0]
            losing_trades = trades_df[trades_df['pnl'] <= 0]
            
            win_rate = len(winning_trades) / total_trades if total_trades > 0 else 0
            gross_profit = winning_trades['pnl'].sum()
            gross_loss = abs(losing_trades['pnl'].sum())
            profit_factor = gross_profit / gross_loss if gross_loss > 0 else (999.99 if gross_profit > 0 else 0)
            
            total_pnl = trades_df['pnl'].sum()
            avg_pnl = trades_df['pnl'].mean()
            avg_trade_size = trades_df['volume'].mean()
            
            returns = trades_df['return_pct']
            sharpe_ratio = (returns.mean() / returns.std()) * np.sqrt(252) if returns.std() > 0 else 0
            
            best_trade = trades_df['pnl'].max()
            worst_trade = trades_df['pnl'].min()
            
            ranked_trades = []
            ranking_count = int(ranking_filter.split(' ')[1]) if ' ' in ranking_filter else 5
            
            # Ensure we don't request more trades than available
            actual_count = min(ranking_count, len(trades_df))
            ranking_count = actual_count
            
            # Sort by selected performance metric
            sort_column = 'pnl'
            if performance_metric == '%':
                sort_column = 'return_pct'
            elif performance_metric == 'Sharpe':
                sort_column = 'return_pct'  # Use return_pct as proxy for Sharpe per trade
            elif performance_metric == 'Win Rate':
                sort_column = 'pnl'  # Keep P&L for win rate context
            
            if 'Best' in ranking_filter:
                # Show top trades by performance metric (can include losses if they're the "best" available)
                ranked_trades = trades_df.nlargest(ranking_count, sort_column).to_dict('records')
            elif 'Worst' in ranking_filter:
                # Show bottom trades by performance metric (can include gains if they're the "worst" available)
                ranked_trades = trades_df.nsmallest(ranking_count, sort_column).to_dict('records')
            
            for trade in ranked_trades:
                trade['open_date'] = trade['open_date'].strftime('%Y-%m-%d')
                trade['close_date'] = trade['close_date'].strftime('%Y-%m-%d')
            
            stats = {
                'total_trades': total_trades, 'win_rate': win_rate, 'profit_factor': profit_factor,
                'sharpe_ratio': sharpe_ratio, 'total_pnl': total_pnl, 'avg_pnl': avg_pnl,
                'avg_trade_size': avg_trade_size, 'best_trade': best_trade, 'worst_trade': worst_trade,
                'ranked_trades': ranked_trades, 'period': period,
                'trade_size_filter': trade_size_filter, 'type_filter': type_filter,
                'performance_metric': performance_metric, 'filter_type': type_filter
            }
            
            return jsonify({'success': True, 'trade_performance': stats})
            
        except Exception as e:
            print(f'Trade Performance error: {e}')
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500
