"""Cache API Routes"""

from flask import request, jsonify
import json

def register_cache_routes(app, redis_client=None):
    @app.route('/api/cache', methods=['POST'])
    def cache_data():
        try:
            data = request.get_json()
            key = data.get('key')
            value = data.get('data')
            ttl = data.get('ttl', 3600)
            
            if not key:
                return jsonify({'success': False, 'error': 'Key required'}), 400
            
            if redis_client:
                redis_client.setex(key, ttl, json.dumps(value))
                return jsonify({'success': True})
            else:
                return jsonify({'success': False, 'error': 'Cache not available'}), 503
                
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    
    @app.route('/api/cache/<key>', methods=['GET'])
    def get_cached_data(key):
        try:
            if redis_client:
                data = redis_client.get(key)
                if data:
                    return jsonify({'success': True, 'data': json.loads(data)})
                else:
                    return jsonify({'success': False, 'error': 'Key not found'}), 404
            else:
                return jsonify({'success': False, 'error': 'Cache not available'}), 503
                
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500