"""
NLP-based smart contract audit analysis using Google Gemini.

Extracts vulnerabilities, classifies severity, and generates summaries from audit reports.
"""

import json
import os
from typing import Optional
from google import genai

_gemini_client = None

def _get_gemini_client() -> genai.Client:
    """Create Gemini client lazily so import works even before env is loaded."""
    global _gemini_client
    if _gemini_client is not None:
        return _gemini_client
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY is not set. Please add it to your environment or .env file."
        )
    _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client


def analyze_audit_report(
    audit_text: str,
    contract_address: Optional[str] = None,
    model: str = "gemini-2.0-flash"
) -> dict:
    """
    Analyze a smart contract audit report using Google Gemini.

    Args:
        audit_text: Full text of the audit report
        contract_address: Optional contract address for context
        model: Gemini model to use (default: gemini-2.0-flash for speed + cost)

    Returns:
        Dictionary with:
        - vulnerabilities: List of extracted vulnerabilities
        - severity_levels: Distribution of HIGH/MEDIUM/LOW
        - summary: Concise summary of findings
        - risk_score: Overall risk score (0-100)
        - recommended_action: Brief action recommendation
    """
    if not audit_text or not audit_text.strip():
        raise ValueError("Audit text cannot be empty")
    print(
        f"[NLP] analyze_audit_report called "
        f"(contract={contract_address}, chars={len(audit_text)}, model={model})"
    )

    system_prompt = """You are an expert smart contract security analyst. 
Analyze the provided audit report and extract key information.

Return ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:
{
    "vulnerabilities": [
        {
            "title": "Brief vulnerability name",
            "description": "One-sentence explanation",
            "severity": "HIGH|MEDIUM|LOW",
            "line_number": 123 or null,
            "remediation": "How to fix it"
        }
    ],
    "severity_summary": {
        "CRITICAL": 0,
        "HIGH": 2,
        "MEDIUM": 3,
        "LOW": 1
    },
    "overall_summary": "2-3 sentence summary of major findings and risk level",
    "risk_score": 65,
    "recommended_action": "Brief action (audit, monitor, avoid, etc.)",
    "key_concerns": ["concern 1", "concern 2", "concern 3"]
}

CRITICAL rules:
1. Extract ALL vulnerabilities from the report
2. Classify severity accurately: CRITICAL > HIGH > MEDIUM > LOW
3. risk_score: 0-100 (0=safe, 100=critical risk)
4. Keep descriptions concise (max 15 words)
5. Return ONLY valid JSON, nothing else"""

    user_prompt = f"""Analyze this smart contract audit report:

{audit_text}

{f'Contract Address: {contract_address}' if contract_address else ''}

Extract all vulnerabilities, classify by severity, and provide a summary."""

    prompt = f"{system_prompt}\n\n{user_prompt}"

    try:
        client = _get_gemini_client()
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=2000,
            ),
        )

        response_text = response.text.strip()

        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        result = json.loads(response_text)
        print(
            f"[NLP] analyze_audit_report parsed response "
            f"(vulns={len(result.get('vulnerabilities', []))}, risk={result.get('risk_score', 0)})"
        )

        return {
            "success": True,
            "vulnerabilities": result.get("vulnerabilities", []),
            "severity_summary": result.get("severity_summary", {}),
            "overall_summary": result.get("overall_summary", ""),
            "risk_score": result.get("risk_score", 0),
            "recommended_action": result.get("recommended_action", ""),
            "key_concerns": result.get("key_concerns", []),
            "model_used": model
        }

    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse model response as JSON: {str(e)}")
    except Exception as e:
        raise RuntimeError(f"Gemini API error: {str(e)}")


def extract_vulnerabilities_lightweight(
    audit_text: str
) -> list:
    """
    Fast keyword-based vulnerability extraction (fallback for when LLM is unavailable).

    This is a simple regex/keyword based approach that doesn't require API calls.
    """
    vulnerabilities = []

    # Define vulnerability patterns (word: severity)
    severity_keywords = {
        "critical": ["critical", "critical risk", "critical vulnerability"],
        "HIGH": [
            "reentrancy", "delegatecall", "selfdestruct", "tx.origin",
            "unchecked calls", "integer overflow", "integer underflow",
            "access control", "authentication bypass", "privilege escalation"
        ],
        "MEDIUM": [
            "outdated compiler", "missing event", "floating pragma",
            "unsafe math", "missing validation", "logic error"
        ],
        "LOW": [
            "code quality", "documentation", "style", "naming convention",
            "gas optimization"
        ]
    }

    # Extract sentences containing keywords
    sentences = audit_text.split(".")
    extracted = set()

    for sentence in sentences:
        sentence_lower = sentence.lower().strip()
        if not sentence_lower:
            continue

        for severity, keywords in severity_keywords.items():
            for keyword in keywords:
                if keyword in sentence_lower:
                    extracted.add((sentence.strip()[:100], severity))
                    break

    # Convert to structured format
    for title, severity in sorted(extracted):
        vulnerabilities.append({
            "title": title,
            "severity": severity,
            "source": "keyword_extraction"
        })

    return vulnerabilities


def classify_severity_from_findings(
    findings: list
) -> dict:
    """
    Classify overall severity from a list of findings.

    Returns a severity summary dict with counts.
    """
    severity_counts = {
        "CRITICAL": 0,
        "HIGH": 0,
        "MEDIUM": 0,
        "LOW": 0
    }

    for finding in findings:
        severity = finding.get("severity", "LOW").upper()
        if severity in severity_counts:
            severity_counts[severity] += 1

    # Calculate overall risk score
    risk_score = (
        severity_counts["CRITICAL"] * 25 +
        severity_counts["HIGH"] * 15 +
        severity_counts["MEDIUM"] * 8 +
        severity_counts["LOW"] * 2
    )
    risk_score = min(100, risk_score)  # Cap at 100

    return {
        "severity_counts": severity_counts,
        "risk_score": risk_score,
        "severity_level": classify_severity_level(risk_score)
    }


def classify_severity_level(risk_score: int) -> str:
    """Map numeric risk score to severity level."""
    if risk_score >= 80:
        return "CRITICAL"
    elif risk_score >= 60:
        return "HIGH"
    elif risk_score >= 40:
        return "MEDIUM"
    else:
        return "LOW"


def generate_summary_from_vulnerabilities(
    vulnerabilities: list,
    max_length: int = 300
) -> str:
    """
    Generate a concise summary from vulnerability list.

    Args:
        vulnerabilities: List of vulnerability dicts
        max_length: Maximum characters for summary

    Returns:
        Concise summary string
    """
    if not vulnerabilities:
        return "No vulnerabilities detected."

    # Group by severity
    by_severity = {}
    for vuln in vulnerabilities:
        severity = vuln.get("severity", "LOW").upper()
        if severity not in by_severity:
            by_severity[severity] = []
        by_severity[severity].append(vuln.get("title", "Unknown"))

    # Build summary
    summary_parts = []
    for severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        if severity in by_severity:
            count = len(by_severity[severity])
            summary_parts.append(f"{count} {severity.lower()}")

    summary = f"Audit findings: {', '.join(summary_parts)}."

    # Add recommendations
    critical_or_high = len(by_severity.get("CRITICAL", [])) + len(
        by_severity.get("HIGH", [])
    )
    if critical_or_high > 0:
        summary += " Requires immediate attention."
    else:
        summary += " Review recommended before deployment."

    return summary[:max_length]
