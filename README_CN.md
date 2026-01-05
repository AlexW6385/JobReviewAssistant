# JobReviewAssistant (纯前端版)

一个强大的 **Chrome 扩展程序**，通过 **本地即时解析** 和 **多模型 AI 分析** (OpenAI, Claude, Gemini) 显著提升你的 WaterlooWorks 求职体验。

**🚀 零配置。无需 Python。无需服务器。**

## ✨ 主要功能

### 1. ⚡ 本地自动解析器 (零延迟)
*   **纯前端运行:** 所有逻辑都在浏览器 JS 中完成，秒开。
*   **智能提取:**
    *   **薪资:** 自动推断时薪/年薪 (例如 "$300,000" -> "$300,000/yr")。
    *   **技术栈:** 识别 120+ 种技术关键词 (React, Docker, AWS 等) 并高亮显示。
    *   **地点:** 简化为 "城市 (办公模式)"，例如 "Toronto (Hybrid)"。
    *   **申请链接:** 精准抓取直投链接。
*   **UI:** 在职位页面直接注入可拖拽的信息卡片。

### 2. 🤖 AI 深度分析 (按需)
*   **多模型支持:** 自由选择你喜欢的 AI:
    *   🟢 **OpenAI** (GPT-4o, GPT-3.5)
    *   🟣 **Anthropic** (Claude 3.5 Sonnet, Haiku)
    *   🔵 **Google** (Gemini 1.5 Flash/Pro)
*   **隐私优先:** API Key 仅存储在你的 Chrome 本地 (`chrome.storage.local`)。扩展程序直接从浏览器向 AI 厂商发送请求，不经过任何中间服务器。

---

## 📥 安装指南

1.  **克隆或下载** 本项目。
    ```bash
    git clone https://github.com/YourRepo/JobReviewAssistant.git
    ```
2.  打开 Chrome 浏览器，访问 `chrome://extensions`。
3.  开启右上角的 **开发者模式 (Developer Mode)**。
4.  点击 **加载已解压的扩展程序 (Load unpacked)**。
5.  选择本项目中的 `extension` 文件夹。
6.  **完成!** 现在去 WaterlooWorks 打开一个职位试试吧。

---

## 🛠 使用说明

### 本地解析
1.  打开任意 **WaterlooWorks 职位详情页**。
2.  右上角会自动弹出一个 **Job Card** 信息卡片。
3.  你可以随意拖拽或关闭它。

### AI 分析
1.  点击页面右下角的悬浮 **✨ (Sparkle)** 按钮。
2.  点击 **⚙️ (设置)** 图标。
3.  **选择模型:** OpenAI, Claude, 或 Gemini。
4.  **输入 Key:** 粘贴你的 API Key。
5.  点击 **保存**。
6.  点击 **✨ Generate Analysis** 生成摘要、优缺点分析和推荐指数。

---

## 🏗 架构说明

本项目已升级为 **无服务器纯前端架构** (v3.0)。

*   **`content.js`**: 核心大脑。负责页面检测、本地解析、UI 渲染和设置管理。
*   **`background.js`**: 信使。作为 Chrome Service Worker 安全地代理转发请求给 LLM APIs (OpenAI/Anthropic/Google)，解决跨域问题。
*   **隐私:** 所有数据处理都在你的本地机器上完成。我们没有任何后台服务器。

---

## 📜 隐私与安全
*   **API Keys:** 仅保存在你浏览器的本地存储中。
*   **职位数据:** 仅在你点击“生成”时发送给你选择的 AI 提供商。
*   **开源:** 代码完全公开，你可以随时审查以确保没有数据泄露。
