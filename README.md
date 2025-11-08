# 🌊 Floe

**Voice-controlled autonomous payments on Arc Testnet**

Live demo: https://floe.onrender.com

---

## What is Floe?

Floe makes blockchain payments actually autonomous. Think of it as having an AI assistant that handles your recurring payments, approves requests based on contract terms, and executes everything automatically using Circle USDC on Arc Testnet.

We built this for the Arc Testnet Hackathon to show what's possible when you combine AI agents with real payment infrastructure.

## The Problem

Right now, even on blockchain, payments require manual work:
- Someone has to approve every transaction
- Cross-chain transfers are painful
- No smart payment logic (just send/receive)
- Real-world stuff like rent payments? Forget automation.

## What We Built

**A2A (Agent-to-Agent) Payments**
AI agents that evaluate payment requests and execute them automatically. Example: landlord sends a rent request, tenant's AI agent checks the contract, verifies wallet balance, and pays on the due date. Zero human clicks.

**Voice AI Control**
Talk to your payment system. "Show my wallets" → it navigates. "Send payment" → it executes. Uses Cloudflare Whisper for speech-to-text and ElevenLabs for responses.

**CCTP Cross-Chain**
Move USDC between Arc, Base, and Polygon seamlessly. Native Circle implementation, no bridges or wrapped tokens.

**Request Center**
Be the landlord or service provider. Create contracts to receive payments, enable A2A mode, send requests. Your customers' AI agents handle the rest.

## Tech Stack

- **Arc Testnet** - Primary blockchain
- **Circle USDC + SDK** - All payments use real USDC and Circle's Web3 Services SDK
- **Cloudflare AI** - LLaMA 3 for agent decisions, Whisper for voice
- **ElevenLabs** - Text-to-speech for voice assistant
- **Node.js + React** - Backend and frontend
- **PostgreSQL** - Database

## Quick Start

**Prerequisites:**
- Node.js 18+
- PostgreSQL (or use Supabase free tier)
- Circle API keys (get from console.circle.com)

**Install:**
```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

**Setup database:**
```bash
# Run the schema
psql -d your_database < database/schema.sql
```

**Environment variables:**
Create a `.env` file in the root:
```
CIRCLE_API_KEY=your_key
CIRCLE_ENTITY_SECRET=your_secret
DATABASE_URL=postgresql://...
PORT=3000
```

**Run it:**
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev
```

Open http://localhost:8080

## Key Features

**Smart Contracts**
Create payment contracts with schedules, amounts, and conditions. Works for rent, subscriptions, invoices, whatever.

**Multi-Wallet**
Manage USDC wallets on Arc, Base, and Polygon. Switch networks, transfer between them.

**A2A Manual Mode**
AI agent evaluates the request, you click to execute. Good for when you want the AI's analysis but final control.

**A2A Auto Mode**
Full autonomous. Agent evaluates and executes. Set it once, forget it.

**Voice Assistant**
Floating bubble on every page. Click, speak, it responds and navigates. Feels futuristic because it is.

**Real-Time Polling**
Transaction status updates automatically. No refreshing needed.

## Project Structure

```
arc-project/
├── backend/          # Node.js API
│   ├── routes/       # All API endpoints
│   ├── services/     # Circle SDK, AI agents, payments
│   └── middleware/   # Auth, validation
├── frontend/         # React app
│   ├── pages/        # All screens
│   └── components/   # UI components + AI assistants
├── workers/          # Cloudflare Worker for AI
└── database/         # SQL schema
```

## Demo Flow

1. Create a wallet on Arc Testnet
2. Get some USDC from Circle faucet
3. Go to Request Center → Create a rent request contract
4. Enable A2A payments (auto mode)
5. Send request to yourself (or another wallet)
6. Watch the AI agent evaluate and execute
7. Try voice commands: "Show my wallets", "Create a contract"

## Hackathon Context

Built for the **AI Agents on Arc with USDC** hackathon (Oct 27 - Nov 9, 2024).

We focused on:
- Real autonomous payments (not just demos)
- Circle's full stack (USDC, SDK, CCTP)
- Voice AI (because why not make payments conversational)
- Arc Testnet native (USDC as gas is amazing)

## Why This Matters

Autonomous payments unlock real use cases:
- Property management companies can automate rent collection
- Businesses can set payment terms once, let AI handle execution
- Cross-border payments become instant and cheap
- Voice control makes crypto accessible to non-technical users

We're not just moving tokens around. We're building infrastructure for how real-world payments should work.

## Deployment

Live on Render: https://floe.onrender.com

(First load might take 30 seconds - free tier cold starts)

## Contributing

This was built in a hackathon sprint. Code isn't perfect. If you want to improve something, PRs welcome.

## License

MIT

---

Built with ☕ for the Arc Testnet Hackathon

**Try it:** https://floe.onrender.com
