// Utility functions for the extension
const GlifUtils = {
    // Storage utilities
    storage: {
        get: async (key) => {
            return new Promise((resolve) => {
                chrome.storage.local.get(key, (result) => {
                    resolve(result[key]);
                });
            });
        },
        set: async (key, value) => {
            return new Promise((resolve) => {
                chrome.storage.local.set({ [key]: value }, resolve);
            });
        }
    },

    // Theme utilities
    theme: {
        isDarkMode: async () => {
            const darkMode = await GlifUtils.storage.get('darkMode');
            return darkMode === true;
        },
        setDarkMode: async (isDark) => {
            await GlifUtils.storage.set('darkMode', isDark);
            document.documentElement.setAttribute('data-glif-dark-mode', isDark);
        },
        toggle: async () => {
            const isDark = await GlifUtils.theme.isDarkMode();
            await GlifUtils.theme.setDarkMode(!isDark);
            return !isDark;
        }
    },

    // DOM utilities
    dom: {
        createElement: (tag, attributes = {}, children = []) => {
            const element = document.createElement(tag);
            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'className') {
                    element.className = value;
                } else if (key === 'innerHTML') {
                    element.innerHTML = value;
                } else {
                    element.setAttribute(key, value);
                }
            });
            children.forEach(child => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else {
                    element.appendChild(child);
                }
            });
            return element;
        }
    }
};
