from typing import Dict, List, Any
import json
from datetime import datetime
from clients.supabase_client import supabase_client
# Removed smart_cache import - using direct database calls

class SupabaseOptimizer:
    """Optimize Supabase queries with batching, caching, and connection pooling"""
    
    @staticmethod
    def batch_insert(table: str, records: List[Dict], batch_size: int = 100) -> bool:
        """Insert records in batches to avoid timeout"""
        if not supabase_client or not supabase_client.client:
            return False
        
        try:
            for i in range(0, len(records), batch_size):
                batch = records[i:i + batch_size]
                supabase_client.client.table(table).insert(batch).execute()
            return True
        except Exception as e:
            print(f"Batch insert error: {e}")
            return False
    
    @staticmethod
    def cached_select(table: str, filters: Dict, cache_ttl: int = 600) -> List[Dict]:
        """Select with caching"""
        cache_key = f"supabase_{table}_{hash(str(sorted(filters.items())))}"
        
        # Direct database query without caching
        
        # Query Supabase
        if not supabase_client or not supabase_client.client:
            return []
        
        try:
            query = supabase_client.client.table(table).select('*')
            
            # Apply filters
            for key, value in filters.items():
                query = query.eq(key, value)
            
            result = query.execute()
            data = result.data if result.data else []
            
            # No caching - return fresh data
            return data
            
        except Exception as e:
            print(f"Cached select error: {e}")
            return []
    
    @staticmethod
    def upsert_with_cache_invalidation(table: str, data: Dict, user_id: str = None):
        """Upsert data and invalidate related cache"""
        if not supabase_client or not supabase_client.client:
            return False
        
        try:
            # Perform upsert
            result = supabase_client.client.table(table).upsert(data).execute()
            
            # No cache invalidation needed
            
            return result.data
            
        except Exception as e:
            print(f"Upsert error: {e}")
            return False
    
    @staticmethod
    def get_user_data_optimized(user_id: str) -> Dict:
        """Get all user data in single optimized query"""
        cache_key = f'user_all_data_{user_id}'
        
        # Direct database query without caching
        
        if not supabase_client or not supabase_client.client:
            return {}
        
        try:
            # Get portfolios and transactions in parallel
            portfolios_result = supabase_client.client.table('portfolios').select('*').eq('user_id', user_id).execute()
            transactions_result = supabase_client.client.table('transactions').select('*').eq('user_id', user_id).execute()
            
            user_data = {
                'portfolios': portfolios_result.data if portfolios_result.data else [],
                'transactions': transactions_result.data if transactions_result.data else [],
                'last_updated': datetime.now().isoformat()
            }
            
            # No caching - return fresh data
            return user_data
            
        except Exception as e:
            print(f"Get user data error: {e}")
            return {}

# Global optimizer instance
supabase_optimizer = SupabaseOptimizer()