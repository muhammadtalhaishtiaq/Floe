# 🌊 **Circle API Endpoints - Official Reference**

## **✅ What We're Using (100% Official Circle APIs)**

### **1. Base URL**
```typescript
// Testnet (Sandbox)
baseURL: 'https://api-sandbox.circle.com'

// Production (when ready)
baseURL: 'https://api.circle.com'
```

---

## **2. Developer-Controlled Wallets SDK**

We're using the **official Circle SDK**:
```bash
@circle-fin/developer-controlled-wallets
```

### **Installation:**
```bash
npm install @circle-fin/developer-controlled-wallets
```

### **Documentation:**
https://developers.circle.com/circle-mint/docs/developer-controlled-wallets-quickstart

---

## **3. Endpoints We Use:**

### **A. Create Wallet Set**
```typescript
POST /v1/w3s/developer/walletSets
```
**Purpose:** Group related wallets together

### **B. Create Wallets**
```typescript
POST /v1/w3s/developer/wallets
```
**Purpose:** Create blockchain wallet on specified network

**Supported Blockchains:**
- `ARC-TESTNET` (Arc testnet - if supported)
- `MATIC-AMOY` (Polygon Amoy testnet)
- `ETH-SEPOLIA` (Ethereum Sepolia testnet)
- `AVAX-FUJI` (Avalanche Fuji testnet)
- And more...

**Account Types:**
- `SCA` (Smart Contract Account) - **Required for Arc**
- `EOA` (Externally Owned Account) - Traditional wallet

### **C. Create Transaction**
```typescript
POST /v1/w3s/developer/transactions/transfer
```
**Purpose:** Send USDC from one wallet to another

**Parameters:**
- `walletId`: Source wallet ID
- `blockchain`: Network (e.g., `ARC-TESTNET`)
- `tokenId`: Token to send (usually `USDC`)
- `destinationAddress`: Recipient wallet address
- `amounts`: Array of amounts to send
- `fee`: Transaction fee configuration

### **D. Get Wallet**
```typescript
GET /v1/w3s/developer/wallets/{walletId}
```
**Purpose:** Get wallet details and address

### **E. Get Wallet Balance**
```typescript
GET /v1/w3s/developer/wallets/{walletId}/balances
```
**Purpose:** Check USDC balance

### **F. Get Transaction**
```typescript
GET /v1/w3s/developer/transactions/{transactionId}
```
**Purpose:** Check transaction status

---

## **4. How We Initialize the Client**

```typescript
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

const circleClient = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});
```

---

## **5. Arc-Specific Configuration**

### **Creating Wallet for Arc:**
```typescript
const response = await circleClient.createWallets({
  accountType: 'SCA',           // ✅ REQUIRED for Arc
  blockchains: ['ARC-TESTNET'], // ✅ Arc testnet
  count: 1,
  walletSetId: walletSetId
});
```

### **Why SCA (Smart Contract Account)?**
- Arc requires **Smart Contract Accounts**
- Traditional EOA wallets won't work on Arc
- SCA enables gasless transactions (USDC as gas)

---

## **6. USDC as Native Gas on Arc**

On Arc blockchain:
- **USDC is the native gas token** (not ETH/MATIC)
- Transaction fees are paid in USDC
- No need to manage separate gas tokens
- Simplified UX for users

---

## **7. Testing in Circle Dashboard**

### **Console URL:**
```
https://console.circle.com/wallets
```

### **What You'll See:**
1. **Wallet Sets** - Your wallet groups
2. **Wallets** - Individual wallets with addresses
3. **Transactions** - All USDC transfers
4. **Network Filter** - Filter by Arc/Polygon/Ethereum

### **How to Verify Arc is Working:**
1. Create a wallet via your app
2. Open Circle Console
3. Go to Wallets section
4. Filter by network: **Arc Testnet**
5. You should see your wallet listed

---

## **8. Arc Explorer**

### **Testnet Explorer:**
```
https://testnet.arcscan.app/
```

### **What You Can Check:**
- Wallet addresses
- Transaction history
- USDC transfers
- Smart contract interactions

---

## **9. Error Handling**

### **If Arc Not Supported Yet:**
```typescript
// Our code automatically falls back to MATIC-AMOY
if (targetBlockchain === 'ARC-TESTNET' && error) {
  logger.warn('⚠️ Arc not supported yet, falling back to MATIC-AMOY');
  return this.createWallet(walletSetId, 'MATIC-AMOY');
}
```

### **Common Error Messages:**
```
❌ "Blockchain not supported"
→ Arc not enabled in Circle SDK yet, using fallback

❌ "Invalid entity secret"
→ Check your .env CIRCLE_ENTITY_SECRET

❌ "Invalid API key"
→ Check your .env CIRCLE_API_KEY

❌ "Account type not supported"
→ Arc requires SCA, not EOA
```

---

## **10. Official Documentation Links**

### **Developer-Controlled Wallets:**
https://developers.circle.com/circle-mint/docs/developer-controlled-wallets

### **API Reference:**
https://developers.circle.com/circle-mint/reference/developer-controlled-wallets-api

### **Supported Blockchains:**
https://developers.circle.com/circle-mint/docs/supported-chains

### **Arc Documentation:**
https://developers.circle.com/arc/docs/arc-overview

### **Getting Started with Arc:**
https://developers.circle.com/arc/docs/getting-started

---

## **✅ Summary:**

| Component | Value | Source |
|-----------|-------|--------|
| **SDK** | `@circle-fin/developer-controlled-wallets` | Official Circle NPM package |
| **Base URL** | `https://api-sandbox.circle.com` | Circle API Sandbox |
| **Blockchain** | `ARC-TESTNET` | Arc testnet identifier |
| **Account Type** | `SCA` | Required for Arc |
| **Token** | `USDC` | Native gas on Arc |
| **Explorer** | `https://testnet.arcscan.app/` | Official Arc explorer |
| **Console** | `https://console.circle.com/wallets` | Circle Dashboard |

---

## **🎯 Ready to Use:**

1. ✅ **All endpoints are official Circle APIs**
2. ✅ **Using official Circle SDK**
3. ✅ **Proper Arc configuration (SCA + ARC-TESTNET)**
4. ✅ **Fallback mechanism if Arc not live yet**
5. ✅ **Transactions visible in Circle Dashboard**
6. ✅ **Explorer integration for blockchain verification**

**No custom/fake endpoints - everything is official Circle infrastructure!** 🚀

