module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GROQ_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_KEY) {
    return res.status(500).json({ error: 'API key não configurada' });
  }

  try {
    const { prompt, system, max_tokens } = req.body;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: max_tokens || 4000,
        messages: [
          { role: 'system', content: system || 'Você é um assistente educacional especializado em criar conteúdo pedagógico de alta qualidade em português brasileiro.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Erro na API Groq');

    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Resposta vazia');

    return res.status(200).json({ content: text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
