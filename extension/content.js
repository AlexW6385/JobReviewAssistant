/**
 * Content Script
 * Extracts job-related content from the current page DOM
 * Responds only to explicit extension messages
 */

/**
 * DOM selectors for various job sites
 * Multiple fallback selectors for robustness
 */
const SELECTORS = {
    // LinkedIn
    linkedin: {
        title: [
            '.job-details-jobs-unified-top-card__job-title',
            '.jobs-unified-top-card__job-title',
            '.t-24.t-bold.jobs-unified-top-card__job-title',
            'h1.t-24',
            'h1'
        ],
        company: [
            '.job-details-jobs-unified-top-card__company-name',
            '.jobs-unified-top-card__company-name',
            '.jobs-unified-top-card__subtitle-primary-grouping a',
            'a[data-tracking-control-name="public_jobs_topcard-org-name"]'
        ],
        description: [
            '.jobs-description__content',
            '.jobs-description-content__text',
            '.jobs-box__html-content',
            '#job-details',
            '.description__text'
        ]
    },
    // Indeed
    indeed: {
        title: [
            '.jobsearch-JobInfoHeader-title',
            'h1[data-testid="jobsearch-JobInfoHeader-title"]',
            '.icl-u-xs-mb--xs.icl-u-xs-mt--none.jobsearch-JobInfoHeader-title',
            'h1'
        ],
        company: [
            '[data-testid="inlineHeader-companyName"]',
            '.jobsearch-InlineCompanyRating-companyHeader',
            '.css-1saizt3.e1wnkr790',
            'div[data-company-name="true"]'
        ],
        description: [
            '#jobDescriptionText',
            '.jobsearch-jobDescriptionText',
            '.jobsearch-JobComponent-description'
        ]
    },
    // Glassdoor
    glassdoor: {
        title: [
            '[data-test="job-title"]',
            '.css-1vg6q84.e1tk4kwz1',
            'h1'
        ],
        company: [
            '[data-test="employerName"]',
            '.css-87uc0g.e1tk4kwz3',
            '.e11nt52q1'
        ],
        description: [
            '.jobDescriptionContent',
            '.desc',
            '[data-test="jobDescription"]'
        ]
    },
    // Lever
    lever: {
        title: [
            '.posting-headline h2',
            'h2'
        ],
        company: [
            '.posting-headline .sort-by-time',
            '.main-header-logo img'
        ],
        description: [
            '.posting-page .content',
            '.section-wrapper'
        ]
    },
    // Greenhouse
    greenhouse: {
        title: [
            '.app-title',
            'h1.heading'
        ],
        company: [
            '.company-name',
            '.logo img'
        ],
        description: [
            '#content',
            '.content'
        ]
    },
    // WaterlooWorks
    waterlooworks: {
        title: [
            '.job-title',
            'h1',
            '.title'
        ],
        company: [
            '.employer-name',
            '.organization-name',
            '.company-name'
        ],
        description: [
            '#job-posting-information',
            '.job-posting-information',
            '#job-description',
            '.job-description',
            '.table-condensed'
        ]
    },
    // Generic fallbacks
    generic: {
        title: ['h1', 'title'],
        company: [],
        description: ['main', 'article', '.content', '#content', 'body']
    }
};

/**
 * Detect which job site we're on
 * @returns {string} - The detected site key
 */
function detectSite() {
    const hostname = window.location.hostname;

    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('indeed.com')) return 'indeed';
    if (hostname.includes('glassdoor.com')) return 'glassdoor';
    if (hostname.includes('lever.co')) return 'lever';
    if (hostname.includes('greenhouse.io')) return 'greenhouse';
    if (hostname.includes('uwaterloo.ca')) return 'waterlooworks';

    return 'generic';
}

/**
 * Try multiple selectors and return the first match
 * @param {string[]} selectors - Array of CSS selectors to try
 * @returns {string|null} - The text content or null
 */
function trySelectors(selectors) {
    for (const selector of selectors) {
        try {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                return element.textContent.trim();
            }
        } catch (e) {
            // Invalid selector, continue to next
        }
    }
    return null;
}

/**
 * Clean text by removing excessive whitespace
 * @param {string} text - The text to clean
 * @returns {string} - Cleaned text
 */
function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
}

/**
 * Extract job data from the current page
 * @returns {Object} - The extracted job data
 */
function extractJobData() {
    const site = detectSite();
    const siteSelectors = SELECTORS[site];
    const genericSelectors = SELECTORS.generic;

    // Try site-specific selectors first, then fall back to generic
    let title = trySelectors(siteSelectors.title) ||
        trySelectors(genericSelectors.title) ||
        document.title;

    let company = trySelectors(siteSelectors.company) ||
        trySelectors(genericSelectors.company) ||
        '';

    // Priority 1: User selection (if any)
    const selection = window.getSelection().toString().trim();
    if (selection && selection.length > 50) {
        console.log('[JobReviewAssistant] Using user-selected text');
        rawText = selection;
    } else {
        // Priority 2: Structured selectors
        rawText = trySelectors(siteSelectors.description) ||
            trySelectors(genericSelectors.description);

        // Priority 3: Body text fallback
        if (!rawText) {
            rawText = cleanText(document.body.innerText);
        }
    }

    // Limit raw text length
    const MAX_TEXT_LENGTH = 15000;
    if (rawText && rawText.length > MAX_TEXT_LENGTH) {
        rawText = rawText.substring(0, MAX_TEXT_LENGTH) + '...';
    }

    return {
        url: window.location.href,
        title: cleanText(title),
        company: cleanText(company),
        raw_text: cleanText(rawText),
        is_selection: !!(selection && selection.length > 50)
    };
}

/**
 * Deep extraction: try to look into iframes if the current frame has no content
 */
function deepExtractJobData() {
    let data = extractJobData();

    // If we have very little content, try to look into same-origin iframes
    if (data.raw_text.length < 500) {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                    // We can't easily call extractJobData on another document without refactoring,
                    // but we can at least grab the innerText
                    const iframeText = cleanText(iframeDoc.body.innerText);
                    if (iframeText.length > data.raw_text.length) {
                        data.raw_text = iframeText;
                        // Also try to find title/company in iframe if missing
                        if (!data.title || data.title === 'WaterlooWorks') {
                            const h1 = iframeDoc.querySelector('h1');
                            if (h1) data.title = cleanText(h1.textContent);
                        }
                    }
                }
            } catch (e) {
                // Cross-origin iframe, skip
                console.log('[JobReviewAssistant] Skipping cross-origin iframe');
            }
        }
    }
    return data;
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractJobData') {
        try {
            const site = detectSite();
            console.log('[JobReviewAssistant] Detected site:', site);
            console.log('[JobReviewAssistant] Current URL:', window.location.href);

            const jobData = deepExtractJobData();

            // Debug: Log extracted data to console
            console.log('[JobReviewAssistant] Extracted Job Data:');
            console.log('  - Title:', jobData.title);
            console.log('  - Company:', jobData.company);
            console.log('  - Raw text length:', jobData.raw_text?.length || 0, 'characters');

            sendResponse({ success: true, data: jobData });
        } catch (error) {
            console.error('[JobReviewAssistant] Extraction error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    return true;
});
