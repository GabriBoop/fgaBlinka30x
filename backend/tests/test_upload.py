import pytest
from pypdf import PdfWriter
import io

from conftest import TestingSessionLocal
from app.models.company import CompanyDemo
from app.models.invoice import Invoice
from app.services.extraction import ExtractionResult
import app.api.v1.upload as upload_module


def _make_pdf_bytes() -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _seed_company(db):
    if not db.query(CompanyDemo).filter(CompanyDemo.id == "co_upload_01").first():
        db.add(CompanyDemo(id="co_upload_01", name="Co Upload", currency_base="USD"))
        db.commit()


class FakeExtraction:
    def __init__(self, source_type="pdf", raw_text="", confidence=0.95, ocr_available=False, ocr_warning=None):
        self.source_type = source_type
        self.file_name = "factura.pdf"
        self.file_hash = "sha256:faketest"
        self.file_path = "/tmp/fake/factura.pdf"
        self.mime_type = "application/pdf"
        self.size_bytes = 100
        self.raw_text = raw_text
        self.extraction_confidence = confidence
        self.ocr_available = ocr_available
        self.ocr_warning = ocr_warning


def _fake_extract(content, file_name):
    return FakeExtraction()


@pytest.fixture
def patch_extract(monkeypatch):
    monkeypatch.setattr(upload_module, "extract_file", _fake_extract)


def test_upload_pdf_creates_pending_invoice(client, db_session, patch_extract):
    _seed_company(db_session)
    pdf_bytes = _make_pdf_bytes()

    files = {"file": ("factura.pdf", pdf_bytes, "application/pdf")}
    data = {"company_id": "co_upload_01"}
    r = client.post("/api/v1/invoices/upload", files=files, data=data)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "PENDING"
    assert body["source_type"] == "pdf"
    assert body["file_name"] == "factura.pdf"
    assert body["file_hash"].startswith("sha256:")
    assert body["ocr_available"] is False


def test_upload_rejected_extension(client, db_session):
    _seed_company(db_session)
    files = {"file": ("malware.exe", b"\x00\x01", "application/octet-stream")}
    data = {"company_id": "co_upload_01"}
    r = client.post("/api/v1/invoices/upload", files=files, data=data)
    assert r.status_code == 400, r.text


def test_upload_missing_company_id(client, db_session):
    _seed_company(db_session)
    files = {"file": ("factura.pdf", b"%PDF-1.4", "application/pdf")}
    r = client.post("/api/v1/invoices/upload", files=files, data={})
    assert r.status_code == 422, r.text  # Form(...) obligatorio


def test_reextract_without_file(client, db_session):
    _seed_company(db_session)
    db = TestingSessionLocal()
    db.add(
        Invoice(
            id="inv_no_file", company_id="co_upload_01", source_type="manual",
            status="PENDING", file_path=None,
        )
    )
    db.commit()
    db.close()

    r = client.post("/api/v1/invoices/inv_no_file/extract")
    assert r.status_code == 400, r.text
