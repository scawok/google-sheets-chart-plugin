figma.showUI(__html__, { width: 400, height: 600 });

// Helper function to send status messages to UI
function sendStatusMessage(message: string, statusType: 'success' | 'error' | 'info' | 'warning' | 'processing' = 'info') {
  try { 
    figma.ui.postMessage({ type: 'status', message, statusType }); 
  } catch {}
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
  let response: Response;
  
  // Always use proxy for Google Docs to avoid CORS issues
  if (/^https?:\/\/docs\.google\.com\//i.test(imageUrl)) {
    const proxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl.replace(/^https?:\/\//, ''))}`;
    response = await fetch(proxiedUrl, { redirect: 'follow' as RequestRedirect });
  } else {
    try {
      response = await fetch(imageUrl, { redirect: 'follow' as RequestRedirect });
      const headers = response.headers;
      if (!response.ok || !(headers.get('access-control-allow-origin') || '').includes('*')) {
        throw new Error('CORS-fallback');
      }
    } catch (e) {
      const proxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl.replace(/^https?:\/\//, ''))}`;
      response = await fetch(proxiedUrl, { redirect: 'follow' as RequestRedirect });
    }
  }
  
  if (!response.ok) {
    throw new Error(`Network error ${response.status}: ${response.statusText}. URL: ${imageUrl}`);
  }
  
      const headers = response.headers;
    const contentType = headers && headers.get ? headers.get('content-type') || '' : '';
  const imageBuffer = await response.arrayBuffer();
  
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

// Store chart data in plugin data
figma.clientStorage.getAsync('charts').then((charts: ChartData[] = []) => {
  figma.ui.postMessage({ type: 'load-charts', charts });
});

// Listen for selection changes to update form fields
figma.on('selectionchange', () => {
  // Send selection change event to UI
  try { figma.ui.postMessage({ type: 'selection-changed' }); } catch {}
});

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'insert-chart') {
    try {
      const { url, name } = msg;
      
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
      const chartId = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const rect = figma.createRectangle();
      rect.name = `${name || 'Google Sheets Chart'} (${chartId})`;
      rect.resize(800, 500);
      rect.fills = [{ type: 'IMAGE', imageHash: imageData.hash, scaleMode: 'FIT' }];
      
      // Center the image in the viewport
      figma.viewport.scrollAndZoomIntoView([rect]);
      
      // Store chart data
      sendStatusMessage('💾 Saving chart to history...', 'processing');
      const charts: ChartData[] = await figma.clientStorage.getAsync('charts') || [];
      charts.push({
        url,
        name: name || 'Google Sheets Chart',
        lastUpdated: new Date().toISOString(),
        id: chartId
      });
      await figma.clientStorage.setAsync('charts', charts);
      
      showNotification('✅ Chart inserted successfully!');
      try { figma.ui.postMessage({ type: 'completion', message: '✅ Chart inserted successfully!', statusType: 'success' }); } catch {}
    } catch (error) {
      const message = 'Error inserting chart: ' + (error as Error).message;
      figma.notify(message, { error: true });
      try { figma.ui.postMessage({ type: 'error', context: 'insert', message }); } catch {}
    }
  }
  
  if (msg.type === 'get-selected-chart-info') {
    try {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        try { figma.ui.postMessage({ type: 'selected-chart-info', chartInfo: null }); } catch {}
        return;
      }
      
      const targetNode = selection[0];
      
      if (!targetNode || targetNode.type !== 'RECTANGLE') {
        try { figma.ui.postMessage({ type: 'selected-chart-info', chartInfo: null }); } catch {}
        return;
      }
      
      // Find the chart URL from stored charts by matching the rectangle name or ID
      const charts: ChartData[] = await figma.clientStorage.getAsync('charts') || [];
      const matchingChart = charts.find(chart => {
        // Extract chart ID from rectangle name if it exists
        const idMatch = targetNode.name.match(/\(chart_[^)]+\)$/);
        if (idMatch && chart.id) {
          const extractedId = idMatch[0].slice(1, -1); // Remove parentheses
          return extractedId === chart.id;
        }
        // Fallback to name matching for backward compatibility
        return targetNode.name === chart.name || 
               (targetNode.name === 'Google Sheets Chart' && chart.name === 'Google Sheets Chart');
      });
      
      if (matchingChart) {
        try { 
          figma.ui.postMessage({ 
            type: 'selected-chart-info', 
            chartInfo: {
              url: matchingChart.url,
              name: matchingChart.name,
              id: matchingChart.id
            }
          }); 
        } catch {}
      } else {
        try { figma.ui.postMessage({ type: 'selected-chart-info', chartInfo: null }); } catch {}
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
      
      // Find the chart URL from stored charts by matching the rectangle name or ID
      sendStatusMessage('🔗 Finding chart URL in history...', 'processing');
      const charts: ChartData[] = await figma.clientStorage.getAsync('charts') || [];
      const matchingChart = charts.find(chart => {
        // Extract chart ID from rectangle name if it exists
        const idMatch = targetNode.name.match(/\(chart_[^)]+\)$/);
        if (idMatch && chart.id) {
          const extractedId = idMatch[0].slice(1, -1); // Remove parentheses
          return extractedId === chart.id;
        }
        // Fallback to name matching for backward compatibility
        return targetNode.name === chart.name || 
               (targetNode.name === 'Google Sheets Chart' && chart.name === 'Google Sheets Chart');
      });
      
      if (!matchingChart) {
        throw new Error(`No stored URL found for chart "${targetNode.name}". Please use "Insert Chart" instead.`);
      }
      
      // Convert URL to image URL with cache-busting parameter
      const imageUrl = convertToImageUrl(matchingChart.url) + `&t=${Date.now()}`;
      
      // Download and validate the image data
      sendStatusMessage('🔄 Downloading updated chart from Google Sheets...', 'processing');
      const { imageBuffer, contentType } = await fetchImageData(imageUrl);
      
      sendStatusMessage('🔍 Validating image format...', 'processing');
      validateImageData(imageBuffer, contentType, imageUrl);
      
      sendStatusMessage('🖼️ Creating updated image...', 'processing');
      const imageData = await figma.createImage(new Uint8Array(imageBuffer));
      
      // Check if the image actually changed
      sendStatusMessage('🔍 Checking if chart has changed...', 'processing');
      const currentFills = targetNode.fills;
      const oldImageHash = Array.isArray(currentFills) && currentFills.length > 0 && currentFills[0].type === 'IMAGE' 
        ? (currentFills[0] as ImagePaint).imageHash 
        : null;
      
      // Update last updated time first
      sendStatusMessage('💾 Updating chart timestamp...', 'processing');
      const chartIndex = charts.findIndex(chart => chart.url === matchingChart.url);
      if (chartIndex !== -1) {
        charts[chartIndex].lastUpdated = new Date().toISOString();
        await figma.clientStorage.setAsync('charts', charts);
      }
      
      if (oldImageHash === imageData.hash) {
        showNotification('ℹ️ Chart image unchanged. Google Sheets may not have updated the published image yet.');
        sendStatusMessage('ℹ️ Chart image unchanged. Google Sheets may not have updated the published image yet.', 'warning');
      } else {
        // Update the rectangle's fill
        sendStatusMessage('🔄 Updating chart in Figma...', 'processing');
        targetNode.fills = [{ type: 'IMAGE', imageHash: imageData.hash, scaleMode: 'FIT' }];
        showNotification('✅ Chart updated successfully!');
        try { figma.ui.postMessage({ type: 'completion', message: '✅ Chart updated successfully!', statusType: 'success' }); } catch {}
      }
      
      figma.notify('Chart updated successfully!');
    } catch (error) {
      let message = 'Error updating chart: ' + (error as Error).message;
      
      // Provide specific guidance for common errors
      if (message.includes('404')) {
        message = 'Chart not found (404 error). The chart may have been deleted, moved, or is no longer published. Please re-publish the chart in Google Sheets and try again.';
      } else if (message.includes('403')) {
        message = 'Access denied (403 error). The chart may be private or the sharing settings have changed. Please check the chart\'s publishing settings in Google Sheets.';
      } else if (message.includes('Network error')) {
        message = 'Network error. Please check your internet connection and try again. If the problem persists, the chart URL may be invalid.';
      }
      
      figma.notify(message, { error: true });
      try { figma.ui.postMessage({ type: 'error', context: 'update', message }); } catch {}
    }
  }
  

  if (msg.type === 'update-all-charts') {
    try {
      const charts: ChartData[] = await figma.clientStorage.getAsync('charts') || [];
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
      
      for (const rect of allRectangles) {
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
      
      // Save updated timestamps
      await figma.clientStorage.setAsync('charts', charts);
      
      if (updatedCount > 0) {
        showNotification(`🎉 Successfully updated ${updatedCount} chart${updatedCount > 1 ? 's' : ''} across all pages!${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
        try { figma.ui.postMessage({ type: 'completion', message: `🎉 Successfully updated ${updatedCount} chart${updatedCount > 1 ? 's' : ''} across all pages!${errorCount > 0 ? ` (${errorCount} failed)` : ''}`, statusType: 'success' }); } catch {}
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
      try { figma.ui.postMessage({ type: 'error', context: 'update-all', message }); } catch {}
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
      const charts: ChartData[] = await figma.clientStorage.getAsync('charts') || [];
      const chartIndex = charts.findIndex(chart => chart.id === chartId);
      
      if (chartIndex === -1) {
        throw new Error('Chart not found in history');
      }
      
      const oldName = charts[chartIndex].name;
      charts[chartIndex].name = newName;
      
      // Update the chart's last updated time
      charts[chartIndex].lastUpdated = new Date().toISOString();
      
      // Save the updated charts
      await figma.clientStorage.setAsync('charts', charts);
      
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
        }
      }
      
      showNotification(`✅ Chart name updated from "${oldName}" to "${newName}"`);
      try { figma.ui.postMessage({ type: 'completion', message: `✅ Chart name updated from "${oldName}" to "${newName}"`, statusType: 'success' }); } catch {}
      
      // Send updated charts list to refresh the UI
      try { figma.ui.postMessage({ type: 'chart-name-updated', charts }); } catch {}
      
    } catch (error) {
      const message = 'Error updating chart name: ' + (error as Error).message;
      figma.notify(message, { error: true });
      try { figma.ui.postMessage({ type: 'error', context: 'update-name', message }); } catch {}
    }
  }
  
  if (msg.type === 'test-chart-url') {
    try {
      const { url } = msg;
      
      // Convert URL to image URL with cache-busting
      const imageUrl = convertToImageUrl(url) + `&t=${Date.now()}`;
      
      // Test the URL by attempting to fetch the image
      sendStatusMessage('🔍 Testing chart URL...', 'processing');
      const { imageBuffer, contentType } = await fetchImageData(imageUrl);
      
      sendStatusMessage('🔍 Validating image format...', 'processing');
      validateImageData(imageBuffer, contentType, imageUrl);
      
      showNotification('✅ Chart URL is working correctly! Image fetched successfully.');
      try { figma.ui.postMessage({ type: 'completion', message: '✅ Chart URL is working correctly! Image fetched successfully.', statusType: 'success' }); } catch {}
      try { figma.ui.postMessage({ type: 'success', message: 'Chart URL is working correctly! Image fetched successfully.' }); } catch {}
      
    } catch (error) {
      let message = 'Error testing chart URL: ' + (error as Error).message;
      
      // Provide specific guidance for common errors
      if (message.includes('404')) {
        message = '❌ Chart not found (404 error). The chart may have been deleted, moved, or is no longer published. Please re-publish the chart in Google Sheets.';
      } else if (message.includes('403')) {
        message = '❌ Access denied (403 error). The chart may be private or the sharing settings have changed. Please check the chart\'s publishing settings.';
      } else if (message.includes('Network error')) {
        message = '❌ Network error. Please check your internet connection.';
      }
      
      figma.notify(message, { error: true });
      try { figma.ui.postMessage({ type: 'error', context: 'test', message }); } catch {}
    }
  }
  
  if (msg.type === 'delete-chart') {
    try {
      const { url } = msg;
      
      // Remove from stored charts
      const charts: ChartData[] = await figma.clientStorage.getAsync('charts') || [];
      const filteredCharts = charts.filter(chart => chart.url !== url);
      await figma.clientStorage.setAsync('charts', filteredCharts);
      
      figma.notify('Chart removed from history');
    } catch (error) {
      const message = 'Error removing chart: ' + (error as Error).message;
      figma.notify(message, { error: true });
      try { figma.ui.postMessage({ type: 'error', context: 'delete', message }); } catch {}
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
