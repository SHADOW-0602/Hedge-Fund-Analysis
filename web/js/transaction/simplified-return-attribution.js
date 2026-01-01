// Simplified Return Attribution - Uses real API data

// Initialize settings from localStorage
if (window.analyticsCore) {
    try {
        const saved = localStorage.getItem('returnAttributionSettings');
        if (saved) {
            window.analyticsCore.returnAttributionSettings = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load return attribution settings:', e);
    }
}

window.loadReturnAttribution = function (transactions, containerId = 'returnAttribution') {
    // Ensure settings are loaded if analyticsCore wasn't ready earlier
    if (window.analyticsCore && !window.analyticsCore.returnAttributionSettings) {
        try {
            const saved = localStorage.getItem('returnAttributionSettings');
            if (saved) {
                window.analyticsCore.returnAttributionSettings = JSON.parse(saved);
            }
        } catch (e) {
            // Ignore error
        }
    }

    if (window.analyticsManager) {
        window.analyticsManager.loadModule('return-attribution');
    }
};

// Keep existing functions for backward compatibility
window.toggleReturnAttributionSettings = () => {
    const settings = document.getElementById('returnAttributionSettings');
    if (settings) settings.classList.toggle('hidden');
};

window.updateReturnAttribution = () => {
    // Capture values from DOM
    const settings = {
        period: document.getElementById('returnPeriod')?.value || '1Y',
        attribution_model: document.getElementById('returnModel')?.value || 'brinson',
        benchmark: document.getElementById('returnBenchmark')?.value || 'SPY',
        currency: document.getElementById('returnCurrency')?.value || 'USD',
        frequency: document.getElementById('returnFrequency')?.value || 'daily'
    };

    // Save to analyticsCore and localStorage
    if (window.analyticsCore) {
        window.analyticsCore.returnAttributionSettings = settings;
    }
    localStorage.setItem('returnAttributionSettings', JSON.stringify(settings));

    // Reload module
    if (window.analyticsManager) {
        window.analyticsManager.loadModule('return-attribution');
    }
};

window.refreshReturnAttribution = () => {
    if (window.analyticsManager) {
        window.analyticsManager.loadModule('return-attribution');
    }
};