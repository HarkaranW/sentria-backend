# Sentria — Developer Handoff Package

**Cabinet SST · Dr Samiatou Latoundji · Lomé, Togo**
Occupational Health Management Platform — v1.1.0

---

## What's in this package

```
sentria-backend/
├── server/
│   ├── index.js                  ✅ Express entry point — complete
│   ├── middleware/
│   │   ├── auth.js               ✅ JWT verification — complete
│   │   └── roles.js              ✅ Role-based access + 30-day edit rule — complete
│   ├── routes/
│   │   ├── auth.js               ✅ Login, me, change-password, reset — complete
│   │   ├── _crud.js              ✅ Generic CRUD factory — complete
│   │   ├── consultations.js      ✅ Full CRUD — complete
│   │   ├── visites.js            ✅ Full CRUD + /certificat/word + /certificat/pdf — complete
│   │   ├── accidents.js          ✅ Full CRUD — complete
│   │   ├── clients.js            ✅ Full CRUD — complete
│   │   ├── salaries.js           ✅ List + full patient record — complete
│   │   ├── factures.js           ✅ Full CRUD + /export/pdf + /send-email — complete
│   │   ├── users.js              ✅ User mgmt + logo upload + profile — complete
│   │   ├── form-fields.js        ✅ Custom form editor — complete
│   │   └── rapports.js           ✅ Medical + billing reports — complete
│   ├── services/
│   │   ├── gen_certificat.js     ✅ Medical certificate Word generation — complete
│   │   ├── factureService.js     ✅ Invoice Word generation — complete
│   │   ├── rapportFactService.js ✅ Billing report Word generation — complete
│   │   ├── rapportService.js     ⚠️  Medical report Word generation — STUB (wire to gen_rapport_v2.js)
│   │   ├── pdfService.js         ✅ LibreOffice PDF conversion — complete
│   │   └── emailService.js       ✅ Resend email (invoices) — complete
│   └── db/
│       ├── pool.js               ✅ PostgreSQL connection pool — complete
│       ├── schema.sql            ✅ All tables + indexes + triggers — complete
│       └── seed.sql              ✅ Default users, clients, form fields — complete
├── client/
│   └── cabinet_sst_v11.html     ✅ Frontend — complete (place here)
├── .env.example                  ✅ All environment variables documented
├── package.json                  ✅ All dependencies listed
└── README.md                     ✅ This file
```

---

## Quick start (estimated: 2–3 days for a senior dev)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your actual values:
# - DATABASE_URL (from Supabase or your PostgreSQL)
# - JWT_SECRET (generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
# - RESEND_API_KEY (from resend.com)
# - SUPABASE_URL + SUPABASE_KEY (if using Supabase Storage for logos)
```

### 3. Initialize database
```bash
# Create tables
npm run db:init

# Seed default data (admin user, clients, form fields)
npm run db:seed
```

### 4. Place the frontend
```bash
# Copy the HTML file
cp /path/to/cabinet_sst_v11.html client/cabinet_sst_v11.html
```

### 5. Install LibreOffice (for PDF generation)
```bash
# Ubuntu/Debian (production server)
sudo apt-get install -y libreoffice

# macOS (development)
brew install --cask libreoffice
```

### 6. Start the server
```bash
npm run dev    # development (nodemon)
npm start      # production
```

---

## Frontend integration — replacing localStorage

The frontend (`cabinet_sst_v11.html`) currently uses `localStorage` for data persistence. This is marked throughout the code with:

```javascript
// PHASE 2 — Replace localStorage with API calls:
// loadS()  → GET /api/v1/state or individual endpoints per module
// saveS()  → POST/PUT /api/v1/{module}/:id on each mutation
// login()  → POST /api/v1/auth/login → JWT token
```

**Pattern for each module replacement:**

```javascript
// BEFORE (localStorage)
function saveConsultation(data) {
  S.consultations.push(data);
  saveS();
}

// AFTER (API)
async function saveConsultation(data) {
  const res = await fetch('/api/v1/consultations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionStorage.getItem('sentria_token')}`
    },
    body: JSON.stringify(data)
  });
  const { data: saved } = await res.json();
  S.consultations.unshift(saved);
  renderConsultations();
}
```

**Login replacement:**
```javascript
async function login(email, password) {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const { data } = await res.json();
  if (data?.token) {
    sessionStorage.setItem('sentria_token', data.token);
    CU = data.user;
    initApp();
  }
}
```

---

## Deployment on Railway

1. Push code to GitHub
2. Create new Railway project → "Deploy from GitHub repo"
3. Add environment variables from `.env` in Railway dashboard
4. Add PostgreSQL plugin → copy DATABASE_URL to env vars
5. Railway auto-detects Node.js and runs `npm start`
6. Add custom domain in Railway settings

**Estimated cost:** $5–15/month (Starter plan)

---

## Default credentials (CHANGE IMMEDIATELY)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@sentria.io | Admin2025! |
| Dr Latoundji | slatoundji@protonmail.com | Sentria2025! |

---

## User roles

| Role | Data entry | Reports/invoices | Form editor | User management |
|------|-----------|-----------------|-------------|-----------------|
| `medecin` | ✅ All modules | ✅ Full access | Own custom fields only | ❌ |
| `assistante` | ✅ All modules | ❌ | ❌ | ❌ |
| `admin` | ✅ All modules | ✅ Full access | ✅ All fields incl. core | ✅ |

---

## 30-day edit rule

Records can be modified within 30 days of creation by the same user who created them, or at any time by admin. Enforced server-side in `middleware/roles.js` → `canModify()`. Frontend also shows/hides the "Modifier" button based on this rule.

---

## Audio transcription (Speech-to-Text)

The frontend uses the browser's native `SpeechRecognition` API (Web Speech API) for the Interrogatoire fields. No server-side audio processing is needed — the browser transcribes speech to text directly. Works on Chrome and Edge. Firefox not supported.

---

## Missing: rapportService.js

The medical report service (`server/services/rapportService.js`) needs to be created by wiring the existing `gen_rapport_v2.js` script. The route is already configured in `rapports.js` — just implement `genRapportDocx()` following the same pattern as `factureService.js`.

---

## Key decisions made during build

- **Single HTML file** frontend — no framework, no build step required
- **PostgreSQL** — Supabase recommended for managed hosting + auth + storage
- **LibreOffice** for PDF conversion — best fidelity for Word → PDF on Linux
- **Montserrat font** — must be installed on server for LibreOffice to embed correctly: `sudo apt-get install fonts-montserrat`
- **localStorage → API** — migration documented above, marked with TODO comments in HTML
- **Salarie auto-creation** — when a new name is entered in a form, a salarie record is auto-created and linked. When a known salarié is selected from search, their record is updated with the new post.

---

## Questions?

Contact the product owner who coordinates with the design team.
Good luck — the hard part is done. 🚀
