from schema import AnalysisResult

SYSTEM_PROMPT = """You are an expert Job Posting Analyzer. 
Your task is to extract structured information from the provided job posting text.

Output must be a valid JSON object matching this schema exactly:

{
    "title": "Job Title",
    "location": "City, Province/State",
    "duration": "Duration (e.g. 4 months)",
    "salary": "Salary Range (e.g. $20-30/hr)",
    "work_arrangement": "In-person/Hybrid/Remote",
    "tech_stack": {
        "languages": ["Python", "Java"...],
        "frameworks": ["React", "Spring"...],
        "tools": ["AWS", "Docker"...]
    },
    "apply_url": "Application URL (if found)"
}

Rules:
1. Extract data literally from the text where possible.
2. If a field is not found, set it to null.
3. For tech_stack, categorize carefully.
4. For work_arrangement, infer from context if not explicit (e.g. "must reside in Waterloo" -> In-person).
5. Do NOT include any explanations, ONLY the JSON object.
"""

USER_PROMPT_TEMPLATE = """
Please analyze this job posting:

URL: {url}
Title: {title}

---
{text}
---
"""
