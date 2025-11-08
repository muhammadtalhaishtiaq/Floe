# 🤖 A2A Payment System - Complete Testing Scenarios

## 🎯 **5 Core Use Cases for Testing**

---

### **Use Case 1: Contract-Initiated A2A Payment**
**Scenario**: Monthly rent contract with autonomous payments

**Flow**:
1. **Create Contract**
   - Go to Contracts page → "Create New Contract"
   - Fill in: Title: "Monthly Rent", Amount: $500, Frequency: Monthly
   - Save contract

2. **Enable A2A**
   - Open Contract Detail page
   - Find "Quick Actions" card
   - Click "🤖 Enable A2A Payments" button
   - System enables A2A (default: manual approval mode)
   - Button changes to "✓ Active" (green badge)

3. **Payment Request (Simulate)**
   - Landlord's agent sends payment request
   - Notification appears: "Payment requested by landlord"

4. **User Actions**
   - Go to `/a2a` page
   - See pending request in "Incoming Requests" tab
   - Choose:
     - ✅ **Approve & Pay** - Agent verifies and executes
     - ❌ **Reject** - Decline payment
     - 💬 **Contact** - Dispute with landlord

5. **Confirmation**
   - Payment executes automatically
   - Both parties get confirmation
   - Activity log updated

**Where to Check**:
- ✅ Contract Detail: "Enable A2A" button → "A2A Enabled" badge
- ✅ Contract List: Shows which contracts have A2A enabled
- ✅ Sidebar: Badge count updates (🔴 1)
- ✅ Dashboard: A2A stats updated
- ✅ A2A Page: Request appears in "Incoming" tab

---

### **Use Case 2: Manual Review of A2A Requests**
**Scenario**: User wants to approve each payment manually

**Flow**:
1. **Landlord Agent Sends Request**
   - Payment request created for $500 rent
   - Status: `pending`

2. **Notification**
   - Red badge appears on "🤖 A2A Payments" menu (🔴 2)
   - User clicks on menu item

3. **Review Request**
   - Go to `/a2a` page
   - See pending request card:
     ```
     Amount: $500 USDC
     From: Landlord contract
     Reason: Monthly rent - January 2025
     Network: ARC-TESTNET
     ```

4. **User Actions**:
   - ✅ **Approve & Pay** - Instant payment via Circle SDK
   - ❌ **Reject** - Decline payment with reason
   - 💬 **Contact landlord** - Open dispute channel

5. **After Action**:
   - If approved: Payment executes → TX hash shown
   - If rejected: Status changes to `rejected`
   - Activity log updated with agent reasoning

**Where to Check**:
- ✅ A2A Page: "Incoming Requests" tab - list of pending requests
- ✅ Sidebar: Badge with count of pending (🔴 2)
- ✅ Dashboard: A2A widget shows "Pending Requests: 2"
- ✅ Activity Log: Agent reasoning displayed

---

### **Use Case 3: Track A2A Payment History**
**Scenario**: View all autonomous payments

**Flow**:
1. **Navigate to A2A Page** (`/a2a`)

2. **Tabs Available**:
   - **📥 Incoming** - Payments requested from you
   - **📤 Outgoing** - Payments you requested
   - **📜 Activity Log** - Timeline of all agent actions
   - **⏳ Upcoming Payments** - Scheduled future payments

3. **Filter Options**:
   - **Status**: Pending, Approved, Paid, Rejected
   - **Date**: Last 7 days, 30 days, All time
   - **Contract**: Specific contract filter

4. **View Details**:
   - Click on any payment
   - See full details:
     - Transaction hash
     - When requested
     - When approved/paid
     - Circle payment ID
     - Agent reasoning (if available)

**Where to Check**:
- ✅ A2A Page: Complete history with filters
- ✅ Contract Detail: A2A payments for this specific contract
- ✅ Dashboard: Recent A2A activity widget
- ✅ Activity Log: Timeline view with agent reasoning

---

### **Use Case 4: Schedule Next A2A Payment**
**Scenario**: See when next autonomous payment is due

**Flow**:
1. **Contract with A2A Enabled**
   - Go to Contract Detail page
   - Contract has `a2a_enabled: true`

2. **Payment Schedule Section**:
   ```
   Last Payment: Jan 1, 2025 - $500 ✅
   Next Payment: Feb 1, 2025 - $500 ⏳
   Status: Scheduled (Agent will request automatically)
   ```

3. **User Options**:
   - See full payment schedule
   - Disable A2A for future payments
   - Change approval settings:
     - **Manual** - Requires user approval each time
     - **Auto** - Agent approves automatically based on contract terms

4. **Automatic Trigger**:
   - On payment date, agent automatically:
     - Creates payment request
     - Evaluates against contract terms
     - If `auto` mode: Approves and executes payment
     - If `manual` mode: Notifies user for approval

**Where to Check**:
- ✅ Contract Detail: Payment schedule section
- ✅ A2A Page: "Upcoming Payments" tab
- ✅ Dashboard: Next payment countdown widget

---

### **Use Case 5: Agent Communication Log**
**Scenario**: See all agent interactions and reasoning

**Flow**:
1. **Navigate to A2A Page** → **Activity Log** tab

2. **Timeline View**:
   ```
   🤖 Jan 1, 2025 10:00 AM
   Landlord agent requested $500 payment
   
   ✅ Jan 1, 2025 10:01 AM
   Tenant agent verified contract terms
   [Agent Reasoning]
   "Payment amount ($500) matches contract terms exactly.
   Due date is correct (1st of month). Wallet address verified.
   Auto-approving as per contract settings."
   
   💸 Jan 1, 2025 10:02 AM
   Payment executed: $500 USDC
   TX: 0xabc...123
   
   📧 Jan 1, 2025 10:03 AM
   Both agents notified: Payment complete
   ```

3. **Agent Reasoning Box**:
   - Purple box with agent's decision logic
   - Shows why payment was approved/rejected
   - Displays AI analysis (if Cloudflare AI enabled)
   - Fallback shows rule-based decision

**Where to Check**:
- ✅ A2A Page: "Activity Log" section
- ✅ Contract Detail: Recent A2A activity
- ✅ Dashboard: Recent agent actions widget

---

## 🧪 **Testing Checklist**

### **1. Frontend UI Tests**

#### **Contract Detail Page**:
- [ ] "Enable A2A Payments" button visible for active contracts
- [ ] Button shows loading state when enabling
- [ ] Button changes to "A2A Enabled ✓ Active" after enabling
- [ ] A2A info card shows when A2A is disabled
- [ ] Info card hides when A2A is enabled
- [ ] Disable button works and reverts status

#### **A2A Page**:
- [ ] All 4 tabs render correctly
- [ ] "Incoming Requests" tab shows pending requests
- [ ] "Outgoing Requests" tab shows sent requests
- [ ] "Activity Log" tab displays timeline
- [ ] "Upcoming Payments" tab shows scheduled payments
- [ ] Empty state shown when no data
- [ ] Request cards display all fields correctly
- [ ] Agent reasoning box appears when available

#### **Dashboard**:
- [ ] A2A widget displays correctly
- [ ] Pending Requests count updates
- [ ] Approved Today count updates
- [ ] Active Agents count updates
- [ ] "View All" link navigates to `/a2a`
- [ ] Recent activity section shows latest actions

#### **Sidebar**:
- [ ] "🤖 A2A Payments" menu item visible
- [ ] Badge shows pending count
- [ ] Badge updates every 30 seconds
- [ ] Clicking navigates to `/a2a` page

---

### **2. Backend API Tests**

#### **Enable/Disable A2A**:
```bash
# Enable A2A
POST /api/a2a/contracts/:id/enable-a2a
Body: { "approvalMode": "manual" }
Expected: 200 OK, contract.a2a_enabled = true

# Disable A2A
POST /api/a2a/contracts/:id/disable-a2a
Expected: 200 OK, contract.a2a_enabled = false
```

#### **Get A2A Requests**:
```bash
# Get all pending requests
GET /api/a2a/requests?status=pending&limit=50
Expected: 200 OK, array of requests with contract_title

# Get specific contract requests
GET /api/a2a/requests?contractId=123&limit=50
Expected: 200 OK, filtered requests
```

#### **Agent Decision**:
```bash
# Agent evaluates payment
POST /api/a2a/decide
Body: {
  "contractId": "123",
  "paymentRequest": {
    "amount": "500",
    "fromAddress": "0xabc...",
    "toAddress": "0xdef...",
    "network": "ARC-TESTNET",
    "description": "Monthly rent"
  }
}
Expected: 200 OK, decision object with reasoning
```

#### **Activity Log**:
```bash
# Get all activity
GET /api/a2a/activity-log?limit=50
Expected: 200 OK, array of activities with timestamps

# Get contract-specific activity
GET /api/a2a/activity-log?contractId=123&limit=50
Expected: 200 OK, filtered activities
```

---

### **3. Integration Tests**

#### **Full Flow: Enable A2A → Request → Approve → Pay**:
1. [ ] Create contract
2. [ ] Enable A2A via button click
3. [ ] Create mock payment request
4. [ ] Agent evaluates request
5. [ ] User approves payment
6. [ ] Payment executes via Circle SDK
7. [ ] Activity log updated
8. [ ] All UI components reflect changes

#### **Full Flow: Auto-Approval Mode**:
1. [ ] Enable A2A with `approvalMode: 'auto'`
2. [ ] Create payment request
3. [ ] Agent auto-evaluates
4. [ ] If approved: Payment executes immediately
5. [ ] If rejected: User notified with reasoning

---

### **4. AI Agent Decision Tests**

#### **Test Cases**:
- [ ] **Exact Match**: Amount, address, date all match → **APPROVED**
- [ ] **Amount Mismatch**: $500 expected, $600 requested → **REJECTED**
- [ ] **Wrong Address**: Different counterparty → **REJECTED**
- [ ] **Outside Date Range**: Payment before/after contract dates → **REJECTED**
- [ ] **Manual Mode**: Always returns approval required → **PENDING**
- [ ] **AI Reasoning**: Cloudflare AI provides nuanced reasoning (if enabled)
- [ ] **Fallback**: Rule-based decision works when AI unavailable

---

### **5. Database Tests**

#### **Check A2A Fields**:
```sql
-- Verify A2A columns added to rwa_contracts
SELECT id, title, a2a_enabled, a2a_approval_mode FROM rwa_contracts;

-- Verify A2A requests table
SELECT * FROM a2a_requests WHERE status = 'pending';

-- Verify activity log
SELECT * FROM a2a_requests WHERE agent_decision_log IS NOT NULL;
```

---

## 🚀 **How to Run Tests**

### **1. Start Backend**:
```bash
cd backend
npm run dev
```

### **2. Start Frontend**:
```bash
cd frontend
npm run dev
```

### **3. Run Database Migration**:
```bash
cd backend
npm run migrate
```

### **4. Test Sequence**:

#### **A. Enable A2A on Contract**:
1. Login → Dashboard
2. Go to Contracts → Select a contract
3. Click "Enable A2A Payments"
4. ✅ Check: Button changes to "A2A Enabled ✓ Active"

#### **B. Create Mock Payment Request**:
Use Postman/Thunder Client:
```json
POST http://localhost:3000/api/a2a/request
Headers: { "Authorization": "Bearer YOUR_TOKEN" }
Body: {
  "contractId": "YOUR_CONTRACT_ID",
  "amount": "500",
  "description": "Monthly rent - Test",
  "fromWalletId": "YOUR_WALLET_ID",
  "toWalletAddress": "0x8cb0a289928f88ab90291758513208f344e8354d",
  "network": "ARC-TESTNET"
}
```

#### **C. Check UI Updates**:
1. ✅ Sidebar badge shows count (🔴 1)
2. ✅ Dashboard A2A widget shows pending: 1
3. ✅ Go to A2A page → See request in "Incoming" tab

#### **D. Agent Decision Test**:
```json
POST http://localhost:3000/api/a2a/decide
Body: {
  "contractId": "YOUR_CONTRACT_ID",
  "paymentRequest": {
    "amount": "500",
    "fromAddress": "0xabc...",
    "toAddress": "0xdef...",
    "network": "ARC-TESTNET",
    "description": "Monthly rent"
  }
}
```
✅ Check: Response contains `approved: true/false` and `reasoning`

#### **E. Activity Log Test**:
1. Go to A2A page → "Activity Log" tab
2. ✅ Check: Timeline shows all actions
3. ✅ Check: Agent reasoning displayed in purple box

---

## 🎬 **Demo Video Script**

### **Scene 1: Dashboard Overview (0:00-0:30)**
- Show dashboard with A2A widget
- Point out "Pending Requests: 0", "Active Agents: 0"
- Click "View All" → Navigate to A2A page

### **Scene 2: Enable A2A on Contract (0:30-1:00)**
- Navigate to Contracts page
- Open a contract detail
- Show "Enable A2A Payments" button
- Click button → Show loading state
- Show success: "A2A Enabled ✓ Active"

### **Scene 3: Simulate Payment Request (1:00-1:30)**
- Use Postman to create payment request
- Show sidebar badge update (🔴 1)
- Show dashboard stats update

### **Scene 4: Agent Decision & Approval (1:30-2:30)**
- Go to A2A page
- Show request in "Incoming Requests" tab
- Click "Approve & Pay"
- Show agent reasoning in activity log
- Show payment execution

### **Scene 5: Activity Log Timeline (2:30-3:00)**
- Navigate to "Activity Log" tab
- Show timeline with all actions
- Point out agent reasoning box
- Show transaction hash link

---

## 💡 **Key Features to Highlight**

1. **🤖 AI Agent Decision-Making**
   - Cloudflare LLaMA 3 integration
   - Rule-based fallback
   - Transparent reasoning

2. **🔗 Circle SDK Integration**
   - CCTP cross-chain transfers
   - Real-time transaction status
   - Secure wallet operations

3. **🎨 Beautiful UI/UX**
   - Consistent design across all pages
   - Dark mode support
   - Real-time updates

4. **📊 Comprehensive Dashboard**
   - Live A2A stats
   - Payment history
   - Activity timeline

5. **🔒 Security & Transparency**
   - User authorization checks
   - Contract ownership verification
   - Full activity logging

---

## ✅ **Success Criteria**

- [ ] User can enable A2A on any active contract
- [ ] Payment requests appear in A2A page
- [ ] Agent evaluates requests correctly
- [ ] User can approve/reject requests manually
- [ ] Auto-approval mode works for matching payments
- [ ] Activity log shows all agent actions
- [ ] Dashboard widgets display real-time stats
- [ ] Sidebar badge updates with pending count
- [ ] All UI components are theme-consistent
- [ ] Agent reasoning is displayed transparently

---

## 🎉 **Ready to WIN! 🏆**

With this comprehensive A2A system, you have:
- ✅ Full frontend-to-backend integration
- ✅ AI-powered agent decision-making
- ✅ Real-time UI updates
- ✅ Complete activity logging
- ✅ Beautiful, consistent design
- ✅ Transparent agent reasoning

**LET'S WIN THIS HACKATHON! 🚀**

