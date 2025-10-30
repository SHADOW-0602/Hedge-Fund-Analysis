// Cookie and Cache Management Utilities

class CookieManager {
    static set(name, value, days = 30) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${JSON.stringify(value)};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
    }

    static get(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) {
                try {
                    return JSON.parse(c.substring(nameEQ.length, c.length));
                } catch (e) {
                    return c.substring(nameEQ.length, c.length);
                }
            }
        }
        return null;
    }

    static delete(name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
    }
}

class ProgressManager {
    static saveProgress(key, data) {
        const progress = this.getProgress();
        progress[key] = {
            data: data,
            timestamp: Date.now(),
            userId: this.getCurrentUserId()
        };
        CookieManager.set('userProgress', progress, 7);
        this.cacheToRedis(key, data);
    }

    static getProgress(key = null) {
        const progress = CookieManager.get('userProgress') || {};
        return key ? progress[key] : progress;
    }

    static clearProgress(key = null) {
        if (key) {
            const progress = this.getProgress();
            delete progress[key];
            CookieManager.set('userProgress', progress, 7);
        } else {
            CookieManager.delete('userProgress');
        }
    }

    static getCurrentUserId() {
        return CookieManager.get('currentUser')?.id || 'anonymous';
    }

    static async cacheToRedis(key, data) {
        try {
            const API_BASE = window.API_BASE || 'http://127.0.0.1:8080/api';
            await fetch(`${API_BASE}/cache`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: `progress_${this.getCurrentUserId()}_${key}`,
                    data: data,
                    ttl: 604800 // 7 days
                })
            });
        } catch (error) {
            console.warn('Redis cache failed:', error);
        }
    }
}

class ThemeManager {
    static init() {
        // Check for saved theme preference or default to 'light'
        const savedTheme = CookieManager.get('theme') || 
                          localStorage.getItem('theme') || 
                          'light';
        
        this.setTheme(savedTheme);
        this.setupThemeToggle();
    }

    static setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Save to both cookie and localStorage for redundancy
        CookieManager.set('theme', theme, 365);
        localStorage.setItem('theme', theme);
        
        // Update checkbox theme toggles
        const checkboxToggles = document.querySelectorAll('#themeToggle');
        checkboxToggles.forEach(toggle => {
            toggle.checked = theme === 'dark';
        });
        
        // Update old style theme toggles (if any)
        const toggles = document.querySelectorAll('.theme-toggle');
        toggles.forEach(toggle => {
            toggle.textContent = theme === 'light' ? '🌙' : '☀️';
        });

        // Dispatch theme change event
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
    }

    static toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    static setupThemeToggle() {
        // Handle checkbox toggles
        const checkboxToggles = document.querySelectorAll('#themeToggle');
        checkboxToggles.forEach(toggle => {
            toggle.addEventListener('change', () => {
                const newTheme = toggle.checked ? 'dark' : 'light';
                this.setTheme(newTheme);
            });
        });
        
        // Handle old style toggles
        const toggles = document.querySelectorAll('.theme-toggle');
        toggles.forEach(toggle => {
            toggle.addEventListener('click', () => this.toggleTheme());
        });
    }

    static getCurrentTheme() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }
}

class SessionManager {
    static saveSession(userData) {
        const sessionData = {
            ...userData,
            loginTime: Date.now(),
            theme: ThemeManager.getCurrentTheme()
        };
        
        CookieManager.set('currentUser', sessionData, 1);
        ProgressManager.saveProgress('lastLogin', { timestamp: Date.now() });
    }

    static getSession() {
        return CookieManager.get('currentUser');
    }

    static clearSession() {
        CookieManager.delete('currentUser');
        ProgressManager.clearProgress();
    }

    static isLoggedIn() {
        const session = this.getSession();
        if (!session) return false;
        
        // Check if session is expired (24 hours)
        const sessionAge = Date.now() - session.loginTime;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (sessionAge > maxAge) {
            this.clearSession();
            return false;
        }
        
        return true;
    }
}

// Auto-restore progress on page load
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    
    // Restore saved progress
    const savedProgress = ProgressManager.getProgress();
    if (savedProgress.portfolioData) {
        console.log('Restored portfolio data from cookies');
    }
    
    // Auto-save form data
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                const formData = new FormData(form);
                const data = Object.fromEntries(formData);
                ProgressManager.saveProgress(`form_${form.id}`, data);
            });
        });
    });
});

// Export for global use
window.CookieManager = CookieManager;
window.ProgressManager = ProgressManager;
window.ThemeManager = ThemeManager;
window.SessionManager = SessionManager;