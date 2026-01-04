import re
from abc import ABC, abstractmethod
from typing import Optional, Dict, List
from schema import TechStack

class BaseParser(ABC):
    """Abstract base class for job posting parsers."""
    
    def __init__(self, text: str):
        self.text = text
        self.result = {
            "title": None,
            "location": None,
            "duration": None,
            "salary": None,
            "work_arrangement": None,
            "apply_url": None,
            "jd_full": None
        }

    @abstractmethod
    def parse(self) -> dict:
        """Parse the text and return the result dictionary."""
        pass
        
    def extract_tech_stack(self) -> TechStack:
        """Extract technology stack from job posting text."""
        text_lower = self.text.lower()
        
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


class GenericParser(BaseParser):
    """Fallback parser for unknown site formats."""
    
    def __init__(self, text: str, url: str, title: str):
        super().__init__(text)
        self.url = url
        self.title_from_page = title

    def parse(self) -> dict:
        self.result["title"] = self.title_from_page
        self.result["apply_url"] = self.url
        self.result["jd_full"] = self.text[:8000]
        
        # Simple generic salary extraction
        # Look for $XX - $YY or $XX/hr
        salary_match = re.search(r'\$[\d,]+(?:\.\d{2})?\s*[-to]+\s*\$[\d,]+(?:\.\d{2})?|[\d,.]+ ?/ ?hr', self.text, re.IGNORECASE)
        if salary_match:
            self.result["salary"] = salary_match.group(0)
            
        return self.result


class WaterlooWorksParser(BaseParser):
    """Specialized parser for WaterlooWorks job postings."""

    def __init__(self, text: str):
        super().__init__(text)
        # Find the start of the job posting information to focus extraction
        self.start_idx = -1
        for marker in ["JOB POSTING INFORMATION", "Job Posting Information"]:
            idx = text.find(marker)
            if idx != -1:
                self.start_idx = idx
                break
        
        self.jd_text = text[self.start_idx:] if self.start_idx != -1 else text

    def _extract_field(self, start_label: str, stop_labels: List[str], max_len: int = 100) -> Optional[str]:
        """Helper to extract text between a start label and the nearest stop label."""
        idx = self.jd_text.find(start_label)
        if idx == -1:
            return None
        idx += len(start_label)
        
        end = idx + max_len
        found_stop = False
        for stop in stop_labels:
            pos = self.jd_text.find(stop, idx)
            if pos != -1 and pos < end:
                end = pos
                found_stop = True
        
        # If no stop label found within max_len, we might be capturing garbage, but sometimes that's ok if it's the end of line
        val = self.jd_text[idx:end].strip().strip(':').strip()
        return val if val else None

    def _extract_salary(self) -> Optional[str]:
        # User requested simplified logic: just match $ symbols
        # We search specifically in "Compensation and Benefits" first, then globally
        
        # 1. Compensation Section
        comp_idx = self.jd_text.find("Compensation and Benefits:")
        if comp_idx != -1:
            comp_section = self.jd_text[comp_idx:comp_idx + 800]
            # Match range: $XX - $YY (with optional spaces/decimals)
            range_match = re.search(r'\$[\d,.]+\s*-?\s*\$[\d,.]+', comp_section)
            if range_match:
                return range_match.group(0)
            # Match single: $XX /hr
            single_match = re.search(r'\$[\d,.]+(?:\s*/\s*hr)?', comp_section)
            if single_match:
                return single_match.group(0)

        # 2. Global fallback (simple range search)
        global_range = re.search(r'\$[\d,.]+\s*-\s*\$[\d,.]+', self.jd_text)
        if global_range:
            return global_range.group(0)
            
        return None

    def parse(self) -> dict:
        if self.start_idx == -1:
            print("[DEBUG] WaterlooWorksParser: No JOB POSTING INFORMATION found")
            return self.result

        self.result["jd_full"] = self.jd_text[:8000]

        # --- Extractor Configuration ---
        extractors = [
            ("title", "Job Title:", ["Employer Internal", "Number of Job", "Level:", "Region:", "Job -"], 100),
            ("duration", "Work Term Duration:", ["Job Summary:", "How You Will", "About this", "Location:", "Special", "Start Date"], 50),
            ("work_arrangement", "Employment Location Arrangement:", ["Work Term Duration:", "Job Summary:", "How You Will"], 50),
        ]

        for key, start, stops, limit in extractors:
            self.result[key] = self._extract_field(start, stops, limit)

        # Location Logic
        city = self._extract_field("Job - City:", ["Job - Province", "Job - Postal", "Job - Country", "Employment"], 50)
        province = self._extract_field("Job - Province/State:", ["Job - Postal", "Job - Country", "Employment", "Job -"], 50)
        if city:
            c = city.split("Job")[0].strip()
            p = province.split("Job")[0].strip() if province else ""
            self.result["location"] = f"{c}, {p}".rstrip(", ")

        # Salary Logic
        self.result["salary"] = self._extract_salary()

        # Apply URL Logic - strictly inside "Application Information" as requested
        app_idx = self.jd_text.find("Application Information")
        if app_idx != -1:
            # Look in the next 1000 chars after this header
            app_section = self.jd_text[app_idx:app_idx + 1000]
            # Find any http/https link
            url_match = re.search(r'https?://[^\s<>"\']+', app_section)
            if url_match:
                self.result["apply_url"] = url_match.group(0).rstrip('.,)>')
        
        return self.result


class LinkedInParser(BaseParser):
    """
    Placeholder for future LinkedIn parsing logic.
    Demonstrates extensible architecture.
    """
    def parse(self) -> dict:
        # TODO: Implement specific DOM/Text parsing for LinkedIn
        return self.result
