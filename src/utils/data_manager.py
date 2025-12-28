import pandas as pd
from typing import List, Dict, Any, Optional
import traceback
from .logger import logger

try:
    from clients.supabase_client import supabase_client
except ImportError:
    supabase_client = None

try:
    from clients.plaid_client import plaid_client
except ImportError:
    plaid_client = None

try:
    from utils.plaid_supabase_manager import plaid_supabase_manager
except ImportError:
    plaid_supabase_manager = None

class DataManager:
    """
    Unified Data Manager to fetch and consolidate portfolio data 
    from both manual uploads (Supabase) and Plaid connections.
    """
    
    @staticmethod
    def get_consolidated_portfolio(user_id: str) -> List[Dict[str, Any]]:
        """
        Fetches and merges manual portfolio data and Plaid holdings for a user.
        
        Args:
            user_id: The user's ID
            
        Returns:
            List of portfolio items (dicts) with normalized keys
        """
        consolidated_portfolio = []
        
        # 1. Fetch Manual Portfolios
        try:
            manual_data = DataManager._fetch_manual_portfolios(user_id)
            if manual_data:
                logger.info(f"Fetched {len(manual_data)} manual portfolio items for user {user_id}")
                consolidated_portfolio.extend(manual_data)
        except Exception as e:
            logger.error(f"Error fetching manual portfolios: {e}")
            
        # 2. Fetch Plaid Holdings
        try:
            plaid_data = DataManager._fetch_plaid_holdings(user_id)
            if plaid_data:
                logger.info(f"Fetched {len(plaid_data)} Plaid holding items for user {user_id}")
                consolidated_portfolio.extend(plaid_data)
        except Exception as e:
            logger.error(f"Error fetching Plaid holdings: {e}")
            
        return consolidated_portfolio

    @staticmethod
    def _fetch_manual_portfolios(user_id: str) -> List[Dict[str, Any]]:
        """Fetches manual portfolios from Supabase."""
        if not supabase_client or not supabase_client.client:
            logger.warning("Supabase client not available for fetching manual portfolios")
            return []
            
        try:
            # Fetch most recent portfolio or all? 
            # Logic: Fetch all saved portfolios and merge them. 
            # NOTE: This might duplicate if user saved multiple versions.
            # Strategy: Fetch the *latest* saved portfolio for now, or all entries if they represent different chunks.
            # Given the context "if there is file in manual upload", usually implies the active/latest one.
            # However, typically users might save different portfolios. 
            # Let's fetch ALL and merge.
            
            response = supabase_client.client.table('portfolios').select('portfolio_data').eq('user_id', user_id).execute()
            
            items = []
            if response.data:
                for record in response.data:
                    p_data = record.get('portfolio_data', [])
                    if isinstance(p_data, list):
                        items.extend(p_data)
            
            return items
            
        except Exception as e:
            logger.error(f"Supabase query error: {e}")
            return []

    @staticmethod
    def _fetch_plaid_holdings(user_id: str) -> List[Dict[str, Any]]:
        """Fetches holdings from all linked Plaid accounts."""
        if not plaid_client or not plaid_client.is_available():
            logger.warning("Plaid client not available")
            return []
            
        if not plaid_supabase_manager:
            logger.warning("PlaidSupabaseManager not available")
            return []
            
        try:
            # Check if user has connections
            connections = plaid_supabase_manager.get_plaid_connections(user_id)
            if not connections:
                return []
                
            # Use PlaidClient to fetch holdings (it handles iterating tokens if designed so, 
            # but usually we might need to iterate ourselves if PlaidClient methods are per-token)
            
            # Looking at PlaidClient.get_holdings signature from previous context or usage:
            # It accepts user_id. Let's assume it handles the logic of fetching for that user.
            # If not, we might need to iterate connections. 
            # Re-checking api/plaid_routes_secure.py line 166: `holdings_df = plaid_client.get_holdings(user_id)`
            # So it seems valid to just call it with user_id.
            
            holdings_df = plaid_client.get_holdings(user_id)
            
            items = []
            if not holdings_df.empty:
                for _, row in holdings_df.iterrows():
                    # Normalize to partial match manual upload format
                    item = {
                        'symbol': row.get('symbol', 'UNKNOWN'),
                        'quantity': float(row.get('quantity', 0)),
                        'currentPrice': float(row.get('price', row.get('current_price', 0))), # Try to match frontend expected keys
                        'avg_cost': float(row.get('avg_cost', 0)),
                        'cost_basis': float(row.get('cost_basis', 0)),
                        'market_value': float(row.get('market_value', 0)),
                        'type': row.get('security_type', 'equity'),
                        'source': 'plaid' # Metadata tag
                    }
                    items.append(item)
                    
            return items
            
        except Exception as e:
            logger.error(f"Plaid fetch error: {e}")
            traceback.print_exc()
            return []

    @staticmethod
    def get_consolidated_transactions(user_id: str, days: int = 365) -> List[Dict[str, Any]]:
        """
        Fetches and merges manual transactions and Plaid transactions for a user.
        
        Args:
            user_id: The user's ID
            days: Number of days of history to fetch for Plaid
            
        Returns:
            List of transaction items (dicts)
        """
        consolidated_transactions = []
        
        # 1. Fetch Manual Transactions
        try:
            manual_txns = DataManager._fetch_manual_transactions(user_id)
            if manual_txns:
                logger.info(f"Fetched {len(manual_txns)} manual transactions for user {user_id}")
                consolidated_transactions.extend(manual_txns)
        except Exception as e:
            logger.error(f"Error fetching manual transactions: {e}")
            
        # 2. Fetch Plaid Transactions
        try:
            plaid_txns = DataManager._fetch_plaid_transactions(user_id, days)
            if plaid_txns:
                logger.info(f"Fetched {len(plaid_txns)} Plaid transactions for user {user_id}")
                consolidated_transactions.extend(plaid_txns)
        except Exception as e:
            logger.error(f"Error fetching Plaid transactions: {e}")
            
        return consolidated_transactions
        
    @staticmethod
    def _fetch_manual_transactions(user_id: str) -> List[Dict[str, Any]]:
        """Fetches manual transactions from Supabase."""
        if not supabase_client or not supabase_client.client:
            return []
            
        try:
            response = supabase_client.client.table('transactions').select('transactions_data').eq('user_id', user_id).execute()
            
            items = []
            if response.data:
                for record in response.data:
                    t_data = record.get('transactions_data', [])
                    if isinstance(t_data, list):
                        items.extend(t_data)
            return items
        except Exception as e:
            logger.error(f"Manual transaction fetch error: {e}")
            return []
            
    @staticmethod
    def _fetch_plaid_transactions(user_id: str, days: int) -> List[Dict[str, Any]]:
        """Fetches investment transactions from Plaid."""
        if not plaid_client or not plaid_client.is_available():
            return []
            
        if not plaid_supabase_manager:
            return []
            
        try:
            # Check for connections first
            connections = plaid_supabase_manager.get_plaid_connections(user_id)
            if not connections:
                return []
                
            txns_df = plaid_client.get_investment_transactions(user_id, days)
            
            items = []
            if not txns_df.empty:
                for _, row in txns_df.iterrows():
                    # Normalize to internal Transaction format
                    # Expected: symbol, quantity, price, fees, transaction_type, date
                    
                    # Convert Plaid subtypes to BUY/SELL
                    # Plaid subtypes: 'buy', 'sell', 'dividend', etc.
                    p_subtype = str(row.get('subtype', '')).lower()
                    p_type = str(row.get('type', '')).lower()
                    
                    tx_type = 'UNKNOWN'
                    if 'buy' in p_subtype:
                        tx_type = 'BUY'
                    elif 'sell' in p_subtype:
                        tx_type = 'SELL'
                    elif 'dividend' in p_type or 'dividend' in p_subtype:
                        tx_type = 'CDIV' # Cash Dividend in internal model? Or just ignore? 
                        # core/transactions.py usually handles BUY/SELL. 
                        # If AdvancedTransactionAnalyzer handles dividends, great.
                        # For now map to generic types or keep raw if analyzer is smart.
                        # Route `analyze_transactions` checks for BUY/SELL handling explicitly.
                        pass
                        
                    if tx_type == 'UNKNOWN':
                        # Try to infer from quantity/amount?
                        # Plaid investment transactions: positive amount = buy? No, positive quantity = buy.
                        qty = float(row.get('quantity', 0))
                        if qty > 0:
                            tx_type = 'BUY'
                        elif qty < 0:
                            tx_type = 'SELL'
                    
                    item = {
                        'symbol': row.get('symbol', 'UNKNOWN'),
                        'quantity': abs(float(row.get('quantity', 0))),
                        'price': float(row.get('price', 0)),
                        'fees': float(row.get('fees', 0)),
                        'transaction_type': tx_type,
                        'date': row.get('date', pd.Timestamp.now()).isoformat() if hasattr(row.get('date'), 'isoformat') else str(row.get('date')),
                        'source': 'plaid'
                    }
                    items.append(item)
            return items
        except Exception as e:
            logger.error(f"Plaid transaction fetch error: {e}")
            return []
