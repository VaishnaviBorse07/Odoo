# Reimbursement Management System

A full-stack expense reimbursement system built with **PostgreSQL + FastAPI + React (Vite + Tailwind CSS)**.

---

## Architecture Overview

```
vaishu task/
├── sql/
│   ├── 01_create_tables.sql      ← All table DDL + triggers
│   ├── 02_create_users_and_roles.sql  ← DB roles & permissions
│   └── 03_seed_data.sql           ← Demo company, users, categories
│
├── backend/                       ← FastAPI (Python)
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/                ← SQLAlchemy ORM models
│   │   ├── schemas/               ← Pydantic schemas
│   │   ├── routers/               ← API endpoint handlers
│   │   ├── services/              ← Business logic
│   │   └── core/                  ← Security, dependencies
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/                      ← React + Vite + Tailwind
    ├── src/
    │   ├── App.tsx
    │   ├── components/
    │   ├── pages/
    │   ├── services/
    │   ├── store/
    │   └── utils/
    ├── package.json
    └── vite.config.ts
```

---

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| PostgreSQL | 15+ | https://www.postgresql.org/download/ |
| Python | 3.11+ | https://www.python.org/downloads/ |
| Node.js | 20+ | https://nodejs.org/ |
| Tesseract (OCR) | 5.x | https://github.com/UB-Mannheim/tesseract/wiki |

---

## STEP 1 — PostgreSQL Setup

### 1.1 Create the database (run as postgres superuser)

```powershell
# Open psql as postgres
psql -U postgres
```

Inside psql shell:
```sql
CREATE DATABASE reimbursement_db;
\q
```

### 1.2 Create tables

```powershell
psql -U postgres -d reimbursement_db -f "sql/01_create_tables.sql"
```

### 1.3 Create application DB roles

```powershell
psql -U postgres -d reimbursement_db -f "sql/02_create_users_and_roles.sql"
```

### 1.4 (Optional) Insert seed/demo data

```powershell
psql -U postgres -d reimbursement_db -f "sql/03_seed_data.sql"
```

**Seed credentials:**
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@acme.com | Admin@123 |
| Manager | manager@acme.com | Manager@123 |
| Employee | employee@acme.com | Employee@123 |

> **Note:** For local dev, seed passwords are stored as **plain text** in `users.password_hash` (see `app.core.security`). Use production-grade hashing before any real deployment.

---

## STEP 2 — Backend Setup (FastAPI)

### 2.1 Navigate to backend directory

```powershell
cd "c:\Users\bhave\Desktop\vaishu task\backend"
```

### 2.2 Create a Python virtual environment

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

> If you get a policy error:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

### 2.3 Install Python dependencies

```powershell
pip install -r requirements.txt
```

### 2.4 Create your `.env` file

```powershell
copy .env.example .env
```

Then open `.env` and edit:
```env
DATABASE_URL=postgresql+asyncpg://reimbursement_app:AppStr0ngP%40ss!@localhost:5432/reimbursement_db

SECRET_KEY=your_64_character_random_string_here_change_this_in_production_!!

ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

EXCHANGE_RATE_BASE_URL=https://api.exchangerate-api.com/v4/latest
COUNTRIES_API_URL=https://restcountries.com/v3.1/all?fields=name,currencies

UPLOAD_DIR=uploads
TESSERACT_CMD=C:/Program Files/Tesseract-OCR/tesseract.exe

FRONTEND_ORIGIN=http://localhost:5173
```

> Generate a strong SECRET_KEY:
> ```python
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

### 2.5 Run the FastAPI server

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Health check:** http://localhost:8000/health

> Tables are auto-created on first startup via SQLAlchemy `create_all`.

---

## STEP 3 — Frontend Setup (React + Vite)

### 3.1 Navigate to frontend directory

```powershell
cd "c:\Users\bhave\Desktop\vaishu task\frontend"
```

### 3.2 Install Node.js dependencies

```powershell
npm install
```

### 3.3 Start the development server

```powershell
npm run dev
```

The frontend will be at: **http://localhost:5173**

> The Vite proxy forwards `/api/*` → `http://localhost:8000/*` automatically.

---

## STEP 4 — First Login / Setup

### Option A: Fresh Signup (recommended)
1. Go to http://localhost:5173/signup
2. Fill in your name, email, password, and company details
3. Select your country → currency auto-fills
4. Click **Create Account & Company**
5. You are now the **Admin**

### Option B: Use Seed Data
1. Run `sql/03_seed_data.sql`
2. Login at http://localhost:5173/login with `admin@acme.com` / `Admin@123`

### Admin First Steps
1. Go to **User Management** → Create employees and managers
2. Assign managers to employees
3. Go to **Approval Rules** → Create your first approval workflow
4. Employees can now submit expenses

---

## API Endpoints Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Create company + admin user |
| POST | `/auth/login` | Login, get JWT tokens |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/logout` | Revoke refresh token |

### Users (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me` | Get current user |
| GET | `/users/` | List all company users |
| POST | `/users/` | Create user |
| PATCH | `/users/{id}` | Update user |
| DELETE | `/users/{id}` | Delete user |
| POST | `/users/{id}/managers` | Assign manager |
| DELETE | `/users/{id}/managers/{mgr_id}` | Remove manager |

### Expenses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/expenses/` | List expenses (filtered by role) |
| POST | `/expenses/` | Submit expense |
| GET | `/expenses/{id}` | Get expense detail |
| PATCH | `/expenses/{id}` | Update expense |
| DELETE | `/expenses/{id}` | Delete expense |
| POST | `/expenses/{id}/receipt` | Upload receipt (triggers OCR) |
| POST | `/expenses/{id}/override` | Admin approve/reject |
| GET | `/expenses/categories` | List categories |
| POST | `/expenses/categories` | Create category |

### Approvals
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/approvals/rules` | List approval rules |
| POST | `/approvals/rules` | Create approval rule |
| PATCH | `/approvals/rules/{id}` | Update rule |
| DELETE | `/approvals/rules/{id}` | Delete rule |
| GET | `/approvals/pending` | My pending approvals |
| POST | `/approvals/{id}/action` | Approve or reject |
| GET | `/approvals/expense/{id}` | Approval history for expense |

### Company
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/company/` | Get company details |
| PATCH | `/company/` | Update company |
| GET | `/company/countries` | Country + currency list |

---

## Approval Rule Types Explained

| Type | How it Works |
|------|-------------|
| **Sequential** | Each approver must act before the next. Steps run in order (Step 1 → Step 2 → Step 3) |
| **Percentage** | N% of all approvers must approve (parallel). E.g., 2 out of 3 = 67% |
| **Specific Approver** | If the designated "key approver" approves → auto-approved for everyone |
| **Hybrid** | Either percentage threshold OR key approver approval triggers full approval |

### Step Configuration Options
- **Employee's Direct Manager** — dynamically resolves to whoever is the employee's assigned manager
- **Specific User** — choose a named user (e.g., CFO, Finance Head)
- **Role Label** — descriptive label for documentation (Finance, Director, etc.)
- **Key Approver** — marks this approver as the "power approver" for Specific/Hybrid rules
- **Is Manager Approver** — when checked on a user account, that user must approve their team's expenses first

---

## OCR Receipt Processing

When an employee uploads a receipt image:
1. The image is saved to the `uploads/` folder
2. Tesseract OCR extracts text from the image
3. The service parses: **amount**, **date**, **merchant name**
4. Parsed data is stored in `expenses.ocr_data` (JSONB)
5. The frontend shows extracted data in the expense detail view

**Tesseract must be installed** and `TESSERACT_CMD` must point to the binary.

---

## Currency Conversion

- When an employee submits an expense in any currency, the system calls `exchangerate-api.com`
- The amount is converted to the **company's default currency** using live rates
- Both original amount + converted amount are stored
- Managers see amounts in the **company's currency** for consistent comparison

---

## Database Tables Summary

| Table | Purpose |
|-------|---------|
| `companies` | Company info, default currency |
| `users` | All users (admin, manager, employee) |
| `employee_manager_relationships` | Who reports to whom |
| `expense_categories` | Configurable expense categories per company |
| `expenses` | Expense claims with currency data |
| `approval_rules` | Admin-configured approval workflows |
| `approval_rule_steps` | Steps inside each rule |
| `expense_approvals` | Live approval instances per expense |
| `refresh_tokens` | JWT refresh token rotation |
| `audit_logs` | Full audit trail |

---

## Production Checklist

- [ ] Change `SECRET_KEY` to a strong random value
- [ ] Change DB passwords in `02_create_users_and_roles.sql`
- [ ] Use Alembic for migrations instead of `create_all`
- [ ] Set up HTTPS (nginx / Caddy reverse proxy)
- [ ] Configure environment variables in server (not `.env` file)
- [ ] Set `FRONTEND_ORIGIN` to your actual domain
- [ ] Run `npm run build` for production frontend build
- [ ] Set up file storage (S3 / GCS) instead of local `uploads/`
- [ ] Configure rate limiting on auth endpoints
