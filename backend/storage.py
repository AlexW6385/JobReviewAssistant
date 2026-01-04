"""
SQLite-based storage for caching analysis results.
Caches by URL hash or content hash to avoid redundant LLM calls.
"""

import sqlite3
import hashlib
import json
from datetime import datetime
from typing import Optional
from pathlib import Path

from schema import AnalysisResult
from prompt import PROMPT_VERSION

# Database configuration
DB_PATH = Path(__file__).parent / "cache.db"


def get_connection() -> sqlite3.Connection:
    """Get database connection with row factory"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database schema"""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analysis_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url_hash TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            url TEXT NOT NULL,
            result_json TEXT NOT NULL,
            prompt_version TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(content_hash, prompt_version)
        )
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_content_hash 
        ON analysis_cache(content_hash, prompt_version)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_url_hash 
        ON analysis_cache(url_hash)
    """)
    
    conn.commit()
    conn.close()


def compute_hash(text: str) -> str:
    """Compute SHA-256 hash of text"""
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def get_cached_result(url: str, raw_text: str) -> Optional[AnalysisResult]:
    """
    Check if we have a cached result for this job posting.
    
    Uses content hash as primary key (same content = same analysis).
    Falls back to URL hash if content has minor differences.
    
    Args:
        url: Job posting URL
        raw_text: Raw text content
    
    Returns:
        Cached AnalysisResult or None
    """
    init_db()
    
    content_hash = compute_hash(raw_text)
    url_hash = compute_hash(url)
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # First, try exact content match with current prompt version
    cursor.execute("""
        SELECT result_json FROM analysis_cache 
        WHERE content_hash = ? AND prompt_version = ?
        ORDER BY created_at DESC
        LIMIT 1
    """, (content_hash, PROMPT_VERSION))
    
    row = cursor.fetchone()
    
    if row:
        conn.close()
        return AnalysisResult(**json.loads(row['result_json']))
    
    # Fallback: check URL with current prompt version
    # (in case content extraction changed slightly)
    cursor.execute("""
        SELECT result_json FROM analysis_cache 
        WHERE url_hash = ? AND prompt_version = ?
        ORDER BY created_at DESC
        LIMIT 1
    """, (url_hash, PROMPT_VERSION))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return AnalysisResult(**json.loads(row['result_json']))
    
    return None


def cache_result(url: str, raw_text: str, result: AnalysisResult) -> None:
    """
    Cache an analysis result.
    
    Args:
        url: Job posting URL
        raw_text: Raw text content
        result: Analysis result to cache
    """
    init_db()
    
    content_hash = compute_hash(raw_text)
    url_hash = compute_hash(url)
    result_json = result.model_dump_json()
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT OR REPLACE INTO analysis_cache 
            (url_hash, content_hash, url, result_json, prompt_version, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            url_hash,
            content_hash,
            url,
            result_json,
            PROMPT_VERSION,
            datetime.utcnow().isoformat()
        ))
        
        conn.commit()
    except sqlite3.Error as e:
        print(f"Cache write error: {e}")
    finally:
        conn.close()


def clear_cache() -> int:
    """
    Clear all cached results.
    
    Returns:
        Number of entries deleted
    """
    init_db()
    
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as count FROM analysis_cache")
    count = cursor.fetchone()['count']
    
    cursor.execute("DELETE FROM analysis_cache")
    conn.commit()
    conn.close()
    
    return count


def get_cache_stats() -> dict:
    """
    Get cache statistics.
    
    Returns:
        Dictionary with cache statistics
    """
    init_db()
    
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as count FROM analysis_cache")
    total = cursor.fetchone()['count']
    
    cursor.execute("""
        SELECT COUNT(*) as count FROM analysis_cache 
        WHERE prompt_version = ?
    """, (PROMPT_VERSION,))
    current_version = cursor.fetchone()['count']
    
    cursor.execute("""
        SELECT MIN(created_at) as oldest, MAX(created_at) as newest 
        FROM analysis_cache
    """)
    dates = cursor.fetchone()
    
    conn.close()
    
    return {
        "total_entries": total,
        "current_version_entries": current_version,
        "prompt_version": PROMPT_VERSION,
        "oldest_entry": dates['oldest'],
        "newest_entry": dates['newest']
    }
