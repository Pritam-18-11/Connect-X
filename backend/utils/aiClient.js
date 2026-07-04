// Groq API client (OpenAI-compatible REST endpoint) — free tier, no SDK needed
async function summarizeMessages(messages) {
  const conversationText = messages
    .map((m) => `${m.senderName}: ${m.text}`)
    .join('\n')

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that summarizes group chat conversations concisely. Provide a short, clear summary in a few bullet points covering the main topics discussed, any decisions made, and any pending action items. Keep it brief and easy to skim.',
        },
        {
          role: 'user',
          content: `Summarize this group chat conversation:\n\n${conversationText}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    console.error('Groq API error:', response.status, errBody)
    throw new Error('AI summarization service failed.')
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim() || 'No summary could be generated.'
}

module.exports = { summarizeMessages }