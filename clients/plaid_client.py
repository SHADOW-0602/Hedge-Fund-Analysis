from plaid.api import plaid_api
from plaid.model.transactions_get_request import TransactionsGetRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.investments_holdings_get_request import InvestmentsHoldingsGetRequest
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.country_code import CountryCode
from plaid.model.products import Products
from plaid.configuration import Configuration
from plaid.api_client import ApiClient
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from utils.config import Config
import pandas as pd

class PlaidClient:
    def __init__(self):
        if not Config.PLAID_CLIENT_ID or not Config.PLAID_SECRET:
            self.client = None
            return
        
        # Set Plaid environment using string values
        if Config.PLAID_ENVIRONMENT == 'sandbox':
            host = 'https://sandbox.plaid.com'
        elif Config.PLAID_ENVIRONMENT == 'development':
            host = 'https://development.plaid.com'
        elif Config.PLAID_ENVIRONMENT == 'production':
            host = 'https://production.plaid.com'
        else:
            host = 'https://sandbox.plaid.com'  # Default to sandbox
        
        configuration = Configuration(
            host=host,
            api_key={
                'clientId': Config.PLAID_CLIENT_ID,
                'secret': Config.PLAID_SECRET
            }
        )
        api_client = ApiClient(configuration)
        self.client = plaid_api.PlaidApi(api_client)
    
    def create_link_token(self, user_id: str) -> Optional[str]:
        """Create link token for Plaid Link"""
        if not self.client:
            return None
        
        try:
            request = LinkTokenCreateRequest(
                products=[Products('investments')],
                client_name="Hedge Fund Analysis",
                country_codes=[CountryCode('US')],
                language='en',
                user={'client_user_id': user_id}
            )
            response = self.client.link_token_create(request)
            return response['link_token']
        except Exception as e:
            print(f"Error creating link token: {e}")
            return None
    
    def exchange_public_token(self, public_token: str) -> Optional[str]:
        """Exchange public token for access token"""
        if not self.client:
            print("Plaid client not initialized")
            return None
        
        try:
            request = ItemPublicTokenExchangeRequest(public_token=public_token)
            response = self.client.item_public_token_exchange(request)
            print(f"Successfully exchanged token for: {public_token}")
            return response['access_token']
        except Exception as e:
            print(f"Failed to exchange token for {public_token}: {str(e)}")
            return None
    
    def get_accounts(self, access_token: str) -> List[Dict]:
        """Get account information"""
        if not self.client:
            return []
        
        try:
            request = AccountsGetRequest(access_token=access_token)
            response = self.client.accounts_get(request)
            return [
                {
                    'account_id': acc['account_id'],
                    'name': acc['name'],
                    'type': acc['type'],
                    'subtype': acc['subtype'],
                    'balance': acc.get('balances', {}).get('current', 0)
                }
                for acc in response['accounts']
            ]
        except Exception as e:
            print(f"Error getting accounts: {e}")
            return []
    
    def get_holdings(self, access_token: str) -> pd.DataFrame:
        """Get investment holdings"""
        if not self.client:
            return pd.DataFrame()
        
        try:
            request = InvestmentsHoldingsGetRequest(access_token=access_token)
            response = self.client.investments_holdings_get(request)
            
            holdings_data = []
            for holding in response['holdings']:
                security = next((s for s in response['securities'] if s['security_id'] == holding['security_id']), {})
                
                holdings_data.append({
                    'symbol': security.get('ticker_symbol', 'N/A'),
                    'name': security.get('name', 'Unknown'),
                    'quantity': holding['quantity'],
                    'institution_price': holding.get('institution_price', 0),
                    'institution_value': holding.get('institution_value', 0),
                    'cost_basis': holding.get('cost_basis', 0),
                    'account_id': holding['account_id']
                })
            
            return pd.DataFrame(holdings_data)
        except Exception as e:
            print(f"Error getting holdings: {e}")
            return pd.DataFrame()
    
    def get_transactions(self, access_token: str, days: int = 30) -> pd.DataFrame:
        """Get investment transactions with multiple types"""
        if not self.client:
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
                # Categorize transaction types
                transaction_type = self._categorize_transaction(txn)
                
                transactions_data.append({
                    'date': txn['date'],
                    'amount': abs(txn['amount']),
                    'transaction_type': transaction_type,
                    'description': txn['name'],
                    'category': txn.get('category', ['Unknown'])[0],
                    'account_id': txn['account_id'],
                    'is_debit': txn['amount'] > 0  # Plaid uses positive for debits
                })
            
            return pd.DataFrame(transactions_data)
        except Exception as e:
            print(f"Error getting transactions: {e}")
            return pd.DataFrame()
    
    def _categorize_transaction(self, txn: dict) -> str:
        """Categorize transaction based on description and category"""
        description = txn['name'].lower()
        category = txn.get('category', [''])[0].lower()
        amount = txn['amount']
        
        # Dividend payments
        if any(word in description for word in ['dividend', 'div', 'distribution']):
            return 'dividend'
        
        # Interest income/expense
        if 'interest' in description:
            return 'interest_income' if amount < 0 else 'interest_expense'
        
        # Fees
        if any(word in description for word in ['fee', 'charge', 'commission']):
            return 'fees'
        
        # Tax payments
        if any(word in description for word in ['tax', 'withholding', 'irs']):
            return 'taxes'
        
        # Deposits (money coming in)
        if amount < 0 and any(word in description for word in ['deposit', 'transfer in', 'ach credit']):
            return 'deposit'
        
        # Withdrawals (money going out)
        if amount > 0 and any(word in description for word in ['withdrawal', 'transfer out', 'ach debit']):
            return 'withdraw'
        
        # Investment transactions
        if any(word in description for word in ['buy', 'sell', 'purchase', 'sale']):
            return 'investment'
        
        # Default categorization
        return 'deposit' if amount < 0 else 'withdraw'

# Global instance
plaid_client = PlaidClient() if Config.PLAID_CLIENT_ID and Config.PLAID_SECRET else None