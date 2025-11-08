# Floe Frontend

Beautiful, modern UI for Floe - AI-Powered RWA Payment Automation.

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** (Fast dev server & builds)
- **React Router v6** (Client-side routing)
- **Tailwind CSS** (Utility-first styling)
- **Radix UI** (Accessible component primitives)
- **Axios** (HTTP client for API calls)
- **TanStack Query** (Data fetching & caching)
- **Sonner** (Toast notifications)
- **Lucide React** (Icons)

## Features

✅ **Authentication** - Login/Signup with JWT tokens  
✅ **Protected Routes** - Dashboard pages require login  
✅ **Dashboard** - Stats, upcoming payments, recent transactions  
✅ **Contracts** - View & manage RWA contracts  
✅ **Payments** - Payment history & scheduling  
✅ **Wallets** - Circle USDC wallet management  
✅ **Settings** - User profile, security, API keys  
✅ **Responsive Design** - Mobile & desktop  
✅ **Mint Fresh Branding** - Unique green color palette  

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API URL (Optional)

The frontend connects to `http://localhost:3000/api` by default.

To change this, create a `.env.local` file:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

### 3. Start Development Server

```bash
npm run dev
```

Frontend will run on **http://localhost:8080**

### 4. Login with Demo Account

- **Email:** `demo@floe.io`
- **Password:** `demo123`

Or click **"Use Demo Account"** button on login page.

## Backend Connection

### Make Sure Backend is Running

```bash
cd ../backend
npm run dev
```

Backend should be running on **http://localhost:3000**

### API Endpoints Used

The frontend connects to these backend endpoints:

- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `GET /api/contracts` - Get all contracts
- `GET /api/payments` - Get all payments
- `GET /api/wallets` - Get all wallets
- `POST /api/wallets/create` - Create new wallet
- ... and more (see `src/services/api.ts`)

## Project Structure

```
frontend/
├── public/              # Static assets
├── src/
│   ├── assets/          # Images, icons
│   ├── components/      # Reusable UI components
│   │   ├── ui/          # Radix UI primitives
│   │   ├── Logo.tsx
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   └── ProtectedRoute.tsx
│   ├── contexts/        # React contexts
│   │   └── AuthContext.tsx
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities
│   ├── pages/           # Page components
│   │   ├── Index.tsx    # Landing page
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Contracts.tsx
│   │   ├── Payments.tsx
│   │   ├── Wallets.tsx
│   │   └── SettingsPage.tsx
│   ├── services/        # API service layer
│   │   └── api.ts       # Axios instance & API functions
│   ├── App.tsx          # Root component with routing
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles & design system
├── package.json
└── vite.config.ts
```

## Build for Production

```bash
npm run build
```

Output will be in `dist/` folder.

## Available Scripts

- `npm run dev` - Start development server (port 8080)
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Authentication Flow

1. User enters email/password on `/login`
2. Frontend calls `POST /api/auth/login` with credentials
3. Backend validates and returns JWT token + user data
4. Token stored in `localStorage`
5. Token automatically added to all API requests
6. Protected routes check for valid token
7. If token invalid/missing → redirect to `/login`

## Colors (Mint Fresh Palette)

- **Primary:** `#34D399` (Mint Green)
- **Secondary:** `#10B981` (Emerald)
- **Accent:** `#10B981` (Emerald)
- **Success:** `#059669` (Forest Green)

## Notes

- All data is fetched from backend API (no mock data)
- Requires backend running on port 3000
- Uses PostgreSQL database (via backend)
- Circle SDK integration (via backend)
- JWT authentication for security

## Troubleshooting

**Login fails:**
- Check if backend is running
- Check if database is set up (see `../database/schema.sql`)
- Check if demo user exists in database

**API calls fail:**
- Check browser console for errors
- Verify backend is running on port 3000
- Check CORS is enabled in backend

**Blank page:**
- Check browser console
- Run `npm install` to ensure dependencies installed
- Clear localStorage and refresh

## Support

For issues or questions, check:
- `../DOCS.md` - Full project documentation
- `../RUN.md` - How to run the complete project

---

Built with 💚 for the Circle x Arc Hackathon 2025
