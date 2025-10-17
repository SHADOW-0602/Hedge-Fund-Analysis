from supabase import create_client, Client
from typing import Dict, List, Optional
import json
from utils.config import Config

class SupabaseClient:
    def __init__(self):
        if not Config.SUPABASE_URL or not Config.SUPABASE_ANON_KEY:
            raise ValueError("Supabase configuration missing")
        
        self.client: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY)
    
    def create_tables(self):
        """Create required tables if they don't exist"""
        # This would typically be done via Supabase dashboard or migrations
        pass
    
    def save_portfolio(self, user_id: str, portfolio_name: str, portfolio_data: Dict) -> str:
        """Save portfolio to Supabase"""
        data = {
            'user_id': user_id,
            'portfolio_name': portfolio_name,
            'portfolio_data': json.dumps(portfolio_data),
            'is_shared': False
        }
        
        result = self.client.table('portfolios').insert(data).execute()
        return result.data[0]['id'] if result.data else None
    
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
        result = self.client.table('portfolios').delete().eq('id', portfolio_id).eq('user_id', user_id).execute()
        return len(result.data) > 0
    
    def share_portfolio(self, portfolio_id: str, user_id: str) -> bool:
        """Make portfolio public/shared"""
        data = {'is_shared': True}
        result = self.client.table('portfolios').update(data).eq('id', portfolio_id).eq('user_id', user_id).execute()
        return len(result.data) > 0

# Global instance
supabase_client = SupabaseClient() if Config.SUPABASE_URL and Config.SUPABASE_ANON_KEY else None