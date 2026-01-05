// JobReviewAssistant Strict Separation Logic

// ==========================================
// PART 1: LOCAL AUTO-PARSER (WaterlooWorks Only)
// ==========================================
class LocalWaterlooOverlay {
    constructor() {
        this.data = null;
        this.lastContentHash = "";
        this.checkAndRun();
    }

    checkAndRun() {
        if (!window.location.href.includes('waterlooworks.uwaterloo.ca') && !window.location.href.includes('JobReviewAssistant')) {
            return;
        }

        // Persistent parsing function
        const attemptParse = () => {
            const bodyText = document.body.innerText;
            // Check if JD is present
            if (!bodyText.includes("JOB POSTING INFORMATION") && !bodyText.includes("Job Posting Information")) {
                if (this.lastContentHash) {
                    this.removeCard();
                    this.lastContentHash = "";
                }
                return;
            }

            // Simple "hash" to detect content change
            const titleSnippet = bodyText.match(/Job Title:\s*([^\n]+)/)?.[1] || "";
            const currentHash = bodyText.length + "-" + titleSnippet;

            if (currentHash === this.lastContentHash) return; // No change

            // Content changed!
            console.log('[JRA-Local] New JD Content detected. Parsing...', titleSnippet);
            this.lastContentHash = currentHash;
            this.removeCard(); // Clear old
            this.parse(bodyText); // Parse new
            this.injectCard(); // Show new
        };

        // 1. Try immediately
        attemptParse();

        // 2. Persistent Observer
        let timeout;
        const observer = new MutationObserver((mutations) => {
            clearTimeout(timeout);
            timeout = setTimeout(attemptParse, 500); // Debounce check
        });

        observer.observe(document.body, { childList: true, subtree: true });
        console.log('[JRA-Local] Persistent observer started.');
    }

    removeCard() {
        const existing = document.getElementById('jra-local-card');
        if (existing) existing.remove();
    }

    parse(text) {
        this.data = {
            title: null,
            location: null,
            duration: null,
            salary: null,
            apply_url: null,
            skills: []
        };

        // Helper: safe extraction
        const getBetween = (start, stops, limit = 5000) => {
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

        // 2. Location (Simplified)
        // User Request: Use info under "Job Location" (mostly City) + Arrangement in parens.
        // We look for "Job - City:" or fallback to "Job Location:" if that exists in other formats.
        // Current WW format usually has "Job - City:" and "Job - Province/State:"

        let primaryLoc = getBetween("Job - City:", ["Job - Province", "Job - Postal", "Job - Country"], 50);
        if (!primaryLoc) {
            // Fallback if they use "Job Location:" header instead
            primaryLoc = getBetween("Job Location:", ["Job -", "Region"], 100);
        }

        const arrangementRaw = getBetween("Employment Location Arrangement:", ["Work Term Duration:", "Special Work"], 100);
        let arrangement = null;
        if (arrangementRaw) {
            const lower = arrangementRaw.toLowerCase();
            if (lower.includes('hybrid')) arrangement = 'Hybrid';
            else if (lower.includes('remote') || lower.includes('virtual')) arrangement = 'Remote';
            else if (lower.includes('in-person') || lower.includes('site')) arrangement = 'In-person';
        }

        if (primaryLoc) {
            this.data.location = primaryLoc + (arrangement ? ` (${arrangement})` : "");
        } else {
            this.data.location = arrangement ? arrangement : "Unknown Location";
        }

        // 3. Duration (Strict)
        const rawDuration = getBetween("Work Term Duration:", ["Special Work Term", "Job Summary"], 200);
        if (rawDuration) {
            const durMatch = rawDuration.match(/(\d+\s*(?:month|week)s?(?:\s*work\s*term)?)/i);
            if (durMatch) {
                this.data.duration = durMatch[1];
                if (rawDuration.toLowerCase().includes("prefer")) {
                    this.data.duration += " (Preferred)";
                }
            } else {
                this.data.duration = rawDuration.split('\n')[0].substring(0, 30);
            }
        }

        // 4. Salary (Smart Heuristics)
        const compSection = getBetween("Compensation and Benefits:", ["Targeted Degrees"], 1000) || "";
        let salaryFound = null;

        // 1. Explicit Hourly
        const hourlyRegex = /(?:\$|USD|CAD)?\s*(\d{1,3}(?:[,]\d{3})*(?:\.\d{2})?)\s*(?:USD|CAD)?\s*(?:per hour|\/hr)/i;
        const hourlyMatch = compSection.match(hourlyRegex);
        if (hourlyMatch) {
            salaryFound = `$${hourlyMatch[1]}/hr`;
        } else {
            // 2. Inference
            const moneyMatches = compSection.matchAll(/(?:\$|USD|CAD)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:USD|CAD)?/gi);
            for (const m of moneyMatches) {
                const rawVal = m[1].replace(/,/g, '');
                const val = parseFloat(rawVal);
                if (isNaN(val)) continue;
                if (val < 15) continue;
                if (val > 1900 && val < 2100) continue;

                let interval = "?";
                if (val < 150) interval = "/hr";
                else if (val > 20000) interval = "/yr";
                else if (val > 2000 && val < 10000) interval = "/mo";

                salaryFound = `$${m[1]}${interval}`;
                break;
            }
        }
        this.data.salary = salaryFound || null;

        // Fallback global salary if no salary found in section
        if (!this.data.salary) {
            const globalMatch = text.match(/\$[\d,.]+\s*-?\s*\$[\d,.]+/);
            if (globalMatch) this.data.salary = globalMatch[0];
        }

        // 5. Apply URL (Simple First Match)
        // User Request: Just find the "Application Information" section and grab the FIRST url found.
        this.data.apply_url = null;

        // We define the section broadly
        const appSection = getBetween("Application Information", ["Company Information", "Organization:"], 5000);

        if (appSection) {
            // Find the very first http/https link in this block
            // \S+ grabs non-whitespace characters (including query params)
            const match = appSection.match(/(https?:\/\/[^\s"'<>]+)/i);
            if (match) {
                this.data.apply_url = match[1];
            }
        }

        // 6. Tech Stack (Massive Expansion)
        this.data.skills = [];
        const skillsSection = getBetween("Required Skills:", ["Eligible applicants must:", "Compensation and Benefits"], 5000)
            || getBetween("Qualifications:", ["Eligible applicants must:", "Compensation and Benefits"], 5000);

        if (skillsSection) {
            const keywords = [
                // === Languages ===
                "Python", "Java", "C++", "C", "C#", "JavaScript", "JS", "TypeScript", "TS", "HTML", "CSS", "SQL", "NoSQL",
                "Go", "Golang", "Rust", "Swift", "Kotlin", "PHP", "Ruby", "Matlab", "R", "Scala", "Dart", "Lua", "Perl",
                "Haskell", "Elixir", "Erlang", "Clojure", "F#", "Groovy", "Julia", "Assembly", "Bash", "Shell", "PowerShell",
                "VBA", "Objective-C", "Solidity",

                // === Frameworks (Web/Mobile/Desktop) ===
                "React", "React.js", "React Native", "Angular", "Vue", "Vue.js", "Next.js", "Nuxt.js", "Svelte",
                "Node", "Node.js", "Express", "NestJS", "Django", "Flask", "FastAPI", "Spring", "Spring Boot",
                "ASP.NET", ".NET", ".NET Core", "Entity Framework", "Rails", "Ruby on Rails", "Laravel", "Symfony",
                "CodeIgniter", "GraphQL", "Apollo", "Tailwind", "Bootstrap", "Material UI", "Chakra UI", "Sass", "Less",
                "jQuery", "Ember", "Backbone", "Redux", "MobX", "Flutter", "Ionic", "Xamarin", "Cordova", "Electron", "Swing", "JavaFX", "WPF", "Qt",

                // === Databases ===
                "PostgreSQL", "Postgres", "MySQL", "MariaDB", "SQLite", "Oracle", "SQL Server", "MSSQL",
                "MongoDB", "Mongo", "Cassandra", "Redis", "Elasticsearch", "DynamoDB", "Firestore", "Firebase",
                "CouchDB", "Neo4j", "Realm", "Supabase",

                // === Cloud & DevOps ===
                "AWS", "Amazon Web Services", "Azure", "GCP", "Google Cloud", "Heroku", "Vercel", "Netlify", "DigitalOcean",
                "Docker", "Kubernetes", "K8s", "Terraform", "Ansible", "Puppet", "Chef", "Vagrant",
                "Jenkins", "GitLab CI", "CircleCI", "Travis CI", "GitHub Actions", "TeamCity", "Bamboo",
                "Git", "GitHub", "GitLab", "Bitbucket", "SVN", "Mercurial",
                "Nginx", "Apache", "Kafka", "RabbitMQ", "ActiveMQ", "SQS", "SNS",

                // === AI / Data ===
                "Pandas", "NumPy", "SciPy", "Matplotlib", "Seaborn", "Scikit-learn", "Sklearn",
                "PyTorch", "TensorFlow", "Keras", "Opencv", "NLP", "LLM", "GPT", "Bert", "Hugging Face",
                "Spark", "Hadoop", "Databricks", "Snowflake", "BigQuery", "Redshift", "Tableau", "Power BI", "Looker",
                "Airflow", "dbt", "Excel",

                // === Tools & Testing ===
                "Jira", "Confluence", "Trello", "Asana", "Notion", "Slack", "Teams", "Zoom",
                "Figma", "Sketch", "Adobe XD", "Photoshop", "Illustrator",
                "Selenium", "Cypress", "Playwright", "Jest", "Mocha", "Chai", "Junit", "TestNG", "Pytest", "RSpec",
                "Postman", "Insomnia", "Swagger", "OpenAPI",
                "Linux", "Unix", "Ubuntu", "CentOS", "RedHat", "Windows", "MacOS", "Android", "iOS", "Unity", "Unreal Engine"
            ];

            const lowerSection = skillsSection.toLowerCase();
            this.data.skills = keywords.filter(k => {
                // Escape special regex chars like +, #, .
                const escaped = k.replace(/[.+^${}()|[\]\\]/g, '\\$&');

                // Special handling for keywords
                if (k === 'C++') return lowerSection.includes('c++');
                if (k === 'C#') return lowerSection.includes('c#');
                if (k === '.NET') return lowerSection.includes('.net');
                if (k === 'Go') return lowerSection.match(/\bgo\b/); // Strict 'go'
                if (k === 'C') return lowerSection.match(/\bc\b/) && !lowerSection.includes('c++') && !lowerSection.includes('c#'); // Strict 'C'

                // General strict word boundary match
                const regex = new RegExp(`\\b${escaped.toLowerCase()}\\b`, 'i');
                return regex.test(lowerSection);
            });

            // Deduplicate (e.g. "React" and "React.js" -> keep simplified if possible, or just unique)
            this.data.skills = [...new Set(this.data.skills)];
        }
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
        this.provider = 'openai';
        this.baseUrl = 'https://api.openai.com/v1';
        this.model = 'gpt-4o-mini';

        this.init();
    }

    async init() {
        // Load settings first
        const settings = await chrome.storage.local.get(['openai_api_key', 'api_provider', 'api_base_url', 'api_model']);
        this.apiKey = settings.openai_api_key;
        this.provider = settings.api_provider || 'openai';
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
                                <label>Provider</label>
                                <select id="jra-input-provider" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; margin-bottom: 5px;">
                                    <option value="openai" ${this.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                                    <option value="anthropic" ${this.provider === 'anthropic' ? 'selected' : ''}>Claude (Anthropic)</option>
                                    <option value="gemini" ${this.provider === 'gemini' ? 'selected' : ''}>Gemini (Google)</option>
                                    <option value="custom" ${this.provider === 'custom' ? 'selected' : ''}>Custom (OpenAI Compatible)</option>
                                </select>
                            </div>

                            <div class="jra-field">
                                <label>API Key (Required)</label>
                                <input type="password" id="jra-input-key" placeholder="sk-..." value="${this.apiKey || ''}">
                            </div>

                            <div class="jra-field ${this.provider === 'custom' ? '' : 'hidden'}" id="jra-group-url">
                                <label>Base URL</label>
                                <input type="text" id="jra-input-url" value="${this.baseUrl}">
                            </div>

                            <div class="jra-field">
                                <label>Model Name</label>
                                <input type="text" id="jra-input-model" value="${this.model}" placeholder="e.g. gpt-4o-mini">
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
        const providerSelect = document.getElementById('jra-input-provider');
        const urlGroup = document.getElementById('jra-group-url');

        // Provider Change
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
                openai_api_key: key,
                api_base_url: url,
                api_model: model
            });

            this.apiKey = key;
            this.provider = provider;
            this.toggleView('action');
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
