from flask import request, jsonify
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict
from .route_utils import sanitize_for_json
from utils.cache_manager import cache_manager

def register_pnl_attribution_routes(app, data_client, smart_cache=None):
    """Register P&L Attribution routes with interactive features"""
    
    @app.route('/api/pnl-attribution', methods=['POST'])
    def pnl_attribution():
        try:
            from analytics.advanced_transaction_analysis import AdvancedTransactionAnalyzer
            from core.transactions import Transaction
            
            data = request.get_json()
            print(f"[DEBUG] Raw request data keys: {list(data.keys()) if data else 'None'}")
            
            if not data:
                return jsonify({'success': False, 'error': 'No data provided'}), 400

            # Check cache
            cache_key = cache_manager.generate_key('pnl-attribution', data)
            cached_result = cache_manager.get(cache_key)
            if cached_result:
                return jsonify(cached_result)
            
            # Handle analytics-core structure: { transactions: [...], options: {...} }
            transactions_data = data.get('transactions', [])
            options = data.get('options', {})
            
            print(f"[DEBUG] P&L Attribution Endpoint: Received {len(transactions_data)} transactions in payload")
            if len(transactions_data) > 0:
                 print(f"[DEBUG] First transaction sample: {transactions_data[0]}")
                 print(f"[DEBUG] Last transaction sample: {transactions_data[-1]}")
            
            print(f"[DEBUG] Extracted {len(transactions_data)} transactions, options: {options}")
            
            if not transactions_data:
                return jsonify({'success': False, 'error': 'No transaction data provided'}), 400
            
            # Parse options - map frontend keys to backend keys
            period = options.get('pnlPeriod', options.get('period', '1Y'))
            view = options.get('pnlView', options.get('view', 'Total'))
            grouping = options.get('pnlGrouping', options.get('grouping', 'By Symbol'))
            currency = options.get('pnlCurrency', options.get('currency', 'USD'))
            tax_impact = options.get('pnlTaxImpact', options.get('tax_impact', 'Pre-tax'))
            
            print(f"[DEBUG] Mapped options - period: {period}, view: {view}, grouping: {grouping}, currency: {currency}, tax: {tax_impact}")
            
            # Convert to Transaction objects
            transactions = []
            print(f"[DEBUG] Processing {len(transactions_data)} transactions")
            
            for i, tx_data in enumerate(transactions_data):
                try:
                    date_str = tx_data.get('date', '')
                    if isinstance(date_str, str) and date_str.strip():
                        if 'GMT' in date_str:
                            # Handle GMT format: 'Sat, 08 Nov 2025 00:00:00 GMT'
                            date_obj = datetime.strptime(date_str, '%a, %d %b %Y %H:%M:%S GMT')
                        elif 'T' in date_str:
                            date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                        else:
                            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                    else:
                        date_obj = datetime.now()
                    
                    transaction = Transaction(
                        symbol=tx_data.get('symbol', ''),
                        quantity=float(tx_data.get('quantity', 0)),
                        price=float(tx_data.get('price', 0)),
                        date=date_obj,
                        transaction_type=tx_data.get('transaction_type', 'BUY'),
                        fees=float(tx_data.get('fees', 0))
                    )
                    transactions.append(transaction)
                except Exception as e:
                    print(f"[DEBUG] Failed to process transaction {i}: {e}")
                    continue
            
            print(f"[DEBUG] Successfully created {len(transactions)} Transaction objects")
            
            if not transactions:
                print(f"[ERROR] No valid transactions created")
                return jsonify({'success': False, 'error': 'No valid transactions found'}), 400
            
            # Filter transactions by period
            end_date = datetime.now()
            if period == '1W':
                start_date = end_date - timedelta(days=7)
            elif period == '1M':
                start_date = end_date - timedelta(days=30)
            elif period == '3M':
                start_date = end_date - timedelta(days=90)
            elif period == '6M':
                start_date = end_date - timedelta(days=180)
            elif period == '1Y':
                start_date = end_date - timedelta(days=365)
            elif period == 'YTD':
                start_date = datetime(end_date.year, 1, 1)
            elif period == 'ITD':
                start_date = min(t.date for t in transactions) if transactions else end_date - timedelta(days=365)
            else:
                start_date = end_date - timedelta(days=365)
            
            # Filter transactions by date range
            print(f"[DEBUG] Filtering transactions from {start_date} to {end_date}")
            filtered_transactions = [t for t in transactions if start_date <= t.date <= end_date]
            print(f"[DEBUG] Filtered to {len(filtered_transactions)} transactions")
            
            if not filtered_transactions:
                print(f"[WARN] No transactions in date range {start_date} to {end_date}")
                # Return empty result instead of error
                empty_pnl = {
                    'total_pnl': 0,
                    'realized_pnl': 0,
                    'unrealized_pnl': 0,
                    'by_symbol': {},
                    'metadata': {
                        'period': period,
                        'view': view,
                        'grouping': grouping,
                        'currency': currency,
                        'tax_impact': tax_impact,
                        'start_date': start_date.strftime('%Y-%m-%d'),
                        'end_date': end_date.strftime('%Y-%m-%d'),
                        'transaction_count': 0
                    }
                }
                return jsonify({'success': True, 'pnl_attribution': empty_pnl})
            
            # Basic P&L calculation
            pnl_data = {
                'total_pnl': 0,
                'realized_pnl': 0,
                'unrealized_pnl': 0,
                'by_symbol': {}
            }
            
            positions = {}
            realized_pnl_by_symbol = {}
            
            print(f"[DEBUG] Processing {len(filtered_transactions)} transactions for P&L calculation")
            
            pnl_events = [] # Track P&L events for accurate grouping
            
            for tx in filtered_transactions:
                symbol = tx.symbol
                if symbol not in positions:
                    positions[symbol] = {'quantity': 0, 'cost_basis': 0}
                if symbol not in realized_pnl_by_symbol:
                    realized_pnl_by_symbol[symbol] = 0
                
                qty = abs(tx.quantity)
                price = tx.price
                
                if tx.transaction_type.upper() == 'BUY':
                    # Check if covering a short position
                    if positions[symbol]['quantity'] < 0:
                        # Covering short
                        cover_qty = min(abs(positions[symbol]['quantity']), qty)
                        # P&L = (Entry Price - Exit Price) * Qty
                        realized = (positions[symbol]['cost_basis'] - price) * cover_qty
                        
                        pnl_data['realized_pnl'] += realized
                        realized_pnl_by_symbol[symbol] += realized
                        positions[symbol]['quantity'] += cover_qty
                        
                        pnl_events.append({
                            'date': tx.date,
                            'symbol': symbol,
                            'amount': realized,
                            'type': 'REALIZED'
                        })
                        
                        print(f"[DEBUG] COVER SHORT {symbol}: {cover_qty} @ ${price}, realized P&L: ${realized:.2f}")
                        
                        # If we bought more than needed to cover, open long
                        remaining_qty = qty - cover_qty
                        if remaining_qty > 0:
                            positions[symbol]['quantity'] += remaining_qty
                            positions[symbol]['cost_basis'] = price # New long basis
                    else:
                        # Adding to long position
                        old_value = positions[symbol]['quantity'] * positions[symbol]['cost_basis']
                        new_quantity = positions[symbol]['quantity'] + qty
                        if new_quantity > 0:
                            positions[symbol]['cost_basis'] = (old_value + qty * price) / new_quantity
                        positions[symbol]['quantity'] = new_quantity
                        print(f"[DEBUG] BUY {symbol}: {qty} @ ${price}, new position: {new_quantity} @ ${positions[symbol]['cost_basis']:.2f}")
                        
                elif tx.transaction_type.upper() == 'SELL':
                    # Check if closing a long position
                    if positions[symbol]['quantity'] > 0:
                        # Closing long
                        close_qty = min(positions[symbol]['quantity'], qty)
                        # P&L = (Exit Price - Entry Price) * Qty
                        realized = (price - positions[symbol]['cost_basis']) * close_qty
                        
                        pnl_data['realized_pnl'] += realized
                        realized_pnl_by_symbol[symbol] += realized
                        positions[symbol]['quantity'] -= close_qty
                        
                        pnl_events.append({
                            'date': tx.date,
                            'symbol': symbol,
                            'amount': realized,
                            'type': 'REALIZED'
                        })
                        
                        print(f"[DEBUG] SELL {symbol}: {close_qty} @ ${price}, realized P&L: ${realized:.2f}")
                        
                        # If we sold more than we had, open short
                        remaining_qty = qty - close_qty
                        if remaining_qty > 0:
                            positions[symbol]['quantity'] -= remaining_qty
                            positions[symbol]['cost_basis'] = price # New short basis
                    else:
                        # Opening/Adding to short position
                        # For short, cost basis is the weighted average entry price
                        current_abs_qty = abs(positions[symbol]['quantity'])
                        old_value = current_abs_qty * positions[symbol]['cost_basis']
                        new_abs_qty = current_abs_qty + qty
                        
                        if new_abs_qty > 0:
                            positions[symbol]['cost_basis'] = (old_value + qty * price) / new_abs_qty
                        
                        positions[symbol]['quantity'] -= qty
                        print(f"[DEBUG] SHORT {symbol}: {qty} @ ${price}, new position: {positions[symbol]['quantity']} @ ${positions[symbol]['cost_basis']:.2f}")
            
            print(f"[DEBUG] ========== P&L CALCULATION SUMMARY ==========")
            print(f"[DEBUG] Total transactions processed: {len(filtered_transactions)}")
            print(f"[DEBUG] Unique symbols traded: {len(positions)}")
            print(f"[DEBUG] Total realized P&L: ${pnl_data['realized_pnl']:.2f}")
            
            # Show all positions (open, closed, long, short)
            open_long = [(s, p['quantity'], p['cost_basis']) for s, p in positions.items() if p['quantity'] > 0]
            open_short = [(s, p['quantity'], p['cost_basis']) for s, p in positions.items() if p['quantity'] < 0]
            closed = [s for s, p in positions.items() if p['quantity'] == 0]
            
            print(f"[DEBUG] Open long positions: {len(open_long)} - {open_long}")
            print(f"[DEBUG] Open short positions: {len(open_short)} - {open_short}")
            print(f"[DEBUG] Closed positions: {len(closed)} - {closed}")
            print(f"[DEBUG] ===============================================")
            
            # Get current prices for unrealized P&L (only for open positions)
            symbols_with_positions = [s for s, p in positions.items() if p['quantity'] != 0]
            if symbols_with_positions:
                try:
                    print(f"[DEBUG] Getting current prices for {len(symbols_with_positions)} symbols: {symbols_with_positions}")
                    current_prices = {}
                    
                    # OPTIMIZATION: Use batch fetching instead of sequential calls
                    try:
                        # Fetch data for last 5 days to ensure we get a recent close
                        batch_data = data_client.get_price_data(symbols_with_positions, period='5d')
                        
                        if batch_data is not None and not batch_data.empty:
                            # Extract latest price for each symbol
                            for symbol in symbols_with_positions:
                                try:
                                    if symbol in batch_data.columns:
                                        # Get last valid price
                                        price_series = batch_data[symbol].dropna()
                                        if not price_series.empty:
                                            price = float(price_series.iloc[-1])
                                            if price > 0:
                                                current_prices[symbol] = price
                                                print(f"[DEBUG] Got batch price for {symbol}: ${price}")
                                    elif hasattr(batch_data, 'columns') and isinstance(batch_data.columns, pd.MultiIndex):
                                        # Handle MultiIndex case if get_price_data returns it
                                        # (Though MarketDataClient usually returns simple columns for get_price_data)
                                        if symbol in batch_data.columns.get_level_values(0):
                                            price_series = batch_data.xs(symbol, axis=1, level=0).iloc[:, 0].dropna()
                                            if not price_series.empty:
                                                price = float(price_series.iloc[-1])
                                                current_prices[symbol] = price
                                except Exception as e:
                                    print(f"[DEBUG] Error extracting batch price for {symbol}: {e}")
                    except Exception as e:
                        print(f"[DEBUG] Batch fetch failed, falling back to sequential: {e}")
                    
                    # Fallback for missing symbols
                    missing_symbols = [s for s in symbols_with_positions if s not in current_prices]
                    if missing_symbols:
                        print(f"[DEBUG] Fetching {len(missing_symbols)} missing symbols sequentially")
                        for symbol in missing_symbols:
                            try:
                                # Try get_current_price first, fallback to get_current_prices
                                if hasattr(data_client, 'get_current_price'):
                                    price = data_client.get_current_price(symbol)
                                else:
                                    prices = data_client.get_current_prices([symbol])
                                    price = prices.get(symbol) if prices else None
                                    
                                if price and price > 0:
                                    current_prices[symbol] = price
                                    print(f"[DEBUG] Got sequential price for {symbol}: ${price}")
                                else:
                                    print(f"[DEBUG] No valid price for {symbol}, using cost basis")
                                    current_prices[symbol] = positions[symbol]['cost_basis']
                            except Exception as e:
                                print(f"[DEBUG] Failed to get price for {symbol}: {e}")
                                # Use cost basis as fallback
                                if symbol in positions and positions[symbol]['cost_basis'] > 0:
                                    current_prices[symbol] = positions[symbol]['cost_basis']
                                else:
                                    current_prices[symbol] = 100.0  # Default fallback price
                    
                    print(f"[DEBUG] Retrieved {len(current_prices)} prices: {current_prices}")
                    
                    for symbol, pos in positions.items():
                        # Include if position is open OR if there's realized P&L (even if closed)
                        has_open_position = abs(pos['quantity']) > 0  # Use abs() to handle short positions
                        has_realized_pnl = abs(realized_pnl_by_symbol.get(symbol, 0)) > 0
                        
                        if has_open_position or has_realized_pnl:
                            if symbol in current_prices:
                                # Unrealized P&L
                                # Long: (Current - Basis) * Qty
                                # Short: (Basis - Current) * Abs(Qty) -> which is (Basis - Current) * (-Qty) * -1 
                                # Short Qty is negative. 
                                # Value = Qty * Current. Cost = Qty * Basis.
                                # P&L = Value - Cost = Qty * (Current - Basis)
                                unrealized = (current_prices[symbol] - pos['cost_basis']) * pos['quantity']
                                pnl_data['unrealized_pnl'] += unrealized
                                pnl_data['by_symbol'][symbol] = {
                                    'realized_pnl': realized_pnl_by_symbol.get(symbol, 0),
                                    'unrealized_pnl': unrealized,
                                    'total_pnl': realized_pnl_by_symbol.get(symbol, 0) + unrealized,
                                    'current_price': current_prices[symbol],
                                    'cost_basis': pos['cost_basis'],
                                    'quantity': pos['quantity']
                                }
                            else:
                                # No current price available - show position at cost (unrealized = 0)
                                # But we still want to show realized P&L if it exists
                                pnl_data['by_symbol'][symbol] = {
                                    'realized_pnl': realized_pnl_by_symbol.get(symbol, 0),
                                    'unrealized_pnl': 0,
                                    'total_pnl': realized_pnl_by_symbol.get(symbol, 0),
                                    'current_price': pos['cost_basis'],
                                    'cost_basis': pos['cost_basis'],
                                    'quantity': pos['quantity']
                                }

                    
                    print(f"[DEBUG] Calculated unrealized P&L: ${pnl_data['unrealized_pnl']}")
                    
                except Exception as e:
                    print(f"[DEBUG] Error getting current prices: {e}")
                    # Fallback: show positions at cost basis (no unrealized P&L)
                    for symbol, pos in positions.items():
                        if pos['quantity'] > 0:
                            pnl_data['by_symbol'][symbol] = {
                                'realized_pnl': realized_pnl_by_symbol.get(symbol, 0),
                                'unrealized_pnl': 0,
                                'total_pnl': realized_pnl_by_symbol.get(symbol, 0),
                                'current_price': pos['cost_basis'],
                                'cost_basis': pos['cost_basis'],
                                'quantity': pos['quantity']
                            }
            
            pnl_data['total_pnl'] = pnl_data['realized_pnl'] + pnl_data['unrealized_pnl']
            
            # Apply currency conversion if needed
            if currency != 'USD':
                conversion_rate = _get_currency_rate(currency)
                pnl_data = _convert_currency(pnl_data, conversion_rate, currency)
            
            # Apply tax impact if needed
            if tax_impact == 'After-tax':
                pnl_data = _apply_tax_impact(pnl_data, {})
            
            # Apply grouping
            if grouping == 'By Sector':
                pnl_data = _group_by_sector(pnl_data, filtered_transactions)
            elif grouping == 'By Date':
                pnl_data = _group_by_date(pnl_data, pnl_events, period)
            elif grouping == 'By Size':
                pnl_data = _group_by_size(pnl_data)
            
            # Filter by view
            if view == 'Realized':
                pnl_data = _filter_realized_only(pnl_data)
            elif view == 'Unrealized':
                pnl_data = _filter_unrealized_only(pnl_data)
            
            # Add metadata
            pnl_data['metadata'] = {
                'period': period,
                'view': view,
                'grouping': grouping,
                'currency': currency,
                'tax_impact': tax_impact,
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
                'transaction_count': len(filtered_transactions)
            }
            
            response_data = {
                'success': True,
                'pnl_attribution': sanitize_for_json(pnl_data)
            }
            
            # Cache result
            cache_manager.set(cache_key, response_data)
            
            return jsonify(response_data)
            
        except Exception as e:
            print(f"P&L Attribution error: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500

def _get_currency_rate(currency):
    """Get currency conversion rate from environment or API"""
    import os
    
    # Try to get rate from environment variables first
    env_rate = os.getenv(f'{currency}_RATE')
    if env_rate:
        try:
            return float(env_rate)
        except ValueError:
            pass
    
    # Fallback to hardcoded rates (should be updated regularly)
    fallback_rates = {
        'EUR': float(os.getenv('DEFAULT_EUR_RATE', '0.85')),
        'GBP': float(os.getenv('DEFAULT_GBP_RATE', '0.75')),
        'JPY': float(os.getenv('DEFAULT_JPY_RATE', '110.0')),
        'CAD': float(os.getenv('DEFAULT_CAD_RATE', '1.25')),
        'AUD': float(os.getenv('DEFAULT_AUD_RATE', '1.35'))
    }
    
    return fallback_rates.get(currency, 1.0)

def _convert_currency(pnl_data, rate, currency):
    """Convert P&L values to target currency"""
    pnl_data['total_pnl'] *= rate
    pnl_data['realized_pnl'] *= rate
    pnl_data['unrealized_pnl'] *= rate
    
    for symbol, data in pnl_data.get('by_symbol', {}).items():
        data['realized_pnl'] *= rate
        data['unrealized_pnl'] *= rate
        data['total_pnl'] *= rate
    
    pnl_data['currency'] = currency
    return pnl_data

def _apply_tax_impact(pnl_data, tax_data):
    """Apply after-tax calculations"""
    import os
    
    # Get tax rate from environment or user settings
    default_tax_rate = float(os.getenv('DEFAULT_TAX_RATE', '0.25'))
    tax_rate = tax_data.get('tax_rate', default_tax_rate)
    
    # Apply tax to realized gains only
    if pnl_data['realized_pnl'] > 0:
        pnl_data['realized_pnl'] *= (1 - tax_rate)
        pnl_data['total_pnl'] = pnl_data['realized_pnl'] + pnl_data['unrealized_pnl']
    
    for symbol, data in pnl_data.get('by_symbol', {}).items():
        if data['realized_pnl'] > 0:
            data['realized_pnl'] *= (1 - tax_rate)
            data['total_pnl'] = data['realized_pnl'] + data['unrealized_pnl']
    
    pnl_data['tax_applied'] = True
    return pnl_data

def _group_by_sector(pnl_data, transactions):
    """Group P&L by sector using dynamic sector classification"""
    import os
    import json
    
    # Try to load sector mappings from file or environment
    sector_map = {}
    
    # Check for custom sector mapping file
    sector_file = os.getenv('SECTOR_MAPPING_FILE', 'sector_mappings.json')
    if os.path.exists(sector_file):
        try:
            with open(sector_file, 'r') as f:
                sector_map = json.load(f)
        except Exception:
            pass
    
    # Fallback to basic sector classification
    if not sector_map:
        sector_map = {
            'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Technology', 'NVDA': 'Technology',
            'JPM': 'Financial', 'BAC': 'Financial', 'WFC': 'Financial', 'GS': 'Financial',
            'JNJ': 'Healthcare', 'PFE': 'Healthcare', 'UNH': 'Healthcare', 'ABBV': 'Healthcare',
            'XOM': 'Energy', 'CVX': 'Energy', 'COP': 'Energy', 'SLB': 'Energy'
        }
    
    by_sector = defaultdict(lambda: {'realized_pnl': 0, 'unrealized_pnl': 0, 'total_pnl': 0, 'symbols': []})
    
    for symbol, data in pnl_data.get('by_symbol', {}).items():
        # Use dynamic sector classification with fallback
        sector = sector_map.get(symbol, _classify_symbol_sector(symbol))
        by_sector[sector]['realized_pnl'] += data['realized_pnl']
        by_sector[sector]['unrealized_pnl'] += data['unrealized_pnl']
        by_sector[sector]['total_pnl'] += data['total_pnl']
        by_sector[sector]['symbols'].append(symbol)
    
    pnl_data['by_sector'] = dict(by_sector)
    return pnl_data

def _group_by_date(pnl_data, pnl_events, period):
    """Group P&L by date periods using actual realized P&L events"""
    by_date = defaultdict(lambda: {'realized_pnl': 0, 'unrealized_pnl': 0, 'total_pnl': 0})
    
    # 1. Attribute Realized P&L to specific dates
    for event in pnl_events:
        if period in ['1W', '1M', '3M']:
            date_key = event['date'].strftime('%Y-%m-%d')  # Daily
        elif period in ['6M', '1Y']:
            date_key = event['date'].strftime('%Y-%m')     # Monthly
        else:
            date_key = event['date'].strftime('%Y-Q%q')    # Quarterly
            
        by_date[date_key]['realized_pnl'] += event['amount']
        by_date[date_key]['total_pnl'] += event['amount']
        
    # 2. Distribute Unrealized P&L (Snapshot)
    # Unrealized P&L is a "now" metric. For historical grouping, we usually just show it 
    # in the latest period or distribute it. 
    # For simplicity and "Total Return" view, we'll add it to the latest period bucket
    # or the current date bucket.
    
    current_date = datetime.now()
    if period in ['1W', '1M', '3M']:
        now_key = current_date.strftime('%Y-%m-%d')
    elif period in ['6M', '1Y']:
        now_key = current_date.strftime('%Y-%m')
    else:
        now_key = current_date.strftime('%Y-Q%q')
        
    by_date[now_key]['unrealized_pnl'] += pnl_data['unrealized_pnl']
    by_date[now_key]['total_pnl'] += pnl_data['unrealized_pnl']
    
    pnl_data['by_date'] = dict(by_date)
    return pnl_data

def _group_by_size(pnl_data):
    """Group P&L by position size"""
    import os
    
    # Get configurable size thresholds
    large_threshold = float(os.getenv('LARGE_POSITION_THRESHOLD', '10000'))
    medium_threshold = float(os.getenv('MEDIUM_POSITION_THRESHOLD', '1000'))
    
    by_size = {'Large': {'total_pnl': 0, 'count': 0}, 'Medium': {'total_pnl': 0, 'count': 0}, 'Small': {'total_pnl': 0, 'count': 0}}
    
    for symbol, data in pnl_data.get('by_symbol', {}).items():
        position_value = abs(data.get('quantity', 0) * data.get('avg_cost', 0))
        
        if position_value > large_threshold:
            size_category = 'Large'
        elif position_value > medium_threshold:
            size_category = 'Medium'
        else:
            size_category = 'Small'
        
        by_size[size_category]['total_pnl'] += data['total_pnl']
        by_size[size_category]['count'] += 1
    
    pnl_data['by_size'] = by_size
    return pnl_data

def _filter_realized_only(pnl_data):
    """Filter to show only realized P&L"""
    pnl_data['total_pnl'] = pnl_data['realized_pnl']
    pnl_data['unrealized_pnl'] = 0
    
    for symbol, data in pnl_data.get('by_symbol', {}).items():
        data['total_pnl'] = data['realized_pnl']
        data['unrealized_pnl'] = 0
    
    return pnl_data

def _filter_unrealized_only(pnl_data):
    """Filter to show only unrealized P&L"""
    pnl_data['total_pnl'] = pnl_data['unrealized_pnl']
    pnl_data['realized_pnl'] = 0
    
    for symbol, data in pnl_data.get('by_symbol', {}).items():
        data['total_pnl'] = data['unrealized_pnl']
        data['realized_pnl'] = 0
    
    return pnl_data

def _classify_symbol_sector(symbol):
    """Classify symbol into sector using basic heuristics"""
    # Basic sector classification based on symbol patterns
    tech_patterns = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA']
    financial_patterns = ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'C']
    healthcare_patterns = ['JNJ', 'PFE', 'UNH', 'ABBV', 'MRK', 'TMO']
    energy_patterns = ['XOM', 'CVX', 'COP', 'SLB', 'EOG']
    
    if symbol in tech_patterns or any(pattern in symbol for pattern in ['TECH', 'SOFT', 'DATA']):
        return 'Technology'
    elif symbol in financial_patterns or any(pattern in symbol for pattern in ['BANK', 'FIN']):
        return 'Financial'
    elif symbol in healthcare_patterns or any(pattern in symbol for pattern in ['HEALTH', 'BIO', 'PHARM']):
        return 'Healthcare'
    elif symbol in energy_patterns or any(pattern in symbol for pattern in ['OIL', 'GAS', 'ENERGY']):
        return 'Energy'
    else:
        return 'Other'