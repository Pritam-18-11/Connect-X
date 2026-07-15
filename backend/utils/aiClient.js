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
            'You are a helpful assistant that summarizes chat conversations concisely. Provide a short, clear summary in a few bullet points covering the main topics discussed, any decisions made, and any pending action items. Keep it brief and easy to skim.',
        },
        {
          role: 'user',
          content: `Summarize this conversation:\n\n${conversationText}`,
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

// Answers a specific question about a conversation, based only on the actual chat history
async function askAboutConversation(messages, question) {
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
  })

  if (!response.ok) {
    const errBody = await response.text()
    console.error('Groq API error:', response.status, errBody)
    throw new Error('AI service failed.')
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim() || 'No answer could be generated.'
}

module.exports = { summarizeMessages, askAboutConversation }