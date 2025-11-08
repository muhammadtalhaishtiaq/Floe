import { Router, Request, Response } from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import { logger } from '../utils/logger';
import { query } from '../config/database';
import { decrypt } from '../utils/encryption.util';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Test route to verify router is working
router.get('/test', (req: Request, res: Response) => {
  res.json({ success: true, message: 'AI routes are working!' });
});

// Cloudflare AI API configuration (fallback to env vars)
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_AI_GATEWAY = process.env.CLOUDFLARE_AI_GATEWAY || 'floe';

// ElevenLabs API configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Default: Bella

/**
 * Get user's Cloudflare credentials from database (same as voice contract feature)
 */
async function getUserCloudflareConfig(userId: string): Promise<{ accountId: string; apiToken: string } | null> {
  try {
    const result = await query(`
      SELECT api_key_encrypted, additional_config
      FROM user_api_keys
      WHERE user_id = $1 AND service_name = 'cloudflare' AND is_active = TRUE
    `, [userId]);

    if (result.rows.length === 0) {
      logger.warn(`No Cloudflare credentials found for user ${userId} in database`);
      return null;
    }

    const apiToken = decrypt(result.rows[0].api_key_encrypted);
    const additionalConfig = result.rows[0].additional_config;

    if (!additionalConfig?.accountId) {
      logger.error('Cloudflare accountId missing in additional_config');
      return null;
    }

    return {
      accountId: additionalConfig.accountId,
      apiToken
    };
  } catch (error) {
    logger.error('Failed to get Cloudflare config from database:', error);
    return null;
  }
}

/**
 * POST /api/ai/chat
 * Chat with AI using Cloudflare Workers AI (LLaMA 3)
 * Uses user's database credentials (like voice feature) with env var fallback
 */
router.post('/chat', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { message, conversationHistory, shortResponse } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    logger.info(`💬 AI Chat Request from user ${userId}: ${message}`);
    logger.info(`📚 Conversation history length: ${conversationHistory?.length || 0}`);
    logger.info(`🎤 Short response mode: ${shortResponse ? 'YES' : 'NO'}`);

    // Try to get user's Cloudflare credentials from database first (like voice feature)
    let accountId = CF_ACCOUNT_ID;
    let apiToken = CF_API_TOKEN;

    if (userId) {
      const userConfig = await getUserCloudflareConfig(userId);
      if (userConfig) {
        accountId = userConfig.accountId;
        apiToken = userConfig.apiToken;
        logger.info(`✅ Using user's Cloudflare credentials from database`);
      } else {
        logger.info(`⚠️ No user credentials, trying env vars...`);
      }
    }

    if (!accountId || !apiToken) {
      logger.error('❌ Cloudflare credentials missing!');
      logger.error(`CF_ACCOUNT_ID: ${accountId ? 'SET' : 'MISSING'}`);
      logger.error(`CF_API_TOKEN: ${apiToken ? 'SET' : 'MISSING'}`);
      return res.status(500).json({
        success: false,
        error: 'Cloudflare AI credentials not configured. Please add them in Settings → API Keys.'
      });
    }

    logger.info(`✅ Cloudflare credentials found`);

    // Build conversation context with Floe-specific knowledge
    const systemPrompt = shortResponse 
      ? `You are Floe AI, voice assistant for Floe payment platform.

FEATURES: Smart contracts, A2A autonomous payments, Multi-wallet (Arc/Base/Polygon), CCTP transfers.

NAVIGATION COMMANDS (detect intent and respond with navigation):
- "show wallets" / "my wallets" / "wallet page" → /wallets
- "show contracts" / "my contracts" / "contracts page" → /contracts
- "create contract" / "new contract" / "make contract" → /contracts/new
- "create request" / "request contract" / "new request" → /request-center/contracts/new
- "request center" / "receive money" / "landlord mode" → /request-center
- "show payments" / "payment history" / "transactions" → /payments
- "a2a page" / "agent payments" / "autonomous" → /a2a
- "dashboard" / "home page" / "overview" → /dashboard
- "settings" / "api keys" / "preferences" → /settings

RESPONSE FORMAT: If user wants navigation, respond: "Sure! Taking you to [page name]." Keep under 15 words.
For other questions: Direct, concise answer (max 40 words).

CRITICAL: When navigation is needed, your response MUST include the exact phrase "NAVIGATE:/path" at the END.
Example: "Sure! Taking you to your wallets page. NAVIGATE:/wallets"
Example: "Opening contracts page for you. NAVIGATE:/contracts"`
      : `You are Floe AI, the assistant for Floe - a blockchain payment automation platform.

FLOE PLATFORM FEATURES:
• Smart Contracts: Create payment contracts (you pay) or request contracts (you receive)
• A2A Payments: AI agents autonomously evaluate & execute payments based on contract terms
• Multi-Wallet: Manage USDC wallets across Arc Testnet, Base Sepolia, Polygon
• CCTP: Cross-chain transfers using Circle's CCTP protocol
• Request Center: Create contracts to receive payments from others (landlord/payee role)

KEY WORKFLOWS:
1. Regular Payment: Create contract → Add recipient → Schedule payment
2. Request Payment: Request Center → Create request contract → Enable A2A → Send request
3. A2A Auto Mode: Agent evaluates + executes payment automatically
4. A2A Manual Mode: Agent evaluates, human executes

NAVIGATION:
- Dashboard: Overview & quick actions
- Contracts: View/manage payment contracts
- Request Center: Create contracts to receive money (landlord role)
- A2A Payments: View autonomous payment requests & activity
- Wallets: Manage USDC wallets
- Payments: Transaction history

Be helpful, concise (under 100 words), use emojis sparingly. Guide users to specific pages when needed.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []),
      { role: 'user', content: message }
    ];

    logger.info(`🤖 Sending to Cloudflare AI with ${messages.length} messages`);
    logger.info(`🔑 Account ID: ${accountId?.slice(0, 10)}...`);
    logger.info(`🔑 API Token: ${apiToken?.slice(0, 10)}... (length: ${apiToken?.length})`);
    logger.info(`📡 URL: https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3-8b-instruct`);

    // Call Cloudflare Workers AI
    const response = await axios.post(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3-8b-instruct`,
      {
        messages: messages.slice(-10), // Keep last 10 messages for context
        max_tokens: shortResponse ? 128 : 256, // Shorter for voice (128 vs 256)
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info(`📦 Response status: ${response.status}`);
    logger.info(`📦 Response data:`, response.data);

    const aiResponse = response.data.result.response;
    
    logger.info(`✅ AI Response generated: ${aiResponse.slice(0, 100)}...`);

    // Extract navigation command if present
    let navigationPath = null;
    let cleanResponse = aiResponse;
    
    const navMatch = aiResponse.match(/NAVIGATE:(\/[^\s]+)/);
    if (navMatch) {
      navigationPath = navMatch[1];
      cleanResponse = aiResponse.replace(/NAVIGATE:\/[^\s]+/g, '').trim();
      logger.info(`🧭 Navigation detected: ${navigationPath}`);
    }

    res.json({
      success: true,
      response: cleanResponse,
      navigate: navigationPath // Add navigation path if detected
    });

  } catch (error: any) {
    logger.error('❌ AI Chat Error:', error.message);
    logger.error('❌ Full error:', error);
    logger.error('❌ Error response:', error.response?.data);
    logger.error('❌ Error status:', error.response?.status);
    logger.error('❌ Error headers:', error.response?.headers);
    res.status(500).json({
      success: false,
      error: error.message || 'AI chat failed',
      details: error.response?.data,
      status: error.response?.status
    });
  }
});

/**
 * POST /api/ai/transcribe
 * Transcribe audio to text using Cloudflare Workers AI (Whisper)
 */
router.post('/transcribe', authMiddleware, upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio file provided' });
    }

    const userId = (req as any).user?.userId || (req as any).user?.id;
    logger.info(`🎤 Transcription Request from user ${userId}: ${req.file.size} bytes`);

    // Try to get user's Cloudflare credentials from database first
    let accountId = CF_ACCOUNT_ID;
    let apiToken = CF_API_TOKEN;

    if (userId) {
      const userConfig = await getUserCloudflareConfig(userId);
      if (userConfig) {
        accountId = userConfig.accountId;
        apiToken = userConfig.apiToken;
        logger.info(`✅ Using user's Cloudflare credentials from database`);
      }
    }

    if (!accountId || !apiToken) {
      return res.status(500).json({
        success: false,
        error: 'Cloudflare AI credentials not configured. Please add them in Settings → API Keys.'
      });
    }

    // Call Cloudflare Workers AI Whisper model
    const response = await axios.post(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/openai/whisper`,
      req.file.buffer,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/octet-stream'
        }
      }
    );

    const transcribedText = response.data.result.text;
    
    logger.info(`✅ Transcription: "${transcribedText}"`);

    res.json({
      success: true,
      text: transcribedText
    });

  } catch (error: any) {
    logger.error('❌ Transcription Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Transcription failed'
    });
  }
});

/**
 * POST /api/ai/speak
 * Convert text to speech using ElevenLabs
 */
router.post('/speak', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    logger.info(`🔊 Text-to-Speech Request: ${text.slice(0, 50)}...`);

    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured');
    }

    // Call ElevenLabs API
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true
        }
      },
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    logger.info(`✅ Speech generated: ${response.data.byteLength} bytes`);

    // Send audio back
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': response.data.byteLength
    });
    res.send(Buffer.from(response.data));

  } catch (error: any) {
    logger.error('❌ Text-to-Speech Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Text-to-speech failed'
    });
  }
});

export default router;

