# 🌊 Floe - Smooth Payment Automation for Real-World Assets

> **Built for the AI Agents on Arc with USDC Hackathon**

Floe automates recurring, conditional, and milestone-based USDC payments for tokenized real-world assets on Arc blockchain. Upload a lease, invoice, or bond contract — our AI reads it, creates payment schedules, and executes transfers automatically using Circle wallets.

**Smooth flow. Zero friction. Effortless automation.**

---

## 🎯 Problem We Solve

Traditional RWA payments (rent, supply chain, treasury yields) are:
- ❌ Manual and error-prone
- ❌ Slow (2-5 business days)
- ❌ Expensive (2-5% fees)
- ❌ Lack transparency

## ✨ Our Solution

- ✅ **AI Contract Parser** - Reads natural language contracts
- ✅ **Automated Scheduling** - CRON-based recurring payments
- ✅ **Conditional Logic** - Evidence-based payment releases
- ✅ **Instant Settlement** - USDC on Arc blockchain (sub-second)
- ✅ **Complete Transparency** - On-chain audit trails

---

## 🚀 Use Cases

1. **🏠 Automated Rent** - Monthly payments for tokenized properties
2. **📦 Supply Chain** - Conditional payments on delivery confirmation
3. **💰 Treasury Bonds** - Scheduled quarterly yield distributions
4. **🏗️ Construction** - Milestone-based contractor payments
5. **⚙️ Equipment Leasing** - Performance-based SLA payments

---

## 🛠️ Tech Stack

- **Frontend:** Vite + React 18 + TypeScript + Tailwind CSS + Radix UI
- **Backend:** Node.js + Express + PostgreSQL
- **AI Agent:** Cloudflare Workers AI (LLaMA 3)
- **Payments:** Circle Developer-Controlled Wallets SDK
- **Blockchain:** Arc EVM Testnet (USDC as gas)
- **Scheduler:** Node-cron for recurring payments

---

## 📦 Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (or Docker)
- Circle Developer Account ([Sign up](https://console.circle.com/))
- Cloudflare Workers Account (optional, for AI features)

---

## 🏗️ Project Structure

```
floe/
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── routes/       # API endpoints (auth, wallet, contract, payment)
│   │   ├── services/     # Business logic (Circle SDK, CRON)
│   │   ├── middleware/   # Auth, validation, error handling
│   │   ├── config/       # Configuration files
│   │   └── utils/        # Helper functions
│   └── tests/            # Backend tests
├── frontend/             # Vite + React dashboard
│   ├── src/
│   │   ├── pages/        # Page components (login, dashboard, contracts)
│   │   ├── components/   # UI components (buttons, cards, forms)
│   │   ├── contexts/     # Auth context
│   │   ├── services/     # API client (Axios)
│   │   └── lib/          # Utilities
│   └── public/           # Static assets
├── workers/              # Cloudflare Workers (AI Agent)
├── database/             # SQL schema and seed data
└── docs/                 # Documentation
```

---

## 🚀 Quick Start

See **[RUN.md](./RUN.md)** for detailed step-by-step instructions!

### 1. Install Dependencies

```bash
# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

### 2. Setup Database with Test Data

**RECOMMENDED: Use Supabase (Free, Managed PostgreSQL)** 🚀

```bash
# See SUPABASE_SETUP.md for detailed guide
# Quick steps:
# 1. Create account at https://supabase.com
# 2. Create new project, save password
# 3. Get connection string from Settings > Database
# 4. Run setup script:

cd database
npm install
node setup-supabase.js "postgresql://postgres:YOUR_PASS@db.xxx.supabase.co:5432/postgres"
```

**Alternative: Local PostgreSQL with Docker**

```bash
# Start PostgreSQL
docker run --name floe-db -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:14

# Create database
docker exec -i floe-db psql -U postgres -c "CREATE DATABASE paymind_rwa"

# Load schema
docker exec -i floe-db psql -U postgres -d paymind_rwa < database/schema.sql

# Load test data (5 users, 6 contracts, 9 transactions!)
docker exec -i floe-db psql -U postgres -d paymind_rwa < database/seed.sql
```

### 3. Create .env File

```bash
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_ENTITY_SECRET=your_circle_entity_secret
DATABASE_URL=postgresql://postgres:password@localhost:5432/paymind_rwa
BLOCKCHAIN_NETWORK=ETH-SEPOLIA
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:8080
```

Full template in **[RUN.md](./RUN.md)**!

### 4. Start Everything

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### 5. Test It!

- Open: **http://localhost:8080**
- Login: `demo@floe.io` / `demo123` (or click "Use Demo Account")
- See 6 contracts, payment schedules, and transactions!

---

## 🎨 Features

### ✅ Complete Authentication
- Login / Signup pages
- JWT-based auth
- Demo account ready

### ✅ Dashboard
- 4 stat cards (contracts, payments, amounts)
- Upcoming payments list
- Recent transactions
- Beautiful gradient UI

### ✅ Contract Management
- List all RWA contracts
- Filter by status
- Create new contracts
- AI contract text parser

### ✅ Payment Automation
- Recurring payments (monthly, quarterly)
- Conditional payments (on delivery)
- Milestone payments (construction)
- CRON scheduler

### ✅ Test Data Included
- 5 user accounts
- 6 sample contracts (rent, supply chain, bonds, construction, leasing)
- 9 transaction records
- 5 tokenized assets

---

## 📚 Documentation

- **[HACKATHON_MASTER_PLAN.md](./HACKATHON_MASTER_PLAN.md)** - 🔥 **COMPLETE HACKATHON GUIDE** (25 sections, A-Z)
  - Everything you need to win the hackathon!
  - Day-by-day build plan
  - Demo script & submission guide
  - Troubleshooting & best practices
- **[RUN.md](./RUN.md)** - Quick start guide (if you just want to run the project)

---

## 🔑 Key Code Examples

### AI Contract Parser
```typescript
// Upload contract text
const contract = "Apartment 405. Rent: $1200 USD. Due: 1st of every month.";

// AI extracts payment logic
{
  amount: 1200,
  currency: "USD",
  frequency: "monthly",
  due_day: 1
}
```

### Automated Scheduling
```typescript
// CRON checks for due payments daily at midnight
cron.schedule('0 0 * * *', () => {
  checkAndExecuteScheduledPayments();
});
```

### Circle Wallet Integration
```typescript
// Create payment with Circle SDK
const payment = await circleClient.createPayment({
  source: { type: 'wallet', id: payerWalletId },
  destination: { type: 'blockchain', address: '0x...' },
  amount: { amount: '1200.00', currency: 'USD' },
  blockchain: 'ARC-TESTNET'  // or ETH-SEPOLIA for testing
});
```

---

## 🧪 Testing

```bash
# Test Circle integration
cd backend && npm run test:circle

# Run all tests
npm test

# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

---

## 🚀 Deployment

### Frontend (Vercel)
```bash
cd frontend
npm run build
vercel --prod
```

### Backend (Railway / Render)
```bash
cd backend
npm run build
# Deploy via Railway CLI or connect GitHub repo
```

### Cloudflare Workers (AI Agent)
```bash
cd workers
wrangler login
wrangler deploy
```

---

## 🏆 Hackathon Submission

- **Event:** AI Agents on Arc with USDC
- **Track:** Payments for Real-World Assets (RWA)
- **Dates:** October 27 - November 9, 2025
- **Submission:** November 8, 2025

### What Makes Floe Stand Out

✅ **RWA Track Focus** - Underserved vs DeFi/tipping  
✅ **Multiple Payment Types** - Recurring + Conditional + Milestone  
✅ **AI Innovation** - Natural language contract parser  
✅ **Complete Implementation** - Not mockups, real working code  
✅ **5 Use Cases** - Shows versatility and business value  
✅ **Enterprise Ready** - B2B positioning with audit trails  

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) file

---

## 🤝 Contributing

This project was built for a hackathon. Post-hackathon contributions welcome:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Contact

- **GitHub:** [github.com/your-team/floe](https://github.com/your-team/floe)
- **Demo:** [floe.vercel.app](https://floe.vercel.app) (coming soon)
- **Email:** team@floe.io

---

## 🙏 Acknowledgments

- **Circle** - For USDC infrastructure and Arc blockchain
- **Cloudflare** - For Workers AI platform
- **lablab.ai** - For hosting the hackathon
- **Our mentors** - For guidance and support

---

**Built with ❤️ for the AI Agents on Arc with USDC Hackathon**

## 🌊 *Floe - Where payments flow smoothly* 🚀
"# Floe" 
