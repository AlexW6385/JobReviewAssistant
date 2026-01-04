# JobReviewAssistant

---

## Overview

**JobReviewAssistant** is a local-first, user-triggered job posting analysis system.

It analyzes a single job posting that the user is actively viewing in their browser and produces a structured, explainable evaluation using a Large Language Model (LLM).

This project is explicitly designed as:
- non-crawling
- non-automated
- local-first
- schema-driven
- explainable

It is a decision-support tool, not an automation agent.

---

## System Architecture

The system consists of two independent components.

### 1. Browser Extension (Chromium-based)

- Runs on Chrome / Edge using Manifest V3
- Injects a content script into job posting pages
- Extracts job-related text from the DOM
- Sends extracted data to a local analysis service
- Displays structured analysis results to the user

### 2. Local Analysis Backend

- Runs on localhost
- Receives job posting data as JSON
- Analyzes the posting using an LLM (or a heuristic placeholder)
- Returns strictly validated JSON output
- Caches analysis results locally using SQLite

The browser extension is not published to any browser store and is loaded locally via developer mode.

---

## Mandatory Design Constraints

### The browser extension MUST NOT:
- Crawl or iterate through job listings
- Run autonomously or on a schedule
- Store or handle user credentials
- Contain any LLM API keys

### The browser extension MUST:
- Only run when explicitly triggered by the user
- Only analyze the currently viewed job posting
- Extract data via DOM access, not network scraping

### The backend MUST:
- Enforce a strict JSON output schema
- Reject or repair malformed LLM outputs
- Cache results locally
- Expose exactly one API endpoint at POST /analyze

---

## Repository Structure (REQUIRED)

The project must follow this exact directory structure:

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

## Browser Extension Specification

### Platform

- Chromium-based browsers only (Chrome, Edge)
- Manifest Version 3

### manifest.json Requirements

- Declare manifest_version as 3
- Follow the minimal-permission principle
- Permissions must include:
  - activeTab
  - storage
- Host permissions must include:
  - the target job site domain (placeholder allowed)
  - http://localhost:8787/*
- Must register:
  - one content script
  - one background service worker
  - one popup UI

---

## Content Script (content.js)

### Responsibilities

- Extract job-related content from the current page DOM
- Output a normalized object containing:
  - url
  - title
  - company
  - raw_text

### Implementation Rules

- Use multiple fallback DOM selectors
- If structured extraction fails, fall back to cleaned document.body.innerText
- Perform no network requests
- Respond only to explicit extension messages

---

## Background Script (background.js)

### Responsibilities

- Act as a network proxy for the extension
- Forward job data to the backend
- Return analysis results to the UI

### Implementation Rules

- Use fetch to call POST /analyze on localhost
- Handle errors gracefully
- Maintain no long-term state

---

## Extension UI (popup.html / popup.js)

### Responsibilities

- Provide a single button labeled “Analyze current job”
- Display returned analysis results
- Show loading and error states

The UI must not contain:
- model logic
- prompt logic
- business logic

---

## Backend Specification

### Technology

- Python 3.10 or higher
- FastAPI
- Server port 8787

### API Contract

Endpoint:  
POST /analyze

Request body fields:
- url
- title
- company
- raw_text

Response:
- Must strictly conform to the JSON schema defined in schema.py

---

## Analysis Logic

### Prompt (prompt.py)

The prompt must:
- Define a clear evaluation rubric
- Explain each scoring dimension
- Instruct the model to output JSON only
- Match schema field names exactly

---

## Output Schema (schema.py)

The schema must include at least the following fields:

- role_type
- difficulty (integer from 1 to 5)
- difficulty_rationale (list of strings)
- tech_stack
  - languages
  - frameworks
  - tools
- responsibilities_summary (list of strings)
- requirements_summary (list of strings)
- resume_value (integer from 1 to 5)
- risk_flags
  - flag
  - evidence
- overall_notes

Schema validation must be enforced before returning results.

---

## Analyzer (analyzer.py)

### Responsibilities

- Assemble prompt and job data
- Call the LLM (provider-agnostic)
- Parse model output
- Validate against schema
- Retry or repair output if validation fails

Switching LLM providers must require changes only in this file.

---

## Storage (storage.py)

- Use SQLite
- Cache analysis results by job URL hash or content hash
- Store:
  - analysis result
  - timestamp
  - prompt version
- On cache hit, return stored result without calling the model

---

## Development Workflow

1. Start the backend service
2. Load the browser extension via developer mode
3. Open a job posting page
4. Click the extension icon
5. Click “Analyze current job”

---

## Explicit Non-Goals

- Automated crawling
- Resume submission
- Credential management
- Cloud deployment
- Multi-user support

---

## Philosophy

JobReviewAssistant is a job decision support tool, not an automation system.

All analysis is:
- user-triggered
- local-first
- explainable
- auditable
