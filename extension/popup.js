// JobReviewAssistant Popup Script

/**
 * Show/hide UI states
 */
function showState(state) {
    document.getElementById('loading').classList.toggle('hidden', state !== 'loading');
    document.getElementById('error').classList.toggle('hidden', state !== 'error');
    document.getElementById('results').classList.toggle('hidden', state !== 'results');
    document.getElementById('analyzeBtn').classList.toggle('hidden', state === 'loading');
}

/**
 * Show error message
 */
function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    showState('error');
}

/**
 * Settings Management
 */
function toggleSettings(show) {
    const panel = document.getElementById('settingsPanel');
    if (show) {
        panel.classList.remove('hidden');
        loadSettings();
    } else {
        panel.classList.add('hidden');
    }
}

async function loadSettings() {
    const data = await chrome.storage.local.get(['openai_api_key', 'api_base_url', 'api_model']);

    if (data.openai_api_key) {
        document.getElementById('apiKey').value = data.openai_api_key;
    }
    if (data.api_base_url) {
        document.getElementById('apiBaseUrl').value = data.api_base_url;
    } else {
        document.getElementById('apiBaseUrl').value = 'https://api.openai.com/v1'; // Default
    }
    if (data.api_model) {
        document.getElementById('apiModel').value = data.api_model;
    } else {
        document.getElementById('apiModel').value = 'gpt-4o-mini'; // Default
    }
}

async function saveSettings() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const apiBaseUrl = document.getElementById('apiBaseUrl').value.trim() || 'https://api.openai.com/v1';
    const apiModel = document.getElementById('apiModel').value.trim() || 'gpt-4o-mini';

    if (!apiKey) {
        showError('Please enter an API key'); // Using existing showError for now
        return;
    }

    await chrome.storage.local.set({
        openai_api_key: apiKey,
        api_base_url: apiBaseUrl,
        api_model: apiModel
    });

    // Visual feedback
    const btn = document.getElementById('saveSettingsBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Saved!';
    setTimeout(() => {
        btn.textContent = originalText;
        toggleSettings(false);
    }, 750);

    // Notify active tabs to update state if needed
    // const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    // for (const tab of tabs) {
    //     chrome.tabs.sendMessage(tab.id, {action: 'settingsUpdated'});
    // }
}

function clearSettings() {
    document.getElementById('apiKey').value = '';
    document.getElementById('apiBaseUrl').value = 'https://api.openai.com/v1'; // Reset to default
    document.getElementById('apiModel').value = 'gpt-4o-mini'; // Reset to default
    chrome.storage.local.remove(['openai_api_key', 'api_base_url', 'api_model'], () => {
        const btn = document.getElementById('clearSettingsBtn');
        btn.textContent = 'Cleared';
        setTimeout(() => btn.textContent = 'Clear', 750);
    });
}

async function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['openai_api_key'], (result) => {
            resolve(result.openai_api_key || null);
        });
    });
}

/**
 * Render tech stack tags
 */
function renderTechStack(techStack) {
    const container = document.getElementById('techStack');
    container.innerHTML = '';

    const allTech = [
        ...(techStack.languages || []),
        ...(techStack.frameworks || []),
        ...(techStack.tools || [])
    ];

    if (allTech.length === 0) {
        container.innerHTML = '<p class="no-tech">No technologies detected</p>';
        return;
    }

    // Languages
    if (techStack.languages?.length > 0) {
        const group = document.createElement('div');
        group.className = 'tech-group';
        group.innerHTML = '<span class="tech-label">Languages:</span>';
        techStack.languages.forEach(lang => {
            const tag = document.createElement('span');
            tag.className = 'tech-tag lang';
            tag.textContent = lang;
            group.appendChild(tag);
        });
        container.appendChild(group);
    }

    // Frameworks
    if (techStack.frameworks?.length > 0) {
        const group = document.createElement('div');
        group.className = 'tech-group';
        group.innerHTML = '<span class="tech-label">Frameworks:</span>';
        techStack.frameworks.forEach(fw => {
            const tag = document.createElement('span');
            tag.className = 'tech-tag framework';
            tag.textContent = fw;
            group.appendChild(tag);
        });
        container.appendChild(group);
    }

    // Tools
    if (techStack.tools?.length > 0) {
        const group = document.createElement('div');
        group.className = 'tech-group';
        group.innerHTML = '<span class="tech-label">Tools:</span>';
        techStack.tools.forEach(tool => {
            const tag = document.createElement('span');
            tag.className = 'tech-tag tool';
            tag.textContent = tool;
            group.appendChild(tag);
        });
        container.appendChild(group);
    }
}

/**
 * Render analysis results
 */
function renderResults(data) {
    // Title
    document.getElementById('jobTitle').textContent = data.title || 'Job Posting';

    // Facts
    document.getElementById('factLocation').textContent = data.location || 'Not specified';
    document.getElementById('factDuration').textContent = data.duration || 'Not specified';
    document.getElementById('factSalary').textContent = data.salary || 'Not specified';
    document.getElementById('factArrangement').textContent = data.work_arrangement || 'Not specified';

    // Apply link
    const applyLink = document.getElementById('applyLink');
    if (data.apply_url) {
        applyLink.href = data.apply_url;
        applyLink.classList.remove('hidden');
    } else {
        applyLink.classList.add('hidden');
    }

    // Tech Stack
    renderTechStack(data.tech_stack || {});

    showState('results');
}

/**
 * Extract job data from current tab (multi-frame support)
 */
async function extractJobData() {
    return new Promise(async (resolve, reject) => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                reject(new Error('No active tab found'));
                return;
            }

            // First try: content script
            chrome.tabs.sendMessage(tab.id, { action: 'extractJobData' }, async (response) => {
                if (!chrome.runtime.lastError && response?.success && response.data?.raw_text?.length > 200) {
                    console.log('[Popup] Got data from content script:', response.data.raw_text.length, 'chars');
                    resolve(response.data);
                    return;
                }

                // Fallback: scripting API for all frames
                console.log('[Popup] Trying scripting API...');
                try {
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id, allFrames: true },
                        func: () => {
                            const cleanText = (text) => text?.replace(/\s+/g, ' ').trim() || '';
                            return {
                                url: window.location.href,
                                title: cleanText(document.querySelector('h1')?.textContent || document.title),
                                raw_text: cleanText(document.body?.innerText || '')
                            };
                        }
                    });

                    let combinedText = '';
                    let bestTitle = '';

                    for (const result of results) {
                        if (result.result?.raw_text) {
                            combinedText += result.result.raw_text + '\n';
                            if (result.result.title.length > bestTitle.length) {
                                bestTitle = result.result.title;
                            }
                        }
                    }

                    console.log('[Popup] Combined:', combinedText.length, 'chars');

                    if (combinedText.length > 100) {
                        resolve({
                            url: tab.url,
                            title: bestTitle || 'Job Posting',
                            company: '',
                            raw_text: combinedText.substring(0, 50000)
                        });
                    } else {
                        reject(new Error('Could not extract job content. Try selecting the text manually.'));
                    }
                } catch (e) {
                    reject(new Error('Extraction failed: ' + e.message));
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Send data to backend for analysis
 */
async function sendToBackend(jobData) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: 'analyzeJob', data: jobData },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error('Extension error: ' + chrome.runtime.lastError.message));
                    return;
                }

                if (response?.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response?.error || 'Backend analysis failed'));
                }
            }
        );
    });
}

/**
 * Main analyze handler
 */
async function handleAnalyze() {
    showState('loading');

    try {
        // Extract job data
        const jobData = await extractJobData();

        // Add API Key for Dual Mode
        const apiKey = await getApiKey();
        if (apiKey) {
            jobData.api_key = apiKey;
            console.log('[Popup] Using LLM Mode (API Key present)');
        } else {
            console.log('[Popup] Using Code Mode (No API Key)');
        }

        // Update status
        const statusDiv = document.getElementById('extractionStatus');
        const statusText = document.getElementById('statusText');
        statusText.textContent = `Extracted: ${jobData.raw_text?.length || 0} chars`;
        statusDiv.classList.remove('hidden');

        if (!jobData.raw_text || jobData.raw_text.length < 100) {
            throw new Error('Not enough content extracted. Try selecting text manually.');
        }

        // Send to backend
        const result = await sendToBackend(jobData);

        // Render results
        renderResults(result);

    } catch (error) {
        showError(error.message);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('analyzeBtn').addEventListener('click', handleAnalyze);
    document.getElementById('retryBtn').addEventListener('click', handleAnalyze);

    // Settings listeners
    document.getElementById('settingsBtn').addEventListener('click', () => toggleSettings(true));
    document.getElementById('closeSettingsBtn').addEventListener('click', () => toggleSettings(false));
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('clearSettingsBtn').addEventListener('click', clearSettings);
});
