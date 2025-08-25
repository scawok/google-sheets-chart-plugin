figma.showUI(__html__, { width: 400, height: 600 });

// Constants
const DEFAULT_CHART_NAME = 'Google Sheets Chart';
const DEFAULT_CHART_SIZE = { width: 800, height: 500 };
const CHART_ID_PREFIX = 'chart_';
const SELECTION_REFRESH_DELAY = 100;

// Helper function to send status messages to UI
function sendStatusMessage(message: string, statusType: 'success' | 'error' | 'info' | 'warning' | 'processing' = 'info') {
  try { 
    figma.ui.postMessage({ type: 'status', message, statusType }); 
  } catch (error) {
    console.warn('Failed to send status message:', error);
  }
}

// Helper function to show notification (Figma doesn't support auto-clearing)
function showNotification(message: string, options: { error?: boolean } = {}) {
  const { error = false } = options;
  figma.notify(message, { error });
}

interface ChartData {
  url: string;
  name: string;
  lastUpdated: string;
  id: string; // Unique identifier for each chart
}

// Helper function to fetch image data with CORS handling
async function fetchImageData(imageUrl: string): Promise<{
  imageBuffer: ArrayBuffer;
  contentType: string;
}> {
  console.log('[FETCH-IMAGE] Starting fetch for URL:', imageUrl);
  let response: Response;
  
  // Always use proxy for Google Docs to avoid CORS issues
  if (/^https?:\/\/docs\.google\.com\//i.test(imageUrl)) {
    const proxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl.replace(/^https?:\/\//, ''))}`;
    console.log('[FETCH-IMAGE] Using proxy for Google Docs:', proxiedUrl);
    response = await fetch(proxiedUrl, { redirect: 'follow' as RequestRedirect });
  } else {
    try {
      console.log('[FETCH-IMAGE] Attempting direct fetch...');
      response = await fetch(imageUrl, { redirect: 'follow' as RequestRedirect });
      const headers = response.headers;
      console.log('[FETCH-IMAGE] Direct fetch response status:', response.status, 'CORS header:', headers ? headers.get('access-control-allow-origin') : 'undefined');
      if (!response.ok || !(headers && headers.get ? headers.get('access-control-allow-origin') || '' : '').includes('*')) {
        throw new Error('CORS-fallback');
      }
    } catch (e) {
      console.log('[FETCH-IMAGE] Direct fetch failed, using proxy:', e);
      const proxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl.replace(/^https?:\/\//, ''))}`;
      response = await fetch(proxiedUrl, { redirect: 'follow' as RequestRedirect });
    }
  }
  
  console.log('[FETCH-IMAGE] Final response status:', response.status, 'Content-Type:', response.headers ? response.headers.get('content-type') : 'undefined');
  
  if (!response.ok) {
    console.error('[FETCH-IMAGE] Response not OK:', response.status, response.statusText);
    throw new Error(`Network error ${response.status}: ${response.statusText}. URL: ${imageUrl}`);
  }
  
  const headers = response.headers;
  const contentType = headers && headers.get ? headers.get('content-type') || '' : '';
  const imageBuffer = await response.arrayBuffer();
  
  console.log('[FETCH-IMAGE] Successfully fetched image, size:', imageBuffer.byteLength, 'bytes');
  
  return { imageBuffer, contentType };
}

// Helper function to validate image data
function validateImageData(imageBuffer: ArrayBuffer, contentType: string, imageUrl: string): void {
  const isImageByType = contentType.toLowerCase().startsWith('image/') || 
                        contentType.toLowerCase() === 'application/octet-stream';
  const isPngByMagic = contentType === '' && imageBuffer && 
                       new Uint8Array(imageBuffer).slice(0, 8).every((byte, i) => 
                         [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A][i] === byte
                       );
  
  if (!isImageByType && !isPngByMagic) {
    const uint8Array = new Uint8Array(imageBuffer);
    const text = Array.from(uint8Array.slice(0, 200), byte => String.fromCharCode(byte)).join('');
    const snippet = text.replace(/\s+/g, ' ');
    throw new Error(`Expected image content-type but got: ${contentType}. URL: ${imageUrl}. Body starts: ${snippet}`);
  }
}

// Helper function to get file-specific storage key
function getFileStorageKey(): string {
  return `charts_${figma.fileKey}`;
}



// Helper function to send charts with file context
async function sendChartsWithContext() {
  const storageKey = getFileStorageKey();
  const charts: ChartData[] = await figma.clientStorage.getAsync(storageKey) || [];
  
  const fileContext = {
    fileName: figma.root.name,
    fileKey: figma.fileKey,
    chartCount: charts.length
  };
  try {
    figma.ui.postMessage({ type: 'load-charts', charts, fileContext });
  } catch (error) {
    console.warn('Failed to send charts with context:', error);
  }
}

// Initial load of chart data with file context
sendChartsWithContext();

// Refresh context when plugin becomes active (file switching)
figma.on('run', () => {
  sendChartsWithContext();
});

// Helper function to get chart data from node's plugin data
function getChartDataFromNode(node: SceneNode): ChartData | null {
  try {
    const pluginData = node.getPluginData('chartData');
    if (pluginData) {
      return JSON.parse(pluginData);
    }
  } catch (error) {
    console.warn('Failed to parse chart data from node:', error);
  }
  return null;
}

// Helper function to set chart data in node's plugin data
function setChartDataInNode(node: SceneNode, chartData: ChartData): void {
  try {
    node.setPluginData('chartData', JSON.stringify(chartData));
  } catch (error) {
    console.warn('Failed to set chart data in node:', error);
  }
}

// Helper function to safely send UI messages
function sendUIMessage(message: any): void {
  try {
    figma.ui.postMessage(message);
  } catch (error) {
    console.warn('Failed to send UI message:', error);
  }
}

// Helper function to generate unique chart ID
function generateChartId(): string {
  return `${CHART_ID_PREFIX}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Listen for selection changes to update form fields
figma.on('selectionchange', () => {
  // Send selection change event to UI
  try { 
    figma.ui.postMessage({ type: 'selection-changed' }); 
  } catch (error) {
    console.warn('Failed to send selection change message:', error);
  }
  
  // Also refresh file context when selection changes (often happens when switching files)
  setTimeout(() => {
    sendChartsWithContext();
  }, SELECTION_REFRESH_DELAY);
});

// Note: documentchange event requires loadAllPagesAsync in incremental mode
// Instead, we'll refresh context on other events and when UI requests it

interface PluginMessage {
  type: string;
  url?: string;
  name?: string;
  chartId?: string;
  newName?: string;
  newUrl?: string;
  context?: string;
  message?: string;
  statusType?: string;
}

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === 'insert-chart') {
    try {
      const { url, name } = msg;
      
      if (!url) {
        throw new Error('URL is required for chart insertion');
      }
      
      // Convert Google Sheets chart URL to image URL
      const imageUrl = convertToImageUrl(url);
      
      // Download and validate the image data
      sendStatusMessage('🔄 Downloading chart from Google Sheets...', 'processing');
      const { imageBuffer, contentType } = await fetchImageData(imageUrl);
      
      sendStatusMessage('🔍 Validating image format...', 'processing');
      validateImageData(imageBuffer, contentType, imageUrl);
      
      sendStatusMessage('🖼️ Creating chart in Figma...', 'processing');
      const imageData = await figma.createImage(new Uint8Array(imageBuffer));
      
      // Create rectangle to hold the image (no frame needed)
      const chartId = generateChartId();
      const rect = figma.createRectangle();
      rect.name = `${name || DEFAULT_CHART_NAME} (${chartId})`;
      rect.resize(DEFAULT_CHART_SIZE.width, DEFAULT_CHART_SIZE.height);
      rect.fills = [{ type: 'IMAGE', imageHash: imageData.hash, scaleMode: 'FIT' }];
      
      // Center the image in the viewport
      figma.viewport.scrollAndZoomIntoView([rect]);
      
      // Store chart data
      sendStatusMessage('💾 Saving chart to history...', 'processing');
      const chartData: ChartData = {
        url,
        name: name || DEFAULT_CHART_NAME,
        lastUpdated: new Date().toISOString(),
        id: chartId
      };
      
      // Store in both node data (for portability) and storage (for history)
      setChartDataInNode(rect, chartData);
      
      const storageKey = getFileStorageKey();
      const charts: ChartData[] = await figma.clientStorage.getAsync(storageKey) || [];
      charts.push(chartData);
      await figma.clientStorage.setAsync(storageKey, charts);
      
      // Refresh the charts list with updated file context
      await sendChartsWithContext();
      
      showNotification('✅ Chart inserted successfully!');
      try { 
        figma.ui.postMessage({ type: 'completion', message: '✅ Chart inserted successfully!', statusType: 'success' }); 
      } catch (error) {
        console.warn('Failed to send completion message:', error);
      }
    } catch (error) {
      const message = 'Error inserting chart: ' + (error as Error).message;
      figma.notify(message, { error: true });
      try { figma.ui.postMessage({ type: 'error', context: 'insert', message }); } catch (error) {
        console.warn('Failed to send error message:', error);
      }
    }
  }
  
  if (msg.type === 'get-selected-chart-info') {
    try {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        try { figma.ui.postMessage({ type: 'selected-chart-info', chartInfo: null }); } catch (error) {
          console.warn('Failed to send selected chart info:', error);
        }
        return;
      }
      
      const targetNode = selection[0];
      
      if (!targetNode || targetNode.type !== 'RECTANGLE') {
        try { figma.ui.postMessage({ type: 'selected-chart-info', chartInfo: null }); } catch (error) {
          console.warn('Failed to send selected chart info:', error);
        }
        return;
      }
      
      // First, try to get chart data from the node's plugin data (for copied charts)
      let chartData = getChartDataFromNode(targetNode);
      
      if (!chartData) {
        // Fallback to stored charts by matching the rectangle name or ID
        const storageKey = getFileStorageKey();
        const charts: ChartData[] = await figma.clientStorage.getAsync(storageKey) || [];
        chartData = charts.find(chart => {
          // Extract chart ID from rectangle name if it exists
          const idMatch = targetNode.name.match(/\(chart_[^)]+\)$/);
          if (idMatch && chart.id) {
            const extractedId = idMatch[0].slice(1, -1); // Remove parentheses
            return extractedId === chart.id;
          }
          // Fallback to name matching for backward compatibility
          return targetNode.name === chart.name || 
                 (targetNode.name === 'Google Sheets Chart' && chart.name === 'Google Sheets Chart');
        }) || null;
      }
      
      if (chartData) {
        try { 
          figma.ui.postMessage({ 
            type: 'selected-chart-info', 
            chartInfo: {
              url: chartData.url,
              name: chartData.name,
              id: chartData.id
            }
          }); 
        } catch (error) {
          console.warn('Failed to send selected chart info:', error);
        }
      } else {
        try { figma.ui.postMessage({ type: 'selected-chart-info', chartInfo: null }); } catch (error) {
          console.warn('Failed to send selected chart info:', error);
        }
      }
    } catch (error) {
      try { figma.ui.postMessage({ type: 'selected-chart-info', chartInfo: null }); } catch {}
    }
  }
  
  if (msg.type === 'update-chart') {
    try {
      // Find the selected rectangle to update
      const selection = figma.currentPage.selection;
      
      if (selection.length === 0) {
        throw new Error('Please select a chart rectangle to update');
      }
      
      const targetNode = selection[0];
      
      if (!targetNode || targetNode.type !== 'RECTANGLE') {
        throw new Error('Please select a chart rectangle to update');
      }
      
      sendStatusMessage('🔍 Looking for selected chart...', 'processing');
      
      // First, try to get chart data from the node's plugin data (for copied charts)
      let chartData = getChartDataFromNode(targetNode);
      
      if (!chartData) {
        // Fallback to stored charts by matching the rectangle name or ID
        sendStatusMessage('🔗 Finding chart URL in history...', 'processing');
        const storageKey = getFileStorageKey();
        const charts: ChartData[] = await figma.clientStorage.getAsync(storageKey) || [];
        
        chartData = charts.find(chart => {
          // Extract chart ID from rectangle name if it exists
          const idMatch = targetNode.name.match(/\(chart_[^)]+\)$/);
          if (idMatch && chart.id) {
            const extractedId = idMatch[0].slice(1, -1); // Remove parentheses
            return extractedId === chart.id;
          }
          // Fallback to name matching for backward compatibility
          const nameMatch = (targetNode.name || '') === (chart.name || '') || 
                 ((targetNode.name || '') === 'Google Sheets Chart' && (chart.name || '') === 'Google Sheets Chart');
          return nameMatch;
        }) || null;
      }
      
      if (!chartData) {
        throw new Error(`No stored URL found for chart "${targetNode.name}". Please use "Insert Chart" instead.`);
      }
      
      // Convert URL to image URL with cache-busting parameter
      const imageUrl = convertToImageUrl(chartData.url || '') + `&t=${Date.now()}`;
      
      // Start progress tracking
      try { figma.ui.postMessage({ type: 'progress-start', message: 'Updating chart...', statusType: 'processing' }); } catch (error) {
        console.warn('Failed to send progress start message:', error);
      }
      
      // Download and validate the image data
      sendStatusMessage('🔄 Downloading updated chart from Google Sheets...', 'processing');
      try { figma.ui.postMessage({ type: 'progress-update', percentage: 25, message: 'Downloading chart image...' }); } catch (error) {
        console.warn('Failed to send progress update message:', error);
      }
      const { imageBuffer, contentType } = await fetchImageData(imageUrl);
      
      sendStatusMessage('🔍 Validating image format...', 'processing');
      try { figma.ui.postMessage({ type: 'progress-update', percentage: 50, message: 'Validating image format...' }); } catch (error) {
        console.warn('Failed to send progress update message:', error);
      }
      validateImageData(imageBuffer, contentType, imageUrl);
      
      sendStatusMessage('🖼️ Creating updated image...', 'processing');
      try { figma.ui.postMessage({ type: 'progress-update', percentage: 75, message: 'Creating Figma image...' }); } catch (error) {
        console.warn('Failed to send progress update message:', error);
      }
      const imageData = await figma.createImage(new Uint8Array(imageBuffer));
      
      // Check if the image actually changed
      sendStatusMessage('🔍 Checking if chart has changed...', 'processing');
      try { figma.ui.postMessage({ type: 'progress-update', percentage: 90, message: 'Checking for changes...' }); } catch (error) {
        console.warn('Failed to send progress update message:', error);
      }
      const currentFills = targetNode.fills;
      const oldImageHash = Array.isArray(currentFills) && currentFills.length > 0 && currentFills[0].type === 'IMAGE' 
        ? (currentFills[0] as ImagePaint).imageHash 
        : null;
      
      // Update last updated time first
      sendStatusMessage('💾 Updating chart timestamp...', 'processing');
      try { figma.ui.postMessage({ type: 'progress-update', percentage: 95, message: 'Updating metadata...' }); } catch (error) {
        console.warn('Failed to send progress update message:', error);
      }
      
      // Update timestamp in both node data and storage
      chartData.lastUpdated = new Date().toISOString();
      setChartDataInNode(targetNode, chartData);
      
      // Also update in storage if it exists there
      const storageKey = getFileStorageKey();
      const charts: ChartData[] = await figma.clientStorage.getAsync(storageKey) || [];
      const chartIndex = charts.findIndex(chart => (chart.url || '') === (chartData.url || ''));
      if (chartIndex !== -1) {
        charts[chartIndex].lastUpdated = new Date().toISOString();
        await figma.clientStorage.setAsync(storageKey, charts);
        console.log('[UPDATE-CHART] Updated timestamp in storage');
      }
      
      if (oldImageHash === imageData.hash) {
        console.log('[UPDATE-CHART] Image unchanged, showing notification');
        try { figma.ui.postMessage({ type: 'progress-complete', message: 'Chart unchanged', statusType: 'warning' }); } catch (error) {
          console.warn('Failed to send progress complete message:', error);
        }
        showNotification('ℹ️ Chart image unchanged. Google Sheets may not have updated the published image yet.');
        sendStatusMessage('ℹ️ Chart image unchanged. Google Sheets may not have updated the published image yet.', 'warning');
      } else {
        // Update the rectangle's fill
        sendStatusMessage('🔄 Updating chart in Figma...', 'processing');
        try { figma.ui.postMessage({ type: 'progress-update', percentage: 100, message: 'Updating chart in Figma...' }); } catch (error) {
          console.warn('Failed to send progress update message:', error);
        }
        targetNode.fills = [{ type: 'IMAGE', imageHash: imageData.hash, scaleMode: 'FIT' }];
        console.log('[UPDATE-CHART] Chart updated successfully');
        try { figma.ui.postMessage({ type: 'progress-complete', message: 'Chart updated successfully!', statusType: 'success' }); } catch (error) {
          console.warn('Failed to send progress complete message:', error);
        }
        showNotification('✅ Chart updated successfully!');
        try { figma.ui.postMessage({ type: 'completion', message: '✅ Chart updated successfully!', statusType: 'success' }); } catch (error) {
          console.warn('Failed to send completion message:', error);
        }
      }
      
      figma.notify('Chart updated successfully!');
    } catch (error) {
      console.error('[UPDATE-CHART] Error occurred:', error);
      let message = 'Error updating chart: ' + (error as Error).message;
      
      // Provide specific guidance for common errors
      if (message.includes('404')) {
        message = 'Chart not found (404 error). The chart may have been deleted, moved, or is no longer published. Please re-publish the chart in Google Sheets and try again.';
      } else if (message.includes('403')) {
        message = 'Access denied (403 error). The chart has restricted access. Please re-publish the chart and select "Anyone with the link can view" in the publishing settings.';
      } else if (message.includes('Network error')) {
        message = 'Network error. Please check your internet connection and try again. If the problem persists, the chart URL may be invalid.';
      }
      
      console.error('[UPDATE-CHART] Final error message:', message);
      figma.notify(message, { error: true });
      try { figma.ui.postMessage({ type: 'error', context: 'update', message }); } catch (error) {
        console.warn('Failed to send error message:', error);
      }
    }
  }
  

  if (msg.type === 'update-all-charts') {
    try {
      const storageKey = getFileStorageKey();
      const charts: ChartData[] = await figma.clientStorage.getAsync(storageKey) || [];
      if (charts.length === 0) {
        throw new Error('No charts found in history');
      }
      
      sendStatusMessage('🔍 Loading pages and searching for charts...', 'processing');
      
      // Find all chart rectangles in the entire file (all pages)
      const allRectangles: RectangleNode[] = [];
      let pagesLoaded = 0;
      let pagesFailed = 0;
      
      for (const page of figma.root.children) {
        if (page.type === 'PAGE') {
          try {
            // Ensure the page is loaded before searching
            await page.loadAsync();
            const pageRectangles = page.findAll(node => node.type === 'RECTANGLE') as RectangleNode[];
            allRectangles.push(...pageRectangles);
            pagesLoaded++;
          } catch (pageError) {
            console.warn(`Could not load page "${page.name}":`, pageError);
            pagesFailed++;
            // Continue with other pages even if one fails to load
          }
        }
      }
      
      // If we couldn't load any pages, try just the current page
      if (pagesLoaded === 0 && pagesFailed > 0) {
        sendStatusMessage('⚠️ Could not load all pages. Searching current page only...', 'warning');
        try {
          const currentPage = figma.currentPage;
          await currentPage.loadAsync();
          const currentPageRectangles = currentPage.findAll(node => node.type === 'RECTANGLE') as RectangleNode[];
          allRectangles.push(...currentPageRectangles);
        } catch (currentPageError) {
          throw new Error('Could not load current page. Please try updating individual charts.');
        }
      }
      
      let updatedCount = 0;
      let errorCount = 0;
      
      sendStatusMessage(`🔍 Found ${allRectangles.length} rectangles. Checking for charts...`, 'info');
      
      // Start progress tracking
      try { figma.ui.postMessage({ type: 'progress-start', message: 'Updating all charts...', statusType: 'processing' }); } catch (error) {
        console.warn('Failed to send progress start message:', error);
      }
      
      for (let i = 0; i < allRectangles.length; i++) {
        const rect = allRectangles[i];
        
        // Update progress
        const progress = Math.round((i / allRectangles.length) * 100);
        try { figma.ui.postMessage({ type: 'progress-update', percentage: progress, message: `Checking chart ${i + 1} of ${allRectangles.length}...` }); } catch (error) {
          console.warn('Failed to send progress update message:', error);
        }
        
        // Check if this rectangle name matches any chart in our history
        const matchingChart = charts.find(chart => {
          // Extract chart ID from rectangle name if it exists
          const idMatch = rect.name.match(/\(chart_[^)]+\)$/);
          if (idMatch && chart.id) {
            const extractedId = idMatch[0].slice(1, -1); // Remove parentheses
            return extractedId === chart.id;
          }
          // Fallback to name matching for backward compatibility
          return rect.name === chart.name || 
                 rect.name === 'Google Sheets Chart' || 
                 rect.name.includes('Chart');
        });
        
        if (matchingChart) {
          try {
            sendStatusMessage(`🔄 Updating chart: ${rect.name}...`, 'processing');
            
            // Convert URL to image URL with cache-busting parameter
            const imageUrl = convertToImageUrl(matchingChart.url) + `&t=${Date.now()}`;
            
            // Download and validate the image data
            const { imageBuffer, contentType } = await fetchImageData(imageUrl);
            validateImageData(imageBuffer, contentType, imageUrl);
            
            const imageData = await figma.createImage(new Uint8Array(imageBuffer));
            
            // Check if the image actually changed
            const currentFills = rect.fills;
            const oldImageHash = Array.isArray(currentFills) && currentFills.length > 0 && currentFills[0].type === 'IMAGE' 
              ? (currentFills[0] as ImagePaint).imageHash 
              : null;
            
            if (oldImageHash !== imageData.hash) {
              rect.fills = [{ type: 'IMAGE', imageHash: imageData.hash, scaleMode: 'FIT' }];
              updatedCount++;
              sendStatusMessage(`✅ Updated: ${rect.name}`, 'success');
            } else {
              sendStatusMessage(`ℹ️ No changes: ${rect.name}`, 'info');
            }
            
            // Update last updated time
            const chartIndex = charts.findIndex(chart => chart.url === matchingChart.url);
            if (chartIndex !== -1) {
              charts[chartIndex].lastUpdated = new Date().toISOString();
            }
          } catch (error) {
            errorCount++;
            let errorMessage = (error as Error).message;
            
            // Provide specific guidance for common errors
            if (errorMessage.includes('404')) {
              errorMessage = 'Chart not found - may have been deleted or moved';
            } else if (errorMessage.includes('403')) {
              errorMessage = 'Access denied - check publishing settings';
            } else if (errorMessage.includes('Network error')) {
              errorMessage = 'Network error - check connection';
            }
            
            console.error(`Failed to update chart "${rect.name}": ${errorMessage}`);
          }
        }
      }
      
      // Complete progress
      try { figma.ui.postMessage({ type: 'progress-complete', message: 'All charts processed!', statusType: 'success' }); } catch (error) {
        console.warn('Failed to send progress complete message:', error);
      }
      
      // Save updated timestamps
      await figma.clientStorage.setAsync(storageKey, charts);
      
      if (updatedCount > 0) {
        showNotification(`🎉 Successfully updated ${updatedCount} chart${updatedCount > 1 ? 's' : ''} across all pages!${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
        try { figma.ui.postMessage({ type: 'completion', message: `🎉 Successfully updated ${updatedCount} chart${updatedCount > 1 ? 's' : ''} across all pages!${errorCount > 0 ? ` (${errorCount} failed)` : ''}`, statusType: 'success' }); } catch (error) {
          console.warn('Failed to send completion message:', error);
        }
      } else if (errorCount === 0) {
        sendStatusMessage('ℹ️ All charts unchanged. Google Sheets may not have updated the published images yet.', 'warning');
      } else {
        throw new Error('No charts found to update in this file');
      }
      
    } catch (error) {
      let message = 'Error updating all charts: ' + (error as Error).message;
      
      // Provide specific guidance for page loading errors
      if (message.includes('findAll') || message.includes('loadAsync')) {
        message = 'Error loading pages. Some pages may be locked or inaccessible. Try updating individual charts instead.';
      } else if (message.includes('404')) {
        message = 'Some charts returned 404 errors. They may have been deleted or moved in Google Sheets.';
      } else if (message.includes('403')) {
        message = 'Some charts returned access denied errors. Check their publishing settings in Google Sheets.';
      }
      
      figma.notify(message, { error: true });
      try { figma.ui.postMessage({ type: 'error', context: 'update-all', message }); } catch (error) {
        console.warn('Failed to send error message:', error);
      }
    }
  }
  
  if (msg.type === 'update-chart-url') {
    try {
      const { chartId, newUrl } = msg;
      
      if (!chartId || !newUrl) {
        throw new Error('Missing chart ID or new URL');
      }
      
      sendStatusMessage('🔄 Updating chart URL...', 'processing');
      
      // Find the chart in storage and update its URL
      const storageKey = getFileStorageKey();
      const charts: ChartData[] = await figma.clientStorage.getAsync(storageKey) || [];
      const chartIndex = charts.findIndex(chart => chart.id === chartId);
      
      if (chartIndex === -1) {
        throw new Error('Chart not found in history');
      }
      
      const oldUrl = charts[chartIndex].url;
      charts[chartIndex].url = newUrl;
      
      // Update the chart's last updated time
      charts[chartIndex].lastUpdated = new Date().toISOString();
      
      // Save the updated charts
      await figma.clientStorage.setAsync(storageKey, charts);
      
      // Update the chart image in Figma if it exists
      const selection = figma.currentPage.selection;
      if (selection.length > 0) {
        const targetNode = selection[0];
        if (targetNode.type === 'RECTANGLE') {
          sendStatusMessage('🔄 Downloading new chart image...', 'processing');
          
          // Convert URL to image URL with cache-busting parameter
          const imageUrl = convertToImageUrl(newUrl) + `&t=${Date.now()}`;
          
          // Download and validate the image data
          const { imageBuffer, contentType } = await fetchImageData(imageUrl);
          validateImageData(imageBuffer, contentType, imageUrl);
          
          sendStatusMessage('🖼️ Creating new chart image...', 'processing');
          const imageData = await figma.createImage(new Uint8Array(imageBuffer));
          
          // Store the original size and position
          const originalWidth = targetNode.width;
          const originalHeight = targetNode.height;
          const originalX = targetNode.x;
          const originalY = targetNode.y;
          
          // Update the rectangle's fill with the new image
          targetNode.fills = [{ type: 'IMAGE', imageHash: imageData.hash, scaleMode: 'FIT' }];
          
          // Maintain the original size and position
          targetNode.resize(originalWidth, originalHeight);
          targetNode.x = originalX;
          targetNode.y = originalY;
          
          // Also update the node's plugin data if it exists
          const nodeChartData = getChartDataFromNode(targetNode);
          if (nodeChartData) {
            nodeChartData.url = newUrl;
            nodeChartData.lastUpdated = new Date().toISOString();
            setChartDataInNode(targetNode, nodeChartData);
          }
          
          sendStatusMessage('✅ Chart image updated successfully!', 'success');
        }
      }
      
      showNotification(`✅ Chart URL updated from "${oldUrl}" to "${newUrl}"`);
      try { figma.ui.postMessage({ type: 'completion', message: `✅ Chart URL updated from "${oldUrl}" to "${newUrl}"`, statusType: 'success' }); } catch (error) {
        console.warn('Failed to send completion message:', error);
      }
      
      // Refresh the charts list with updated file context
      await sendChartsWithContext();
      
    } catch (error) {
      const message = 'Error updating chart URL: ' + (error as Error).message;
      figma.notify(message, { error: true });
      try { figma.ui.postMessage({ type: 'error', context: 'update-url', message }); } catch (error) {
        console.warn('Failed to send error message:', error);
      }
    }
  }
  
  if (msg.type === 'update-chart-name') {
    try {
      const { chartId, newName } = msg;
      
      if (!chartId || !newName) {
        throw new Error('Missing chart ID or new name');
      }
      
      sendStatusMessage('💾 Updating chart name...', 'processing');
      
      // Find the chart in storage and update its name
      const storageKey = getFileStorageKey();
      const charts: ChartData[] = await figma.clientStorage.getAsync(storageKey) || [];
      const chartIndex = charts.findIndex(chart => chart.id === chartId);
      
      if (chartIndex === -1) {
        throw new Error('Chart not found in history');
      }
      
      const oldName = charts[chartIndex].name;
      charts[chartIndex].name = newName;
      
      // Update the chart's last updated time
      charts[chartIndex].lastUpdated = new Date().toISOString();
      
      // Save the updated charts
      await figma.clientStorage.setAsync(storageKey, charts);
      
      // Update the rectangle name in Figma if it exists
      const selection = figma.currentPage.selection;
      if (selection.length > 0) {
        const targetNode = selection[0];
        if (targetNode.type === 'RECTANGLE') {
          // Update the rectangle name to match the new chart name
          const idMatch = targetNode.name.match(/\(chart_[^)]+\)$/);
          if (idMatch) {
            targetNode.name = `${newName} (${idMatch[0].slice(1, -1)})`;
          } else {
            targetNode.name = newName;
          }
          
          // Also update the node's plugin data if it exists
          const nodeChartData = getChartDataFromNode(targetNode);
          if (nodeChartData) {
            nodeChartData.name = newName;
            nodeChartData.lastUpdated = new Date().toISOString();
            setChartDataInNode(targetNode, nodeChartData);
          }
        }
      }
      
      showNotification(`✅ Chart name updated from "${oldName}" to "${newName}"`);
      try { figma.ui.postMessage({ type: 'completion', message: `✅ Chart name updated from "${oldName}" to "${newName}"`, statusType: 'success' }); } catch (error) {
        console.warn('Failed to send completion message:', error);
      }
      
      // Refresh the charts list with updated file context
      await sendChartsWithContext();
      
    } catch (error) {
      const message = 'Error updating chart name: ' + (error as Error).message;
      figma.notify(message, { error: true });
      try { figma.ui.postMessage({ type: 'error', context: 'update-name', message }); } catch (error) {
        console.warn('Failed to send error message:', error);
      }
    }
  }
  
  if (msg.type === 'test-chart-url') {
    try {
      const { url } = msg;
      
      if (!url) {
        throw new Error('URL is required for testing');
      }
      
      console.log('[TEST-URL] Testing URL:', url);
      
      // Convert URL to image URL with cache-busting
      const imageUrl = convertToImageUrl(url) + `&t=${Date.now()}`;
      console.log('[TEST-URL] Converted image URL:', imageUrl);
      
      // Test the URL by attempting to fetch the image
      sendStatusMessage('🔍 Testing chart URL...', 'processing');
      const { imageBuffer, contentType } = await fetchImageData(imageUrl);
      
      console.log('[TEST-URL] Successfully fetched image, size:', imageBuffer.byteLength, 'bytes, type:', contentType);
      
      sendStatusMessage('🔍 Validating image format...', 'processing');
      validateImageData(imageBuffer, contentType, imageUrl);
      
      console.log('[TEST-URL] Image validation passed');
      
      showNotification('✅ Chart URL is working correctly! Image fetched successfully.');
      try { figma.ui.postMessage({ type: 'completion', message: '✅ Chart URL is working correctly! Image fetched successfully.', statusType: 'success' }); } catch (error) {
        console.warn('Failed to send completion message:', error);
      }
      try { figma.ui.postMessage({ type: 'success', message: 'Chart URL is working correctly! Image fetched successfully.' }); } catch (error) {
        console.warn('Failed to send success message:', error);
      }
      
    } catch (error) {
      console.error('[TEST-URL] Error testing URL:', error);
      let message = 'Error testing chart URL: ' + (error as Error).message;
      
      // Provide specific guidance for common errors
      if (message.includes('404')) {
        message = '❌ Chart not found (404 error). The chart may have been deleted, moved, or is no longer published. Please re-publish the chart in Google Sheets.';
      } else if (message.includes('403')) {
        message = '❌ Access denied (403 error). The chart has restricted access. Please re-publish the chart and select "Anyone with the link can view" in the publishing settings.';
      } else if (message.includes('Network error')) {
        message = '❌ Network error. Please check your internet connection.';
      } else if (message.includes('CORS')) {
        message = '❌ CORS error. The chart URL is not accessible due to cross-origin restrictions.';
      }
      
      console.error('[TEST-URL] Final error message:', message);
      figma.notify(message, { error: true });
      try { figma.ui.postMessage({ type: 'error', context: 'test', message }); } catch (error) {
        console.warn('Failed to send error message:', error);
      }
    }
  }

  if (msg.type === 'test-specific-url') {
    try {
      const testUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSeeazY7kN_my10S9yX4bhGKqud4_FRXPHKGzkvj-MwEoqzvaXWWiS7_qofFrtxV6raudAXa0R4qY_9/pubchart?oid=2067613182&format=image';
      
      console.log('[TEST-SPECIFIC] Testing specific URL:', testUrl);
      
      // Test direct fetch first
      try {
        console.log('[TEST-SPECIFIC] Attempting direct fetch...');
        const directResponse = await fetch(testUrl);
        console.log('[TEST-SPECIFIC] Direct response status:', directResponse.status, 'Content-Type:', directResponse.headers ? directResponse.headers.get('content-type') : 'undefined');
        
        if (directResponse.ok) {
          const directBuffer = await directResponse.arrayBuffer();
          console.log('[TEST-SPECIFIC] Direct fetch successful, size:', directBuffer.byteLength, 'bytes');
        } else {
          console.error('[TEST-SPECIFIC] Direct fetch failed with status:', directResponse.status);
        }
      } catch (directError) {
        console.error('[TEST-SPECIFIC] Direct fetch error:', directError);
      }
      
      // Test with our plugin's fetchImageData function
      console.log('[TEST-SPECIFIC] Testing with plugin fetchImageData...');
      const { imageBuffer, contentType } = await fetchImageData(testUrl);
      
      console.log('[TEST-SPECIFIC] Plugin fetch successful, size:', imageBuffer.byteLength, 'bytes, type:', contentType);
      
      // Test image validation
      validateImageData(imageBuffer, contentType, testUrl);
      console.log('[TEST-SPECIFIC] Image validation passed');
      
      // Test creating Figma image
      const imageData = await figma.createImage(new Uint8Array(imageBuffer));
      console.log('[TEST-SPECIFIC] Figma image created, hash:', imageData.hash);
      
      showNotification('✅ Specific URL test successful! All steps passed.');
      figma.ui.postMessage({ type: 'completion', message: '✅ Specific URL test successful! All steps passed.', statusType: 'success' });
      
    } catch (error) {
      console.error('[TEST-SPECIFIC] Error in specific URL test:', error);
      const message = 'Error testing specific URL: ' + (error as Error).message;
      figma.notify(message, { error: true });
      figma.ui.postMessage({ type: 'error', context: 'test-specific', message });
    }
  }
  
  if (msg.type === 'refresh-charts') {
    // Refresh charts with current file context
    await sendChartsWithContext();
  }
  
  if (msg.type === 'delete-chart') {
    try {
      const { url } = msg;
      
      // Remove from stored charts
      const storageKey = getFileStorageKey();
      const charts: ChartData[] = await figma.clientStorage.getAsync(storageKey) || [];
      const filteredCharts = charts.filter(chart => chart.url !== url);
      await figma.clientStorage.setAsync(storageKey, filteredCharts);
      
      // Refresh the charts list with updated file context
      await sendChartsWithContext();
      
      figma.notify('Chart removed from history');
    } catch (error) {
      const message = 'Error removing chart: ' + (error as Error).message;
      figma.notify(message, { error: true });
      try { figma.ui.postMessage({ type: 'error', context: 'delete', message }); } catch (error) {
        console.warn('Failed to send error message:', error);
      }
    }
  }
};

function convertToImageUrl(inputUrl: string): string {
  const urlString = inputUrl.trim();

  // Direct image hosts (already an image URL)
  const googleUserContentHostRegex = /^https?:\/\/([a-z0-9-]+\.)*googleusercontent\.com\//i;
  if (googleUserContentHostRegex.test(urlString)) {
    return urlString;
  }

  // Published chart URL handling
  if (urlString.includes('/pubchart')) {
    // Ensure format=image query param exists and is set correctly
    if (urlString.includes('?')) {
      // Replace existing format param or append
      if (/([?&])format=[^&#]*/i.test(urlString)) {
        return urlString.replace(/([?&])format=[^&#]*/i, '$1format=image');
      }
      return urlString + '&format=image';
    }
    return urlString + '?format=image';
  }

  // Not supported: ask user to publish chart and use that link
  throw new Error('Please use the published chart URL (it contains /pubchart). In Sheets: File > Share > Publish chart.');
}
