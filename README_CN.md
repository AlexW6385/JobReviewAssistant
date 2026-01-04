# JobReviewAssistant

---

## 项目概述

**JobReviewAssistant** 是一个本地优先、由用户主动触发的岗位分析系统。

它用于分析用户当前正在浏览的单个岗位页面，并使用大语言模型（LLM）生成**结构化、可解释的岗位评价结果**。

本项目被明确设计为：
- 非爬虫
- 非自动化
- 本地优先
- 由 Schema 强约束
- 可解释

这是一个**辅助决策工具**，而不是自动化代理系统。

---

## 系统架构

系统由两个相互独立的组件组成。

### 1. 浏览器插件（基于 Chromium）

- 运行于 Chrome / Edge，使用 Manifest V3
- 向岗位页面注入 Content Script
- 从页面 DOM 中提取岗位相关文本
- 将提取的数据发送至本地分析服务
- 向用户展示结构化的分析结果

### 2. 本地分析后端

- 运行在本机 localhost
- 以 JSON 形式接收岗位数据
- 使用大模型（或启发式占位实现）对岗位进行分析
- 返回经过严格校验的 JSON 输出
- 使用 SQLite 在本地缓存分析结果

浏览器插件不发布到任何浏览器商店，而是通过开发者模式在本地加载使用。

---

## 强制设计约束

### 浏览器插件禁止：
- 爬取或遍历岗位列表
- 自主运行或定时运行
- 存储或处理用户账号凭据
- 包含任何大模型 API Key

### 浏览器插件必须：
- 仅在用户明确触发时运行
- 仅分析当前正在查看的岗位页面
- 仅通过 DOM 读取数据，而非网络抓取

### 后端必须：
- 强制使用严格的 JSON 输出 Schema
- 拒绝或修复不符合 Schema 的模型输出
- 在本地缓存分析结果
- 只暴露一个 API 接口：POST /analyze

---

## 仓库结构（必须）

项目必须严格遵循以下目录结构：

jobreviewassistant  
├── README.md  
├── .gitignore  
│  
├── extension  
│   ├── manifest.json  
│   ├── background.js  
│   ├── content.js  
│   ├── popup.html  
│   ├── popup.js  
│   ├── popup.css  
│   └── icons  
│       └── icon.png  
│  
├── backend  
│   ├── server.py  
│   ├── analyzer.py  
│   ├── prompt.py  
│   ├── schema.py  
│   ├── storage.py  
│   └── requirements.txt  
│  
└── docs  
    └── architecture.md  

---

## 浏览器插件规范

### 平台

- 仅支持 Chromium 内核浏览器（Chrome、Edge）
- Manifest 版本为 3

### manifest.json 要求

- 声明 manifest_version 为 3
- 遵循最小权限原则
- 权限必须包含：
  - activeTab
  - storage
- host_permissions 必须包含：
  - 目标岗位网站域名（可使用占位符）
  - http://localhost:8787/*
- 必须注册：
  - 一个 Content Script
  - 一个 Background Service Worker
  - 一个 Popup UI

---

## 内容脚本（content.js）

### 职责

- 从当前页面 DOM 中提取岗位相关内容
- 输出一个标准化对象，包含以下字段：
  - url
  - title
  - company
  - raw_text

### 实现规则

- 使用多个备用 DOM 选择器
- 若结构化提取失败，则退化为清洗后的 document.body.innerText
- 不允许执行任何网络请求
- 仅响应插件明确发送的消息

---

## 后台脚本（background.js）

### 职责

- 作为插件的网络代理
- 将岗位数据转发至后端服务
- 将分析结果返回给 UI

### 实现规则

- 使用 fetch 调用本地 POST /analyze 接口
- 正确处理错误
- 不维护长期状态

---

## 插件 UI（popup.html / popup.js）

### 职责

- 提供一个按钮：“Analyze current job”
- 展示返回的分析结果
- 显示加载状态与错误状态

UI 中不允许包含：
- 模型逻辑
- Prompt 逻辑
- 业务逻辑

---

## 后端规范

### 技术选型

- Python 3.10 或更高版本
- FastAPI
- 服务端口：8787

### API 约定

接口：  
POST /analyze

请求体字段：
- url
- title
- company
- raw_text

响应：
- 必须严格符合 schema.py 中定义的 JSON Schema

---

## 分析逻辑

### Prompt（prompt.py）

Prompt 必须：
- 定义清晰的岗位评价标准（rubric）
- 解释每一个评分维度
- 明确要求模型只输出 JSON
- 字段名必须与 Schema 完全一致

---

## 输出 Schema（schema.py）

Schema 至少必须包含以下字段：

- role_type
- difficulty（1 到 5 的整数）
- difficulty_rationale（字符串列表）
- tech_stack
  - languages
  - frameworks
  - tools
- responsibilities_summary（字符串列表）
- requirements_summary（字符串列表）
- resume_value（1 到 5 的整数）
- risk_flags
  - flag
  - evidence
- overall_notes

在返回结果之前，必须强制执行 Schema 校验。

---

## 分析器（analyzer.py）

### 职责

- 组合 Prompt 与岗位数据
- 调用大模型（需与模型供应商解耦）
- 解析模型输出
- 按 Schema 校验结果
- 在必要时重试或修复输出

更换大模型供应商时，不得影响其他模块代码。

---

## 存储（storage.py）

- 使用 SQLite
- 按岗位 URL hash 或岗位内容 hash 缓存分析结果
- 存储内容包括：
  - 分析结果
  - 时间戳
  - Prompt 版本号
- 若命中缓存，直接返回结果，不再调用模型

---

## 开发流程

1. 启动后端服务
2. 通过浏览器开发者模式加载插件
3. 打开岗位详情页面
4. 点击插件图标
5. 点击 “Analyze current job”

---

## 明确的非目标

- 自动爬虫
- 简历投递
- 账号管理
- 云端部署
- 多用户支持

---

## 项目理念

JobReviewAssistant 是一个岗位决策辅助工具，而不是自动化系统。

所有分析均具备以下特征：
- 用户主动触发
- 本地优先
- 可解释
- 可审计
