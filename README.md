# ConnectX — Consent-First Messaging Platform

> **"No communication without consent."**
> A privacy-focused, hackathon-ready messaging platform where every connection requires mutual approval.

---

## 🌐 Live Demo

| Service | URL |
|---------|-----|
| Frontend | *(your Vercel URL)* |
| Backend | *(your Render URL)* |

---

## 📌 What is ConnectX?

ConnectX is **not** a WhatsApp or Telegram clone.

It is a **consent-first, privacy-focused communication platform** built for people who value digital boundaries. Every single connection, message, and group interaction requires explicit approval from all parties involved.

**Core Philosophy:**
- No phone number required
- No random DMs from strangers
- No forced group additions
- Every connection starts with consent
- Every boundary is enforced by the system

---

## ✨ Features

### 🔐 Authentication
- Secure JWT-based login & registration
- Passwords hashed with bcrypt
- Protected routes on both frontend and backend

---

### 🎟️ Invite Code System
- Generate a **one-time, 100-second** invite code
- Share it with someone you want to connect with
- Code expires automatically after 100 seconds
- Code is invalidated after successful use
- No phone number or username search — privacy first

---

### 🤝 Connection Approval Workflow
- Entering someone's invite code sends a **connection request**
- Receiver can **Approve** or **Reject**
- Connection is created only after approval
- Both parties must consent — no exceptions

---

### 💬 Realtime Private Chat
- 1-to-1 encrypted-feel private messaging
- Powered by **Socket.IO** for realtime delivery
- Typing indicator
- Seen/delivered receipts
- Persistent message history via MongoDB
- Online/Offline status

---

### 🚫 Connection Revoke
- Either party can **revoke** a connection at any time
- Revoked connections immediately block all messaging
- Realtime notification to both parties via socket
- Option to reconnect via new invite code

---

### 📊 Message Limit System
- Set a **daily message limit** for any connection
- Limits: 10 / 20 / 30 / 50 messages per day
- Auto-resets at midnight
- Enforced on both REST API and Socket level
- Anti-spam and anti-harassment tool

---

### 🚷 Block System
- Block a user (stops messages, keeps connection)
- Block + Revoke (removes connection entirely)
- Blocked users cannot message you
- Unblock at any time

---

### 👥 Privacy-Based Group System
- Create consent-first groups
- **No forced additions** — every member must approve joining
- Two join methods:
  - Admin sends invite to connected users → user approves/rejects
  - Share group invite code → user requests to join → admin approves/rejects
- Role system:
  - **Creator (Super Admin):** full control, cannot be removed
  - **Admin:** can invite, approve joins, request member actions
  - **Member:** can chat and share invite link
- Non-creator admin actions (remove/promote) need **creator approval**
- Admin demotion is direct (no approval needed)
- Realtime group messaging via Socket.IO

---

### 💌 Private Chat Request (Group Members)
- Being in the same group does **NOT** grant private messaging access
- Must send a **"Request Private Chat"** from within the group
- Receiver can Approve or Reject
- If approved → private connection created → existing chat system kicks in
- Anti-spam rules:
  - No duplicate pending requests
  - 24-hour cooldown after rejection
  - Requests expire after 7 days
  - Sender can cancel pending request

---

### 🔍 Advanced Group Search
Search inside any group chat with 3 modes:

| Search Type | Description |
|-------------|-------------|
| **By Keyword** | Partial, case-insensitive search across all messages |
| **By Member** | All messages from a specific group member |
| **By Date Range** | Messages within a custom date range |

- Click any result → **auto-scroll** to that message in chat
- Matched keyword is **highlighted** in results
- Backend-powered MongoDB queries (not frontend filtering)

---

### 🎨 Theme System
- **Dark Mode** (default) — premium dark UI
- **Light Mode** — clean modern look
- Theme persists across sessions via localStorage
- Instant toggle with no page refresh

---

### 📱 Mobile Responsive
- Hamburger menu on mobile
- Full-screen sidebar drawer
- Smooth open/close animation
- Works on mobile, tablet, and desktop

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 + Vite | UI Framework |
| React Router v6 | Client-side routing |
| Tailwind CSS | Styling |
| Socket.IO Client | Realtime communication |
| Axios | HTTP requests |
| Lucide React | Icons |

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js + Express | Server framework |
| MongoDB + Mongoose | Database |
| Socket.IO | Realtime events |
| JWT | Authentication |
| bcrypt | Password hashing |

### Infrastructure
| Service | Purpose |
|---------|---------|
| MongoDB Atlas | Cloud database (free tier) |
| Render | Backend hosting (free tier) |
| Vercel | Frontend hosting (free tier) |

---

## 📁 Project Structure

```
connectx/
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── User.js
│   │   ├── InviteCode.js
│   │   ├── Connection.js
│   │   ├── ConnectionRequest.js
│   │   ├── Message.js
│   │   ├── MessageLimit.js
│   │   ├── Block.js
│   │   ├── Group.js
│   │   ├── GroupInvitation.js
│   │   ├── GroupJoinRequest.js
│   │   ├── GroupMessage.js
│   │   ├── AdminActionRequest.js
│   │   └── PrivateChatRequest.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── invite.js
│   │   ├── connections.js
│   │   ├── chat.js
│   │   ├── messageLimit.js
│   │   ├── block.js
│   │   ├── groups.js
│   │   └── privateChat.js
│   ├── socket/
│   │   ├── index.js
│   │   └── socketManager.js
│   ├── .env.example
│   ├── package.json
│   └── server.js
│
└── frontend/
    ├── public/
    ├── src/
    │   ├── components/
    │   │   ├── AppLayout.jsx
    │   │   ├── ProtectedRoute.jsx
    │   │   └── Sidebar.jsx
    │   ├── context/
    │   │   ├── AuthContext.jsx
    │   │   ├── SocketContext.jsx
    │   │   └── ThemeContext.jsx
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── GenerateInvite.jsx
    │   │   ├── EnterInvite.jsx
    │   │   ├── ConnectionRequests.jsx
    │   │   ├── ChatList.jsx
    │   │   ├── ChatWindow.jsx
    │   │   ├── Settings.jsx
    │   │   ├── GroupList.jsx
    │   │   ├── GroupChat.jsx
    │   │   ├── GroupJoin.jsx
    │   │   └── GroupRequests.jsx
    │   ├── utils/
    │   │   └── api.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── tailwind.config.js
    └── package.json
```

---

## 🚀 Local Setup

### Prerequisites
- Node.js v18+
- MongoDB Atlas account (free)
- Git

### 1. Backend setup

```bash
cd backend
npm install
```

Start backend:

```bash
npm run dev
```

### 2. Frontend setup

```bash
cd frontend
npm install
```

Start frontend:

```bash
npm run dev
```

Frontend runs at `http://localhost:3000`
Backend runs at `http://localhost:5000`

---


## 🔒 Security Features

- JWT authentication on all protected routes
- Passwords hashed with bcrypt (salt rounds: 10)
- Invite codes are single-use and time-limited
- All connection actions require mutual consent
- Message limits enforced server-side
- Group membership verified before any group action
- Private chat requests restricted to group members only
- Anti-spam cooldowns on rejected requests

---

## 🗺️ Roadmap

- [ ] End-to-end encryption
- [ ] Media sharing (images, files)
- [ ] Voice/video calls
- [ ] Message reactions
- [ ] Timed connections (auto-expire after N days)
- [ ] Export chat history
- [ ] Progressive Web App (PWA)

---

## 👨‍💻 Built By

**Pritam Chowdhury**

Built for hackathon — consent-first, privacy-focused communication for the modern web.

---

## 📄 License

MIT License — free to use, modify, and distribute.