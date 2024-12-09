// Debug: Log when file loads
console.log('[DEBUG] privacy-toggle.js loaded');

// Inject pageScript.js into the page
function injectScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('js/pageScript.js');
    script.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
    console.log('[PrivacyToggle] Injected pageScript.js');
}

class PrivacyToggle {
    constructor() {
        console.log('[DEBUG] PrivacyToggle constructor called');
        
        // Set initial state before anything else
        const savedState = localStorage.getItem('glifPrivateMode');
        // Convert string 'true'/'false' to boolean
        this.isPrivate = savedState === null ? true : savedState === 'true';
        
        // Force state to localStorage as string
        localStorage.setItem('glifPrivateMode', this.isPrivate.toString());
        
        // Update background script with initial state
        this.updateBackgroundState(this.isPrivate);
        
        // Inject our script as early as possible
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectScript);
        } else {
            injectScript();
        }
        
        this.init();
    }

    async updateBackgroundState(isPrivate) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'UPDATE_PRIVACY',
                isPrivate: isPrivate
            });
            console.log('[PrivacyToggle] Background update response:', response);
        } catch (e) {
            console.error('[PrivacyToggle] Failed to update background:', e);
        }
    }

    async init() {
        console.log('[DEBUG] PrivacyToggle init called');
        
        // Create and insert toggle button
        this.createToggleButton();
        
        // Start watching for toolbar
        this.watchForToolbar();
    }

    createToggleButton() {
        this.button = document.createElement('button');
        this.button.className = 'privacy-toggle-btn';
        this.button.dataset.private = this.isPrivate.toString();
        this.button.type = 'button'; // Prevent form submission
        
        this.updateButtonState();
        
        this.button.addEventListener('click', async (e) => {
            e.preventDefault(); // Prevent any default actions
            e.stopPropagation(); // Stop event bubbling
            
            this.isPrivate = !this.isPrivate;
            localStorage.setItem('glifPrivateMode', this.isPrivate.toString());
            await this.updateBackgroundState(this.isPrivate);
            this.button.dataset.private = this.isPrivate.toString();
            this.updateButtonState();
            
            // Force refresh state in pageScript
            window.dispatchEvent(new CustomEvent('privacyToggleChanged', { 
                detail: { isPrivate: this.isPrivate } 
            }));
        });
    }

    updateButtonState() {
        // Update text and icon
        this.button.innerHTML = `
            <span style="display: inline-flex; align-items: center; gap: 6px;">
                ${this.isPrivate ? GLIF_ICONS.lock : GLIF_ICONS.globe}
                <span>${this.isPrivate ? 'Private' : 'Public'}</span>
            </span>
        `;
        this.button.title = this.isPrivate ? 'Private Mode (Click to make public)' : 'Public Mode (Click to make private)';
        this.button.dataset.private = this.isPrivate.toString();
    }

    watchForToolbar() {
        const checkForToolbar = () => {
            // Look for the glif-tools-buttons container
            const toolsContainer = document.querySelector('.glif-tools-buttons');
            const existingButton = document.querySelector('.privacy-toggle-btn');
            
            if (toolsContainer && !existingButton) {
                // Create a container for the button
                const container = document.createElement('div');
                container.className = 'privacy-toggle-container';
                container.appendChild(this.button);
                
                // Add to the tools container
                toolsContainer.appendChild(container);
                
                // Force update button state after adding to DOM
                requestAnimationFrame(() => {
                    this.button.dataset.private = this.isPrivate.toString();
                    this.updateButtonState();
                });
            }
        };

        // Check immediately and then periodically
        checkForToolbar();
        const intervalId = setInterval(checkForToolbar, 1000);

        // Also check when DOM changes
        const observer = new MutationObserver((mutations) => {
            checkForToolbar();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Clean up interval and observer when needed
        const cleanup = () => {
            clearInterval(intervalId);
            observer.disconnect();
        };

        // Clean up after 30 seconds if button hasn't been added
        setTimeout(() => {
            if (!document.querySelector('.privacy-toggle-btn')) {
                cleanup();
            }
        }, 30000);
    }
}

// Make PrivacyToggle globally available
window.PrivacyToggle = PrivacyToggle;

// Don't auto-initialize, let main.js handle it
