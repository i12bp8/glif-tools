// Navbar component with Tools dropdown
class GlifNavbar {
    constructor() {
        this.isDropdownOpen = false;
    }

    createToolsButton() {
        const buttonWrapper = GlifUtils.dom.createElement('div', {
            className: 'relative'
        });

        const button = GlifUtils.dom.createElement('button', {
            type: 'button',
            className: 'flex items-center gap-1 text-lg font-bold hover:text-brand-600 active:text-brand-600 transition-colors duration-200',
            innerHTML: `
                <span class="block h-2 w-2"></span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" class="mb-0.5">
                    <path d="M10.478 1.647a.5.5 0 1 0-.956-.294l-4 13a.5.5 0 0 0 .956.294zM4.854 4.146a.5.5 0 0 1 0 .708L1.707 8l3.147 3.146a.5.5 0 0 1-.708.708l-3.5-3.5a.5.5 0 0 1 0-.708l3.5-3.5a.5.5 0 0 1 .708 0zm6.292 0a.5.5 0 0 0 0 .708L14.293 8l-3.147 3.146a.5.5 0 0 0 .708.708l3.5-3.5a.5.5 0 0 0 0-.708l-3.5-3.5a.5.5 0 0 0-.708 0z"/>
                </svg>
                Tools
            `
        });

        button.addEventListener('click', (e) => this.toggleDropdown(e));
        buttonWrapper.appendChild(button);

        // Create and add dropdown menu
        const menu = this.createDropdownMenu();
        buttonWrapper.appendChild(menu);

        return buttonWrapper;
    }

    createDropdownMenu() {
        const menuItems = [
            {
                icon: GLIF_ICONS.history,
                text: 'Image History',
                onClick: () => {
                    if (window.imageHistory) {
                        window.imageHistory.showPanel();
                    }
                }
            },
            {
                icon: GLIF_ICONS.moon,
                text: 'Toggle Dark Mode',
                onClick: () => {
                    // Show coming soon toast
                    const toast = document.createElement('div');
                    toast.className = 'glif-toast';
                    toast.textContent = 'Dark mode coming soon!';
                    document.body.appendChild(toast);
                    
                    // Remove toast after animation
                    setTimeout(() => {
                        toast.classList.add('show');
                        setTimeout(() => {
                            toast.classList.remove('show');
                            setTimeout(() => toast.remove(), 300);
                        }, 2000);
                    }, 100);
                }
            },
            {
                icon: GLIF_ICONS.bug,
                text: 'Give Feedback',
                onClick: () => {
                    if (window.feedbackPanel) {
                        window.feedbackPanel.showPanel();
                    }
                }
            }
        ];

        const menu = GlifUtils.dom.createElement('div', {
            className: 'glif-tools-menu'
        });

        menuItems.forEach((item, index) => {
            if (index > 0) {
                const separator = GlifUtils.dom.createElement('div', {
                    className: 'glif-tools-menu-separator'
                });
                menu.appendChild(separator);
            }

            const menuItem = GlifUtils.dom.createElement('div', {
                className: 'glif-tools-menu-item',
                innerHTML: `
                    <span class="menu-item-icon">${item.icon}</span>
                    <span class="menu-item-text">${item.text}</span>
                `
            });
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                item.onClick();
                this.toggleDropdown(e);
            });
            menu.appendChild(menuItem);
        });

        // Add credits section
        const credits = GlifUtils.dom.createElement('div', {
            className: 'mt-3 pt-3 text-xs text-gray-400 text-center border-t border-gray-100',
            innerHTML: `Made by <a href="https://glif.app/@appelsiensam" class="text-brand-600 hover:text-brand-700 font-medium transition-colors duration-200">I12BP8</a> <3`
        });
        menu.appendChild(credits);

        return menu;
    }

    updateThemeIcon(isDark) {
        const themeMenuItem = document.querySelector('.group:nth-child(2)');
        if (themeMenuItem) {
            const iconSpan = themeMenuItem.querySelector('span:first-child');
            if (iconSpan) {
                iconSpan.innerHTML = isDark ? GLIF_ICONS.sun : GLIF_ICONS.moon;
            }
        }
    }

    toggleDropdown(event) {
        if (!event || !event.currentTarget || !event.currentTarget.parentElement) {
            console.log('Invalid event or target');
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        
        this.isDropdownOpen = !this.isDropdownOpen;
        const menu = event.currentTarget.parentElement.querySelector('.glif-tools-menu');
        
        if (!menu) {
            console.log('Menu element not found');
            return;
        }

        if (this.isDropdownOpen) {
            menu.classList.add('active');
        } else {
            menu.classList.remove('active');
        }

        // Log for debugging
        console.log('Toggle dropdown:', {
            isOpen: this.isDropdownOpen,
            menu: menu,
            hasActiveClass: menu.classList.contains('active')
        });
    }

    async init() {
        const dropdown = this.createToolsButton();

        // Add click outside listener to close dropdown
        document.addEventListener('click', (event) => {
            if (this.isDropdownOpen && !dropdown.contains(event.target)) {
                this.toggleDropdown(event);
            }
        });

        return dropdown;
    }
}
