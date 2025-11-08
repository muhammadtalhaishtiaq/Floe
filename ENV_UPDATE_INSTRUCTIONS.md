# 🚨 **CRITICAL: Update Your .env File NOW!**

## ⚠️ **Why This Matters:**
- We moved from **hardcoded** blockchain to **environment variables**
- You can now **switch networks** without code changes
- All transactions will show up in **Circle Dashboard** with correct network

---

## **📝 Update Root `.env` File**

Add this to your **root `.env`** file (at project root level):

```bash
# =============================================
# BLOCKCHAIN CONFIGURATION
# =============================================

# Network to use for Circle wallets and payments
# Options: ARC-TESTNET, MATIC-AMOY, ETH-SEPOLIA
BLOCKCHAIN_NETWORK=ARC-TESTNET

# USDC Token ID (optional - defaults to 'USDC')
# Get this from Circle Dashboard for your specific network
USDC_TOKEN_ID=

# Frontend also needs this (Vite requires VITE_ prefix)
VITE_BLOCKCHAIN_NETWORK=ARC-TESTNET
```

---

## **🔍 How to Test:**

### **1. Check Backend Logs:**
When you create a wallet, you should see:
```
Creating wallet in set xyz on blockchain: ARC-TESTNET
✅ Wallet created: wallet-id at address: 0x... on ARC-TESTNET
```

### **2. Check Circle Dashboard:**
- Go to: https://console.circle.com/wallets
- Your wallets should show **Arc Testnet** network
- Transactions should appear under **Arc Testnet**

### **3. Check Frontend:**
- Contract detail page should show: **"Arc Testnet"**
- Explorer button should open: **https://testnet.arcscan.app/**

---

## **⚠️ If Arc Doesn't Work Yet:**

The code includes **automatic fallback**:
- If Circle SDK doesn't support `ARC-TESTNET` yet
- It will automatically use `MATIC-AMOY`
- You'll see this warning in logs:
  ```
  ⚠️ Arc not supported yet by Circle SDK, falling back to MATIC-AMOY
  ```

---

## **🌊 Switching Networks Later:**

To switch from Arc to Polygon Amoy (or vice versa):

**Update root `.env`:**
```bash
BLOCKCHAIN_NETWORK=MATIC-AMOY
VITE_BLOCKCHAIN_NETWORK=MATIC-AMOY
```

**Restart servers:**
```bash
npm run dev
```

---

## **✅ Verification Checklist:**

- [ ] Added `BLOCKCHAIN_NETWORK=ARC-TESTNET` to root `.env`
- [ ] Added `VITE_BLOCKCHAIN_NETWORK=ARC-TESTNET` to root `.env`
- [ ] Restarted servers with `npm run dev` (from project root)
- [ ] Created a test wallet and checked Circle Dashboard
- [ ] Checked contract detail page shows correct network
- [ ] Tested explorer link opens correct blockchain explorer

---

## **📚 Network Options Reference:**

| Network | Backend Value | Frontend Value | Explorer URL |
|---------|--------------|----------------|--------------|
| **Arc Testnet** | `ARC-TESTNET` | `ARC-TESTNET` | https://testnet.arcscan.app/ |
| **Polygon Amoy** | `MATIC-AMOY` | `MATIC-AMOY` | https://amoy.polygonscan.com/ |
| **Ethereum Sepolia** | `ETH-SEPOLIA` | `ETH-SEPOLIA` | https://sepolia.etherscan.io/ |

---

## **🎯 Ready to Test:**

Once you've updated both `.env` files and restarted:

1. Create a new wallet in the app
2. Check backend logs for `ARC-TESTNET`
3. Open Circle Dashboard
4. Verify wallet shows Arc network
5. Create a contract
6. Check contract detail page
7. Click "View on Explorer" → should open Arc explorer

🚀 **You're all set!**

