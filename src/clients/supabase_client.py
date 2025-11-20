from supabase import create_client, Client
from typing import Dict, List, Optional
import json
import os
import logging

# Setup module logger
logger = logging.getLogger(__name__)

class SupabaseClient:
    def __init__(self):
        self.client = None
        self.service_client = None
        try:
            url = os.getenv('SUPABASE_URL')
            anon_key = os.getenv('SUPABASE_ANON_KEY')
            service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_SERVICE_KEY')
            
            if not url:
                raise ValueError("SUPABASE_URL environment variable is required")
            if not anon_key:
                raise ValueError("SUPABASE_ANON_KEY environment variable is required")
            
            logger.info(f"Initializing Supabase client for URL: {url}")
            self.client: Client = create_client(url, anon_key)
            logger.info("Supabase anon client created successfully")
            
            # Create service role client if available
            if service_key:
                self.service_client: Client = create_client(url, service_key)
                logger.info("Supabase service client created successfully")
            else:
                logger.warning("Service role key not found - using anon client for admin operations")
                self.service_client = self.client
            
            print(f"Supabase connected: {url}")
        except Exception as e:
            logger.error(f"Supabase connection failed: {e}")
            print(f"Supabase connection failed: {e}")
            self.client = None
            self.service_client = None
    
    def create_tables(self):
        """Create required tables if they don't exist"""
        # This would typically be done via Supabase dashboard or migrations
        pass
    
    def save_portfolio(self, user_id: str, portfolio_name: str, portfolio_data: Dict) -> str:
        """Save portfolio to Supabase"""
        logger.info(f"Saving portfolio '{portfolio_name}' for user {user_id}")
        data = {
            'user_id': user_id,
            'portfolio_name': portfolio_name,
            'portfolio_data': json.dumps(portfolio_data),
            'is_shared': False
        }
        
        result = self.client.table('portfolios').insert(data).execute()
        portfolio_id = result.data[0]['id'] if result.data else None
        logger.info(f"Portfolio saved with ID: {portfolio_id}")
        return portfolio_id
    
    def get_user_portfolios(self, user_id: str) -> List[Dict]:
        """Get all portfolios for a user"""
        result = self.client.table('portfolios').select('*').eq('user_id', user_id).execute()
        
        portfolios = []
        for row in result.data:
            portfolios.append({
                'id': row['id'],
                'portfolio_name': row['portfolio_name'],
                'portfolio_data': json.loads(row['portfolio_data']),
                'created_at': row['created_at'],
                'is_shared': row['is_shared']
            })
        
        return portfolios
    
    def get_portfolio(self, portfolio_id: str, user_id: str) -> Optional[Dict]:
        """Get specific portfolio"""
        result = self.client.table('portfolios').select('*').eq('id', portfolio_id).eq('user_id', user_id).execute()
        
        if result.data:
            row = result.data[0]
            return {
                'id': row['id'],
                'portfolio_name': row['portfolio_name'],
                'portfolio_data': json.loads(row['portfolio_data']),
                'created_at': row['created_at'],
                'is_shared': row['is_shared']
            }
        return None
    
    def update_portfolio(self, portfolio_id: str, user_id: str, portfolio_data: Dict) -> bool:
        """Update portfolio data"""
        data = {'portfolio_data': json.dumps(portfolio_data)}
        result = self.client.table('portfolios').update(data).eq('id', portfolio_id).eq('user_id', user_id).execute()
        return len(result.data) > 0
    
    def delete_portfolio(self, portfolio_id: str, user_id: str) -> bool:
        """Delete portfolio"""
        logger.info(f"Deleting portfolio {portfolio_id} for user {user_id}")
        result = self.client.table('portfolios').delete().eq('id', portfolio_id).eq('user_id', user_id).execute()
        success = len(result.data) > 0
        logger.info(f"Portfolio deletion {'successful' if success else 'failed'}")
        return success
    
    def share_portfolio(self, portfolio_id: str, user_id: str) -> bool:
        """Make portfolio public/shared"""
        data = {'is_shared': True}
        result = self.client.table('portfolios').update(data).eq('id', portfolio_id).eq('user_id', user_id).execute()
        return len(result.data) > 0
    
    def save_transactions(self, user_id: str, transaction_set_name: str, transactions_data: List[Dict]) -> str:
        """Save transaction set to Supabase"""
        logger.info(f"Saving {len(transactions_data)} transactions as '{transaction_set_name}' for user {user_id}")
        data = {
            'user_id': user_id,
            'transaction_set_name': transaction_set_name,
            'transactions_data': json.dumps(transactions_data),
            'is_shared': False
        }
        
        result = self.client.table('transactions').insert(data).execute()
        transaction_id = result.data[0]['id'] if result.data else None
        logger.info(f"Transactions saved with ID: {transaction_id}")
        return transaction_id
    
    def get_user_transactions(self, user_id: str) -> List[Dict]:
        """Get all transaction sets for a user"""
        result = self.client.table('transactions').select('*').eq('user_id', user_id).execute()
        
        transaction_sets = []
        for row in result.data:
            transaction_sets.append({
                'id': row['id'],
                'transaction_set_name': row['transaction_set_name'],
                'transactions_data': json.loads(row['transactions_data']),
                'created_at': row['created_at'],
                'is_shared': row['is_shared']
            })
        
        return transaction_sets
    
    def get_transactions(self, transaction_id: str, user_id: str) -> Optional[Dict]:
        """Get specific transaction set"""
        result = self.client.table('transactions').select('*').eq('id', transaction_id).eq('user_id', user_id).execute()
        
        if result.data:
            row = result.data[0]
            return {
                'id': row['id'],
                'transaction_set_name': row['transaction_set_name'],
                'transactions_data': json.loads(row['transactions_data']),
                'created_at': row['created_at'],
                'is_shared': row['is_shared']
            }
        return None

# Global instance
try:
    supabase_client = SupabaseClient()
except Exception as e:
    print(f"Supabase initialization failed: {e}")
    supabase_client = None