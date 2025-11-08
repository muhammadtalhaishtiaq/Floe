# 🔐 API Keys Management System

## **Overview**

This system allows users to securely store and manage their **ElevenLabs** and **Cloudflare AI** API keys in the database, while keeping **Circle API keys server-side** for maximum security.

---

## **Architecture Decision**

### **Server-Level Keys (.env)**
```
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_ENTITY_SECRET=your_64_char_hex_secret
BLOCKCHAIN_NETWORK=ARC-TESTNET
```

**Why?**
- ✅ **Security**: Entity Secret controls ALL user wallets - must never leave server
- ✅ **Simplicity**: One Circle account manages all users
- ✅ **Cost**: Circle pricing is per-account, not per-user
- ✅ **Trust**: Users trust YOUR platform to manage wallets securely

### **User-Level Keys (Database)**
```
- elevenlabs (Voice AI)
- cloudflare (Contract parsing, AI features)
- openai (Optional AI features)
```

**Why?**
- ✅ Users bring their own AI API keys
- ✅ No shared rate limits
- ✅ Users control their AI spending
- ✅ Enterprise-friendly (users can use their own accounts)

---

## **Database Schema**

### **Table: `user_api_keys`**

```sql
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  service_name VARCHAR(100) NOT NULL, -- 'elevenlabs', 'cloudflare', 'openai'
  api_key_encrypted TEXT NOT NULL,
  iv TEXT NOT NULL, -- Initialization Vector for AES-256-GCM
  additional_config JSONB, -- For Cloudflare: accountId, apiToken
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, service_name)
);

CREATE INDEX idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX idx_user_api_keys_service_name ON user_api_keys(service_name);
```

---

## **Encryption System**

### **AES-256-GCM Encryption**

**File:** `backend/src/utils/encryption.util.ts`

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32-byte hex string

export function encrypt(text: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted: encrypted + authTag.toString('hex'),
    iv: iv.toString('hex')
  };
}

export function decrypt(encrypted: string, iv: string): string {
  const authTag = Buffer.from(encrypted.slice(-32), 'hex');
  const encryptedText = encrypted.slice(0, -32);
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

**Generate Encryption Key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env`:
```
ENCRYPTION_KEY=your_64_char_hex_string
```

---

## **Backend API Routes**

### **File:** `backend/src/routes/api-keys.routes.ts`

#### **1. Save API Key**
```http
POST /api/api-keys/save
Authorization: Bearer <jwt_token>

{
  "service_name": "elevenlabs",
  "api_key": "sk_...",
  "additional_config": {
    "accountId": "...",
    "apiToken": "..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "API key saved successfully",
  "service": "elevenlabs"
}
```

#### **2. List API Keys**
```http
GET /api/api-keys/list
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "apiKeys": [
    {
      "service_name": "elevenlabs",
      "is_active": true,
      "created_at": "2025-11-03T10:00:00Z",
      "updated_at": "2025-11-03T10:00:00Z"
    }
  ]
}
```

#### **3. Get Specific API Key (Decrypted)**
```http
GET /api/api-keys/:serviceName
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "apiKey": {
    "service_name": "elevenlabs",
    "api_key": "sk_...",
    "additional_config": { ... },
    "is_active": true
  }
}
```

#### **4. Toggle API Key (Enable/Disable)**
```http
PATCH /api/api-keys/:serviceName/toggle
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "API key toggled successfully",
  "is_active": false
}
```

#### **5. Delete API Key**
```http
DELETE /api/api-keys/:serviceName
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "API key deleted successfully"
}
```

---

## **Frontend Integration**

### **Settings Page**

**File:** `frontend/src/pages/SettingsPage.tsx`

**Features:**
1. ✅ **Add API Key Form** - Dropdown for service selection, password-masked input, optional JSON config
2. ✅ **Saved Keys List** - Display all saved keys with active/inactive badges
3. ✅ **Enable/Disable Toggle** - Temporarily disable keys without deleting
4. ✅ **Delete Keys** - Permanently remove API keys
5. ✅ **Security Info Card** - Explains encryption and security measures

**Navigation:**
```
Settings → API Keys Tab
```

**API Service:**
```typescript
// frontend/src/services/api.ts

export const apiKeysAPI = {
  save: async (data: { service_name: string; api_key: string; additional_config?: any }) => {
    const response = await api.post('/api-keys/save', data);
    return response.data;
  },
  list: async () => {
    const response = await api.get('/api-keys/list');
    return response.data;
  },
  delete: async (service_name: string) => {
    const response = await api.delete(`/api-keys/${service_name}`);
    return response.data;
  },
  toggle: async (service_name: string) => {
    const response = await api.patch(`/api-keys/${service_name}/toggle`);
    return response.data;
  }
};
```

---

## **Using User API Keys in Backend Services**

### **Example: ElevenLabs Service**

**File:** `backend/src/services/elevenlabs.service.ts`

```typescript
import { query } from '../config/database';
import { decrypt } from '../utils/encryption.util';
import axios from 'axios';

class ElevenLabsService {
  async getUserApiKey(userId: string): Promise<string | null> {
    const result = await query(`
      SELECT api_key_encrypted, iv
      FROM user_api_keys
      WHERE user_id = $1 AND service_name = 'elevenlabs' AND is_active = TRUE
    `, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const { api_key_encrypted, iv } = result.rows[0];
    return decrypt(api_key_encrypted, iv);
  }

  async textToSpeech(userId: string, text: string): Promise<Buffer> {
    const apiKey = await this.getUserApiKey(userId);
    
    if (!apiKey) {
      throw new Error('ElevenLabs API key not found. Please add it in Settings.');
    }

    const response = await axios.post(
      'https://api.elevenlabs.io/v1/text-to-speech/...',
      { text },
      {
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    return Buffer.from(response.data);
  }
}

export default new ElevenLabsService();
```

### **Example: Cloudflare AI Service**

**File:** `backend/src/services/cloudflare.service.ts`

```typescript
import { query } from '../config/database';
import { decrypt } from '../utils/encryption.util';
import axios from 'axios';

class CloudflareAIService {
  async getUserConfig(userId: string): Promise<{ accountId: string; apiToken: string } | null> {
    const result = await query(`
      SELECT api_key_encrypted, iv, additional_config
      FROM user_api_keys
      WHERE user_id = $1 AND service_name = 'cloudflare' AND is_active = TRUE
    `, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const { api_key_encrypted, iv, additional_config } = result.rows[0];
    const apiToken = decrypt(api_key_encrypted, iv);
    const { accountId } = additional_config;

    return { accountId, apiToken };
  }

  async parseContract(userId: string, contractText: string): Promise<any> {
    const config = await this.getUserConfig(userId);
    
    if (!config) {
      throw new Error('Cloudflare AI credentials not found. Please add them in Settings.');
    }

    const response = await axios.post(
      `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/@cf/meta/llama-3-8b-instruct`,
      {
        messages: [
          { role: 'system', content: 'Extract payment terms from this contract.' },
          { role: 'user', content: contractText }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }
}

export default new CloudflareAIService();
```

---

## **Security Best Practices**

### ✅ **DO:**
1. **Always encrypt API keys** before storing in database
2. **Use unique IV** for each encryption
3. **Keep ENCRYPTION_KEY in .env** (never commit to Git)
4. **Validate user ownership** before decrypting keys
5. **Use HTTPS** for all API calls
6. **Log failed decryption attempts**
7. **Rotate encryption keys** periodically

### ❌ **DON'T:**
1. **Never log decrypted API keys**
2. **Never send API keys to frontend** (except during initial save)
3. **Never store Circle keys in database**
4. **Never share encryption keys** between environments
5. **Never commit .env files** to Git

---

## **Testing**

### **1. Add ElevenLabs API Key**
```bash
# Navigate to: http://localhost:5173/settings
# Click "API Keys" tab
# Select "ElevenLabs (Voice AI)"
# Paste your API key: sk_...
# Click "Save API Key"
```

### **2. Add Cloudflare AI Keys**
```bash
# Navigate to: http://localhost:5173/settings
# Click "API Keys" tab
# Select "Cloudflare Workers AI"
# Paste your API token
# Add JSON config: {"accountId": "your_account_id", "apiToken": "your_token"}
# Click "Save API Key"
```

### **3. Verify Encryption**
```sql
-- Check database (should see encrypted data)
SELECT service_name, api_key_encrypted, iv FROM user_api_keys;

-- Output example:
-- service_name | api_key_encrypted | iv
-- ELEVENLABS   | a3f8d9e2...       | 1b4c7e9f...
```

### **4. Test API Key Retrieval**
```bash
curl -X GET http://localhost:5000/api/api-keys/ELEVENLABS \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## **Environment Variables**

### **Backend `.env`**
```bash
# Circle (Server-Level)
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_ENTITY_SECRET=your_64_char_hex_secret
BLOCKCHAIN_NETWORK=ARC-TESTNET

# Encryption
ENCRYPTION_KEY=your_64_char_hex_encryption_key

# Database
DATABASE_URL=postgresql://...
```

### **Generate Keys**
```bash
# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate entity secret (if needed)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## **Next Steps**

1. ✅ **Database table created** (`user_api_keys`)
2. ✅ **Backend routes implemented** (`api-keys.routes.ts`)
3. ✅ **Encryption utility created** (`encryption.util.ts`)
4. ✅ **Frontend Settings page updated** (API Keys tab)
5. ⏳ **Integrate with ElevenLabs service** (voice AI)
6. ⏳ **Integrate with Cloudflare AI service** (contract parsing)
7. ⏳ **Add error handling** for missing API keys
8. ⏳ **Add API key validation** (test keys before saving)

---

## **Support**

For issues or questions:
1. Check backend logs: `npm run dev` (backend folder)
2. Check frontend console: Browser DevTools
3. Verify `.env` has `ENCRYPTION_KEY`
4. Ensure database migration ran successfully

---

**🎉 API Keys Management System Complete!**

Users can now securely store their ElevenLabs and Cloudflare AI keys, while Circle keys remain safely server-side. 🔒

