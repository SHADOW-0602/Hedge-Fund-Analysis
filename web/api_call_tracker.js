// API Call Tracker - Minimal implementation
class APICallTracker {
    constructor() {
        this.calls = [];
    }

    track(endpoint, method = 'GET', status = 200) {
        this.calls.push({
            endpoint,
            method,
            status,
            timestamp: new Date()
        });
    }

    getCalls() {
        return this.calls;
    }

    clear() {
        this.calls = [];
    }
}

// Global instance
window.apiCallTracker = new APICallTracker();