import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import json
from dataclasses import dataclass, asdict

@dataclass
class RegulatoryReport:
    report_id: str
    report_type: str
    period_start: datetime
    period_end: datetime
    fund_name: str
    aum: float
    performance_metrics: Dict
    risk_metrics: Dict
    positions: List[Dict]
    generated_at: datetime

class ComplianceReporter:
    def __init__(self, fund_name: str = "Hedge Fund"):
        self.fund_name = fund_name
        self.audit_trail = []
    
    def generate_regulatory_report(self, portfolio_data: Dict, risk_data: Dict, 
                                 report_type: str = "MONTHLY") -> RegulatoryReport:
        """Generate automated regulatory reporting"""
        
        report_id = f"{report_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        performance_metrics = {
            'total_return': portfolio_data.get('total_return_pct', 0),
            'sharpe_ratio': risk_data.get('sharpe_ratio', 0),
            'max_drawdown': risk_data.get('max_drawdown', 0),
            'volatility': risk_data.get('portfolio_volatility', 0),
            'var_5': risk_data.get('var_5', 0),
            'beta': risk_data.get('beta', 0)
        }
        
        risk_metrics = {
            'concentration_risk': self._assess_concentration_risk(portfolio_data),
            'liquidity_risk': self._assess_liquidity_risk(portfolio_data),
            'leverage_ratio': self._calculate_leverage_ratio(portfolio_data),
            'compliance_breaches': self._check_compliance_breaches(portfolio_data, risk_data)
        }
        
        positions = self._format_positions_for_reporting(portfolio_data.get('positions', {}))
        
        report = RegulatoryReport(
            report_id=report_id,
            report_type=report_type,
            period_start=datetime.now() - timedelta(days=30),
            period_end=datetime.now(),
            fund_name=self.fund_name,
            aum=portfolio_data.get('total_market_value', 0),
            performance_metrics=performance_metrics,
            risk_metrics=risk_metrics,
            positions=positions,
            generated_at=datetime.now()
        )
        
        self._log_audit_event("REGULATORY_REPORT_GENERATED", {
            'report_id': report_id,
            'report_type': report_type,
            'aum': report.aum
        })
        
        return report
    
    def generate_client_report(self, client_id: str, portfolio_data: Dict, 
                             performance_data: Dict) -> Dict:
        """Generate professional client performance reports"""
        
        report_data = {
            'client_id': client_id,
            'report_date': datetime.now(),
            'fund_name': self.fund_name,
            'executive_summary': self._create_executive_summary(portfolio_data, performance_data),
            'performance_analysis': self._create_performance_analysis(performance_data),
            'risk_analysis': self._create_risk_analysis(portfolio_data),
            'portfolio_composition': self._create_portfolio_composition(portfolio_data)
        }
        
        self._log_audit_event("CLIENT_REPORT_GENERATED", {
            'client_id': client_id,
            'report_date': datetime.now().isoformat()
        })
        
        return report_data
    
    def create_audit_trail(self, event_type: str, details: Dict, user_id: str = "system"):
        """Create complete audit trail for all activities"""
        
        audit_entry = {
            'timestamp': datetime.now(),
            'event_type': event_type,
            'user_id': user_id,
            'details': details,
            'session_id': f"session_{datetime.now().timestamp()}"
        }
        
        self.audit_trail.append(audit_entry)
        return audit_entry
    
    def export_audit_trail(self, start_date: datetime, end_date: datetime) -> pd.DataFrame:
        """Export audit trail for compliance review"""
        
        filtered_trail = [
            entry for entry in self.audit_trail
            if start_date <= entry['timestamp'] <= end_date
        ]
        
        df = pd.DataFrame(filtered_trail)
        
        if not df.empty:
            df['compliance_flag'] = df['event_type'].apply(self._flag_compliance_events)
            df['risk_level'] = df['event_type'].apply(self._assess_risk_level)
        
        return df
    
    def _assess_concentration_risk(self, portfolio_data: Dict) -> str:
        """Assess portfolio concentration risk"""
        positions = portfolio_data.get('positions', {})
        if not positions:
            return "LOW"
        
        max_weight = max(pos.get('weight', 0) for pos in positions.values())
        
        if max_weight > 0.25:
            return "HIGH"
        elif max_weight > 0.15:
            return "MEDIUM"
        else:
            return "LOW"
    
    def _assess_liquidity_risk(self, portfolio_data: Dict) -> str:
        """Assess portfolio liquidity risk"""
        positions = portfolio_data.get('positions', {})
        if len(positions) < 5:
            return "HIGH"
        elif len(positions) < 15:
            return "MEDIUM"
        else:
            return "LOW"
    
    def _calculate_leverage_ratio(self, portfolio_data: Dict) -> float:
        """Calculate portfolio leverage ratio"""
        total_exposure = portfolio_data.get('total_market_value', 0)
        cash = portfolio_data.get('cash', total_exposure)
        
        if cash > 0:
            return total_exposure / cash
        else:
            return 1.0
    
    def _check_compliance_breaches(self, portfolio_data: Dict, risk_data: Dict) -> List[Dict]:
        """Check for regulatory compliance breaches"""
        breaches = []
        
        positions = portfolio_data.get('positions', {})
        for symbol, position in positions.items():
            weight = position.get('weight', 0)
            if weight > 0.20:
                breaches.append({
                    'type': 'CONCENTRATION_BREACH',
                    'symbol': symbol,
                    'weight': weight,
                    'limit': 0.20,
                    'severity': 'HIGH'
                })
        
        var_5 = risk_data.get('var_5', 0)
        if abs(var_5) > 0.05:
            breaches.append({
                'type': 'VAR_BREACH',
                'current_var': var_5,
                'limit': -0.05,
                'severity': 'MEDIUM'
            })
        
        return breaches
    
    def _format_positions_for_reporting(self, positions: Dict) -> List[Dict]:
        """Format positions for regulatory reporting"""
        formatted_positions = []
        
        for symbol, position in positions.items():
            formatted_positions.append({
                'symbol': symbol,
                'quantity': position.get('quantity', 0),
                'market_value': position.get('market_value', 0),
                'weight': position.get('weight', 0),
                'sector': 'Technology',
                'country': 'US',
                'currency': 'USD'
            })
        
        return formatted_positions
    
    def _create_executive_summary(self, portfolio_data: Dict, performance_data: Dict) -> Dict:
        """Create executive summary for client reports"""
        return {
            'period_return': performance_data.get('total_return_pct', 0),
            'benchmark_comparison': performance_data.get('excess_return', 0),
            'key_highlights': [
                f"Portfolio returned {performance_data.get('total_return_pct', 0):.2%} for the period",
                f"Maintained {self._assess_concentration_risk(portfolio_data).lower()} concentration risk"
            ]
        }
    
    def _create_performance_analysis(self, performance_data: Dict) -> Dict:
        """Create detailed performance analysis"""
        return {
            'returns_analysis': {
                'total_return': performance_data.get('total_return_pct', 0),
                'sharpe_ratio': performance_data.get('sharpe_ratio', 0),
                'max_drawdown': performance_data.get('max_drawdown', 0)
            },
            'benchmark_comparison': {
                'excess_return': performance_data.get('excess_return', 0),
                'tracking_error': performance_data.get('tracking_error', 0)
            }
        }
    
    def _create_risk_analysis(self, portfolio_data: Dict) -> Dict:
        """Create risk analysis section"""
        return {
            'var_analysis': {
                'var_5': portfolio_data.get('var_5', 0),
                'cvar_5': portfolio_data.get('cvar_5', 0)
            },
            'concentration_analysis': {
                'max_weight': portfolio_data.get('max_weight', 0),
                'effective_positions': portfolio_data.get('effective_positions', 0)
            }
        }
    
    def _create_portfolio_composition(self, portfolio_data: Dict) -> Dict:
        """Create portfolio composition analysis"""
        positions = portfolio_data.get('positions', {})
        
        return {
            'top_holdings': list(positions.items())[:10],
            'sector_allocation': {'Technology': 0.6, 'Healthcare': 0.2, 'Finance': 0.2},
            'geographic_allocation': {'US': 0.8, 'International': 0.2}
        }
    
    def _log_audit_event(self, event_type: str, details: Dict):
        """Log audit event"""
        self.create_audit_trail(event_type, details)
    
    def _flag_compliance_events(self, event_type: str) -> bool:
        """Flag events that require compliance review"""
        compliance_events = [
            'LARGE_TRADE', 'POSITION_LIMIT_BREACH', 'VAR_BREACH',
            'REGULATORY_REPORT_GENERATED', 'CLIENT_REPORT_GENERATED'
        ]
        return event_type in compliance_events
    
    def _assess_risk_level(self, event_type: str) -> str:
        """Assess risk level of audit events"""
        high_risk = ['POSITION_LIMIT_BREACH', 'VAR_BREACH', 'COMPLIANCE_VIOLATION']
        medium_risk = ['LARGE_TRADE', 'SYSTEM_ERROR']
        
        if event_type in high_risk:
            return 'HIGH'
        elif event_type in medium_risk:
            return 'MEDIUM'
        else:
            return 'LOW'