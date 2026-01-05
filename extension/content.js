// JobReviewAssistant Strict Separation Logic

// ==========================================
// PART 1: LOCAL AUTO-PARSER (WaterlooWorks Only)
// ==========================================

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

        const runIfFound = () => {
            const bodyText = document.body.innerText;
            if (bodyText.includes("JOB POSTING INFORMATION") || bodyText.includes("Job Posting Information")) {
                console.log('[JRA-Local] JD Marker found. Parsing...');
                this.parse(bodyText);
                this.injectCard();
                return true;
            }
            return false;
        };

        if (runIfFound()) return;

        console.log('[JRA-Local] Marker not found yet, observing changes...');
        const observer = new MutationObserver((mutations) => {
            if (runIfFound()) {
                observer.disconnect();
                console.log('[JRA-Local] Observer matches found, disconnected.');
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 10000);
    }

    /* 
       Parsing Logic Update:
       Uses strict section detection based on user examples.
       1. Split text into main chunks if possible, or use indexOf logic.
       2. Extract specific fields from "Location", "Compensation", and "Application" areas.
    */
    parse(text) {
        this.data = {
            title: null,
            location: null,
            duration: null,
            salary: null,
            apply_url: null
        };

        // Helper: safe extraction
        const getBetween = (start, stops, limit = 500) => {
            const sIdx = text.indexOf(start);
            if (sIdx === -1) return null;
            const contentStart = sIdx + start.length;
            let end = contentStart + limit;
            for (const stop of stops) {
                const stopIdx = text.indexOf(stop, contentStart);
                if (stopIdx !== -1 && stopIdx < end) end = stopIdx;
            }
            return text.substring(contentStart, end).trim();
        };

        // 1. Title
        this.data.title = getBetween("Job Title:", ["Note:", "Job Openings:", "Level:"], 100);

        // 2. Location (Complex Assembly)
        // Combine City + Province/State + Country + Arrangement
        // Logic: Scan for "Job - City:", "Job - Province/State:", "Employment Location Arrangement:"
        const city = getBetween("Job - City:", ["Job - Province", "Job - Postal", "Job - Country"], 50);
        const province = getBetween("Job - Province/State:", ["Job - Postal", "Job - Country"], 50);
        const arrangement = getBetween("Employment Location Arrangement:", ["Work Term Duration:", "Special Work"], 50);

        let locParts = [];
        if (city) locParts.push(city);
        if (province) locParts.push(province);
        if (arrangement) locParts.push(`(${arrangement})`);

        this.data.location = locParts.length > 0 ? locParts.join(", ") : "Unknown Location";

        // 3. Duration
        this.data.duration = getBetween("Work Term Duration:", ["Special Work Term", "Job Summary"], 100);

        // 4. Salary
        // Look specifically in "Compensation and Benefits" -> "Wage Rate per Hour" OR generic "$" regex
        // Contextual search is safer
        const compSection = getBetween("Compensation and Benefits:", ["Targeted Degrees"], 1000);
        if (compSection) {
            const wageMatch = compSection.match(/\$[\d,.]+(?:\s?per hour|\s?\/hr)?/i);
            if (wageMatch) {
                this.data.salary = wageMatch[0] + (wageMatch[0].includes("per") ? "" : "/hr");
            } else {
                // Try range in section
                const rangeMatch = compSection.match(/\$[\d,.]+\s*-\s*\$[\d,.]+/);
                if (rangeMatch) this.data.salary = rangeMatch[0];
            }
        }
        // Fallback global salary
        if (!this.data.salary) {
            const globalMatch = text.match(/\$[\d,.]+\s*-?\s*\$[\d,.]+/);
            if (globalMatch) this.data.salary = globalMatch[0];
        }

        // 5. Apply URL
        // Look in "Application Information" -> "If By Website, Go To:"
        const appSection = getBetween("Application Information", ["Company Information", "Organization:"], 2000);
        if (appSection) {
            // Try specific labeled URL first
            const labelMatch = appSection.match(/If By Website, Go To:\s*(https?:\/\/[^\s]+)/);
            if (labelMatch) {
                this.data.apply_url = labelMatch[1];
            } else {
                // Generic URL search in app section
                const anyUrl = appSection.match(/https?:\/\/[^\s<>"\']+/);
                if (anyUrl) this.data.apply_url = anyUrl[0];
            }
        }
    }

    injectCard() {
        if (document.getElementById('jra-local-card')) return;

        const card = document.createElement('div');
        card.id = 'jra-local-card';
        card.innerHTML = `
            <div class="jra-card-header" id="jra-local-header">
                <span class="jra-card-title-text" title="${this.data.title}">${this.data.title || 'Job Detected'}</span>
                <button id="jra-local-close">✕</button>
            </div>
            <div class="jra-card-content">
                <div class="jra-fact-row">
                    <span class="jra-fact-label">Location</span>
                    <span class="jra-fact-value">${this.data.location || 'N/A'}</span>
                </div>
                <div class="jra-fact-row">
                    <span class="jra-fact-label">Duration</span>
                    <span class="jra-fact-value">${this.data.duration || 'N/A'}</span>
                </div>
                <div class="jra-fact-row">
                    <span class="jra-fact-label">Salary</span>
                    <span class="jra-fact-value" style="color:#16a34a">${this.data.salary || 'N/A'}</span>
                </div>
                ${this.data.apply_url ? `<a href="${this.data.apply_url}" target="_blank" class="jra-apply-btn">Apply Now ↗</a>` : ''}
            </div>
        `;

        document.body.appendChild(card);
        this.makeDraggable(card);

        // Close logic
        document.getElementById('jra-local-close').addEventListener('click', () => {
            card.remove();
        });
    }

    makeDraggable(el) {
        const header = document.getElementById('jra-local-header');
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            // Get computed style numbers
            const rect = el.getBoundingClientRect();
            // We need to convert from 'right' positioning to 'left/top' for dragging to work well
            // Or just modify transform. Let's use left/top absolute.

            // Reset right to auto and set explicit left/top
            if (el.style.right) {
                el.style.left = rect.left + 'px';
                el.style.top = rect.top + 'px';
                el.style.right = 'auto';
            }

            initialLeft = parseInt(el.style.left || rect.left);
            initialTop = parseInt(el.style.top || rect.top);

            header.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            el.style.left = `${initialLeft + dx}px`;
            el.style.top = `${initialTop + dy}px`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'move';
        });
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
