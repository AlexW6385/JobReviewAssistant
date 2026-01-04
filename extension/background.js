/**
 * Background Service Worker
 * Acts as a network proxy for the extension
 * Forwards job data to the backend and returns analysis results
 */

const BACKEND_URL = 'http://localhost:8787/analyze';

/**
 * Send job data to backend for analysis
 * @param {Object} jobData - The extracted job posting data
 * @returns {Promise<Object>} - The analysis result
 */
async function analyzeJob(jobData) {
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jobData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Analysis request failed:', error);
    throw error;
  }
}

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeJob') {
    analyzeJob(request.data)
      .then((result) => {
        sendResponse({ success: true, data: result });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate async response
    return true;
  }
});
