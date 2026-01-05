# JobReviewAssistant (Job Review Assistant)

[English](#english) | [中文](#chinese)

---

<a name="english"></a>
## 🇬🇧 English

### Overview
**JobReviewAssistant** is a privacy-focused, dual-mode browser extension for analyzing job postings.
It features two distinct modes:
1.  **Local Auto-Parser (Code Mode):** Automatically detects WaterlooWorks job postings and instantly displays a banner with key details (Salary, Duration, Location) extracted via pure code logic. Zero API calls, zero latency.
2.  **AI Analysis (LLM Mode):** A universal, manual-trigger widget that allows you to analyze ANY job posting using your own LLM API Key (OpenAI-compatible).

### Features
*   **Privacy First:** API Keys are stored locally in your browser. All analysis happens on your machine or via direct API calls you control.
*   **Dual Architecture:** Strict separation between the lightweight local parser and the powerful AI analyzer.
*   **Aggressive Overlay:** Uses maximum Z-Index to ensure the tool is visible even on complex enterprise portals like WaterlooWorks.
*   **Customizable AI:** Support for any OpenAI-compatible provider (OpenAI, Anthropic via proxy, Local LLMs, etc.) by configuring the Base URL and Model Name.

### Project Structure
```
jobreviewassistant
├── extension/          # Chrome Extension (Frontend)
│   ├── manifest.json
│   ├── content.js      # Core logic (Overlay & Widget)
│   ├── content.css     # Styles
│   └── popup.html      # Status page
├── backend/            # Local Analysis Service (Optional for Code Mode)
│   ├── server.py       # FastAPI Entrypoint
│   ├── analyzer.py     # Logic Router
│   └── debug_logs/     # Separate logs for Code vs LLM
└── docs/
```

### Setup & Usage
1.  **Backend (Optional for full features):**
    ```bash
    cd backend
    pip install -r requirements.txt
    python server.py
    ```
2.  **Extension:**
    *   Open `chrome://extensions/`
    *   Enable "Developer Mode"
    *   "Load Unpacked" -> Select `extension/` folder.
3.  **Use It:**
    *   **WaterlooWorks:** Open a job application. The **Top Banner** should appear automatically.
    *   **Any Site:** Click the **Purple ✨ Button** (bottom-right). Enter your API Key in the settings, then click "Generate Analysis".

---

<a name="chinese"></a>
## 🇨🇳 中文 (Chinese)

### 简介
**JobReviewAssistant** 是一个注重隐私的双模式浏览器插件，用于辅助分析职位描述（JD）。
它包含两种独立模式：
1.  **本地自动解析 (纯代码模式):** 自动检测 WaterlooWorks 的职位页面，并通过纯代码逻辑提取关键信息（薪资、时长、地点），并在顶部显示横幅。**无需 API Key，零延迟，完全本地运行。**
2.  **AI 深度分析 (LLM 模式):** 一个通用的悬浮组件。你可以在任意招聘网站点击右下角的按钮，配置自己的 API Key，让 AI 为你生成深度分析报告（包括技术栈、优缺点、总结）。

### 核心特性
*   **隐私优先:** API Key 仅保存在你的浏览器本地。所有分析均由你掌控。
*   **双架构设计:** 轻量级的本地解析器与强大的 AI 分析器完全解耦，互不依赖。
*   **强力覆盖:** 使用最高层级 Z-Index，确保插件在 WaterlooWorks 等复杂企业内网中也能正常显示，不被弹窗遮挡。
*   **自定义模型:** 支持任意兼容 OpenAI 格式的接口（如 OpenAI, DeepSeek, 本地 LLM 等），可自定义 Base URL 和模型名称。

### 目录结构
```
jobreviewassistant
├── extension/          # Chrome 插件前端
│   ├── manifest.json
│   ├── content.js      # 核心逻辑 (包含本地解析器和 AI 组件)
│   ├── content.css     # 样式文件
│   └── popup.html      # 状态简介页
├── backend/            # 本地后端服务
│   ├── server.py       # FastAPI 服务入口
│   ├── analyzer.py     # 分析逻辑路由
│   └── debug_logs/     # 日志 (区分纯代码和 LLM 日志)
└── docs/
```

### 安装与使用
1.  **后端服务 (推荐开启):**
    ```bash
    cd backend
    pip install -r requirements.txt
    python server.py
    ```
2.  **安装插件:**
    *   打开 Chrome 扩展管理页 `chrome://extensions/`
    *   开启右上角的 "开发者模式" (Developer Mode)
    *   点击 "加载已解压的扩展程序" (Load Unpacked) -> 选择本项目中的 `extension/` 文件夹。
3.  **开始使用:**
    *   **WaterlooWorks 场景:** 打开具体的职位申请页。插件会自动识别并弹出顶部的**信息横幅**。
    *   **通用场景:** 在任意页面点击右下角的**紫色 ✨ 按钮**。首次使用需并在组件内输入 API Key，然后点击 "Generate Analysis" 生成分析。

---
**Disclaimer:** This tool is for personal decision support only. Use responsibly.
