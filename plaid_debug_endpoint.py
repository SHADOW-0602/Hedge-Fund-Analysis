"""
Quick diagnostic endpoint to check Plaid connections
Add this to app.py temporarily
"""

@app.route('/api/debug-plaid-connections', methods=['GET'])
def debug_plaid_connections():
    """Debug endpoint to check all Plaid connections"""
    try:
        from clients.supabase_client import supabase_client
        
        if not supabase_client or not supabase_client.service_client:
            return jsonify({'error': 'Supabase not available'}), 500
        
        # Get ALL connections
        all_result = supabase_client.service_client.table('plaid_connections')\
            .select('user_id, connection_id, institution_name, created_at, is_active')\
            .execute()
        
        # Get connections for specific user
        target_user = '744944b4-c861-4950-9cb1-a34ded460d36'
        user_result = supabase_client.service_client.table('plaid_connections')\
            .select('user_id, connection_id, institution_name, created_at, is_active')\
            .eq('user_id', target_user)\
            .execute()
        
        return jsonify({
            'total_connections': len(all_result.data),
            'all_connections': all_result.data,
            'target_user': target_user,
            'user_connections': user_result.data,
            'user_connections_count': len(user_result.data)
        })
        
    except Exception as e:
        import traceback
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500
