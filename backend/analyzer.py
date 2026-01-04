# Job Posting Analyzer
import os
import re
from dotenv import load_dotenv

load_dotenv()

from schema import JobInput, AnalysisResult, TechStack

# Configuration
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "")


def parse_waterlooworks_text(text: str) -> dict:
    """Parse WaterlooWorks-specific structured text format."""
    result = {
        "title": None,
        "location": None,
        "duration": None,
        "salary": None,
        "work_arrangement": None,
        "apply_url": None,
        "jd_full": None
    }
    
    # Find job posting section
    job_section_start = text.find("JOB POSTING INFORMATION")
    if job_section_start == -1:
        job_section_start = text.find("Job Posting Information")
    if job_section_start == -1:
        print("[DEBUG] No job posting section found")
        return result
    
    # Extract everything from JOB POSTING INFORMATION onwards as jd_full
    jd_text = text[job_section_start:]
    result["jd_full"] = jd_text[:8000]  # Limit for LLM context
    
    print(f"[DEBUG] Found job section at {job_section_start}, JD length: {len(jd_text)} chars")
    
    # Helper to extract between labels
    def extract_field(start_label, stop_labels, max_len=100):
        idx = jd_text.find(start_label)
        if idx == -1:
            return None
        idx += len(start_label)
        
        end = idx + max_len
        for stop in stop_labels:
            pos = jd_text.find(stop, idx)
            if pos != -1 and pos < end:
                end = pos
        
        val = jd_text[idx:end].strip().strip(':').strip()
        return val if val else None
    
    # Title
    result["title"] = extract_field(
        "Job Title:", 
        ["Employer Internal", "Number of Job", "Level:", "Region:", "Job -"]
    )
    
    # Location = City + Province
    city = extract_field("Job - City:", ["Job - Province", "Job - Postal", "Job - Country", "Employment"], 50)
    province = extract_field("Job - Province/State:", ["Job - Postal", "Job - Country", "Employment", "Job -"], 50)
    if city:
        city_clean = city.split("Job")[0].strip()
        prov_clean = province.split("Job")[0].strip() if province else ""
        result["location"] = f"{city_clean}, {prov_clean}".rstrip(", ")
    
    # Duration
    result["duration"] = extract_field(
        "Work Term Duration:",
        ["Job Summary:", "How You Will", "About this", "Location:", "Special", "Start Date"],
        50
    )
    
    # Work Arrangement (In-person, Hybrid, Remote)
    arrangement = extract_field(
        "Employment Location Arrangement:",
        ["Work Term Duration:", "Job Summary:", "How You Will"],
        30
    )
    if arrangement:
        result["work_arrangement"] = arrangement
    
    # Salary - look in Compensation section
    comp_idx = jd_text.find("Compensation and Benefits:")
    if comp_idx != -1:
        comp_section = jd_text[comp_idx:comp_idx + 800]  # Increase range
        # Match various salary patterns:
        # "$20 - $30", "$20.50-$30.00", "$50,000 - $60,000"
        salary_match = re.search(r'\$[\d,]+(?:\.\d{2})?\s*-?\s*\$[\d,]+(?:\.\d{2})?', comp_section)
        if salary_match:
            result["salary"] = salary_match.group(0)
            print(f"[DEBUG] Found salary: {result['salary']}")
    
    # Apply URL - look in Application Information section
    app_idx = jd_text.find("Application")
    if app_idx != -1:
        app_section = jd_text[app_idx:app_idx + 800]
        # Look for any URL in this section
        url_match = re.search(r'https?://[^\s<>"\']+', app_section)
        if url_match:
            url = url_match.group(0).rstrip('.,)>')
            result["apply_url"] = url
            print(f"[DEBUG] Found apply URL: {url[:60]}...")
    
    print(f"[DEBUG] Parsed: title={result['title']}, loc={result['location']}, dur={result['duration']}, arr={result['work_arrangement']}, sal={result['salary']}")
    return result


def extract_tech_stack(text: str) -> TechStack:
    """Extract technology stack from job posting text."""
    text_lower = text.lower()
    
    languages = []
    frameworks = []
    tools = []
    
    tech_keywords = {
        "languages": ["python", "javascript", "typescript", "java", "go", "rust", "c++", "c#", "ruby", "php", "swift", "kotlin", "sql", "html", "css", "scala", "r"],
        "frameworks": ["react", "vue", "angular", "django", "flask", "fastapi", "spring", "node.js", "express", "next.js", "rails", "pytorch", "tensorflow", "pandas", "numpy", ".net"],
        "tools": ["aws", "gcp", "azure", "docker", "kubernetes", "postgresql", "mysql", "mongodb", "redis", "git", "jenkins", "terraform", "linux", "jira", "confluence", "openstack"]
    }
    
    for lang in tech_keywords["languages"]:
        if re.search(r'\b' + re.escape(lang) + r'\b', text_lower):
            languages.append(lang.upper() if lang in ["sql", "html", "css", "r"] else lang.capitalize())
            
    for fw in tech_keywords["frameworks"]:
        if re.search(r'\b' + re.escape(fw) + r'\b', text_lower):
            frameworks.append(fw.title() if '.' not in fw else fw)
            
    for tool in tech_keywords["tools"]:
        if re.search(r'\b' + re.escape(tool) + r'\b', text_lower):
            tools.append(tool.upper() if len(tool) <= 3 else tool.capitalize())
    
    return TechStack(languages=languages, frameworks=frameworks, tools=tools)


async def analyze_job_posting(job_input: JobInput) -> AnalysisResult:
    """
    Main analysis function.
    1. Runs code-based extraction (always).
    2. Runs LLM analysis (if configured) - TODO
    """
    text = job_input.raw_text
    
    # Check if WaterlooWorks format
    is_waterlooworks = "WaterlooWorks" in text or "JOB POSTING INFORMATION" in text or "Job Posting Information" in text
    
    if is_waterlooworks:
        print("[DEBUG] Detected WaterlooWorks format")
        parsed = parse_waterlooworks_text(text)
    else:
        # Generic extraction (fallback)
        print("[DEBUG] Using generic extraction")
        parsed = {
            "title": job_input.title,
            "location": None,
            "duration": None,
            "salary": None,
            "work_arrangement": None,
            "apply_url": job_input.url,
            "jd_full": text[:8000]
        }
        
        # Try to find salary in text
        salary_match = re.search(r'\$[\d,.]+ ?- ?\$[\d,.]+', text)
        if salary_match:
            parsed["salary"] = salary_match.group(0)
    
    # Extract tech stack from full text
    tech_stack = extract_tech_stack(text)
    
    return AnalysisResult(
        title=parsed.get("title") or job_input.title,
        location=parsed.get("location"),
        duration=parsed.get("duration"),
        salary=parsed.get("salary"),
        work_arrangement=parsed.get("work_arrangement"),
        tech_stack=tech_stack,
        apply_url=parsed.get("apply_url"),
        jd_full=parsed.get("jd_full")
    )
