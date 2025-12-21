import os
import requests
from flask import Blueprint, request, jsonify
from dotenv import load_dotenv

load_dotenv()

chat_bp = Blueprint('chat', __name__, url_prefix='/api/chat')

import random

@chat_bp.route('', methods=['POST'])
def chat():
    api_key = os.getenv('GROQ_API_KEY')
    if not api_key:
        return jsonify({'error': 'Chat system not configured (missing GROQ_API_KEY)'}), 503

    try:
        data = request.json
        user_message = data.get('message', '')
        history = data.get('history', [])

        if not user_message:
            return jsonify({'error': 'Message is required'}), 400

        # Construct messages for Groq/OpenAI compatible API
        # API requires: [{"role": "user", "content": "msg"}, ...]
        messages = []
        
        # Add System Prompt
        messages.append({
            "role": "system", 
            "content": "You are a specialized Hedge Fund Analysis Assistant. Your sole purpose is to assist users with financial analysis, stock market data, hedge fund strategies, and navigating this application. \n\nRESTRICTIONS:\n- You MUST politely REFUSE to answer any questions unrelated to finance, investing, economics, coding, or this application.\n- If asked about general topics (e.g., recipes, sports, entertainment), reply: 'I am designed only to assist with Hedge Fund Analysis and financial queries.'\n- Keep your responses professional, concise, and data-driven.\n- FORMATTING RULE: ALWAYS provide your answers in bullet points or numbered lists. Do NOT use long paragraphs."
        })

        for msg in history:
            # Map frontend 'sender' to API 'role'
            role = 'user' if msg.get('sender') == 'user' else 'assistant'
            messages.append({
                "role": role,
                "content": msg.get('text', '')
            })
        
        # Add current message
        messages.append({
            "role": "user",
            "content": user_message
        })

        # Use Groq API
        url = "https://api.groq.com/openai/v1/chat/completions"
        model_name = "llama-3.3-70b-versatile"
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }
        
        payload = {
            "model": model_name,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 800
        }

        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        if response.status_code != 200:
            print(f"Groq API Error: {response.text}")
            return jsonify({'error': f"AI Provider Error: {response.status_code}", 'details': response.text}), 500
            
        result = response.json()
        if 'choices' in result and result['choices']:
            ai_text = result['choices'][0]['message']['content']
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
