import os
import requests
from flask import Blueprint, request, jsonify
from dotenv import load_dotenv

load_dotenv()

chat_bp = Blueprint('chat', __name__, url_prefix='/api/chat')

import random

def get_api_key():
    keys = [
        os.getenv('GEMINI_API_KEY'),
        os.getenv('GEMINI_API_KEY_2'),
        os.getenv('GEMINI_API_KEY_3'),
        os.getenv('GEMINI_API_KEY_4'),
        os.getenv('GEMINI_API_KEY_5')
    ]
    # Filter out None values
    valid_keys = [k for k in keys if k]
    if not valid_keys:
        return None
    return random.choice(valid_keys)

@chat_bp.route('', methods=['POST'])
def chat():
    # Randomly select an API key
    api_key = get_api_key()
    if not api_key:
        return jsonify({'error': 'Chat system not configured (missing API keys)'}), 503

    try:
        data = request.json
        user_message = data.get('message', '')
        history = data.get('history', [])

        if not user_message:
            return jsonify({'error': 'Message is required'}), 400

        # Construct contents for REST API
        # API requires: {"contents": [{"role": "user", "parts": [{"text": "msg"}]}]}
        contents = []
        for msg in history:
            role = 'user' if msg.get('sender') == 'user' else 'model'
            contents.append({
                "role": role,
                "parts": [{"text": msg.get('text', '')}]
            })
        
        # Add current message
        contents.append({
            "role": "user",
            "parts": [{"text": user_message}]
        })

        # Use gemini-2.5-flash-lite
        model_name = "gemini-2.5-flash-lite"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        
        headers = {'Content-Type': 'application/json'}
        payload = {
            "system_instruction": {
                "parts": [{
                    "text": "You are a specialized Hedge Fund Analysis Assistant. Your sole purpose is to assist users with financial analysis, stock market data, hedge fund strategies, and navigating this application. \n\nRESTRICTIONS:\n- You MUST politely REFUSE to answer any questions unrelated to finance, investing, economics, coding, or this application.\n- If asked about general topics (e.g., recipes, sports, entertainment), reply: 'I am designed only to assist with Hedge Fund Analysis and financial queries.'\n- Keep your responses professional, concise, and data-driven.\n- FORMATTING RULE: ALWAYS provide your answers in bullet points or numbered lists. Do NOT use long paragraphs."
                }]
            },
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 800
            }
        }

        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        if response.status_code != 200:
            print(f"Gemini API Error: {response.text}")
            return jsonify({'error': f"AI Provider Error: {response.status_code}", 'details': response.text}), 500
            
        result = response.json()
        if 'candidates' in result and result['candidates']:
            ai_text = result['candidates'][0]['content']['parts'][0]['text']
            return jsonify({'response': ai_text})
        else:
            return jsonify({'response': "I'm sorry, I couldn't generate a response."})

    except Exception as e:
        print(f"Chat Error: {e}")
        return jsonify({'error': str(e)}), 500
@chat_bp.route('/contact', methods=['POST'])
def contact_support():
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    try:
        data = request.json
        name = data.get('name')
        email = data.get('email')
        message = data.get('message')

        if not all([name, email, message]):
             return jsonify({'error': 'All fields are required'}), 400
        
        # Recipients
        recipients = ['himanshu_somani@ymail.com', 'kushagra.singh@hidevs.xyz']
        
        # Email Config
        smtp_server = os.getenv('SMTP_SERVER')
        smtp_port = int(os.getenv('SMTP_PORT', 587))
        smtp_username = os.getenv('SMTP_USERNAME')
        smtp_password = os.getenv('SMTP_PASSWORD')
        sender_email = os.getenv('SENDER_EMAIL')
        
        if not all([smtp_server, smtp_username, smtp_password]):
             print("SMTP not configured")
             return jsonify({'status': 'simulated', 'message': 'Email logged (SMTP not complete)'}), 200

        # Create Message
        msg = MIMEMultipart()
        msg['From'] = f"{name} <{sender_email}>"
        msg['To'] = ", ".join(recipients)
        msg['Reply-To'] = email
        msg['Subject'] = f"Support Request from {name}"

        body = f"""
        New Support Request:

        Name: {name}
        Email: {email}

        Message:
        {message}
        """
        msg.attach(MIMEText(body, 'plain'))

        # Send
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(msg)
            
        print(f"Support email sent to {recipients}")
        return jsonify({'status': 'sent', 'message': 'Support request sent successfully'})

    except Exception as e:
        print(f"Email Error: {e}")
        return jsonify({'error': str(e)}), 500
