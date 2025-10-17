import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List
import logging
from .config import Config

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.enabled = Config.EMAIL_ENABLED
        if self.enabled:
            self.smtp_server = Config.SMTP_SERVER
            self.smtp_port = Config.SMTP_PORT
            self.username = Config.SMTP_USERNAME
            self.password = Config.SMTP_PASSWORD
        else:
            logger.info("Email service disabled - SMTP configuration not provided")
    
    def send_email(self, to_emails: List[str], subject: str, body: str, 
                   html_body: Optional[str] = None) -> bool:
        """Send email if configured, otherwise log the message"""
        if not self.enabled:
            logger.info(f"Email would be sent to {to_emails}: {subject}")
            logger.info(f"Body: {body}")
            return True
        
        try:
            msg = MIMEMultipart('alternative')
            msg['From'] = self.username
            msg['To'] = ', '.join(to_emails)
            msg['Subject'] = subject
            
            # Add text part
            text_part = MIMEText(body, 'plain')
            msg.attach(text_part)
            
            # Add HTML part if provided
            if html_body:
                html_part = MIMEText(html_body, 'html')
                msg.attach(html_part)
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.username, self.password)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to_emails}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False
    
    def send_welcome_email(self, user_email: str, username: str) -> bool:
        """Send welcome email to new user"""
        subject = "Welcome to Hedge Fund Analysis Platform"
        body = f"""
        Hello {username},
        
        Welcome to the Hedge Fund Analysis Platform! Your account has been created successfully.
        
        You can now access the platform and start analyzing portfolios, managing risk, and generating reports.
        
        Best regards,
        Hedge Fund Analysis Team
        """
        
        return self.send_email([user_email], subject, body)
    
    def send_alert_email(self, user_emails: List[str], alert_type: str, message: str) -> bool:
        """Send alert email to users"""
        subject = f"Alert: {alert_type}"
        body = f"""
        Alert Notification
        
        Type: {alert_type}
        Message: {message}
        
        Please review your portfolio and take appropriate action if needed.
        
        Best regards,
        Risk Management System
        """
        
        return self.send_email(user_emails, subject, body)

# Global email service instance
email_service = EmailService()