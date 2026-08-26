const GROQ_TIMEOUT_MS = 10000

async function analyzeMessageForScam(messageText) {
  // Short messages skip করো
  if (!messageText || messageText.trim().length < 10) {
    return { isScam: false, score: 0, reason: null }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS)

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          {
            role: 'system',
            content: `You are a scam detection expert. Analyze messages for scam indicators.

IMPORTANT RULES:
- Normal money discussions between friends/colleagues are NOT scams
- Job offers, lottery wins, urgent bank alerts, suspicious links = HIGH scam probability
- Only flag genuinely suspicious content
- Consider context carefully before flagging

Respond ONLY with valid JSON, nothing else:
{
  "scamScore": 0-100,
  "isScam": true/false,
  "category": "phishing/lottery/job_scam/suspicious_link/financial_fraud/safe",
  "reason": "one short sentence explanation"
}

scamScore guide:
0-30 = safe
31-60 = suspicious  
61-100 = high scam probability`,
          },
          {
            role: 'user',
            content: `Analyze this message: "${messageText}"`,
          },
        ],
        max_tokens: 150,
        temperature: 0.1,
      }),
    })

    clearTimeout(timer)

    if (!response.ok) return { isScam: false, score: 0, reason: null }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim()

    if (!content) return { isScam: false, score: 0, reason: null }

    const clean = content.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)

    return {
      isScam: result.scamScore >= 65,
      score: result.scamScore || 0,
      category: result.category || 'safe',
      reason: result.reason || null,
    }
  } catch (err) {
    clearTimeout(timer)
    return { isScam: false, score: 0, reason: null }
  }
}

module.exports = { analyzeMessageForScam }