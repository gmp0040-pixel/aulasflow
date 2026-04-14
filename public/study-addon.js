// ========================
// STUDY ADDON — AulaFlow
// Claude AI powered
// ========================

async function openStudyScreen(lessonId, lessonTitle) {
  currentLessonId = lessonId;

  let screen = document.getElementById('study-screen');
  if (!screen) {
    screen = document.createElement('div');
    screen.id = 'study-screen';
    document.body.appendChild(screen);
  }

  screen.innerHTML = `
    <div class="study-container">
      <div class="study-header">
        <button class="study-back-btn" onclick="closeStudyScreen()">← Voltar</button>
        <div class="study-title-area">
          <h1 class="study-lesson-title">${escHtml(lessonTitle)}</h1>
          <span class="study-badge">Modo Estudo</span>
        </div>
        <div class="study-header-actions">
          <button class="study-btn study-btn-present" onclick="startPresentationStudy()">📺 Apresentar</button>
        </div>
      </div>

      <div class="study-body">
        <div class="study-main" id="study-main">
          <div class="study-welcome" id="study-welcome">
            <div class="study-welcome-icon">🎓</div>
            <h2>Pronto para estudar?</h2>
            <p>Clique em <strong>Pesquisar sobre o tema</strong> para gerar conteúdo completo com IA sobre <em>${escHtml(lessonTitle)}</em></p>
            <button class="study-btn study-btn-primary study-btn-lg" onclick="searchTopic('${escHtml(lessonTitle)}')">🔍 Pesquisar sobre o tema</button>
          </div>

          <div id="study-content-area" style="display:none">
            <div class="study-content-toolbar">
              <span class="study-content-label">📄 Pesquisa</span>
              <div class="study-content-actions">
                <button class="study-btn study-btn-sm" onclick="searchTopic('${escHtml(lessonTitle)}')">🔄 Pesquisar novamente</button>
                <button class="study-btn study-btn-primary study-btn-sm" onclick="openCreateSlides()">🎞️ Criar Slides</button>
                <button class="study-btn study-btn-success study-btn-sm" onclick="saveStudyContent()">💾 Salvar</button>
              </div>
            </div>
            <div id="study-research-content" class="study-research-body"></div>
          </div>
        </div>

        <div class="study-sidebar" id="study-sidebar" style="display:none">
          <div class="study-sidebar-header">
            <span>📝 Anotações do Professor</span>
            <span class="study-private-badge">Privado</span>
          </div>
          <div id="study-notes-content" class="study-notes-body"></div>
          <div class="study-sidebar-footer">
            <button class="study-btn study-btn-primary w-full" onclick="regenerateNotes()">🔄 Regenerar Anotações</button>
          </div>
        </div>
      </div>

      <!-- Slides Modal -->
      <div id="slides-modal" class="study-modal-overlay" style="display:none">
        <div class="study-modal">
          <div class="study-modal-header">
            <h3>🎞️ Criar Slides</h3>
            <button onclick="closeSlideModal()" class="study-modal-close">✕</button>
          </div>
          <div class="study-modal-body">
            <div class="form-group">
              <label class="form-label">Quantos slides?</label>
              <input type="number" id="slides-count" class="form-input" value="12" min="6" max="20">
            </div>
            <div class="form-group">
              <label class="form-label">Nível de detalhe</label>
              <select id="slides-detail" class="form-select">
                <option value="complete">Completo (recomendado)</option>
                <option value="moderate">Moderado</option>
                <option value="concise">Conciso</option>
              </select>
            </div>
          </div>
          <div class="study-modal-footer">
            <button class="study-btn" onclick="closeSlideModal()">Cancelar</button>
            <button class="study-btn study-btn-primary" onclick="generateSlides()">✨ Gerar Slides com IA</button>
          </div>
        </div>
      </div>

      <!-- Slides Preview Modal -->
      <div id="slides-preview-modal" class="study-modal-overlay" style="display:none">
        <div class="study-modal study-modal-xl">
          <div class="study-modal-header">
            <h3>🎞️ Slides Gerados</h3>
            <button onclick="closeSlidePreview()" class="study-modal-close">✕</button>
          </div>
          <div id="slides-preview-content" class="study-modal-body study-slides-grid"></div>
          <div class="study-modal-footer">
            <button class="study-btn" onclick="generateSlides()">🔄 Regerar</button>
            <button class="study-btn study-btn-primary" onclick="saveAndPresent()">📺 Salvar e Apresentar</button>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div id="study-loading" class="study-loading-overlay" style="display:none">
        <div class="study-loading-box">
          <div class="study-spinner"></div>
          <p id="study-loading-text">Pesquisando com IA...</p>
        </div>
      </div>
    </div>
  `;

  screen.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  await loadSavedStudyContent(lessonId);
}

function closeStudyScreen() {
  const s = document.getElementById('study-screen');
  if (s) s.style.display = 'none';
  document.body.style.overflow = '';
}

async function searchTopic(topic) {
  showStudyLoading(`Pesquisando sobre "${topic}" com IA...`);
  try {
    const content = await claudeAI(
      `Faça uma pesquisa COMPLETA e DETALHADA sobre o tema educacional: "${topic}".
      
      Estruture o conteúdo com:
      
      ## 1. Introdução e Contexto
      - Definição clara do tema
      - Importância e relevância
      - Contexto histórico (se aplicável)
      
      ## 2. Conceitos Fundamentais
      - Conceitos-chave com definições
      - Terminologia importante
      
      ## 3. Desenvolvimento do Tema
      - Tópicos principais com explicações detalhadas
      - Subtópicos relevantes
      - Exemplos concretos
      
      ## 4. Aplicações e Exemplos Práticos
      - Como este tema se aplica na prática
      - Exemplos do cotidiano
      - Exercícios ou atividades sugeridas
      
      ## 5. Curiosidades e Aprofundamento
      - Fatos interessantes
      - Pesquisas relevantes
      - Conexões interdisciplinares
      
      ## 6. Síntese
      - Pontos mais importantes para fixar
      - Como avaliar a aprendizagem
      
      Escreva de forma clara e didática, ideal para professores usarem em sala de aula.`,
      'Você é um especialista em educação. Crie conteúdo rico, detalhado e bem estruturado em português brasileiro.'
    );

    const notes = await claudeAI(
      `Com base neste conteúdo sobre "${topic}", crie anotações práticas para o professor:
      
      ${content.substring(0, 2000)}
      
      Inclua:
      - O que enfatizar em cada parte
      - Dicas para engajar os alunos
      - Possíveis perguntas dos alunos e como responder
      - Sugestões de exemplos para usar
      - Tempo sugerido por tópico`,
      'Crie anotações pedagógicas práticas e objetivas em português.'
    );

    document.getElementById('study-welcome').style.display = 'none';
    document.getElementById('study-content-area').style.display = 'block';
    document.getElementById('study-research-content').innerHTML = markdownToHtml(content);
    document.getElementById('study-sidebar').style.display = 'flex';
    document.getElementById('study-notes-content').innerHTML = markdownToHtml(notes);

    currentLessonData.research = content;
    currentLessonData.notes = notes;
    toast('Pesquisa concluída!', 'success');
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  } finally {
    hideStudyLoading();
  }
}

async function regenerateNotes() {
  if (!currentLessonData.research) return toast('Faça a pesquisa primeiro', 'error');
  showStudyLoading('Gerando anotações...');
  try {
    const notes = await claudeAI(
      `Com base no conteúdo sobre "${currentLessonData.title || 'o tema'}":
      
      ${currentLessonData.research.substring(0, 2000)}
      
      Crie anotações detalhadas do professor com:
      - Dicas de como apresentar cada tópico
      - Perguntas para estimular a discussão
      - Exemplos adicionais
      - Sugestões de atividades`,
      'Crie anotações pedagógicas práticas em português.'
    );
    document.getElementById('study-notes-content').innerHTML = markdownToHtml(notes);
    currentLessonData.notes = notes;
    toast('Anotações regeneradas!', 'success');
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  } finally {
    hideStudyLoading();
  }
}

function openCreateSlides() { document.getElementById('slides-modal').style.display = 'flex'; }
function closeSlideModal() { document.getElementById('slides-modal').style.display = 'none'; }
function closeSlidePreview() { document.getElementById('slides-preview-modal').style.display = 'none'; }

async function generateSlides() {
  if (!currentLessonData.research) return toast('Faça a pesquisa primeiro', 'error');
  closeSlideModal();

  const count = parseInt(document.getElementById('slides-count')?.value || 12);
  const detail = document.getElementById('slides-detail')?.value || 'complete';

  const detailInstructions = {
    complete: 'COMPLETOS com 5-7 tópicos por slide, cada tópico sendo uma frase completa e informativa. Adicione subtópicos para aprofundar conceitos importantes.',
    moderate: 'com 4-5 tópicos por slide, frases completas e explicativas.',
    concise: 'com 3-4 tópicos por slide, claros e objetivos.'
  };

  showStudyLoading(`Criando ${count} slides completos com IA...`);
  try {
    const result = await claudeJSON(
      `Crie ${count} slides ${detailInstructions[detail]} para aula sobre: "${currentLessonData.title || 'o tema'}".
      
      Conteúdo de referência: ${currentLessonData.research.substring(0, 3500)}
      
      Retorne APENAS JSON válido (sem markdown, sem texto extra):
      {
        "slides": [
          {
            "type": "intro",
            "title": "Título claro do slide",
            "subtitle": "Subtítulo contextual (opcional)",
            "points": [
              "Tópico 1: explicação completa em 1-2 frases que o professor pode ler diretamente",
              "Tópico 2: contexto e informação relevante para os alunos",
              "Tópico 3: conceito explicado de forma clara e acessível",
              "Tópico 4: exemplo ou aplicação prática do conceito",
              "Tópico 5: informação complementar importante"
            ],
            "subpoints": {
              "Tópico 1": ["Detalhe a para aprofundamento", "Detalhe b com exemplo"],
              "Tópico 3": ["Definição técnica", "Como se aplica na prática"]
            },
            "highlight": "Frase-chave mais importante deste slide para destacar",
            "note": "Dica pedagógica: como abordar este conteúdo, exemplos extras, tempo sugerido"
          }
        ]
      }
      
      REGRAS:
      - Tipos possíveis: intro, content, example, activity, summary, conclusion
      - 1º slide = intro, últimos 2 = summary e conclusion
      - Inclua pelo menos 1 slide de "example" e 1 de "activity"
      - Points devem ser frases COMPLETAS e INFORMATIVAS (não palavras soltas!)
      - O campo "highlight" é a frase mais importante do slide
      - O campo "note" é exclusivo para o professor (não aparece na apresentação pública)
      - Linguagem clara, correta, em português do Brasil`,
      'Você é especialista em design instrucional. Retorne APENAS JSON válido, sem explicações ou markdown.'
    );

    presentationSlides = result.slides || [];
    currentLessonData.slides = JSON.stringify(result);

    renderSlidesPreview(result.slides);
    document.getElementById('slides-preview-modal').style.display = 'flex';
    toast('Slides criados!', 'success');
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  } finally {
    hideStudyLoading();
  }
}

function renderSlidesPreview(slides) {
  const c = document.getElementById('slides-preview-content');
  const typeColors = {
    intro: '#6366f1', content: '#10b981', example: '#f59e0b',
    activity: '#06b6d4', summary: '#a855f7', conclusion: '#ec4899'
  };
  const typeLabels = {
    intro: 'Introdução', content: 'Conteúdo', example: 'Exemplo',
    activity: 'Atividade', summary: 'Resumo', conclusion: 'Conclusão'
  };

  c.innerHTML = slides.map((s, i) => {
    const color = typeColors[s.type] || '#6366f1';
    const label = typeLabels[s.type] || 'Conteúdo';
    return `
    <div class="slide-card slide-card-${s.type || 'content'}">
      <div class="slide-card-header" style="border-top:3px solid ${color}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:1px">${label}</span>
          <span class="slide-card-number">${i + 1}</span>
        </div>
        <h3 class="slide-card-title">${escHtml(s.title)}</h3>
        ${s.subtitle ? `<p class="slide-card-subtitle">${escHtml(s.subtitle)}</p>` : ''}
      </div>
      <div class="slide-card-body">
        ${s.points && s.points.length ? `
          <ul class="slide-card-points">
            ${s.points.map(p => `<li>${escHtml(p)}</li>`).join('')}
          </ul>` : ''}
        ${s.highlight ? `<div class="slide-card-highlight">💡 ${escHtml(s.highlight)}</div>` : ''}
        ${s.note ? `<div class="slide-card-note">📌 Prof: ${escHtml(s.note)}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function saveAndPresent() {
  await saveStudyContent();
  closeSlidePreview();
  startPresentationStudy();
}

async function saveStudyContent() {
  if (!currentLessonId) return;
  try {
    const sb = getSupabase();
    await sb.from('lessons').update({
      research: currentLessonData.research || null,
      notes: currentLessonData.notes || null,
      slides: currentLessonData.slides || null
    }).eq('id', currentLessonId);
    toast('Conteúdo salvo!', 'success');
  } catch (err) {
    toast('Erro ao salvar: ' + err.message, 'error');
  }
}

async function loadSavedStudyContent(lessonId) {
  try {
    const sb = getSupabase();
    const { data: lesson } = await sb.from('lessons').select('*').eq('id', lessonId).single();
    if (lesson && lesson.research) {
      currentLessonData.research = lesson.research;
      currentLessonData.notes = lesson.notes;
      currentLessonData.slides = lesson.slides;
      if (lesson.slides) {
        try { presentationSlides = JSON.parse(lesson.slides).slides || []; } catch {}
      }
      document.getElementById('study-welcome').style.display = 'none';
      document.getElementById('study-content-area').style.display = 'block';
      document.getElementById('study-research-content').innerHTML = markdownToHtml(lesson.research);
      if (lesson.notes) {
        document.getElementById('study-sidebar').style.display = 'flex';
        document.getElementById('study-notes-content').innerHTML = markdownToHtml(lesson.notes);
      }
    }
  } catch {}
}

function startPresentationStudy() {
  if (currentLessonData.slides) {
    try { presentationSlides = JSON.parse(currentLessonData.slides).slides || []; } catch {}
  }
  if (!presentationSlides || presentationSlides.length === 0) return toast('Crie os slides primeiro', 'error');
  currentSlide = 0;

  let p = document.getElementById('presentation-screen');
  if (!p) {
    p = document.createElement('div');
    p.id = 'presentation-screen';
    document.body.appendChild(p);
  }
  renderPresentationScreen();
  p.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function renderPresentationScreen() {
  const p = document.getElementById('presentation-screen');
  const slide = presentationSlides[currentSlide];
  const notes = currentLessonData.notes || '';
  const total = presentationSlides.length;

  const typeColors = {
    intro: { accent: '#6366f1', bg: 'rgba(99,102,241,0.08)', label: '📖 Introdução' },
    content: { accent: '#10b981', bg: 'rgba(16,185,129,0.06)', label: '📚 Conteúdo' },
    example: { accent: '#f59e0b', bg: 'rgba(245,158,11,0.06)', label: '💡 Exemplo' },
    activity: { accent: '#06b6d4', bg: 'rgba(6,182,212,0.06)', label: '✏️ Atividade' },
    summary: { accent: '#a855f7', bg: 'rgba(168,85,247,0.06)', label: '📋 Resumo' },
    conclusion: { accent: '#ec4899', bg: 'rgba(236,72,153,0.06)', label: '🏁 Conclusão' },
  };
  const style = typeColors[slide.type] || typeColors.content;

  p.innerHTML = `
    <div class="pres-layout">
      <div class="pres-slide-area">
        <div class="pres-slide" style="background:${style.bg};border-top:4px solid ${style.accent}">
          <div class="pres-slide-meta">
            <span class="pres-slide-type-badge" style="color:${style.accent};background:${style.bg}">${style.label}</span>
            <span class="pres-slide-num">${currentSlide + 1} / ${total}</span>
          </div>

          ${slide.subtitle ? `<p class="pres-slide-subtitle">${escHtml(slide.subtitle)}</p>` : ''}
          <h2 class="pres-slide-title" style="color:${style.accent}">${escHtml(slide.title)}</h2>

          ${slide.points && slide.points.length ? `
            <ul class="pres-slide-points">
              ${slide.points.map((point, idx) => {
                const hasSubpoints = slide.subpoints && slide.subpoints[point];
                return `
                <li class="pres-point" style="animation-delay:${idx * 0.07}s">
                  <span class="pres-point-bullet" style="background:${style.accent}"></span>
                  <div class="pres-point-content">
                    <span class="pres-point-text">${escHtml(point)}</span>
                    ${hasSubpoints ? `<ul class="pres-subpoints">${slide.subpoints[point].map(sp => `<li>${escHtml(sp)}</li>`).join('')}</ul>` : ''}
                  </div>
                </li>`;
              }).join('')}
            </ul>` : ''}

          ${slide.highlight ? `
            <div class="pres-highlight" style="border-color:${style.accent};color:${style.accent}">
              ✨ ${escHtml(slide.highlight)}
            </div>` : ''}
        </div>

        <div class="pres-controls">
          <button class="pres-btn" onclick="prevSlideStudy()" ${currentSlide === 0 ? 'disabled' : ''}>← Anterior</button>
          <div class="pres-progress">
            ${presentationSlides.map((_, i) => `<div class="pres-dot ${i === currentSlide ? 'active' : ''}" onclick="goToSlideStudy(${i})" style="${i === currentSlide ? `background:${style.accent}` : ''}"></div>`).join('')}
          </div>
          <button class="pres-btn pres-btn-primary" onclick="nextSlideStudy()" ${currentSlide === total - 1 ? 'disabled' : ''} style="background:${style.accent}">Próximo →</button>
        </div>
      </div>

      <div class="pres-teacher-panel">
        <div class="pres-teacher-header">
          <span>🎓 Painel do Professor</span>
          <button class="pres-close-btn" onclick="closePresentationScreen()">✕ Fechar</button>
        </div>

        ${slide.note ? `
          <div class="pres-slide-note">
            <div class="pres-notes-label">📌 Nota deste slide</div>
            <div class="pres-note-text">${escHtml(slide.note)}</div>
          </div>` : ''}

        <div class="pres-search-area">
          <div class="pres-search-label">🔍 Pesquisa Rápida com IA</div>
          <div class="pres-search-row">
            <input type="text" id="pres-search-input" class="pres-search-input" placeholder="Pesquise algo para explicar melhor...">
            <button class="pres-btn pres-btn-primary" onclick="presSearch()" style="background:${style.accent}">Buscar</button>
          </div>
          <div id="pres-search-result" class="pres-search-result"></div>
        </div>

        <div class="pres-notes-area">
          <div class="pres-notes-label">📝 Suas Anotações</div>
          <div class="pres-notes-content">${markdownToHtml(notes)}</div>
        </div>
      </div>
    </div>
  `;
}

function nextSlideStudy() {
  if (currentSlide < presentationSlides.length - 1) { currentSlide++; renderPresentationScreen(); }
}
function prevSlideStudy() {
  if (currentSlide > 0) { currentSlide--; renderPresentationScreen(); }
}
function goToSlideStudy(i) { currentSlide = i; renderPresentationScreen(); }

function closePresentationScreen() {
  const p = document.getElementById('presentation-screen');
  if (p) p.style.display = 'none';
  document.body.style.overflow = '';
}

async function presSearch() {
  const q = document.getElementById('pres-search-input').value.trim();
  if (!q) return;
  const r = document.getElementById('pres-search-result');
  r.innerHTML = '<div class="pres-search-loading">🤔 Buscando com IA...</div>';
  try {
    const result = await claudeAI(
      `Explique de forma clara e objetiva para um professor usar em sala de aula: "${q}". 
       Seja direto, use exemplos práticos e linguagem acessível. Máximo 3 parágrafos.`
    );
    r.innerHTML = `<div class="pres-search-answer">${markdownToHtml(result)}</div>`;
  } catch (err) {
    r.innerHTML = `<div class="pres-search-error">Erro: ${err.message}</div>`;
  }
}

function showStudyLoading(text) {
  const el = document.getElementById('study-loading');
  if (el) {
    el.style.display = 'flex';
    document.getElementById('study-loading-text').textContent = text || 'Carregando...';
  }
}
function hideStudyLoading() {
  const el = document.getElementById('study-loading');
  if (el) el.style.display = 'none';
}

document.addEventListener('keydown', (e) => {
  const p = document.getElementById('presentation-screen');
  if (p && p.style.display === 'flex') {
    if (e.key === 'ArrowRight' || e.key === ' ') nextSlideStudy();
    if (e.key === 'ArrowLeft') prevSlideStudy();
    if (e.key === 'Escape') closePresentationScreen();
  }
});
