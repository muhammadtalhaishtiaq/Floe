/**
 * PayMind RWA AI Agent - Cloudflare Workers
 * 
 * This AI agent handles:
 * 1. Contract parsing (extract payment terms from natural language)
 * 2. Condition evaluation (check if payment conditions are met)
 * 3. Evidence verification (analyze delivery proofs, documents, etc.)
 */

export interface Env {
  AI: any;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS request
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Route: Parse contract
      if (path === '/parse' && request.method === 'POST') {
        const { contractText } = await request.json() as { contractText: string };
        const result = await parseContract(contractText, env.AI);
        return Response.json(result, { headers: corsHeaders });
      }

      // Route: Evaluate conditions
      if (path === '/evaluate' && request.method === 'POST') {
        const { conditions, evidence } = await request.json() as {
          conditions: string;
          evidence: any;
        };
        const result = await evaluateConditions(conditions, evidence, env.AI);
        return Response.json(result, { headers: corsHeaders });
      }

      // Route: Verify evidence
      if (path === '/verify' && request.method === 'POST') {
        const { evidenceType, data } = await request.json() as {
          evidenceType: string;
          data: any;
        };
        const result = await verifyEvidence(evidenceType, data, env.AI);
        return Response.json(result, { headers: corsHeaders });
      }

      // Default route
      return Response.json(
        {
          name: 'PayMind RWA AI Agent',
          version: '1.0.0',
          endpoints: [
            'POST /parse - Parse contract text',
            'POST /evaluate - Evaluate payment conditions',
            'POST /verify - Verify evidence',
          ],
        },
        { headers: corsHeaders }
      );
    } catch (error: any) {
      return Response.json(
        { error: error.message || 'Internal server error' },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};

/**
 * Parse contract text and extract payment terms
 */
async function parseContract(contractText: string, ai: any) {
  const prompt = `You are a smart contract parser for real-world asset payment automation.

Extract payment terms from the following contract text and return ONLY valid JSON (no markdown, no code blocks).

Contract text:
"${contractText}"

Return JSON in this exact format:
{
  "assetType": "real_estate" | "invoice" | "bond" | "equipment" | "other",
  "paymentType": "one_time" | "recurring" | "conditional" | "milestone",
  "amount": number,
  "currency": "USD",
  "frequency": "daily" | "weekly" | "monthly" | "quarterly" | "annually" | null,
  "dueDay": number or null,
  "startDate": "YYYY-MM-DD" or null,
  "endDate": "YYYY-MM-DD" or null,
  "conditions": string or null,
  "description": string
}`;

  const response = await ai.run('@cf/meta/llama-3-8b-instruct', {
    messages: [
      { role: 'system', content: 'You are a JSON-only contract parser. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 500,
  });

  const responseText = response.response || '';
  
  // Try to parse JSON from response
  try {
    // Remove markdown code blocks if present
    const cleanedText = responseText
      .replace(/```json\n/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const parsed = JSON.parse(cleanedText);
    return {
      success: true,
      parsed: parsed,
      confidence: 0.85,
      rawResponse: responseText,
    };
  } catch (parseError) {
    return {
      success: false,
      error: 'Failed to parse AI response',
      rawResponse: responseText,
    };
  }
}

/**
 * Evaluate if payment conditions are met
 */
async function evaluateConditions(conditions: string, evidence: any, ai: any) {
  const prompt = `You are a condition evaluator for payment automation.

Payment Conditions: "${conditions}"

Evidence Provided: ${JSON.stringify(evidence)}

Evaluate if the conditions are met based on the evidence.

Return ONLY valid JSON (no markdown, no code blocks) in this format:
{
  "conditionsMet": true or false,
  "confidence": number between 0 and 1,
  "reasoning": "brief explanation",
  "action": "release" | "hold" | "review"
}`;

  const response = await ai.run('@cf/meta/llama-3-8b-instruct', {
    messages: [
      { role: 'system', content: 'You are a JSON-only condition evaluator. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 300,
  });

  const responseText = response.response || '';

  try {
    const cleanedText = responseText
      .replace(/```json\n/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const parsed = JSON.parse(cleanedText);
    return {
      success: true,
      evaluation: parsed,
      rawResponse: responseText,
    };
  } catch (parseError) {
    return {
      success: false,
      error: 'Failed to parse AI response',
      rawResponse: responseText,
    };
  }
}

/**
 * Verify evidence (documents, tracking, etc.)
 */
async function verifyEvidence(evidenceType: string, data: any, ai: any) {
  const prompt = `You are an evidence verifier for payment automation.

Evidence Type: ${evidenceType}
Evidence Data: ${JSON.stringify(data)}

Verify if this evidence is valid and authentic.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "verified": true or false,
  "confidence": number between 0 and 1,
  "findings": "brief description of what was verified",
  "concerns": ["any concerns or red flags"] or null
}`;

  const response = await ai.run('@cf/meta/llama-3-8b-instruct', {
    messages: [
      { role: 'system', content: 'You are a JSON-only evidence verifier. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 300,
  });

  const responseText = response.response || '';

  try {
    const cleanedText = responseText
      .replace(/```json\n/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const parsed = JSON.parse(cleanedText);
    return {
      success: true,
      verification: parsed,
      rawResponse: responseText,
    };
  } catch (parseError) {
    return {
      success: false,
      error: 'Failed to parse AI response',
      rawResponse: responseText,
    };
  }
}

