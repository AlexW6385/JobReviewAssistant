"""
Prompt templates for LLM-based job analysis.
Defines clear evaluation rubrics and instructs model to output JSON.
"""

SYSTEM_PROMPT = """You are an expert job posting analyst. Your task is to analyze job postings and provide structured, objective evaluations to help job seekers make informed decisions.

You must respond ONLY with valid JSON that matches the required schema exactly. Do not include any explanatory text outside the JSON.

Be objective, thorough, and highlight both positive aspects and potential concerns."""


def get_analysis_prompt(title: str, company: str, raw_text: str) -> str:
    """
    Generate the analysis prompt for a job posting.
    
    Args:
        title: Job title
        company: Company name
        raw_text: Full text content of the job posting
    
    Returns:
        Formatted prompt string for the LLM
    """
    return f"""Analyze the following job posting and provide a structured evaluation.

## Job Information
- **Title**: {title}
- **Company**: {company}

## Job Posting Content
{raw_text}

---

## Evaluation Rubric

### 1. Role Type
Identify the primary role category (e.g., "Backend Engineer", "Product Manager", "Data Scientist", "DevOps Engineer", "Full Stack Developer").

### 2. Difficulty Level (1-5)
Rate the position difficulty based on:
- 1: Entry-level, no prior experience required
- 2: Junior, 1-2 years experience
- 3: Mid-level, 3-5 years experience
- 4: Senior, 5-8 years experience with leadership
- 5: Staff/Principal, 8+ years with significant expertise

Consider: years of experience, technical depth, leadership requirements, specialized skills.

### 3. Difficulty Rationale
List 2-4 specific reasons supporting your difficulty rating.

### 4. Tech Stack
Extract mentioned technologies into categories:
- languages: Programming languages (Python, JavaScript, Go, etc.)
- frameworks: Frameworks and libraries (React, Django, Spring, etc.)
- tools: Platforms, databases, cloud services (AWS, PostgreSQL, Docker, etc.)

### 5. Responsibilities Summary
List 3-5 key responsibilities in concise bullet points.

### 6. Requirements Summary
List 3-5 key requirements in concise bullet points.

### 7. Resume Value (1-5)
Rate how valuable this position would be on a resume:
- 1: Limited value, no brand recognition or skill development
- 2: Some value, basic skill application
- 3: Moderate value, solid experience
- 4: High value, good brand or challenging work
- 5: Excellent value, top company or cutting-edge work

### 8. Risk Flags
Identify any red flags or concerns. For each, provide:
- flag: Name of the concern (e.g., "Unrealistic expectations", "Role ambiguity")
- evidence: Quote or reference from the posting

Common red flags to look for:
- Unrealistic tech stack ("rockstar" for entry-level)
- Vague responsibilities
- Signs of high turnover ("fast-paced", "wear many hats")
- Unpaid overtime hints ("flexible hours", "startup mentality")
- Underpaying signals

### 9. Overall Notes
Provide a 1-2 sentence summary with any additional observations.

---

## Required Output Format (JSON)

Respond with ONLY the following JSON structure:

{{
  "role_type": "<string>",
  "difficulty": <integer 1-5>,
  "difficulty_rationale": ["<reason1>", "<reason2>", ...],
  "tech_stack": {{
    "languages": ["<lang1>", "<lang2>", ...],
    "frameworks": ["<framework1>", ...],
    "tools": ["<tool1>", ...]
  }},
  "responsibilities_summary": ["<resp1>", "<resp2>", ...],
  "requirements_summary": ["<req1>", "<req2>", ...],
  "resume_value": <integer 1-5>,
  "risk_flags": [
    {{"flag": "<flag_name>", "evidence": "<evidence_quote>"}},
    ...
  ],
  "overall_notes": "<summary>"
}}

Respond with valid JSON only. No markdown, no code blocks, no explanations."""


# Prompt version for cache invalidation
PROMPT_VERSION = "1.0.0"
