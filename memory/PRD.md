# SourceLess Sand Garage — Product Requirements

## Overview
Mobile virtual garage to manage personal cars: track specs/expiries, upload Xtool Diagnose PDFs, browse trouble code history.

## Stack
- Frontend: Expo SDK 54 (file-based routing, expo-router)
- Backend: FastAPI + MongoDB (Motor)
- Auth: Custom JWT (bcrypt + python-jose), Bearer tokens via AsyncStorage
- AI: Gemini 2.5 Flash via emergentintegrations for PDF DTC extraction

## Features
1. **Multi-user auth** — Register / login with email + password, JWT token persisted across launches.
2. **Garage (cars list)** — Card per car with plate, model, year, engine, insurance/MOT status dots, sticky 30-day expiry alert banner.
3. **Add / edit car** — Form: Producer, Model, Year, Engine, Insurance Expiry, MOT, Tyre type, Colour, Plate Number. Multi-photo picker (up to 12 photos per car) with thumbnail strip + remove control. Edit screen at `/car/edit/{id}` reuses the same form.
4. **Car detail** — Pageable photo gallery (horizontal swipe), specs grid, diagnostic history with colour-coded trouble code chips, sticky "Upload Xtool PDF" CTA, hero-header edit (pencil) + delete (trash) icons.
5. **PDF diagnostic upload** — expo-document-picker → multipart upload → Gemini extracts DTCs as `[{code, description, system, severity}]` → stored under that car.
6. **Export diagnostics PDF** — `GET /api/cars/{id}/diagnostics/export?token=JWT` returns a branded ReportLab PDF (specs header + table of every code, system, severity). EXPORT button in the diagnostic history section uses `Linking.openURL` for native download.
7. **Diagnostics tab** — Global search across user's trouble codes by code/description/system, tap row → opens car.
8. **Profile** — User info + logout.

## Design
Dark-First Utility palette derived from sourceless.net (`#A7FF52` neon lime on deep black `#09090B`). Sharp, technical "command center" feel — no glassmorphism.

## Test User (seeded automatically)
- Email: `demo@sandgarage.app`
- Password: `Demo12345!`

## API (all `/api` prefixed)
- `POST /auth/register|login` → `{access_token, user}`
- `GET /auth/me`
- `GET|POST /cars`, `GET|PUT|DELETE /cars/{id}` (PUT accepts `photos: List[str]`)
- `POST /cars/{id}/diagnostics/upload` (multipart PDF)
- `GET /cars/{id}/diagnostics`
- `GET /cars/{id}/diagnostics/export?token=JWT` → application/pdf
- `GET /diagnostics/search?q=...`
- `DELETE /diagnostics/{id}`
