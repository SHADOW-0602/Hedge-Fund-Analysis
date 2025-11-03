// Global API Configuration
window.API_BASE = window.API_BASE || 'http://127.0.0.1:8080';

// Ensure API_BASE is available globally before other modules load
if (typeof API_BASE === 'undefined') {
    window.API_BASE = 'http://127.0.0.1:8080';
}

console.log('Global API_BASE configured:', window.API_BASE);