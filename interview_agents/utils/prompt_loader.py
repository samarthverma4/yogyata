from __future__ import annotations
from pathlib import Path
from string import Template
import re

PROMPT_DIR = Path(__file__).resolve().parent.parent / "prompts"


def sanitize_variable_content(val: object) -> str:
    if val is None:
        return ""
    text = str(val)
    
    # 1. Limit maximum size to prevent DoS/overflow (15000 characters)
    max_len = 15000
    if len(text) > max_len:
        text = text[:max_len] + "... [Content truncated for safety and size limits]"
        
    # 2. Escape template variables ($ to $$) to prevent template syntax hijacking
    text = text.replace("$", "$$")
    
    # 3. Neutralize common prompt injection patterns
    injection_patterns = [
        r"(?i)ignore\s+(?:all\s+)?previous\s+instructions",
        r"(?i)system\s+prompt:",
        r"(?i)you\s+are\s+now\s+an\s+assistant",
        r"(?i)bypass\s+restrictions",
    ]
    for pattern in injection_patterns:
        text = re.sub(pattern, "[removed potential prompt injection trigger]", text)
        
    return text


def load_prompt(prompt_name: str, subdirectory: str = "") -> str:
    """
    Load a prompt template from the prompts directory.
    
    Args:
        prompt_name: Name of the prompt file (without .txt extension)
        subdirectory: Optional subdirectory within prompts/ (e.g., "subjects")
    
    Returns:
        Prompt template content
    """
    if prompt_name.endswith(".txt"):
        prompt_name = prompt_name[: -len(".txt")]

    if subdirectory:
        prompt_path = PROMPT_DIR / subdirectory / f"{prompt_name}.txt"
    else:
        prompt_path = PROMPT_DIR / f"{prompt_name}.txt"
    
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
    
    return prompt_path.read_text(encoding="utf-8")


def render_prompt(prompt_name: str, variables: dict[str, object], subdirectory: str = "") -> str:
    """
    Render a prompt using string.Template syntax.
    
    Args:
        prompt_name: Name of the prompt file (without .txt extension)
        variables: Dictionary of variables to substitute
        subdirectory: Optional subdirectory within prompts/
    
    Returns:
        Rendered prompt with variables substituted
    """
    template = Template(load_prompt(prompt_name, subdirectory))
    sanitized_vars = {key: sanitize_variable_content(value) for key, value in variables.items()}
    return template.safe_substitute(sanitized_vars)


def load_subject_prompt(subject: str) -> str:
    """
    Load a subject-specific prompt.
    
    Args:
        subject: Subject name (e.g., "dsa", "os", "cn", "dbms", "ml", "cybersecurity")
    
    Returns:
        Subject prompt template content
    """
    return load_prompt(f"subject_{subject}", subdirectory="subjects")


def render_subject_prompt(subject: str, variables: dict[str, object]) -> str:
    """
    Render a subject-specific prompt.
    
    Args:
        subject: Subject name
        variables: Dictionary of variables to substitute
    
    Returns:
        Rendered subject prompt
    """
    return render_prompt(f"subject_{subject}", variables, subdirectory="subjects")
