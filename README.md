# TravelEase

A full-stack Indian tourism platform: curated tour packages, bookings, destination exploration, regional food spots, and an explainable recommendation engine with an AI travel assistant.

**Stack:** React 19 (Vite) · Three.js · MapLibre GL · PHP 8.1+ REST API · MySQL

## Project Structure

```
TravelEase/
├── backend/          PHP REST API (deployed under XAMPP/LApache)
│   └── api/          Endpoints organized by domain (auth, packages, bookings, food, ...)
│   └── .env.example  Environment template — copy to .env and fill in
├── frontend/         React (Vite) SPA
├── database/         schema.sql + numbered migrations
├── README.md         This file
└── DEPLOYMENT_GUIDE.md  Production deployment (Linux/Apache/Nginx)
```

## Features

- **Tour Packages** — relational model with itineraries, inclusions, and multi-image galleries
- **Bookings** — transactional capacity checks; each booking returns a cryptographic confirmation token instead of a guessable ID
- **Explore & Themes** — destination-aware adaptive theme engine (monsoon, coastal, sunset, alpine)
- **3D Views** — Three.js destination viewer and globe (WebGL with graceful fallback)
- **Route Planner** — MapLibre GL with OpenFreeMap vector tiles, markers, and distance calculation
- **Food Spots** — public directory of approved foodspots plus a merchant application portal
- **Recommendations** — deterministic, rule-based scoring with a visible breakdown of why each package matched
- **Travel Assistant** — AI chatbot via a PHP proxy with database grounding; API keys never reach the browser, and it falls back to keyword responses offline

## Prerequisites

| Tool | Version |
|---|---|
| XAMPP (Apache + MySQL + PHP) | PHP 8.1+ |
| Node.js | v18+ |

## Setup

### 1. Database

```powershell
# From the project root
mysql -u root -p < database/schema.sql

# Additive migrations (07X/00X pairs may coexist; run the ones matching your feature set)
mysql -u root -p < database/migrations/001_phase2_schema_normalization_fixed.sql
mysql -u root -p < database/migrations/003_food_platform.sql
mysql -u root -p < database/migrations/004_users_authentication.sql
mysql -u root -p < database/migrations/005_smart_travel_assistant.sql
```

### 2. Backend configuration

```powershell
copy backend\.env.example backend\.env
```

Then open `backend/.env` and set your own values — **do not commit this file, and never reuse credentials from any example or sample code:**

- `MYSQL_*` — your local MySQL credentials
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — a strong, unique admin password (used by `setup_admin.php`)
- `REACT_APP_URL` — frontend origin for CORS (default `http://localhost:5173`)
- `OMNIROUTE_*` — optional AI provider; leave blank for offline keyword responses

### 3. Deploy the backend

Copy the `backend/` folder into Apache's document root:

```powershell
xcopy /E /I "backend" "C:\xampp\htdocs\travelease\backend"
```

Run the setup and health-check scripts:

```powershell
php backend/setup_admin.php
php backend/check_db.php
```

Ensure Apache and MySQL are running in the XAMPP control panel.

### 4. Run the frontend

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

> Log in with the admin credentials you set in `backend/.env` in step 2. No default passwords ship with this project — if you find credentials anywhere in sample data, treat them as test-only and change them before real use.

## Routes

### Public pages

| Route | Purpose |
|---|---|
| `/` | Homepage — hero, destination globe, featured packages |
| `/explore` | Destination explorer with adaptive themes |
| `/packages` · `/packages/:id` | Package listing & details (gallery, 3D view, route map) |
| `/recommendations` | Preference-based package matching with score breakdown |
| `/food-spots` | Approved foodspots directory + merchant enrollment |
| `/book` · `/book/:packageId` | Booking flow |
| `/booking-confirmation/:id` | Token-secured confirmation |
| `/booking-status` | Look up a booking by confirmation token |
| `/contact` | Support information |
| `/admin/login` · `/admin/dashboard` | Rate-limited admin portal |

### Main API endpoints

| Endpoint | Method | Notes |
|---|---|---|
| `api/auth/login.php` | POST | Session + CSRF token |
| `api/auth/user-login.php` · `user-register.php` | POST | Tourist accounts |
| `api/packages/index.php` | GET | Public listings & details |
| `api/packages/manage.php` | POST/PUT/DELETE | Admin CRUD (CSRF required) |
| `api/packages/images.php` | POST | Admin multi-image upload |
| `api/bookings/index.php` | POST/GET | Create booking · token lookup |
| `api/bookings/admin.php` | GET | Admin confirm/reject/cancel |
| `api/food/locations.php` | GET | Approved foodspots |
| `api/food/merchant_application.php` | POST | Merchant enrollment |
| `api/recommendations/smart-assistant.php` | POST | Explainable recommendations |
| `api/chatbot/index.php` | POST | AI travel assistant proxy |

(Prefix all API paths with your backend host, e.g. `http://localhost/travelease/backend/`.)

## Security Notes

- Admin sessions use PHP session cookies (`HttpOnly`, `SameSite=Lax`, `Secure` in production) with CSRF validation on every mutation
- Admin login is rate-limited (5 attempts / 15 minutes); passwords are bcrypt-hashed
- All SQL goes through PDO prepared statements
- Booking lookups require a 128-character cryptographic token — sequential ID enumeration is impossible
- Image uploads validate MIME type (`jpeg`/`png`/`webp`), enforce a 5 MB limit, and sanitize filenames
- AI provider keys live only server-side; the browser never talks to the AI provider directly

## More Documentation

- **DEPLOYMENT_GUIDE.md** — production setup: SSL, Apache/Nginx configs, backups, monitoring, security hardening
