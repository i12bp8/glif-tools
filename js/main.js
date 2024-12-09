// Main entry point for the extension
(async function() {
    'use strict';

    // Initialize debug logging
    const DEBUG = true;
    const debugLog = (context, data = {}) => {
        if (!DEBUG) return;
        console.log(`[DEBUG ${new Date().toISOString()}] ${context}`, data);
    };

    // Initialize privacy state with debugging
    const initializePrivacyState = () => {
        debugLog('Initializing privacy state');
        const storedValue = localStorage.getItem('glifPrivateMode');
        if (storedValue === null) {
            debugLog('No stored privacy value, setting default to true');
            localStorage.setItem('glifPrivateMode', 'true');
        }
        const isPrivate = localStorage.getItem('glifPrivateMode') === 'true';
        debugLog('Privacy state initialized', { isPrivate, storedValue });
        return { isPrivate, storedValue };
    };

    // Call initialization early
    initializePrivacyState();

    // Add image popup styles
    const popupStyles = `
        .final-image-popup {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            padding: 12px;
            max-width: 300px;
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s ease;
        }
        .final-image-popup.visible {
            opacity: 1;
            transform: translateY(0);
        }
        .final-image-popup img {
            width: 100%;
            height: auto;
            border-radius: 8px;
            margin-bottom: 8px;
        }
        .final-image-popup .popup-content {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .final-image-popup .open-new-tab {
            padding: 8px 12px;
            background: #f3f4f6;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            color: #374151;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
        .final-image-popup .open-new-tab:hover {
            background: #e5e7eb;
        }
    `;
    const styleElement = document.createElement('style');
    styleElement.textContent = popupStyles;
    document.head.appendChild(styleElement);

    // Show image popup function
    window.showImagePopup = function(imageUrl) {
        // Check if we're in batch mode or private mode
        const batchGenerator = window.batchGenerator;
        if (batchGenerator?.isBatchMode || localStorage.getItem('glifPrivateMode') === 'true') {
            console.debug('[Popup] Skipping popup due to batch mode or private mode');
            return;
        }

        console.debug('[Popup] Creating popup for URL:', imageUrl);
        
        // Remove existing popup if any
        const existingPopup = document.querySelector('.final-image-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        const popup = document.createElement('div');
        popup.className = 'final-image-popup';
        popup.innerHTML = `
            <div class="popup-content">
                <img src="${imageUrl}" alt="Generated Image" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text x=%2212%22 y=%2212%22 text-anchor=%22middle%22>⚠️</text></svg>'" />
                <button class="open-new-tab" onclick="window.open('${imageUrl}', '_blank')">
                    ${GLIF_ICONS.globe}
                    <span>Open in New Tab</span>
                </button>
            </div>
        `;

        document.body.appendChild(popup);
        
        // Force reflow to trigger animation
        popup.offsetHeight;
        requestAnimationFrame(() => popup.classList.add('visible'));

        // Auto-remove after 10 seconds
        setTimeout(() => {
            popup.classList.remove('visible');
            setTimeout(() => popup.remove(), 300);
        }, 10000);
    };

    // Process stream response
    async function processStreamResponse(response) {
        const reader = response.body.getReader();
        let lastImageUrl = null;
        let isCompleted = false;
        let nodeExecutions = [];
        let generatedPrompts = [];
        let responseText = '';
        let latestData = null;
        let spellRunId = null;
        let startTime = Date.now();

        // Get the current prompt from the form
        const promptField = document.querySelector('textarea[name="prompt"]');
        console.log('[Stream] Found prompt field:', !!promptField);
        const currentPrompt = promptField ? promptField.value : '';
        console.log('[Stream] Current prompt:', currentPrompt);

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                responseText += chunk; // Accumulate the raw response
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data: ')) continue;
                    
                    try {
                        const jsonStr = line.slice(6);
                        const data = JSON.parse(jsonStr);
                        
                        // Store the latest complete data object
                        if (data.spellRun) {
                            latestData = data;
                            spellRunId = data.spellRun.id;
                        }

                        // Collect node executions
                        if (data.spellRun?.graphExecutionState?.nodes) {
                            nodeExecutions.push({
                                timestamp: new Date().toISOString(),
                                nodes: data.spellRun.graphExecutionState.nodes
                            });
                        }

                        // Collect generated prompts
                        if (data.generatedPrompts) {
                            generatedPrompts.push(...data.generatedPrompts);
                        }

                        // Direct image URL in data
                        if (data.type === 'image' && data.url) {
                            console.log('[Stream] Found direct image URL:', data.url);
                            lastImageUrl = data.url;
                        }
                        
                        // Check in spell run state
                        if (data.spellRun?.graphExecutionState) {
                            const state = data.spellRun.graphExecutionState;
                            console.log('[Stream] Processing graph execution state:', {
                                status: state.status,
                                hasFinalOutput: !!state.finalOutput,
                                hasNodes: !!state.nodes
                            });
                            
                            // Check final output first
                            if (state.finalOutput?.type === 'IMAGE') {
                                console.log('[Stream] Found image in final output:', state.finalOutput.value);
                                lastImageUrl = state.finalOutput.value;
                            }
                            
                            // Check all nodes for image outputs
                            if (state.nodes) {
                                Object.entries(state.nodes).forEach(([nodeName, node]) => {
                                    if (node.output?.type === 'IMAGE') {
                                        console.log('[Stream] Found image in node:', nodeName, node.output.value);
                                        
                                        // Check if this is an output node
                                        const isOutputNode = !Object.values(state.nodes).some(otherNode =>
                                            otherNode.inputs && Object.values(otherNode.inputs).some(input =>
                                                input.connectionId && input.connectionId.startsWith(nodeName)
                                            )
                                        );
                                        
                                        if (isOutputNode) {
                                            console.log('[Stream] Node is an output node, using its image URL');
                                            lastImageUrl = node.output.value;
                                        }
                                    }
                                });
                            }
                        }

                        // Check for completion
                        if (data.spellRun?.completedAt || data.type === 'complete') {
                            console.log('[Stream] Generation completed. Current state:', {
                                hasLastImageUrl: !!lastImageUrl,
                                lastImageUrl,
                                hasImageHistory: !!window.imageHistory,
                                isPrivateMode: localStorage.getItem('glifPrivateMode') === 'true'
                            });
                            
                            isCompleted = true;
                            const endTime = Date.now();
                            
                            // Add image to history if it's a successful generation
                            if (lastImageUrl && window.imageHistory) {
                                const historyData = {
                                    imageUrl: lastImageUrl,
                                    type: localStorage.getItem('glifPrivateMode') === 'true' ? 'private' : 'public',
                                    prompt: currentPrompt,
                                    metadata: {
                                        timestamp: new Date().toISOString(),
                                        duration: endTime - startTime,
                                        spellRun: latestData?.spellRun ? {
                                            id: latestData.spellRun.id,
                                            createdAt: latestData.spellRun.createdAt,
                                            startedAt: latestData.spellRun.startedAt,
                                            completedAt: latestData.spellRun.completedAt,
                                            status: latestData.spellRun.status,
                                            inputs: latestData.spellRun.inputs,
                                            outputs: latestData.spellRun.outputs,
                                            spell: latestData.spellRun.spell,
                                            public: latestData.spellRun.public,
                                            clientType: latestData.spellRun.clientType,
                                            totalDuration: latestData.spellRun.totalDuration,
                                            outputImageWidth: latestData.spellRun.outputImageWidth,
                                            outputImageHeight: latestData.spellRun.outputImageHeight
                                        } : null,
                                        user: latestData?.user,
                                        graphState: latestData?.spellRun?.graphExecutionState ? {
                                            status: latestData.spellRun.graphExecutionState.status,
                                            nodes: Object.entries(latestData.spellRun.graphExecutionState.nodes || {}).reduce((acc, [key, node]) => {
                                                acc[key] = {
                                                    status: node.status,
                                                    output: node.output,
                                                    inputs: node.inputs,
                                                    error: node.error,
                                                    type: node.type,
                                                    position: node.position
                                                };
                                                return acc;
                                            }, {})
                                        } : null,
                                        nodeExecutions: nodeExecutions.length > 0 ? nodeExecutions : null,
                                        generatedPrompts: generatedPrompts.length > 0 ? [...new Set(generatedPrompts)] : null,
                                        modelSettings: latestData?.modelSettings || null,
                                        streamResponse: responseText
                                    }
                                };

                                console.log('[Main] Image generation completed. History data:', {
                                    imageUrl: historyData.imageUrl,
                                    type: historyData.type,
                                    prompt: historyData.prompt,
                                    hasMetadata: !!historyData.metadata,
                                    metadata: historyData.metadata
                                });
                                
                                try {
                                    await window.imageHistory.addToHistory(historyData);
                                    console.log('[Main] Successfully called addToHistory');
                                } catch (error) {
                                    console.error('[Main] Error saving to history:', error);
                                }
                            } else {
                                console.log('[Main] Not saving to history:', {
                                    hasImageUrl: !!lastImageUrl,
                                    hasImageHistory: !!window.imageHistory,
                                    currentPrompt
                                });
                            }
                        }

                    } catch (e) {
                        console.error('[Stream] Error parsing data:', e, 'Line:', line);
                    }

                }
            }
        } catch (e) {
            console.error('[Stream] Error processing stream:', e);
            throw e;
        }

        return lastImageUrl;
    }

    // Process stream response for private runs
    const processPrivateStreamResponse = async (response) => {
        try {
            if (!response.ok) {
                console.warn('Non-ok response in private run:', response.status);
                return;
            }

            const promptField = document.querySelector('textarea[name="prompt"]');
            const currentPrompt = promptField ? promptField.value : '';

            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                const jsonData = await response.json();
                
                const displayImageUrl = jsonData.displayImageUrl || 
                    (jsonData.result && jsonData.result.displayImageUrl);
                
                if (displayImageUrl) {
                    window.showImagePopup(displayImageUrl);

                    // Add image to history
                    if (window.imageHistory) {
                        window.imageHistory.addToHistory({
                            imageUrl: displayImageUrl,
                            type: 'private',
                            prompt: currentPrompt,
                            metadata: {
                                nodeExecutions: jsonData.nodeExecutions || [],
                                generatedPrompts: jsonData.generatedPrompts || [],
                                responseText: JSON.stringify(jsonData)
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error processing private run response:', error);
        }
    };

    // Create a notification for private runs
    const createPrivateRunNotification = (responseText) => {
        // Create a modal or popup for private run details
        const modal = document.createElement('div');
        modal.className = 'private-run-modal';
        modal.innerHTML = `
            <div class="private-run-content">
                <h2> Private Run Details</h2>
                <p>This run was generated in private mode.</p>
                <pre>${responseText}</pre>
                <button class="close-modal">Close</button>
            </div>
        `;

        // Style the modal
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 1000;
            max-width: 80%;
            max-height: 80%;
            overflow: auto;
        `;

        // Add close functionality
        const closeButton = modal.querySelector('.close-modal');
        closeButton.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Add to body
        document.body.appendChild(modal);
    };

    // Initialize batch generator
    window.batchGenerator = new BatchGenerator();

    // Initialize search runs panel
    if (window.location.pathname.includes('/glifs/')) {
        const searchRunPanel = new SearchRunPanel();
    }

    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        
        // Check if this is a run-glif request
        if (args[0]?.toString().includes('/api/run-glif')) {
            const batchGenerator = window.batchGenerator;
            const isPrivate = localStorage.getItem('glifPrivateMode') === 'true';
            const isBatchMode = batchGenerator?.isBatchMode || false;
            
            // Clone the response since we need to read it twice
            const clonedResponse = response.clone();
            
            // Only process for popups if not in batch mode and not private
            if (!isBatchMode && !isPrivate) {
                processStreamResponse(clonedResponse);
            }
            
            return response;
        }
        return response;
    };

    // Wait for the Run This Glif button to be ready
    const waitForRunButton = () => {
        return new Promise((resolve) => {
            const checkButton = () => {
                const button = document.querySelector('button[type="submit"]:not([aria-hidden="true"])');
                const timeEstimate = button?.closest('.relative')?.querySelector('.mt-2.flex.justify-center');
                const buttonContainer = button?.closest('.relative');
                if (button && timeEstimate && buttonContainer) {
                    resolve({ button, timeEstimate, buttonContainer });
                } else {
                    setTimeout(checkButton, 100);
                }
            };
            checkButton();
        });
    };

    // Add buttons function
    const addButtons = async () => {
        debugLog('addButtons called');
        const { button: runButton, timeEstimate, buttonContainer } = await waitForRunButton();
        debugLog('waitForRunButton results', { 
            hasRunButton: !!runButton, 
            hasTimeEstimate: !!timeEstimate, 
            hasContainer: !!buttonContainer,
            runButtonClasses: runButton?.className,
            runButtonId: runButton?.id
        });
        
        if (!runButton || !timeEstimate || !buttonContainer) {
            debugLog('Missing required elements, returning');
            return;
        }

        // Create container for all buttons
        let toolsContainer = document.querySelector('.glif-tools-buttons');
        if (!toolsContainer) {
            debugLog('Creating new tools container');
            toolsContainer = document.createElement('div');
            toolsContainer.className = 'glif-tools-buttons';
            toolsContainer.style.cssText = `
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                gap: 8px !important;
                margin-bottom: 12px !important;
                width: 100% !important;
                min-height: 42px !important;
            `;
            buttonContainer.insertBefore(toolsContainer, buttonContainer.firstChild);
        }

        const buttonStyles = `
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            flex: 1 !important;
            height: 42px !important;
            min-height: 42px !important;
            border-radius: 8px !important;
            border: none !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            outline: none !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            &:hover {
                background: #f5f5f5 !important;
            }
        `;

        // Create container for privacy toggle
        const privacyContainer = document.createElement('div');
        privacyContainer.className = 'privacy-toggle-container';
        privacyContainer.style.cssText = `
            flex: 1 !important;
            display: flex !important;
            align-items: center !important;
            min-height: 42px !important;
            height: 42px !important;
            line-height: 1 !important;
            margin: 0 !important;
            padding: 0 !important;
        `;

        // Initialize privacy toggle class
        try {
            window.privacyToggle = new PrivacyToggle();
            // The PrivacyToggle class will create and manage its own button
            const privacyToggleContainer = document.querySelector('.privacy-toggle-container');
            if (privacyToggleContainer) {
                privacyToggleContainer.style.cssText = `
                    flex: 1 !important;
                    display: flex !important;
                    align-items: center !important;
                    min-height: 42px !important;
                    height: 42px !important;
                    line-height: 1 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                `;

                const privacyButton = privacyToggleContainer.querySelector('button');
                if (privacyButton) {
                    const updateButtonStyle = (isPrivate) => {
                        const baseStyles = `
                            display: inline-flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                            flex: 1 !important;
                            height: 42px !important;
                            min-height: 42px !important;
                            max-height: 42px !important;
                            line-height: 1 !important;
                            border-radius: 8px !important;
                            border: none !important;
                            cursor: pointer !important;
                            transition: all 0.2s ease !important;
                            outline: none !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            vertical-align: middle !important;
                            ${isPrivate ? 
                                'background: #ef4444 !important; color: white !important;' : 
                                'background: white !important; color: black !important;'
                            }
                        `;
                        privacyButton.style.cssText = baseStyles;
                        
                        const globeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;

                        const lockIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

                        privacyButton.innerHTML = `
                            <span style="display: inline-flex !important; align-items: center !important; gap: 6px !important; line-height: 1 !important; margin: 0 !important; padding: 0 !important; vertical-align: middle !important;">
                                ${isPrivate ? lockIcon : globeIcon}
                                <span style="line-height: 1 !important; margin: 0 !important; padding: 0 !important;">${isPrivate ? 'Private' : 'Public'}</span>
                            </span>
                        `;
                    };

                    // Set up observer for style changes
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            if (mutation.type === 'attributes' && mutation.attributeName === 'data-private') {
                                const isPrivate = privacyButton.getAttribute('data-private') === 'true';
                                updateButtonStyle(isPrivate);
                            }
                        });
                    });
                    observer.observe(privacyButton, { attributes: true });

                    // Initial style
                    const isPrivate = privacyButton.getAttribute('data-private') === 'true';
                    updateButtonStyle(isPrivate);
                }
                toolsContainer.appendChild(privacyToggleContainer);
            }
        } catch (error) {
            console.error('[DEBUG] Error initializing privacy toggle:', error);
        }

        // Add batch generator button with proper styling
        const batchButton = document.createElement('button');
        batchButton.type = 'button';
        batchButton.className = 'ai-batch-button';
        batchButton.style.cssText = buttonStyles;
        batchButton.style.flex = '1';
        batchButton.innerHTML = `
            <span style="display: inline-flex !important; align-items: center !important; gap: 6px !important; line-height: 1 !important; margin: 0 !important; padding: 0 !important; vertical-align: middle !important;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="8" height="8"/><rect x="14" y="2" width="8" height="8"/><rect x="2" y="14" width="8" height="8"/><rect x="14" y="14" width="8" height="8"/></svg>
                <span style="line-height: 1 !important; margin: 0 !important; padding: 0 !important;">Batch</span>
            </span>
        `;
        batchButton.title = 'Multiple Generations';
        batchButton.addEventListener('click', (e) => {
            e.preventDefault();
            window.batchGenerator.showBatchPanel();
        });
        toolsContainer.appendChild(batchButton);

        // Create a styled clone of the Run This Glif button
        const styledRunButton = document.createElement('button');
        styledRunButton.type = 'button';
        styledRunButton.className = 'styled-run-button';
        styledRunButton.style.cssText = buttonStyles;
        styledRunButton.style.flex = '1';
        styledRunButton.innerHTML = `
            <span style="display: inline-flex !important; align-items: center !important; gap: 6px !important; line-height: 1 !important; margin: 0 !important; padding: 0 !important; vertical-align: middle !important;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none"/></svg>
                <span style="line-height: 1 !important; margin: 0 !important; padding: 0 !important;">Run</span>
            </span>
        `;
        styledRunButton.title = 'Run This Glif';

        // Add click handler to trigger the original button
        styledRunButton.addEventListener('click', (e) => {
            debugLog('Styled run button clicked');
            e.preventDefault();
            
            const originalButton = document.querySelector('button[type="submit"]');
            debugLog('Triggering original button click', {
                originalButtonExists: !!originalButton,
                originalButtonVisible: originalButton?.style.display !== 'none',
                originalButtonClasses: originalButton?.className
            });
            
            if (originalButton) {
                originalButton.click();
            }
        });

        toolsContainer.appendChild(styledRunButton);

        // Hide the original run button but keep it in the DOM
        runButton.style.display = 'none';
        debugLog('Original run button hidden', {
            buttonDisplay: runButton.style.display,
            buttonClasses: runButton.className,
            buttonParent: runButton.parentElement?.className
        });

        // Move time estimate below the buttons
        timeEstimate.style.textAlign = 'center';
        timeEstimate.style.marginTop = '0.75rem';
        buttonContainer.appendChild(timeEstimate);
    };

    // Wait for the navigation bar to be ready
    const waitForNavbar = () => {
        return new Promise((resolve) => {
            const checkNavbar = () => {
                const navbar = document.querySelector('nav .flex.gap-3.md\\:gap-\\[44px\\]');
                if (navbar) {
                    resolve(navbar);
                } else {
                    setTimeout(checkNavbar, 100);
                }
            };
            checkNavbar();
        });
    };

    try {
        // Initialize navbar component
        const navbarSection = await waitForNavbar();
        const glifNavbar = new GlifNavbar();
        const toolsDropdown = await glifNavbar.init();

        console.log('[Main] Creating ImageHistory instance');
        // Initialize history component
        window.imageHistory = new ImageHistory();
        console.log('[Main] ImageHistory instance created:', !!window.imageHistory);

        // Listen for image generation events
        window.addEventListener('glifImageGenerated', async (event) => {
            debugLog('glifImageGenerated event received', { event });
            
            if (window.imageHistory && event.detail.imageUrl) {
                try {
                    await window.imageHistory.addToHistory(event.detail);
                    console.log('[Main] Successfully added image to history');
                } catch (error) {
                    console.error('[Main] Error adding image to history:', error);
                }
            } else {
                console.warn('[Main] Could not save image to history:', {
                    hasImageHistory: !!window.imageHistory,
                    hasImageUrl: !!event.detail?.imageUrl
                });
            }
        });

        // Add the tools dropdown to the navbar section
        if (toolsDropdown && navbarSection) {
            debugLog('Adding tools dropdown to navbar');
            navbarSection.appendChild(toolsDropdown);
        }

        // Keep track of the current observer
        let currentObserver = null;

        // Function to cleanup on navigation
        const cleanup = () => {
            if (currentObserver) {
                currentObserver.disconnect();
                currentObserver = null;
            }
        };

        // Function to initialize on Glif page
        const initializeGlifPage = async () => {
            debugLog('Initializing Glif page');
            
            // Clean up any existing observers
            cleanup();

            // Only proceed if we're on a Glif page
            if (!window.location.pathname.includes('/glifs/')) {
                debugLog('Not a Glif page, skipping initialization');
                return;
            }

            try {
                // Wait a moment for the DOM to be ready
                await new Promise(resolve => setTimeout(resolve, 100));

                // Add the buttons if they don't exist
                if (!document.querySelector('.glif-tools-buttons')) {
                    await addButtons();
                    debugLog('Buttons added successfully');
                }

                // Watch for changes to the run button container
                const buttonContainer = document.querySelector('button[type="submit"]')?.closest('.relative');
                if (buttonContainer) {
                    debugLog('Setting up button container observer');
                    
                    // Keep track of whether we're currently adding buttons
                    let isAddingButtons = false;
                    
                    currentObserver = new MutationObserver(async (mutations) => {
                        // Skip if we're currently adding buttons
                        if (isAddingButtons) {
                            return;
                        }

                        const isGlifPage = window.location.pathname.includes('/glifs/');
                        const hasButtons = document.querySelector('.glif-tools-buttons');
                        const hasRunButton = document.querySelector('button[type="submit"]');
                        
                        debugLog('Button container changed', { 
                            isGlifPage, 
                            hasButtons, 
                            hasRunButton,
                            mutationCount: mutations.length 
                        });
                        
                        if (isGlifPage && hasRunButton && !hasButtons) {
                            isAddingButtons = true;
                            try {
                                await addButtons();
                            } finally {
                                isAddingButtons = false;
                            }
                        }
                    });

                    // Observe the button container
                    currentObserver.observe(buttonContainer, {
                        childList: true,
                        subtree: true
                    });
                    debugLog('Button container observer set up');
                } else {
                    debugLog('Button container not found');
                }
            } catch (error) {
                console.error('Error initializing Glif page:', error);
            }
        };

        // Initialize on current page if it's a Glif page
        if (window.location.pathname.includes('/glifs/')) {
            debugLog('Initial page is a Glif page, initializing');
            await initializeGlifPage();
        }

        // Debounce function to prevent rapid re-initialization
        const debounce = (func, wait) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        };

        // Debounced version of initializeGlifPage
        const debouncedInitialize = debounce(initializeGlifPage, 250);

        // Watch for navigation changes
        const navigationObserver = new MutationObserver(async (mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    const runButton = document.querySelector('button[type="submit"]');
                    const hasButtons = document.querySelector('.glif-tools-buttons');
                    
                    if (runButton && window.location.pathname.includes('/glifs/') && !hasButtons) {
                        debugLog('Navigation detected to Glif page');
                        debouncedInitialize();
                        break;
                    }
                }
            }
        });

        // Observe the main content area for navigation changes
        const mainContent = document.querySelector('main');
        if (mainContent) {
            debugLog('Setting up navigation observer');
            navigationObserver.observe(mainContent, {
                childList: true,
                subtree: true
            });
        }
    } catch (error) {
        console.error('Error initializing GLIF Tools:', error);
    }
})();
