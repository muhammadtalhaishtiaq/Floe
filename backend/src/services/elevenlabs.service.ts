import axios from 'axios';
import FormData from 'form-data';
import { query } from '../config/database';
import { decrypt } from '../utils/encryption.util';
import { logger } from '../utils/logger';

class ElevenLabsService {
  private readonly BASE_URL = 'https://api.elevenlabs.io/v1';

  /**
   * Get user's ElevenLabs API key from database
   */
  private async getUserApiKey(userId: string): Promise<string | null> {
    try {
      const result = await query(`
        SELECT api_key_encrypted
        FROM user_api_keys
        WHERE user_id = $1 AND service_name = 'elevenlabs' AND is_active = TRUE
      `, [userId]);

      if (result.rows.length === 0) {
        logger.warn(`No ElevenLabs API key found for user ${userId}`);
        return null;
      }

      const decryptedKey = decrypt(result.rows[0].api_key_encrypted);
      return decryptedKey;
    } catch (error) {
      logger.error('Failed to get ElevenLabs API key:', error);
      return null;
    }
  }

  /**
   * Convert text to speech using ElevenLabs
   */
  async textToSpeech(text: string, userId: string): Promise<Buffer | null> {
    try {
      const apiKey = await this.getUserApiKey(userId);
      
      if (!apiKey) {
        throw new Error('ElevenLabs API key not found. Please add it in Settings.');
      }

      logger.info(`🎤 Converting text to speech: "${text.substring(0, 50)}..."`);

      // Using default voice (Rachel - pre-made voice)
      const voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Rachel voice
      
      const response = await axios.post(
        `${this.BASE_URL}/text-to-speech/${voiceId}`,
        {
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        },
        {
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          responseType: 'arraybuffer'
        }
      );

      logger.info(`✅ Text-to-speech successful (${response.data.byteLength} bytes)`);
      return Buffer.from(response.data);
    } catch (error: any) {
      logger.error('ElevenLabs TTS error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data?.toString()
      });
      throw new Error(`Text-to-speech failed: ${error.message}`);
    }
  }

  /**
   * Convert speech to text using ElevenLabs Scribe v1 (Speech-to-Text)
   * Supports 99 languages with high accuracy
   * https://elevenlabs.io/docs/capabilities/speech-to-text
   */
  async speechToText(audioBuffer: Buffer, userId: string, language?: string): Promise<string | null> {
    try {
      const apiKey = await this.getUserApiKey(userId);
      
      if (!apiKey) {
        throw new Error('ElevenLabs API key not found. Please add it in Settings.');
      }

      logger.info(`🎧 Converting speech to text (${audioBuffer.length} bytes)`);
      logger.info(`📡 Using API key: ${apiKey.substring(0, 10)}...`);

      // Create form data for file upload
      const formData = new FormData();
      
      // IMPORTANT: ElevenLabs expects the field name to be 'file' not 'audio'
      // Try with generic audio type first
      formData.append('file', audioBuffer, {
        filename: 'recording.webm',
        contentType: 'audio/webm',
        knownLength: audioBuffer.length
      });
      
      // REQUIRED: Scribe v1 model ID
      formData.append('model_id', 'scribe_v1');
      
      // Optional: specify language (default is auto-detect)
      if (language) {
        formData.append('language_code', language);
      } else {
        formData.append('language_code', 'en'); // Default to English
      }

      logger.info(`📤 Sending request to ${this.BASE_URL}/speech-to-text`);
      logger.info(`📦 FormData fields: file (${audioBuffer.length} bytes), model_id (scribe_v1), language_code (en)`);

      // Use Scribe v1 model for speech-to-text
      const response = await axios.post(
        `${this.BASE_URL}/speech-to-text`,
        formData,
        {
          headers: {
            'xi-api-key': apiKey,
            ...formData.getHeaders()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      const transcript = response.data?.text || '';
      logger.info(`✅ Speech-to-text successful: "${transcript.substring(0, 100)}..."`);
      
      return transcript;
    } catch (error: any) {
      logger.error('❌ ElevenLabs STT error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      
      // Provide helpful error messages
      if (error.response?.status === 401) {
        throw new Error('Invalid ElevenLabs API key. Please check your Settings.');
      } else if (error.response?.status === 400) {
        const detail = error.response?.data?.detail;
        throw new Error(`ElevenLabs API error: ${detail?.message || JSON.stringify(detail)}`);
      }
      
      throw new Error(`Speech-to-text failed: ${error.message}`);
    }
  }

  /**
   * Get available voices
   */
  async getVoices(userId: string): Promise<any[]> {
    try {
      const apiKey = await this.getUserApiKey(userId);
      
      if (!apiKey) {
        throw new Error('ElevenLabs API key not found');
      }

      const response = await axios.get(`${this.BASE_URL}/voices`, {
        headers: {
          'xi-api-key': apiKey
        }
      });

      return response.data.voices || [];
    } catch (error: any) {
      logger.error('Failed to get voices:', error);
      return [];
    }
  }
}

export default new ElevenLabsService();

