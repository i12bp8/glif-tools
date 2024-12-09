class ImageHistory {
    constructor() {
        this.isVisible = false;
        this.storageKey = 'glifImageHistory';
        this.maxHistoryItems = 100; // Maximum number of items to store
        console.log('[History] Initializing ImageHistory');
        this.createPanel();
        this.bindEvents();
        // Test storage access immediately
        this.testStorage();
    }

    async testStorage() {
        try {
            console.log('[History] Testing storage access...');
            await chrome.storage.local.set({ 'test': 'test' });
            const result = await chrome.storage.local.get('test');
            console.log('[History] Storage test result:', result);
            await chrome.storage.local.remove('test');
            console.log('[History] Storage test completed successfully');
        } catch (error) {
            console.error('[History] Storage test failed:', error);
            throw error; // Re-throw to catch initialization failures
        }
    }

    createPanel() {
        // Create overlay and panel elements
        this.overlay = document.createElement('div');
        this.overlay.className = 'history-overlay';
        
        this.panel = document.createElement('div');
        this.panel.className = 'history-panel';
        this.panel.innerHTML = `
            <div class="history-panel-header">
                <h2>Image History</h2>
                <button class="history-panel-close">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="history-search-container">
                <div class="history-search">
                    <svg class="history-search-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input type="text" placeholder="Search prompts..." class="history-search-input">
                </div>
                <div class="history-filter">
                    <div class="history-filter-group">
                        <button class="history-filter-button active" data-filter="all">ALL</button>
                        <button class="history-filter-button" data-filter="public">PUBLIC</button>
                        <button class="history-filter-button" data-filter="private">PRIVATE</button>
                    </div>
                </div>
            </div>
            <div class="history-panel-content">
                <div class="history-grid">
                    <!-- Images will be dynamically inserted here -->
                </div>
                <div class="history-empty">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    <p>No images in history yet</p>
                </div>
            </div>
        `;

        // Add panel to overlay
        this.overlay.appendChild(this.panel);

        // Add to DOM
        document.body.appendChild(this.overlay);
    }

    bindEvents() {
        // Close button handler
        this.panel.querySelector('.history-panel-close').addEventListener('click', () => {
            this.hidePanel();
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hidePanel();
            }
        });

        // Close when clicking overlay
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hidePanel();
            }
        });

        // Add search functionality
        const searchInput = this.panel.querySelector('.history-search-input');
        const filterButtons = this.panel.querySelectorAll('.history-filter-button');
        let activeFilter = 'all';
        
        searchInput.addEventListener('input', () => {
            this.filterHistory(searchInput.value.trim().toLowerCase(), activeFilter);
        });

        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                console.log('Filter button clicked:', button.dataset.filter);
                // Update active state
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                activeFilter = button.dataset.filter;
                
                // Apply filters
                this.filterHistory(searchInput.value.trim().toLowerCase(), activeFilter);
            });
        });

        // Add event delegation for metadata buttons
        this.panel.addEventListener('click', (e) => {
            if (e.target.closest('.metadata-button')) {
                const historyItem = e.target.closest('.history-item');
                if (historyItem) {
                    const itemData = historyItem.getAttribute('data-item');
                    if (itemData) {
                        try {
                            const item = JSON.parse(decodeURIComponent(itemData));
                            this.showMetadataPanel(item);
                        } catch (error) {
                            console.error('[History] Error parsing item data:', error);
                        }
                    }
                }
            }
        });
    }

    async filterHistory(searchTerm, visibility = 'all') {
        console.log('filterHistory called with visibility:', visibility);
        const history = await this.getHistory();
        const grid = this.panel.querySelector('.history-grid');
        const emptyState = this.panel.querySelector('.history-empty');

        if (!history || history.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        let filteredHistory = history;

        // Filter by visibility
        if (visibility !== 'all') {
            filteredHistory = filteredHistory.filter(item => {
                // Convert item type to match our filter value
                const itemVisibility = (item.type || '').toLowerCase();
                console.log('Checking item:', {
                    prompt: item.prompt,
                    type: item.type,
                    itemVisibility,
                    filterVisibility: visibility,
                    matches: itemVisibility === visibility
                });
                return itemVisibility === visibility;
            });
        }

        // Filter by search term
        if (searchTerm) {
            filteredHistory = filteredHistory.filter(item => item.prompt?.toLowerCase().includes(searchTerm));
        }

        console.log('Final filtered history:', filteredHistory);

        if (filteredHistory.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'block';
            emptyState.querySelector('p').textContent = 'No matching images found';
        } else {
            grid.style.display = 'grid';
            emptyState.style.display = 'none';
            emptyState.querySelector('p').textContent = 'No images in history yet';
            grid.innerHTML = filteredHistory.map(item => this.createHistoryItemHTML(item)).join('');
        }
    }

    showPanel() {
        this.isVisible = true;
        this.overlay.classList.add('visible');
        this.loadHistory();
        // Clear search and reset filter when showing panel
        const searchInput = this.panel.querySelector('.history-search-input');
        const filterButtons = this.panel.querySelectorAll('.history-filter-button');
        if (searchInput) {
            searchInput.value = '';
        }
        // Reset to ALL filter
        filterButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === 'all') {
                btn.classList.add('active');
            }
        });
    }

    hidePanel() {
        this.isVisible = false;
        this.overlay.classList.remove('visible');
    }

    async loadHistory() {
        console.log('[History] Loading history for display');
        const history = await this.getHistory();
        console.log('[History] Retrieved history for display:', history);
        
        const grid = this.panel.querySelector('.history-grid');
        const emptyState = this.panel.querySelector('.history-empty');

        if (!history || history.length === 0) {
            console.log('[History] No items found, showing empty state');
            grid.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        console.log('[History] Displaying', history.length, 'items');
        grid.style.display = 'grid';
        emptyState.style.display = 'none';
        grid.innerHTML = history.map(item => this.createHistoryItemHTML(item)).join('');
    }

    async getHistory() {
        try {
            console.log('[History] Getting history from storage');
            const result = await chrome.storage.local.get(this.storageKey);
            console.log('[History] Retrieved history:', result);
            let history = result[this.storageKey] || [];
            
            // Migrate existing items to have public property
            history = history.map(item => ({
                ...item,
                public: item.public ?? item.metadata?.isPublic ?? false
            }));
            
            console.log('[History] Parsed history array:', history);
            return history;
        } catch (error) {
            console.error('[History] Error loading history:', error);
            return [];
        }
    }

    async addToHistory(imageData) {
        try {
            if (!imageData || !imageData.imageUrl) {
                console.error('[History] Invalid image data:', imageData);
                return;
            }

            console.log('[History] Adding image to history:', imageData);
            const history = await this.getHistory();
            console.log('[History] Current history length:', history.length);
            
            // Extract all image URLs from the metadata
            const allImageUrls = new Set();
            const extractUrls = (obj) => {
                const str = JSON.stringify(obj);
                const urlRegex = /(https?:\/\/[^\s<>"]+?\.(?:jpg|jpeg|gif|png|webp))/gi;
                const matches = str.match(urlRegex) || [];
                matches.forEach(url => allImageUrls.add(url));
            };

            // Extract from metadata and any response data
            extractUrls(imageData.metadata);
            if (imageData.responseData) {
                extractUrls(imageData.responseData);
            }

            console.log('[History] Found image URLs:', Array.from(allImageUrls));

            // Create history item with timestamp and all found images
            const historyItem = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                imageUrl: imageData.imageUrl,
                type: imageData.type || 'unknown',
                prompt: imageData.prompt || '',
                metadata: {
                    ...imageData.metadata || {},
                    allImageUrls: Array.from(allImageUrls)
                },
                public: imageData.metadata?.isPublic || false
            };

            console.log('[History] Created history item:', historyItem);

            // Add to beginning of array
            history.unshift(historyItem);
            console.log('[History] Added item to history. New length:', history.length);

            // Limit the history size
            if (history.length > this.maxHistoryItems) {
                history.pop();
                console.log('[History] Trimmed history to max size:', this.maxHistoryItems);
            }

            // Prepare storage data
            const storageData = { [this.storageKey]: history };
            console.log('[History] Preparing to save to storage:', storageData);

            // Save to storage
            await chrome.storage.local.set(storageData);
            console.log('[History] Successfully saved to storage');

            // Refresh the panel if it's visible
            if (this.isVisible) {
                console.log('[History] Panel is visible, refreshing display');
                this.loadHistory();
            }
        } catch (error) {
            console.error('[History] Error adding to history:', error);
            // Log the full error details
            console.error('[History] Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
        }
    }

    createHistoryItemHTML(item) {
        const date = new Date(item.metadata?.timestamp || item.timestamp);
        const formattedDate = date.toLocaleDateString(undefined, { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Safely stringify the item data for the data attribute
        const itemData = encodeURIComponent(JSON.stringify(item));
        
        return `
            <div class="history-item" data-id="${item.id || ''}" data-item="${itemData}" title="Generated on ${formattedDate}">
                <img class="history-item-image" src="${item.imageUrl || ''}" alt="Generated image" 
                    onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text x=%2212%22 y=%2212%22 text-anchor=%22middle%22>⚠️</text></svg>'" />
                <div class="history-item-info">
                    <div class="history-item-type ${item.type === 'private' ? 'private' : 'public'}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            ${item.type === 'private' 
                                ? '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>' 
                                : '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>'}
                        </svg>
                        ${item.type === 'private' ? 'Private' : 'Public'}
                    </div>
                    <div class="history-item-prompt">${item.prompt || 'No prompt available'}</div>
                    <div class="history-item-footer">
                        <span class="history-item-date">${formattedDate}</span>
                        <button class="metadata-button" title="View metadata">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                            Metadata
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    showMetadataPanel(item) {
        console.log('[History] Showing metadata panel for item:', item);

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'metadata-overlay';
        document.body.appendChild(overlay);

        // Create panel
        const panel = document.createElement('div');
        panel.className = 'metadata-panel';

        // Extract metadata from the item
        const metadata = item.metadata || {};
        const spellRun = metadata.spellRun || {};
        
        // Debug metadata
        console.log('[History] Full metadata:', metadata);
        console.log('[History] Spell run:', spellRun);
        
        // Get all image URLs
        const imageUrls = new Set(metadata.allImageUrls || []);
        if (item.imageUrl) {
            imageUrls.add(item.imageUrl);
        }

        console.log('[History] All image URLs:', Array.from(imageUrls));

        panel.innerHTML = `
            <div class="metadata-panel-content">
                <h3>Image Details</h3>
                <div class="metadata-sections">
                    ${Array.from(imageUrls).length > 0 ? `
                        <div class="metadata-section">
                            <h4>Generation Steps</h4>
                            <div class="image-summary">
                                ${Array.from(imageUrls).map(url => `
                                    <div class="summary-image">
                                        <img src="${url}" alt="Generated image" loading="lazy">
                                        <div class="image-info">
                                            <a href="${url}" target="_blank" class="view-full-btn">View Full Size</a>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    <div class="metadata-section">
                        <h4>Basic Information</h4>
                        <div class="metadata-field">
                            <label>Created:</label>
                            <span>${new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                        <div class="metadata-field">
                            <label>Glif Title:</label>
                            <span>${spellRun.spell?.name || 'Unknown'}</span>
                        </div>
                        <div class="metadata-field">
                            <label>Glif ID:</label>
                            <span>
                                <a href="https://glif.app/glifs/${spellRun.spellId}" target="_blank" class="metadata-link">
                                    ${spellRun.spellId || 'Unknown'}
                                </a>
                            </span>
                        </div>
                        <div class="metadata-field">
                            <label>Run ID:</label>
                            <span>
                                <a href="https://glif.app/runs/${spellRun.id}" target="_blank" class="metadata-link">
                                    ${spellRun.id || 'Unknown'}
                                </a>
                            </span>
                        </div>
                        <div class="metadata-field">
                            <label>Visibility:</label>
                            <span>${item.type === 'private' ? 'Private' : 'Public'}</span>
                        </div>
                    </div>
                    ${item.prompt ? `
                        <div class="metadata-section">
                            <h4>Prompt</h4>
                            <div class="metadata-field">
                                <span>${item.prompt}</span>
                            </div>
                        </div>
                    ` : ''}
                    ${metadata.inputs && Object.keys(metadata.inputs).length > 0 ? `
                        <div class="metadata-section">
                            <h4>Input Parameters</h4>
                            ${Object.entries(metadata.inputs).map(([key, value]) => `
                                <div class="metadata-field">
                                    <label>${key}:</label>
                                    <span class="node-output-text">${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.className = 'close-panel';
        closeButton.innerHTML = '×';
        closeButton.onclick = () => {
            this.hideMetadataPanel();
            // Show the history panel again
            const historyPanel = document.querySelector('.history-panel');
            if (historyPanel) {
                historyPanel.style.display = '';
            }
        };
        panel.appendChild(closeButton);

        // Hide the history panel
        const historyPanel = document.querySelector('.history-panel');
        if (historyPanel) {
            historyPanel.style.display = 'none';
        }

        // Replace any existing panel and overlay
        const existingPanel = document.querySelector('.metadata-panel');
        const existingOverlay = document.querySelector('.metadata-overlay');
        if (existingPanel) {
            existingPanel.remove();
        }
        if (existingOverlay) {
            existingOverlay.remove();
        }

        // Add panel and show with animation
        document.body.appendChild(panel);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => {
            panel.classList.add('visible');
            overlay.classList.add('visible');
        });

        // Close on overlay click
        overlay.addEventListener('click', () => {
            this.hideMetadataPanel();
            // Show the history panel again
            const historyPanel = document.querySelector('.history-panel');
            if (historyPanel) {
                historyPanel.style.display = '';
            }
        });
    }

    hideMetadataPanel() {
        const panel = document.querySelector('.metadata-panel');
        const overlay = document.querySelector('.metadata-overlay');
        
        if (panel) {
            panel.classList.remove('visible');
            setTimeout(() => panel.remove(), 300);
        }
        
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
    }
}

class HistoryManager {
    constructor() {
        this.historyContainer = document.getElementById('history-container');
        this.storageKey = 'glifImageHistory';
        this.maxHistoryItems = 100;
        this.bindEvents();
    }

    bindEvents() {
        // Listen for new history entries
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'newHistoryEntry') {
                this.addHistoryEntry(message.data);
            }
        });
    }

    addHistoryEntry(data) {
        console.log('[History] Adding entry with data:', data);
        
        // Extract all image URLs from the raw response if available
        const allImageUrls = new Set();
        
        // Add any URLs from metadata
        if (data.metadata?.allImageUrls) {
            data.metadata.allImageUrls.forEach(url => allImageUrls.add(url));
        }
        
        // Add the main image URL
        if (data.imageUrl) {
            allImageUrls.add(data.imageUrl);
        }

        // Get inputs and prompt
        const inputs = data.metadata?.inputs || {};
        
        // Get prompt from first input value
        const prompt = inputs && Object.keys(inputs).length > 0 ? 
                      inputs[Object.keys(inputs)[0]] : 
                      data.prompt || 'No prompt available';
        
        console.log('[History] Using prompt from first input:', prompt);
        
        const entry = {
            imageUrl: data.imageUrl,
            timestamp: data.metadata.timestamp,
            prompt: prompt,
            type: data.type,
            metadata: {
                spellRun: data.metadata.spellRun,
                graphExecutionState: data.metadata.graphExecutionState,
                inputs: inputs,
                nodeExecutions: data.metadata.nodeExecutions,
                generatedPrompts: data.metadata.generatedPrompts,
                allImageUrls: Array.from(allImageUrls) // Store all unique image URLs
            }
        };

        console.log('[History] Created entry with all data:', entry);

        // Save to storage
        this.saveToStorage(entry);

        // Add to grid
        this.addImageToGrid(entry);
    }

    async saveToStorage(entry) {
        try {
            // Get existing history
            const result = await chrome.storage.local.get(this.storageKey);
            let history = result[this.storageKey] || [];

            // Add new entry at the start
            history.unshift(entry);

            // Limit history size
            if (history.length > this.maxHistoryItems) {
                history = history.slice(0, this.maxHistoryItems);
            }

            // Save back to storage
            await chrome.storage.local.set({ [this.storageKey]: history });
            console.log('[History] Saved entry to storage');
        } catch (error) {
            console.error('[History] Error saving to storage:', error);
        }
    }

    addImageToGrid(entry) {
        const grid = document.getElementById('history-grid');
        const itemHTML = `
            <div class="history-item" data-id="${entry.id || ''}" data-item="${encodeURIComponent(JSON.stringify(entry))}" title="Generated on ${new Date(entry.timestamp).toLocaleString()}">
                <img class="history-item-image" src="${entry.imageUrl || ''}" alt="Generated image" 
                    onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text x=%2212%22 y=%2212%22 text-anchor=%22middle%22>⚠️</text></svg>'" />
                <div class="history-item-info">
                    <div class="history-item-type ${entry.type === 'private' ? 'private' : 'public'}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            ${entry.type === 'private' 
                                ? '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>' 
                                : '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>'}
                        </svg>
                        ${entry.type === 'private' ? 'Private' : 'Public'}
                    </div>
                    <div class="history-item-prompt">${entry.prompt || 'No prompt available'}</div>
                    <div class="history-item-footer">
                        <span class="history-item-date">${new Date(entry.timestamp).toLocaleString()}</span>
                        <button class="metadata-button" title="View metadata">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                            Metadata
                        </button>
                    </div>
                </div>
            </div>
        `;
        grid.innerHTML += itemHTML;
    }

    async loadHistory() {
        try {
            const { history = [] } = await chrome.storage.local.get(this.storageKey);
            history.forEach(entry => this.addImageToGrid(entry));
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }
}

// Initialize the history manager
document.addEventListener('DOMContentLoaded', () => {
    const historyManager = new HistoryManager();
    historyManager.loadHistory();
});

// Make it globally available
window.imageHistory = new ImageHistory();
