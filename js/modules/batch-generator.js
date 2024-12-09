// GLIF AI Batch Generator Module
class BatchGenerator {
    constructor() {
        // Use localStorage as the single source of truth
        const storedPrivacyState = localStorage.getItem('glifPrivateMode');
        this.isPrivate = storedPrivacyState === null ? true : storedPrivacyState === 'true';
        this.isBatchMode = false;  // Add batch mode flag
        this.batchEntries = [];
        
        this.icons = {
            close: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>`,
            generate: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>`,
            loading: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 2a10 10 0 0 1 10 10"/>
            </svg>`,
            error: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>`,
            check: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
            </svg>`,
            back: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5"/>
                <polyline points="12 19 5 12 12 5"/>
            </svg>`
        };
        
        // Listen for privacy state changes
        window.addEventListener('glifPrivacyChanged', (event) => {
            this.isPrivate = event.detail.isPrivate;
        });
    }

    // Show toast message
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }, 100);
    }

    // Get form inputs
    getWorkflowInputs() {
        const form = document.querySelector('form');
        if (!form) return [];

        const inputs = [];
        form.querySelectorAll('textarea').forEach(textarea => {
            if (textarea.name && !textarea.name.startsWith('__') && textarea.name !== 'spellId' && textarea.name !== 'version') {
                const label = textarea.closest('label')?.querySelector('span')?.textContent?.trim() || '';
                inputs.push({
                    name: textarea.name,
                    type: 'textarea',
                    label: label,
                    value: textarea.value.trim(),
                    placeholder: textarea.getAttribute('placeholder') || label
                });
            }
        });
        return inputs;
    }

    // Fetch AI batch inputs
    async fetchAIBatchInputs(amount, content) {
        try {
            // Retrieve the latest privacy state from localStorage
            const storedPrivacyState = localStorage.getItem('glifPrivateMode');
            this.isPrivate = storedPrivacyState === null ? true : storedPrivacyState === 'true';

            const formInputs = this.getWorkflowInputs();
            
            // Get workflow name and description
            const workflowTitle = document.querySelector('h1')?.textContent || '';
            const workflowDescription = document.querySelector('.underline-links.line-clamp-2.text-sm.text-gray-500')?.textContent?.trim() || '';
            
            // Format input fields with rich context
            const enrichedFields = formInputs.map(input => ({
                name: input.label,
                type: input.type,
                currentValue: input.value,
                placeholder: input.placeholder,
                constraints: input.type === 'number' ? {
                    min: input.min,
                    max: input.max,
                    step: input.step
                } : null
            }));
            
            // Get previous successful generations if available
            const previousGenerations = Array.from(document.querySelectorAll('.workflow-result'))
                .slice(0, 3)  // Take up to 3 recent examples
                .map(result => {
                    const inputs = {};
                    result.querySelectorAll('.input-value').forEach(input => {
                        inputs[input.getAttribute('data-name')] = input.textContent.trim();
                    });
                    return inputs;
                });
            
            console.log('Sending enriched context:', { workflowTitle, enrichedFields, previousGenerations });
            
            const enrichedContext = JSON.stringify({
                workflow: {
                    title: workflowTitle,
                    description: workflowDescription
                },
                fields: enrichedFields,
                examples: previousGenerations
            });

            const payload = {
                id: "cm4b89oo000asm86fstry7u1e",
                version: "live",
                inputs: {
                    amount: amount.toString(),
                    fields: formInputs.map(input => input.name).join(' | '),
                    content: content,
                    enrichedContext: enrichedContext
                },
                glifRunIsPublic: !this.isPrivate
            };

            console.log('Debug - Request payload:', JSON.stringify(payload, null, 2));

            const response = await fetch("https://glif.app/api/run-glif", {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Content-Type': 'application/json',
                    'Sec-GPC': '1',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'Priority': 'u=4'
                },
                referrer: `https://glif.app/@appelsiensam/glifs/${window.location.pathname.split('/').pop()}`,
                mode: 'cors',
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.log('Debug - Error response:', errorText);
                throw new Error(`API request failed: ${response.status}\nResponse: ${errorText}`);
            }

            const reader = response.body.getReader();
            let jsonData = '';
            let entries = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                jsonData += chunk;

                const lines = jsonData.split('\n');
                jsonData = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim().startsWith('data: ')) continue;

                    try {
                        const data = JSON.parse(line.slice(6));
                        const text = data.graphExecutionState?.nodes?.text1?.output?.value;

                        if (text?.includes('"entries"')) {
                            try {
                                const parsed = JSON.parse(text);
                                if (parsed.entries?.length) {
                                    // Process each entry to include all input fields
                                    entries = parsed.entries.map(entry => {
                                        const formInputs = this.getWorkflowInputs();
                                        const result = {};
                                        
                                        // Copy all form input values first
                                        formInputs.forEach(input => {
                                            result[input.name] = input.value;
                                        });
                                        
                                        // Then override with the generated values
                                        if (typeof entry === 'string') {
                                            // If entry is just a string, assume it's for the first input
                                            if (formInputs.length > 0) {
                                                result[formInputs[0].name] = entry;
                                            }
                                        } else if (typeof entry === 'object') {
                                            // If entry is an object, merge it with the form inputs
                                            Object.assign(result, entry);
                                        }
                                        
                                        return result;
                                    });
                                }
                            } catch (e) {
                                console.log('Partial JSON:', text);
                            }
                        }
                    } catch (e) {
                        console.log('Parse error:', e);
                    }
                }
            }

            return entries;
        } catch (error) {
            console.error('fetchAIBatchInputs error:', error);
            throw error;
        }
    }

    // Process a single entry
    async processEntry(entry) {
        try {
            // Get spell ID from URL or input field
            const spellId = window.location.pathname.split('/').pop() || 
                          document.querySelector('input[name="spellId"]')?.value;
            
            if (!spellId) {
                throw new Error('Could not find spell ID');
            }

            // Get all input fields from the form
            const formInputs = {};
            document.querySelectorAll('textarea').forEach(textarea => {
                if (textarea.name && !textarea.name.startsWith('__') && 
                    textarea.name !== 'spellId' && textarea.name !== 'version') {
                    // Use the original form value for any field not specified in the entry
                    formInputs[textarea.name] = entry[textarea.name] || textarea.value;
                }
            });

            // Get the first input key to use as prompt
            const firstInputKey = Object.keys(formInputs)[0];
            const prompt = firstInputKey ? formInputs[firstInputKey] : '';

            // Create the payload with all input fields
            const payload = {
                id: spellId,
                version: document.querySelector('input[name="version"]')?.value || 'live',
                inputs: formInputs,
                glifRunIsPublic: !this.isPrivate
            };

            console.log('[Batch] Sending request:', payload);

            const response = await fetch('https://glif.app/api/run-glif', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Read the response as text stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let chunks = [];
            let allImageUrls = new Set();
            let spellRunData = null;

            const processStream = async () => {
                console.log('[Batch] Starting stream processing');
                let lastCloudinaryUrl = null;
                
                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        console.log('[Batch] Stream complete');
                        if (lastCloudinaryUrl) {
                            console.log('[Batch] Using last found Cloudinary URL:', lastCloudinaryUrl);
                            return { 
                                success: true, 
                                imageUrl: lastCloudinaryUrl,
                                prompt: prompt,
                                metadata: {
                                    timestamp: new Date().toISOString(),
                                    spellRun: spellRunData,
                                    graphExecutionState: spellRunData?.graphExecutionState || {},
                                    inputs: formInputs,
                                    nodeExecutions: spellRunData?.nodeExecutions || [],
                                    generatedPrompts: spellRunData?.generatedPrompts || [],
                                    allImageUrls: Array.from(allImageUrls),
                                    rawResponse: chunks.join('')
                                }
                            };
                        }
                        break;
                    }

                    const chunk = decoder.decode(value, { stream: true });
                    chunks.push(chunk);
                    buffer += chunk;
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        
                        const dataLine = line.startsWith('data: ') ? line.slice(6) : line;
                        
                        try {
                            const data = JSON.parse(dataLine);
                            spellRunData = data;

                            // Function to recursively search for Cloudinary URLs and metadata in an object
                            const findCloudinaryUrlAndMetadata = (obj) => {
                                if (!obj) return;
                                if (typeof obj === 'string') {
                                    if (obj.includes('https://res.cloudinary.com')) {
                                        lastCloudinaryUrl = obj;
                                        allImageUrls.add(obj);
                                    }
                                    // Look for image URLs in text
                                    const urlMatches = obj.match(/(https:\/\/res\.cloudinary\.com\/[^\s"'<>]+)/g);
                                    if (urlMatches) {
                                        urlMatches.forEach(url => allImageUrls.add(url));
                                    }
                                }
                                if (typeof obj === 'object') {
                                    for (const key in obj) {
                                        findCloudinaryUrlAndMetadata(obj[key]);
                                    }
                                }
                            };

                            // Search through the entire data object
                            findCloudinaryUrlAndMetadata(data);
                            
                            // If we found a Cloudinary URL in this chunk, but keep processing
                            if (lastCloudinaryUrl) {
                                console.log('[Batch] Found Cloudinary URL:', lastCloudinaryUrl);
                            }
                            
                        } catch (error) {
                            // Ignore JSON parse errors for incomplete chunks
                            if (!error.message.includes('Unexpected end of JSON input')) {
                                console.error('[Batch] Error parsing JSON:', error);
                            }
                            continue;
                        }
                    }
                }
                
                return { success: false };
            };

            return processStream();
        } catch (error) {
            console.error('[Batch] Error processing entry:', error);
            throw error;
        }
    }

    // Process batch generation
    async processBatchGeneration(entries) {
        console.log('[Batch] Processing batch generation:', entries);
        
        this.isBatchMode = true;
        try {
            if (entries.length > 10) {
                entries = entries.slice(0, 10);
                this.showToast('Maximum batch size is 10 images. Processing first 10 entries.', 'warning');
            }

            // Create results container with same structure as before...
            const resultPanel = document.createElement('div');
            resultPanel.className = 'batch-results-container';
            resultPanel.innerHTML = `
                <div class="batch-results-header">
                    <h3>Batch Generation Results</h3>
                    <button class="close-button" title="Close">
                        ${this.icons.close}
                    </button>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                    <div class="progress-text">0%</div>
                </div>
                <div class="batch-results-grid"></div>
            `;
            
            // Add overlay with blur
            const overlay = document.createElement('div');
            overlay.classList.add('batch-overlay');
            overlay.style.backdropFilter = 'blur(8px)';
            overlay.style.webkitBackdropFilter = 'blur(8px)';
            document.body.appendChild(overlay);
            
            // Add to DOM
            document.body.appendChild(resultPanel);
            resultPanel.dataset.generating = 'true';
            
            const closeButton = resultPanel.querySelector('.close-button');
            closeButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (resultPanel.dataset.generating !== 'true') {
                    resultPanel.remove();
                    overlay.remove();
                    document.body.style.overflow = '';
                    // Reset batch mode and remove any lingering blur effects
                    this.isBatchMode = false;
                    document.querySelectorAll('.batch-overlay').forEach(el => el.remove());
                } else {
                    this.showToast('Please wait for generation to complete', 'warning');
                }
            });

            const grid = resultPanel.querySelector('.batch-results-grid');
            const progressBar = resultPanel.querySelector('.progress-fill');
            const progressText = resultPanel.querySelector('.progress-text');
            
            // Create all cards first with proper placeholders
            entries.forEach((entry, i) => {
                const card = document.createElement('div');
                card.classList.add('batch-result-card');
                
                const preview = document.createElement('div');
                preview.classList.add('preview-container');
                preview.innerHTML = `
                    <div class="placeholder">
                        <div class="loading-spinner">${this.icons.loading}</div>
                    </div>
                `;
                
                const statusEl = document.createElement('div');
                statusEl.classList.add('status');
                statusEl.innerHTML = '<div class="status-text">Waiting...</div>';
                
                const promptEl = document.createElement('div');
                promptEl.classList.add('prompt-text');
                promptEl.textContent = entry.input || 'Loading prompt...';
                
                card.appendChild(preview);
                card.appendChild(promptEl);
                card.appendChild(statusEl);
                grid.appendChild(card);
            });

            let completedCount = 0;
            let successCount = 0;

            const updateProgress = () => {
                const progress = (completedCount / entries.length) * 100;
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `Generated ${completedCount} of ${entries.length} images`;
            };

            // Process all entries
            await Promise.all(entries.map(async (entry, i) => {
                const card = grid.children[i];
                const preview = card.querySelector('.preview-container');
                const statusEl = card.querySelector('.status');
                const promptEl = card.querySelector('.prompt-text');

                try {
                    statusEl.innerHTML = '<div class="status-text">Generating...</div>';
                    console.log(`[Batch] Starting generation for entry ${i + 1}:`, entry);

                    const result = await this.processEntry(entry);
                    console.log(`[Batch] Generation result for entry ${i + 1}:`, result);

                    if (result.success && result.imageUrl) {
                        preview.innerHTML = `
                            <img src="${result.imageUrl}" alt="Generated image ${i + 1}" 
                                onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text x=%2212%22 y=%2212%22 text-anchor=%22middle%22>⚠️</text></svg>'">
                        `;
                        statusEl.innerHTML = '<div class="status-text success">Complete</div>';
                        card.style.cursor = 'pointer';
                        card.addEventListener('click', () => window.open(result.imageUrl, '_blank'));
                        successCount++;

                        // Get the first input key to use as prompt
                        const firstInputKey = Object.keys(entry)[0];
                        const prompt = firstInputKey ? entry[firstInputKey] : '';

                        // Update prompt element
                        promptEl.textContent = prompt;

                        // Save to history
                        if (window.imageHistory) {
                            window.imageHistory.addToHistory({
                                imageUrl: result.imageUrl,
                                prompt: prompt,
                                type: this.isPrivate ? 'private' : 'public',
                                metadata: {
                                    timestamp: new Date().toISOString(),
                                    spellRun: result.metadata?.spellRun,
                                    graphExecutionState: result.metadata?.graphExecutionState || {},
                                    inputs: result.metadata?.inputs,
                                    nodeExecutions: result.metadata?.nodeExecutions || [],
                                    generatedPrompts: result.metadata?.generatedPrompts || [],
                                    allImageUrls: result.metadata?.allImageUrls || [],
                                    rawResponse: result.metadata?.rawResponse,
                                    batchId: Date.now(),
                                    isBatch: true
                                }
                            });
                        }
                    } else {
                        preview.innerHTML = `<div class="error-icon">${this.icons.error}</div>`;
                        statusEl.innerHTML = '<div class="error-text">Failed to generate</div>';
                    }

                    completedCount++;
                    updateProgress();

                } catch (error) {
                    console.error(`[Batch] Error generating image ${i + 1}:`, error);
                    preview.innerHTML = `<div class="error-icon">${this.icons.error}</div>`;
                    statusEl.innerHTML = '<div class="error-text">Failed to generate</div>';
                    completedCount++;
                    updateProgress();
                }
            }));

            resultPanel.dataset.generating = 'false';
            this.isBatchMode = false;
            
            // Show final status
            if (successCount === entries.length) {
                this.showToast(`Successfully generated ${successCount} images`, 'success');
            } else if (successCount > 0) {
                this.showToast(`Generated ${successCount} out of ${entries.length} images`, 'warning');
            } else {
                this.showToast('Failed to generate any images', 'error');
            }

            // Add a small delay before allowing the panel to be closed
            setTimeout(() => {
                const closeButton = resultPanel.querySelector('.close-button');
                closeButton.addEventListener('click', () => {
                    resultPanel.remove();
                    overlay.remove();
                    document.body.style.overflow = '';
                    // Remove any lingering blur effects
                    document.querySelectorAll('.batch-overlay').forEach(el => el.remove());
                }, { once: true });
            }, 100);
            
        } catch (error) {
            console.error('Batch generation error:', error);
            this.isBatchMode = false;
            throw error;
        }
    }

    // Process batch generation results
    processBatchResults(results) {
        // Add each image to history
        if (window.imageHistory) {
            results.forEach(result => {
                if (result.success && result.entry) {
                    window.imageHistory.addToHistory({
                        imageUrl: result.entry.imageUrl,
                        type: 'batch',
                        prompt: result.entry.prompt,
                        metadata: {
                            timestamp: new Date().toISOString(),
                            spellRun: result.entry.metadata?.spellRun,
                            graphExecutionState: result.entry.metadata?.graphExecutionState || {},
                            inputs: result.entry.metadata?.inputs,
                            nodeExecutions: result.entry.metadata?.nodeExecutions || [],
                            generatedPrompts: result.entry.metadata?.generatedPrompts || [],
                            allImageUrls: result.entry.metadata?.allImageUrls || [],
                            rawResponse: result.entry.metadata?.rawResponse,
                            batchId: result.entry.batchId,
                            isBatch: true
                        }
                    });
                }
            });
        }
    }

    async processResponse(response, batchIndex) {
        try {
            const data = await response.json();
            
            // Check if we have image data
            if (data.outputs && data.outputs.image) {
                const imageElement = document.createElement('img');
                imageElement.src = data.outputs.image;
                imageElement.alt = `Batch Generation ${batchIndex + 1}`;
                imageElement.className = 'batch-result-image';
                
                // Add the image to the results container
                const resultsContainer = document.querySelector('.batch-results');
                if (resultsContainer) {
                    const resultDiv = document.createElement('div');
                    resultDiv.className = 'batch-result-item';
                    resultDiv.appendChild(imageElement);
                    resultsContainer.appendChild(resultDiv);
                }
                
                // Only show popup for non-batch runs
                if (!this.isBatchMode && !this.isPrivate) {
                    window.showImagePopup?.(data.outputs.image);
                }
            } else {
                console.error('No image data in response:', data);
            }
            
            return data;
        } catch (error) {
            console.error('Error processing batch response:', error);
            throw error;
        }
    }

    // Show toast notification
    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            background: ${type === 'error' ? '#ff4444' : type === 'warning' ? '#ffbb33' : '#00C851'};
            color: white;
            border-radius: 6px;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // Show batch generation panel
    showBatchPanel() {
        // Remove any existing overlays
        document.querySelectorAll('.batch-overlay, .ai-batch-overlay').forEach(overlay => overlay.remove());
        document.body.style.overflow = 'hidden';  // Disable body scroll

        const overlay = document.createElement('div');
        overlay.classList.add('batch-overlay');

        const panel = document.createElement('div');
        panel.classList.add('ai-batch-panel');

        // Add header
        const header = document.createElement('div');
        header.classList.add('ai-batch-header');
        header.innerHTML = `
            <h2>Batch Generator</h2>
            <button class="ai-close-button">${this.icons.close}</button>
        `;

        // Close button handler
        const closePanel = () => {
            overlay.remove();
            document.body.style.overflow = '';  // Re-enable body scroll
            // Clean up any other overlays
            document.querySelectorAll('.batch-overlay, .ai-batch-overlay').forEach(el => el.remove());
        };

        header.querySelector('.ai-close-button').addEventListener('click', () => {
            if (!panel.dataset.generating) {
                closePanel();
            } else {
                this.showToast('Please wait for generation to complete', 'warning');
            }
        });

        // Add content
        const content = document.createElement('div');
        content.classList.add('ai-batch-content');

        // Add amount field
        const amountField = document.createElement('div');
        amountField.classList.add('ai-input-field');
        amountField.innerHTML = `
            <label class="ai-input-label">Number of Images</label>
            <input type="number" class="ai-input" min="1" max="100" value="1">
        `;

        // Add content field
        const contentField = document.createElement('div');
        contentField.classList.add('ai-input-field');
        contentField.innerHTML = `
            <label class="ai-input-label">Description</label>
            <textarea class="ai-input" rows="4" placeholder="Most famous marvel characters, polygon art, portrait."></textarea>
        `;

        // Add generate button
        const generateButton = document.createElement('button');
        generateButton.classList.add('ai-generate-button');
        generateButton.innerHTML = `${this.icons.generate}<span>Generate Prompts (1 credit)</span>`;
        generateButton.addEventListener('click', async () => {
            const amount = parseInt(amountField.querySelector('input').value);
            const content = contentField.querySelector('textarea').value;

            if (!content) {
                this.showToast('Please describe what you want to generate', 'error');
                return;
            }

            if (isNaN(amount) || amount < 1 || amount > 100) {
                this.showToast('Please enter a valid number of images (1-100)', 'error');
                return;
            }

            panel.dataset.generating = 'true';
            generateButton.disabled = true;
            generateButton.innerHTML = `${this.icons.loading}<span>Generating...</span>`;

            try {
                const entries = await this.fetchAIBatchInputs(amount, content);
                await this.showReviewScreen(entries, panel);
            } catch (error) {
                console.error('Generation error:', error);
                this.showToast('Failed to generate variations: ' + error.message, 'error');
                generateButton.disabled = false;
                generateButton.innerHTML = `${this.icons.generate}<span>Generate Prompts (1 credit)</span>`;
            }
        });

        content.appendChild(amountField);
        content.appendChild(contentField);
        content.appendChild(generateButton);

        panel.appendChild(header);
        panel.appendChild(content);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        
        // Show the overlay with a small delay to ensure proper animation
        requestAnimationFrame(() => {
            overlay.classList.add('visible');
        });
    }

    // Show review screen
    async showReviewScreen(entries, panel) {
        // Clear existing content
        const content = panel.querySelector('.ai-batch-content');
        content.innerHTML = '';

        // Create review container
        const reviewContainer = document.createElement('div');
        reviewContainer.classList.add('review-container');

        // Add each entry for review
        entries.forEach((entry, index) => {
            const reviewItem = document.createElement('div');
            reviewItem.classList.add('review-item');

            const header = document.createElement('div');
            header.classList.add('review-item-header');
            header.innerHTML = `<span class="review-item-number">Image ${index + 1}</span>`;

            const fields = document.createElement('div');
            fields.classList.add('review-fields');

            Object.entries(entry).forEach(([key, value]) => {
                const field = document.createElement('div');
                field.classList.add('review-field');
                field.innerHTML = `
                    <div class="review-field-label">${key}</div>
                    <input type="text" class="review-field-input" value="${value}">
                `;

                // Update entry when input changes
                const input = field.querySelector('input');
                input.addEventListener('input', () => {
                    entry[key] = input.value;
                });

                fields.appendChild(field);
            });

            reviewItem.appendChild(header);
            reviewItem.appendChild(fields);
            reviewContainer.appendChild(reviewItem);
        });

        // Add action buttons
        const actions = document.createElement('div');
        actions.classList.add('review-actions');

        const generateButton = document.createElement('button');
        generateButton.classList.add('ai-generate-button');
        generateButton.innerHTML = `${this.icons.generate}<span>Generate Images</span>`;
        generateButton.addEventListener('click', async () => {
            try {
                generateButton.disabled = true;
                generateButton.innerHTML = `${this.icons.loading}<span>Generating...</span>`;
                await this.processBatchGeneration(entries);
                
                // Clean up overlays properly
                document.querySelectorAll('.batch-overlay, .ai-batch-overlay').forEach(overlay => {
                    overlay.remove();
                });
                document.body.style.overflow = '';  // Re-enable body scroll
                
            } catch (error) {
                console.error('Batch generation error:', error);
                this.showToast('Failed to start batch generation: ' + error.message, 'error');
                generateButton.disabled = false;
                generateButton.innerHTML = `${this.icons.generate}<span>Generate Images</span>`;
            }
        });

        actions.appendChild(generateButton);
        content.appendChild(reviewContainer);
        content.appendChild(actions);
    }

    // Set privacy mode
    setPrivacyMode(isPrivate) {
        this.isPrivate = isPrivate;
        localStorage.setItem('glifPrivateMode', isPrivate.toString());
    }

    // Initialize
    initialize() {
        // Add the batch generate button to the toolbar
        const toolbar = document.querySelector('.workflow-toolbar');
        if (toolbar) {
            const button = document.createElement('button');
            button.classList.add('ai-batch-button');
            button.innerHTML = `${this.icons.generate} Batch Generate`;
            button.onclick = () => this.showBatchPanel();
            toolbar.appendChild(button);
        }
    }

}

// Make it globally available
window.BatchGenerator = BatchGenerator;
