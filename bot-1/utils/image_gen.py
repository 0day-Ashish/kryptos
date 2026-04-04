import io
import os
from PIL import Image, ImageDraw, ImageFont
import datetime

# Setup Font paths
FONT_REGULAR = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts", "OpenSans-Regular.ttf")
FONT_BOLD = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts", "OpenSans-Bold.ttf")

# Default if not found
if not os.path.exists(FONT_REGULAR):
    FONT_REGULAR = "arial.ttf"
if not os.path.exists(FONT_BOLD):
    FONT_BOLD = "arialbk.ttf"

def get_font(size, bold=False):
    try:
        path = FONT_BOLD if bold else FONT_REGULAR
        return ImageFont.truetype(path, size)
    except IOError:
        return ImageFont.load_default()

# ============================================================================
# METALLIC SILVER COLOR PALETTE
# ============================================================================
# Backgrounds
BG_DARK = (18, 20, 28)           # Deep charcoal base
BG_LIGHT_SILVER = (230, 232, 240) # Light silver accent
BG_CARD = (32, 36, 48)            # Card/panel backgrounds

# Text
TEXT_PRIMARY = (245, 246, 250)    # Nearly white, warm
TEXT_SECONDARY = (180, 185, 200)  # Muted silver
TEXT_LABEL = (140, 150, 170)      # Dimmer labels

# Accents & Status
ACCENT_SILVER = (200, 208, 225)   # Metallic silver highlight
BRAND_COLOR = (100, 140, 255)     # Modern blue (softer than before)

COLOR_LOW = (80, 220, 140)        # Soft green
COLOR_MED = (255, 180, 50)        # Warm amber
COLOR_HIGH = (255, 100, 80)       # Coral red
COLOR_CRIT = (220, 60, 80)        # Deep crimson

def truncate(address):
    if len(address) > 12:
        return f"{address[:6]}...{address[-4:]}"
    return address

def get_risk_theme(score):
    if score <= 30: return "LOW RISK", COLOR_LOW, "Normal on-chain activity"
    if score <= 60: return "MEDIUM RISK", COLOR_MED, "Unusual patterns detected"
    if score <= 80: return "HIGH RISK", COLOR_HIGH, "Multiple risk indicators"
    return "CRITICAL RISK", COLOR_CRIT, "Severe fraud signals detected"

def draw_rounded_rect(draw, coords, radius=12, fill=None, outline=None, width=2):
    """Helper to draw rounded rectangles with proper corners."""
    x1, y1, x2, y2 = coords
    d = radius * 2
    draw.rectangle([(x1+radius, y1), (x2-radius, y2)], fill=fill, outline=outline, width=width)
    draw.rectangle([(x1, y1+radius), (x2, y2-radius)], fill=fill, outline=outline, width=width)
    draw.pieslice([(x1, y1), (x1+d, y1+d)], 180, 270, fill=fill, outline=outline, width=width)
    draw.pieslice([(x2-d, y1), (x2, y1+d)], 270, 0, fill=fill, outline=outline, width=width)
    draw.pieslice([(x1, y2-d), (x1+d, y2)], 90, 180, fill=fill, outline=outline, width=width)
    draw.pieslice([(x2-d, y2-d), (x2, y2)], 0, 90, fill=fill, outline=outline, width=width)

def draw_card_background(draw, coords, fill=None):
    """Draw a card with subtle border."""
    x1, y1, x2, y2 = coords
    draw.rectangle(coords, fill=fill, outline=ACCENT_SILVER, width=1)

def _draw_mini_bar(draw, x, y, width, height, value, max_val, fill_color, bg=(50, 55, 70)):
    """Draw a small horizontal progress bar."""
    draw.rectangle([(x, y), (x + width, y + height)], fill=bg, outline=ACCENT_SILVER, width=1)
    ratio = min(value / max_val, 1.0) if max_val > 0 else 0
    fw = int(width * ratio)
    if fw > 0:
        draw.rectangle([(x, y), (x + fw, y + height)], fill=fill_color)


def _score_color(val):
    """Return a color based on a 0-100 score."""
    if val <= 30: return COLOR_LOW
    if val <= 60: return COLOR_MED
    if val <= 80: return COLOR_HIGH
    return COLOR_CRIT


def generate_scan_image(address: str, data: dict) -> io.BytesIO:
    """
    Modern metallic silver scan report with full ML pipeline breakdown.
    """
    width, height = 1000, 820
    img = Image.new("RGB", (width, height), BG_DARK)
    draw = ImageDraw.Draw(img)

    score = data.get("risk_score", 0)
    risk_label, risk_color, risk_desc = get_risk_theme(score)

    # Fonts
    f_header = get_font(28, bold=True)
    f_title = get_font(20, bold=True)
    f_large = get_font(72, bold=True)
    f_med = get_font(18, bold=True)
    f_norm = get_font(16)
    f_small = get_font(14)
    f_tiny = get_font(12)

    # ========== HEADER SECTION ==========
    draw.text((40, 25), "KRYPTOS RISK ASSESSMENT", font=f_header, fill=ACCENT_SILVER)
    draw.text((40, 58), f"Wallet: {truncate(address)}", font=f_norm, fill=TEXT_SECONDARY)
    draw.line([(40, 85), (width-40, 85)], fill=ACCENT_SILVER, width=2)

    # ========== RISK SCORE CARD (LEFT) ==========
    card_x1, card_y1 = 40, 100
    card_x2, card_y2 = 380, 340
    draw_card_background(draw, (card_x1, card_y1, card_x2, card_y2), fill=BG_CARD)

    score_x = card_x1 + 30
    draw.text((score_x, card_y1 + 15), "RISK SCORE", font=f_small, fill=TEXT_LABEL)
    draw.text((score_x, card_y1 + 35), str(score), font=f_large, fill=risk_color)

    draw.text((score_x, card_y1 + 120), risk_label, font=f_title, fill=risk_color)
    draw.text((score_x, card_y1 + 148), risk_desc, font=f_norm, fill=TEXT_SECONDARY)

    meter_y = card_y1 + 190
    meter_width = 300
    meter_height = 14
    draw.rectangle(
        [(score_x, meter_y), (score_x + meter_width, meter_y + meter_height)],
        fill=(50, 55, 70), outline=ACCENT_SILVER, width=1
    )
    fill_width = int(meter_width * min(score / 100.0, 1.0))
    if fill_width > 0:
        draw.rectangle(
            [(score_x, meter_y), (score_x + fill_width, meter_y + meter_height)],
            fill=risk_color
        )
    draw.text((score_x, meter_y + 20), "0 ← Score Range → 100", font=f_small, fill=TEXT_LABEL)

    # ========== ML PIPELINE CARD (RIGHT) ==========
    ml_x1, ml_y1 = 420, 100
    ml_x2, ml_y2 = width - 40, 340
    draw_card_background(draw, (ml_x1, ml_y1, ml_x2, ml_y2), fill=BG_CARD)

    mx = ml_x1 + 25
    my = ml_y1 + 15
    draw.text((mx, my), "ML PIPELINE BREAKDOWN", font=f_title, fill=ACCENT_SILVER)
    my += 32

    trained_model = data.get("trained_model") or {}
    gnn_obj = data.get("gnn", {}) or {}
    gnn_val = gnn_obj.get("gnn_score", None) if isinstance(gnn_obj, dict) else None
    rf_risk = trained_model.get("trained_risk_score", None) if isinstance(trained_model, dict) else None
    rf_prob = trained_model.get("trained_scam_probability", None) if isinstance(trained_model, dict) else None
    ml_raw = data.get("ml_raw_score", 0)
    heur = data.get("heuristic_score", 0)
    bar_w = 200
    bar_h = 12
    label_w = 160

    # Random Forest — use scam probability scaled to 0-100
    rf_display = int(rf_prob * 100) if rf_prob is not None else (int(rf_risk) if rf_risk is not None else 0)
    draw.text((mx, my), "Random Forest", font=f_norm, fill=TEXT_LABEL)
    _draw_mini_bar(draw, mx + label_w, my + 2, bar_w, bar_h, rf_display, 100, _score_color(rf_display))
    draw.text((mx + label_w + bar_w + 10, my), f"{rf_display}", font=f_norm, fill=TEXT_PRIMARY)
    my += 28

    # GNN
    gnn_display = int(gnn_val) if gnn_val is not None else 0
    draw.text((mx, my), "GNN (Graph)", font=f_norm, fill=TEXT_LABEL)
    _draw_mini_bar(draw, mx + label_w, my + 2, bar_w, bar_h, gnn_display, 100, _score_color(gnn_display))
    draw.text((mx + label_w + bar_w + 10, my), f"{gnn_display}", font=f_norm, fill=TEXT_PRIMARY)
    my += 28

    # Isolation Forest
    if_display = int(ml_raw) if ml_raw else 0
    draw.text((mx, my), "Isolation Forest", font=f_norm, fill=TEXT_LABEL)
    _draw_mini_bar(draw, mx + label_w, my + 2, bar_w, bar_h, if_display, 100, _score_color(if_display))
    draw.text((mx + label_w + bar_w + 10, my), f"{if_display}", font=f_norm, fill=TEXT_PRIMARY)
    my += 28

    # Heuristics
    heur_display = int(heur) if heur else 0
    draw.text((mx, my), "Heuristics", font=f_norm, fill=TEXT_LABEL)
    _draw_mini_bar(draw, mx + label_w, my + 2, bar_w, bar_h, heur_display, 100, _score_color(heur_display))
    draw.text((mx + label_w + bar_w + 10, my), f"{heur_display}", font=f_norm, fill=TEXT_PRIMARY)
    my += 28

    # Temporal
    temporal = data.get("temporal", {}) or {}
    temp_score = temporal.get("temporal_risk_score", 0) if isinstance(temporal, dict) else 0
    draw.text((mx, my), "Temporal", font=f_norm, fill=TEXT_LABEL)
    _draw_mini_bar(draw, mx + label_w, my + 2, bar_w, bar_h, int(temp_score), 100, _score_color(int(temp_score)))
    draw.text((mx + label_w + bar_w + 10, my), f"{int(temp_score)}", font=f_norm, fill=TEXT_PRIMARY)
    my += 28

    # Overall risk as probability
    overall_prob = score / 100.0
    draw.text((mx, my), f"Risk Probability: {overall_prob:.1%}", font=f_small, fill=_score_color(score))

    # ========== WALLET ACTIVITY CARD ==========
    act_y1 = 360
    act_y2 = 510
    draw_card_background(draw, (40, act_y1, width - 40, act_y2), fill=BG_CARD)

    ax = 60
    ay = act_y1 + 15
    draw.text((ax, ay), "WALLET ACTIVITY", font=f_title, fill=ACCENT_SILVER)
    ay += 32

    fs = data.get("feature_summary", {})
    sanc = data.get("sanctions", {}) or {}
    mev = data.get("mev", {}) or {}
    bridges = data.get("bridges", {}) or {}
    timeline = data.get("timeline", [])

    chain = data.get("chain", data.get("chain_id", "Multiple"))
    if isinstance(chain, dict):
        chain = chain.get("name", "Unknown")

    tx_count = data.get("tx_count", fs.get("tx_count", 0))
    token_transfers = data.get("token_transfers", 0)
    balance = data.get("balance", None)
    neighbors = data.get("neighbors_analyzed", 0)

    last_active = "Unknown"
    if timeline and isinstance(timeline, list) and len(timeline) > 0:
        last_active = str(timeline[-1].get("date", "Unknown"))[:10]

    col1_items = [
        ("Chain", str(chain).capitalize()),
        ("Transactions", str(tx_count)),
        ("Token Transfers", str(token_transfers)),
    ]
    col2_items = [
        ("Balance", f"{balance:.4f}" if balance is not None else "—"),
        ("Neighbors Analyzed", str(neighbors)),
        ("Last Active", last_active),
    ]

    for i, (label, value) in enumerate(col1_items):
        draw.text((ax, ay + i * 28), label, font=f_norm, fill=TEXT_LABEL)
        draw.text((ax + 180, ay + i * 28), value, font=f_norm, fill=TEXT_PRIMARY)

    col2_x = 520
    for i, (label, value) in enumerate(col2_items):
        draw.text((col2_x, ay + i * 28), label, font=f_norm, fill=TEXT_LABEL)
        draw.text((col2_x + 200, ay + i * 28), value, font=f_norm, fill=TEXT_PRIMARY)

    # ========== DETECTIONS SECTION ==========
    flags = data.get("flags", data.get("behavioral_flags", []))
    if isinstance(sanc, dict) and sanc.get("is_sanctioned"):
        flags = ["OFAC SANCTIONED"] + list(flags)
    if isinstance(mev, dict) and mev.get("is_mev_bot"):
        flags.append("MEV Bot Detected")
    if isinstance(bridges, dict) and bridges.get("total_bridge_txns", 0) > 0:
        flags.append("Cross-Chain Bridging")
    mixer_list = data.get("mixer_interactions", [])
    if mixer_list:
        flags.append(f"Mixer: {', '.join(mixer_list[:2])}")

    flags_y1 = 530
    flags_y2 = height - 50
    draw_card_background(draw, (40, flags_y1, width - 40, flags_y2), fill=BG_CARD)

    flags_x = 60
    flags_y = flags_y1 + 15
    draw.text((flags_x, flags_y), "DETECTIONS & FLAGS", font=f_title, fill=ACCENT_SILVER)
    flags_y += 32

    if not flags:
        draw.text((flags_x, flags_y), "No notable anomalies detected.", font=f_norm, fill=COLOR_LOW)
    else:
        for i, flag in enumerate(flags[:6]):
            color = COLOR_CRIT if "SANCTIONED" in str(flag).upper() else COLOR_HIGH
            draw.text((flags_x, flags_y + (i * 26)), f"• {flag}", font=f_norm, fill=color)
        if len(flags) > 6:
            draw.text((flags_x, flags_y + (6 * 26)), f"...and {len(flags)-6} more", font=f_small, fill=TEXT_SECONDARY)

    # ========== FOOTER ==========
    ts = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    draw.text((40, height - 28), f"Kryptos AI Engine  •  RF + GNN + IF + Heuristics  •  {ts}", font=f_small, fill=TEXT_LABEL)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf

def generate_sanctions_image(address: str, data: dict) -> io.BytesIO:
    """Modern sanctions check result display."""
    width, height = 800, 400
    img = Image.new("RGB", (width, height), BG_DARK)
    draw = ImageDraw.Draw(img)

    f_header = get_font(26, bold=True)
    f_title = get_font(22, bold=True)
    f_large = get_font(64, bold=True)
    f_norm = get_font(18)
    f_small = get_font(14)

    # Header
    draw.text((40, 30), "SANCTIONS SCREENING", font=f_header, fill=ACCENT_SILVER)
    draw.text((40, 65), f"Wallet: {truncate(address)}", font=f_norm, fill=TEXT_SECONDARY)
    draw.line([(40, 95), (width-40, 95)], fill=ACCENT_SILVER, width=2)

    # Result Card
    card_x1, card_y1 = 60, 120
    card_x2, card_y2 = width - 60, 320
    draw_card_background(draw, (card_x1, card_y1, card_x2, card_y2), fill=BG_CARD)

    is_flagged = data.get("is_sanctioned", False)
    if is_flagged:
        status_text = "FLAGGED"
        color = COLOR_CRIT
        desc = "This address matches known blocklists or sanctions."
    else:
        status_text = "PASSED"
        color = COLOR_LOW
        desc = "No sanctions or blocklist matches found."

    card_x = card_x1 + 40
    draw.text((card_x, card_y1 + 30), status_text, font=f_large, fill=color)
    draw.text((card_x, card_y1 + 110), "Status", font=f_small, fill=TEXT_LABEL)
    draw.text((card_x, card_y1 + 135), desc, font=f_norm, fill=TEXT_PRIMARY)

    # Footer
    ts = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    draw.text((40, height - 30), f"Kryptos Sanctions Engine  •  {ts}", font=f_small, fill=TEXT_LABEL)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf

def generate_error_image(title: str, description: str) -> io.BytesIO:
    """Modern error display with metallic silver accents."""
    width, height = 700, 300
    img = Image.new("RGB", (width, height), BG_DARK)
    draw = ImageDraw.Draw(img)

    f_title = get_font(26, bold=True)
    f_norm = get_font(18)
    f_small = get_font(14)

    # Card background
    draw_card_background(draw, (40, 40, width - 40, height - 60), fill=BG_CARD)

    # Error header
    draw.text((60, 60), "⚠ ERROR", font=f_title, fill=COLOR_CRIT)
    draw.text((60, 100), title, font=f_title, fill=TEXT_PRIMARY)

    # Word wrap description
    words = description.split()
    lines = []
    current_line = ""
    for w in words:
        if len(current_line + w) > 55:
            lines.append(current_line.strip())
            current_line = w + " "
        else:
            current_line += w + " "
    if current_line:
        lines.append(current_line.strip())

    desc_y = 150
    for line in lines[:3]:  # Max 3 lines
        draw.text((60, desc_y), line, font=f_norm, fill=TEXT_SECONDARY)
        desc_y += 30

    # Footer
    draw.text((60, height - 40), "Kryptos Error Handler", font=f_small, fill=TEXT_LABEL)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf

def generate_batch_image(results: list[dict], truncated: bool = False) -> io.BytesIO:
    """Modern batch scan results with organized statistics."""
    width = 1000
    height = 550
    img = Image.new("RGB", (width, height), BG_DARK)
    draw = ImageDraw.Draw(img)

    f_header = get_font(28, bold=True)
    f_title = get_font(20, bold=True)
    f_large = get_font(48, bold=True)
    f_med = get_font(18, bold=True)
    f_norm = get_font(16)
    f_small = get_font(14)

    # Header
    draw.text((40, 30), "BATCH SCAN REPORT", font=f_header, fill=ACCENT_SILVER)
    draw.line([(40, 70), (width-40, 70)], fill=ACCENT_SILVER, width=2)

    total = len(results)
    low = sum(1 for r in results if 0 <= r.get("score", 0) <= 30)
    medium = sum(1 for r in results if 31 <= r.get("score", 0) <= 60)
    high = sum(1 for r in results if 61 <= r.get("score", 0) <= 80)
    critical = sum(1 for r in results if 81 <= r.get("score", 0) <= 100)

    y_offset = 90
    if truncated:
        draw.text((40, y_offset), "⚠ Results truncated to the first 50 addresses.", font=f_norm, fill=COLOR_HIGH)
        y_offset += 35

    # Summary card
    draw_card_background(draw, (40, y_offset, width - 40, y_offset + 70), fill=BG_CARD)
    draw.text((60, y_offset + 15), f"Analysed {total} address{'es' if total != 1 else ''} ", font=f_med, fill=TEXT_PRIMARY)
    draw.text((60, y_offset + 40), f"Risk distribution breakdown below", font=f_norm, fill=TEXT_SECONDARY)

    y_offset += 95

    # Risk distribution bars
    def draw_risk_row(label, count, color, y):
        draw.text((40, y), label, font=f_med, fill=TEXT_PRIMARY)
        draw.text((240, y), str(count), font=f_large, fill=color)

        # Background bar
        bar_x, bar_y = 360, y - 5
        bar_w, bar_h = 580, 30
        draw.rectangle([bar_x, bar_y, bar_x + bar_w, bar_y + bar_h], fill=(50, 55, 70), outline=ACCENT_SILVER, width=1)

        # Filled portion
        if total > 0:
            fill_w = int((count / total) * bar_w)
            if fill_w > 0:
                draw.rectangle([bar_x, bar_y, bar_x + fill_w, bar_y + bar_h], fill=color)

        # Percentage
        pct = int((count / total * 100)) if total > 0 else 0
        draw.text((bar_x + bar_w + 20, y), f"{pct}%", font=f_norm, fill=TEXT_SECONDARY)

    draw_risk_row("LOW RISK", low, COLOR_LOW, y_offset)
    y_offset += 45

    draw_risk_row("MEDIUM RISK", medium, COLOR_MED, y_offset)
    y_offset += 45

    draw_risk_row("HIGH RISK", high, COLOR_HIGH, y_offset)
    y_offset += 45

    draw_risk_row("CRITICAL", critical, COLOR_CRIT, y_offset)

    # Footer
    ts = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    draw.text((40, height - 30), f"Kryptos Batch Engine  •  {ts}", font=f_small, fill=TEXT_LABEL)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf

def generate_report_image(address: str, reason_name: str, details: str, reporter: str) -> io.BytesIO:
    """Modern report confirmation with clean metadata display."""
    width = 900
    height = 450
    img = Image.new("RGB", (width, height), BG_DARK)
    draw = ImageDraw.Draw(img)

    f_header = get_font(26, bold=True)
    f_title = get_font(20, bold=True)
    f_norm = get_font(16)
    f_small = get_font(14)

    # Header
    draw.text((40, 30), "REPORT SUBMITTED ✓", font=f_header, fill=COLOR_LOW)
    draw.text((40, 65), "Your intelligence report has been received and is now being analyzed.", font=f_norm, fill=TEXT_SECONDARY)
    draw.line([(40, 95), (width-40, 95)], fill=ACCENT_SILVER, width=2)

    # Details card
    card_x1, card_y1 = 40, 115
    card_x2, card_y2 = width - 40, 380
    draw_card_background(draw, (card_x1, card_y1, card_x2, card_y2), fill=BG_CARD)

    card_x = card_x1 + 30
    card_y = card_y1 + 25

    # Report details
    report_data = [
        ("Address", truncate(address)),
        ("Reason", reason_name),
        ("Reporter", str(reporter)),
        ("Details", details[:65] + ("..." if len(details) > 65 else "") if details else "None provided"),
    ]

    for label, value in report_data:
        draw.text((card_x, card_y), label, font=f_small, fill=TEXT_LABEL)
        draw.text((card_x + 150, card_y), value, font=f_norm, fill=TEXT_PRIMARY)
        card_y += 40

    # Footer
    ts = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    draw.text((40, height - 30), f"Kryptos Community Intelligence  •  {ts}", font=f_small, fill=TEXT_LABEL)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf
