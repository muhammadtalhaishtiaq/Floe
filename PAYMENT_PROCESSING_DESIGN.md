# 💰 PAYMENT PROCESSING SYSTEM DESIGN

## 🎯 OVERVIEW

Our RWA payment system needs to handle both **manual** and **automated** payments with Circle's Developer-Controlled Wallets on Arc blockchain.

---

## 📊 PAYMENT FLOW ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTRACT REGISTRATION                         │
├─────────────────────────────────────────────────────────────────┤
│  1. User creates contract with:                                 │
│     - Payment type: one_time | monthly | quarterly | yearly     │
│     - Amount: 1200 USDC                                          │
│     - Payment day: 1st of each month                            │
│     - Start date: 2025-11-01                                     │
│     - End date: 2026-11-01 (optional)                           │
│                                                                  │
│  2. Backend creates:                                             │
│     ✅ rwa_contracts record (status: active)                    │
│     ✅ payment_schedules record (if recurring)                  │
│        - next_payment_date: 2025-12-01                          │
│        - status: active                                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    PAYMENT EXECUTION TYPES                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TYPE 1: MANUAL EXECUTION (Already Working!)                    │
│  ────────────────────────────────────────────                   │
│  • User clicks "Execute Payment" button                         │
│  • Frontend → POST /api/payments/execute                        │
│  • Backend → Circle API → USDC transfer                         │
│  • Record in transactions table                                 │
│  • Poll for confirmation                                         │
│                                                                  │
│  TYPE 2: AUTOMATED RECURRING (Need to Build!)                   │
│  ────────────────────────────────────────────────────           │
│  • Cron job runs every hour                                     │
│  • Checks payment_schedules for due payments                    │
│  • Auto-executes via Circle API                                 │
│  • Updates next_payment_date                                    │
│  • Sends notification to user                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

---

## 🔄 AUTOMATED PAYMENT PROCESSOR

### **Cron Job Schedule:**
```javascript
// Runs every hour
'0 * * * *' → Check for due payments

// OR more aggressive for demo:
'*/5 * * * *' → Check every 5 minutes
```

### **Payment Processing Logic:**

```sql
-- Find all due payments
SELECT ps.*, c.*, u.circle_wallet_id as payer_wallet
FROM payment_schedules ps
JOIN rwa_contracts c ON ps.contract_id = c.id
JOIN users u ON c.payer_id = u.id
WHERE ps.status = 'active'
  AND ps.next_payment_date <= NOW()
  AND c.status = 'active'
```

### **For Each Due Payment:**
1. Get payer's primary wallet
2. Get payee wallet address from contract
3. Execute Circle payment
4. Record transaction
5. Update next_payment_date:
   - Monthly: Add 1 month
   - Quarterly: Add 3 months
   - Yearly: Add 1 year
6. Check if contract end_date reached → Mark completed
7. Send notification

---

## 📅 NEXT PAYMENT DATE CALCULATION

```javascript
function calculateNextPaymentDate(
  currentDate: Date,
  frequency: string,
  dayOfMonth?: number
): Date {
  const next = new Date(currentDate);
  
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    
    case 'bi_weekly':
      next.setDate(next.getDate() + 14);
      break;
    
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      if (dayOfMonth) {
        next.setDate(dayOfMonth);
      }
      break;
    
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  
  return next;
}
```

---

## 🗄️ DATABASE SCHEMA

### **payment_schedules Table:**
```sql
CREATE TABLE payment_schedules (
  id UUID PRIMARY KEY,
  contract_id UUID REFERENCES rwa_contracts(id),
  payer_wallet_id TEXT NOT NULL,
  payee_wallet_id TEXT NOT NULL,
  amount_usdc DECIMAL(18,6) NOT NULL,
  frequency TEXT NOT NULL, -- daily, weekly, monthly, quarterly, yearly
  next_payment_date TIMESTAMP NOT NULL,
  last_payment_date TIMESTAMP,
  status TEXT DEFAULT 'active', -- active, paused, completed, failed
  failure_count INT DEFAULT 0,
  conditions JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **transactions Table:**
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  contract_id UUID REFERENCES rwa_contracts(id),
  schedule_id UUID REFERENCES payment_schedules(id),
  tx_hash TEXT,
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  amount_usdc DECIMAL(18,6) NOT NULL,
  type TEXT NOT NULL, -- scheduled, manual, conditional
  status TEXT DEFAULT 'pending', -- pending, confirmed, failed
  circle_payment_id TEXT,
  metadata JSONB,
  executed_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🚀 IMPLEMENTATION PLAN

### **Phase 1: Auto-Create Payment Schedules** ✅
- [x] Update contract registration to create payment_schedules
- [x] Only for recurring contracts (monthly, quarterly, yearly)
- [x] Calculate first next_payment_date

### **Phase 2: Automated Payment Processor** ⏳
- [ ] Create `/backend/src/jobs/payment-processor.ts`
- [ ] Use `node-cron` for scheduling
- [ ] Query due payments
- [ ] Execute via Circle API
- [ ] Update schedules
- [ ] Handle failures (retry logic)

### **Phase 3: Manual Payment Enhancement** ⏳
- [ ] Link manual payments to schedules
- [ ] Update next_payment_date when manual payment made
- [ ] Show "Next Payment Due" on contract detail page

### **Phase 4: Notifications** ⏳
- [ ] Email/Push notifications for:
  - Payment due in 3 days
  - Payment executed successfully
  - Payment failed
  - Low balance warning

---

## 🎯 FOR HACKATHON DEMO

### **What Judges Will See:**

1. **Create Recurring Contract**
   - Monthly rent: 1200 USDC
   - Payment day: 1st of month
   - Duration: 12 months

2. **Automated Execution**
   - Cron job runs every 5 minutes (demo mode)
   - Auto-executes when due
   - Shows real transaction on Arc testnet

3. **Real-Time Updates**
   - Transaction status polling
   - Balance updates
   - Payment history

4. **Dashboard Shows:**
   - Upcoming payments (next 30 days)
   - Payment history with Arc explorer links
   - Contract status (active, paused, completed)

---

## 💡 KEY FEATURES FOR WINNING

1. **Real Blockchain Transactions** ✅
   - Actual USDC transfers on Arc testnet
   - Verifiable on Arc scanner

2. **Smart Automation** ⏳
   - Set it and forget it
   - Handles monthly/quarterly/yearly automatically

3. **Failure Handling** ⏳
   - Retry failed payments (3 attempts)
   - Pause schedule after 3 failures
   - Notify user

4. **Flexibility** ✅
   - Manual override anytime
   - Pause/resume schedules
   - Cancel contracts

5. **Transparency** ✅
   - Full payment history
   - Blockchain verification
   - Real-time status updates

---

## 🔧 TECHNICAL STACK

- **Blockchain:** Arc Testnet (Circle's L1)
- **Payments:** Circle Developer-Controlled Wallets
- **Scheduling:** node-cron
- **Database:** PostgreSQL (Supabase)
- **Real-time:** Polling (5s intervals)
- **Notifications:** Email (SendGrid) / Push (optional)

---

**Status:** Ready to implement Phase 2 (Automated Processor)
**Priority:** HIGH - Core hackathon feature
**Estimated Time:** 2-3 hours for full implementation

