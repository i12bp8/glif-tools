(() => {
  console.log('[PrivacyToggle] PageScript loaded');

  // Get privacy state from localStorage
  const getPrivacyState = () => {
    const state = localStorage.getItem('glifPrivateMode');
    const isPrivate = state === null ? true : state === 'true'; // Compare as string
    console.log('[PrivacyToggle] Current privacy state:', isPrivate);
    return isPrivate;
  };

  // Listen for state changes from the UI
  window.addEventListener('privacyToggleChanged', (event) => {
    console.log('[PrivacyToggle] State changed:', event.detail.isPrivate);
  });

  // Inject styles for popup
  const style = document.createElement('style');
  style.textContent = `
    .glif-private-popup {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: white;
      border-radius: 12px;
      padding: 16px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease-out;
      width: 280px;
    }
    
    .glif-private-popup-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0;
    }
    
    .glif-private-popup-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 500;
      color: #000;
    }
    
    .glif-private-popup-close {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      color: #000;
      transition: opacity 0.2s;
      line-height: 1;
      font-size: 18px;
    }
    
    .glif-private-popup-close:hover {
      opacity: 0.7;
    }
    
    .glif-private-popup-image-container {
      background: white;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid #eee;
    }
    
    .glif-private-popup-image {
      width: 100%;
      border-radius: 4px;
      display: block;
    }
    
    .glif-private-popup-link {
      color: #000;
      text-decoration: none;
      font-size: 0.9rem;
      text-align: center;
      cursor: pointer;
      transition: opacity 0.2s;
      padding: 4px;
    }
    
    .glif-private-popup-link:hover {
      opacity: 0.7;
    }
    
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @media (prefers-color-scheme: dark) {
      .glif-private-popup,
      .glif-private-popup-image-container {
        background: white;
      }
      
      .glif-private-popup-title,
      .glif-private-popup-close,
      .glif-private-popup-link {
        color: #000;
      }
      
      .glif-private-popup-close:hover,
      .glif-private-popup-link:hover {
        opacity: 0.7;
      }
    }
  `;
  document.head.appendChild(style);

  // Create function in page context
  window.showGlifPrivatePopup = (imageUrl) => {
    console.log('[Popup] Creating popup for URL:', imageUrl);
    
    // Remove any existing popup
    const existingPopup = document.querySelector('.glif-private-popup');
    if (existingPopup) {
      console.log('[Popup] Removing existing popup');
      existingPopup.remove();
    }

    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'glif-private-popup';

    // Create header
    const header = document.createElement('div');
    header.className = 'glif-private-popup-header';
    
    const title = document.createElement('h3');
    title.className = 'glif-private-popup-title';
    title.textContent = 'Private Generation';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'glif-private-popup-close';
    closeButton.innerHTML = '✕';
    closeButton.onclick = () => popup.remove();
    
    header.appendChild(title);
    header.appendChild(closeButton);

    // Create image container with white background
    const imageContainer = document.createElement('div');
    imageContainer.className = 'glif-private-popup-image-container';
    
    // Create image element
    const img = document.createElement('img');
    img.className = 'glif-private-popup-image';
    img.src = imageUrl;
    imageContainer.appendChild(img);
    
    // Create link text
    const link = document.createElement('div');
    link.className = 'glif-private-popup-link';
    link.textContent = 'View Image';
    link.onclick = () => window.open(imageUrl, '_blank');

    // Add elements to popup
    popup.appendChild(header);
    popup.appendChild(imageContainer);
    popup.appendChild(link);

    // Add popup to page
    document.body.appendChild(popup);
    console.log('[Popup] Added popup to page');

    // Remove popup after 10 seconds
    setTimeout(() => {
      popup.remove();
      console.log('[Popup] Removed popup after timeout');
    }, 10000);
  };

  // Process stream response
  async function processStreamResponse(response, isPrivate, isBatchRun) {
    console.log('[Stream] Starting to process response stream');
    
    // Don't process stream for batch runs
    if (isBatchRun) {
      console.log('[Stream] Skipping stream processing for batch run');
      return;
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let imageUrls = new Set(); // Keep track of all unique image URLs
    let requestData = null;
    let spellRunData = null;
    let hasDispatchedEvent = false; // Track whether we've dispatched an event
    let chunks = []; // Store all chunks for complete response

    // Function to extract images from text
    const extractImagesFromText = (text) => {
      const urlRegex = /(https?:\/\/[^\s<>"]+?\.(?:jpg|jpeg|gif|png|webp))/gi;
      const matches = text.match(urlRegex) || [];
      matches.forEach(url => {
        imageUrls.add(url);
        console.log('[Stream] Found image URL in raw data:', url);
      });
    };

    // Get the request data from the URL
    try {
      const url = new URL(response.url);
      const requestBody = url.searchParams.get('requestBody');
      if (requestBody) {
        requestData = JSON.parse(decodeURIComponent(requestBody));
        console.log('[Stream] Found request data in URL:', requestData);
      }
    } catch (error) {
      console.error('[Stream] Error parsing request data from URL:', error);
    }

    const dispatchIfNeeded = () => {
      if (!hasDispatchedEvent && imageUrls.size > 0) {
        // Get all image URLs as an array
        const allImages = Array.from(imageUrls);
        // Use the last image URL for display (final output)
        const displayImageUrl = allImages[allImages.length - 1];
        
        console.log('[Stream] Dispatching images. Display image:', displayImageUrl, 'All images:', allImages);

        // Get all inputs
        const inputs = {
          ...requestData?.inputs,
          ...spellRunData?.inputs
        };

        // Get prompt from first input value
        const prompt = inputs && Object.keys(inputs).length > 0 ? 
                      inputs[Object.keys(inputs)[0]] : 
                      'No prompt available';
        
        console.log('[Stream] Using prompt from first input:', prompt);

        // Prepare event data
        const eventData = {
          imageUrl: displayImageUrl,
          type: isPrivate ? 'private' : 'public',
          prompt: prompt,
          metadata: {
            timestamp: new Date().toISOString(),
            spellRun: spellRunData,
            graphExecutionState: spellRunData?.graphExecutionState || {},
            inputs: inputs,
            nodeExecutions: spellRunData?.nodeExecutions || [],
            generatedPrompts: spellRunData?.generatedPrompts || [],
            allImageUrls: allImages,
            rawResponse: chunks.join('') // Include complete response
          }
        };

        console.log('[Stream] Preparing to dispatch image event with data:', eventData);
        
        window.dispatchEvent(new CustomEvent('glifImageGenerated', {
          detail: eventData
        }));
        
        hasDispatchedEvent = true;

        // Show popup for private runs
        if (isPrivate) {
          console.log('[Stream] Showing private run popup');
          window.showGlifPrivatePopup(displayImageUrl);
        }
      }
    };

    try {
      while (true) {
        const {done, value} = await reader.read();
        
        if (done) {
          console.log('[Stream] Stream processing complete');
          
          // Process the complete raw response
          console.log('[Stream] Processing complete raw response');
          const completeResponse = chunks.join('');
          extractImagesFromText(completeResponse);

          // If we have spellRunData but no images yet, try to get them from there
          if (spellRunData) {
            // Check final output
            if (spellRunData.output) {
              imageUrls.add(spellRunData.output);
              console.log('[Stream] Found image in final output:', spellRunData.output);
            }

            // Process the final graph execution state
            if (spellRunData.graphExecutionState) {
              extractImagesFromState(spellRunData.graphExecutionState);
            }

            // Dispatch if we haven't already
            dispatchIfNeeded();
          }
          break;
        }
        
        // Decode the chunk and add it to our buffer
        const chunk = decoder.decode(value, {stream: true});
        buffer += chunk;
        chunks.push(chunk); // Store chunk for complete response
        
        // Process any complete lines in the buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              console.log('[Stream] Received data:', data);

              // Extract any images from the raw line
              extractImagesFromText(line);

              // If we don't have request data yet, try to get it from the stream
              if (!requestData && data.inputs) {
                requestData = data;
                console.log('[Stream] Found request data in stream:', requestData);
              }

              // Update spellRun data if we get new information
              if (data.spellRun) {
                spellRunData = data.spellRun;
                console.log('[Stream] Updated spellRun data:', spellRunData);

                // Process graph execution state for images
                if (data.spellRun.graphExecutionState) {
                  extractImagesFromState(data.spellRun.graphExecutionState);
                }
              }
              
              // Check for direct image URL
              if (data.type === 'image' && data.url) {
                imageUrls.add(data.url);
                console.log('[Stream] Found image URL:', data.url);
              }
              
              // Check for completion with image URL
              if (data.spellRun?.completedAt) {
                // Add any final output image
                if (data.spellRun.output) {
                  imageUrls.add(data.spellRun.output);
                  console.log('[Stream] Found image in completed spell run:', data.spellRun.output);
                }
                spellRunData = data.spellRun;
                console.log('[Stream] Generation completed. Found images:', Array.from(imageUrls));
                
                // Process final graph execution state
                if (data.spellRun.graphExecutionState) {
                  extractImagesFromState(data.spellRun.graphExecutionState);
                }

                // Dispatch if we haven't already
                dispatchIfNeeded();
              }
            } catch (error) {
              console.error('[Stream] Error processing line:', error, 'Line:', line);
            }
          }
        }
      }
    } catch (error) {
      console.error('[Stream] Error reading stream:', error);
    }
  }
  
  function dispatchImageEvent(imageUrl, isPrivate, data) {
    console.log('[Stream] Preparing to dispatch image event with data:', data);
    
    // Get the first input value as the prompt
    let prompt = 'No prompt available';
    try {
      if (data.inputs) {
        // Get the first key that's not a system parameter
        const inputKey = Object.keys(data.inputs).find(key => 
          !['batchCount', 'amount', 'ar', 'schnell', 'choise'].includes(key)
        );
        if (inputKey) {
          prompt = data.inputs[inputKey];
        }
      }
    } catch (error) {
      console.error('[Stream] Error getting prompt from inputs:', error);
    }

    const eventData = {
      imageUrl,
      type: isPrivate ? 'private' : 'public',
      prompt,
      metadata: {
        timestamp: new Date().toISOString(),
        spellRun: data.spellRun || {},
        graphExecutionState: data.graphExecutionState || {},
        inputs: data.inputs || {},
        nodeExecutions: data.spellRun?.nodeExecutions || [],
        generatedPrompts: data.spellRun?.generatedPrompts || [],
        allImageUrls: Array.from(data.allImageUrls) // Store all found image URLs
      },
      responseData: data.rawResponse // Include raw response for additional processing
    };

    console.log('[Stream] Preparing to dispatch image event with data:', eventData);
    
    window.dispatchEvent(new CustomEvent('glifImageGenerated', {
      detail: eventData
    }));
  }

  // Override fetch
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [url, config] = args;
    
    if (url && url.toString().includes('/api/run-glif')) {
      console.log('[PrivacyToggle] Intercepted fetch request');
      console.log('[PrivacyToggle] URL:', url);
      console.log('[PrivacyToggle] Config:', config);
      
      const isPrivate = getPrivacyState();
      console.log('[PrivacyToggle] Is private:', isPrivate);
      
      // Clone the request to modify it
      const request = config ? { ...config } : {};
      let body = {};
      
      try {
        if (request.body) {
          body = JSON.parse(request.body);
          console.log('[PrivacyToggle] Original request:', body);
        }
      } catch (e) {
        console.error('[PrivacyToggle] Error parsing request body:', e);
      }
      
      // Check if this is a batch run
      const isBatchRun = body.inputs && body.inputs.batchCount > 1;
      console.log('[PrivacyToggle] Is batch run:', isBatchRun);
      
      // Update glifRunIsPublic based on privacy state
      body.glifRunIsPublic = !isPrivate;
      console.log('[PrivacyToggle] Modified request:', body);
      
      // Update the request config
      request.body = JSON.stringify(body);
      
      // Add request body to URL for stream processing
      const requestUrl = new URL(url.toString());
      requestUrl.searchParams.set('requestBody', encodeURIComponent(JSON.stringify(body)));
      
      console.log('[PrivacyToggle] Making modified request...');
      const response = await originalFetch(requestUrl, request);
      console.log('[PrivacyToggle] Got response:', response);
      
      // Clone the response to process the stream
      const clonedResponse = response.clone();
      
      // Process the stream in the background
      processStreamResponse(clonedResponse, isPrivate, isBatchRun).catch(error => {
        console.error('[PrivacyToggle] Error processing stream:', error);
      });
      
      return response;
    }
    
    return originalFetch.apply(this, args);
  };

  // Override XMLHttpRequest
  const XHR = XMLHttpRequest.prototype;
  const originalOpen = XHR.open;
  const originalSend = XHR.send;

  XHR.open = function(...args) {
    this._url = args[1];
    return originalOpen.apply(this, args);
  };

  XHR.send = function(body) {
    if (this._url && this._url.includes('/api/run-glif') && body) {
      try {
        const isPrivate = getPrivacyState();
        console.log('[PrivacyToggle] Intercepted XHR request, isPrivate:', isPrivate);
        
        const data = JSON.parse(body);
        console.log('[PrivacyToggle] Original XHR request:', data);
        
        // Check if this is a batch run
        const isBatchRun = data.hasOwnProperty('batchSize') || 
                          data.hasOwnProperty('batchId') || 
                          this._url.includes('batch') ||
                          data.inputs?.hasOwnProperty('batchSize') ||
                          data.inputs?.hasOwnProperty('amount') ||
                          // Check if called from batch generator
                          (new Error().stack || '').includes('BatchGenerator');
                          
        console.log('[PrivacyToggle] Is batch run:', isBatchRun);
        
        // Always set glifRunIsPublic based on privacy state
        data.glifRunIsPublic = !isPrivate;
        console.log('[PrivacyToggle] Modified XHR request:', data);
        body = JSON.stringify(data);
      } catch (e) {
        console.error('[PrivacyToggle] Error modifying XHR request:', e);
      }
    }
    return originalSend.call(this, body);
  };

  // Also try to intercept any form submissions
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (form.action && form.action.includes('/api/run-glif')) {
      try {
        const isPrivate = getPrivacyState();
        const formData = new FormData(form);
        formData.set('glifRunIsPublic', (!isPrivate).toString());
        console.log('[PrivacyToggle] Modified form submission, isPrivate:', isPrivate);
      } catch (e) {
        console.error('[PrivacyToggle] Error modifying form submission:', e);
      }
    }
  }, true);

  console.log('[PrivacyToggle] Request interception initialized');

  // Initialize tools when page loads
  const initializeTools = () => {
    console.log('[Tools] Initializing tools...');
    
    // Initialize batch generator
    if (window.BatchGenerator) {
      console.log('[Tools] Initializing batch generator');
      const batchGenerator = new BatchGenerator();
      batchGenerator.initialize();
    }

    // Initialize image history
    if (window.ImageHistory) {
      console.log('[Tools] Initializing image history');
      window.imageHistory = new ImageHistory();
      window.imageHistory.initialize();
    }
  };

  // Call initialize on page load
  initializeTools();

  // Handle URL changes
  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      console.log('[Navigation] URL changed from', lastUrl, 'to', currentUrl);
      lastUrl = currentUrl;
      
      // Wait for the page to settle
      setTimeout(() => {
        console.log('[Navigation] Reinitializing tools after URL change');
        initializeTools();
      }, 500);
    }
  });

  // Start observing URL changes
  urlObserver.observe(document, { subtree: true, childList: true });

  // Also listen for popstate and pushstate events
  ['popstate', 'pushState', 'replaceState'].forEach(eventType => {
    window.addEventListener(eventType, () => {
      console.log(`[Navigation] ${eventType} event detected`);
      setTimeout(() => {
        console.log('[Navigation] Reinitializing tools after navigation event');
        initializeTools();
      }, 500);
    });
  });

  // Override history methods to detect programmatic navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function() {
    originalPushState.apply(this, arguments);
    console.log('[Navigation] pushState called');
    setTimeout(() => {
      console.log('[Navigation] Reinitializing tools after pushState');
      initializeTools();
    }, 500);
  };

  history.replaceState = function() {
    originalReplaceState.apply(this, arguments);
    console.log('[Navigation] replaceState called');
    setTimeout(() => {
      console.log('[Navigation] Reinitializing tools after replaceState');
      initializeTools();
    }, 500);
  };
})();
