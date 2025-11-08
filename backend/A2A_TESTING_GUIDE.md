# 🤖 A2A Testing Guide

## Quick Start

### 1. **Backend is Running** ✅
Your backend should now have A2A routes available at:
- `POST /api/a2a/request` - Create payment request
- `POST /api/a2a/process` - Process payment
- `POST /api/a2a/verify` - Verify payment
- `GET /api/a2a/status/:id` - Get status

### 2. **Test with cURL**

#### **Create Payment Request:**
```bash
curl -X POST http://localhost:3000/api/a2a/request \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contractId": "test-123",
    "amount": "10",
    "description": "Test payment",
    "toWalletAddress": "0x8cb0a289928f88ab90291758513208f344e8354d",
    "network": "ARC-TESTNET"
  }'
```

#### **Process Payment:**
```bash
curl -X POST http://localhost:3000/api/a2a/process \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentRequest": { ...from above },
    "walletId": "your-wallet-id",
    "autoApprove": true
  }'
```

### 3. **Test with Frontend**

Add this button to your Wallets page:

```typescript
<Button onClick={async () => {
  const response = await fetch('http://localhost:3000/api/a2a/request', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contractId: 'test-123',
      amount: '10',
      description: 'Test A2A payment',
      toWalletAddress: '0x8cb0a289928f88ab90291758513208f344e8354d',
      network: 'ARC-TESTNET'
    })
  });
  const data = await response.json();
  console.log('A2A Request:', data);
}}>
  🤖 Test A2A Payment
</Button>
```

## Expected Flow

1. **Landlord Agent** creates payment request
2. **System** returns x402 payment requirements
3. **Tenant Agent** receives request
4. **Tenant Agent** verifies against contract
5. **Tenant Agent** processes payment via Circle
6. **Both agents** receive confirmation

## Database Check

To verify the table was created:

```sql
-- Check if table exists
SELECT * FROM a2a_requests LIMIT 1;

-- View table structure
\d a2a_requests
```

## Next Steps

1. ✅ Backend running with A2A routes
2. ⏳ Test API endpoints
3. ⏳ Add UI integration
4. ⏳ Connect to payment scheduler
5. ⏳ Full autonomous demo

## Troubleshooting

**If routes don't work:**
- Check backend logs for errors
- Verify server.ts has `app.use('/api/a2a', a2aRoutes)`
- Ensure authentication token is valid

**If payment fails:**
- Check wallet has sufficient USDC
- Verify wallet address is correct
- Check Circle API credentials

## Demo Script

**"Watch this - our AI agents can pay each other autonomously!"**

1. Show payment request creation
2. Show automatic verification
3. Show payment execution
4. Show both wallets updated
5. **No human clicks needed!** 🤖✨

