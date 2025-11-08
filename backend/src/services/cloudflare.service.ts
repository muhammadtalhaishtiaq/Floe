import axios from 'axios';
import { query } from '../config/database';
import { decrypt } from '../utils/encryption.util';
import { logger } from '../utils/logger';

interface CloudflareConfig {
  accountId: string;
  apiToken: string;
}

interface ContractFields {
  amount?: number;
  frequency?: 'one_time' | 'monthly' | 'quarterly' | 'yearly';
  recipient_name?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  payment_day_of_month?: number;
  confidence: number;
  missing_fields: string[];
  raw_response?: string;
}

class CloudflareAIService {
  /**
   * Get user's Cloudflare credentials from database
   */
  private async getUserConfig(userId: string): Promise<CloudflareConfig | null> {
    try {
      const result = await query(`
        SELECT api_key_encrypted, additional_config
        FROM user_api_keys
        WHERE user_id = $1 AND service_name = 'cloudflare' AND is_active = TRUE
      `, [userId]);

      if (result.rows.length === 0) {
        logger.warn(`No Cloudflare credentials found for user ${userId}`);
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
      logger.error('Failed to get Cloudflare config:', error);
      return null;
    }
  }

  /**
   * Extract contract fields from natural language text using Cloudflare Workers AI
   * ✅ OPTIMIZED: Context-aware extraction with field merging
   */
  async extractContractFields(text: string, userId: string, context?: any): Promise<ContractFields> {
    try {
      const config = await this.getUserConfig(userId);
      
      if (!config) {
        throw new Error('Cloudflare AI credentials not found. Please add them in Settings.');
      }

      logger.info(`🤖 Extracting from: "${text}" | Context:`, context);

      // ✅ SUPER SMART PROMPT: Extract everything at once!
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      
      const systemPrompt = `You are a SMART payment extraction AI. Extract ALL payment details from user input.

INTELLIGENCE RULES:
1. Extract EVERYTHING mentioned in ONE go (amount, recipient, frequency, date)
2. Infer smart defaults:
   - "tomorrow" = ${tomorrow}
   - "today" = ${today}
   - "next week" = calculate 7 days from today
   - "next month" = first day of next month
   - If no date mentioned and frequency is "monthly" = ${today}
   - If no frequency mentioned = "one_time"
3. Handle natural language:
   - "send sam 2 dollars every month" = {amount:2, recipient:"sam", frequency:"monthly"}
   - "pay john 500 monthly from tomorrow" = {amount:500, recipient:"john", frequency:"monthly", start_date:"${tomorrow}"}
   - "5 bucks to sarah" = {amount:5, recipient:"sarah", frequency:"one_time", start_date:"${today}"}

EXTRACTION RULES:
- Amount: Extract number only (no $ or "dollars")
- Recipient: Extract name (first name is enough)
- Frequency: one_time|monthly|quarterly|yearly (default: one_time if not mentioned)
- Start date: YYYY-MM-DD format (infer from "tomorrow", "today", etc.)
- Description: Brief summary if mentioned

OUTPUT FORMAT (JSON only, no extra text):
{"amount":number,"frequency":"one_time|monthly|quarterly|yearly","recipient_name":"name","start_date":"YYYY-MM-DD","description":"text","payment_day_of_month":null,"confidence":0-100}`;

      // ✅ BUILD CONTEXT-AWARE PROMPT
      let contextInfo = '';
      if (context && Object.keys(context).length > 0) {
        contextInfo = `PREVIOUS CONTEXT (keep these values):\n`;
        if (context.amount) contextInfo += `- Amount: ${context.amount}\n`;
        if (context.recipient_name) contextInfo += `- Recipient: ${context.recipient_name}\n`;
        if (context.frequency) contextInfo += `- Frequency: ${context.frequency}\n`;
        if (context.start_date) contextInfo += `- Start: ${context.start_date}\n`;
        contextInfo += `\nNEW USER INPUT: "${text}"\n\nMerge previous context with new info. If new input provides a value, use it. Otherwise keep previous value.`;
      } else {
        contextInfo = `USER INPUT: "${text}"\n\nExtract ALL payment details from this input.`;
      }

      const userPrompt = contextInfo;

      // Call Cloudflare Workers AI (LLaMA 3)
      const response = await axios.post(
        `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/@cf/meta/llama-3-8b-instruct`,
        {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${config.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiResponse = response.data?.result?.response || '';
      logger.info(`🤖 AI Response: ${aiResponse}`);

      // Parse the JSON response
      let extracted: any = {};
      try {
        // Try to extract JSON from response (AI might add extra text)
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extracted = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in AI response');
        }
      } catch (parseError) {
        logger.error('Failed to parse AI response:', parseError);
        extracted = {
          amount: null,
          frequency: null,
          recipient_name: null,
          start_date: null,
          description: null,
          payment_day_of_month: null,
          confidence: 0
        };
      }

      // ✅ MERGE WITH CONTEXT (preserve previous values!)
      const merged = {
        amount: extracted.amount || context?.amount || null,
        frequency: extracted.frequency || context?.frequency || null,
        recipient_name: extracted.recipient_name || context?.recipient_name || null,
        start_date: extracted.start_date || context?.start_date || null,
        end_date: extracted.end_date || context?.end_date || null,
        description: extracted.description || context?.description || null,
        payment_day_of_month: extracted.payment_day_of_month || context?.payment_day_of_month || null
      };

      // ✅ AUTO-FILL start_date if we have all other fields
      if (merged.amount && merged.frequency && merged.recipient_name && !merged.start_date) {
        if (merged.frequency === 'one_time') {
          merged.start_date = new Date().toISOString().split('T')[0]; // Today
        } else {
          // For recurring, default to today
          merged.start_date = new Date().toISOString().split('T')[0];
        }
        logger.info(`✅ Auto-filled start_date: ${merged.start_date}`);
      }

      // Identify missing required fields
      const missingFields: string[] = [];
      if (!merged.amount) missingFields.push('amount');
      if (!merged.frequency) missingFields.push('frequency');
      if (!merged.recipient_name) missingFields.push('recipient_name');
      // Don't require start_date if we auto-filled it
      if (!merged.start_date && merged.frequency !== 'one_time') missingFields.push('start_date');

      const result: ContractFields = {
        ...merged,
        confidence: extracted.confidence || 70,
        missing_fields: missingFields,
        raw_response: aiResponse
      };

      logger.info(`✅ Merged fields:`, result);
      return result;
    } catch (error: any) {
      logger.error('Cloudflare AI extraction error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      // Return empty result on error
      return {
        amount: null,
        frequency: null,
        recipient_name: null,
        start_date: null,
        description: null,
        confidence: 0,
        missing_fields: ['amount', 'frequency', 'recipient_name', 'start_date'],
        raw_response: error.message
      };
    }
  }

  /**
   * Generate AI response for conversation
   * ✅ OPTIMIZED: Fast fallback responses, minimal AI calls
   */
  async generateConversationResponse(
    extractedFields: ContractFields,
    matchedRecipients: any[],
    userId: string
  ): Promise<string> {
    // ✅ SMART RESPONSES: Ask for ALL missing info at once!
    const missing = extractedFields.missing_fields;
    
    // Multiple recipients - ask to choose
    if (matchedRecipients.length > 1) {
      const names = matchedRecipients.map((r, i) => `${i + 1}. ${r.recipient_name}`).join(', ');
      return `I found ${matchedRecipients.length} contacts: ${names}. Which one?`;
    }
    
    // ✅ ASK FOR ALL MISSING FIELDS AT ONCE (smarter!)
    if (missing.length > 0) {
      const missingList: string[] = [];
      if (missing.includes('amount')) missingList.push('the amount');
      if (missing.includes('recipient_name')) missingList.push('the recipient name');
      if (missing.includes('frequency')) missingList.push('whether it\'s one-time or recurring');
      if (missing.includes('start_date')) missingList.push('when to start');
      
      if (missingList.length === 1) {
        return `I need ${missingList[0]}. Could you tell me?`;
      } else if (missingList.length === 2) {
        return `I need ${missingList[0]} and ${missingList[1]}. Could you tell me both?`;
      } else {
        const last = missingList.pop();
        return `I need ${missingList.join(', ')}, and ${last}. Could you provide these details?`;
      }
    }
    
    // All fields complete - ask user to review and click button
    if (missing.length === 0) {
      // ✅ Format frequency for natural speech
      const frequencyText = extractedFields.frequency?.replace('_', ' ') || 'payment';
      return `Perfect! I've collected all the details: $${extractedFields.amount} ${frequencyText} to ${extractedFields.recipient_name}. Please review the contract preview below and click "Create Contract" when you're ready.`;
    }
    
    // ✅ SLOW PATH: Only use AI for complex cases (rare)
    try {
      const config = await this.getUserConfig(userId);
      if (!config) {
        return "Could you provide more details?";
      }

      const systemPrompt = `Friendly payment assistant. Ask for missing info. Max 30 words.`;
      const userPrompt = `Have: ${Object.entries(extractedFields).filter(([k, v]) => v && k !== 'missing_fields').map(([k, v]) => `${k}=${v}`).join(', ')}. Missing: ${missing.join(', ')}. Ask naturally.`;

      const response = await axios.post(
        `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/@cf/meta/llama-3-8b-instruct`,
        {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${config.apiToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 3000 // ✅ 3s timeout for speed
        }
      );

      return response.data?.result?.response?.trim() || "What else do you need to tell me?";
    } catch (error: any) {
      logger.error('AI response generation failed, using fallback');
      return "What else should I know?";
    }
  }
}

export default new CloudflareAIService();

