"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
figma.showUI(__html__, { width: 400, height: 500 });
// Helper function to fetch image data with CORS handling
function fetchImageData(imageUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        let response;
        // Always use proxy for Google Docs to avoid CORS issues
        if (/^https?:\/\/docs\.google\.com\//i.test(imageUrl)) {
            const proxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl.replace(/^https?:\/\//, ''))}`;
            response = yield fetch(proxiedUrl, { redirect: 'follow' });
        }
        else {
            try {
                response = yield fetch(imageUrl, { redirect: 'follow' });
                const headers = response.headers;
                if (!response.ok || !(headers.get('access-control-allow-origin') || '').includes('*')) {
                    throw new Error('CORS-fallback');
                }
            }
            catch (e) {
                const proxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl.replace(/^https?:\/\//, ''))}`;
                response = yield fetch(proxiedUrl, { redirect: 'follow' });
            }
        }
        if (!response.ok) {
            throw new Error(`Network error ${response.status}: ${response.statusText}. URL: ${imageUrl}`);
        }
        const headers = response.headers;
        const contentType = headers && headers.get ? headers.get('content-type') || '' : '';
        const imageBuffer = yield response.arrayBuffer();
        return { imageBuffer, contentType };
    });
}
// Helper function to validate image data
function validateImageData(imageBuffer, contentType, imageUrl) {
    const isImageByType = contentType.toLowerCase().startsWith('image/') ||
        contentType.toLowerCase() === 'application/octet-stream';
    const isPngByMagic = contentType === '' && imageBuffer &&
        new Uint8Array(imageBuffer).slice(0, 8).every((byte, i) => [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A][i] === byte);
    if (!isImageByType && !isPngByMagic) {
        const uint8Array = new Uint8Array(imageBuffer);
        const text = Array.from(uint8Array.slice(0, 200), byte => String.fromCharCode(byte)).join('');
        const snippet = text.replace(/\s+/g, ' ');
        throw new Error(`Expected image content-type but got: ${contentType}. URL: ${imageUrl}. Body starts: ${snippet}`);
    }
}
// Store chart data in plugin data
figma.clientStorage.getAsync('charts').then((charts = []) => {
    figma.ui.postMessage({ type: 'load-charts', charts });
});
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type === 'insert-chart') {
        try {
            const { url, name } = msg;
            // Convert Google Sheets chart URL to image URL
            const imageUrl = convertToImageUrl(url);
            // Download and validate the image data
            const { imageBuffer, contentType } = yield fetchImageData(imageUrl);
            validateImageData(imageBuffer, contentType, imageUrl);
            const imageData = yield figma.createImage(new Uint8Array(imageBuffer));
            // Create rectangle to hold the image (no frame needed)
            const chartId = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const rect = figma.createRectangle();
            rect.name = `${name || 'Google Sheets Chart'} (${chartId})`;
            rect.resize(800, 500);
            rect.fills = [{ type: 'IMAGE', imageHash: imageData.hash, scaleMode: 'FIT' }];
            // Center the image in the viewport
            figma.viewport.scrollAndZoomIntoView([rect]);
            // Store chart data
            const charts = (yield figma.clientStorage.getAsync('charts')) || [];
            charts.push({
                url,
                name: name || 'Google Sheets Chart',
                lastUpdated: new Date().toISOString(),
                id: chartId
            });
            yield figma.clientStorage.setAsync('charts', charts);
            figma.notify('Chart inserted successfully!');
        }
        catch (error) {
            const message = 'Error inserting chart: ' + error.message;
            figma.notify(message, { error: true });
            try {
                figma.ui.postMessage({ type: 'error', context: 'insert', message });
            }
            catch (_a) { }
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
            // Find the chart URL from stored charts by matching the rectangle name or ID
            const charts = (yield figma.clientStorage.getAsync('charts')) || [];
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
            const { imageBuffer, contentType } = yield fetchImageData(imageUrl);
            validateImageData(imageBuffer, contentType, imageUrl);
            const imageData = yield figma.createImage(new Uint8Array(imageBuffer));
            // Check if the image actually changed
            const currentFills = targetNode.fills;
            const oldImageHash = Array.isArray(currentFills) && currentFills.length > 0 && currentFills[0].type === 'IMAGE'
                ? currentFills[0].imageHash
                : null;
            if (oldImageHash === imageData.hash) {
                figma.notify('Chart is already up to date! Make sure to save changes in Google Sheets first.');
            }
            else {
                // Update the rectangle's fill
                targetNode.fills = [{ type: 'IMAGE', imageHash: imageData.hash, scaleMode: 'FIT' }];
                figma.notify('Chart updated successfully!');
            }
            // Update last updated time
            const chartIndex = charts.findIndex(chart => chart.url === matchingChart.url);
            if (chartIndex !== -1) {
                charts[chartIndex].lastUpdated = new Date().toISOString();
                yield figma.clientStorage.setAsync('charts', charts);
            }
            figma.notify('Chart updated successfully!');
        }
        catch (error) {
            let message = 'Error updating chart: ' + error.message;
            // Provide specific guidance for common errors
            if (message.includes('404')) {
                message = 'Chart not found (404 error). The chart may have been deleted, moved, or is no longer published. Please re-publish the chart in Google Sheets and try again.';
            }
            else if (message.includes('403')) {
                message = 'Access denied (403 error). The chart may be private or the sharing settings have changed. Please check the chart\'s publishing settings in Google Sheets.';
            }
            else if (message.includes('Network error')) {
                message = 'Network error. Please check your internet connection and try again. If the problem persists, the chart URL may be invalid.';
            }
            figma.notify(message, { error: true });
            try {
                figma.ui.postMessage({ type: 'error', context: 'update', message });
            }
            catch (_b) { }
        }
    }
    if (msg.type === 'update-all-charts') {
        try {
            const charts = (yield figma.clientStorage.getAsync('charts')) || [];
            if (charts.length === 0) {
                throw new Error('No charts found in history');
            }
            figma.notify('Loading pages and searching for charts...');
            // Find all chart rectangles in the entire file (all pages)
            const allRectangles = [];
            let pagesLoaded = 0;
            let pagesFailed = 0;
            for (const page of figma.root.children) {
                if (page.type === 'PAGE') {
                    try {
                        // Ensure the page is loaded before searching
                        yield page.loadAsync();
                        const pageRectangles = page.findAll(node => node.type === 'RECTANGLE');
                        allRectangles.push(...pageRectangles);
                        pagesLoaded++;
                    }
                    catch (pageError) {
                        console.warn(`Could not load page "${page.name}":`, pageError);
                        pagesFailed++;
                        // Continue with other pages even if one fails to load
                    }
                }
            }
            // If we couldn't load any pages, try just the current page
            if (pagesLoaded === 0 && pagesFailed > 0) {
                figma.notify('Could not load all pages. Searching current page only...');
                try {
                    const currentPage = figma.currentPage;
                    yield currentPage.loadAsync();
                    const currentPageRectangles = currentPage.findAll(node => node.type === 'RECTANGLE');
                    allRectangles.push(...currentPageRectangles);
                }
                catch (currentPageError) {
                    throw new Error('Could not load current page. Please try updating individual charts.');
                }
            }
            let updatedCount = 0;
            let errorCount = 0;
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
                        // Convert URL to image URL with cache-busting parameter
                        const imageUrl = convertToImageUrl(matchingChart.url) + `&t=${Date.now()}`;
                        // Download and validate the image data
                        const { imageBuffer, contentType } = yield fetchImageData(imageUrl);
                        validateImageData(imageBuffer, contentType, imageUrl);
                        const imageData = yield figma.createImage(new Uint8Array(imageBuffer));
                        // Check if the image actually changed
                        const currentFills = rect.fills;
                        const oldImageHash = Array.isArray(currentFills) && currentFills.length > 0 && currentFills[0].type === 'IMAGE'
                            ? currentFills[0].imageHash
                            : null;
                        if (oldImageHash !== imageData.hash) {
                            rect.fills = [{ type: 'IMAGE', imageHash: imageData.hash, scaleMode: 'FIT' }];
                            updatedCount++;
                        }
                        // Update last updated time
                        const chartIndex = charts.findIndex(chart => chart.url === matchingChart.url);
                        if (chartIndex !== -1) {
                            charts[chartIndex].lastUpdated = new Date().toISOString();
                        }
                    }
                    catch (error) {
                        errorCount++;
                        let errorMessage = error.message;
                        // Provide specific guidance for common errors
                        if (errorMessage.includes('404')) {
                            errorMessage = 'Chart not found - may have been deleted or moved';
                        }
                        else if (errorMessage.includes('403')) {
                            errorMessage = 'Access denied - check publishing settings';
                        }
                        else if (errorMessage.includes('Network error')) {
                            errorMessage = 'Network error - check connection';
                        }
                        console.error(`Failed to update chart "${rect.name}": ${errorMessage}`);
                    }
                }
            }
            // Save updated timestamps
            yield figma.clientStorage.setAsync('charts', charts);
            if (updatedCount > 0) {
                figma.notify(`Updated ${updatedCount} chart${updatedCount > 1 ? 's' : ''} successfully across all pages!${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
            }
            else if (errorCount === 0) {
                figma.notify('All charts are already up to date! Make sure to save changes in Google Sheets first.');
            }
            else {
                throw new Error('No charts found to update in this file');
            }
        }
        catch (error) {
            let message = 'Error updating all charts: ' + error.message;
            // Provide specific guidance for page loading errors
            if (message.includes('findAll') || message.includes('loadAsync')) {
                message = 'Error loading pages. Some pages may be locked or inaccessible. Try updating individual charts instead.';
            }
            else if (message.includes('404')) {
                message = 'Some charts returned 404 errors. They may have been deleted or moved in Google Sheets.';
            }
            else if (message.includes('403')) {
                message = 'Some charts returned access denied errors. Check their publishing settings in Google Sheets.';
            }
            figma.notify(message, { error: true });
            try {
                figma.ui.postMessage({ type: 'error', context: 'update-all', message });
            }
            catch (_c) { }
        }
    }
    if (msg.type === 'test-chart-url') {
        try {
            const { url } = msg;
            // Convert URL to image URL
            const imageUrl = convertToImageUrl(url);
            // Test the URL by attempting to fetch the image
            const { imageBuffer, contentType } = yield fetchImageData(imageUrl);
            validateImageData(imageBuffer, contentType, imageUrl);
            figma.notify('✅ Chart URL is working correctly!');
            try {
                figma.ui.postMessage({ type: 'success', message: 'Chart URL is working correctly!' });
            }
            catch (_d) { }
        }
        catch (error) {
            let message = 'Error testing chart URL: ' + error.message;
            // Provide specific guidance for common errors
            if (message.includes('404')) {
                message = '❌ Chart not found (404 error). The chart may have been deleted, moved, or is no longer published. Please re-publish the chart in Google Sheets.';
            }
            else if (message.includes('403')) {
                message = '❌ Access denied (403 error). The chart may be private or the sharing settings have changed. Please check the chart\'s publishing settings.';
            }
            else if (message.includes('Network error')) {
                message = '❌ Network error. Please check your internet connection.';
            }
            figma.notify(message, { error: true });
            try {
                figma.ui.postMessage({ type: 'error', context: 'test', message });
            }
            catch (_e) { }
        }
    }
    if (msg.type === 'delete-chart') {
        try {
            const { url } = msg;
            // Remove from stored charts
            const charts = (yield figma.clientStorage.getAsync('charts')) || [];
            const filteredCharts = charts.filter(chart => chart.url !== url);
            yield figma.clientStorage.setAsync('charts', filteredCharts);
            figma.notify('Chart removed from history');
        }
        catch (error) {
            const message = 'Error removing chart: ' + error.message;
            figma.notify(message, { error: true });
            try {
                figma.ui.postMessage({ type: 'error', context: 'delete', message });
            }
            catch (_f) { }
        }
    }
});
function convertToImageUrl(inputUrl) {
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
