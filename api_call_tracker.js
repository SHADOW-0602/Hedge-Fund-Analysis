// API Call Tracker - Shows real-time API calls vs cached data
let apiCallLog = [];
let displayUpdateLog = [];

// Create visual indicator panel
function createApiTracker() {
    const tracker = document.createElement('div');
    tracker.id = 'apiTracker';
    tracker.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 300px;
        max-height: 400px;
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-size: 12px;
        z-index: 9999;
        overflow-y: auto;
    `;
    tracker.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;">
            API Call Tracker
            <button onclick="clearApiLog()" style="float: right; font-size: 10px;">Clear</button>
        </div>
        <div id="apiLogContent"></div>
    `;
    document.body.appendChild(tracker);
}

// Log API calls
function logApiCall(url, data, source = 'API') {
    const timestamp = new Date().toLocaleTimeString();
    const entry = {
        time: timestamp,
        url: url.split('/api/')[1] || url,
        source: source,
        data: data
    };
    
    apiCallLog.unshift(entry);
    if (apiCallLog.length > 20) apiCallLog.pop();
    
    updateApiDisplay();
}

// Log display updates
function logDisplayUpdate(component, values, source = 'Frontend') {
    const timestamp = new Date().toLocaleTimeString();
    const entry = {
        time: timestamp,
        component: component,
        values: values,
        source: source
    };
    
    displayUpdateLog.unshift(entry);
    if (displayUpdateLog.length > 15) displayUpdateLog.pop();
    
    updateApiDisplay();
}

// Update tracker display
function updateApiDisplay() {
    const content = document.getElementById('apiLogContent');
    if (!content) return;
    
    let html = '<div style="color: #4CAF50; font-weight: bold;">🔄 API CALLS:</div>';
    apiCallLog.slice(0, 8).forEach(entry => {
        const color = entry.source === 'API' ? '#4CAF50' : '#FF9800';
        html += `<div style="color: ${color}; margin: 2px 0;">${entry.time} - ${entry.url}</div>`;
    });
    
    html += '<div style="color: #2196F3; font-weight: bold; margin-top: 10px;">📊 DISPLAY UPDATES:</div>';
    displayUpdateLog.slice(0, 6).forEach(entry => {
        const color = entry.source === 'API' ? '#2196F3' : '#F44336';
        html += `<div style="color: ${color}; margin: 2px 0;">${entry.time} - ${entry.component}</div>`;
    });
    
    content.innerHTML = html;
}

// Clear log
function clearApiLog() {
    apiCallLog = [];
    displayUpdateLog = [];
    updateApiDisplay();
}

// Override fetch to track API calls
const originalFetch = window.fetch;
window.fetch = function(url, options) {
    console.log('🔄 API CALL:', url);
    logApiCall(url, options, 'API');
    
    return originalFetch.apply(this, arguments).then(response => {
        const clonedResponse = response.clone();
        clonedResponse.json().then(data => {
            console.log('✅ API RESPONSE:', url, data);
            logApiCall(url + ' (response)', data, 'API');
        }).catch(() => {});
        return response;
    });
};

// Override display functions to track updates
const originalUpdateTopMetrics = window.updateTopMetrics;
window.updateTopMetrics = function(metrics) {
    console.log('📊 DISPLAY UPDATE: Top Metrics', metrics);
    logDisplayUpdate('Top Metrics', {
        sharpe: metrics.sharpe_ratio,
        beta: metrics.beta
    }, 'API');
    
    if (originalUpdateTopMetrics) {
        originalUpdateTopMetrics(metrics);
    }
};

const originalUpdateOptionsResults = window.updateOptionsResults;
window.updateOptionsResults = function(opportunities, summary) {
    console.log('📊 DISPLAY UPDATE: Options', summary);
    logDisplayUpdate('Options', {
        cc: summary?.covered_calls?.total_premium || 0,
        pp: summary?.protective_puts?.total_cost || 0
    }, 'API');
    
    if (originalUpdateOptionsResults) {
        originalUpdateOptionsResults(opportunities, summary);
    }
};

// Initialize tracker on load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(createApiTracker, 1000);
});

// Add timestamp to all API calls
const addTimestamp = () => {
    const elements = document.querySelectorAll('[id*="Results"], [id*="Analysis"], [id*="Metrics"]');
    elements.forEach(el => {
        if (el.innerHTML && !el.innerHTML.includes('Last updated:')) {
            el.innerHTML += `<div style="font-size: 10px; color: #666; margin-top: 5px;">Last updated: ${new Date().toLocaleTimeString()}</div>`;
        }
    });
};

// Run timestamp update every 5 seconds
setInterval(addTimestamp, 5000);