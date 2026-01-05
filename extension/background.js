/**
 * Background Service Worker
 * Handles LLM API calls for the JobReviewAssistant
 */

// Defaults
const DEFAULT_API_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';

async function analyzeWithLLM(data) {
  // 1. Get Settings
  const settings = await chrome.storage.local.get(['openai_api_key', 'api_base_url', 'api_model']);
  const apiKey = settings.openai_api_key;
  const baseUrl = (settings.api_base_url || DEFAULT_API_URL).replace(/\/+$/, ''); // Remove trailing slash
  const model = settings.api_model || DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error("API Key is missing. Please set it in the extension popup.");
  }

  // 2. Construct Prompt
  // User requested "json output... summarize JD... fields..."
  // We'll create a structured system prompt.
  const systemPrompt = `You are an expert Career Coach and Job Analyzer. 
Your goal is to extract key information from job descriptions and provide a quick summary.
Output strictly in valid JSON format with the following schema:
{
  "summary": "2-3 sentences summarizing the role and company culture",
  "points": ["Key point 1 (e.g. unique benefit)", "Key point 2 (e.g. weird requirement)", ...],
  "pros": ["Pro 1", "Pro 2"],
  "cons": ["Con 1", "Con 2"],
  "tech_stack": ["Tool 1", "Lang 2", ...]
}
Do not output markdown code blocks, just the raw JSON string.`;

  const userPrompt = `Analyze the following job description:\n\n${data.text.substring(0, 15000)}`;

  // 3. Call API
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 1
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error ${response.status}: ${errText}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;

    // 4. Parse JSON
    // Handle potential markdown wrapping
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
