# 🚀 Developer Guide – Running ClassLens Locally

Hey dev, here’s how to get this project up and running on your machine. Follow these steps carefully, and you’ll have both the backend (Flask + Postgres) and frontend (Vite + React) live in no time.

---

## 1️⃣ Clone the repo
If you already have the code on your machine, skip this. Otherwise:

```bash
git clone https://github.com/Jibex-Banks/Ai-Attendance-Manager
cd Ai-Attendance-Manager
```

---

## 2️⃣ Backend Setup (Flask + PostgreSQL)

### Step 1: Create a virtual environment
```bash
cd backend
python -m venv venv
# activate it
venv\Scripts\activate   # on Windows
source venv/bin/activate  # on Mac/Linux
```

### Step 2: Install dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Database setup
Make sure PostgreSQL is running. Create a DB (e.g. `attendancedb`):

```sql
CREATE DATABASE attendancedb;
```

Set up your `.env` file inside `backend/`:
```
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/attendancedb
```

### Step 4: Initialize tables
```bash
flask --app app init-db
```

### Step 5: Run the backend server
```bash
python app.py
```

If all is well, backend runs on 👉 `http://localhost:3000`

---

## 3️⃣ Frontend Setup (Vite + React)

### Step 1: Install dependencies
Open another terminal (keep backend running), then:
```bash
cd frontend
npm install
```

### Step 2: Add environment variable
Create `.env` in `frontend/`:
```
VITE_API_BASE=http://localhost:3000
```

This way, frontend knows where the backend lives.

### Step 3: Run Vite dev server
```bash
npm run dev
```

Frontend will run at 👉 `http://localhost:5173`

---

## 4️⃣ Key Features you can test right away
- **Register Student**: Upload student info and passport (or base64).
- **Live Scanner**: Use your webcam to capture and mark attendance.
- **Attendance Records**: View list of marked attendances in real time.
- **Reports**: Generate and export CSV reports.
- **SSE (Server-Sent Events)**: See new attendance show up instantly without refreshing.

---

## 5️⃣ Common Issues & Fixes
- ❌ `process is not defined` → You’re using Vite, so always use `import.meta.env.VITE_API_BASE`.
- ❌ `Cannot destructure 'basename' of useContext(...)` → Make sure `<BrowserRouter>` is only in `main.jsx`.
- ❌ Missing dependencies → run `npm install` or `pip install -r requirements.txt` again.
- ❌ DB errors → confirm PostgreSQL is running and `DATABASE_URL` is correct.

---

## 6️⃣ Stopping everything
- Stop the backend: `CTRL + C` in that terminal.
- Stop the frontend: `CTRL + C` in that terminal.
- Deactivate virtualenv: `deactivate`

---

💡 That’s it — you’ve got ClassLens running locally!
Now you can hack, tweak, or extend the system however you like.
