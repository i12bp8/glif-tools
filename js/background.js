// Initialize the dynamic rule
chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1, 2],
    addRules: [{
        id: 1,
        priority: 1,
        action: {
            type: 'modifyHeaders',
            requestHeaders: [{
                header: 'X-Glif-Private',
                operation: 'set',
                value: 'true'
            }]
        },
        condition: {
            urlFilter: '*glif.app/api/run-glif*',
            resourceTypes: ['xmlhttprequest']
        }
    }]
});

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'UPDATE_PRIVACY') {
        const isPrivate = request.isPrivate;
        
        // Update the dynamic rules based on privacy state
        chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [1, 2],
            addRules: isPrivate ? [
                {
                    id: 1,
                    priority: 1,
                    action: {
                        type: 'modifyHeaders',
                        requestHeaders: [{
                            header: 'X-Glif-Private',
                            operation: 'set',
                            value: 'true'
                        }]
                    },
                    condition: {
                        urlFilter: '*glif.app/api/run-glif*',
                        resourceTypes: ['xmlhttprequest']
                    }
                },
                {
                    id: 2,
                    priority: 2,
                    action: {
                        type: 'modifyHeaders',
                        requestHeaders: [{
                            header: 'X-Glif-Public',
                            operation: 'set',
                            value: 'false'
                        }]
                    },
                    condition: {
                        urlFilter: '*glif.app/api/run-glif*',
                        method: 'POST',
                        resourceTypes: ['xmlhttprequest']
                    }
                }
            ] : []
        }).then(() => {
            console.log('[Background] Updated privacy rules:', { isPrivate });
            sendResponse({ success: true });
        }).catch(error => {
            console.error('[Background] Error updating rules:', error);
            sendResponse({ success: false, error: error.message });
        });
        
        // Keep the message channel open for the async response
        return true;
    }
});
