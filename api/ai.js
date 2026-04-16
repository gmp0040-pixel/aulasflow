

Iniciar teste gratuito

Compartilhar
Slides
analise esse prompt e eu quero que ao fazer a pesquisa nao fique falando em reforma protestante  ou teologia reformada fale sobre o assunto de forma neutra nessas questoes lemabrando que as aulas são pra o seminario presbiteriano reformando mas nao precisa ficar lembrando disso                
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
Lite
Entendido! Vou criar os slides para a sua apresentação de seminário. Vou analisar o prompt fornecido para extrair o tema e o conteúdo, garantindo uma abordagem neutra em relação à Reforma Protestante e à teologia reformada, conforme solicitado, mantendo o nível acadêmico e pastoral adequado para um seminário. Vou preparar um plano detalhado para a estrutura de 8 a 12 slides.
não nao é criar slides e sim arrumar o codigo 
Lite
Peço desculpas pelo mal-entendido. Entendi agora que o seu objetivo não é criar os slides, mas sim corrigir e ajustar o código que você enviou, seguindo as instruções de neutralidade e tom acadêmico que você mencionou. Vou analisar o código Node.js/Groq agora mesmo para aplicar essas melhorias.
Análise do código Node.js identificou pontos que podem reforçar neutralidade e formalidade acadêmica, eliminando referências específicas à Reforma ou denominações. Próximo passo: aplicar ajustes para manter o tom adequado.

Lite
Conforme solicitado, ajustei o código do seu handler Node.js para garantir uma abordagem neutra e acadêmica, removendo as menções específicas à Reforma Protestante e à teologia reformada no SYSTEM_DEFAULT.
As principais alterações foram:
Neutralidade Teológica: Removi a identificação como "teólogo reformado" e as referências a denominações específicas (Presbiteriana, Batista Reformada, etc.).
Referências Amplas: Substituí a lista de teólogos reformados por uma instrução para citar autores do pensamento cristão histórico de forma ampla e equilibrada.
Foco Acadêmico e Pastoral: Mantive o rigor de nível de seminário e as regras de qualidade (não repetição de sujeitos, referências bíblicas específicas, etc.), mas sem o viés denominacional.
Contexto de Seminário: O prompt agora se posiciona como um professor de alto nível para diversas denominações cristãs, focando exclusivamente nas Escrituras Sagradas.
O arquivo com o código corrigido está anexo.
handler_fixed.js
Código · 2.69 KB
Ver todos os arquivos nesta tarefa
Como foi este resultado?
Atualizei o handler para remover referências específicas à Reforma e denominações, adotando uma abordagem neutra, acadêmica e pastoral, focada em autores históricos do pensamento cristão.

posso colar no github?
Lite
Sim, você pode colar o código no GitHub sem problemas! O código está estruturado como uma função Serverless Handler (comum em plataformas como Vercel ou Netlify).
No entanto, antes de publicar, recomendo atenção a dois pontos importantes de segurança e boas práticas:
Variáveis de Ambiente: O código utiliza process.env.GROQ_API_KEY. Certifique-se de nunca escrever sua chave de API diretamente no código (hardcoded). No GitHub, você deve configurar essa chave nos "Secrets" do repositório ou nas configurações da sua plataforma de hospedagem.
Arquivo .gitignore: Se você estiver subindo o projeto inteiro, garanta que arquivos como .env (onde geralmente ficam as chaves locais) estejam listados no seu .gitignore para não serem expostos publicamente.
O código em si está limpo, funcional e agora segue as diretrizes de neutralidade que você solicitou. Se precisar de ajuda para criar o arquivo README.md ou configurar o repositório, estou à disposição!
Tarefa concluída
Como foi este resultado?
Sugestões de acompanhamento




handler_fixed.js
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

    const SYSTEM_DEFAULT = `Você é um professor e teólogo de alto nível, especialista em criar conteúdo pedagógico excepcional em português brasileiro para formação ministerial em seminário teológico.

IDENTIDADE E CONTEXTO:
- Você escreve para um seminário com alunos de diversas denominações cristãs.
- Seu conteúdo é fundamentado exclusivamente nas Escrituras Sagradas, mantendo uma abordagem acadêmica e equilibrada.
- Ao citar autores ou teólogos, busque uma representação ampla e relevante para o pensamento cristão histórico, focando na profundidade bíblica e exegética.
- Mantenha a neutralidade em questões denominacionais específicas, focando no ensino teológico sólido e na formação pastoral.

REGRAS DE QUALIDADE — OBRIGATÓRIAS:
1. NUNCA repita o mesmo sujeito em frases ou tópicos consecutivos.
2. NUNCA repita conceitos — cada ponto deve trazer informação NOVA e DISTINTA.
3. Varie a estrutura: use sujeitos diferentes, verbos variados e perspectivas distintas.
4. Cada seção deve cobrir um ângulo único: bíblico, histórico, doutrinal, prático ou pastoral.
5. Utilize referências bíblicas ESPECÍFICAS com capítulo e versículo (ex: Rm 8.28-30).
6. Cada ponto deve ser uma frase COMPLETA e INFORMATIVA — evite palavras soltas.
7. Nível de seminário: profundo mas acessível, pastoral mas rigoroso.

FORMATO:
- Títulos com ## e subtítulos com ###.
- Listas com - para pontos principais.
- Conteúdo rico, denso, sem repetições e sem enchimento.`;

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
Manus
