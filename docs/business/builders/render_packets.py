#!/usr/bin/env python3
"""Render the Caisson advisor packets from Markdown with ReportLab."""

from __future__ import annotations

import argparse
import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    HRFlowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


NAVY = HexColor("#14263D")
BLUE = HexColor("#2E6F9E")
SKY = HexColor("#EAF3F8")
TEAL = HexColor("#1D7A75")
GREEN = HexColor("#2F7D5A")
AMBER = HexColor("#A56613")
RED = HexColor("#A33B35")
INK = HexColor("#202A35")
MUTED = HexColor("#5E6B78")
LINE = HexColor("#CAD4DE")
PALE = HexColor("#F5F7F9")
WHITE = colors.white


DOCUMENT_CONFIG = {
    "caisson-confidential-lawyer-packet": {
        "label": "COUNSEL INTAKE",
        "confidential": "CONFIDENTIAL - ATTORNEY INTAKE",
        "accent": NAVY,
        "subtitle": "Entity, ownership, authority, continuity, employment, and IP decision packet",
    },
    "caisson-cpa-bookkeeping-packet": {
        "label": "CPA / BOOKKEEPING INTAKE",
        "confidential": "CONFIDENTIAL - ADVISOR INTAKE",
        "accent": TEAL,
        "subtitle": "Historical cleanup, bookkeeping controls, payroll, and reserve decision packet",
    },
    "caisson-internal-master-map": {
        "label": "INTERNAL MASTER MAP",
        "confidential": "CONFIDENTIAL - INTERNAL WORKING DOCUMENT",
        "accent": BLUE,
        "subtitle": "Company, ownership, money, IP, platform, product, and launch single source of truth",
    },
}


def ascii_dashes(text: str) -> str:
    """PDF workflow requires ASCII hyphens in place of Unicode dash glyphs."""
    return (
        text.replace("\u2010", "-")
        .replace("\u2011", "-")
        .replace("\u2012", "-")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2212", "-")
    )


def inline_markup(text: str) -> str:
    """Convert a conservative subset of Markdown inline syntax to ReportLab XML."""
    text = ascii_dashes(text.strip())
    placeholders: list[str] = []

    def stash(value: str) -> str:
        placeholders.append(value)
        return f"@@INLINE{len(placeholders) - 1}@@"

    # Preserve links and code before escaping the remaining text.
    def link_repl(match: re.Match[str]) -> str:
        label, url = match.group(1), match.group(2)
        safe_label = html.escape(ascii_dashes(label))
        safe_url = html.escape(url, quote=True)
        return stash(f'<link href="{safe_url}" color="#2E6F9E"><u>{safe_label}</u></link>')

    text = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", link_repl, text)

    def autolink_repl(match: re.Match[str]) -> str:
        url = match.group(1)
        safe_url = html.escape(url, quote=True)
        return stash(f'<link href="{safe_url}" color="#2E6F9E"><u>{safe_url}</u></link>')

    text = re.sub(r"<(https?://[^>]+)>", autolink_repl, text)

    def code_repl(match: re.Match[str]) -> str:
        return stash(f'<font name="Courier" color="#34495E">{html.escape(match.group(1))}</font>')

    text = re.sub(r"`([^`]+)`", code_repl, text)
    text = html.escape(text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", text)
    text = re.sub(r"(?<!_)_([^_]+)_(?!_)", r"<i>\1</i>", text)

    for idx, value in enumerate(placeholders):
        text = text.replace(f"@@INLINE{idx}@@", value)
    return text


def make_styles(accent: colors.Color) -> dict[str, ParagraphStyle]:
    sample = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "PacketTitle",
            parent=sample["Title"],
            fontName="Helvetica-Bold",
            fontSize=25,
            leading=29,
            textColor=NAVY,
            spaceAfter=7,
            alignment=TA_LEFT,
            keepWithNext=True,
        ),
        "subtitle": ParagraphStyle(
            "PacketSubtitle",
            parent=sample["Normal"],
            fontName="Helvetica",
            fontSize=10.2,
            leading=14,
            textColor=MUTED,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=sample["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=15.5,
            leading=19,
            textColor=accent,
            spaceBefore=13,
            spaceAfter=6,
            keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "H3",
            parent=sample["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=14,
            textColor=NAVY,
            spaceBefore=9,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "h4": ParagraphStyle(
            "H4",
            parent=sample["Heading4"],
            fontName="Helvetica-Bold",
            fontSize=9.7,
            leading=12,
            textColor=INK,
            spaceBefore=7,
            spaceAfter=3,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=9.35,
            leading=13.15,
            textColor=INK,
            spaceAfter=5.3,
            allowWidows=0,
            allowOrphans=0,
            uriWasteReduce=0.25,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=7.7,
            leading=10.1,
            textColor=INK,
            spaceAfter=2,
            uriWasteReduce=0.2,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=9.25,
            leading=12.7,
            textColor=INK,
            leftIndent=3,
            firstLineIndent=0,
            spaceAfter=2.2,
            uriWasteReduce=0.25,
        ),
        "quote": ParagraphStyle(
            "Quote",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=9,
            leading=12.8,
            textColor=NAVY,
            leftIndent=8,
            rightIndent=8,
            spaceAfter=0,
        ),
        "table_head": ParagraphStyle(
            "TableHead",
            parent=sample["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9.3,
            textColor=WHITE,
            spaceAfter=0,
            uriWasteReduce=0.2,
        ),
        "table": ParagraphStyle(
            "TableBody",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=7.45,
            leading=9.45,
            textColor=INK,
            spaceAfter=0,
            uriWasteReduce=0.2,
        ),
        "table_dense": ParagraphStyle(
            "TableDense",
            parent=sample["BodyText"],
            fontName="Helvetica",
            fontSize=6.65,
            leading=8.25,
            textColor=INK,
            spaceAfter=0,
            uriWasteReduce=0.15,
        ),
        "label": ParagraphStyle(
            "Label",
            parent=sample["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=7.2,
            leading=8.5,
            textColor=WHITE,
            alignment=TA_CENTER,
        ),
    }


class PacketDocTemplate(BaseDocTemplate):
    def __init__(self, *args, title_text: str, **kwargs):
        self.title_text = title_text
        self._outline_level = 0
        super().__init__(*args, **kwargs)

    def afterFlowable(self, flowable: Flowable) -> None:
        if isinstance(flowable, Paragraph) and flowable.style.name in {"H2", "H3"}:
            level = 0 if flowable.style.name == "H2" else 1
            key = f"heading-{self.page}-{id(flowable)}"
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(flowable.getPlainText(), key, level=level, closed=False)


def page_decorator(canvas, doc, config: dict[str, str]) -> None:
    canvas.saveState()
    width, height = LETTER
    accent = config["accent"]
    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica-Bold", 7.4)
    canvas.drawString(0.68 * inch, height - 0.42 * inch, "CAISSON SOFTWARE LLC")
    canvas.setFillColor(accent)
    canvas.drawRightString(width - 0.68 * inch, height - 0.42 * inch, config["label"])
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.45)
    canvas.line(0.68 * inch, height - 0.49 * inch, width - 0.68 * inch, height - 0.49 * inch)

    canvas.setStrokeColor(LINE)
    canvas.line(0.68 * inch, 0.46 * inch, width - 0.68 * inch, 0.46 * inch)
    canvas.setFont("Helvetica", 7.1)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.68 * inch, 0.29 * inch, f"{config['confidential']} | Prepared 2026-07-11")
    canvas.drawRightString(width - 0.68 * inch, 0.29 * inch, f"Page {canvas.getPageNumber()}")
    canvas.restoreState()


def table_widths(rows: list[list[str]], available: float) -> list[float]:
    columns = max(len(row) for row in rows)
    scores: list[float] = []
    for col in range(columns):
        values = [re.sub(r"[*_`]", "", row[col]) if col < len(row) else "" for row in rows]
        longest = max((len(v) for v in values), default=1)
        mean = sum(len(v) for v in values) / max(len(values), 1)
        scores.append(max(8.0, min(42.0, 0.6 * longest + 0.4 * mean)))
    minimum = 0.8 * inch if columns <= 5 else 0.58 * inch
    widths = [max(minimum, available * s / sum(scores)) for s in scores]
    scale = available / sum(widths)
    return [w * scale for w in widths]


def parse_table(lines: list[str], styles: dict[str, ParagraphStyle], accent: colors.Color, available: float) -> Table:
    raw_rows: list[list[str]] = []
    for line in lines:
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", cell.replace(" ", "")) for cell in cells):
            continue
        raw_rows.append(cells)

    columns = max(len(row) for row in raw_rows)
    dense = columns >= 5
    body_style = styles["table_dense"] if dense else styles["table"]
    data: list[list[Paragraph]] = []
    for row_idx, row in enumerate(raw_rows):
        padded = row + [""] * (columns - len(row))
        style = styles["table_head"] if row_idx == 0 else body_style
        data.append([Paragraph(inline_markup(cell), style) for cell in padded])

    table = Table(
        data,
        colWidths=table_widths(raw_rows, available),
        repeatRows=1,
        hAlign="LEFT",
        splitByRow=1,
        spaceBefore=4,
        spaceAfter=8,
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), accent),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.35, LINE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE]),
                ("LEFTPADDING", (0, 0), (-1, -1), 4.3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4.3),
                ("TOPPADDING", (0, 0), (-1, -1), 4.2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4.2),
            ]
        )
    )
    return table


def note_box(text: str, styles: dict[str, ParagraphStyle], accent: colors.Color, available: float) -> Table:
    box = Table([[Paragraph(inline_markup(text), styles["quote"])]], colWidths=[available - 2])
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SKY),
                ("BOX", (0, 0), (-1, -1), 0.55, accent),
                ("LINEBEFORE", (0, 0), (0, -1), 3.2, accent),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    box.spaceBefore = 3
    box.spaceAfter = 8
    return box


def title_bar(label: str, styles: dict[str, ParagraphStyle], accent: colors.Color, available: float) -> Table:
    bar = Table([[Paragraph(label, styles["label"])]], colWidths=[available])
    bar.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), accent),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    bar.spaceAfter = 12
    return bar


def is_table_start(lines: list[str], idx: int) -> bool:
    if idx + 1 >= len(lines):
        return False
    return lines[idx].lstrip().startswith("|") and bool(
        re.match(r"^\s*\|?\s*:?-{3,}", lines[idx + 1])
    )


def extract_front_matter(markdown_text: str) -> tuple[dict[str, str], str]:
    """Read the small YAML-style metadata block used by the packet sources."""
    normalized = ascii_dashes(markdown_text)
    lines = normalized.splitlines()
    metadata: dict[str, str] = {}
    if not lines or lines[0].strip() != "---":
        return metadata, normalized
    closing = None
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            closing = idx
            break
    if closing is None:
        return metadata, normalized
    for line in lines[1:closing]:
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        metadata[key.strip().lower()] = value.strip().strip('"').strip("'")
    body = "\n".join(lines[closing + 1 :]).lstrip("\n")
    return metadata, body


def parse_markdown(markdown_text: str, styles: dict[str, ParagraphStyle], config: dict[str, str], available: float):
    metadata, body = extract_front_matter(markdown_text)
    lines = body.splitlines()
    story: list[Flowable] = []
    title_seen = bool(metadata.get("title"))
    if title_seen:
        title_text = metadata["title"]
        subtitle = metadata.get("subtitle", "Decision packet for professional review")
        byline_parts = [metadata.get("author", "Prepared for professional review")]
        if metadata.get("date"):
            byline_parts.append(metadata["date"])
        story.append(title_bar(config["confidential"], styles, config["accent"], available))
        story.append(Paragraph(inline_markup(title_text), styles["title"]))
        story.append(Paragraph(inline_markup(subtitle), styles["subtitle"]))
        story.append(Paragraph(inline_markup(" | ".join(byline_parts)), styles["subtitle"]))
    idx = 0
    paragraph_lines: list[str] = []

    def flush_paragraph() -> None:
        nonlocal paragraph_lines
        if paragraph_lines:
            combined = " ".join(part.strip() for part in paragraph_lines).strip()
            if combined:
                story.append(Paragraph(inline_markup(combined), styles["body"]))
            paragraph_lines = []

    while idx < len(lines):
        line = lines[idx]
        stripped = line.strip()

        if stripped in {"<!-- pagebreak -->", "\\pagebreak", "<div style=\"page-break-after: always;\"></div>"}:
            flush_paragraph()
            story.append(PageBreak())
            idx += 1
            continue

        if stripped.startswith("```"):
            flush_paragraph()
            fence = stripped[:3]
            code_lines: list[str] = []
            idx += 1
            while idx < len(lines) and not lines[idx].strip().startswith(fence):
                code_lines.append(lines[idx])
                idx += 1
            code_text = "<br/>".join(html.escape(ascii_dashes(x)) for x in code_lines)
            code_style = ParagraphStyle(
                "CodeBlock",
                parent=styles["small"],
                fontName="Courier",
                backColor=PALE,
                borderColor=LINE,
                borderWidth=0.5,
                borderPadding=6,
                leftIndent=4,
                rightIndent=4,
                spaceBefore=3,
                spaceAfter=7,
            )
            story.append(Paragraph(code_text or " ", code_style))
            idx += 1
            continue

        if not stripped:
            flush_paragraph()
            idx += 1
            continue

        if re.fullmatch(r"-{3,}", stripped):
            flush_paragraph()
            story.append(HRFlowable(width="100%", thickness=0.6, color=LINE, spaceBefore=4, spaceAfter=7))
            idx += 1
            continue

        if is_table_start(lines, idx):
            flush_paragraph()
            table_lines: list[str] = []
            while idx < len(lines) and lines[idx].lstrip().startswith("|"):
                table_lines.append(lines[idx])
                idx += 1
            story.append(parse_table(table_lines, styles, config["accent"], available))
            continue

        heading = re.match(r"^(#{1,4})\s+(.+)$", stripped)
        if heading:
            flush_paragraph()
            level = len(heading.group(1))
            text = heading.group(2).strip()
            if level == 1 and not title_seen:
                story.append(title_bar(config["confidential"], styles, config["accent"], available))
                story.append(Paragraph(inline_markup(text), styles["title"]))
                story.append(Paragraph(inline_markup(config.get("subtitle", "Decision packet for professional review")), styles["subtitle"]))
                story.append(Paragraph("Prepared 2026-07-11", styles["subtitle"]))
                title_seen = True
            else:
                style = styles[{2: "h2", 3: "h3", 4: "h4"}.get(level, "h2")]
                story.append(Paragraph(inline_markup(text), style))
            idx += 1
            continue

        if stripped.startswith(">"):
            flush_paragraph()
            quote_lines = []
            while idx < len(lines) and lines[idx].strip().startswith(">"):
                quote_lines.append(lines[idx].strip().lstrip(">").strip())
                idx += 1
            story.append(note_box(" ".join(quote_lines), styles, config["accent"], available))
            continue

        bullet = re.match(r"^\s*[-*+]\s+(.+)$", line)
        numbered = re.match(r"^\s*(\d+)[.)]\s+(.+)$", line)
        if bullet or numbered:
            flush_paragraph()
            ordered = numbered is not None
            items: list[ListItem] = []
            expected = int(numbered.group(1)) if numbered else 1
            while idx < len(lines):
                candidate = lines[idx]
                match = re.match(r"^\s*(\d+)[.)]\s+(.+)$", candidate) if ordered else re.match(r"^\s*[-*+]\s+(.+)$", candidate)
                if not match:
                    break
                content = match.group(2) if ordered else match.group(1)
                items.append(ListItem(Paragraph(inline_markup(content), styles["bullet"]), leftIndent=12))
                idx += 1
            story.append(
                ListFlowable(
                    items,
                    bulletType="1" if ordered else "bullet",
                    start=str(expected) if ordered else None,
                    leftIndent=17,
                    bulletFontName="Helvetica-Bold",
                    bulletFontSize=8.5,
                    bulletColor=config["accent"],
                    bulletOffsetY=1,
                    spaceAfter=5,
                )
            )
            continue

        paragraph_lines.append(stripped)
        idx += 1

    flush_paragraph()
    return story


def render(markdown_path: Path, pdf_path: Path) -> None:
    stem = markdown_path.stem
    if stem not in DOCUMENT_CONFIG:
        raise SystemExit(f"No document configuration for {stem}")
    config = DOCUMENT_CONFIG[stem]
    styles = make_styles(config["accent"])
    markdown_text = markdown_path.read_text(encoding="utf-8")
    metadata, markdown_body = extract_front_matter(markdown_text)
    title_match = re.search(r"^#\s+(.+)$", markdown_body, flags=re.MULTILINE)
    title = ascii_dashes(metadata.get("title") or (title_match.group(1).strip() if title_match else stem))
    left = right = 0.68 * inch
    top = 0.65 * inch
    bottom = 0.59 * inch
    available = LETTER[0] - left - right

    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    doc = PacketDocTemplate(
        str(pdf_path),
        pagesize=LETTER,
        leftMargin=left,
        rightMargin=right,
        topMargin=top,
        bottomMargin=bottom,
        title_text=title,
        title=title,
        author="Caisson Software LLC",
        subject="Confidential advisor intake and decision packet",
        creator="Caisson packet workflow",
    )
    frame = Frame(left, bottom, available, LETTER[1] - top - bottom, id="packet-frame")
    template = PageTemplate(
        id="packet",
        frames=[frame],
        onPage=lambda canvas, current_doc: page_decorator(canvas, current_doc, config),
    )
    doc.addPageTemplates([template])
    story = parse_markdown(markdown_text, styles, config, available)
    doc.build(story)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("markdown", type=Path)
    parser.add_argument("pdf", type=Path)
    args = parser.parse_args()
    render(args.markdown, args.pdf)


if __name__ == "__main__":
    main()
