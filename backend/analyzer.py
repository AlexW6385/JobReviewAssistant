# Job Posting Analyzer
import os
import re
from dotenv import load_dotenv

load_dotenv()

from schema import JobInput, AnalysisResult, TechStack
from parsers import GenericParser, WaterlooWorksParser

# Configuration
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "")


async def analyze_job_posting(job_input: JobInput) -> AnalysisResult:
    """
    Main analysis function.
    Delegates extraction to the appropriate parser class.
    """
    text = job_input.raw_text
    
    # Select parser based on content or URL
    if "WaterlooWorks" in text or "JOB POSTING INFORMATION" in text or "Job Posting Information" in text:
        print("[DEBUG] Using WaterlooWorksParser")
        parser = WaterlooWorksParser(text)
    else:
        print("[DEBUG] Using GenericParser")
        parser = GenericParser(text, job_input.url, job_input.title)
    
    # Execute parsing
    parsed = parser.parse()
    
    # Extract tech stack (common logic in BaseParser, but we can call it here or in parser)
    # Using the parser instance's method
    tech_stack = parser.extract_tech_stack()
    
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
