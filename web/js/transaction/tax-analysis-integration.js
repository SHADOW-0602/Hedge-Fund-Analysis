// Tax Analysis Integration - Ensures proper loading and display
// This file bridges the gap between analytics manager and tax analysis module

// Global tax analysis functions for analytics manager integration
window.toggleTaxSettings = () => {
    const settings = document.getElementById('taxSettings');
    if (settings) {
        settings.classList.toggle('hidden');
    }
};

window.updateTaxAnalysis = () => {
    // Update options from form
    const currentTaxOptions = {
        tax_year: document.getElementById('taxYear')?.value || 'Current',
        holding_period: document.getElementById('holdingPeriod')?.value || 'All',
        tax_rate: document.getElementById('taxRate')?.value || 'Federal',
        wash_sale: document.getElementById('washSale')?.value || 'Include',
        harvesting: document.getElementById('harvesting')?.value || 'Opportunities'
    };
    
    // Store updated options
    if (window.loadTaxAnalysis && window.currentTaxTransactions) {
        // Update the global options
        window.currentTaxOptions = currentTaxOptions;
        // Reload with new settings
        window.loadTaxAnalysis(window.currentTaxTransactions);
    }
};

window.refreshTaxAnalysis = () => {
    if (window.loadTaxAnalysis && window.currentTaxTransactions) {
        window.loadTaxAnalysis(window.currentTaxTransactions);
    } else {
        console.error('Tax analysis refresh failed: missing data or function');
    }
};

// Ensure tax analysis is properly loaded when called from analytics manager
document.addEventListener('DOMContentLoaded', () => {
    // Check if tax analysis module is loaded
    if (!window.loadTaxAnalysis) {
        console.warn('Tax analysis module not loaded, attempting to load...');
        
        // Try to load the tax analysis script if not already loaded
        const script = document.createElement('script');
        script.src = '/js/transaction/tax-analysis.js';
        script.onload = () => {
            console.log('Tax analysis module loaded successfully');
        };
        script.onerror = () => {
            console.error('Failed to load tax analysis module');
        };
        document.head.appendChild(script);
    }
});

// Export functions for global access
window.taxAnalysisIntegration = {
    toggleSettings: window.toggleTaxSettings,
    updateAnalysis: window.updateTaxAnalysis,
    refreshAnalysis: window.refreshTaxAnalysis
};