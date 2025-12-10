// Notification System
function showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notificationContainer');
    if (!container) {
        // Create it if it doesn't exist
        const newContainer = document.createElement('div');
        newContainer.id = 'notificationContainer';
        document.body.appendChild(newContainer);
        // Fallback or retry
        // But typically we expect it to exist.
    }

    const notification = document.createElement('div');
    // Using Tailwind classes for base styling + custom animation classes
    // We assume .notification class is styled in CSS for colors, but layout via flex/tailwind
    notification.className = `notification ${type} flex items-center p-4 mb-2 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full opacity-0`;
    notification.style.minWidth = '300px';

    // Icons based on type
    let icon = '';
    if (type === 'success') icon = '<svg class="w-6 h-6 mr-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
    else if (type === 'error') icon = '<svg class="w-6 h-6 mr-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    else icon = '<svg class="w-6 h-6 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';

    notification.innerHTML = `
        ${icon}
        <div class="text-sm font-medium flex-1">${message}</div>
    `;

    // Append to container (if null, we try to fetch again, ideally defined in HTML)
    const validContainer = document.getElementById('notificationContainer') || (() => {
        const d = document.createElement('div');
        d.id = 'notificationContainer';
        document.body.appendChild(d);
        return d;
    })();

    validContainer.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
        notification.classList.remove('translate-x-full', 'opacity-0');
    });

    // Remove
    setTimeout(() => {
        notification.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => {
            if (notification.parentElement) notification.parentElement.removeChild(notification);
        }, 300);
    }, duration);
}

// Make it global
window.showNotification = showNotification;
window.showToast = showNotification; // Alias
