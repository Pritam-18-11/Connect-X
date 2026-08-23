const GROQ_TIMEOUT_MS = 15000 // 15 seconds

// ✅ Helper: fetch with timeout
async function fetchWithTimeout(url, options, timeoutMs = GROQ_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timer)
  }
}

async function summarizeMessages(messages) {
  const conversationText = messages
    .map((m) => `${m.senderName}: ${m.text}`)
    .join('\n')

  try {
    const response = await fetchWithTimeout(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that answers questions about a private conversation. Answer based ONLY on what was actually discussed in the chat. Keep your answer short and to the point — 2 to 4 sentences maximum. Do not add extra information, explanations, or examples beyond what was mentioned in the conversation. If the topic was not discussed, say so in one sentence.',
            },
            {
              role: 'user',
              content: `Summarize this conversation:\n\n${conversationText}`,
            },
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
      }
    )

    if (!response.ok) {
      const errBody = await response.text()
      console.error('Groq API error:', response.status, errBody)
      throw new Error('AI summarization service failed.')
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content?.trim() || 'No summary could be generated.'
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('AI service timed out. Please try again.')
    }
    throw err
  }
}

async function askAboutConversation(messages, question) {
  const conversationText = messages
    .map((m) => `${m.senderName}: ${m.text}`)
    .join('\n')

  try {
    const response = await fetchWithTimeout(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant that answers questions about a private conversation between two people, using only the provided chat history. Give a detailed, clear answer that references what was actually discussed, including relevant context around it. If the topic was never discussed in this conversation, say so honestly instead of making anything up.',
            },
            {
              role: 'user',
              content: `Here is the full conversation:\n\n${conversationText}\n\nQuestion: ${question}`,
            },
          ],
          max_tokens: 700,
          temperature: 0.3,
        }),
      }
    )

    if (!response.ok) {
      const errBody = await response.text()
      console.error('Groq API error:', response.status, errBody)
      throw new Error('AI service failed.')
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content?.trim() || 'No answer could be generated.'
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('AI service timed out. Please try again.')
    }
    throw err
  }
}

module.exports = { summarizeMessages, askAboutConversation }