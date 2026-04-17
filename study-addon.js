// ========================
// STUDY ADDON — AulaFlow
// ========================

const SEMINARY_SYSTEM = 'Você é um professor especialista em teologia e apologética cristã.\nCrie uma aula COMPLETA, PROFUNDA e DIDÁTICA estruturada assim:\n\n1. Definição clara e objetiva do tema\n2. Fundamentação bíblica (com explicação dos textos)\n3. Desenvolvimento histórico (igreja primitiva, pais da igreja, reformadores, teólogos relevantes)\n4. Principais correntes ou abordagens dentro do tema\n5. Explicação teológica aprofundada\n6. Aplicações práticas para a vida cristã e ministério\n7. Principais objeções ou críticas ao tema e como respondê-las\n8. Exemplos práticos ou analogias para facilitar o ensino\n9. Resumo final para fixação\n\nUse linguagem clara, mas com profundidade teológica. Evite respostas superficiais. Sempre que possível, cite autores, correntes teológicas e conceitos relevantes. Organize como se fosse uma aula para seminário.';

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
          <button class="study-btn" onclick="toggleTheme()" id="study-theme-btn" title="Alternar tema" style="padding:6px 10px;font-size:16px">☀️</button>
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
      `Faça uma pesquisa COMPLETA e DETALHADA sobre o tema teológico: "${topic}" para um seminário teológico reformado.

REGRAS OBRIGATÓRIAS ANTI-REPETIÇÃO:
- Cada parágrafo deve abordar um aspecto NOVO e DISTINTO
- NUNCA repita o mesmo sujeito em parágrafos consecutivos
- Varie perspectivas: bíblica, histórica, doutrinal, prática, pastoral
- Referências bíblicas ESPECÍFICAS com capítulo e versículo

Estruture com:
## 1. Introdução e Contexto Bíblico
## 2. Fundamentos Teológicos Reformados
## 3. Desenvolvimento Doutrinal e Histórico
## 4. Perspectivas dos Teólogos Reformados
## 5. Aplicações Práticas para o Ministério
## 6. Síntese e Conclusão

Use referências bíblicas específicas. Cite teólogos reformados quando relevante.`,
      SEMINARY_SYSTEM
    );

    const notes = await claudeAI(
      `Com base neste conteúdo teológico sobre "${topic}", crie anotações práticas para o professor do seminário:
${content.substring(0, 2000)}
Inclua: pontos doutrinários essenciais, como conectar com a prática ministerial, perguntas para reflexão, referências bíblicas-chave.`,
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
      `Crie ${count} slides COMPLETOS para aula teológica sobre: "${currentLessonData.title || 'o tema'}" em seminário teológico reformado.
Conteúdo: ${currentLessonData.research.substring(0, 3500)}

REGRAS DE QUALIDADE MÁXIMA:
- Cada point ÚNICO — nunca dois points consecutivos com o mesmo sujeito
- NÃO repita conceitos entre slides — cada slide cobre aspecto DISTINTO
- Points são frases COMPLETAS e INFORMATIVAS — nunca palavras soltas
- Inclua referências bíblicas específicas quando relevante

Retorne APENAS JSON:
{"slides":[{"type":"intro","title":"","subtitle":"","points":["frase completa 1","frase completa 2"],"subpoints":{},"highlight":"frase chave ou versículo","note":"dica para o professor"}]}

Tipos: intro, content, example, activity, summary, conclusion
- 1º slide = intro, últimos 2 = summary e conclusion
- Cada slide: 4-6 points com frases COMPLETAS
- note = orientação exclusiva para o professor`,
      'Retorne APENAS JSON válido. Nunca repita o mesmo sujeito em points consecutivos.'
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

let currentSlideTheme = localStorage.getItem('slideTheme') || 'dark';

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

function cycleSlideTheme() {
  const themes = ['dark','minimal','modern','professional','light'];
  const idx = themes.indexOf(currentSlideTheme);
  currentSlideTheme = themes[(idx + 1) % themes.length];
  localStorage.setItem('slideTheme', currentSlideTheme);
  renderPresentationScreen();
}

function getSlideThemeStyles() {
  const themes = {
    dark: { bg:'#050709', slideBg:(a)=>`rgba(${hr(a)},0.06)`, text:'#e8eaf0', text2:'#9ca3b8', controlBg:'rgba(15,18,25,0.97)', controlBorder:'#252836', panelBg:'#0f1219', panelBorder:'#252836', btnBg:'rgba(255,255,255,0.05)', btnColor:'#e8eaf0', name:'🌑 Escuro' },
    minimal: { bg:'#0d0f18', slideBg:(a)=>'transparent', text:'#e8eaf0', text2:'#636878', controlBg:'#0d0f18', controlBorder:'#1a1d2a', panelBg:'#0d0f18', panelBorder:'#1a1d2a', btnBg:'rgba(255,255,255,0.03)', btnColor:'#9ca3b8', name:'⚪ Minimalista' },
    modern: { bg:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', slideBg:(a)=>`rgba(${hr(a)},0.1)`, text:'#ffffff', text2:'#c4c9e8', controlBg:'rgba(10,8,30,0.95)', controlBorder:'rgba(99,102,241,0.3)', panelBg:'rgba(15,12,40,0.95)', panelBorder:'rgba(99,102,241,0.2)', btnBg:'rgba(99,102,241,0.15)', btnColor:'#c4c9e8', name:'🟣 Moderno' },
    professional: { bg:'#1a1f36', slideBg:(a)=>`rgba(${hr(a)},0.07)`, text:'#e2e8f0', text2:'#94a3b8', controlBg:'#0f1322', controlBorder:'#2d3748', panelBg:'#111827', panelBorder:'#2d3748', btnBg:'rgba(255,255,255,0.06)', btnColor:'#e2e8f0', name:'🔵 Profissional' },
    light: { bg:'#f8f9fc', slideBg:(a)=>`rgba(${hr(a)},0.04)`, text:'#1a1d2e', text2:'#4a5068', controlBg:'#ffffff', controlBorder:'#e2e4ef', panelBg:'#f0f2f8', panelBorder:'#e2e4ef', btnBg:'rgba(0,0,0,0.04)', btnColor:'#4a5068', name:'☀️ Claro' }
  };
  return themes[currentSlideTheme] || themes.dark;
}

function hr(hex) {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
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
  const theme = getSlideThemeStyles();

  const typeColors = {
    intro:      { accent: '#6366f1', label: '📖 Introdução' },
    content:    { accent: '#10b981', label: '📚 Conteúdo' },
    example:    { accent: '#f59e0b', label: '💡 Exemplo' },
    activity:   { accent: '#06b6d4', label: '✏️ Atividade' },
    summary:    { accent: '#a855f7', label: '📋 Resumo' },
    conclusion: { accent: '#ec4899', label: '🏁 Conclusão' },
  };
  const tc = typeColors[slide.type] || typeColors.content;
  const style = { accent: tc.accent, bg: theme.slideBg(tc.accent), label: tc.label };
  const slideNotes = getSlideNotes(currentSlide);
  const isBgGradient = theme.bg.startsWith('linear') || theme.bg.startsWith('radial');

  p.style.background = theme.bg;

  p.innerHTML = `
    <div class="pres-layout" style="background:${isBgGradient ? theme.bg : 'transparent'}">
      <div class="pres-slide-area">
        <div class="pres-slide" style="background:${style.bg};border-top:4px solid ${style.accent}">
          <div class="pres-slide-meta">
            <span class="pres-slide-type-badge" style="color:${style.accent};background:${style.bg}">${style.label}</span>
            <span class="pres-slide-num">${currentSlide + 1} / ${total}</span>
          </div>
          ${slide.subtitle ? `<p class="pres-slide-subtitle" style="color:${theme.text2}">${escHtml(slide.subtitle)}</p>` : ''}
          <h2 class="pres-slide-title" style="color:${style.accent}">${escHtml(slide.title)}</h2>
          ${slide.points && slide.points.length ? `
            <ul class="pres-slide-points">
              ${slide.points.map((point, idx) => {
                const hasSub = slide.subpoints && slide.subpoints[point];
                return `
                <li class="pres-point" style="animation-delay:${idx * 0.07}s">
                  <span class="pres-point-bullet" style="background:${style.accent}"></span>
                  <div class="pres-point-content">
                    <span class="pres-point-text" style="color:${theme.text}">${escHtml(point)}</span>
                    ${hasSub ? `<ul class="pres-subpoints">${slide.subpoints[point].map(sp => `<li>${escHtml(sp)}</li>`).join('')}</ul>` : ''}
                  </div>
                </li>`;
              }).join('')}
            </ul>` : ''}
          ${slide.highlight ? `<div class="pres-highlight" style="border-color:${style.accent};color:${style.accent}">✨ ${escHtml(slide.highlight)}</div>` : ''}
        </div>
        <button id="pres-panel-toggle-btn" class="pres-panel-toggle" onclick="toggleMobilePanel()" title="Painel do Professor">📝</button>
        <div class="pres-controls" style="background:${theme.controlBg};border-top:1px solid ${theme.controlBorder}">
          <button class="pres-btn" style="background:rgba(244,63,94,.15);color:#f43f5e;border:1px solid rgba(244,63,94,.2)" onclick="closePresentationScreen()">✕ Sair</button>
          <button id="pres-hide-btn" class="pres-btn" onclick="toggleHideControls()" title="Ocultar controles da tela" style="background:${theme.btnBg};color:${theme.btnColor};border:1px solid ${theme.controlBorder};font-size:13px">🙈</button>
          <button class="pres-btn" onclick="prevSlideStudy()" ${currentSlide === 0 ? 'disabled' : ''} style="background:${theme.btnBg};color:${theme.btnColor};border:1px solid ${theme.controlBorder}">← Anterior</button>
          <div class="pres-progress">
            ${presentationSlides.map((_, i) => `<div class="pres-dot ${i === currentSlide ? 'active' : ''}" onclick="goToSlideStudy(${i})" style="${i === currentSlide ? 'background:' + style.accent : 'background:' + theme.controlBorder}"></div>`).join('')}
          </div>
          <button class="pres-btn pres-btn-primary" onclick="nextSlideStudy()" ${currentSlide === total - 1 ? 'disabled' : ''} style="background:${style.accent}">Próximo →</button>
          <button class="pres-btn" onclick="cycleSlideTheme()" title="Mudar tema" style="background:${theme.btnBg};color:${theme.btnColor};border:1px solid ${theme.controlBorder};font-size:12px">${theme.name}</button>
        </div>
      </div>
      <div class="pres-teacher-panel" style="background:${theme.panelBg};border-left:1px solid ${theme.panelBorder}">
        <div class="pres-teacher-header" style="border-bottom:1px solid ${theme.panelBorder};color:${theme.text2}">
          <span>✝️ Painel do Professor</span>
          <div style="display:flex;gap:6px;align-items:center">
            <button onclick="cycleSlideTheme()" title="Tema: ${theme.name}" style="background:none;border:1px solid ${theme.panelBorder};border-radius:6px;color:${theme.text2};font-size:11px;padding:2px 7px;cursor:pointer">${theme.name}</button>
            <button class="pres-close-btn" onclick="closePresentationScreen()">✕</button>
          </div>
        </div>
        ${slide.note ? `<div class="pres-slide-note"><div class="pres-notes-label">📌 Nota do slide</div><div class="pres-note-text">${escHtml(slide.note)}</div></div>` : ''}
        <div style="display:flex;gap:6px;margin:10px 14px 8px">
          <button id="tab-notes-btn" onclick="showTeacherTab('notes')" style="flex:1;padding:6px;border-radius:6px;border:1px solid rgba(99,102,241,.3);background:rgba(99,102,241,.15);color:#818cf8;font-size:11px;cursor:pointer;font-weight:600">📝 Anotações</button>
          <button id="tab-ai-btn" onclick="showTeacherTab('ai')" style="flex:1;padding:6px;border-radius:6px;border:1px solid #252836;background:none;color:#9ca3b8;font-size:11px;cursor:pointer">🔍 Pesquisa IA</button>
        </div>
        <div id="teacher-tab-notes" class="pres-notes-area" style="background:${theme.panelBg}">
          <div class="pres-notes-label">Slide ${currentSlide + 1} — ${escHtml(slide.title)}</div>
          <div class="pres-notes-content" style="color:${theme.text2}">${markdownToHtml(slideNotes)}</div>
        </div>
        <div id="teacher-tab-ai" style="display:none;flex-direction:column;gap:8px;flex:1;overflow:hidden;padding:10px 14px">
          <p style="font-size:11px;color:#9ca3b8;margin:0">Pesquisa livre — pergunte qualquer coisa:</p>
          <div class="pres-search-row">
            <input type="text" id="pres-search-input" class="pres-search-input" placeholder="Digite qualquer pergunta ou tema..." onkeydown="if(event.key==='Enter') presSearch()">
            <button class="pres-btn pres-btn-primary" onclick="presSearch()" style="background:${style.accent};font-size:11px;padding:7px 12px">Buscar</button>
          </div>
          <div id="pres-search-result" class="pres-search-result" style="flex:1;overflow-y:auto;min-height:80px"><span style="color:#636878;font-size:11px">A resposta aparecerá aqui...</span></div>
          <div id="pres-search-actions" style="display:none;flex-direction:column;gap:6px">
            <button onclick="appendSearchToNotes()" style="width:100%;padding:7px;border-radius:6px;background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3);font-size:11px;cursor:pointer">📎 Anexar às Anotações</button>
            <button onclick="showTeacherTab('notes')" style="width:100%;padding:7px;border-radius:6px;background:none;color:#9ca3b8;border:1px solid #252836;font-size:11px;cursor:pointer">← Voltar às Anotações</button>
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
    notesTab.style.display = 'flex'; notesTab.style.flexDirection = 'column'; aiTab.style.display = 'none';
    if (notesBtn) { notesBtn.style.background='rgba(99,102,241,.15)'; notesBtn.style.color='#818cf8'; notesBtn.style.border='1px solid rgba(99,102,241,.3)'; }
    if (aiBtn) { aiBtn.style.background='none'; aiBtn.style.color='#9ca3b8'; aiBtn.style.border='1px solid #252836'; }
  } else {
    notesTab.style.display = 'none'; aiTab.style.display = 'flex';
    if (aiBtn) { aiBtn.style.background='rgba(99,102,241,.15)'; aiBtn.style.color='#818cf8'; aiBtn.style.border='1px solid rgba(99,102,241,.3)'; }
    if (notesBtn) { notesBtn.style.background='none'; notesBtn.style.color='#9ca3b8'; notesBtn.style.border='1px solid #252836'; }
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
    const result = await claudeAI(q, SEMINARY_SYSTEM);
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
  if (_autoHideTimer) clearTimeout(_autoHideTimer);
}

let _controlsHidden = false;
let _autoHideTimer = null;

function toggleHideControls() {
  _controlsHidden = !_controlsHidden;
  const p = document.getElementById('presentation-screen');
  const btn = document.getElementById('pres-hide-btn');
  if (!p) return;
  if (_controlsHidden) {
    p.classList.add('pres-controls-hidden');
    if (btn) { btn.textContent = '👁️'; btn.title = 'Mostrar controles'; }
    p.addEventListener('mousemove', _showControlsTemp);
    p.addEventListener('touchstart', _showControlsTemp);
  } else {
    p.classList.remove('pres-controls-hidden');
    if (btn) { btn.textContent = '🙈'; btn.title = 'Ocultar controles da tela'; }
    p.removeEventListener('mousemove', _showControlsTemp);
    p.removeEventListener('touchstart', _showControlsTemp);
  }
}

function _showControlsTemp() {
  const controls = document.querySelector('.pres-controls');
  if (!controls) return;
  controls.style.opacity = '1';
  controls.style.pointerEvents = 'auto';
  if (_autoHideTimer) clearTimeout(_autoHideTimer);
  _autoHideTimer = setTimeout(() => {
    if (_controlsHidden) { controls.style.opacity = '0'; controls.style.pointerEvents = 'none'; }
  }, 3000);
}

function toggleMobilePanel() {
  const panel = document.querySelector('.pres-teacher-panel');
  const btn = document.getElementById('pres-panel-toggle-btn');
  if (!panel) return;
  const isOpen = panel.classList.contains('mobile-open');
  panel.classList.toggle('mobile-open', !isOpen);
  if (btn) btn.textContent = isOpen ? '📝' : '✕';
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
    const active = document.activeElement;
    const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
    if (isTyping) return;
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextSlideStudy(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlideStudy(); }
    if (e.key === 'Escape') closePresentationScreen();
  }
});
