# FastAPI Server for Job Review Assistant
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
from pathlib import Path
from datetime import datetime

from schema import JobInput, AnalysisResult
from analyzer import analyze_job_posting


app = FastAPI(title="Job Review Assistant API", version="2.0")

# CORS for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "healthy", "version": "2.0"}


@app.post("/analyze", response_model=AnalysisResult)
async def analyze(job_input: JobInput) -> AnalysisResult:
    """Analyze a job posting and return structured data."""
    
    # Setup debug logging
    debug_dir = Path(__file__).parent / "debug_logs"
    debug_dir.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    print(f"\n{'='*50}")
    print(f"[{timestamp}] New analysis request")
    print(f"  URL: {job_input.url}")
    print(f"  Title: {job_input.title}")
    
    # Determine Mode for logging
    has_key = bool(job_input.api_key and len(job_input.api_key) > 5)
    mode = "LLM (Enhanced)" if has_key else "Code (Fast/Local)"
    print(f"  Mode: {mode}")
    print(f"  Raw text: {len(job_input.raw_text)} chars")
    

    try:
        # Perform analysis
        result = await analyze_job_posting(job_input)
        
        # Log everything to one JSON file
        log_data = {
            "timestamp": timestamp,
            "mode": mode,
            "input": {
                "url": job_input.url,
                "title": job_input.title,
                "company": job_input.company,
                "api_key_masked": f"{job_input.api_key[:3]}...{job_input.api_key[-4:]}" if has_key else None,
                "model": job_input.model if has_key else None,
                "raw_text_length": len(job_input.raw_text),
                "raw_text_preview": job_input.raw_text[:1500]
            },
            "parsed_result": {
                "title": result.title,
                "location": result.location,
                "duration": result.duration,
                "salary": result.salary,
                "work_arrangement": result.work_arrangement,
                "tech_stack": result.tech_stack.model_dump(),
                "apply_url": result.apply_url,
                "jd_full_length": len(result.jd_full) if result.jd_full else 0
            }
        }
        
        # Log Separation: LLM vs Code
        prefix = "llm" if has_key else "code"
        log_file = debug_dir / f"{prefix}_{timestamp}.json"
        
        with open(log_file, "w", encoding="utf-8") as f:
            json.dump(log_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n[DEBUG] === PARSED RESULTS ===")
        print(f"  Title:       {result.title}")
        print(f"  Location:    {result.location}")
        print(f"  Duration:    {result.duration}")
        print(f"  Arrangement: {result.work_arrangement}")
        print(f"  Salary:      {result.salary}")
        print(f"  Tech:        {result.tech_stack.languages + result.tech_stack.frameworks + result.tech_stack.tools}")
        print(f"  Apply URL:   {result.apply_url}")
        print(f"  JD Full:     {len(result.jd_full) if result.jd_full else 0} chars")
        print(f"[DEBUG] Saved to: {log_file}")
        print(f"{'='*50}\n")
        
        return result
        
    except Exception as e:
        print(f"[ERROR] Analysis failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8787)
