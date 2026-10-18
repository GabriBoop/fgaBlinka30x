import shutil

import pytest
import pytesseract
from PIL import Image, ImageDraw, ImageFont

from app.services import ocr


@pytest.mark.skipif(shutil.which("tesseract") is None, reason="Tesseract no está instalado")
def test_image_ocr_extracts_text_and_confidence(tmp_path):
    image = Image.new("RGB", (1200, 300), "white")
    ImageDraw.Draw(image).text(
        (40, 80),
        "Invoice 12345",
        fill="black",
        font=ImageFont.load_default(size=64),
    )
    image_path = tmp_path / "invoice.png"
    image.save(image_path)

    result = ocr.image_to_text(image_path)

    assert result.available is True
    assert result.text.strip()
    assert result.confidence is not None
    assert 0 <= result.confidence <= 1


def test_missing_tesseract_returns_manual_entry_warning(monkeypatch):
    monkeypatch.setattr(ocr, "is_available", lambda: False)

    result = ocr.image_to_text("not-opened.png")

    assert result.available is False
    assert result.text == ""
    assert result.warning is not None
    assert "Tesseract" in result.warning


def test_image_ocr_uses_grayscale_spanish_and_word_confidences(monkeypatch, tmp_path):
    image_path = tmp_path / "image.png"
    Image.new("RGB", (20, 20), "white").save(image_path)
    monkeypatch.setattr(ocr, "is_available", lambda: True)

    def image_to_string(image, lang):
        assert image.mode == "L"
        assert lang == "spa+eng"
        return "texto de prueba"

    def image_to_data(image, lang, output_type):
        assert image.mode == "L"
        assert lang == "spa+eng"
        assert output_type == pytesseract.Output.DICT
        return {"conf": ["20", "-1", "80", "0"]}

    monkeypatch.setattr(pytesseract, "image_to_string", image_to_string)
    monkeypatch.setattr(pytesseract, "image_to_data", image_to_data)

    result = ocr.image_to_text(image_path)

    assert result.text == "texto de prueba"
    assert result.confidence == pytest.approx(0.5)


def test_scanned_pdf_uses_300_dpi_and_averages_word_confidences(monkeypatch):
    monkeypatch.setattr(ocr, "is_available", lambda: True)
    page_images = [Image.new("RGB", (10, 10), "white") for _ in range(2)]
    conversion_options = {}

    def convert_pages(_path, **kwargs):
        conversion_options.update(kwargs)
        return page_images

    confidences = iter((["40", "-1"], ["80", "0"]))
    monkeypatch.setattr("pdf2image.convert_from_path", convert_pages)
    monkeypatch.setattr(pytesseract, "image_to_string", lambda _image, lang: f"página {lang}")
    monkeypatch.setattr(
        pytesseract,
        "image_to_data",
        lambda _image, lang, output_type: {"conf": next(confidences)},
    )

    result = ocr.pdf_pages_to_text("factura.pdf")

    assert conversion_options["dpi"] == 300
    assert result.text.count("página spa+eng") == 2
    assert result.confidence == pytest.approx(0.6)
