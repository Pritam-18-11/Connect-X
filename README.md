# PrivaChat — Consent-First Messaging

> A privacy-focused messaging platform where connections require **mutual approval** via one-time invite codes.

---

## Project Structure

```
privachat/
├── frontend/          ← React + Vite + Tailwind
│   └── src/
│       ├── components/   Sidebar, AppLayout
│       ├── pages/        All 9 UI pages
│       ├── context/      AuthContext (wired in Step 2)
│       └── utils/        Helpers (added per step)
│
└── backend/           ← Node.js + Express
    ├── routes/        (added in Step 2+)
    ├── models/        (added in Step 2+)
    ├── middleware/    (added in Step 2+)
    ├── socket/        (added in Step 5)
    └── server.js
```

---

## Step 1 — Running the Project

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at: **http://localhost:3000**

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in MONGO_URI and JWT_SECRET later
npm run dev
```

Runs at: **http://localhost:5000**

---

## Environment Variables (Backend)

| Variable     | Description                        |
|--------------|------------------------------------|
| `MONGO_URI`  | MongoDB Atlas connection string    |
| `JWT_SECRET` | Random secret for JWT signing      |
| `PORT`       | Backend port (default: 5000)       |
| `CLIENT_URL` | Frontend URL for CORS              |

---

## Build Steps

| Step | Feature                    | Status  |
|------|----------------------------|---------|
| 1    | Project Setup + UI         | ✅ Done |
| 2    | Authentication             | ⏳ Next |
| 3    | Invite Code System         | ⏳      |
| 4    | Approval Workflow          | ⏳      |
| 5    | Realtime Chat (Socket.IO)  | ⏳      |
| 6    | Revoke Connection          | ⏳      |
| 7    | Message Limits             | ⏳      |
| 8    | Timed Connections          | ⏳      |
