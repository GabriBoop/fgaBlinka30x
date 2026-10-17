"""Extracción de texto de facturas subidas (PDF o imagen).

Fase 4: ingesta de documentos. Los datos son 100% ficticios.
- PDF con texto embebido: pypdf.
- Imagen o PDF escaneado: OCR con Tesseract (opcional; si no hay tesseract,
  se avisa y el usuario debe completar los campos manualmente).
"""
import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from pypdf import PdfReader

from app.services.ocr import image_to_text, pdf_pages_to_text

# Detección de tipo por extensión (sin dependencias de libmagic en el sistema).
UPLOAD_DIR = Path(__file__).resolve().parents[3] / "data-demo" / "uploads"
MAX_FILE_SIZE_MB = 10
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp"}
ALLOWED_MIME = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/tiff",
    "image/bmp",
}
_EXT_TO_MIME = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".bmp": "image/bmp",
}


def _detect_mime(file_name: str) -> str:
    ext = Path(file_name).suffix.lower()
    return _EXT_TO_MIME.get(ext, "application/octet-stream")


@dataclass
class ExtractionResult:
    file_id: str
    file_name: str
    file_path: str
    file_hash: str
    mime_type: str
    size_bytes: int
    source_type: str  # "pdf" | "image"
    raw_text: str
    extraction_confidence: Optional[float]
    ocr_available: bool
    ocr_warning: Optional[str] = None
    fields: dict = field(default_factory=dict)


def _compute_hash(content: bytes) -> str:
    return "sha256:" + hashlib.sha256(content).hexdigest()


def _extract_pdf_text(path: Path) -> str:
    reader = PdfReader(str(path))
    parts = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            parts.append("")
    return "\n".join(parts)


def _validate_file(content: bytes, file_name: str, mime_type: str):
    ext = Path(file_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Extensión no permitida: {ext}. Use: {sorted(ALLOWED_EXTENSIONS)}")
    if mime_type not in ALLOWED_MIME:
        raise ValueError(f"Tipo de archivo no permitido: {mime_type}")
    if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise ValueError(f"Archivo demasiado grande (máx {MAX_FILE_SIZE_MB} MB)")


def extract_file(file_content: bytes, file_name: str) -> ExtractionResult:
    """Guarda el archivo, calcula hash y extrae texto."""
    ensure_upload_dir()
    file_hash = _compute_hash(file_content)
    mime_type = _detect_mime(file_name)

    _validate_file(file_content, file_name, mime_type)

    stored_path = UPLOAD_DIR / f"{file_hash.replace(':', '_')}_{Path(file_name).name}"
    if not stored_path.exists():
        stored_path.write_bytes(file_content)

    source_type = "pdf" if Path(file_name).suffix.lower() == ".pdf" or mime_type == "application/pdf" else "image"

    raw_text = ""
    ocr_available = False
    ocr_warning = None
    confidence = None

    if source_type == "pdf":
        try:
            raw_text = _extract_pdf_text(stored_path)
        except Exception:
            raw_text = ""
        if raw_text.strip():
            confidence = 0.95  # PDF con texto embebido: alta confianza
        else:
            # PDF posiblemente escaneado: intentar OCR
            ocr_res = pdf_pages_to_text(stored_path)
            ocr_available = ocr_res.available
            ocr_warning = ocr_res.warning
            raw_text = ocr_res.text
            confidence = 0.70 if ocr_available else None
    else:
        ocr_res = image_to_text(stored_path)
        ocr_available = ocr_res.available
        ocr_warning = ocr_res.warning
        raw_text = ocr_res.text
        confidence = 0.85 if ocr_available else None

    return ExtractionResult(
        file_id=file_hash,
        file_name=file_name,
        file_path=str(stored_path),
        file_hash=file_hash,
        mime_type=mime_type,
        size_bytes=len(file_content),
        source_type=source_type,
        raw_text=raw_text,
        extraction_confidence=confidence,
        ocr_available=ocr_available,
        ocr_warning=ocr_warning,
    )


def ensure_upload_dir():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return UPLOAD_DIR
