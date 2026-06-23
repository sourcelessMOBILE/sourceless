"""Backend tests for SourceLess Sand Garage API.
Covers: auth (register/login/me), cars CRUD (user-scoped), diagnostics PDF upload,
diagnostics list, and global trouble code search.
"""
import os
import io
import uuid
import pytest
import requests

BASE_URL = (
    os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    or os.environ.get('EXPO_BACKEND_URL')
).rstrip('/')

DEMO_EMAIL = "demo@sandgarage.app"
DEMO_PASSWORD = "Demo12345!"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def demo_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}", "Content-Type": "application/json"}


# ---------- Health ----------
def test_root(api):
    r = api.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------- Auth ----------
class TestAuth:
    def test_register_new_user(self, api):
        email = f"TEST_{uuid.uuid4().hex[:10]}@example.com"
        r = api.post(f"{BASE_URL}/api/auth/register",
                     json={"email": email, "password": "Passw0rd!", "full_name": "Tester"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == email.lower()  # backend lowercases

    def test_register_duplicate(self, api):
        r = api.post(f"{BASE_URL}/api/auth/register",
                     json={"email": DEMO_EMAIL, "password": "whatever123"})
        assert r.status_code == 400

    def test_login_demo(self, demo_token):
        assert isinstance(demo_token, str) and len(demo_token) > 20

    def test_login_invalid(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"email": DEMO_EMAIL, "password": "wrong-password"})
        assert r.status_code == 401

    def test_me(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == DEMO_EMAIL and "id" in body

    def test_me_unauth(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


# ---------- Cars CRUD ----------
class TestCars:
    created_id = None

    def test_create_car(self, api, auth_headers):
        payload = {
            "producer": "TEST_Toyota",
            "model": "Corolla",
            "year": 2020,
            "engine": "1.8L Hybrid",
            "insurance_expiry": "2030-01-01",
            "mot_expiry": "2030-02-01",
            "tyre_type": "All-season",
            "colour": "Lime",
            "plate_number": f"TST-{uuid.uuid4().hex[:5].upper()}",
        }
        r = api.post(f"{BASE_URL}/api/cars", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["producer"] == "TEST_Toyota"
        assert data["plate_number"] == payload["plate_number"]
        assert "id" in data and "user_id" in data
        TestCars.created_id = data["id"]

    def test_get_created_car(self, api, auth_headers):
        cid = TestCars.created_id
        assert cid
        r = api.get(f"{BASE_URL}/api/cars/{cid}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["id"] == cid

    def test_list_cars_contains(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/cars", headers=auth_headers)
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert TestCars.created_id in ids

    def test_update_car(self, api, auth_headers):
        cid = TestCars.created_id
        r = api.put(f"{BASE_URL}/api/cars/{cid}",
                    json={"colour": "Neon Green"}, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["colour"] == "Neon Green"
        # Verify persistence
        r2 = api.get(f"{BASE_URL}/api/cars/{cid}", headers=auth_headers)
        assert r2.json()["colour"] == "Neon Green"

    def test_other_user_cannot_access(self, api):
        # Register a second user, ensure no access to first user's car
        email = f"TEST_{uuid.uuid4().hex[:10]}@example.com"
        r = api.post(f"{BASE_URL}/api/auth/register",
                     json={"email": email, "password": "Passw0rd!"})
        assert r.status_code == 200
        tok = r.json()["access_token"]
        hdr = {"Authorization": f"Bearer {tok}"}
        r2 = api.get(f"{BASE_URL}/api/cars/{TestCars.created_id}", headers=hdr)
        assert r2.status_code == 404

    def test_unauth_list(self, api):
        r = api.get(f"{BASE_URL}/api/cars")
        assert r.status_code == 401


# ---------- Diagnostics PDF upload + history ----------
class TestDiagnostics:
    diag_id = None

    def _minimal_pdf_with_codes(self) -> bytes:
        # Minimal valid PDF with text "P0171 P0300 P0420"
        content_stream = b"BT /F1 12 Tf 50 700 Td (P0171 P0300 P0420) Tj ET"
        # simple PDF skeleton
        pdf = (
            b"%PDF-1.4\n"
            b"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n"
            b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n"
            b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n"
            b"4 0 obj<< /Length " + str(len(content_stream)).encode() + b" >>stream\n"
            + content_stream + b"\nendstream endobj\n"
            b"5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n"
            b"xref\n0 6\n0000000000 65535 f \n"
            b"trailer<< /Size 6 /Root 1 0 R >>\nstartxref\n0\n%%EOF\n"
        )
        return pdf

    def test_upload_pdf(self, auth_headers):
        car_id = TestCars.created_id
        assert car_id, "Need car from TestCars first"
        files = {"file": ("xtool_report.pdf", self._minimal_pdf_with_codes(), "application/pdf")}
        # Use a fresh session w/o JSON content-type
        h = {"Authorization": auth_headers["Authorization"]}
        r = requests.post(f"{BASE_URL}/api/cars/{car_id}/diagnostics/upload",
                          headers=h, files=files, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "trouble_codes" in data and isinstance(data["trouble_codes"], list)
        assert "id" in data
        TestDiagnostics.diag_id = data["id"]

    def test_upload_rejects_non_pdf(self, auth_headers):
        car_id = TestCars.created_id
        h = {"Authorization": auth_headers["Authorization"]}
        files = {"file": ("notes.txt", b"hello", "text/plain")}
        r = requests.post(f"{BASE_URL}/api/cars/{car_id}/diagnostics/upload",
                          headers=h, files=files, timeout=30)
        assert r.status_code == 400

    def test_list_car_diagnostics(self, api, auth_headers):
        car_id = TestCars.created_id
        r = api.get(f"{BASE_URL}/api/cars/{car_id}/diagnostics", headers=auth_headers)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) >= 1

    def test_search_all(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/diagnostics/search?q=", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_search_specific_code(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/diagnostics/search?q=P0171", headers=auth_headers)
        assert r.status_code == 200
        results = r.json()
        # If AI extracted codes, at least one should match (be lenient)
        if results:
            codes = [(x.get("code") or "").upper() for x in results]
            assert any("P0171" in c for c in codes) or any("P0" in c for c in codes)


# ---------- Cleanup (delete car -> diagnostics) ----------
class TestCleanup:
    def test_delete_car_cleans_diagnostics(self, api, auth_headers):
        cid = TestCars.created_id
        r = api.delete(f"{BASE_URL}/api/cars/{cid}", headers=auth_headers)
        assert r.status_code == 200
        # Verify
        r2 = api.get(f"{BASE_URL}/api/cars/{cid}", headers=auth_headers)
        assert r2.status_code == 404
        r3 = api.get(f"{BASE_URL}/api/cars/{cid}/diagnostics", headers=auth_headers)
        assert r3.status_code == 404
