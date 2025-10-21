import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime
from pathlib import Path
from .config import Config

logger = logging.getLogger(__name__)

class EmailService:
    """Comprehensive email service for notifications and alerts"""
    
    def __init__(self):
        self.enabled = Config.EMAIL_ENABLED
        self.from_name = Config.EMAIL_FROM_NAME
        
        if self.enabled:
            self.smtp_server = Config.SMTP_SERVER
            self.smtp_port = Config.SMTP_PORT
            self.username = Config.SMTP_USERNAME
            self.password = Config.SMTP_PASSWORD
            self.use_tls = Config.SMTP_USE_TLS
            logger.info(f"Email service enabled - {self.smtp_server}:{self.smtp_port}")
        else:
            logger.info("Email service disabled - SMTP configuration not provided")
    
    def _create_message(self, to_emails: List[str], subject: str, body: str, 
                       html_body: Optional[str] = None, attachments: Optional[List[str]] = None) -> MIMEMultipart:
        """Create email message with optional HTML and attachments"""
        msg = MIMEMultipart('mixed')
        msg['From'] = f"{self.from_name} <{self.username}>"
        msg['To'] = ', '.join(to_emails)
        msg['Subject'] = subject
        msg['Date'] = datetime.now().strftime('%a, %d %b %Y %H:%M:%S %z')
        
        # Create alternative container for text/html
        msg_alternative = MIMEMultipart('alternative')
        
        # Add text part
        text_part = MIMEText(body, 'plain', 'utf-8')
        msg_alternative.attach(text_part)
        
        # Add HTML part if provided
        if html_body:
            html_part = MIMEText(html_body, 'html', 'utf-8')
            msg_alternative.attach(html_part)
        
        msg.attach(msg_alternative)
        
        # Add attachments if provided
        if attachments:
            for file_path in attachments:
                if Path(file_path).exists():
                    with open(file_path, 'rb') as attachment:
                        part = MIMEBase('application', 'octet-stream')
                        part.set_payload(attachment.read())
                    
                    encoders.encode_base64(part)
                    part.add_header(
                        'Content-Disposition',
                        f'attachment; filename= {Path(file_path).name}'
                    )
                    msg.attach(part)
        
        return msg
    
    def send_email(self, to_emails: List[str], subject: str, body: str, 
                   html_body: Optional[str] = None, attachments: Optional[List[str]] = None) -> bool:
        """Send email with optional HTML content and attachments"""
        if not self.enabled:
            logger.info(f"[MOCK EMAIL] To: {to_emails}")
            logger.info(f"[MOCK EMAIL] Subject: {subject}")
            logger.info(f"[MOCK EMAIL] Body: {body[:200]}...")
            return True
        
        try:
            msg = self._create_message(to_emails, subject, body, html_body, attachments)
            
            # Create secure connection and send
            context = ssl.create_default_context()
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                if self.use_tls:
                    server.starttls(context=context)
                server.login(self.username, self.password)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {len(to_emails)} recipients")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False
    
    def send_welcome_email(self, user_email: str, username: str, temp_password: Optional[str] = None) -> bool:
        """Send welcome email to new user"""
        subject = f"Welcome to {self.from_name}"
        
        body = f"""Hello {username},

Welcome to the Hedge Fund Analysis Platform! Your account has been created successfully.

Account Details:
- Username: {username}
- Email: {user_email}
{f'- Temporary Password: {temp_password}' if temp_password else ''}

You can now access the platform to:
• Analyze portfolio performance and risk metrics
• Scan for options trading opportunities
• Generate comprehensive reports
• Monitor real-time market data
• Collaborate with your team

{f'Please log in and change your temporary password immediately.' if temp_password else ''}

If you have any questions, please contact our support team.

Best regards,
The {self.from_name} Team"""
        
        html_body = f"""<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .header {{ background: #2c3e50; color: white; padding: 20px; text-align: center; }}
        .content {{ padding: 20px; }}
        .highlight {{ background: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; margin: 15px 0; }}
        .footer {{ background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to {self.from_name}</h1>
    </div>
    <div class="content">
        <h2>Hello {username},</h2>
        <p>Welcome to the Hedge Fund Analysis Platform! Your account has been created successfully.</p>
        
        <div class="highlight">
            <h3>Account Details:</h3>
            <ul>
                <li><strong>Username:</strong> {username}</li>
                <li><strong>Email:</strong> {user_email}</li>
                {f'<li><strong>Temporary Password:</strong> {temp_password}</li>' if temp_password else ''}
            </ul>
        </div>
        
        <h3>Platform Features:</h3>
        <ul>
            <li>📊 Analyze portfolio performance and risk metrics</li>
            <li>📈 Scan for options trading opportunities</li>
            <li>📋 Generate comprehensive reports</li>
            <li>📡 Monitor real-time market data</li>
            <li>👥 Collaborate with your team</li>
        </ul>
        
        {f'<p><strong>Important:</strong> Please log in and change your temporary password immediately.</p>' if temp_password else ''}
    </div>
    <div class="footer">
        <p>If you have any questions, please contact our support team.</p>
        <p>Best regards,<br>The {self.from_name} Team</p>
    </div>
</body>
</html>"""
        
        return self.send_email([user_email], subject, body, html_body)
    
    def send_risk_alert(self, user_emails: List[str], portfolio_name: str, 
                       risk_metrics: Dict[str, Any], threshold_breached: str) -> bool:
        """Send risk alert email with detailed metrics"""
        subject = f"🚨 Risk Alert: {portfolio_name} - {threshold_breached} Threshold Breached"
        
        var_95 = risk_metrics.get('var_95', 'N/A')
        cvar_95 = risk_metrics.get('cvar_95', 'N/A')
        volatility = risk_metrics.get('volatility', 'N/A')
        
        body = f"""RISK ALERT NOTIFICATION

Portfolio: {portfolio_name}
Alert Type: {threshold_breached} Risk Threshold Breached
Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Current Risk Metrics:
• Value at Risk (95%): {var_95}
• Conditional VaR (95%): {cvar_95}
• Portfolio Volatility: {volatility}

Recommended Actions:
1. Review current positions and exposure
2. Consider rebalancing high-risk positions
3. Implement hedging strategies if appropriate
4. Monitor market conditions closely

Please log into the platform to review detailed analytics and take appropriate action.

This is an automated alert from the Risk Management System."""
        
        return self.send_email(user_emails, subject, body)
    
    def send_portfolio_report(self, user_email: str, portfolio_name: str, 
                            report_data: Dict[str, Any], report_file: Optional[str] = None) -> bool:
        """Send portfolio performance report"""
        subject = f"Portfolio Report: {portfolio_name} - {datetime.now().strftime('%Y-%m-%d')}"
        
        total_value = report_data.get('total_value', 'N/A')
        total_return = report_data.get('total_return', 'N/A')
        sharpe_ratio = report_data.get('sharpe_ratio', 'N/A')
        
        body = f"""Portfolio Performance Report

Portfolio: {portfolio_name}
Report Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Performance Summary:
• Total Portfolio Value: {total_value}
• Total Return: {total_return}
• Sharpe Ratio: {sharpe_ratio}

This report contains detailed analytics including:
- Position-level performance
- Risk metrics and attribution
- Sector and geographic allocation
- Benchmark comparison

{f'Please find the detailed report attached.' if report_file else 'Access the full report in the platform dashboard.'}

Best regards,
Portfolio Analytics Team"""
        
        attachments = [report_file] if report_file else None
        return self.send_email([user_email], subject, body, attachments=attachments)
    
    def send_system_notification(self, admin_emails: List[str], notification_type: str, 
                               message: str, details: Optional[Dict] = None) -> bool:
        """Send system notification to administrators"""
        subject = f"System Notification: {notification_type}"
        
        body = f"""System Notification

Type: {notification_type}
Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Message: {message}

{f'Details: {details}' if details else ''}

This is an automated system notification."""
        
        return self.send_email(admin_emails, subject, body)
    
    def send_password_reset(self, user_email: str, username: str, reset_token: str, 
                          reset_url: str) -> bool:
        """Send password reset email"""
        subject = "Password Reset Request"
        
        body = f"""Password Reset Request

Hello {username},

We received a request to reset your password for your {self.from_name} account.

To reset your password, click the link below or copy and paste it into your browser:
{reset_url}?token={reset_token}

This link will expire in 1 hour for security reasons.

If you did not request this password reset, please ignore this email or contact support if you have concerns.

Best regards,
The {self.from_name} Team"""
        
        return self.send_email([user_email], subject, body)
    
    def test_connection(self) -> Dict[str, Any]:
        """Test email service connection"""
        if not self.enabled:
            return {'status': 'disabled', 'message': 'Email service is disabled'}
        
        try:
            context = ssl.create_default_context()
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                if self.use_tls:
                    server.starttls(context=context)
                server.login(self.username, self.password)
            
            return {'status': 'success', 'message': 'Email service connection successful'}
            
        except Exception as e:
            return {'status': 'error', 'message': f'Connection failed: {str(e)}'}
    
    def get_service_status(self) -> Dict[str, Any]:
        """Get email service status and configuration"""
        return {
            'enabled': self.enabled,
            'smtp_server': self.smtp_server if self.enabled else None,
            'smtp_port': self.smtp_port if self.enabled else None,
            'username': self.username if self.enabled else None,
            'use_tls': self.use_tls if self.enabled else None,
            'from_name': self.from_name
        }

# Global email service instance
email_service = EmailService()