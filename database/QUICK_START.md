# ⚡ Quick Start - Supabase Setup

## 🚀 3 Steps to Get Started

### **Step 1: Create Supabase Project** (2 min)

1. Go to: https://supabase.com
2. Sign up (use GitHub for fastest signup)
3. Click "New Project"
4. Fill in:
   - Name: `floe-rwa`
   - Password: Generate strong password (SAVE IT!)
   - Region: Choose closest to you
5. Wait 2-3 minutes for provisioning

---

### **Step 2: Get Connection String** (1 min)

1. In Supabase dashboard → Settings → Database
2. Copy "Connection string"
3. Replace `[YOUR-PASSWORD]` with your actual password

Example:
```
postgresql://postgres:MyPass123@db.xxx.supabase.co:5432/postgres
```

---

### **Step 3: Setup Database** (2 min)

**Option A: Using the Script** ⚡

```bash
cd database
npm install
node setup-supabase.js "YOUR_CONNECTION_STRING_HERE"
```

**Option B: Manual (Supabase Dashboard)**

1. Go to SQL Editor
2. Open `database/schema.sql`, copy all, paste, run
3. Open `database/seed.sql`, copy all, paste, run

---

## ✅ That's It!

Update your `.env`:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxx.supabase.co:5432/postgres
USE_MOCK_AUTH=false
```

Test it:

```bash
cd backend
npm run dev
```

Login with: **demo@floe.io** / **demo123**

---

**Total Time: ~5-7 minutes** ⏱️

See `SUPABASE_SETUP.md` for detailed guide with troubleshooting.

