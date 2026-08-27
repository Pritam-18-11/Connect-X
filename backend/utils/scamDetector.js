const GROQ_TIMEOUT_MS = 15000

async function analyzeMessageForScam(messageText) {
  if (!messageText || messageText.trim().length < 5) {
    return { scamScore: 0, category: 'safe', reason: 'Message too short to analyze.', advice: null }
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
            content: `You are an expert scam detection AI. Analyze messages for scam indicators including suspicious links, phishing, lottery scams, job scams, financial fraud, and social engineering.

IMPORTANT RULES:
- Normal money discussions between friends = NOT a scam
- Urgent requests for money from strangers = HIGH scam
- Suspicious links (bit.ly, tinyurl with promises) = HIGH scam
- Lottery/prize wins = HIGH scam
- "Click this link to claim reward" = HIGH scam
- Job offers with upfront payment = HIGH scam
- OTP requests = HIGH scam
- Normal conversations = safe

Respond ONLY with valid JSON:
{
  "scamScore": 0-100,
  "category": "safe|phishing|lottery|job_scam|suspicious_link|financial_fraud|otp_fraud|social_engineering",
  "reason": "one clear sentence explaining why",
  "advice": "one clear sentence on what the user should do"
}

Score guide:
0-24 = Not a scam
25-34 = Unlikely scam
35-60 = Suspicious
61-100 = High scam probability`,
          },
          {
            role: 'user',
            content: `Analyze this message for scam: "${messageText}"`,
          },
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
    })

    clearTimeout(timer)

    if (!response.ok) throw new Error('API failed')

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error('No content')

    const clean = content.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)

    return {
      scamScore: result.scamScore || 0,
      category: result.category || 'safe',
      reason: result.reason || 'Analysis complete.',
      advice: result.advice || null,
    }
  } catch (err) {
    clearTimeout(timer)
    return { scamScore: 0, category: 'safe', reason: 'Could not analyze.', advice: null }
  }
}

module.exports = { analyzeMessageForScam }