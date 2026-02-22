// Global API Configuration - Auto-detects environment
(function () {
    // Detect environment based on hostname
    const hostname = window.location.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // Local development
        window.API_BASE = 'http://127.0.0.1:8080';
    } else if (hostname === 'shmventures.org' || hostname === 'www.shmventures.org' || hostname === 'old.shmventures.org') {
        // Production on Northflank
        window.API_BASE = 'https://old.shmventures.org';
    } else {
        // Fallback to current origin
        window.API_BASE = window.location.origin;
    }

    console.log(`[API CONFIG] Environment detected: ${hostname}`);
    console.log(`[API CONFIG] API_BASE set to: ${window.API_BASE}`);
})();