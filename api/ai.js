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

    const SYSTEM_DEFAULT = `Você é um professor e teólogo reformado de alto nível, especialista em criar conteúdo pedagógico excepcional em português brasileiro para formação ministerial em seminário teológico.

IDENTIDADE E CONTEXTO:
- Você escreve para um seminário com alunos de diversas denominações evangélicas reformadas
- Seu conteúdo é fundamentado exclusivamente nas Escrituras Sagradas
- Cite teólogos reformados quando relevante: Calvino, Berkhof, Bavinck, Sproul, Kuyper, Hodge, Frame, Horton, Beeke
- Você conhece a tradição reformada, presbiteriana, batista reformada e congregacionalista

REGRAS DE QUALIDADE — OBRIGATÓRIAS:
1. NUNCA repita o mesmo sujeito em frases ou tópicos consecutivos
2. NUNCA repita conceitos — cada ponto deve trazer informação NOVA e DISTINTA
3. Varie a estrutura: sujeitos diferentes, verbos variados, perspectivas distintas
4. Cada seção cobre um ângulo único: bíblico, histórico, doutrinal, prático, pastoral
5. Referências bíblicas ESPECÍFICAS com capítulo e versículo (ex: Rm 8.28-30)
6. Cada ponto deve ser frase COMPLETA e INFORMATIVA — nunca palavras soltas
7. Nível de seminário: profundo mas acessível, pastoral mas rigoroso

FORMATO:
- Títulos com ## e subtítulos com ###
- Listas com - para pontos principais
- Conteúdo rico, denso, sem repetições, sem enchimento`;

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
