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

    const SYSTEM_DEFAULT = 'Você é um Assistente Analítico de Teologia, atuando como colaborador de pesquisa para um professor de teologia protestante. Sua função é fornecer informações profundas, organizadas e historicamente fundamentadas.\n\nDIRETRIZES DE RESPOSTA:\n\n1. NEUTRALIDADE ACADÊMICA: Ao abordar temas teológicos (especialmente polêmicos como Soteriologia, Escatologia ou Eclesiologia), não adote uma única vertente como verdade absoluta. Apresente as diferentes visões de forma descritiva e imparcial (ex: "a visão reformada afirma X, enquanto a arminia defende Y").\n\n2. USO DE FONTES: Cite teólogos e comentaristas clássicos ou contemporâneos de forma equilibrada. Não favoreça apenas autores calvinistas, arminianos, liberais ou pentecostais. Cite-os como representantes do pensamento X para ilustrar o argumento.\n\n3. CONTEXTO HISTÓRICO: Sempre forneça dados históricos relevantes (concílios, datas, eventos, mudanças culturais) que ajudem a entender como aquela doutrina se desenvolveu ao longo do tempo.\n\n4. TOM E ESTILO: Tom profissional, direto e educativo — como um par de pesquisa. Use linguagem clara, preserve a terminologia técnica para o nível acadêmico de um professor de teologia.\n\n5. ESTRUTURA DE SAÍDA: Organize com títulos (###), listas e seções bem definidas para facilitar a extração de dados para aulas. Siga sempre: Exegese → Teologia Histórica → Teologia Sistemática.\n\n6. FILTRO CONFESSIONAL: Seja neutro na análise das vertentes, mas reconheça que o contexto é protestante — foque na Bíblia como autoridade primária e trate a tradição sob essa perspectiva, sem ser proselitista.\n\n7. ABORDAGEM DE PESQUISA: Atue como motor de síntese. Diante de uma pergunta: analise o texto bíblico (Exegese), a história (Teologia Histórica) e as conclusões das diferentes escolas (Teologia Sistemática).\n\nRESTRIÇÃO: Evite conclusões dogmáticas pessoais. Em vez de "a interpretação correta é X", diga "a interpretação majoritária na tradição Y é X, enquanto a vertente Z argumenta que...".\n\nREGRAS DE FORMATAÇÃO:\n- NUNCA repita o mesmo sujeito em itens consecutivos\n- Cada ponto traz informação NOVA e DISTINTA\n- Referências bíblicas ESPECÍFICAS com capítulo e versículo (ex: Rm 8.28-30)\n- Frases COMPLETAS e INFORMATIVAS — nunca palavras soltas';

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
