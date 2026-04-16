# 

**URL:** https://raw.githubusercontent.com/gmp0040-pixel/aulasflow/main/public/study-addon.js

---

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
      `Faça uma pesquisa COMPLETA sobre o tema teológico: "${topic}" para um seminário presbiteriano renovado.\n\nREGRAS ANTI-REPETIÇÃO OBRIGATÓRIAS:\n- Cada parágrafo deve abordar um aspecto NOVO e DISTINTO\n- NUNCA repita o mesmo sujeito em parágrafos consecutivos\n- Varie perspectivas: bíblica, histórica, doutrinal, prática, pastoral\n- Se um conceito foi mencionado, não o repita — apenas conecte ou aprofunde\n\nEstruture com:\n## 1. Introdução e Contexto Bíblico\n## 2. Fundamentos Teológicos Reformados\n## 3. Desenvolvimento Doutrinal\n## 4. Aplicações Práticas para o Ministério\n## 5. Perspectiva Presbiteriana Renovada\n## 6. Síntese\n\nUse referências bíblicas específicas. Cite teólogos reformados quando relevante.`,
      SEMINARY_SYSTEM
    );

    const notes = await claudeAI(
      `Com base neste conteúdo teológico sobre "${topic}", crie anotações práticas para o professor do seminário:\n      ${content.substring(0, 2000)}\n      Inclua: pontos doutrinários essenciais a enfatizar, como conectar com a prática ministerial, perguntas para reflexão dos alunos, referências bíblicas-chave.`,
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
      `Com base no conteúdo teológico: ${currentLessonData.research.substring(0, 2000)}\n      Crie anotações do professor com dicas de ensino, referências bíblicas adicionais, perguntas para debate e sugestões de atividades para o seminário.`,
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
      `Crie ${count} slides COMPLETOS para aula teológica sobre: "${currentLessonData.title || 'o tema'}" em um seminário presbiteriano renovado.\n      Conteúdo: ${currentLessonData.research.substring(0, 3500)}\n      \n      Retorne APENAS JSON:\n      {"slides":[{"type":"intro","title":"","subtitle":"","points":["frase completa 1","frase completa 2","..."],"subpoints":{},"highlight":"frase chave ou versículo","note":"dica para o professor"}]}\n      \n      Tipos: intro, content, example, activity, summary, conclusion\n      - 1º slide = intro, últimos 2 = summary e conclusion\n      - Cada slide: 4-6 points com frases COMPLETAS\n      - Inclua referências bíblicas nos points quando relevante\n      - note = orientação exclusiva para o professor (não aparece na apresentação)`,
      'Retorne APENAS JSON válido. Contexto: seminário presbiteriano renovado.'
    );

    presentationSlides = result.slides || [];
    currentLessonData.slides = JSON.stringify(result);

    renderSlidesPreview();
    toast('Slides gerados!', 'success');
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  } finally {
    hideStudyLoading();
  }
}

function renderSlidesPreview() {
  const previewContainer = document.getElementById('slides-preview-content');
  previewContainer.innerHTML = '';
  presentationSlides.forEach((slide, index) => {
    const slideEl = document.createElement('div');
    slideEl.className = 'slide-preview-item';
    slideEl.innerHTML = `
      <h4>Slide ${index + 1}: ${slide.title}</h4>
      <p>${slide.subtitle || ''}</p>
      <ul>
        ${slide.points.map(p => `<li>${p}</li>`).join('')}
      </ul>
      ${slide.highlight ? `<p><strong>Destaque:</strong> ${slide.highlight}</p>` : ''}
    `;
    previewContainer.appendChild(slideEl);
  });
  openModal('slides-preview-modal');
}

async function saveAndPresent() {
  if (!currentLessonData.id) return toast('Salve a aula primeiro', 'error');
  currentLessonData.presentationSlides = presentationSlides;
  await dbUpdate('lessons', currentLessonData.id, { slides: JSON.stringify({ slides: presentationSlides }) });
  toast('Slides salvos e prontos para apresentar!', 'success');
  closeSlidePreview();
  startPresentationStudy();
}

function startPresentationStudy() {
  if (presentationSlides.length === 0) return toast('Gere os slides primeiro', 'error');
  currentSlide = 0;
  renderPresentationSlide();
  document.getElementById('study-screen').classList.add('presentation-mode');
}

function renderPresentationSlide() {
  const slide = presentationSlides[currentSlide];
  if (!slide) return;

  document.getElementById('study-research-content').innerHTML = `
    <div class="presentation-slide">
      <h2>${slide.title}</h2>
      ${slide.subtitle ? `<h3>${slide.subtitle}</h3>` : ''}
      <ul>
        ${slide.points.map(p => `<li>${p}</li>`).join('')}
      </ul>
      ${slide.highlight ? `<p class="highlight">${slide.highlight}</p>` : ''}
    </div>
  `;
  document.getElementById('presentation-controls').style.display = 'flex';
  document.getElementById('slide-counter').textContent = `${currentSlide + 1}/${presentationSlides.length}`;
  document.getElementById('prev-slide-btn').disabled = currentSlide === 0;
  document.getElementById('next-slide-btn').disabled = currentSlide === presentationSlides.length - 1;
}

function nextSlide() {
  if (currentSlide < presentationSlides.length - 1) {
    currentSlide++;
    renderPresentationSlide();
  }
}

function prevSlide() {
  if (currentSlide > 0) {
    currentSlide--;
    renderPresentationSlide();
  }
}

function exitPresentationMode() {
  document.getElementById('study-screen').classList.remove('presentation-mode');
  document.getElementById('presentation-controls').style.display = 'none';
  // Re-render study content if needed
  document.getElementById('study-research-content').innerHTML = markdownToHtml(currentLessonData.research);
}

// ========================
// STUDY LOADING
// ========================
function showStudyLoading(text) {
  document.getElementById('study-loading-text').textContent = text;
  document.getElementById('study-loading').style.display = 'flex';
}

function hideStudyLoading() {
  document.getElementById('study-loading').style.display = 'none';
}

// ========================
// SAVE STUDY CONTENT
// ========================
async function saveStudyContent() {
  if (!currentLessonId) return toast('Crie ou selecione uma aula primeiro', 'error');
  showStudyLoading('Salvando conteúdo...');
  try {
    await dbUpdate('lessons', currentLessonId, {
      research_content: currentLessonData.research,
      notes_content: currentLessonData.notes,
      slides: currentLessonData.slides
    });
    toast('Conteúdo salvo!', 'success');
  } catch (err) {
    toast('Erro ao salvar conteúdo: ' + err.message, 'error');
  } finally {
    hideStudyLoading();
  }
}

async function loadSavedStudyContent(lessonId) {
  const lesson = await dbGetOne('lessons', lessonId);
  if (lesson) {
    currentLessonData = { ...currentLessonData, ...lesson };
    if (lesson.research_content) {
      document.getElementById('study-welcome').style.display = 'none';
      document.getElementById('study-content-area').style.display = 'block';
      document.getElementById('study-research-content').innerHTML = markdownToHtml(lesson.research_content);
      document.getElementById('study-sidebar').style.display = 'flex';
      document.getElementById('study-notes-content').innerHTML = markdownToHtml(lesson.notes_content);
    }
    if (lesson.slides) {
      presentationSlides = JSON.parse(lesson.slides).slides || [];
    }
  }
}

// ========================
// MARKDOWN TO HTML (Basic)
// ========================
function markdownToHtml(markdown) {
  let html = markdown
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/\n/g, '<br>');
  
  // Handle lists - wrap <li> in <ul>
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

  return html;
}

// ========================
// THEME TOGGLE
// ========================
function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const themeBtn = document.getElementById('study-theme-btn');
  if (document.body.classList.contains('dark-mode')) {
    themeBtn.innerHTML = '🌙';
    themeBtn.title = 'Alternar para modo claro';
  } else {
    themeBtn.innerHTML = '☀️';
    themeBtn.title = 'Alternar para modo escuro';
  }
}












































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































This is a continuation of the previous search result. I will now analyze the files to identify the outdated API calls and provide the corrected versions. I will start with `public/script.js`. The user wants me to provide the exact code to copy and paste. I will output the corrected code for `public/script.js` first, then for `public/study-addon.js`. I will also include instructions on where to find the code to replace. Since the user asked me to correct the files, I will assume they want me to apply the changes discussed in the `pasted_content.txt`. Specifically, changing `/.netlify/functions/claude-ai` to `/api/ai` and ensuring the model is `llama-3.1-8b-instant`. I will start by reading the `script.js` file content. I have already read it and saved it to `script.js`. Now I will make the necessary edits. I will then do the same for `study-addon.js`. I will then provide the corrected code to the user. I will start by modifying `script.js`. I will use the `file` tool with the `edit` action. I will look for `fetch('/api/ai'` and ensure the model is `llama-3.1-8b-instant`. The `pasted_content.txt` indicates that `api/ai.js` is already configured correctly, so I will focus on `public/script.js` and `public/study-addon.js` to ensure they call `/api/ai` and pass the correct model. Looking at the `script.js` content, the `claudeAI` function already calls `fetch('/api/ai')`. The `pasted_content.txt` mentions changing `/.netlify/functions/claude-ai` to `/api/ai`. This suggests that there might have been an older version of `script.js` that used the Netlify function. However, the current `script.js` I read already uses `/api/ai`. I will double check the `netlify/functions/claude-ai.js` file to see what model it uses. I have already read it and it uses `gemini-1.5-flash-latest`. So the `claudeAI` function in `script.js` is already pointing to the correct `/api/ai` endpoint. The `api/ai.js` file is using `llama-3.1-8b-instant`. So the `script.js` file seems to be correctly configured to use the new API. The issue might be in `study-addon.js` or in the way the `claudeAI` function is called. I will now examine `study-addon.js`. I have already read it and saved it to `study-addon.js`. I will now analyze its content. Looking at `study-addon.js`, I see calls to `claudeAI` in `searchTopic` and `regenerateNotes` functions. These calls are using the `claudeAI` function defined in `script.js`. Since `script.js`'s `claudeAI` function already points to `/api/ai` and `api/ai.js` uses `llama-3.1-8b-instant`, it seems the problem is not in the endpoint or model used by `claudeAI` itself. The `pasted_content.txt` specifically mentions: 
