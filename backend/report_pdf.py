"""
report_pdf.py — Generate professional PDF investigation reports.
Uses reportlab for PDF generation.
"""
from io import BytesIO
from datetime import datetime
from typing import Any, Dict


def generate_pdf_report(
    analysis: Dict[str, Any],
    nlp_analysis: Dict[str, Any] = None,
    watermark: bool = False,
) -> BytesIO:
    """
    Generate a PDF investigation report from analysis data.

    Parameters
    ----------
    analysis : The full analysis result dict from /analyze endpoint.
    nlp_analysis : Optional NLP-based vulnerability analysis results.
    watermark : If True, add a diagonal watermark on each page (free tier).

    Returns
    -------
    BytesIO buffer containing the PDF.
    """
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas
    from reportlab.lib.styles import getSampleStyleSheet

    buffer = BytesIO()
    width, height = letter
    c = canvas.Canvas(buffer, pagesize=letter)
    margin = 50
    y = height - margin

    # ── Helper functions ──
    def draw_watermark():
        """Draw a diagonal watermark across the current page."""
        if not watermark:
            return
        c.saveState()
        c.setFillColor(colors.Color(0.85, 0.85, 0.85, alpha=0.4))
        c.setFont("Helvetica-Bold", 36)
        c.translate(width / 2, height / 2)
        c.rotate(45)
        c.drawCentredString(0, 0, "KRYPTOS FREE REPORT")
        c.restoreState()
        # Smaller nudge text
        c.saveState()
        c.setFillColor(colors.Color(0.75, 0.75, 0.75, alpha=0.35))
        c.setFont("Helvetica", 14)
        c.translate(width / 2, height / 2 - 40)
        c.rotate(45)
        c.drawCentredString(0, 0, "Connect wallet for full report")
        c.restoreState()

    def draw_line(y_pos: float):
        c.setStrokeColor(colors.Color(0.8, 0.8, 0.8))
        c.setLineWidth(0.5)
        c.line(margin, y_pos, width - margin, y_pos)
        return y_pos - 10

    def check_page(y_pos: float, needed: float = 60) -> float:
        if y_pos < needed:
            c.showPage()
            draw_watermark()
            return height - margin
        return y_pos

    # Draw watermark on the first page
    draw_watermark()

    # ── Page 1: Header ──
    c.setFont("Helvetica-Bold", 28)
    c.setFillColor(colors.black)
    c.drawString(margin, y, "KRYPTOS")
    y -= 20
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.Color(0.4, 0.4, 0.4))
    c.drawString(margin, y, "Blockchain Intelligence & Risk Assessment Report")
    y -= 15
    c.drawString(margin, y, f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    y -= 10
    y = draw_line(y)

    # ── Target Information ──
    y -= 10
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(colors.black)
    c.drawString(margin, y, "TARGET WALLET")
    y -= 20

    c.setFont("Courier", 9)
    c.drawString(margin + 10, y, f"Address:  {analysis.get('address', 'N/A')}")
    y -= 14
    chain = analysis.get("chain", {})
    c.drawString(margin + 10, y, f"Chain:    {chain.get('name', 'Unknown')} (ID: {chain.get('id', '?')})")
    y -= 14
    c.drawString(margin + 10, y, f"Explorer: {chain.get('explorer', 'N/A')}/address/{analysis.get('address', '')}")
    y -= 20

    # ── Risk Score Box ──
    score = analysis.get("risk_score", 0)
    label = analysis.get("risk_label", "Unknown")

    # Score box background
    if score >= 75:
        box_color = colors.Color(0, 0, 0)
        text_color = colors.white
    elif score >= 40:
        box_color = colors.Color(0.4, 0.4, 0.4)
        text_color = colors.white
    else:
        box_color = colors.Color(0.9, 0.9, 0.9)
        text_color = colors.black

    c.setFillColor(box_color)
    c.roundRect(margin, y - 50, width - 2 * margin, 55, 8, fill=1, stroke=0)

    c.setFillColor(text_color)
    c.setFont("Helvetica-Bold", 36)
    c.drawString(margin + 20, y - 40, f"{score}/100")
    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin + 150, y - 35, label.upper())

    c.setFont("Helvetica", 9)
    ml_raw = analysis.get("ml_raw_score", 0)
    heuristic = analysis.get("heuristic_score", 0)
    c.drawString(margin + 150, y - 48, f"ML Score: {ml_raw}  |  Heuristic Score: {heuristic}")

    y -= 70
    y = draw_line(y)

    # ── Transaction Summary ──
    y -= 10
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(colors.black)
    c.drawString(margin, y, "TRANSACTION SUMMARY")
    y -= 20

    c.setFont("Helvetica", 10)
    stats = [
        ("Normal Transactions", analysis.get("tx_count", 0)),
        ("Internal Transactions", analysis.get("internal_tx_count", 0)),
        ("Token Transfers", analysis.get("token_transfers", 0)),
        ("Neighbors Analyzed", analysis.get("neighbors_analyzed", 0)),
    ]
    balance = analysis.get("balance")
    if balance is not None:
        native = chain.get("native", "ETH")
        stats.append((f"Balance ({native})", f"{balance:.6f}"))

    for label_text, value in stats:
        c.setFont("Helvetica", 10)
        c.setFillColor(colors.Color(0.4, 0.4, 0.4))
        c.drawString(margin + 10, y, label_text)
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(colors.black)
        c.drawString(margin + 200, y, str(value))
        y -= 16

    y -= 5
    y = draw_line(y)

    # ── Risk Flags ──
    flags = analysis.get("flags", [])
    if flags:
        y -= 10
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(colors.black)
        c.drawString(margin, y, f"RISK FLAGS ({len(flags)})")
        y -= 20

        c.setFont("Helvetica", 9)
        for flag in flags:
            y = check_page(y)
            # Bullet
            is_mixer = "mixer" in flag.lower()
            c.setFillColor(colors.red if is_mixer else colors.Color(0.3, 0.3, 0.3))
            c.drawString(margin + 10, y, "\u2022")
            c.setFillColor(colors.red if is_mixer else colors.black)
            # Truncate long flags
            display_flag = flag[:90] + "..." if len(flag) > 90 else flag
            c.drawString(margin + 25, y, display_flag)
            y -= 14

        y -= 5
        y = draw_line(y)

    # ── Feature Summary ──
    features = analysis.get("feature_summary", {})
    if features:
        y = check_page(y, 100)
        y -= 10
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(colors.black)
        c.drawString(margin, y, "BEHAVIORAL FEATURES")
        y -= 20

        c.setFont("Courier", 8)
        col_width = (width - 2 * margin) / 2
        items = list(features.items())
        for i in range(0, len(items), 2):
            y = check_page(y)
            # Left column
            k1, v1 = items[i]
            c.setFillColor(colors.Color(0.4, 0.4, 0.4))
            c.drawString(margin + 10, y, k1.replace("_", " "))
            c.setFillColor(colors.black)
            val_str = f"{v1:.4f}" if isinstance(v1, float) else str(v1)
            c.drawString(margin + 150, y, val_str)

            # Right column
            if i + 1 < len(items):
                k2, v2 = items[i + 1]
                c.setFillColor(colors.Color(0.4, 0.4, 0.4))
                c.drawString(margin + col_width + 10, y, k2.replace("_", " "))
                c.setFillColor(colors.black)
                val_str2 = f"{v2:.4f}" if isinstance(v2, float) else str(v2)
                c.drawString(margin + col_width + 150, y, val_str2)

            y -= 14

        y -= 5
        y = draw_line(y)

    # ── Top Counterparties ──
    counterparties = analysis.get("top_counterparties", [])
    if counterparties:
        y = check_page(y, 100)
        y -= 10
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(colors.black)
        c.drawString(margin, y, f"TOP COUNTERPARTIES ({len(counterparties)})")
        y -= 18

        # Table header
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(colors.Color(0.4, 0.4, 0.4))
        c.drawString(margin + 10, y, "ADDRESS")
        c.drawString(margin + 160, y, "LABEL")
        c.drawString(margin + 300, y, "TXNS")
        c.drawString(margin + 350, y, "SENT")
        c.drawString(margin + 420, y, "RECEIVED")
        y -= 4
        y = draw_line(y)
        y -= 8

        c.setFont("Courier", 7)
        for cp in counterparties[:10]:
            y = check_page(y)
            addr = cp.get("address", "")
            short_addr = f"{addr[:8]}...{addr[-4:]}" if len(addr) > 12 else addr

            c.setFillColor(colors.black)
            c.drawString(margin + 10, y, short_addr)

            label_text = cp.get("label") or "Unknown"
            c.setFont("Helvetica", 7)
            c.setFillColor(colors.Color(0.3, 0.3, 0.6))
            c.drawString(margin + 160, y, label_text[:20])

            c.setFont("Courier", 7)
            c.setFillColor(colors.black)
            c.drawString(margin + 300, y, str(cp.get("tx_count", 0)))
            c.drawString(margin + 350, y, f"{cp.get('sent', 0):.4f}")
            c.drawString(margin + 420, y, f"{cp.get('received', 0):.4f}")
            y -= 12

    # ── Mixer Interactions ──
    mixers = analysis.get("mixer_interactions", [])
    if mixers:
        y = check_page(y, 60)
        y -= 10
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(colors.red)
        c.drawString(margin, y, "MIXER INTERACTIONS DETECTED")
        y -= 18
        c.setFont("Helvetica", 9)
        for m in mixers:
            c.setFillColor(colors.red)
            c.drawString(margin + 10, y, f"\u26a0 {m}")
            y -= 14

    # ── NLP-Based Security Analysis ──
    if nlp_analysis and nlp_analysis.get("success"):
        y = check_page(y, 100)
        y -= 20
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(colors.Color(0.2, 0.3, 0.7))
        c.drawString(margin, y, "AI-POWERED SECURITY ANALYSIS")
        y -= 20
        
        # Risk Score
        risk_score = nlp_analysis.get("risk_score", 0)
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(colors.black)
        c.drawString(margin, y, f"AI Risk Score: {risk_score}/100")
        
        # Color-coded risk indicator
        if risk_score >= 80:
            risk_color = colors.red
            risk_text = "CRITICAL"
        elif risk_score >= 60:
            risk_color = colors.orange
            risk_text = "HIGH"
        elif risk_score >= 40:
            risk_color = colors.Color(0.9, 0.7, 0)
            risk_text = "MEDIUM"
        else:
            risk_color = colors.green
            risk_text = "LOW"
        
        c.setFillColor(risk_color)
        c.drawString(margin + 140, y, f"[{risk_text}]")
        y -= 18
        
        # Summary
        summary = nlp_analysis.get("overall_summary", "")
        if summary:
            c.setFont("Helvetica", 9)
            c.setFillColor(colors.black)
            # Wrap text if too long
            max_width = 500
            words = summary.split()
            line = ""
            for word in words:
                test_line = line + word + " "
                if c.stringWidth(test_line, "Helvetica", 9) < max_width:
                    line = test_line
                else:
                    c.drawString(margin + 10, y, line.strip())
                    y -= 12
                    line = word + " "
            if line:
                c.drawString(margin + 10, y, line.strip())
                y -= 16
        
        # Recommended Action
        action = nlp_analysis.get("recommended_action", "")
        if action:
            y = check_page(y)
            c.setFont("Helvetica-Bold", 10)
            c.setFillColor(colors.Color(0.4, 0, 0.6))
            c.drawString(margin, y, f"Recommendation: {action}")
            y -= 18
        
        # Vulnerabilities
        vulnerabilities = nlp_analysis.get("vulnerabilities", [])
        if vulnerabilities:
            y = check_page(y, 80)
            c.setFont("Helvetica-Bold", 11)
            c.setFillColor(colors.black)
            c.drawString(margin, y, f"Identified Issues ({len(vulnerabilities)})")
            y -= 16
            
            # Show top 5 vulnerabilities
            for vuln in vulnerabilities[:5]:
                y = check_page(y, 40)
                severity = vuln.get("severity", "LOW")
                title = vuln.get("title", "Unknown")
                
                # Severity badge
                if severity == "CRITICAL":
                    sev_color = colors.red
                elif severity == "HIGH":
                    sev_color = colors.orange
                elif severity == "MEDIUM":
                    sev_color = colors.Color(0.9, 0.7, 0)
                else:
                    sev_color = colors.green
                
                c.setFont("Helvetica-Bold", 8)
                c.setFillColor(sev_color)
                c.drawString(margin + 10, y, severity)
                
                # Title
                c.setFont("Helvetica", 8)
                c.setFillColor(colors.black)
                title_short = title[:70] + "..." if len(title) > 70 else title
                c.drawString(margin + 70, y, title_short)
                y -= 12
                
                # Description
                desc = vuln.get("description", "")
                if desc:
                    c.setFont("Helvetica", 7)
                    c.setFillColor(colors.Color(0.3, 0.3, 0.3))
                    desc_short = desc[:90] + "..." if len(desc) > 90 else desc
                    c.drawString(margin + 20, y, desc_short)
                    y -= 14
            
            if len(vulnerabilities) > 5:
                c.setFont("Helvetica", 7)
                c.setFillColor(colors.Color(0.5, 0.5, 0.5))
                c.drawString(margin + 10, y, f"... and {len(vulnerabilities) - 5} more issues")
                y -= 10
        
        # Key Concerns
        concerns = nlp_analysis.get("key_concerns", [])
        if concerns:
            y = check_page(y, 60)
            c.setFont("Helvetica-Bold", 10)
            c.setFillColor(colors.Color(0.6, 0, 0))
            c.drawString(margin, y, "Key Concerns:")
            y -= 14
            c.setFont("Helvetica", 8)
            for concern in concerns[:3]:
                y = check_page(y)
                c.setFillColor(colors.black)
                c.drawString(margin + 10, y, f"\u2022 {concern[:80]}")
                y -= 12

    # ── Footer ──
    c.setFont("Helvetica", 7)
    c.setFillColor(colors.Color(0.6, 0.6, 0.6))
    c.drawString(margin, 30, "Generated by Kryptos — AI-Powered Blockchain Risk Intelligence")
    c.drawString(width - margin - 120, 30, f"Page 1")

    c.save()
    buffer.seek(0)
    return buffer
