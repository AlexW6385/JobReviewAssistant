/**
 * Background Service Worker
 * Handles LLM API calls for the JobReviewAssistant
 * Supports: OpenAI, Anthropic (Claude), Google (Gemini), and Custom (OpenAI-compatible)
 */

async function analyzeWithLLM(data) {
  // 1. Get Settings
  const settings = await chrome.storage.local.get(['openai_api_key', 'api_provider', 'api_base_url', 'api_model']);
  const apiKey = settings.openai_api_key;
  const provider = settings.api_provider || 'openai';

  if (!apiKey) {
    throw new Error("API Key is missing. Please set it in the extension popup.");
  }

  // 2. Construct Prompts
  const systemPrompt = `You are an expert Career Coach and Job Analyzer. 
Your goal is to extract key information from job descriptions and provide a quick summary.
Output strictly in valid JSON format with the following schema:
{
  "summary": "2-3 sentences summarizing the role and company culture",
  "points": ["Key point 1", "Key point 2", ...],
  "pros": ["Pro 1", "Pro 2"],
  "cons": ["Con 1", "Con 2"],
  "tech_stack": ["Tool 1", "Lang 2", ...]
}
Do not output markdown code blocks, just the raw JSON string.`;

  const userPrompt = `Analyze the following job description:\n\n${data.text.substring(0, 15000)}`;

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
      ],
      temperature: 0.7
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
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanContent);

  } catch (e) {
    console.error("LLM Analysis Failed:", e);
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
