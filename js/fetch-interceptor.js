// Store original fetch
const originalFetch = window.fetch;

// Create a map to store pending requests
const pendingRequests = new Map();
let requestId = 0;

// Override fetch
window.fetch = async (...args) => {
    const [resource, config] = args;
    const url = (resource instanceof Request ? resource.url : resource).toString();

    // Only intercept glif run requests
    if (url.includes('/api/run-glif')) {
        // Generate a unique request ID
        const currentRequestId = requestId++;
        
        // Create a promise that will be resolved when we get a response
        const responsePromise = new Promise((resolve) => {
            pendingRequests.set(currentRequestId, resolve);
        });

        // Send request for modification
        window.postMessage({
            type: 'GLIF_FETCH_REQUEST',
            url,
            config,
            requestId: currentRequestId
        }, '*');

        // Wait for the modified config
        const modifiedConfig = await responsePromise;
        console.log('[Fetch Interceptor] Using config:', modifiedConfig);
        
        // Make the fetch with modified config
        return originalFetch(resource, modifiedConfig);
    }

    // Pass through all other requests
    return originalFetch(...args);
};

// Listen for responses
window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data.type === 'GLIF_FETCH_RESPONSE') {
        const { requestId, config } = event.data;
        const resolve = pendingRequests.get(requestId);
        if (resolve) {
            resolve(config);
            pendingRequests.delete(requestId);
        }
    }
});

console.log('[Fetch Interceptor] Initialized');
