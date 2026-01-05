# JobReviewAssistant (职位分析助手)

## 概述

**JobReviewAssistant** 是一个注重隐私的双模式浏览器插件，用于辅助分析职位描述（JD）。

它包含两种独立模式：
1.  **本地自动解析 (纯代码模式 / Auto-Parser):** 自动检测 WaterlooWorks 的职位页面，并通过纯代码逻辑即时提取关键信息（薪资、时长、地点），并在顶部显示横幅。**无需 API Key，零延迟，完全本地运行。**
2.  **AI 深度分析 (LLM 模式 / AI Analysis):** 一个通用的悬浮组件。可在任意招聘网站点击右下角的按钮，配置你自己的 API Key (OpenAI 兼容)，让 AI 为你生成深度分析报告（包括技术栈、优缺点、总结）。

---

## 核心特性

*   **隐私优先:** API Key 仅保存在你的浏览器本地存储中。所有分析均由你掌控，不会上传到任何第三方服务器（除了你调用的 LLM API）。
*   **双架构设计:** 轻量级的本地解析器与强大的 AI 分析器完全解耦，互不依赖。
*   **强力覆盖:** 使用最高层级 Z-Index (2147483647)，确保插件在 WaterlooWorks 等复杂企业内网中也能正常显示，不被弹窗遮挡。
*   **自定义模型:** 支持任意兼容 OpenAI 格式的接口（如 OpenAI, DeepSeek, 本地 LLM 等），可自定义 Base URL 和模型名称。

---

## 目录结构

```
jobreviewassistant
├── extension/          # Chrome 插件前端
│   ├── manifest.json
│   ├── content.js      # 核心逻辑 (包含本地解析器和 AI 组件)
│   ├── content.css     # 样式文件
│   └── popup.html      # 状态简介页
├── backend/            # 本地后端服务 (可选，用于本地代码解析日志等)
│   ├── server.py       # FastAPI 服务入口
│   ├── analyzer.py     # 分析逻辑路由
│   └── debug_logs/     # 日志 (区分纯代码和 LLM 日志)
└── docs/
```

---

## 安装与使用

### 1. 启动后端服务 (可选)
虽非必须，但推荐启动后端以获得完整的日志记录功能。
```bash
cd backend
pip install -r requirements.txt
python server.py
```
> 服务将在 `localhost:8787` 启动。

### 2. 安装浏览器插件
1.  在 Chrome/Edge 中打开扩展管理页: `chrome://extensions/`
2.  开启右上角的 "**开发者模式 (Developer Mode)**"
3.  点击 "**加载已解压的扩展程序 (Load Unpacked)**"
4.  选择本项目中的 `extension/` 文件夹。

### 3. 开始使用

#### 场景 A: WaterlooWorks (本地自动解析)
1.  登录 WaterlooWorks 并打开任意职位详情页。
2.  插件会自动检测到 `JOB POSTING INFORMATION`。
3.  页面顶部会自动弹出一个**信息横幅**，显示薪资、地点和工期。
    *   *注: 即使通过弹窗打开 JD，插件也能检测到。*

#### 场景 B: 通用 AI 分析 (任意网站)
1.  在任意招聘网站 (如 LinkedIn, Indeed, 或 WW)。
2.  点击页面右下角的**紫色悬浮按钮 (✨)**。
3.  **首次设置:** 在弹出的卡片中点击设置图标，输入你的 API Key (以及可选的 Base URL / 模型名称)，点击保存。
4.  点击 "**Generate Analysis**"。
5.  稍等片刻，AI 将生成一份包含 Pros/Cons、技术栈和总结的报告。

---

## 隐私说明

*   **API Key:** 仅存储在浏览器的 `chrome.storage.local` 中，卸载插件即清除。
*   **日志:** 如果启动了后端服务，分析日志会保存在 `backend/debug_logs/` 中，且 API Key 会被自动脱敏处理。
*   **Git:** 日志目录已被添加至 `.gitignore`，不会被提交。

---

## 免责声明

本工具仅作为个人求职决策辅助工具，请合规使用。
