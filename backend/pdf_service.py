import fitz  # PyMuPDF

MAX_PAGES = 100
MIN_CHARS = 300


def extract_text(file_bytes: bytes) -> str:
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception:
        raise ValueError("Cannot open PDF — file may be corrupted.")

    if doc.is_encrypted:
        raise ValueError("Password-protected PDFs are not supported.")
    if doc.page_count == 0:
        raise ValueError("PDF contains no pages.")
    if doc.page_count > MAX_PAGES:
        raise ValueError(f"PDF exceeds the {MAX_PAGES}-page limit.")

    text = " ".join(page.get_text() for page in doc).strip()
    doc.close()

    text = " ".join(text.split())  # normalize whitespace

    if len(text) < MIN_CHARS:
        raise ValueError(
            "PDF has insufficient readable text. Please upload a text-based PDF."
        )

    return text
