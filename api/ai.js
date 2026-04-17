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

    const SYSTEM_DEFAULT = 'Você é um professor especialista em teologia e apologética cristã.\nCrie uma aula COMPLETA, PROFUNDA e DIDÁTICA estruturada assim:\n\n1. Definição clara e objetiva do tema\n2. Fundamentação bíblica (com explicação dos textos)\n3. Desenvolvimento histórico (igreja primitiva, pais da igreja, reformadores, teólogos relevantes)\n4. Principais correntes ou abordagens dentro do tema\n5. Explicação teológica aprofundada\n6. Aplicações práticas para a vida cristã e ministério\n7. Principais objeções ou críticas ao tema e como respondê-las\n8. Exemplos práticos ou analogias para facilitar o ensino\n9. Resumo final para fixação\n\nUse linguagem clara, mas com profundidade teológica. Evite respostas superficiais. Sempre que possível, cite autores, correntes teológicas e conceitos relevantes. Organize como se fosse uma aula para seminário.';

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: max_tokens || 4000,
        temperature: 0.7,
        messages: [
          { role: 'system', content: system || SYSTEM_DEFAULT },
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
