"""
Improved OCR service using pytesseract.

Features:
- image preprocessing for better OCR accuracy
- optional PDF support via pdf2image
- confidence scoring
- structured extraction for amount, date, merchant, currency, and expense type
"""
from __future__ import annotations

import io
import re
from datetime import datetime, timezone

from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import pytesseract

from app.config import get_settings

try:
    from pdf2image import convert_from_bytes
except ImportError:  # pragma: no cover - optional dependency
    convert_from_bytes = None

settings = get_settings()
pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

TOTAL_LABELS = ("grand total", "amount due", "net total", "balance due", "total")
NOISE_MARKERS = ("invoice", "receipt", "gstin", "phone", "bill no", "table", "server")
LINE_IGNORE_TOKENS = ("subtotal", "tax", "vat", "gst", "change", "cash", "card")
DATE_PATTERNS = (
    "%d/%m/%Y",
    "%d/%m/%y",
    "%m/%d/%Y",
    "%m/%d/%y",
    "%Y-%m-%d",
    "%d-%m-%Y",
    "%d.%m.%Y",
    "%d %b %Y",
    "%d %B %Y",
    "%b %d %Y",
    "%B %d %Y",
)
CURRENCY_HINTS = {
    "USD": ("USD", "$", "DOLLAR"),
    "EUR": ("EUR", "EURO", "\u20ac"),
    "GBP": ("GBP", "POUND", "\u00a3"),
    "INR": ("INR", "RS", "RUPEE", "\u20b9"),
    "AED": ("AED", "DIRHAM"),
    "SGD": ("SGD",),
    "AUD": ("AUD",),
    "CAD": ("CAD",),
    "JPY": ("JPY", "YEN"),
}
EXPENSE_KEYWORDS = {
    "Meals": ("restaurant", "cafe", "food", "meal", "dinner", "lunch", "breakfast"),
    "Travel": ("taxi", "uber", "lyft", "flight", "train", "bus", "parking", "toll", "cab", "airport", "transfer"),
    "Accommodation": ("hotel", "inn", "stay", "lodging", "resort"),
    "Fuel": ("fuel", "petrol", "diesel", "gas station"),
    "Office Supplies": ("office", "supplies", "stationery", "printer", "paper"),
}
AMOUNT_RE = re.compile(
    r"(?<!\d)(?:USD|EUR|GBP|INR|AED|SGD|AUD|CAD|JPY|[$\u20ac\u00a3\u20b9])?\s*"
    r"(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+(?:\.\d{2}))(?!\d)",
    re.IGNORECASE,
)


def _normalize_amount(value: str) -> float | None:
    try:
        return float(value.replace(",", "").strip())
    except ValueError:
        return None


def _clean_lines(text: str) -> list[str]:
    return [line.strip(" -:_\t") for line in text.splitlines() if line.strip()]


def _extract_amount(lines: list[str]) -> float | None:
    best_total: float | None = None
    all_amounts: list[float] = []

    for index, line in enumerate(lines):
        matches = AMOUNT_RE.findall(line)
        if matches:
            amount = _normalize_amount(matches[-1])
            if amount is not None:
                all_amounts.append(amount)

        lower = line.lower()
        if any(label in lower for label in TOTAL_LABELS):
            candidate_matches = matches or (
                AMOUNT_RE.findall(lines[index + 1]) if index + 1 < len(lines) else []
            )
            if candidate_matches:
                candidate_amount = _normalize_amount(candidate_matches[-1])
                if candidate_amount is not None:
                    best_total = candidate_amount

    if best_total is not None:
        return best_total
    if all_amounts:
        return max(all_amounts)
    return None


def _extract_date(text: str) -> str | None:
    candidates = re.findall(
        r"\b(?:\d{1,4}[/-]\d{1,2}[/-]\d{1,4}|\d{1,2}\.\d{1,2}\.\d{4}|"
        r"\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})\b",
        text or "",
    )
    today = datetime.now(timezone.utc).date()

    for candidate in candidates:
        normalized = candidate.replace(",", "")
        for pattern in DATE_PATTERNS:
            try:
                parsed = datetime.strptime(normalized, pattern).date()
                if parsed.year < 2000:
                    parsed = parsed.replace(year=parsed.year + 2000)
                if parsed <= today:
                    return parsed.isoformat()
            except ValueError:
                continue
    return None


def _extract_merchant(lines: list[str]) -> str | None:
    for line in lines[:6]:
        lower = line.lower()
        if len(line) < 3 or len(line) > 70:
            continue
        if sum(character.isalpha() for character in line) < 3:
            continue
        if any(marker in lower for marker in NOISE_MARKERS):
            continue
        return re.sub(r"\s{2,}", " ", line).strip()
    return None


def _extract_currency_code(text: str) -> str | None:
    upper_text = (text or "").upper()
    for code, hints in CURRENCY_HINTS.items():
        if any(hint.upper() in upper_text for hint in hints):
            return code
    return None


def _classify_expense(text: str) -> str:
    lower_text = (text or "").lower()
    for label, keywords in EXPENSE_KEYWORDS.items():
        if any(keyword in lower_text for keyword in keywords):
            return label
    return "Miscellaneous"


def _build_description(lines: list[str], merchant: str | None, expense_type: str) -> str:
    meaningful_line = next(
        (
            line for line in lines
            if not any(label in line.lower() for label in TOTAL_LABELS)
            and not any(token in line.lower() for token in LINE_IGNORE_TOKENS)
        ),
        None,
    )

    if merchant and meaningful_line and meaningful_line != merchant:
        return f"{expense_type} expense at {merchant}: {meaningful_line}"
    if merchant:
        return f"{expense_type} expense at {merchant}"
    return meaningful_line or f"{expense_type} expense from receipt"


def _parse_receipt_text(raw_text: str, confidence: float) -> dict:
    lines = _clean_lines(raw_text)
    merchant = _extract_merchant(lines)
    amount = _extract_amount(lines)
    expense_date = _extract_date(raw_text)
    currency_code = _extract_currency_code(raw_text)
    expense_type = _classify_expense(raw_text)
    description = _build_description(lines, merchant, expense_type)

    warnings: list[str] = []
    if confidence < 55:
        warnings.append("OCR confidence is low. Please review the extracted values carefully.")
    if amount is None:
        warnings.append("Amount could not be extracted confidently.")
    if expense_date is None:
        warnings.append("Expense date could not be extracted confidently.")
    if merchant is None:
        warnings.append("Merchant name could not be extracted confidently.")

    return {
        "status": "processed" if confidence >= 35 else "needs_review",
        "confidence": round(confidence, 2),
        "amount": amount,
        "date": expense_date,
        "merchant": merchant,
        "currency_code": currency_code,
        "expense_type": expense_type,
        "description": description,
        "warnings": warnings,
    }


def _preprocess_variants(image: Image.Image) -> list[tuple[Image.Image, str]]:
    base = image.convert("RGB")
    base = ImageOps.exif_transpose(base)
    grayscale = ImageOps.grayscale(base)
    grayscale = ImageOps.autocontrast(grayscale)

    width, height = grayscale.size
    if max(width, height) < 1600:
        scale = 1600 / max(width, height)
        grayscale = grayscale.resize((int(width * scale), int(height * scale)))

    sharpened = grayscale.filter(ImageFilter.SHARPEN)
    contrast = ImageEnhance.Contrast(sharpened).enhance(1.6)
    thresholded = contrast.point(lambda pixel: 255 if pixel > 170 else 0)
    smooth = contrast.filter(ImageFilter.MedianFilter(size=3))

    return [
        (contrast, "--oem 3 --psm 6"),
        (thresholded, "--oem 3 --psm 6"),
        (smooth, "--oem 3 --psm 11"),
    ]


def _run_ocr_candidate(image: Image.Image, config: str) -> tuple[str, float]:
    data = pytesseract.image_to_data(image, config=config, output_type=pytesseract.Output.DICT)
    text = pytesseract.image_to_string(image, config=config).strip()

    confidences: list[float] = []
    for item in data.get("conf", []):
        try:
            score = float(item)
        except (TypeError, ValueError):
            continue
        if score >= 0:
            confidences.append(score)

    confidence = sum(confidences) / len(confidences) if confidences else 0.0
    return text, confidence


def _best_ocr_from_image(image: Image.Image) -> tuple[str, float]:
    best_text = ""
    best_confidence = 0.0
    best_score = -1.0

    for variant, config in _preprocess_variants(image):
        text, confidence = _run_ocr_candidate(variant, config)
        score = confidence + min(len(text.strip()) / 20, 20)
        if score > best_score and text.strip():
            best_text = text
            best_confidence = confidence
            best_score = score

    if not best_text.strip():
        raise ValueError("OCR could not extract readable text from the receipt.")
    return best_text, best_confidence


def _is_pdf(file_bytes: bytes, filename: str | None, content_type: str | None) -> bool:
    if file_bytes[:4] == b"%PDF":
        return True
    if content_type == "application/pdf":
        return True
    if filename and filename.lower().endswith(".pdf"):
        return True
    return False


async def process_receipt(
    file_bytes: bytes,
    filename: str | None = None,
    content_type: str | None = None,
) -> dict:
    """Run OCR and return structured data."""
    images: list[Image.Image] = []

    if _is_pdf(file_bytes, filename, content_type):
        if not convert_from_bytes:
            raise ValueError(
                "PDF OCR requires the pdf2image package and Poppler installed on the server."
            )
        images = convert_from_bytes(file_bytes, first_page=1, last_page=2)
    else:
        images = [Image.open(io.BytesIO(file_bytes))]

    candidate_texts: list[str] = []
    candidate_confidences: list[float] = []

    for image in images:
        text, confidence = _best_ocr_from_image(image)
        candidate_texts.append(text)
        candidate_confidences.append(confidence)

    raw_text = "\n".join(text for text in candidate_texts if text.strip()).strip()
    confidence = (
        sum(candidate_confidences) / len(candidate_confidences)
        if candidate_confidences else 0.0
    )

    if not raw_text:
        raise ValueError("OCR could not extract readable text from the receipt.")

    return {
        "raw_text": raw_text,
        "parsed": _parse_receipt_text(raw_text, confidence),
    }
