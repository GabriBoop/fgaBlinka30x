"""OCR opcional con Tesseract.

Solo se activa si pytesseract y el binario de tesseract están instalados en el
sistema. En caso contrario, todas las funciones devuelven un resultado vacío
con una advertencia, sin romper la aplicación.
"""
import shutil
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps


@dataclass
class OcrResult:
    text: str
    confidence: float | None = None
    available: bool = False
    warning: str | None = None


def is_available() -> bool:
    return shutil.which("tesseract") is not None


def _recognized_text_and_confidences(image, pytesseract):
    grayscale = ImageOps.grayscale(image)
    text = pytesseract.image_to_string(grayscale, lang="spa+eng")
    data = pytesseract.image_to_data(
        grayscale,
        lang="spa+eng",
        output_type=pytesseract.Output.DICT,
    )
    confidences = []
    for value in data.get("conf", []):
        try:
            confidence = float(value)
        except (TypeError, ValueError):
            continue
        if confidence > 0:
            confidences.append(confidence)
    return text or "", confidences


def _mean_confidence(confidences):
    if not confidences:
        return None
    return min(sum(confidences) / len(confidences) / 100, 1.0)


def image_to_text(image_path: str | Path) -> OcrResult:
    """Extrae texto de una imagen con Tesseract."""
    result = OcrResult(text="", available=False)
    if not is_available():
        result.warning = (
            "Tesseract no está instalado en el sistema. La extracción de imágenes "
            "requiere instalar tesseract y pytesseract. Ingrese los datos manualmente."
        )
        return result
    try:
        import pytesseract  # type: ignore

        with Image.open(image_path) as image:
            text, confidences = _recognized_text_and_confidences(image, pytesseract)
        result.text = text
        result.confidence = _mean_confidence(confidences)
        result.available = True
    except Exception as exc:  # pragma: no cover - depende del entorno
        result.warning = f"Error ejecutando OCR: {exc}"
    return result


def pdf_pages_to_text(pdf_path: str | Path) -> OcrResult:
    """Extrae texto de un PDF escaneado página por página con OCR.

    Requiere pdf2image + poppler además de tesseract. Si no están disponibles,
    devuelve advertencia.
    """
    result = OcrResult(text="", available=False)
    if not is_available():
        result.warning = (
            "Tesseract no está instalado. No se puede hacer OCR de PDF escaneado."
        )
        return result
    try:
        import pytesseract  # type: ignore
        from pdf2image import convert_from_path  # type: ignore

        pages = convert_from_path(pdf_path, dpi=300)
        texts = []
        confidences = []
        for page in pages:
            text, page_confidences = _recognized_text_and_confidences(page, pytesseract)
            texts.append(text)
            confidences.extend(page_confidences)
        result.text = "\n".join(t or "" for t in texts)
        result.confidence = _mean_confidence(confidences)
        result.available = True
    except ImportError:
        result.warning = (
            "OCR de PDF escaneado requiere pytesseract y pdf2image (y poppler en el sistema)."
        )
    except Exception as exc:  # pragma: no cover
        result.warning = f"Error en OCR de PDF: {exc}"
    return result
