# Job Posting Analyzer
import os
import re
import json
from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

from schema import JobInput, AnalysisResult, TechStack
from parsers import GenericParser, WaterlooWorksParser
from prompt import SYSTEM_PROMPT, USER_PROMPT_TEMPLATE

# Configuration
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "")



async def analyze_with_llm(text: str, url: str, title: str, api_key: str, model: str) -> dict:
    """
    Analyze job posting using OpenAI API.
    Returns a dict matching the AnalysisResult schema.
    """
    try:
        client = AsyncOpenAI(api_key=api_key)
        
        user_content = USER_PROMPT_TEMPLATE.format(url=url, title=title, text=text[:15000]) # simple truncation
        
        response = await client.chat.completions.create(
            model=model,  # Use dynamic model from input
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content}
            ],
            response_format={"type": "json_object"},
            temperature=1
        )
        
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        print(f"[ERROR] LLM Analysis failed: {e}")
        return {}


async def analyze_job_posting(job_input: JobInput) -> AnalysisResult:
    """
    Main analysis function.
    Routes to LLM or Code parser based on API Key presence.
    """
    
    # 1. Dual Mode Routing
    if job_input.api_key and len(job_input.api_key) > 5:
        print(f"[DEBUG] Mode: LLM ({job_input.model})")
        llm_data = await analyze_with_llm(
            job_input.raw_text, 
            job_input.url, 
            job_input.title, 
            job_input.api_key,
            job_input.model
        )
        
        if llm_data:
            # Convert tech_stack dict to Object
            ts_data = llm_data.get("tech_stack", {})
            tech_stack = TechStack(
                languages=ts_data.get("languages", []),
                frameworks=ts_data.get("frameworks", []),
                tools=ts_data.get("tools", [])
            )
            
            return AnalysisResult(
                title=llm_data.get("title") or job_input.title,
                location=llm_data.get("location"),
                duration=llm_data.get("duration"),
                salary=llm_data.get("salary"),
                work_arrangement=llm_data.get("work_arrangement"),
                tech_stack=tech_stack,
                apply_url=llm_data.get("apply_url"),
                jd_full=job_input.raw_text[:8000] 
            )
        else:
            print("[WARN] LLM returned empty result, falling back to Code Mode")

    # 2. Code Mode (Fallback or Default)
    text = job_input.raw_text
    
    # Select parser based on content or URL
    if "WaterlooWorks" in text or "JOB POSTING INFORMATION" in text or "Job Posting Information" in text:
        print("[DEBUG] Mode: Code (WaterlooWorksParser)")
        parser = WaterlooWorksParser(text)
    else:
        print("[DEBUG] Mode: Code (GenericParser)")
        parser = GenericParser(text, job_input.url, job_input.title)
    
    # Execute parsing
    parsed = parser.parse()
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
