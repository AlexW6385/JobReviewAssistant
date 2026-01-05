// JobReviewAssistant UI Controller (Refactored)
// Relies on parser.js for logic.

// ==========================================
// PART 1: LOCAL AUTO-PARSER (WaterlooWorks Only)
// ==========================================
class LocalWaterlooOverlay {
    constructor() {
        this.data = null;
        this.currentJobId = null;    // Unique identifier for current JD
        this.dismissedJobId = null;  // Which JD user dismissed
        this.checkAndRun();
    }

    // Generate a unique ID for a JD based on key content
    generateJobId(text) {
        const title = text.match(/Job Title:\s*([^\n]+)/)?.[1]?.trim() || "";
        const company = text.match(/Organization:\s*([^\n]+)/)?.[1]?.trim() || "";
        const jobId = text.match(/Job ID:\s*(\d+)/)?.[1] || "";
        // Create a unique identifier
        return `${jobId}-${title}-${company}`.toLowerCase().replace(/\s+/g, '-');
    }

    checkAndRun() {
        if (!window.location.href.includes('waterlooworks.uwaterloo.ca')) {
            return;
        }

        const attemptParse = () => {
            const bodyText = document.body.innerText;
            
            // Check if this is a JD page
            const isJDPage = bodyText.includes("JOB POSTING INFORMATION") || 
                            bodyText.includes("Job Posting Information") ||
                            bodyText.includes("Job Title:");
            
            if (!isJDPage) {
                // Not a JD page - clean up and reset
                this.removeCard();
                this.currentJobId = null;
                this.dismissedJobId = null; // Reset dismissed state when leaving JD pages
                return;
            }

            const newJobId = this.generateJobId(bodyText);
            
            // Same job, no change needed
            if (newJobId === this.currentJobId) {
                return;
            }
            
            // NEW JOB DETECTED
            console.log('[JRA-Local] New JD detected:', newJobId);
            
            // Clean up old card
            this.removeCard();
            this.currentJobId = newJobId;
            
            // Check if user dismissed THIS specific job
            if (newJobId === this.dismissedJobId) {
                console.log('[JRA-Local] User dismissed this job, not showing card');
                return;
            }
            
            // This is a different job, clear dismissed state
            this.dismissedJobId = null;

            // Parse and show card
            if (typeof WaterlooParser !== 'undefined') {
                this.data = WaterlooParser.parse(bodyText);
                this.injectCard();
            } else {
                console.error("WaterlooParser not found.");
            }
        };

        // Initial parse
        attemptParse();
        
        // Watch for content changes with debounce
        let timeout;
        const observer = new MutationObserver(() => {
            clearTimeout(timeout);
            timeout = setTimeout(attemptParse, 300);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    removeCard() {
        const existing = document.getElementById('jra-local-card');
        if (existing) existing.remove();
    }

    injectCard() {
        if (document.getElementById('jra-local-card')) return;

        const card = document.createElement('div');
        card.id = 'jra-local-card';

        // Generate Skills HTML
        const skillsHtml = (this.data.skills && this.data.skills.length > 0)
            ? `<div class="jra-fact-row">
                 <span class="jra-fact-label">Tech Stack</span>
                 <div class="jra-tags-row">
                    ${this.data.skills.map(s => `<span class="jra-tag">${s}</span>`).join('')}
                 </div>
               </div>`
            : '';

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
                ${skillsHtml}
                ${this.data.apply_url ? `<a href="${this.data.apply_url}" target="_blank" class="jra-apply-btn">Apply Now ↗</a>` : ''}
            </div>
        `;

        document.body.appendChild(card);
        this.makeDraggable(card);

        // Close logic - remember which job was dismissed
        document.getElementById('jra-local-close').addEventListener('click', () => {
            this.dismissedJobId = this.currentJobId;
            console.log('[JRA-Local] User dismissed job:', this.dismissedJobId);
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

            const rect = el.getBoundingClientRect();
            if (el.style.right) {
                el.style.left = rect.left + 'px';
                el.style.top = rect.top + 'px';
                el.style.right = 'auto';
            }
            initialLeft = parseInt(el.style.left || rect.left);
            initialTop = parseInt(el.style.top || rect.top);
            header.style.cursor = 'grabbing';
            e.preventDefault(); // Prevent text selection
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
            if (header) header.style.cursor = 'move';
        });
    }
}


// ==========================================
// PART 2: MANUAL AI WIDGET (Universal)
// ==========================================
class AIWidget {
    constructor() {
        this.apiKey = null;
        this.provider = 'openai';
        this.baseUrl = 'https://api.openai.com/v1';
        this.model = 'gpt-4o-mini';
        this.lastAnalyzedUrl = null;  // Track which URL was analyzed
        this.hasAnalysis = false;      // Track if we have analysis results
        this.init();
    }

    async init() {
        const settings = await chrome.storage.local.get(['jra_api_key', 'api_provider', 'api_base_url', 'api_model']);
        this.apiKey = settings.jra_api_key;
        this.provider = settings.api_provider || 'openai';
        this.baseUrl = settings.api_base_url || this.baseUrl;
        this.model = settings.api_model || this.model;
        this.injectUI();
        this.setupListeners();
        this.setupURLWatcher();
    }

    // Watch ONLY for URL changes (not content changes)
    setupURLWatcher() {
        let lastUrl = window.location.href;
        
        const checkForURLChange = () => {
            const currentUrl = window.location.href;
            
            // Only reset on URL change
            if (currentUrl !== lastUrl) {
                console.log('[JRA-AI] URL changed from', lastUrl, 'to', currentUrl);
                lastUrl = currentUrl;
                this.resetCardState();
            }
        };
        
        // Check periodically for SPA navigation
        setInterval(checkForURLChange, 500);

        // Also listen to popstate for browser back/forward
        window.addEventListener('popstate', () => {
            console.log('[JRA-AI] Popstate detected, resetting AI card');
            setTimeout(() => this.resetCardState(), 100);
        });
    }

    // Reset card to initial state
    resetCardState() {
        const card = document.getElementById('jra-ai-card');
        const resultArea = document.getElementById('jra-ai-result-area');
        const analyzeBtn = document.getElementById('jra-btn-analyze');
        
        console.log('[JRA-AI] Resetting card state');
        
        // Hide card but keep it ready
        if (card) {
            card.classList.remove('visible');
        }
        
        // Clear previous results
        if (resultArea) {
            resultArea.innerHTML = '';
        }
        
        // Reset button
        if (analyzeBtn) {
            analyzeBtn.innerText = '✨ Generate Analysis';
        }
        
        this.lastAnalyzedUrl = null;
        this.hasAnalysis = false;
        this.toggleView('action');
    }

    injectUI() {
        if (document.getElementById('jra-ai-widget')) return;

        const container = document.createElement('div');
        container.id = 'jra-ai-widget';
        // Note: jra-ai-card is purely hidden by default via inline style to prevent FOUC "two buttons" glitch
        container.innerHTML = `
            <!-- Floating Action Button -->
            <button id="jra-ai-fab" title="Analyze Job with AI">✨</button>

            <!-- Main Card (Hidden) -->
            <div id="jra-ai-card" style="display: none;">
                <div class="jra-card-header">
                    <span>AI Analysis</span>
                    <div>
                        <button id="jra-btn-settings" class="jra-icon-btn" title="Settings">⚙️</button>
                        <button id="jra-btn-close" class="jra-icon-btn" title="Close">✕</button>
                    </div>
                </div>

                <div class="jra-card-content">
                    
                    <!-- View: Settings -->
                    <div id="jra-view-settings" class="${this.apiKey ? 'hidden' : ''}">
                        <div class="jra-settings-form">
                            <div class="jra-field">
                                <label style="display:block; margin-bottom:4px; font-weight:500; color:#374151;">Provider</label>
                                <select id="jra-input-provider" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; background:#fff; font-size:14px;">
                                    <option value="openai" ${this.provider === 'openai' ? 'selected' : ''} style="font-size:14px;">OpenAI</option>
                                    <option value="anthropic" ${this.provider === 'anthropic' ? 'selected' : ''} style="font-size:14px;">Claude (Anthropic)</option>
                                    <option value="gemini" ${this.provider === 'gemini' ? 'selected' : ''} style="font-size:14px;">Gemini (Google)</option>
                                    <option value="custom" ${this.provider === 'custom' ? 'selected' : ''} style="font-size:14px;">Custom (OpenAI Compatible)</option>
                                </select>
                            </div>

                            <div class="jra-field" style="margin-top:12px;">
                                <label style="display:block; margin-bottom:4px; font-weight:500; color:#374151;">API Key</label>
                                <input type="password" id="jra-input-key" placeholder="sk-..." value="${this.apiKey || ''}" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size:14px;">
                            </div>

                            <div class="jra-field ${this.provider === 'custom' ? '' : 'hidden'}" id="jra-group-url" style="margin-top:12px;">
                                <label style="display:block; margin-bottom:4px; font-weight:500; color:#374151;">Base URL</label>
                                <input type="text" id="jra-input-url" value="${this.baseUrl}" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size:14px;">
                            </div>

                            <div class="jra-field" style="margin-top:12px;">
                                <label style="display:block; margin-bottom:4px; font-weight:500; color:#374151;">Model Name</label>
                                <input type="text" id="jra-input-model" value="${this.model}" placeholder="e.g. gpt-4o-mini" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size:14px;">
                            </div>
                            
                            <button id="jra-btn-save" class="jra-btn jra-btn-primary" style="margin-top:20px; width:100%; justify-content:center;">Save Settings</button>
                        </div>
                    </div>

                    <!-- View: Action -->
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

        // Inject Critical Styles for visibility toggling
        if (!document.getElementById('jra-style-critical')) {
            const style = document.createElement('style');
            style.id = 'jra-style-critical';
            style.textContent = `
                 .hidden { display: none !important; } 
                 #jra-ai-card.visible { display: block !important; }
             `;
            document.head.appendChild(style);
        }
    }

    setupListeners() {
        const card = document.getElementById('jra-ai-card');
        const providerSelect = document.getElementById('jra-input-provider');
        const urlGroup = document.getElementById('jra-group-url');

        if (providerSelect) {
            providerSelect.addEventListener('change', (e) => {
                const val = e.target.value;
                if (val === 'custom') {
                    urlGroup.classList.remove('hidden');
                } else {
                    urlGroup.classList.add('hidden');
                }
            });
        }

        document.getElementById('jra-ai-fab').addEventListener('click', () => {
            // Show/hide the card - results are preserved
            card.classList.toggle('visible');
        });

        document.getElementById('jra-btn-close').addEventListener('click', () => {
            card.classList.remove('visible');
        });

        document.getElementById('jra-btn-settings').addEventListener('click', () => {
            this.toggleView('settings');
        });

        document.getElementById('jra-btn-save').addEventListener('click', async () => {
            const provider = providerSelect.value;
            const key = document.getElementById('jra-input-key').value.trim();
            const url = document.getElementById('jra-input-url').value.trim();
            const model = document.getElementById('jra-input-model').value.trim();

            if (!key) {
                alert('API Key is required');
                return;
            }

            await chrome.storage.local.set({
                api_provider: provider,
                jra_api_key: key,
                api_base_url: url,
                api_model: model
            });

            this.apiKey = key;
            this.provider = provider;
            this.toggleView('action');
        });

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

    // Extract the best JD content from page
    extractJDContent() {
        const bodyText = document.body.innerText;
        
        // For WaterlooWorks, try to get the main JD section
        let jdContent = bodyText;
        
        // Try to find JD-specific sections
        const jdStart = bodyText.indexOf('JOB POSTING INFORMATION');
        if (jdStart !== -1) {
            jdContent = bodyText.substring(jdStart);
        } else {
            // Try alternative marker
            const altStart = bodyText.indexOf('Job Title:');
            if (altStart !== -1) {
                jdContent = bodyText.substring(Math.max(0, altStart - 200));
            }
        }
        
        // Limit to reasonable size but ensure we get enough
        return jdContent.substring(0, 25000);
    }

    async runAnalysis() {
        this.toggleView('loading');

        try {
            const text = this.extractJDContent();
            const currentUrl = window.location.href;
            
            // Log the input being sent to LLM for debugging
            console.log('[JRA-AI] ========== LLM INPUT START ==========');
            console.log('[JRA-AI] Current URL:', currentUrl);
            console.log('[JRA-AI] Input length:', text.length, 'characters');
            console.log('[JRA-AI] First 200000 chars:', text.substring(0, 200000));
            console.log('[JRA-AI] ========== LLM INPUT END ==========');
            
            const response = await chrome.runtime.sendMessage({
                action: "analyzeWithLLM",
                data: { text }
            });

            if (response.success) {
                console.log('[JRA-AI] LLM Response:', response.data);
                
                // Render results
                this.renderResult(response.data);
                this.toggleView('action');
                
                // Mark that we have analysis for this URL
                this.lastAnalyzedUrl = currentUrl;
                this.hasAnalysis = true;
                
                // Update button text
                const analyzeBtn = document.getElementById('jra-btn-analyze');
                if (analyzeBtn) {
                    analyzeBtn.innerText = "🔄 Regenerate";
                }
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

        // 1. Basic Info Grid
        if (data.basic_info) {
            html += `
            <div class="jra-ai-result-section" style="background:#f9fafb; padding:10px; border-radius:8px; margin-bottom:12px;">
                <div style="font-weight:600; color:#374151; margin-bottom:6px; font-size:13px;">AI Extracted Info</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:12px;">
                    <div><span style="color:#6b7280;">Title:</span> <b>${data.basic_info.title || 'N/A'}</b></div>
                    <div><span style="color:#6b7280;">Salary:</span> <b style="color:#16a34a">${data.basic_info.salary || 'N/A'}</b></div>
                    <div style="grid-column: span 2;"><span style="color:#6b7280;">Location:</span> <b>${data.basic_info.location || 'N/A'}</b></div>
                </div>
            </div>`;
        }

        // 2. Ratings (Bars)
        if (data.ratings) {
            const diffColor = data.ratings.difficulty > 7 ? '#ef4444' : (data.ratings.difficulty > 4 ? '#f59e0b' : '#10b981');
            const growthColor = data.ratings.growth > 7 ? '#10b981' : (data.ratings.growth > 4 ? '#f59e0b' : '#6b7280');

            html += `
            <div class="jra-ai-result-section" style="margin-bottom:16px;">
                 <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-size:13px; font-weight:500;">Difficulty</span>
                    <span style="font-size:13px; font-weight:bold; color:${diffColor}">${data.ratings.difficulty}/10</span>
                 </div>
                 <div style="background:#e5e7eb; height:6px; border-radius:3px; overflow:hidden;">
                    <div style="width:${data.ratings.difficulty * 10}%; background:${diffColor}; height:100%;"></div>
                 </div>
                 
                 <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; margin-bottom:6px;">
                    <span style="font-size:13px; font-weight:500;">Growth Opportunity</span>
                    <span style="font-size:13px; font-weight:bold; color:${growthColor}">${data.ratings.growth}/10</span>
                 </div>
                 <div style="background:#e5e7eb; height:6px; border-radius:3px; overflow:hidden;">
                    <div style="width:${data.ratings.growth * 10}%; background:${growthColor}; height:100%;"></div>
                 </div>
            </div>`;
        }

        // 3. Analysis (Summary & Domain)
        if (data.analysis) {
            html += `
             <div class="jra-ai-result-section">
                <div class="jra-ai-subtitle">Strategy & Analysis</div>
                <div style="margin-bottom:8px; font-size:13px;"><span style="background:#eff6ff; color:#1d4ed8; padding:2px 6px; border-radius:4px;">${data.analysis.domain || 'General'}</span></div>
                <p class="jra-ai-text">${data.analysis.summary || ''}</p>
                ${data.analysis.highlights ? `<p class="jra-ai-text" style="margin-top:8px; color:#4b5563;">✨ ${data.analysis.highlights}</p>` : ''}
             </div>`;
        }

        // Fallback
        if (!data.basic_info && !data.ratings && !data.analysis && data.summary) {
            html += `<p class="jra-ai-text">${data.summary}</p>`;
        }

        container.innerHTML = html;
    }
}

// Initialize
if (window.self === window.top) {
    new AIWidget();
    new LocalWaterlooOverlay();
}
