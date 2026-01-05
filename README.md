# JobReviewAssistant (Client-Side Edition)

A powerful **Chrome Extension** that enhances your WaterlooWorks job search experience with **Instant Local Parsing** and **Multi-Provider AI Analysis** (OpenAI, Claude, Gemini).

**🚀 Zero Setup Required. No Python. No Servers.**

## ✨ Features

### 1. ⚡ Local Auto-Parser (Instant)
*   **Zero Latency:** Runs entirely in your browser using JavaScript.
*   **Smart Extraction:**
    *   **Salary:** Heuristically infers hourly/yearly rates (e.g., "$300,000" -> "$300,000/yr").
    *   **Tech Stack:** Detects 120+ keywords (React, Docker, AWS, etc.) and tags them colorfully.
    *   **Location:** Simplifies to "City (Arrangement)".
    *   **Apply URL:** Robustly grabs the direct application link.
*   **UI:** Injects a draggable info card directly onto the job page.

### 2. 🤖 AI Analysis (On-Demand)
*   **Multi-Provider Support:** Choose your preferred AI:
    *   🟢 **OpenAI** (GPT-4o, GPT-3.5)
    *   🟣 **Anthropic** (Claude 3.5 Sonnet, Haiku)
    *   🔵 **Google** (Gemini 1.5 Flash/Pro)
*   **Privacy First:** Your API key is stored locally in Chrome (`chrome.storage.local`). The extension communicates *directly* from your browser to the AI provider. No middleman server.

---

## 📥 Installation

1.  **Clone or Download** this repository.
    ```bash
    git clone https://github.com/YourRepo/JobReviewAssistant.git
    ```
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer Mode** (top right toggle).
4.  Click **Load unpacked**.
5.  Select the `extension` folder from this project.
6.  **Done!** Go to WaterlooWorks and open a job.

---

## 🛠 Usage

### Local Parser
1.  Navigate to a standard **WaterlooWorks Job Posting**.
2.  A **Job Card** will automatically appear at the top right.
3.  You can drag it around or close it.

### AI Analysis
1.  Click the floating **✨ (Sparkle)** button in the bottom right.
2.  Click the **⚙️ (Settings)** icon.
3.  **Select Provider:** OpenAI, Claude, or Gemini.
4.  **Enter API Key:** Paste your key.
5.  Click **Save**.
6.  Click **✨ Generate Analysis** to get a summary, pros/cons, and rating.

---

## 🏗 Architecture

The project has moved to a **Serverless Client-Side Architecture** (v3.0).

*   **`content.js`**: The brain. Handles page detection, local parsing, UI injection, and settings management.
*   **`background.js`**: The messenger. Acts as a secure Service Worker to proxy requests to LLM APIs (OpenAI/Anthropic/Google), avoiding CORS issues.
*   **Privacy:** All data processing happens on your machine. No data is sent to our servers.

---

## 📜 Privacy & Security
*   **API Keys:** Stored only in your browser's local storage.
*   **Job Data:** Only sent to the AI provider you select, and only when you click "Generate".
*   **Open Source:** You can inspect the code to verify no data exfiltration occurs.
