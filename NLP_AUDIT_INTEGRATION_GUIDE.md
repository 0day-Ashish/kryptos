# NLP Smart Contract Audit Analysis - Integration Guide

## Overview
Integrated OpenAI-powered NLP analysis for smart contract audit reports into Kryptos. This feature automatically extracts vulnerabilities, classifies severity, and generates summaries from raw audit text.

## Files Added/Modified

### New Files
1. **`backend/ml/audit_nlp_analyzer.py`** (8.5 KB)
   - Core NLP analysis module
   - Functions:
     - `analyze_audit_report()` - Main analysis using OpenAI
     - `extract_vulnerabilities_lightweight()` - Fallback keyword-based extraction
     - `classify_severity_from_findings()` - Severity classification
     - `classify_severity_level()` - Risk score to severity mapping
     - `generate_summary_from_vulnerabilities()` - Summary generation

2. **`backend/test_audit_nlp.py`** (5.5 KB)
   - Standalone test script with 3 sample audit reports
   - Tests high-risk, medium-risk, and low-risk scenarios

### Modified Files
1. **`backend/main.py`**
   - Added import: `from backend.ml.audit_nlp_analyzer import analyze_audit_report`
   - Added Pydantic models:
     - `AuditAnalysisRequest` - Request schema
     - `Vulnerability` - Single finding
     - `AuditAnalysisResponse` - Response schema
   - Added endpoint: `POST /contract-audit-analyze`

2. **`backend/requirements.txt`**
   - Added: `openai>=1.0.0`

## Setup

### 1. Add OpenAI API Key
Edit `.env` file and add:
```env
OPENAI_API_KEY=sk-your-api-key-here
```

### 2. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

The openai package will be installed automatically.

## API Usage

### Endpoint: `POST /contract-audit-analyze`

**Rate Limit:** 10 requests/minute

**Request Body:**
```json
{
  "audit_text": "The contract has potential reentrancy vulnerabilities...",
  "contract_address": "0x1234567890123456789012345678901234567890"
}
```

**Response:**
```json
{
  "success": true,
  "vulnerabilities": [
    {
      "title": "Potential reentrancy — state change after external call",
      "description": "The transfer() function calls external contract before updating balance",
      "severity": "CRITICAL",
      "line_number": 156,
      "remediation": "Update state before making external calls (checks-effects-interactions pattern)"
    },
    {
      "title": "Delegatecall to Untrusted Contract",
      "description": "Function allows arbitrary delegatecall to user-supplied addresses",
      "severity": "CRITICAL",
      "line_number": 234,
      "remediation": "Remove delegatecall functionality or use allowlist of trusted contracts"
    }
  ],
  "severity_summary": {
    "CRITICAL": 2,
    "HIGH": 3,
    "MEDIUM": 1,
    "LOW": 2
  },
  "overall_summary": "The contract has critical reentrancy and delegatecall vulnerabilities that must be fixed before deployment. Additionally, access control lacks multisig protection and compiler version is outdated.",
  "risk_score": 85,
  "recommended_action": "DO NOT DEPLOY - Fix critical vulnerabilities immediately",
  "key_concerns": [
    "Critical reentrancy vulnerability allows fund theft",
    "Delegatecall enables contract takeover",
    "No multisig protection for admin functions"
  ],
  "model_used": "gpt-4o-mini"
}
```

## Testing

### Option 1: Direct Python Test
```bash
cd backend
python test_audit_nlp.py
```

This runs analysis on 3 sample audit reports (high/medium/low risk).

### Option 2: curl (HTTP)
```bash
curl -X POST http://localhost:8000/contract-audit-analyze \
  -H "Content-Type: application/json" \
  -d '{
    "audit_text": "The contract has a reentrancy vulnerability in the transfer function at line 156.",
    "contract_address": "0x1234..."
  }'
```

### Option 3: Python Script
```python
import requests

response = requests.post(
    "http://localhost:8000/contract-audit-analyze",
    json={
        "audit_text": "Potential reentrancy vulnerability detected...",
        "contract_address": "0x..."
    }
)

result = response.json()
print(f"Risk Score: {result['risk_score']}")
print(f"Vulnerabilities: {len(result['vulnerabilities'])}")
```

## Features

### Input Handling
- Accepts raw audit report text (100 chars to 50KB+)
- Optional contract address for context
- Automatic text cleaning and validation

### Output Analysis
- **Vulnerability Extraction**: Identifies all findings with severity levels
- **Severity Classification**: CRITICAL, HIGH, MEDIUM, LOW
- **Risk Scoring**: Numeric 0-100 scale
- **Summary Generation**: Concise 2-3 sentence overview
- **Action Recommendations**: "Audit", "Monitor", "Avoid", "DO NOT DEPLOY", etc.
- **Key Concerns**: Top 3 critical issues highlighted

### Performance
- Model: `gpt-4o-mini` (cost-efficient, ~1-2s latency)
- Fallback: Lightweight keyword-based extraction if API fails
- Rate limited: 10 requests/minute to prevent abuse
- Token usage: ~300-800 tokens per analysis

## Integration Examples

### Example 1: Analyze Existing Contract Audit
```python
from ml.audit_nlp_analyzer import analyze_audit_report

audit_text = """
AUDIT REPORT - Token.sol
Critical: Reentrancy in transfer()
High: Missing access control
Medium: Outdated compiler
"""

result = analyze_audit_report(audit_text)
print(f"Risk: {result['risk_score']}/100")
print(f"Action: {result['recommended_action']}")
```

### Example 2: Chain with Existing Auditor
```python
# First, run existing /contract-audit endpoint
audit_result = audit_contract("0x...", chain_id=1)

# Extract audit text from findings
audit_text = "\n".join([
    f"{f['title']}: {f['description']}"
    for f in audit_result.get('findings', [])
])

# Then analyze with NLP
nlp_result = analyze_audit_report(audit_text)
```

## Cost Estimation
- **Model**: gpt-4o-mini
- **Per Request**: ~$0.0015 (300-500 input tokens)
- **100 Requests/month**: ~$0.15
- **1000 Requests/month**: ~$1.50

## Error Handling

### Common Errors

**400 Bad Request**
```json
{"detail": "audit_text cannot be empty"}
```

**429 Too Many Requests**
```json
{"detail": "10 per 1 minute"}
```

**503 Service Unavailable**
```json
{"detail": "OpenAI API error: ..."}
```

## Configuration

### Environment Variables
```env
OPENAI_API_KEY=sk-...          # Your OpenAI API key
OPENAI_MODEL=gpt-4o-mini       # (Optional) Override model
```

### Rate Limiting
- Per IP: 10 requests/minute
- To adjust: Edit `/contract-audit-analyze` decorator in main.py

## Advanced Usage

### Switch to Different OpenAI Models
Edit `backend/main.py` line where `analyze_audit_report()` is called:

```python
# Use GPT-4o (slower, more accurate, ~5x more expensive)
result = analyze_audit_report(
    audit_text=body.audit_text,
    contract_address=body.contract_address,
    model="gpt-4o"
)

# Or Claude API (requires different setup)
# See audit_nlp_analyzer.py for extension points
```

### Add Custom Vulnerability Patterns
Modify `extract_vulnerabilities_lightweight()` in `audit_nlp_analyzer.py`:

```python
severity_keywords = {
    "CRITICAL": [
        "reentrancy", "delegatecall", "your_pattern_here"
    ],
    # ...
}
```

## Future Enhancements

1. **Multi-Model Support**
   - Claude API integration for comparison
   - Ensemble voting for vulnerability extraction
   
2. **Caching**
   - Cache common audit findings to reduce API calls
   
3. **Fine-tuning**
   - Fine-tune GPT model on Solidity-specific audit patterns
   
4. **Integration with Existing Auditor**
   - Automatically run NLP analysis on `/contract-audit` results
   
5. **Historical Tracking**
   - Store analysis results per contract address
   - Track vulnerability remediation over time

## Support & Troubleshooting

**Issue**: `ModuleNotFoundError: No module named 'openai'`
- **Fix**: Run `pip install -r requirements.txt`

**Issue**: `OpenAI API error: Invalid API key`
- **Fix**: Check your OpenAI API key in `.env`

**Issue**: `OpenAI API error: Rate limit exceeded`
- **Fix**: Wait a moment and retry, or upgrade your API plan

**Issue**: Slow responses (>5 seconds)
- **Note**: gpt-4o-mini typically responds in 1-2 seconds
- **Fix**: Check your internet connection or OpenAI API status

## References
- OpenAI Documentation: https://platform.openai.com/docs/
- Smart Contract Vulnerabilities: https://swcregistry.io/
- Solidity Best Practices: https://docs.soliditylang.org/
