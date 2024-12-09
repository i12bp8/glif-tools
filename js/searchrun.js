class SearchRunPanel {
    constructor() {
        this.searchInput = null;
        this.gridContainer = null;
        this.runsData = null;
        this.glifId = null;
        this.observer = null;
        this.dynamicObserver = null;
        this.isSearchActive = false;
        this.init();
    }

    init() {
        this.waitForGrid();
    }

    async fetchRunsData() {
        try {
            const url = `https://glif.app/api/runs?glifId=${this.glifId}&limit=100`;
            console.log('Fetching runs with URL:', url);
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch runs data');
            this.runsData = await response.json();
            console.log('Number of runs fetched:', this.runsData.length);
        } catch (error) {
            console.error('Error fetching runs data:', error);
        }
    }

    waitForGrid() {
        this.observer = new MutationObserver(async (mutations, obs) => {
            const runsTitle = document.querySelector('h2.text-2xl.font-black');
            const gridContainer = document.querySelector('.grid.grid-cols-1.gap-6.md\\:grid-cols-3');
            
            if (runsTitle && gridContainer) {
                obs.disconnect();
                this.gridContainer = gridContainer;
                this.glifId = this.extractGlifIdFromUrl();
                if (!this.glifId) return;
                await this.fetchRunsData();
                this.createSearchInput(runsTitle);

                // Create a new observer for dynamic content
                this.setupDynamicObserver();
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    setupDynamicObserver() {
        this.dynamicObserver = new MutationObserver((mutations) => {
            if (this.isSearchActive) {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && !node.classList.contains('search-result')) {
                            node.classList.add('run-hidden');
                        }
                    });
                });
            }
        });

        this.dynamicObserver.observe(this.gridContainer, {
            childList: true,
            subtree: true
        });
    }

    extractGlifIdFromUrl() {
        const url = window.location.href;
        const match = url.match(/glifs\/(\w+)/);
        const glifId = match ? match[1] : null;
        console.log('Extracted Glif ID:', glifId);
        return glifId;
    }

    async fetchAndFilterRuns(searchTerm) {
        if (!this.glifId) {
            console.log('No Glif ID found.');
            return;
        }

        // If search term is empty or less than 2 characters
        if (!searchTerm || searchTerm.length < 2) {
            this.isSearchActive = false;
            // Show all original runs
            const allCards = this.gridContainer.querySelectorAll('.font-brand');
            allCards.forEach(card => {
                if (!card.classList.contains('search-result')) {
                    card.classList.remove('run-hidden');
                } else {
                    card.remove(); // Remove any previous search results
                }
            });
            return;
        }

        try {
            this.isSearchActive = true;

            const url = `https://glif.app/api/runs?glifId=${this.glifId}&limit=100`;
            console.log(`Fetching runs for Glif ID: ${this.glifId} with URL: ${url}`);
            const response = await fetch(url);
            const runs = await response.json();

            // Hide all original runs
            const allCards = this.gridContainer.querySelectorAll('.font-brand');
            allCards.forEach(card => {
                if (!card.classList.contains('search-result')) {
                    card.classList.add('run-hidden');
                }
            });

            // Remove previous search results
            const oldSearchResults = this.gridContainer.querySelectorAll('.search-result');
            oldSearchResults.forEach(result => result.remove());

            // Filter and display new search results
            const filteredRuns = runs.filter(run => {
                return Object.values(run.inputs || {}).some(input =>
                    input.toLowerCase().includes(searchTerm.toLowerCase())
                );
            });

            // Create and display filtered runs
            filteredRuns.forEach(run => {
                const runCard = this.createRunCard(run);
                runCard.classList.add('search-result');
                this.gridContainer.insertBefore(runCard, this.gridContainer.firstChild);
            });

        } catch (error) {
            console.error('Error fetching or filtering runs:', error);
        }
    }

    displayRuns(runs) {
        if (!this.gridContainer) return;

        // Hide all cards initially
        const allCards = this.gridContainer.children;
        Array.from(allCards).forEach(card => {
            card.style.display = 'none';
        });

        // Show only the filtered cards
        runs.forEach(run => {
            const matchingCard = Array.from(allCards).find(card => card.dataset.runId === run.id);
            if (matchingCard) {
                matchingCard.style.display = 'block';
            }
        });
    }

    createSearchInput(runsTitle) {
        // Ensure only one search input is created
        const existingInput = document.querySelector('.search-runs-input');
        if (existingInput) {
            this.searchInput = existingInput;
            this.searchInput.value = '';
            return;
        }

        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-runs-container';

        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.placeholder = 'Search runs...';
        this.searchInput.className = 'search-runs-input';

        searchContainer.appendChild(this.searchInput);
        runsTitle.parentElement.appendChild(searchContainer);

        this.searchInput.addEventListener('input', debounce((event) => {
            const searchTerm = event.target.value;
            this.fetchAndFilterRuns(searchTerm);
        }, 300));
    }

    createRunCard(run) {
        const card = document.createElement('div');
        card.className = 'font-brand mx-auto mb-[46px] flex w-full flex-col font-medium';
        card.style.maxWidth = '468px';
        card.dataset.runId = run.id;

        const headerDiv = document.createElement('div');
        headerDiv.className = 'flex items-center gap-3';

        const userDiv = document.createElement('div');
        userDiv.className = 'flex items-center gap-2';

        const userImage = document.createElement('img');
        userImage.src = run.user?.image || 'default-avatar-url';
        userImage.className = 'h-8 w-8 rounded-full';
        userImage.alt = 'User avatar';

        const userName = document.createElement('span');
        userName.textContent = run.user?.name || 'Anonymous';
        userName.className = 'text-sm';

        userDiv.appendChild(userImage);
        userDiv.appendChild(userName);
        headerDiv.appendChild(userDiv);

        // Add the output image
        const imageDiv = document.createElement('div');
        imageDiv.className = 'group relative mb-[15px] mt-[18px] w-full';
        
        const image = document.createElement('img');
        image.alt = `Output for the Glif "${run.spell?.name || ''}"`;
        image.loading = 'lazy';
        image.width = 468;
        image.height = 468;
        image.className = 'rounded-[4px] border-[6px] border-white';
        image.src = run.output;
        
        imageDiv.appendChild(image);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'mt-3 rounded-xl border border-gray-200 p-4';

        // Format and display inputs
        if (run.inputs && Object.keys(run.inputs).length > 0) {
            const inputsDiv = document.createElement('div');
            inputsDiv.className = 'flex flex-col gap-2';
            
            Object.entries(run.inputs).forEach(([key, value]) => {
                const inputItem = document.createElement('div');
                inputItem.className = 'text-sm';
                inputItem.textContent = `${value}`;
                inputsDiv.appendChild(inputItem);
            });
            
            contentDiv.appendChild(inputsDiv);
        }

        card.appendChild(headerDiv);
        card.appendChild(imageDiv);
        card.appendChild(contentDiv);

        return card;
    }

    formatTimeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize the search panel
new SearchRunPanel();
