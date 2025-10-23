#!/usr/bin/env python3
"""Simplified Plaid Server based on official quickstart"""

import os
import json
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
import plaid
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.api import plaid_api
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Plaid configuration
PLAID_CLIENT_ID = os.getenv('PLAID_CLIENT_ID')
PLAID_SECRET = os.getenv('PLAID_SECRET')
PLAID_ENV = os.getenv('PLAID_ENV', 'sandbox')
PLAID_PRODUCTS = os.getenv('PLAID_PRODUCTS', 'transactions').split(',')
PLAID_COUNTRY_CODES = os.getenv('PLAID_COUNTRY_CODES', 'US').split(',')

# Set environment
host = plaid.Environment.Sandbox
if PLAID_ENV == 'production':
    host = plaid.Environment.Production

# Configure Plaid client
configuration = plaid.Configuration(
    host=host,
    api_key={
        'clientId': PLAID_CLIENT_ID,
        'secret': PLAID_SECRET,
        'plaidVersion': '2020-09-14'
    }
)

api_client = plaid.ApiClient(configuration)
client = plaid_api.PlaidApi(api_client)

# Convert products
products = [Products(product) for product in PLAID_PRODUCTS]

# Store tokens (in production, use secure storage)
access_tokens = {}

@app.route('/')
def index():
    return {'status': 'Plaid Server Running', 'env': PLAID_ENV}

@app.route('/api/create_link_token', methods=['POST'])
def create_link_token():
    try:
        data = request.get_json() or {}
        user_id = data.get('user_id', str(time.time()))
        
        request_obj = LinkTokenCreateRequest(
            products=products,
            client_name="Portfolio Analysis App",
            country_codes=[CountryCode(code) for code in PLAID_COUNTRY_CODES],
            language='en',
            user=LinkTokenCreateRequestUser(client_user_id=user_id)
        )
        
        response = client.link_token_create(request_obj)
        return jsonify(response.to_dict())
    except plaid.ApiException as e:
        return jsonify(json.loads(e.body)), e.status

@app.route('/api/set_access_token', methods=['POST'])
def set_access_token():
    try:
        data = request.get_json()
        public_token = data.get('public_token')
        user_id = data.get('user_id', 'default')
        
        if not public_token:
            return jsonify({'error': 'Missing public_token'}), 400
        
        exchange_request = ItemPublicTokenExchangeRequest(public_token=public_token)
        exchange_response = client.item_public_token_exchange(exchange_request)
        
        access_token = exchange_response['access_token']
        item_id = exchange_response['item_id']
        
        # Store token (use secure storage in production)
        access_tokens[user_id] = {
            'access_token': access_token,
            'item_id': item_id
        }
        
        return jsonify({
            'access_token': access_token,
            'item_id': item_id,
            'success': True
        })
    except plaid.ApiException as e:
        return jsonify(json.loads(e.body)), e.status

@app.route('/api/status/<user_id>')
def get_status(user_id):
    if user_id in access_tokens:
        return jsonify({
            'connected': True,
            'item_id': access_tokens[user_id]['item_id']
        })
    else:
        return jsonify({'connected': False})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    print(f"Starting Plaid server on port {port}")
    print(f"Environment: {PLAID_ENV}")
    print(f"Products: {PLAID_PRODUCTS}")
    app.run(host='0.0.0.0', port=port, debug=True)