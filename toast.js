export function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; top: 1rem; right: 1rem; z-index: 9999; display: flex; flex-direction: column; gap: 0.5rem; max-width: 90vw; width: 320px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    
    const types = {
        success: { color: '#10b981', icon: '✓', bg: '#ecfdf5', text: '#065f46' },
        error: { color: '#e11d48', icon: '✕', bg: '#fff1f2', text: '#9f1239' },
        warning: { color: '#f59e0b', icon: '⚠', bg: '#fffbeb', text: '#92400e' },
        info: { color: '#4f46e5', icon: 'ℹ', bg: '#eef2ff', text: '#3730a3' }
    };
    
    const config = types[type] || types.info;

    toast.style.cssText = `
        display: flex;
        align-items: flex-start;
        padding: 1rem;
        background-color: ${config.bg};
        border-left: 4px solid ${config.color};
        border-radius: 0.375rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        transform: translateX(110%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
        opacity: 0;
    `;

    toast.innerHTML = `
        <div style="flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 1.5rem; height: 1.5rem; border-radius: 9999px; background-color: ${config.color}; color: white; font-weight: bold; font-size: 0.875rem;">
            ${config.icon}
        </div>
        <div style="margin-left: 0.75rem; flex-grow: 1; min-width: 0;">
            <p style="margin: 0; font-size: 0.875rem; font-weight: 500; color: ${config.text}; line-height: 1.25rem;">
                ${message}
            </p>
        </div>
        <button style="flex-shrink: 0; margin-left: 1rem; background: transparent; border: none; color: ${config.color}; cursor: pointer; padding: 0.25rem; display: flex; align-items: center; justify-content: center; border-radius: 0.25rem; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='rgba(0,0,0,0.05)'" onmouseout="this.style.backgroundColor='transparent'">
            <svg style="width: 1rem; height: 1rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
    `;

    container.appendChild(toast);

    const closeBtn = toast.querySelector('button');

    const removeToast = () => {
        toast.style.transform = 'translateX(110%)';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    };

    closeBtn.addEventListener('click', removeToast);
    setTimeout(removeToast, 4000);

    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    });
}
