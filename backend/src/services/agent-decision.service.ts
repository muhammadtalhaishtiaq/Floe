/**
 * AI Agent Decision Service
 * 
 * Uses Cloudflare AI (LLaMA 3) to make intelligent decisions about A2A payment approvals
 * Based on contract terms, payment history, and risk assessment
 */

import logger from '../utils/logger';

// Cloudflare AI configuration
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const CLOUDFLARE_AI_MODEL = '@cf/meta/llama-3-8b-instruct';

interface ContractTerms {
  amount: string;
  paymentType: string;
  frequency: string;
  counterpartyAddress: string;
  startDate: string;
  endDate?: string;
}

interface PaymentRequest {
  amount: string;
  fromAddress: string;
  toAddress: string;
  network: string;
  description: string;
  requestedAt: Date;
}

interface AgentDecision {
  approved: boolean;
  confidence: number; // 0-100
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
  checks: {
    amountMatch: boolean;
    addressMatch: boolean;
    timingCorrect: boolean;
    suspiciousActivity: boolean;
  };
}

class AgentDecisionService {
  /**
   * Main decision-making function for A2A payments
   */
  async shouldApprovePayment(
    paymentRequest: PaymentRequest,
    contractTerms: ContractTerms,
    approvalMode: 'manual' | 'auto'
  ): Promise<AgentDecision> {
    try {
      logger.info(`🤖 Agent Decision: Evaluating payment request`, {
        amount: paymentRequest.amount,
        approvalMode
      });

      // If manual mode, always require human approval
      if (approvalMode === 'manual') {
        return {
          approved: false,
          confidence: 0,
          reasoning: 'Manual approval mode enabled. Human review required before payment execution.',
          riskLevel: 'low',
          checks: {
            amountMatch: false,
            addressMatch: false,
            timingCorrect: false,
            suspiciousActivity: false
          }
        };
      }

      // Perform automated checks
      const checks = this.performSecurityChecks(paymentRequest, contractTerms);
      
      // Calculate risk level
      const riskLevel = this.calculateRiskLevel(checks, paymentRequest, contractTerms);

      // Use AI to make final decision
      const aiDecision = await this.getAIDecision(
        paymentRequest,
        contractTerms,
        checks,
        riskLevel
      );

      logger.info(`🤖 Agent Decision: ${aiDecision.approved ? 'APPROVED' : 'REJECTED'}`, {
        confidence: aiDecision.confidence,
        riskLevel: aiDecision.riskLevel
      });

      return aiDecision;

    } catch (error: any) {
      logger.error('❌ Agent Decision Error:', error);
      
      // On error, default to rejection for safety
      return {
        approved: false,
        confidence: 0,
        reasoning: `Error in decision process: ${error.message}. Defaulting to rejection for security.`,
        riskLevel: 'high',
        checks: {
          amountMatch: false,
          addressMatch: false,
          timingCorrect: false,
          suspiciousActivity: true
        }
      };
    }
  }

  /**
   * Perform basic security checks
   */
  private performSecurityChecks(
    request: PaymentRequest,
    terms: ContractTerms
  ): AgentDecision['checks'] {
    // Check 1: Amount matches contract terms (with small tolerance)
    const requestedAmount = parseFloat(request.amount);
    const expectedAmount = parseFloat(terms.amount);
    const tolerance = 0.01; // 1% tolerance
    const amountMatch = Math.abs(requestedAmount - expectedAmount) <= (expectedAmount * tolerance);

    // Check 2: Address matches contract counterparty
    const addressMatch = request.toAddress.toLowerCase() === terms.counterpartyAddress.toLowerCase();

    // Check 3: Timing is correct based on payment frequency
    const timingCorrect = this.checkPaymentTiming(request.requestedAt, terms);

    // Check 4: No suspicious activity (basic heuristics)
    const suspiciousActivity = this.detectSuspiciousActivity(request, terms);

    return {
      amountMatch,
      addressMatch,
      timingCorrect,
      suspiciousActivity
    };
  }

  /**
   * Check if payment timing aligns with contract frequency
   */
  private checkPaymentTiming(requestedAt: Date, terms: ContractTerms): boolean {
    // For MVP, we'll allow payments anytime
    // In production, check against last payment + frequency
    const now = new Date();
    const contractStart = new Date(terms.startDate);
    
    // Must be after contract start
    if (requestedAt < contractStart) {
      return false;
    }

    // If end date exists, must be before it
    if (terms.endDate) {
      const contractEnd = new Date(terms.endDate);
      if (requestedAt > contractEnd) {
        return false;
      }
    }

    return true;
  }

  /**
   * Detect suspicious activity patterns
   */
  private detectSuspiciousActivity(
    request: PaymentRequest,
    terms: ContractTerms
  ): boolean {
    // Check for extremely high amounts (> 10x expected)
    const requestedAmount = parseFloat(request.amount);
    const expectedAmount = parseFloat(terms.amount);
    
    if (requestedAmount > expectedAmount * 10) {
      return true;
    }

    // Check for zero or negative amounts
    if (requestedAmount <= 0) {
      return true;
    }

    // No suspicious activity detected
    return false;
  }

  /**
   * Calculate overall risk level
   */
  private calculateRiskLevel(
    checks: AgentDecision['checks'],
    request: PaymentRequest,
    terms: ContractTerms
  ): 'low' | 'medium' | 'high' {
    // High risk if suspicious activity detected
    if (checks.suspiciousActivity) {
      return 'high';
    }

    // High risk if address doesn't match
    if (!checks.addressMatch) {
      return 'high';
    }

    // Medium risk if amount doesn't match
    if (!checks.amountMatch) {
      return 'medium';
    }

    // Medium risk if timing is off
    if (!checks.timingCorrect) {
      return 'medium';
    }

    // Low risk if all checks pass
    return 'low';
  }

  /**
   * Use Cloudflare AI to make intelligent decision
   */
  private async getAIDecision(
    request: PaymentRequest,
    terms: ContractTerms,
    checks: AgentDecision['checks'],
    riskLevel: 'low' | 'medium' | 'high'
  ): Promise<AgentDecision> {
    // Build context for AI
    const prompt = `You are an AI agent managing autonomous cryptocurrency payments. Analyze this payment request and decide whether to approve it.

CONTRACT TERMS:
- Expected Amount: ${terms.amount} USDC
- Payment Type: ${terms.paymentType}
- Frequency: ${terms.frequency}
- Counterparty: ${terms.counterpartyAddress}

PAYMENT REQUEST:
- Requested Amount: ${request.amount} USDC
- From: ${request.fromAddress}
- To: ${request.toAddress}
- Network: ${request.network}
- Description: ${request.description}

SECURITY CHECKS:
- Amount Match: ${checks.amountMatch ? 'PASS' : 'FAIL'}
- Address Match: ${checks.addressMatch ? 'PASS' : 'FAIL'}
- Timing Correct: ${checks.timingCorrect ? 'PASS' : 'FAIL'}
- Suspicious Activity: ${checks.suspiciousActivity ? 'DETECTED' : 'NONE'}

Risk Level: ${riskLevel.toUpperCase()}

Decision: Should this payment be approved? Respond with:
1. "APPROVE" or "REJECT"
2. Your confidence level (0-100)
3. Brief reasoning (one sentence)

Format: DECISION|CONFIDENCE|REASONING`;

    try {
      // Call Cloudflare AI API
      if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
        logger.warn('⚠️ Cloudflare AI credentials not configured. Using rule-based decision.');
        return this.getRuleBasedDecision(checks, riskLevel, request, terms);
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${CLOUDFLARE_AI_MODEL}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: 'You are a financial AI agent that makes payment approval decisions.' },
              { role: 'user', content: prompt }
            ]
          }),
        }
      );

      if (!response.ok) {
        logger.warn(`⚠️ Cloudflare AI API error: ${response.status}. Using rule-based decision.`);
        return this.getRuleBasedDecision(checks, riskLevel, request, terms);
      }

      const data = await response.json();
      const aiResponse = data.result?.response || '';

      logger.info(`🤖 AI Response: ${aiResponse.substring(0, 200)}`);

      // Parse AI response
      return this.parseAIResponse(aiResponse, checks, riskLevel);

    } catch (error: any) {
      logger.error('❌ Cloudflare AI Error:', error);
      
      // Fallback to rule-based decision
      return this.getRuleBasedDecision(checks, riskLevel, request, terms);
    }
  }

  /**
   * Parse AI response into decision object
   */
  private parseAIResponse(
    aiResponse: string,
    checks: AgentDecision['checks'],
    riskLevel: 'low' | 'medium' | 'high'
  ): AgentDecision {
    try {
      // Try to parse structured response
      const parts = aiResponse.split('|');
      
      if (parts.length >= 3) {
        const decision = parts[0].trim().toUpperCase();
        const confidence = parseInt(parts[1].trim());
        const reasoning = parts[2].trim();

        return {
          approved: decision.includes('APPROVE'),
          confidence: isNaN(confidence) ? 50 : confidence,
          reasoning: reasoning || 'AI decision based on contract analysis',
          riskLevel,
          checks
        };
      }

      // Fallback parsing
      const approved = aiResponse.toLowerCase().includes('approve') && 
                      !aiResponse.toLowerCase().includes('reject');
      
      return {
        approved,
        confidence: 70,
        reasoning: aiResponse.substring(0, 200) || 'AI-based decision',
        riskLevel,
        checks
      };

    } catch (error) {
      logger.error('❌ Error parsing AI response:', error);
      
      // Default to rejection on parse error
      return {
        approved: false,
        confidence: 0,
        reasoning: 'Error parsing AI response. Defaulting to rejection.',
        riskLevel: 'high',
        checks
      };
    }
  }

  /**
   * Fallback rule-based decision (no AI)
   */
  private getRuleBasedDecision(
    checks: AgentDecision['checks'],
    riskLevel: 'low' | 'medium' | 'high',
    request: PaymentRequest,
    terms: ContractTerms
  ): AgentDecision {
    // Reject if high risk
    if (riskLevel === 'high') {
      return {
        approved: false,
        confidence: 90,
        reasoning: 'Payment rejected due to high risk factors: ' + 
                  (!checks.addressMatch ? 'address mismatch, ' : '') +
                  (checks.suspiciousActivity ? 'suspicious activity detected' : ''),
        riskLevel,
        checks
      };
    }

    // Approve if low risk and all critical checks pass
    if (riskLevel === 'low' && checks.addressMatch && checks.amountMatch) {
      return {
        approved: true,
        confidence: 95,
        reasoning: `Payment approved: Amount (${request.amount} USDC) matches contract terms, address verified, timing correct, no suspicious activity.`,
        riskLevel,
        checks
      };
    }

    // Medium risk - approve with caution if address matches
    if (checks.addressMatch && !checks.suspiciousActivity) {
      return {
        approved: true,
        confidence: 70,
        reasoning: `Payment approved with medium confidence: Address verified, but amount variance detected (expected ${terms.amount}, got ${request.amount}).`,
        riskLevel,
        checks
      };
    }

    // Default reject for safety
    return {
      approved: false,
      confidence: 80,
      reasoning: 'Payment rejected: Failed security checks. Manual review recommended.',
      riskLevel,
      checks
    };
  }

  /**
   * Log decision to database for audit trail
   */
  async logDecision(
    contractId: string,
    requestId: string,
    decision: AgentDecision
  ): Promise<void> {
    logger.info(`📝 Logging agent decision for contract ${contractId}`, {
      approved: decision.approved,
      confidence: decision.confidence,
      riskLevel: decision.riskLevel
    });

    // TODO: Save to database in activity log table
    // This will be implemented in the activity log service
  }
}

export default new AgentDecisionService();
export { AgentDecisionService, AgentDecision, ContractTerms, PaymentRequest };

