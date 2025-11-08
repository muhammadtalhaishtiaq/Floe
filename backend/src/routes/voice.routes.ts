import { Router } from 'express';
import multer from 'multer';
import { query } from '../config/database';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import elevenLabsService from '../services/elevenlabs.service';
import cloudflareService from '../services/cloudflare.service';

const router = Router();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Apply authentication to all routes
router.use(authMiddleware);

/**
 * POST /api/voice/speech-to-text
 * Convert speech to text using ElevenLabs Scribe v1
 */
router.post('/speech-to-text', upload.single('audio'), asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;
  const audioFile = req.file;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (!audioFile) {
    return res.status(400).json({ success: false, error: 'audio file is required' });
  }

  try {
    const transcript = await elevenLabsService.speechToText(audioFile.buffer, userId);
    
    if (!transcript) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to transcribe audio' 
      });
    }

    res.json({
      success: true,
      transcript
    });
  } catch (error: any) {
    logger.error('Speech-to-text error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to convert speech to text'
    });
  }
}));

/**
 * POST /api/voice/text-to-speech
 * Convert text to speech
 */
router.post('/text-to-speech', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;
  const { text } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (!text) {
    return res.status(400).json({ success: false, error: 'text is required' });
  }

  try {
    const audioBuffer = await elevenLabsService.textToSpeech(text, userId);
    
    if (!audioBuffer) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to generate speech' 
      });
    }

    // Return audio as base64
    res.json({
      success: true,
      audio: audioBuffer.toString('base64'),
      format: 'mp3'
    });
  } catch (error: any) {
    logger.error('Text-to-speech error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to convert text to speech'
    });
  }
}));

/**
 * POST /api/voice/process-contract
 * Process voice input for contract creation
 */
router.post('/process-contract', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;
  const { transcript, context } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (!transcript) {
    return res.status(400).json({ 
      success: false, 
      error: 'transcript is required' 
    });
  }

  try {
    const startTime = Date.now();
    logger.info(`📝 Processing: "${transcript}" | Context:`, context);

    // ✅ NO AUTO-SUBMIT - Let user click the button
    // (Removed confirmation detection - more professional UX)

    // ✅ STEP 1: Extract fields (AI extraction)
    const extractedFields = await cloudflareService.extractContractFields(
      transcript,
      userId,
      context
    );

    // ✅ STEP 2 & 3: PARALLEL PROCESSING (recipient lookup + response generation)
    const [matchedRecipients, aiResponsePromise] = await Promise.all([
      // Parallel task 1: Match recipients
      (async () => {
        if (!extractedFields.recipient_name) return [];
        
        try {
          const result = await query(`
            SELECT id, recipient_name, wallet_address, nickname
            FROM saved_recipients
            WHERE user_id = $1 
            AND (
              LOWER(recipient_name) LIKE $2 
              OR LOWER(nickname) LIKE $2
            )
          `, [userId, `%${extractedFields.recipient_name.toLowerCase()}%`]);
          
          logger.info(`🔍 Found ${result.rows.length} recipients`);
          return result.rows;
        } catch (err) {
          logger.error('Recipient lookup failed:', err);
          return [];
        }
      })(),
      
      // Parallel task 2: Start generating response (we'll await it later)
      cloudflareService.generateConversationResponse(
        extractedFields,
        [], // We'll update this after recipient lookup
        userId
      ).catch(() => 'What else should I know?') // Fallback on error
    ]);

    // ✅ STEP 3: Determine final AI response based on recipients
    let aiResponse = '';
    let isComplete = false;

    if (matchedRecipients.length > 1) {
      const names = matchedRecipients.map((r, i) => `${i + 1}. ${r.recipient_name}`).join(', ');
      aiResponse = `I found ${matchedRecipients.length} contacts: ${names}. Which one?`;
    } else if (matchedRecipients.length === 1) {
      extractedFields.recipient_name = matchedRecipients[0].recipient_name;
      
      if (extractedFields.missing_fields.length === 0) {
        isComplete = true;
        // ✅ Format frequency for natural speech
        const frequencyText = extractedFields.frequency?.replace(/_/g, ' ') || 'payment';
        aiResponse = `Perfect! I've collected all the details: $${extractedFields.amount} ${frequencyText} to ${extractedFields.recipient_name}. Please review the contract preview below and click "Create Contract" when you're ready.`;
      } else {
        aiResponse = await aiResponsePromise; // Use pre-generated response
      }
    } else if (extractedFields.recipient_name && matchedRecipients.length === 0) {
      aiResponse = `I don't have "${extractedFields.recipient_name}" in your contacts. Could you provide their wallet address?`;
    } else {
      aiResponse = await aiResponsePromise; // Use pre-generated response
    }

    // ✅ STEP 4: Convert to speech (with timeout protection)
    let audioBase64 = null;
    try {
      const audioBuffer = await Promise.race([
        elevenLabsService.textToSpeech(aiResponse, userId),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('TTS timeout')), 5000)
        )
      ]);
      audioBase64 = audioBuffer?.toString('base64') || null;
    } catch (ttsError: any) {
      logger.error('TTS failed:', ttsError.message);
      // Continue without audio (better than failing completely)
    }

    const elapsed = Date.now() - startTime;
    logger.info(`✅ Response ready in ${elapsed}ms | Audio: ${audioBase64 ? 'Yes' : 'No'}`);

    res.json({
      success: true,
      transcript,
      extracted: extractedFields,
      matched_recipients: matchedRecipients,
      ai_response: aiResponse,
      audio: audioBase64,
      is_complete: isComplete,
      processing_time_ms: elapsed
    });
  } catch (error: any) {
    logger.error('❌ Voice processing error:', error);
    
    // ✅ GRACEFUL ERROR HANDLING
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process voice input',
      fallback_message: 'Sorry, I had trouble understanding. Could you try again?'
    });
  }
}));

/**
 * POST /api/voice/confirm-recipient
 * Confirm recipient selection when multiple matches found
 */
router.post('/confirm-recipient', asyncHandler(async (req, res) => {
  const userId = (req as any).user?.userId;
  const { recipient_id, context } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (!recipient_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'recipient_id is required' 
    });
  }

  try {
    // Get recipient details
    const result = await query(`
      SELECT id, recipient_name, wallet_address, nickname
      FROM saved_recipients
      WHERE user_id = $1 AND id = $2
    `, [userId, recipient_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Recipient not found' 
      });
    }

    const recipient = result.rows[0];

    // Update context with confirmed recipient
    const updatedContext = {
      ...context,
      recipient_name: recipient.recipient_name,
      recipient_address: recipient.wallet_address
    };

    // Check if all fields are complete
    const isComplete = 
      updatedContext.amount &&
      updatedContext.frequency &&
      updatedContext.recipient_name &&
      (updatedContext.frequency === 'one_time' || updatedContext.start_date);

    let aiResponse = '';
    if (isComplete) {
      aiResponse = `Perfect! Let me confirm:\n- Amount: $${updatedContext.amount}\n- To: ${recipient.recipient_name}\n- Frequency: ${updatedContext.frequency}\n- Starting: ${updatedContext.start_date || 'immediately'}\n\nIs this correct? Say 'yes' to create the contract.`;
    } else {
      aiResponse = `Got it! Paying ${recipient.recipient_name}. `;
      if (!updatedContext.amount) aiResponse += 'How much would you like to send?';
      else if (!updatedContext.frequency) aiResponse += 'Is this a one-time payment or recurring?';
      else if (!updatedContext.start_date) aiResponse += 'When should the first payment be?';
    }

    // Convert to speech
    const audioBuffer = await elevenLabsService.textToSpeech(aiResponse, userId);

    res.json({
      success: true,
      recipient,
      context: updatedContext,
      ai_response: aiResponse,
      audio: audioBuffer?.toString('base64') || null,
      is_complete: isComplete
    });
  } catch (error: any) {
    logger.error('Confirm recipient error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to confirm recipient'
    });
  }
}));

export default router;

