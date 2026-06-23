from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
import re
import json
import tempfile
import uuid
import bcrypt
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors as rl_colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Config
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET_KEY = os.environ['JWT_SECRET_KEY']
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', '10080'))
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
users_col = db['users']
cars_col = db['cars']
diagnostics_col = db['diagnostics']

app = FastAPI(title="SourceLess Sand Garage API")
api_router = APIRouter(prefix="/api")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=True)


# ---------------- Models ----------------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str] = None


class CarBase(BaseModel):
    producer: str
    model: str
    year: int
    engine: str
    insurance_expiry: Optional[str] = None  # ISO yyyy-mm-dd
    mot_expiry: Optional[str] = None
    tyre_type: Optional[str] = None
    colour: Optional[str] = None
    plate_number: str
    photo_base64: Optional[str] = None  # legacy single photo (kept for back-compat)
    photos: Optional[List[str]] = None  # base64 data URIs


class CarCreate(CarBase):
    pass


class CarUpdate(BaseModel):
    producer: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    engine: Optional[str] = None
    insurance_expiry: Optional[str] = None
    mot_expiry: Optional[str] = None
    tyre_type: Optional[str] = None
    colour: Optional[str] = None
    plate_number: Optional[str] = None
    photo_base64: Optional[str] = None
    photos: Optional[List[str]] = None


class Car(CarBase):
    id: str
    user_id: str
    created_at: str


class TroubleCode(BaseModel):
    code: str
    description: Optional[str] = None
    system: Optional[str] = None
    severity: Optional[str] = None


class DiagnosticEntry(BaseModel):
    id: str
    car_id: str
    user_id: str
    source_filename: Optional[str] = None
    scanned_at: str
    notes: Optional[str] = None
    trouble_codes: List[TroubleCode] = []


# --------------- Auth helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('sub')
        if not user_id:
            raise cred_exc
    except JWTError:
        raise cred_exc
    user = await users_col.find_one({"id": user_id}, {"_id": 0, "hashed_password": 0})
    if not user:
        raise cred_exc
    return user


# ---------------- Auth Routes ----------------
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(body: RegisterRequest):
    existing = await users_col.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": body.email.lower(),
        "full_name": body.full_name or "",
        "hashed_password": hash_password(body.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await users_col.insert_one(user_doc)
    token = create_access_token(user_id)
    return TokenResponse(
        access_token=token,
        user={"id": user_id, "email": user_doc['email'], "full_name": user_doc['full_name']},
    )


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    user = await users_col.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user.get('hashed_password', '')):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user['id'])
    return TokenResponse(
        access_token=token,
        user={"id": user['id'], "email": user['email'], "full_name": user.get('full_name', '')},
    )


@api_router.get("/auth/me", response_model=UserPublic)
async def me(current: dict = Depends(get_current_user)):
    return UserPublic(id=current['id'], email=current['email'], full_name=current.get('full_name'))


# ---------------- Cars Routes ----------------
def _car_out(doc: dict) -> dict:
    photos = doc.get('photos') or []
    legacy = doc.get('photo_base64')
    if not photos and legacy:
        photos = [legacy]
    return {
        "id": doc['id'],
        "user_id": doc['user_id'],
        "producer": doc.get('producer', ''),
        "model": doc.get('model', ''),
        "year": doc.get('year', 0),
        "engine": doc.get('engine', ''),
        "insurance_expiry": doc.get('insurance_expiry'),
        "mot_expiry": doc.get('mot_expiry'),
        "tyre_type": doc.get('tyre_type'),
        "colour": doc.get('colour'),
        "plate_number": doc.get('plate_number', ''),
        "photo_base64": photos[0] if photos else None,
        "photos": photos,
        "created_at": doc.get('created_at', ''),
    }


@api_router.get("/cars")
async def list_cars(current: dict = Depends(get_current_user)):
    cursor = cars_col.find({"user_id": current['id']}, {"_id": 0})
    docs = await cursor.to_list(1000)
    docs.sort(key=lambda d: d.get('created_at', ''), reverse=True)
    return [_car_out(d) for d in docs]


@api_router.post("/cars")
async def create_car(body: CarCreate, current: dict = Depends(get_current_user)):
    car_id = str(uuid.uuid4())
    doc = body.dict()
    doc.update({
        "id": car_id,
        "user_id": current['id'],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await cars_col.insert_one(doc)
    return _car_out(doc)


@api_router.get("/cars/{car_id}")
async def get_car(car_id: str, current: dict = Depends(get_current_user)):
    doc = await cars_col.find_one({"id": car_id, "user_id": current['id']}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Car not found")
    return _car_out(doc)


@api_router.put("/cars/{car_id}")
async def update_car(car_id: str, body: CarUpdate, current: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await cars_col.update_one(
        {"id": car_id, "user_id": current['id']}, {"$set": updates}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Car not found")
    doc = await cars_col.find_one({"id": car_id}, {"_id": 0})
    return _car_out(doc)


@api_router.delete("/cars/{car_id}")
async def delete_car(car_id: str, current: dict = Depends(get_current_user)):
    res = await cars_col.delete_one({"id": car_id, "user_id": current['id']})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Car not found")
    await diagnostics_col.delete_many({"car_id": car_id, "user_id": current['id']})
    return {"ok": True}


# ---------------- Diagnostics Routes ----------------
DTC_REGEX = re.compile(r"\b([PCBU][0-9A-F]{4})\b", re.IGNORECASE)


async def extract_dtcs_with_ai(pdf_path: str) -> List[dict]:
    """Use Gemini via emergentintegrations to extract DTCs from Xtool PDF."""
    system_msg = (
        "You are an expert automotive diagnostic assistant. Extract every OBD-II / DTC trouble code "
        "from the provided diagnostic report PDF. Return ONLY a JSON array (no prose, no markdown fences). "
        "Each item: {\"code\":\"P0171\",\"description\":\"...\",\"system\":\"Engine/ABS/Airbag/Body/...\",\"severity\":\"info|warning|critical\"}. "
        "If no codes are found return []."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=system_msg,
    ).with_model("gemini", "gemini-2.5-flash")

    pdf_file = FileContentWithMimeType(file_path=pdf_path, mime_type="application/pdf")
    try:
        resp = await chat.send_message(UserMessage(
            text="Extract all DTC trouble codes from this Xtool diagnostic report. Return JSON array only.",
            file_contents=[pdf_file],
        ))
    except Exception as e:
        logger.warning(f"AI extraction failed: {e}")
        resp = ""

    text = (resp or "").strip()
    # strip code fences if any
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```\s*$", "", text)

    parsed: List[dict] = []
    try:
        data = json.loads(text) if text else []
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and item.get('code'):
                    parsed.append({
                        "code": str(item.get('code', '')).upper().strip(),
                        "description": item.get('description') or "",
                        "system": item.get('system') or "",
                        "severity": (item.get('severity') or "info").lower(),
                    })
    except json.JSONDecodeError:
        # Fallback: regex over the response text
        for m in DTC_REGEX.findall(text):
            parsed.append({"code": m.upper(), "description": "", "system": "", "severity": "info"})

    # Deduplicate by code preserving order
    seen = set()
    unique = []
    for c in parsed:
        k = c['code']
        if k and k not in seen:
            seen.add(k)
            unique.append(c)
    return unique


@api_router.post("/cars/{car_id}/diagnostics/upload")
async def upload_diagnostic_pdf(
    car_id: str,
    file: UploadFile = File(...),
    current: dict = Depends(get_current_user),
):
    car = await cars_col.find_one({"id": car_id, "user_id": current['id']}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Save to temp
    contents = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        codes = await extract_dtcs_with_ai(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    entry_id = str(uuid.uuid4())
    entry = {
        "id": entry_id,
        "car_id": car_id,
        "user_id": current['id'],
        "source_filename": file.filename,
        "scanned_at": datetime.now(timezone.utc).isoformat(),
        "trouble_codes": codes,
        "notes": "",
    }
    await diagnostics_col.insert_one(entry.copy())
    return {
        "id": entry_id,
        "car_id": car_id,
        "source_filename": file.filename,
        "scanned_at": entry['scanned_at'],
        "trouble_codes": codes,
        "notes": "",
    }


@api_router.get("/cars/{car_id}/diagnostics")
async def list_car_diagnostics(car_id: str, current: dict = Depends(get_current_user)):
    car = await cars_col.find_one({"id": car_id, "user_id": current['id']}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    docs = await diagnostics_col.find(
        {"car_id": car_id, "user_id": current['id']}, {"_id": 0}
    ).to_list(1000)
    docs.sort(key=lambda d: d.get('scanned_at', ''), reverse=True)
    return docs


@api_router.delete("/diagnostics/{entry_id}")
async def delete_diagnostic(entry_id: str, current: dict = Depends(get_current_user)):
    res = await diagnostics_col.delete_one({"id": entry_id, "user_id": current['id']})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"ok": True}


@api_router.get("/diagnostics/search")
async def search_trouble_codes(q: str = "", current: dict = Depends(get_current_user)):
    """Search all diagnostic entries for the current user by trouble code or text."""
    query = {"user_id": current['id']}
    docs = await diagnostics_col.find(query, {"_id": 0}).to_list(2000)
    cars = await cars_col.find({"user_id": current['id']}, {"_id": 0}).to_list(1000)
    cars_by_id = {c['id']: c for c in cars}

    q_norm = (q or "").strip().lower()
    results = []
    for d in docs:
        car = cars_by_id.get(d.get('car_id'))
        if not car:
            continue
        for tc in d.get('trouble_codes', []) or []:
            haystack = " ".join([
                str(tc.get('code', '')),
                str(tc.get('description', '')),
                str(tc.get('system', '')),
            ]).lower()
            if q_norm and q_norm not in haystack:
                continue
            results.append({
                "code": tc.get('code'),
                "description": tc.get('description'),
                "system": tc.get('system'),
                "severity": tc.get('severity'),
                "scanned_at": d.get('scanned_at'),
                "diagnostic_id": d.get('id'),
                "car_id": car['id'],
                "car_label": f"{car.get('producer','')} {car.get('model','')} ({car.get('plate_number','')})".strip(),
            })
    results.sort(key=lambda r: r.get('scanned_at', ''), reverse=True)
    return results


@api_router.get("/cars/{car_id}/diagnostics/export")
async def export_diagnostics_pdf(car_id: str, token: str):
    """Export per-car diagnostic history as a downloadable PDF.

    Uses ?token=... (JWT) instead of Authorization header so a plain link / anchor
    can trigger the browser download without custom headers.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('sub')
    except JWTError:
        user_id = None
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    user = await users_col.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user")

    car = await cars_col.find_one({"id": car_id, "user_id": user_id}, {"_id": 0})
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    entries = await diagnostics_col.find(
        {"car_id": car_id, "user_id": user_id}, {"_id": 0}
    ).to_list(1000)
    entries.sort(key=lambda d: d.get('scanned_at', ''), reverse=True)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm,
                            topMargin=18*mm, bottomMargin=18*mm,
                            title=f"Diagnostics - {car.get('plate_number','')}")
    base_styles = getSampleStyleSheet()
    accent = rl_colors.HexColor("#A7FF52")
    dark = rl_colors.HexColor("#09090B")
    muted = rl_colors.HexColor("#71717A")
    h1 = ParagraphStyle('h1', parent=base_styles['Heading1'], textColor=dark, fontSize=20, spaceAfter=4, leading=24)
    h2 = ParagraphStyle('h2', parent=base_styles['Heading2'], textColor=dark, fontSize=13, spaceBefore=12, spaceAfter=6)
    small = ParagraphStyle('small', parent=base_styles['Normal'], textColor=muted, fontSize=9)
    body = ParagraphStyle('body', parent=base_styles['Normal'], fontSize=10, leading=14)
    brand = ParagraphStyle('brand', parent=base_styles['Normal'], textColor=accent, fontSize=10, leading=12, spaceAfter=2)

    story = []
    story.append(Paragraph("&#9673; SOURCELESS &middot; SAND GARAGE", brand))
    story.append(Paragraph(f"Diagnostics Report &mdash; {car.get('producer','')} {car.get('model','')}", h1))
    story.append(Paragraph(
        f"Plate: <b>{car.get('plate_number','')}</b> &nbsp;|&nbsp; Year: {car.get('year','')} &nbsp;|&nbsp; Engine: {car.get('engine','') or '—'}",
        small))
    story.append(Paragraph(
        f"Insurance: {car.get('insurance_expiry') or '—'} &nbsp;|&nbsp; MOT: {car.get('mot_expiry') or '—'} &nbsp;|&nbsp; Tyres: {car.get('tyre_type') or '—'} &nbsp;|&nbsp; Colour: {car.get('colour') or '—'}",
        small))
    story.append(Paragraph(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", small))
    story.append(Spacer(1, 8))

    if not entries:
        story.append(Paragraph("No diagnostic scans recorded for this vehicle.", body))
    else:
        for entry in entries:
            scanned = entry.get('scanned_at', '')
            try:
                pretty = datetime.fromisoformat(scanned.replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M')
            except Exception:
                pretty = scanned
            story.append(Paragraph(f"Scan &mdash; {pretty}", h2))
            story.append(Paragraph(f"Source file: {entry.get('source_filename') or '—'}", small))
            codes = entry.get('trouble_codes') or []
            if not codes:
                story.append(Spacer(1, 4))
                story.append(Paragraph("No trouble codes detected.", body))
                continue
            data = [["CODE", "DESCRIPTION", "SYSTEM", "SEVERITY"]]
            for tc in codes:
                data.append([
                    str(tc.get('code', '') or ''),
                    str(tc.get('description', '') or ''),
                    str(tc.get('system', '') or ''),
                    str(tc.get('severity', '') or '').upper(),
                ])
            tbl = Table(data, colWidths=[28*mm, 90*mm, 28*mm, 24*mm], repeatRows=1)
            tbl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), dark),
                ('TEXTCOLOR', (0, 0), (-1, 0), accent),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [rl_colors.whitesmoke, rl_colors.white]),
                ('GRID', (0, 0), (-1, -1), 0.25, rl_colors.HexColor('#D4D4D8')),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            story.append(tbl)
            story.append(Spacer(1, 6))

    doc.build(story)
    buf.seek(0)
    filename = f"diagnostics_{(car.get('plate_number') or 'car').replace(' ', '_')}.pdf"
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# Health/root
@api_router.get("/")
async def root():
    return {"service": "SourceLess Sand Garage", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    await users_col.create_index("email", unique=True)
    await cars_col.create_index([("user_id", 1)])
    await diagnostics_col.create_index([("user_id", 1), ("car_id", 1)])
    # Seed demo user
    demo_email = "demo@sandgarage.app"
    existing = await users_col.find_one({"email": demo_email})
    if not existing:
        await users_col.insert_one({
            "id": str(uuid.uuid4()),
            "email": demo_email,
            "full_name": "Demo Driver",
            "hashed_password": hash_password("Demo12345!"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded demo user")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
