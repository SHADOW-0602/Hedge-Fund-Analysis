#!/usr/bin/env python3
"""Plaid Client for Multi-Broker Integration - Official Cross-Platform SDK"""

import pandas as pd
from typing import List, Dict, Optional
from utils.config import Config
from utils.logger import logger
from utils.user_secrets import user_secret_manager
from datetime import datetime, timedelta

try:
    from plaid.api import plaid_api
    from plaid.configuration import Configuration
    from plaid.api_client import ApiClient
    from plaid.model.link_token_create_request import LinkTokenCreateRequest
    from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
    from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
    from plaid.model.accounts_get_request import AccountsGetRequest
    from plaid.model.transactions_get_request import TransactionsGetRequest
    from plaid.model.investments_holdings_get_request import InvestmentsHoldingsGetRequest
    from plaid.model.country_code import CountryCode
    from plaid.model.products import Products
    from plaid.exceptions import ApiException
    import plaid
    PLAID_AVAILABLE = True
except ImportError:
    PLAID_AVAILABLE = False

class PlaidClient:
    def __init__(self):
        self.client_id = Config.PLAID_CLIENT_ID
        self.secret = Config.PLAID_SECRET
        self.environment = Config.PLAID_ENVIRONMENT
        self.products = Config.PLAID_PRODUCTS.split(',')
        self.country_codes = Config.PLAID_COUNTRY_CODES.split(',')
        self.redirect_uri = Config.PLAID_REDIRECT_URI
        
        if PLAID_AVAILABLE and self.client_id and self.secret:
            # Configure environment using official SDK
            if self.environment == 'production':
                host = plaid.Environment.Production
            elif self.environment == 'development':
                host = plaid.Environment.Development
            else:
                host = plaid.Environment.Sandbox
            
            # Official cross-platform SDK configuration
            configuration = Configuration(
                host=host,
                api_key={
                    'clientId': self.client_id,
                    'secret': self.secret,
                    'plaidVersion': '2020-09-14'
                }
            )
            api_client = ApiClient(configuration)
            self.client = plaid_api.PlaidApi(api_client)
        else:
            self.client = None
    
    def create_link_token(self, user_id: str, username: str = None) -> str:
        """Create link token for Plaid Link using official SDK with dynamic username"""
        if not self.client:
            return ""
        
        try:
            # Use official SDK enums - include investments for holdings
            products = [Products('investments'), Products('transactions')]
            country_codes = [CountryCode(c.strip()) for c in self.country_codes]
            
            # Use username if provided, otherwise use user_id
            client_user_id = username if username else user_id
            
            request = LinkTokenCreateRequest(
                products=products,
                client_name="Portfolio Analysis Platform",
                country_codes=country_codes,
                language='en',
                user=LinkTokenCreateRequestUser(
                    client_user_id=client_user_id
                )
            )
            
            response = self.client.link_token_create(request)
            return response['link_token']
        except ApiException as e:
            logger.error(f"Plaid API error: {e}")
            return ""
        except Exception as e:
            logger.error(f"Plaid link token error: {e}")
            return ""
    
    def create_link_token_custom(self, user_id: str, phone_number: str = None, 
                               client_name: str = "Portfolio App", product: str = "transactions",
                               country_code: str = "US", days_requested: int = 30) -> str:
        """Create custom link token with user-specified parameters using official SDK"""
        if not self.client:
            return ""
        
        try:
            from plaid.model.link_token_transactions import LinkTokenTransactions
            
            # Build user object
            user_params = {'client_user_id': user_id}
            if phone_number:
                user_params['phone_number'] = phone_number
            
            user_obj = LinkTokenCreateRequestUser(**user_params)
            
            # Build request parameters
            request_params = {
                'user': user_obj,
                'client_name': client_name,
                'products': [Products(product)],
                'country_codes': [CountryCode(country_code)],
                'language': 'en'
            }
            
            # Add transactions config if needed
            if product == 'transactions' and days_requested:
                request_params['transactions'] = LinkTokenTransactions(days_requested=days_requested)
            
            request = LinkTokenCreateRequest(**request_params)
            response = self.client.link_token_create(request)
            return response['link_token']
            
        except ApiException as e:
            logger.error(f"Plaid API error: {e}")
            return ""
        except Exception as e:
            logger.error(f"Plaid custom link token error: {e}")
            return ""
    
    def exchange_public_token(self, public_token: str, user_id: str = None) -> str:
        """Exchange public token for access token using official SDK"""
        if not self.client:
            return ""
        
        try:
            request = ItemPublicTokenExchangeRequest(public_token=public_token)
            response = self.client.item_public_token_exchange(request)
            
            access_token = response['access_token']
            
            # Store token if user_id provided
            if user_id:
                try:
                    user_secret_manager.store_plaid_token(user_id, access_token)
                except ValueError as e:
                    logger.error(f"Token storage failed: {e}")
                    return ""
            
            logger.info("Plaid token exchanged successfully")
            return access_token
        except ApiException as e:
            logger.error(f"Plaid API error: {e}")
            return ""
        except Exception as e:
            logger.error(f"Plaid token exchange error: {e}")
            return ""
    
    def get_accounts(self, user_id: str) -> List[Dict]:
        """Get user accounts using official SDK"""
        if not self.client:
            return []
        
        access_token = user_secret_manager.get_plaid_token(user_id)
        if not access_token:
            return []
        
        try:
            request = AccountsGetRequest(access_token=access_token)
            response = self.client.accounts_get(request)
            
            accounts = []
            for account in response['accounts']:
                accounts.append({
                    'id': account['account_id'],
                    'name': account['name'],
                    'type': account['type'],
                    'subtype': account.get('subtype', ''),
                    'balance': account['balances'].get('current', 0),
                    'currency': account['balances'].get('iso_currency_code', 'USD')
                })
            
            return accounts
        except ApiException as e:
            logger.error(f"Plaid API error: {e}")
            return []
        except Exception as e:
            logger.error(f"Plaid accounts error: {e}")
            return []
    
    def get_holdings(self, user_id: str) -> pd.DataFrame:
        """Get investment holdings using official SDK"""
        if not self.client:
            return pd.DataFrame()
        
        access_token = user_secret_manager.get_plaid_token(user_id)
        if not access_token:
            return pd.DataFrame()
        
        try:
            request = InvestmentsHoldingsGetRequest(access_token=access_token)
            response = self.client.investments_holdings_get(request)
            
            holdings_data = []
            securities_map = {sec['security_id']: sec for sec in response['securities']}
            
            logger.info(f"Plaid response: {len(response['holdings'])} holdings, {len(response['securities'])} securities")
            
            for holding in response['holdings']:
                security_id = holding['security_id']
                security = securities_map.get(security_id)
                quantity = holding.get('quantity', 0)
                
                # Log all holdings for debugging
                logger.info(f"Holding: security_id={security_id}, quantity={quantity}, security={security.get('ticker_symbol') if security else 'None'}")
                
                if security and quantity > 0:
                    ticker = security.get('ticker_symbol', '').strip()
                    
                    # Handle various ticker formats and missing tickers
                    if not ticker or ticker in ['N/A', '', 'None', 'null']:
                        # Try to use CUSIP or other identifiers
                        ticker = security.get('cusip', security.get('isin', f"UNKNOWN_{security_id[:8]}"))
                        logger.warning(f"No ticker found, using: {ticker}")
                    
                    if ticker:
                        cost_basis = holding.get('cost_basis', 0) or 0
                        institution_price = holding.get('institution_price', 0) or 0
                        institution_value = holding.get('institution_value', 0) or 0
                        
                        # Calculate average cost
                        if cost_basis > 0 and quantity > 0:
                            avg_cost = cost_basis / quantity
                        elif institution_price > 0:
                            avg_cost = institution_price
                        elif institution_value > 0 and quantity > 0:
                            avg_cost = institution_value / quantity
                        else:
                            avg_cost = 0
                        
                        holdings_data.append({
                            'symbol': ticker,
                            'name': security.get('name', ticker),
                            'quantity': quantity,
                            'avg_cost': avg_cost,
                            'cost_basis': cost_basis,
                            'market_value': institution_value,
                            'institution_price': institution_price,
                            'account_id': holding['account_id'],
                            'security_type': security.get('type', 'unknown')
                        })
            
            logger.info(f"Processed {len(holdings_data)} valid holdings")
            return pd.DataFrame(holdings_data)
            
        except ApiException as e:
            logger.error(f"Plaid API error: {e}")
            return pd.DataFrame()
        except Exception as e:
            logger.error(f"Plaid holdings error: {e}")
            return pd.DataFrame()
    
    def get_transactions(self, user_id: str, days: int = 30) -> pd.DataFrame:
        """Get transaction history using official SDK"""
        if not self.client:
            return pd.DataFrame()
        
        access_token = user_secret_manager.get_plaid_token(user_id)
        if not access_token:
            return pd.DataFrame()
        
        try:
            start_date = datetime.now() - timedelta(days=days)
            end_date = datetime.now()
            
            request = TransactionsGetRequest(
                access_token=access_token,
                start_date=start_date.date(),
                end_date=end_date.date()
            )
            response = self.client.transactions_get(request)
            
            transactions_data = []
            for txn in response['transactions']:
                # Filter for investment-related transactions
                categories = txn.get('category', [])
                if any(cat in ['Investment', 'Transfer', 'Deposit'] for cat in categories):
                    transactions_data.append({
                        'date': txn['date'],
                        'description': txn.get('name', 'Investment Transaction'),
                        'transaction_type': 'deposit' if txn['amount'] < 0 else 'withdraw',
                        'amount': abs(txn['amount']),
                        'account_id': txn['account_id']
                    })
            
            return pd.DataFrame(transactions_data)
        except ApiException as e:
            logger.error(f"Plaid API error: {e}")
            return pd.DataFrame()
        except Exception as e:
            logger.error(f"Plaid transactions error: {e}")
            return pd.DataFrame()
    
    def calculate_historical_portfolio_values(self, user_id: str, days: int = 365) -> pd.DataFrame:
        """Calculate historical portfolio values for drawdown analysis"""
        try:
            # Get investment transactions
            transactions_df = self.get_investment_transactions(user_id, days)
            if transactions_df.empty:
                return pd.DataFrame()
            
            # Get current holdings for validation
            holdings_df = self.get_holdings(user_id)
            
            # Calculate daily portfolio values based on transactions
            from clients.market_data_client import MarketDataClient
            data_client = MarketDataClient()
            
            # Get unique symbols
            symbols = transactions_df['symbol'].unique().tolist()
            
            # Get historical price data
            price_data = data_client.get_price_data(symbols, f"{days}d")
            
            if price_data.empty:
                return pd.DataFrame()
            
            # Calculate position changes over time
            portfolio_values = []
            current_positions = {}
            
            # Sort transactions by date
            transactions_df = transactions_df.sort_values('date')
            
            for date in price_data.index:
                # Apply transactions up to this date
                day_transactions = transactions_df[transactions_df['date'].dt.date <= date.date()]
                
                # Calculate positions
                positions = {}
                for _, txn in day_transactions.iterrows():
                    symbol = txn['symbol']
                    if symbol not in positions:
                        positions[symbol] = 0
                    
                    if txn['transaction_type'] == 'BUY':
                        positions[symbol] += txn['quantity']
                    elif txn['transaction_type'] == 'SELL':
                        positions[symbol] -= txn['quantity']
                
                # Calculate portfolio value for this date
                total_value = 0
                for symbol, quantity in positions.items():
                    if symbol in price_data.columns and quantity > 0:
                        price = price_data.loc[date, symbol]
                        if not pd.isna(price):
                            total_value += quantity * price
                
                portfolio_values.append({
                    'date': date,
                    'portfolio_value': total_value
                })
            
            return pd.DataFrame(portfolio_values)
            
        except Exception as e:
            logger.error(f"Error calculating historical portfolio values: {e}")
            return pd.DataFrame()
    
    def get_investment_transactions(self, user_id: str, days: int = 90) -> pd.DataFrame:
        """Get investment transactions (buy/sell) using official SDK with pagination"""
        if not self.client:
            return pd.DataFrame()
        
        access_token = user_secret_manager.get_plaid_token(user_id)
        if not access_token:
            return pd.DataFrame()
        
        try:
            from plaid.model.investments_transactions_get_request import InvestmentsTransactionsGetRequest
            
            start_date = datetime.now() - timedelta(days=days)
            end_date = datetime.now()
            
            all_transactions = []
            all_securities = {}
            offset = 0
            count = 500  # Maximum allowed by Plaid API
            
            while True:
                request = InvestmentsTransactionsGetRequest(
                    access_token=access_token,
                    start_date=start_date.date(),
                    end_date=end_date.date()
                )
                response = self.client.investments_transactions_get(request)
                
                # Add securities to map
                for sec in response['securities']:
                    all_securities[sec['security_id']] = sec
                
                # Add transactions
                batch_transactions = response['investment_transactions']
                all_transactions.extend(batch_transactions)
                
                logger.info(f"Plaid batch {offset//count + 1}: {len(batch_transactions)} transactions (total: {len(all_transactions)})")
                
                # Plaid returns all transactions in one call, no pagination needed
                break
            
            transactions_data = []
            logger.info(f"Plaid investment transactions: {len(all_transactions)} found across all pages")
            
            for txn in all_transactions:
                security_id = txn['security_id']
                security = all_securities.get(security_id)
                
                if security:
                    ticker = security.get('ticker_symbol', '').strip()
                    
                    # Handle missing tickers
                    if not ticker or ticker in ['N/A', '', 'None', 'null']:
                        ticker = security.get('cusip', security.get('isin', f"UNKNOWN_{security_id[:8]}"))
                    
                    if ticker and txn.get('quantity', 0) != 0:
                        # Map Plaid transaction types to standard format
                        plaid_type = str(txn.get('type', ''))
                        transaction_type = 'BUY' if 'buy' in plaid_type.lower() or 'purchase' in plaid_type.lower() else 'SELL' if 'sell' in plaid_type.lower() or 'sale' in plaid_type.lower() else plaid_type
                        
                        transactions_data.append({
                            'symbol': ticker,
                            'quantity': abs(txn.get('quantity', 0)),
                            'price': txn.get('price', 0) or 0,
                            'date': txn['date'],
                            'transaction_type': transaction_type,
                            'fees': txn.get('fees', 0) or 0,
                            'account_id': txn['account_id'],
                            'security_name': security.get('name', ticker)
                        })
            
            logger.info(f"Processed {len(transactions_data)} valid investment transactions")
            return pd.DataFrame(transactions_data)
            
        except ImportError:
            logger.warning("Investment transactions not available in this Plaid SDK version")
            return pd.DataFrame()
        except ApiException as e:
            logger.error(f"Plaid API error: {e}")
            return pd.DataFrame()
        except Exception as e:
            logger.error(f"Plaid investment transactions error: {e}")
            return pd.DataFrame()

    def is_available(self) -> bool:
        """Check if Plaid client is properly configured"""
        return self.client is not None
    
    def get_link_url(self, link_token: str) -> str:
        """Generate Plaid Link URL for cross-platform usage"""
        if not link_token:
            return ""
        return f"https://link.plaid.com/v2/stable/link.html?isWebview=true&token={link_token}"
    
    def add_manual_transaction(self, user_id: str, symbol: str, quantity: float, price: float, 
                              transaction_type: str, date: str = None, fees: float = 0.0) -> dict:
        """Add manual transaction to user's transaction history"""
        try:
            from core.transactions import Transaction
            from datetime import datetime
            
            # Parse date or use current date
            if date:
                transaction_date = datetime.strptime(date, '%Y-%m-%d')
            else:
                transaction_date = datetime.now()
            
            # Create transaction object
            transaction = Transaction(
                symbol=symbol.upper(),
                quantity=quantity,
                price=price,
                date=transaction_date,
                transaction_type=transaction_type.upper(),
                fees=fees
            )
            
            # Store in user secrets as manual transactions
            manual_transactions_key = f"manual_transactions_{user_id}"
            existing_transactions = user_secret_manager.get_secret(user_id, manual_transactions_key)
            
            if existing_transactions:
                import json
                transactions_list = json.loads(existing_transactions)
            else:
                transactions_list = []
            
            # Add new transaction
            transaction_dict = {
                'symbol': transaction.symbol,
                'quantity': transaction.quantity,
                'price': transaction.price,
                'date': transaction.date.isoformat(),
                'transaction_type': transaction.transaction_type,
                'fees': transaction.fees,
                'source': 'manual'
            }
            
            transactions_list.append(transaction_dict)
            
            # Store updated list
            import json
            success = user_secret_manager.store_secret(
                user_id, 
                manual_transactions_key, 
                json.dumps(transactions_list)
            )
            
            if success:
                logger.info(f"Manual transaction added for user {user_id}: {symbol} {quantity} @ {price}")
                return {'status': 'success', 'message': 'Transaction added successfully'}
            else:
                return {'status': 'error', 'message': 'Failed to store transaction'}
                
        except Exception as e:
            logger.error(f"Error adding manual transaction: {e}")
            return {'status': 'error', 'message': str(e)}
    
    def get_manual_transactions(self, user_id: str) -> pd.DataFrame:
        """Get manually added transactions for user"""
        try:
            manual_transactions_key = f"manual_transactions_{user_id}"
            existing_transactions = user_secret_manager.get_secret(user_id, manual_transactions_key)
            
            if existing_transactions:
                import json
                transactions_list = json.loads(existing_transactions)
                
                # Convert to DataFrame
                df = pd.DataFrame(transactions_list)
                if not df.empty:
                    df['date'] = pd.to_datetime(df['date'])
                    logger.info(f"Retrieved {len(df)} manual transactions for user {user_id}")
                return df
            else:
                return pd.DataFrame()
                
        except Exception as e:
            logger.error(f"Error retrieving manual transactions: {e}")
            return pd.DataFrame()
    
    def get_all_transactions(self, user_id: str, days: int = 90) -> pd.DataFrame:
        """Get combined investment transactions from Plaid and manual entries"""
        try:
            # Get Plaid investment transactions
            plaid_transactions = self.get_investment_transactions(user_id, days)
            
            # Get manual transactions
            manual_transactions = self.get_manual_transactions(user_id)
            
            # Filter manual transactions by date range if specified
            if not manual_transactions.empty and days > 0:
                cutoff_date = datetime.now() - timedelta(days=days)
                manual_transactions = manual_transactions[manual_transactions['date'] >= cutoff_date]
            
            # Combine transactions
            if not plaid_transactions.empty and not manual_transactions.empty:
                # Ensure consistent columns
                plaid_transactions['source'] = 'plaid'
                combined_df = pd.concat([plaid_transactions, manual_transactions], ignore_index=True)
            elif not plaid_transactions.empty:
                plaid_transactions['source'] = 'plaid'
                combined_df = plaid_transactions
            elif not manual_transactions.empty:
                combined_df = manual_transactions
            else:
                combined_df = pd.DataFrame()
            
            if not combined_df.empty:
                # Sort by date
                combined_df = combined_df.sort_values('date', ascending=False)
                logger.info(f"Retrieved {len(combined_df)} total transactions for user {user_id}")
            
            return combined_df
            
        except Exception as e:
            logger.error(f"Error retrieving all transactions: {e}")
            return pd.DataFrame()

# Global instance
plaid_client = PlaidClient() if PLAID_AVAILABLE else None

def clear_manual_transactions(user_id: str) -> bool:
    """Clear all manual transactions for a user"""
    try:
        manual_transactions_key = f"manual_transactions_{user_id}"
        success = user_secret_manager.delete_specific_secret(user_id, manual_transactions_key)
        if success:
            logger.info(f"Cleared manual transactions for user {user_id}")
        return success
    except Exception as e:
        logger.error(f"Error clearing manual transactions: {e}")
        return False