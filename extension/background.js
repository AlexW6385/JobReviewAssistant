/**
 * Background Service Worker
 * Handles LLM API calls for the JobReviewAssistant
 * Supports: OpenAI, Anthropic (Claude), Google (Gemini), and Custom (OpenAI-compatible)
 */

async function analyzeWithLLM(data) {
  // 1. Get Settings
  const settings = await chrome.storage.local.get(['jra_api_key', 'api_provider', 'api_base_url', 'api_model']);
  const apiKey = settings.jra_api_key;
  const provider = settings.api_provider || 'openai';

  console.log('[JRA-Background] ========== ANALYSIS REQUEST ==========');
  console.log('[JRA-Background] Provider:', provider);
  console.log('[JRA-Background] Model:', settings.api_model || 'default');
  console.log('[JRA-Background] Input text length:', data.text?.length || 0);
  console.log('[JRA-Background] Input preview:', data.text?.substring(0, 500));

  if (!apiKey) {
    throw new Error("API Key is missing. Please set it in the extension popup.");
  }

  // 2. Construct Prompts
  const systemPrompt = `You are an expert Career Coach and Tech Recruiter.
Your goal is to analyze job descriptions and provide structured insights.
Output strictly in valid JSON format with the following 3 sections:

1. "basic_info": Extract these fields from the text:
   - "title": The job title/position name
   - "location": City, State/Province, Country and work arrangement (Remote/Hybrid/On-site)
   - "salary": IMPORTANT - Look very carefully for any compensation information. This could appear as:
     * Hourly rate (e.g. "$25/hr", "$30 per hour", "25 USD/hour")
     * Monthly salary (e.g. "$5000/month")
     * Annual salary (e.g. "$80,000/year", "80K-100K")
     * Salary range (e.g. "$20-$30/hr", "$70K-$90K")
     * Under sections like "Compensation", "Salary", "Pay", "Rate", "Benefits"
     * Sometimes written as just numbers near currency symbols
     If found, format as a clean string like "$XX/hr" or "$XXK/yr". If truly not mentioned anywhere, return "Not specified".
   - "tech_stack": List of technologies, programming languages, frameworks, tools mentioned

2. "ratings": Provide 0-10 scores for:
   - "difficulty": Application/Interview difficulty (10 = hardest, e.g. Jane Street/Google).
   - "growth": Growth & Learning opportunity (10 = massive growth).

3. "analysis":
   - "summary": A strategic summary of the role (2-3 sentences).
   - "domain": The primary domain (e.g. "ML Engineering", "Full Stack", "Embedded").
   - "highlights": A short string listing key benefits or unique points.

Example structure:
{
  "basic_info": { "title": "Software Engineer Intern", "location": "Toronto, ON (Hybrid)", "salary": "$28-$35/hr", "tech_stack": ["Python", "React", "AWS"] },
  "ratings": { "difficulty": 6, "growth": 8 },
  "analysis": { "summary": "...", "domain": "Full Stack Development", "highlights": "Great mentorship, modern tech stack" }
}
Do not output markdown code blocks, just the raw JSON string.`;

  // Use more of the input text to ensure we capture salary info
  const inputText = data.text.substring(0, 20000);
  const userPrompt = `Analyze the following job description:\n\n${inputText}`;
  
  console.log('[JRA-Background] User prompt length:', userPrompt.length);

  let url, method, headers, body;
  let model = settings.api_model;

  // 3. Provider Specific Request Construction
  if (provider === 'openai' || provider === 'custom') {
    // --- OpenAI / Custom ---
    const baseUrl = (provider === 'custom' && settings.api_base_url)
      ? settings.api_base_url.replace(/\/+$/, '')
      : 'https://api.openai.com/v1';

    url = `${baseUrl}/chat/completions`;
    model = model || 'gpt-4o-mini';

    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    body = {
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    };

  } else if (provider === 'anthropic') {
    // --- Anthropic (Claude) ---
    url = 'https://api.anthropic.com/v1/messages';
    model = model || 'claude-3-haiku-20240307';

    headers = {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    };

    body = {
      model: model,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt }
      ]
    };

  } else if (provider === 'gemini') {
    // --- Google (Gemini) ---
    model = model || 'gemini-1.5-flash';
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    headers = {
      'Content-Type': 'application/json'
    };

    // Gemini often prefers system instructions separately or merged. 
    // For simplicity/compatibility with 1.0/Pro, we merge system into user prompt or use simple structure.
    body = {
      contents: [{
        parts: [{ text: systemPrompt + "\n\n" + userPrompt }]
      }]
    };
  }

  // 4. Call API
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error ${response.status}: ${errText}`);
    }

    const result = await response.json();
    let content = "";

    // 5. Parse Response based on Provider
    if (provider === 'openai' || provider === 'custom') {
      content = result.choices[0].message.content;
    } else if (provider === 'anthropic') {
      content = result.content[0].text;
    } else if (provider === 'gemini') {
      content = result.candidates[0].content.parts[0].text;
    }

    // 6. Clean and Parse JSON
    console.log('[JRA-Background] Raw LLM response:', content);
    
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanContent);
    
    console.log('[JRA-Background] Parsed response:', parsed);
    console.log('[JRA-Background] ========== ANALYSIS COMPLETE ==========');
    
    return parsed;

  } catch (e) {
    console.error("[JRA-Background] LLM Analysis Failed:", e);
    throw e;
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeWithLLM') {
    analyzeWithLLM(request.data)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Async
  }
});
