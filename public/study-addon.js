// ========================
// STUDY ADDON — AulaFlow
// Sistema para Seminário Presbiteriano Renovado
// ========================

const SEMINARY_SYSTEM = 'Você é um assistente teológico especializado em teologia reformada e presbiteriana renovada, para um seminário teológico presbiteriano renovado no Brasil. Todo conteúdo deve ser: fundamentado nas Escrituras Sagradas (use referências bíblicas específicas), alinhado com a fé reformada e presbiteriana, aberto à renovação e ao mover do Espírito Santo dentro dos limites da sã doutrina reformada. Cite teólogos reformados quando relevante (Calvino, Berkhof, Sproul, Kuyper, Hodge, Bavinck, etc.). Mantenha linguagem teológica adequada para formação ministerial. Escreva em português brasileiro. Seja detalhado, preciso e didático.';

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
            <div class="study-welcome-icon">✝️</div>
            <h2>Pronto para estudar?</h2>
            <p>Clique em <strong>Pesquisar sobre o tema</strong> para gerar conteúdo teológico completo com IA sobre <em>${escHtml(lessonTitle)}</em></p>
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
            <button class="study-btn" onclick="closeSlidePreview()">Cancelar</button>
            <button class="study-btn" onclick="generateSlides()">🔄 Regerar</button>
            <button class="study-btn study-btn-primary" onclick="saveAndPresent()">📺 Salvar e Apresentar</button>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div id="study-loading" class="study-loading-overlay" style="display:none">
        <div class="study-loading-box">
          <div class="study-spinner"></div>
          <p id="study-loading-text">Carregando...</p>
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
  showStudyLoading(`Pesquisando "${topic}" com IA...`);
  try {
    const content = await claudeAI(
      `Faça uma pesquisa COMPLETA e DETALHADA sobre o tema teológico: "${topic}" para um seminário presbiteriano renovado.
      
      Estruture com:
      ## 1. Introdução e Contexto Bíblico
      ## 2. Fundamentos Teológicos Reformados
      ## 3. Desenvolvimento Doutrinal
      ## 4. Aplicações Práticas para o Ministério
      ## 5. Perspectiva da Renovação dentro da Tradição Reformada
      ## 6. Síntese e Conclusão
      
      Use referências bíblicas específicas. Cite teólogos reformados quando relevante.`,
      SEMINARY_SYSTEM
    );

    const notes = await claudeAI(
      `Com base neste conteúdo teológico sobre "${topic}", crie anotações práticas para o professor do seminário:
      ${content.substring(0, 2000)}
      Inclua: pontos doutrinários essenciais a enfatizar, como conectar com a prática ministerial, perguntas para reflexão dos alunos, referências bíblicas-chave.`,
      SEMINARY_SYSTEM
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
      `Com base no conteúdo teológico: ${currentLessonData.research.substring(0, 2000)}
      Crie anotações do professor com dicas de ensino, referências bíblicas adicionais, perguntas para debate e sugestões de atividades para o seminário.`,
      SEMINARY_SYSTEM
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

  showStudyLoading(`Criando ${count} slides com IA...`);
  try {
    const result = await claudeJSON(
      `Crie ${count} slides COMPLETOS para aula teológica sobre: "${currentLessonData.title || 'o tema'}" em um seminário presbiteriano renovado.
      Conteúdo: ${currentLessonData.research.substring(0, 3500)}
      
      Retorne APENAS JSON:
      {"slides":[{"type":"intro","title":"","subtitle":"","points":["frase completa 1","frase completa 2","..."],"subpoints":{},"highlight":"frase chave ou versículo","note":"dica para o professor"}]}
      
      Tipos: intro, content, example, activity, summary, conclusion
      - 1º slide = intro, últimos 2 = summary e conclusion
      - Cada slide: 4-6 points com frases COMPLETAS
      - Inclua referências bíblicas nos points quando relevante
      - note = orientação exclusiva para o professor (não aparece na apresentação)`,
      'Retorne APENAS JSON válido. Contexto: seminário presbiteriano renovado.'
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
  const colors = { intro:'#6366f1', content:'#10b981', example:'#f59e0b', activity:'#06b6d4', summary:'#a855f7', conclusion:'#ec4899' };
  const labels = { intro:'Introdução', content:'Conteúdo', example:'Exemplo', activity:'Atividade', summary:'Resumo', conclusion:'Conclusão' };

  c.innerHTML = slides.map((s, i) => {
    const color = colors[s.type] || '#6366f1';
    const label = labels[s.type] || 'Conteúdo';
    return `
    <div class="slide-card" style="border-top:3px solid ${color}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:10px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:1px">${label}</span>
        <span style="font-size:11px;font-weight:700;color:#636878">${i + 1}</span>
      </div>
      <h3 style="font-size:13px;font-weight:700;color:#e8eaf0;margin-bottom:8px">${escHtml(s.title)}</h3>
      ${s.subtitle ? `<p style="font-size:11px;color:#9ca3b8;margin-bottom:6px">${escHtml(s.subtitle)}</p>` : ''}
      ${s.points && s.points.length ? `<ul style="list-style:none;padding:0;display:flex;flex-direction:column;gap:3px">${s.points.map(p => `<li style="font-size:10px;color:#9ca3b8;padding-left:10px;position:relative;line-height:1.4"><span style="position:absolute;left:0;color:${color}">•</span>${escHtml(p)}</li>`).join('')}</ul>` : ''}
      ${s.highlight ? `<div style="margin-top:8px;padding:4px 8px;border-left:2px solid ${color};font-size:10px;color:${color};font-style:italic">✨ ${escHtml(s.highlight)}</div>` : ''}
      ${s.note ? `<div style="margin-top:6px;padding:4px 8px;background:rgba(245,158,11,.08);border-radius:4px;font-size:9px;color:#f59e0b">📌 Prof: ${escHtml(s.note)}</div>` : ''}
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
    const { data: lesson } = await sb.from('lessons').select('*').eq('id', lessonId).maybeSingle();
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

function getSlideNotes(slideIndex) {
  const notes = currentLessonData.notes || '';
  if (!notes) return '';
  const slideNum = slideIndex + 1;
  const regex = new RegExp(`##\\s*Slide\\s*${slideNum}[^\\n]*\\n([\\s\\S]*?)(?=##\\s*Slide\\s*|$)`, 'i');
  const match = notes.match(regex);
  if (match) return match[0];
  const lines = notes.split('\n');
  const chunk = Math.ceil(lines.length / Math.max(presentationSlides.length, 1));
  return lines.slice(slideIndex * chunk, (slideIndex + 1) * chunk).join('\n') || notes.substring(0, 400);
}

function renderPresentationScreen() {
  const p = document.getElementById('presentation-screen');
  const slide = presentationSlides[currentSlide];
  const total = presentationSlides.length;

  const typeColors = {
    intro:      { accent: '#6366f1', bg: 'rgba(99,102,241,0.08)',  label: '📖 Introdução' },
    content:    { accent: '#10b981', bg: 'rgba(16,185,129,0.06)',  label: '📚 Conteúdo' },
    example:    { accent: '#f59e0b', bg: 'rgba(245,158,11,0.06)',  label: '💡 Exemplo' },
    activity:   { accent: '#06b6d4', bg: 'rgba(6,182,212,0.06)',   label: '✏️ Atividade' },
    summary:    { accent: '#a855f7', bg: 'rgba(168,85,247,0.06)',  label: '📋 Resumo' },
    conclusion: { accent: '#ec4899', bg: 'rgba(236,72,153,0.06)',  label: '🏁 Conclusão' },
  };
  const style = typeColors[slide.type] || typeColors.content;
  const slideNotes = getSlideNotes(currentSlide);

  p.innerHTML = `
    <div class="pres-layout">

      <!-- SLIDE AREA -->
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
                const hasSub = slide.subpoints && slide.subpoints[point];
                return `
                <li class="pres-point" style="animation-delay:${idx * 0.07}s">
                  <span class="pres-point-bullet" style="background:${style.accent}"></span>
                  <div class="pres-point-content">
                    <span class="pres-point-text">${escHtml(point)}</span>
                    ${hasSub ? `<ul class="pres-subpoints">${slide.subpoints[point].map(sp => `<li>${escHtml(sp)}</li>`).join('')}</ul>` : ''}
                  </div>
                </li>`;
              }).join('')}
            </ul>` : ''}

          ${slide.highlight ? `<div class="pres-highlight" style="border-color:${style.accent};color:${style.accent}">✨ ${escHtml(slide.highlight)}</div>` : ''}
        </div>

        <!-- CONTROLS -->
        <div class="pres-controls">
          <button class="pres-btn" style="background:rgba(244,63,94,.15);color:#f43f5e;border:1px solid rgba(244,63,94,.2)" onclick="closePresentationScreen()">✕ Sair</button>
          <button class="pres-btn" onclick="prevSlideStudy()" ${currentSlide === 0 ? 'disabled' : ''}>← Anterior</button>
          <div class="pres-progress">
            ${presentationSlides.map((_, i) => `<div class="pres-dot ${i === currentSlide ? 'active' : ''}" onclick="goToSlideStudy(${i})" style="${i === currentSlide ? 'background:' + style.accent : ''}"></div>`).join('')}
          </div>
          <button class="pres-btn pres-btn-primary" onclick="nextSlideStudy()" ${currentSlide === total - 1 ? 'disabled' : ''} style="background:${style.accent}">Próximo →</button>
        </div>
      </div>

      <!-- TEACHER PANEL -->
      <div class="pres-teacher-panel">
        <div class="pres-teacher-header">
          <span>✝️ Painel do Professor</span>
          <button class="pres-close-btn" onclick="closePresentationScreen()">✕</button>
        </div>

        ${slide.note ? `<div class="pres-slide-note"><div class="pres-notes-label">📌 Nota do slide</div><div class="pres-note-text">${escHtml(slide.note)}</div></div>` : ''}

        <!-- TABS -->
        <div style="display:flex;gap:6px;margin:10px 14px 8px">
          <button id="tab-notes-btn" onclick="showTeacherTab('notes')"
            style="flex:1;padding:6px;border-radius:6px;border:1px solid rgba(99,102,241,.3);background:rgba(99,102,241,.15);color:#818cf8;font-size:11px;cursor:pointer;font-weight:600">
            📝 Anotações
          </button>
          <button id="tab-ai-btn" onclick="showTeacherTab('ai')"
            style="flex:1;padding:6px;border-radius:6px;border:1px solid #252836;background:none;color:#9ca3b8;font-size:11px;cursor:pointer">
            🔍 Pesquisa IA
          </button>
        </div>

        <!-- NOTES TAB -->
        <div id="teacher-tab-notes" class="pres-notes-area">
          <div class="pres-notes-label">Slide ${currentSlide + 1} — ${escHtml(slide.title)}</div>
          <div class="pres-notes-content">${markdownToHtml(slideNotes)}</div>
        </div>

        <!-- AI SEARCH TAB -->
        <div id="teacher-tab-ai" style="display:none;flex-direction:column;gap:8px;flex:1;overflow:hidden;padding:10px 14px">
          <p style="font-size:11px;color:#9ca3b8;margin:0">Digite uma pergunta teológica para aprofundar durante a aula:</p>
          <div class="pres-search-row">
            <input type="text" id="pres-search-input" class="pres-search-input"
              placeholder="Ex: O que Calvino diz sobre..."
              onkeydown="if(event.key==='Enter') presSearch()">
            <button class="pres-btn pres-btn-primary" onclick="presSearch()" style="background:${style.accent};font-size:11px;padding:7px 12px">Buscar</button>
          </div>
          <div id="pres-search-result" class="pres-search-result" style="flex:1;overflow-y:auto;min-height:80px">
            <span style="color:#636878;font-size:11px">A resposta aparecerá aqui...</span>
          </div>
          <div id="pres-search-actions" style="display:none;flex-direction:column;gap:6px">
            <button onclick="appendSearchToNotes()"
              style="width:100%;padding:7px;border-radius:6px;background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3);font-size:11px;cursor:pointer">
              📎 Anexar às Anotações
            </button>
            <button onclick="showTeacherTab('notes')"
              style="width:100%;padding:7px;border-radius:6px;background:none;color:#9ca3b8;border:1px solid #252836;font-size:11px;cursor:pointer">
              ← Voltar às Anotações
            </button>
          </div>
        </div>
      </div>

    </div>
  `;
}

function showTeacherTab(tab) {
  const notesTab = document.getElementById('teacher-tab-notes');
  const aiTab = document.getElementById('teacher-tab-ai');
  const notesBtn = document.getElementById('tab-notes-btn');
  const aiBtn = document.getElementById('tab-ai-btn');
  if (!notesTab || !aiTab) return;

  if (tab === 'notes') {
    notesTab.style.display = 'flex';
    notesTab.style.flexDirection = 'column';
    aiTab.style.display = 'none';
    if (notesBtn) { notesBtn.style.background = 'rgba(99,102,241,.15)'; notesBtn.style.color = '#818cf8'; notesBtn.style.border = '1px solid rgba(99,102,241,.3)'; }
    if (aiBtn) { aiBtn.style.background = 'none'; aiBtn.style.color = '#9ca3b8'; aiBtn.style.border = '1px solid #252836'; }
  } else {
    notesTab.style.display = 'none';
    aiTab.style.display = 'flex';
    if (aiBtn) { aiBtn.style.background = 'rgba(99,102,241,.15)'; aiBtn.style.color = '#818cf8'; aiBtn.style.border = '1px solid rgba(99,102,241,.3)'; }
    if (notesBtn) { notesBtn.style.background = 'none'; notesBtn.style.color = '#9ca3b8'; notesBtn.style.border = '1px solid #252836'; }
    setTimeout(() => document.getElementById('pres-search-input')?.focus(), 100);
  }
}

async function presSearch() {
  const input = document.getElementById('pres-search-input');
  const q = input?.value.trim();
  if (!q) return;
  const r = document.getElementById('pres-search-result');
  const actions = document.getElementById('pres-search-actions');
  if (!r) return;

  r.innerHTML = '<div style="color:#9ca3b8;font-size:12px;padding:8px">🤔 Buscando com IA...</div>';
  if (actions) actions.style.display = 'none';

  try {
    const slideTitle = presentationSlides[currentSlide]?.title || '';
    const result = await claudeAI(
      `O professor está apresentando o slide "${slideTitle}" e perguntou: "${q}".
       Responda de forma clara e objetiva para uso imediato em sala de aula no seminário.
       Use referências bíblicas e teológicas relevantes. Máximo 3 parágrafos curtos.`,
      SEMINARY_SYSTEM
    );
    r.innerHTML = `<div style="font-size:12px;color:#e8eaf0;line-height:1.6">${markdownToHtml(result)}</div>`;
    if (actions) { actions.style.display = 'flex'; actions.style.flexDirection = 'column'; }
  } catch (err) {
    r.innerHTML = `<div style="color:#f43f5e;font-size:12px">Erro: ${err.message}</div>`;
  }
}

async function appendSearchToNotes() {
  const result = document.getElementById('pres-search-result');
  if (!result || !result.textContent.trim()) return;

  const summary = result.textContent.trim().substring(0, 600);
  const slideNum = currentSlide + 1;
  const append = `\n\n---\n📎 Pesquisa adicionada (Slide ${slideNum}): ${summary}`;

  currentLessonData.notes = (currentLessonData.notes || '') + append;

  try {
    const sb = getSupabase();
    await sb.from('lessons').update({ notes: currentLessonData.notes }).eq('id', currentLessonId);
    toast('Resumo anexado às anotações!', 'success');
  } catch {}

  showTeacherTab('notes');
  renderPresentationScreen();
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

function showStudyLoading(text) {
  const el = document.getElementById('study-loading');
  if (el) { el.style.display = 'flex'; document.getElementById('study-loading-text').textContent = text || 'Carregando...'; }
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
