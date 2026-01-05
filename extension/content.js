// JobReviewAssistant Strict Separation Logic

// ==========================================
// PART 1: LOCAL AUTO-PARSER (WaterlooWorks Only)
// ==========================================
class LocalWaterlooOverlay {
    constructor() {
        this.data = null;
        this.checkAndRun();
    }

    checkAndRun() {
        if (!window.location.href.includes('waterlooworks.uwaterloo.ca') && !window.location.href.includes('JobReviewAssistant')) {
            return;
        }

        const bodyText = document.body.innerText;
        // Check for specific JD marker
        if (bodyText.includes("JOB POSTING INFORMATION") || bodyText.includes("Job Posting Information")) {
            console.log('[JRA-Local] JD Marker found. Parsing...');
            this.parse(bodyText);
            this.injectBanner();
        }
    }

    parse(text) {
        // Simplified Local Parser logic
        const extract = (marker, stops, limit = 100) => {
            const start = text.indexOf(marker);
            if (start === -1) return null;
            const contentStart = start + marker.length;
            let end = contentStart + limit;
            for (const stop of stops) {
                const stopIdx = text.indexOf(stop, contentStart);
                if (stopIdx !== -1 && stopIdx < end) end = stopIdx;
            }
            return text.substring(contentStart, end).trim().replace(/\s+/g, ' ').replace(/^[:\-\s]+|[:\-\s]+$/g, '');
        };

        this.data = {
            title: extract("Job Title:", ["Employer Internal", "Number of Job"]),
            location: extract("Job - City:", ["Job - Province", "Employment"]),
            duration: extract("Work Term Duration:", ["Job Summary", "Location:"]),
            salary: null // Basic placeholder
        };

        // Simple salary regex for demo
        const salaryMatch = text.match(/\$[\d,.]+\s*-?\s*\$[\d,.]+/);
        if (salaryMatch) this.data.salary = salaryMatch[0];
    }

    injectBanner() {
        if (document.getElementById('jra-local-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'jra-local-banner';
        banner.innerHTML = `
            <div class="jra-banner-header">
                <span>Job Detected: ${this.data.title || 'Unknown Role'}</span>
                <span style="font-size:12px; opacity:0.8">Local Parse</span>
            </div>
            <div class="jra-banner-content">
                <div class="jra-fact-box">
                    <div class="jra-fact-label">Location</div>
                    <div class="jra-fact-value">${this.data.location || 'N/A'}</div>
                </div>
                <div class="jra-fact-box">
                    <div class="jra-fact-label">Duration</div>
                    <div class="jra-fact-value">${this.data.duration || 'N/A'}</div>
                </div>
                <div class="jra-fact-box">
                    <div class="jra-fact-label">Salary</div>
                    <div class="jra-fact-value">${this.data.salary || 'N/A'}</div>
                </div>
            </div>
        `;
        document.body.appendChild(banner);
        // Push body down slightly if needed, but 'fixed' overlay is usually safer to avoid breaking layout flow too much
        document.body.style.marginTop = '120px';
    }
}


// ==========================================
// PART 2: MANUAL AI WIDGET (Universal)
// ==========================================
class AIWidget {
    constructor() {
        this.apiKey = null;
        this.baseUrl = 'https://api.openai.com/v1';
        this.model = 'gpt-4o-mini';

        this.init();
    }

    async init() {
        // Load settings first
        const settings = await chrome.storage.local.get(['openai_api_key', 'api_base_url', 'api_model']);
        this.apiKey = settings.openai_api_key;
        this.baseUrl = settings.api_base_url || this.baseUrl;
        this.model = settings.api_model || this.model;

        this.injectUI();
        this.setupListeners();
    }

    injectUI() {
        if (document.getElementById('jra-ai-widget')) return;

        const container = document.createElement('div');
        container.id = 'jra-ai-widget';
        container.innerHTML = `
            <!-- Floating Action Button -->
            <button id="jra-ai-fab" title="Analyze Job with AI">✨</button>

            <!-- Main Card (Hidden) -->
            <div id="jra-ai-card">
                <div class="jra-card-header">
                    <span>AI Analysis</span>
                    <div>
                        <button id="jra-btn-settings" class="jra-icon-btn" title="Settings">⚙️</button>
                        <button id="jra-btn-close" class="jra-icon-btn" title="Close">✕</button>
                    </div>
                </div>

                <div class="jra-card-content">
                    
                    <!-- View: Settings (Default if no key) -->
                    <div id="jra-view-settings" class="${this.apiKey ? 'hidden' : ''}">
                        <div class="jra-settings-form">
                            <div class="jra-field">
                                <label>API Key (Required)</label>
                                <input type="password" id="jra-input-key" placeholder="sk-..." value="${this.apiKey || ''}">
                            </div>
                            <div class="jra-field">
                                <label>Base URL</label>
                                <input type="text" id="jra-input-url" value="${this.baseUrl}">
                            </div>
                            <div class="jra-field">
                                <label>Model</label>
                                <input type="text" id="jra-input-model" value="${this.model}">
                            </div>
                            <button id="jra-btn-save" class="jra-btn jra-btn-primary">Save Settings</button>
                        </div>
                    </div>

                    <!-- View: Action (Default if key exists) -->
                    <div id="jra-view-action" class="${this.apiKey ? '' : 'hidden'}">
                        <div id="jra-ai-result-area"></div>
                        
                        <div id="jra-ai-controls">
                            <button id="jra-btn-analyze" class="jra-btn jra-btn-ai">
                                ✨ Generate Analysis
                            </button>
                        </div>
                    </div>

                    <!-- Loading State -->
                    <div id="jra-view-loading" class="hidden">
                        <div class="jra-loading-spinner"></div>
                        <div style="text-align:center; color:#6366f1; font-size:12px;">Analyzing with AI...</div>
                    </div>

                </div>
            </div>
        `;
        document.body.appendChild(container);
    }

    setupListeners() {
        const card = document.getElementById('jra-ai-card');

        // FAB Toggle
        document.getElementById('jra-ai-fab').addEventListener('click', () => {
            card.classList.toggle('visible');
        });

        // Close
        document.getElementById('jra-btn-close').addEventListener('click', () => {
            card.classList.remove('visible');
        });

        // Settings Toggle
        document.getElementById('jra-btn-settings').addEventListener('click', () => {
            this.toggleView('settings');
        });

        // Save Settings
        document.getElementById('jra-btn-save').addEventListener('click', async () => {
            const key = document.getElementById('jra-input-key').value.trim();
            const url = document.getElementById('jra-input-url').value.trim();
            const model = document.getElementById('jra-input-model').value.trim();

            if (!key) {
                alert('API Key is required');
                return;
            }

            await chrome.storage.local.set({
                openai_api_key: key,
                api_base_url: url,
                api_model: model
            });

            this.apiKey = key; // Update local state
            this.toggleView('action'); // Go to action view
        });

        // Analyze Action
        document.getElementById('jra-btn-analyze').addEventListener('click', () => {
            this.runAnalysis();
        });
    }

    toggleView(viewName) {
        const settingsView = document.getElementById('jra-view-settings');
        const actionView = document.getElementById('jra-view-action');
        const loadingView = document.getElementById('jra-view-loading');

        settingsView.classList.add('hidden');
        actionView.classList.add('hidden');
        loadingView.classList.add('hidden');

        if (viewName === 'settings') settingsView.classList.remove('hidden');
        if (viewName === 'action') actionView.classList.remove('hidden');
        if (viewName === 'loading') loadingView.classList.remove('hidden');
    }

    async runAnalysis() {
        this.toggleView('loading');

        try {
            const text = document.body.innerText.substring(0, 20000); // Capture page text
            const response = await chrome.runtime.sendMessage({
                action: "analyzeWithLLM",
                data: { text }
            });

            if (response.success) {
                this.renderResult(response.data);
                this.toggleView('action');
                // Hide the analyze button after success to show results cleanly? 
                // Alternatively, keep it for re-roll. Let's keep it but maybe change text.
                document.getElementById('jra-btn-analyze').innerText = "🔄 Regenerate";
            } else {
                alert("Error: " + response.error);
                this.toggleView('action');
            }
        } catch (e) {
            alert("Error: " + e.message);
            this.toggleView('action');
        }
    }

    renderResult(data) {
        const container = document.getElementById('jra-ai-result-area');

        let html = ``;

        if (data.summary) {
            html += `
            <div class="jra-ai-result-section">
                <div class="jra-ai-subtitle">Summary</div>
                <p class="jra-ai-text">${data.summary}</p>
            </div>`;
        }

        if (data.pros && data.pros.length) {
            html += `
            <div class="jra-ai-result-section">
                <div class="jra-ai-subtitle" style="color:#10b981">Pros</div>
                <ul class="jra-ai-list">
                    ${data.pros.map(p => `<li>${p}</li>`).join('')}
                </ul>
            </div>`;
        }

        if (data.cons && data.cons.length) {
            html += `
            <div class="jra-ai-result-section">
                <div class="jra-ai-subtitle" style="color:#ef4444">Cons</div>
                <ul class="jra-ai-list">
                    ${data.cons.map(c => `<li>${c}</li>`).join('')}
                </ul>
            </div>`;
        }

        container.innerHTML = html;
        // Hide the empty placeholder or just prepend
    }
}

// Global CSS helper for 'hidden'
// In case content.css didn't define .hidden (it was used in old code, let's ensure it works)
if (!document.getElementById('jra-style-overrides')) {
    const style = document.createElement('style');
    style.id = 'jra-style-overrides';
    style.textContent = `.hidden { display: none !important; }`;
    document.head.appendChild(style);
}

// Initialize
if (window.self === window.top) {
    // 1. Always run AI Widget (Universal)
    new AIWidget();

    // 2. Conditionally run Local Parser (WaterlooWorks)
    new LocalWaterlooOverlay();
}
