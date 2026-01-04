# Backend Data Schema
from pydantic import BaseModel, Field
from typing import Optional, List


class TechStack(BaseModel):
    """Technology stack extracted from job posting."""
    languages: List[str] = Field(default_factory=list, description="Programming languages")
    frameworks: List[str] = Field(default_factory=list, description="Frameworks and libraries")
    tools: List[str] = Field(default_factory=list, description="Tools, platforms, databases")


class AnalysisResult(BaseModel):
    """
    Simplified job analysis result.
    Only includes fields that can be reliably extracted by code.
    LLM-generated fields will be added later.
    """
    # Core fields (code extraction)
    title: Optional[str] = Field(None, description="Job title")
    location: Optional[str] = Field(None, description="Job location (city, province/state)")
    duration: Optional[str] = Field(None, description="Work term duration")
    salary: Optional[str] = Field(None, description="Salary range")
    work_arrangement: Optional[str] = Field(None, description="In-person, Hybrid, or Remote")
    tech_stack: TechStack = Field(default_factory=TechStack, description="Technology stack")
    apply_url: Optional[str] = Field(None, description="Application URL")
    
    # Full JD for future LLM use (not displayed in UI)
    jd_full: Optional[str] = Field(None, description="Full job description text for LLM")
    
    # Placeholder for future LLM fields
    # difficulty: Optional[int] = None
    # responsibilities_summary: Optional[List[str]] = None
    # requirements_summary: Optional[List[str]] = None
    # resume_value: Optional[int] = None
    # risk_flags: Optional[List[str]] = None
    # overall_notes: Optional[str] = None


class JobInput(BaseModel):
    """Input for job analysis."""
    url: str = Field(..., description="URL of the job posting")
    title: str = Field(..., description="Job title from page")
    company: str = Field(default="", description="Company name")
    raw_text: str = Field(..., description="Raw text content of the job posting")
