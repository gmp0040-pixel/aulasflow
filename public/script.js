// ========================
// CONFIG & STATE
// ========================
let currentUser = null;
let currentSubjectId = null;
let currentLessonId = null;
let currentLessonData = {};
let currentExamData = null;
let currentAssignmentData = null;
let selectedAssignmentIdx = 0;
let presentationSlides = [];
let presentationNotes = '';
let currentSlide = 0;
let calendarDate = new Date();
let _sb = null; // supabase client

// ========================
// SUPABASE INIT
// ========================
function getSupabase() {
  if (!_sb) {
    _sb = window._supabase;
  }
  return _sb;
}

// ========================
// CLAUDE AI HELPER
// ========================
async function claudeAI(prompt, systemPrompt, max_tokens) {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      system: systemPrompt || 'Você é um assistente educacional especializado em teologia reformada e presbiteriana renovada, criando conteúdo pedagógico de alta qualidade em português brasileiro para um seminário teológico presbiteriano renovado. Todo conteúdo deve ser fundamentado nas Escrituras Sagradas, alinhado com a fé reformada e presbiteriana, considerando a abertura à renovação e ao mover do Espírito Santo dentro dos limites da sã doutrina reformada. Use referências bíblicas relevantes, cite teólogos reformados quando apropriado (como Calvino, Berkhof, Sproul, Kuyper, etc.), e mantenha linguagem teológica adequada para formação ministerial. Seja detalhado, preciso e didático.',
      max_tokens: max_tokens || 4000
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Erro na IA');
  return data.content;
}

async function claudeJSON(prompt, systemPrompt) {
  const text = await claudeAI(prompt, systemPrompt);
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

// ========================
// INIT
// ========================
window.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }
  
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
    currentUser = { id: session.user.id, name: profile?.name || session.user.email, email: session.user.email };
    showApp();
  } else {
    document.getElementById('auth-screen').style.display = 'flex';
  }
});

// ========================
// AUTH
// ========================
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
}

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) return toast('Preencha todos os campos', 'error');
  
  const btn = document.querySelector('#login-form .btn-primary');
  btn.disabled = true; btn.textContent = 'Entrando...';
  
  try {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase não carregado. Recarregue a página.');
    
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Invalid login')) throw new Error('E-mail ou senha incorretos');
      if (error.message.includes('Email not confirmed')) throw new Error('Confirme seu e-mail antes de entrar');
      throw new Error(error.message);
    }
    
    let userName = email;
    try {
      const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
      if (profile?.name) userName = profile.name;
    } catch {}
    
    currentUser = { id: data.user.id, name: userName, email };
    showApp();
  } catch (err) {
    toast(err.message || 'Erro ao entrar', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

async function register() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!name || !email || !password) return toast('Preencha todos os campos', 'error');
  if (password.length < 6) return toast('Senha deve ter pelo menos 6 caracteres', 'error');
  
  const btn = document.querySelector('#register-form .btn-primary');
  btn.disabled = true; btn.textContent = 'Cadastrando...';
  
  try {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase não carregado. Recarregue a página.');

    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) {
      if (error.message.includes('already registered')) throw new Error('Este e-mail já está cadastrado. Use Entrar.');
      throw new Error(error.message);
    }
    if (!data.user) throw new Error('Erro ao criar conta. Tente novamente.');

    try {
      await sb.from('profiles').upsert({ id: data.user.id, name, email });
    } catch {}

    currentUser = { id: data.user.id, name, email };
    showApp();
    toast('Conta criada! Bem-vindo(a), ' + name, 'success');
  } catch (err) {
    toast(err.message || 'Erro ao cadastrar', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Criar conta';
  }
}

async function logout() {
  if (!confirm('Deseja sair?')) return;
  const sb = getSupabase();
  await sb.auth.signOut();
  currentUser = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('user-name').textContent = currentUser.name;
  document.getElementById('user-avatar').textContent = currentUser.name[0].toUpperCase();
  showPage('dashboard');
  loadSubjectsForSelects();
}

// ========================
// SUPABASE DB HELPERS
// ========================
async function dbGet(table, filters = {}) {
  const sb = getSupabase();
  let q = sb.from(table).select('*').eq('user_id', currentUser.id);
  Object.entries(filters).forEach(([k, v]) => { q = q.eq(k, v); });
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) { console.error('dbGet error:', table, error.message); return []; }
  return data || [];
}

async function dbGetOne(table, id) {
  const sb = getSupabase();
  const { data, error } = await sb.from(table).select('*').eq('id', id).maybeSingle();
  if (error) { console.error('dbGetOne error:', table, error.message); throw new Error(error.message); }
  return data;
}

async function dbInsert(table, obj) {
  const sb = getSupabase();
  const { data, error } = await sb.from(table).insert({ ...obj, user_id: currentUser.id }).select();
  if (error) { console.error('dbInsert error:', table, error.message); throw new Error(error.message); }
  return data?.[0] || null;
}

async function dbUpdate(table, id, obj) {
  const sb = getSupabase();
  const { data, error } = await sb.from(table).update(obj).eq('id', id).select();
  if (error) { console.error('dbUpdate error:', table, error.message); throw new Error(error.message); }
  return data?.[0] || null;
}

async function dbDelete(table, id) {
  const sb = getSupabase();
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) { console.error('dbDelete error:', table, error.message); throw new Error(error.message); }
}

// ========================
// NAVIGATION
// ========================
function showPage(page, subtitle = '') {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  
  const navMap = { dashboard: 0, subjects: 1, 'subject-detail': 1, 'lesson-editor': 1, students: 2, grades: 3, calendar: 4, reports: 5 };
  const navItems = document.querySelectorAll('.nav-item');
  const idx = navMap[page];
  if (idx !== undefined) navItems[idx]?.classList.add('active');

  const titles = {
    dashboard: ['Dashboard', 'Visão geral'],
    subjects: ['Matérias', 'Gerenciar matérias'],
    'subject-detail': ['Matéria', subtitle],
    'lesson-editor': ['Aula', subtitle],
    students: ['Alunos', 'Gerenciar alunos'],
    grades: ['Notas', 'Lançamento de notas'],
    calendar: ['Calendário', 'Eventos e prazos'],
    reports: ['Relatórios', 'Frequência e desempenho'],
  };
  
  const [title, sub] = titles[page] || [page, ''];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-subtitle').textContent = subtitle || sub;
  
  const actions = document.getElementById('topbar-actions');
  actions.innerHTML = '';
  
  if (page === 'dashboard') loadDashboard();
  else if (page === 'subjects') loadSubjects();
  else if (page === 'students') loadStudents();
  else if (page === 'grades') loadGradesSelect();
  else if (page === 'calendar') renderCalendar();
  else if (page === 'reports') loadReportsSelect();
  
  if (page === 'subjects') {
    actions.innerHTML = '<button class="btn btn-sm btn-primary" onclick="openModal(\'add-subject-modal\')">+ Nova Matéria</button>';
  }
  if (page === 'students') {
    actions.innerHTML = '<button class="btn btn-sm btn-primary" onclick="openModal(\'add-student-modal\')">+ Novo Aluno</button>';
  }
  
  closeSidebar();
}

// ========================
// SIDEBAR
// ========================
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

// ========================
// MODALS
// ========================
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});

// ========================
// DASHBOARD
// ========================
async function loadDashboard() {
  try {
    const sb = getSupabase();
    const [subjects, students, events] = await Promise.all([
      dbGet('subjects'),
      dbGet('students'),
      dbGet('calendar_events'),
    ]);
    
    document.getElementById('dashboard-stats').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon blue">📚</div>
        <div><div class="stat-value">${subjects.length}</div><div class="stat-label">Matérias</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">👨‍🎓</div>
        <div><div class="stat-value">${students.length}</div><div class="stat-label">Alunos</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">📅</div>
        <div><div class="stat-value">${events.length}</div><div class="stat-label">Eventos</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">🤖</div>
        <div><div class="stat-value">IA</div><div class="stat-label">Integrada</div></div>
      </div>
    `;
    
    const subjectsEl = document.getElementById('dashboard-subjects');
    if (subjects.length === 0) {
      subjectsEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📚</div><div class="empty-state-title">Nenhuma matéria</div><button class="btn btn-sm btn-primary" onclick="showPage(\'subjects\')" style="margin-top:12px">+ Criar Matéria</button></div>';
    } else {
      subjectsEl.innerHTML = subjects.slice(0, 4).map(s => `
        <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="openSubject('${s.id}', '${escHtml(s.name)}')">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:10px;height:10px;border-radius:50%;background:${s.color}"></div>
            <span style="font-size:14px;font-weight:500">${escHtml(s.name)}</span>
          </div>
          <span style="font-size:12px;color:var(--text3)">→</span>
        </div>
      `).join('');
    }
    
    const eventsEl = document.getElementById('dashboard-events');
    const today = new Date();
    const upcoming = events.filter(e => new Date(e.date) >= today).slice(0, 5);
    
    if (upcoming.length === 0) {
      eventsEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-title">Nenhum evento próximo</div></div>';
    } else {
      const typeEmoji = { exam: '🧪', assignment: '📄', event: '📅', holiday: '🎉' };
      eventsEl.innerHTML = upcoming.map(e => `
        <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:10px">
            <span>${typeEmoji[e.type] || '📅'}</span>
            <span style="font-size:14px;font-weight:500">${escHtml(e.title)}</span>
          </div>
          <span style="font-size:12px;color:var(--text3)">${formatDate(e.date)}</span>
        </div>
      `).join('');
    }
  } catch (err) { console.error(err); }
}

// ========================
// SUBJECTS
// ========================
async function loadSubjects() {
  try {
    const subjects = await dbGet('subjects');
    const grid = document.getElementById('subjects-grid');
    
    if (subjects.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">📚</div>
          <div class="empty-state-title">Nenhuma matéria criada</div>
          <div class="empty-state-desc">Crie sua primeira matéria para começar</div>
          <button class="btn btn-primary" onclick="openModal('add-subject-modal')" style="margin-top:16px">+ Nova Matéria</button>
        </div>`;
      return;
    }
    
    const emojis = ['📐', '🔬', '📖', '🌎', '💻', '🎨', '🎵', '⚗️', '🏛️', '💡'];
    grid.innerHTML = subjects.map((s, i) => `
      <div class="subject-card" onclick="openSubject('${s.id}', '${escHtml(s.name)}')">
        <div class="subject-card-header" style="background: linear-gradient(135deg, ${s.color}33, ${s.color}11)">
          <div class="subject-card-emoji">${emojis[i % emojis.length]}</div>
          <div style="width:8px;height:8px;border-radius:50%;background:${s.color}"></div>
        </div>
        <div class="subject-card-body">
          <div class="subject-card-name">${escHtml(s.name)}</div>
          <div class="subject-card-desc">${escHtml(s.description || 'Sem descrição')}</div>
        </div>
        <div class="subject-card-actions" onclick="event.stopPropagation()">
          <button class="btn btn-sm btn-ghost" style="flex:1;background:rgba(99,102,241,0.1);color:var(--accent2)" onclick="openExamModal('${s.id}')">🧪 Criar Prova</button>
          <button class="btn btn-sm btn-ghost" style="flex:1;background:rgba(168,85,247,0.1);color:var(--purple)" onclick="openAssignmentModal('${s.id}')">📄 Criar Trabalho</button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteSubject('${s.id}')">🗑</button>
        </div>
      </div>
    `).join('');
  } catch (err) { toast('Erro ao carregar matérias', 'error'); }
}

async function createSubject() {
  const name = document.getElementById('subject-name').value.trim();
  if (!name) return toast('Nome obrigatório', 'error');
  const description = document.getElementById('subject-desc').value;
  const color = document.querySelector('.color-opt.selected')?.dataset.color || '#6366f1';
  
  try {
    await dbInsert('subjects', { name, description, color });
    closeModal('add-subject-modal');
    document.getElementById('subject-name').value = '';
    document.getElementById('subject-desc').value = '';
    toast('Matéria criada!', 'success');
    loadSubjects();
    loadSubjectsForSelects();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteSubject(id) {
  if (!confirm('Excluir esta matéria? Todas as aulas serão removidas.')) return;
  try {
    await dbDelete('subjects', id);
    toast('Matéria excluída', 'success');
    loadSubjects(); loadSubjectsForSelects();
  } catch (err) { toast(err.message, 'error'); }
}

function selectColor(el) {
  document.querySelectorAll('.color-opt').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

async function loadSubjectsForSelects() {
  try {
    const subjects = await dbGet('subjects');
    const options = subjects.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
    ['grades-subject-select', 'report-subject-select'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<option value="">Selecione uma matéria...</option>' + options;
    });
  } catch {}
}

// ========================
// SUBJECT DETAIL
// ========================
async function openSubject(subjectId, subjectName) {
  currentSubjectId = subjectId;
  showPage('subject-detail', subjectName);
  
  document.getElementById('subject-detail-actions').innerHTML = `
    <button class="btn btn-sm btn-primary" onclick="openModal('add-lesson-modal')">+ Nova Aula</button>
    <button class="btn btn-sm btn-ghost" style="background:rgba(99,102,241,0.1);color:var(--accent2)" onclick="openExamModal('${subjectId}')">🧪 Criar Prova</button>
    <button class="btn btn-sm btn-ghost" style="background:rgba(168,85,247,0.1);color:var(--purple)" onclick="openAssignmentModal('${subjectId}')">📄 Criar Trabalho</button>
    <button class="btn btn-sm btn-ghost" onclick="showPage('subjects')">← Voltar</button>
  `;
  
  switchSubjectTab('lessons');
}

function switchSubjectTab(tab, btn) {
  document.querySelectorAll('.subject-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else document.querySelector(`.subject-tab[data-tab="${tab}"]`)?.classList.add('active');
  
  const content = document.getElementById('subject-tab-content');
  
  if (tab === 'lessons') loadLessonsTab(content);
  else if (tab === 'exams') loadExamsTab(content);
  else if (tab === 'assignments') loadAssignmentsTab(content);
  else if (tab === 'attendance') loadAttendanceTab(content);
  else if (tab === 'subject-grades') loadSubjectGradesTab(content);
  else if (tab === 'subject-students') loadSubjectStudentsTab(content);
}

async function loadLessonsTab(container) {
  try {
    const sb = getSupabase();
    const { data: lessons } = await sb.from('lessons').select('*').eq('subject_id', currentSubjectId).order('created_at', { ascending: false });
    
    if (!lessons || lessons.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📖</div>
          <div class="empty-state-title">Nenhuma aula criada</div>
          <div class="empty-state-desc">Crie sua primeira aula com IA</div>
          <button class="btn btn-primary" onclick="openModal('add-lesson-modal')" style="margin-top:16px">+ Nova Aula</button>
        </div>`;
      return;
    }
    
    container.innerHTML = `
      <div class="lesson-list">
        ${lessons.map(l => `
          <div class="lesson-item">
            <div class="lesson-status-dot ${l.status === 'saved' ? 'saved' : 'draft'}"></div>
            <div class="lesson-title">${escHtml(l.title)}</div>
            <span class="badge ${l.status === 'saved' ? 'badge-green' : 'badge-yellow'}">${l.status === 'saved' ? '✓ Salva' : 'Rascunho'}</span>
            <div class="lesson-meta">${formatDate(l.created_at)}</div>
            <div class="lesson-actions" onclick="event.stopPropagation()">
<button class="btn btn-sm btn-primary" onclick="openLesson('${l.id}', '${escHtml(l.title)}', ${JSON.stringify(l).replace(/"/g, '&quot;')})">✏️ Editar</button>
              <button class="btn btn-sm btn-danger btn-icon" onclick="deleteLesson('${l.id}')">🗑</button>
            </div>
          </div>
        `).join('')}
      </div>`;
  } catch (err) {
    container.innerHTML = '<p class="text-muted">Erro ao carregar aulas</p>';
  }
}

async function loadExamsTab(container) {
  try {
    const sb = getSupabase();
    const { data: exams } = await sb.from('exams').select('*').eq('subject_id', currentSubjectId).order('created_at', { ascending: false });
    
    if (!exams || exams.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🧪</div><div class="empty-state-title">Nenhuma prova</div><button class="btn btn-primary" onclick="openExamModal('${currentSubjectId}')" style="margin-top:16px">🤖 Gerar Prova com IA</button></div>`;
      return;
    }
    
    container.innerHTML = `
      <div style="margin-bottom:16px"><button class="btn btn-sm btn-primary" onclick="openExamModal('${currentSubjectId}')">🤖 Nova Prova com IA</button></div>
      ${exams.map(e => `
        <div class="exam-question" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div class="exam-question-num">${formatDate(e.created_at)}</div>
              <div class="exam-question-text" style="margin-bottom:4px">${escHtml(e.title)}</div>
              <span class="badge badge-accent">${e.question_count} questões</span>
              <span class="badge badge-yellow" style="margin-left:4px">${e.difficulty}</span>
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-sm btn-secondary" onclick="exportSavedExamPDF('${e.id}')">📄 PDF</button>
              <button class="btn btn-sm btn-danger btn-icon" onclick="deleteExam('${e.id}')">🗑</button>
            </div>
          </div>
        </div>
      `).join('')}`;
  } catch { container.innerHTML = '<p class="text-muted">Erro ao carregar provas</p>'; }
}

async function loadAssignmentsTab(container) {
  try {
    const sb = getSupabase();
    const { data: assignments } = await sb.from('assignments').select('*').eq('subject_id', currentSubjectId).order('created_at', { ascending: false });
    
    if (!assignments || assignments.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📄</div><div class="empty-state-title">Nenhum trabalho</div><button class="btn btn-primary" onclick="openAssignmentModal('${currentSubjectId}')" style="margin-top:16px">🤖 Gerar Trabalho com IA</button></div>`;
      return;
    }
    
    const typeEmoji = { pesquisa: '🔍', texto: '✍️', 'apresentação': '📊', estudo: '📚', prático: '🔧' };
    container.innerHTML = `
      <div style="margin-bottom:16px"><button class="btn btn-sm btn-primary" onclick="openAssignmentModal('${currentSubjectId}')">🤖 Novo Trabalho com IA</button></div>
      ${assignments.map(a => {
        let data = {};
        try { data = JSON.parse(a.content); } catch {}
        return `
        <div class="exam-question" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div class="exam-question-num" style="color:var(--purple)">${typeEmoji[data.type] || '📄'} TRABALHO</div>
              <div class="exam-question-text" style="margin-bottom:4px">${escHtml(a.title)}</div>
              <span class="badge badge-purple">${formatDate(a.created_at)}</span>
            </div>
            <button class="btn btn-sm btn-danger btn-icon" onclick="deleteAssignment('${a.id}')">🗑</button>
          </div>
        </div>`;
      }).join('')}`;
  } catch { container.innerHTML = '<p class="text-muted">Erro ao carregar trabalhos</p>'; }
}

async function loadAttendanceTab(container) {
  try {
    const sb = getSupabase();
    const { data: lessons } = await sb.from('lessons').select('*').eq('subject_id', currentSubjectId);
    
    if (!lessons || lessons.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Crie aulas primeiro</div></div>`;
      return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    container.innerHTML = `
      <div style="margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <label class="form-label mb-0">Aula:</label>
        <select class="form-select" style="width:auto" id="attendance-lesson-select" onchange="loadAttendanceForLesson()">
          ${lessons.map(l => `<option value="${l.id}">${escHtml(l.title)}</option>`).join('')}
        </select>
        <input type="date" id="attendance-date" class="form-input" style="width:auto" value="${today}">
      </div>
      <div id="attendance-table"></div>
    `;
    await loadAttendanceForLesson();
  } catch { container.innerHTML = '<p class="text-muted">Erro ao carregar</p>'; }
}

async function loadAttendanceForLesson() {
  const lessonId = document.getElementById('attendance-lesson-select')?.value;
  if (!lessonId) return;
  
  try {
    const sb = getSupabase();
    const { data: students } = await sb.from('subject_students').select('students(*)').eq('subject_id', currentSubjectId);
    const { data: existing } = await sb.from('attendance').select('*').eq('lesson_id', lessonId);
    
    const attMap = {};
    (existing || []).forEach(a => { attMap[a.student_id] = a.status; });
    
    const studentList = (students || []).map(ss => ss.students).filter(Boolean);
    
    if (studentList.length === 0) {
      document.getElementById('attendance-table').innerHTML = `<div class="empty-state"><div class="empty-state-title">Nenhum aluno nesta matéria</div><button class="btn btn-sm btn-primary" onclick="switchSubjectTab('subject-students')">Adicionar Alunos</button></div>`;
      return;
    }
    
    document.getElementById('attendance-table').innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Aluno</th><th>Status</th></tr></thead>
          <tbody>
            ${studentList.map(s => `
              <tr>
                <td>${escHtml(s.name)}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="attendance-btn ${attMap[s.id] === 'present' ? 'present' : ''}" onclick="setAttendance('${lessonId}', '${s.id}', 'present', this)">✓ Presente</button>
                    <button class="attendance-btn ${attMap[s.id] === 'absent' ? 'absent' : ''}" onclick="setAttendance('${lessonId}', '${s.id}', 'absent', this)">✗ Falta</button>
                    <button class="attendance-btn ${attMap[s.id] === 'justified' ? 'justified' : ''}" onclick="setAttendance('${lessonId}', '${s.id}', 'justified', this)">J Justificado</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch {}
}

async function setAttendance(lessonId, studentId, status, btn) {
  const date = document.getElementById('attendance-date')?.value || new Date().toISOString().split('T')[0];
  try {
    const sb = getSupabase();
    await sb.from('attendance').upsert({ lesson_id: lessonId, student_id: studentId, status, date, user_id: currentUser.id }, { onConflict: 'lesson_id,student_id' });
    btn.closest('tr').querySelectorAll('.attendance-btn').forEach(b => b.classList.remove('present', 'absent', 'justified'));
    btn.classList.add(status);
  } catch {}
}

async function loadSubjectGradesTab(container) {
  container.innerHTML = `
    <div style="margin-bottom:16px"><button class="btn btn-sm btn-primary" onclick="openGradeModal()">+ Lançar Nota</button></div>
    <div id="subject-grades-table"></div>
  `;
  await loadSubjectGradesTable();
}

async function loadSubjectGradesTable() {
  try {
    const sb = getSupabase();
    const { data: grades } = await sb.from('grades').select('*, students(name)').eq('subject_id', currentSubjectId).order('created_at', { ascending: false });
    const el = document.getElementById('subject-grades-table');
    if (!el) return;
    
    if (!grades || grades.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">Nenhuma nota lançada</div></div>';
      return;
    }
    
    el.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Aluno</th><th>Atividade</th><th>Nota</th><th>Máximo</th><th>%</th><th>Data</th></tr></thead>
          <tbody>
            ${grades.map(g => `
              <tr>
                <td>${escHtml(g.students?.name || '-')}</td>
                <td>${escHtml(g.activity)}</td>
                <td><strong>${g.grade}</strong></td>
                <td>${g.max_grade}</td>
                <td><span class="badge ${(g.grade/g.max_grade) >= 0.6 ? 'badge-green' : 'badge-red'}">${Math.round(g.grade/g.max_grade*100)}%</span></td>
                <td>${formatDate(g.date)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch {}
}

async function loadSubjectStudentsTab(container) {
  try {
    const sb = getSupabase();
    const [{ data: allStudents }, { data: subjectStudentsRaw }] = await Promise.all([
      sb.from('students').select('*').eq('user_id', currentUser.id),
      sb.from('subject_students').select('student_id').eq('subject_id', currentSubjectId)
    ]);
    
    const enrolledIds = new Set((subjectStudentsRaw || []).map(s => s.student_id));
    const subjectStudents = (allStudents || []).filter(s => enrolledIds.has(s.id));
    const available = (allStudents || []).filter(s => !enrolledIds.has(s.id));
    
    container.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><span class="card-title">Alunos Matriculados (${subjectStudents.length})</span></div>
        <div class="card-body" style="padding:0">
          <div class="table-wrapper">
            <table>
              <thead><tr><th>Nome</th><th>E-mail</th><th>Matrícula</th><th></th></tr></thead>
              <tbody>
                ${subjectStudents.length ? subjectStudents.map(s => `
                  <tr>
                    <td>${escHtml(s.name)}</td>
                    <td>${escHtml(s.email || '-')}</td>
                    <td>${escHtml(s.registration || '-')}</td>
                    <td><button class="btn btn-sm btn-danger btn-icon" onclick="unenrollStudent('${s.id}')">✕</button></td>
                  </tr>
                `).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text3)">Nenhum aluno matriculado</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header"><span class="card-title">Adicionar Aluno</span></div>
        <div class="card-body">
          ${available.length ? `
          <div style="display:flex;gap:8px">
            <select class="form-select" id="enroll-student-select">
              ${available.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('')}
            </select>
            <button class="btn btn-primary" onclick="enrollStudent()">Adicionar</button>
          </div>` : '<p class="text-muted" style="font-size:14px">Todos os alunos já estão matriculados.</p>'}
        </div>
      </div>`;
  } catch (err) { container.innerHTML = '<p>Erro ao carregar alunos</p>'; }
}

async function enrollStudent() {
  const studentId = document.getElementById('enroll-student-select')?.value;
  if (!studentId) return;
  try {
    const sb = getSupabase();
    await sb.from('subject_students').insert({ subject_id: currentSubjectId, student_id: studentId, user_id: currentUser.id });
    toast('Aluno adicionado!', 'success');
    loadSubjectStudentsTab(document.getElementById('subject-tab-content'));
  } catch (err) { toast(err.message, 'error'); }
}

async function unenrollStudent(studentId) {
  if (!confirm('Remover aluno desta matéria?')) return;
  try {
    const sb = getSupabase();
    await sb.from('subject_students').delete().eq('subject_id', currentSubjectId).eq('student_id', studentId);
    toast('Aluno removido', 'success');
    loadSubjectStudentsTab(document.getElementById('subject-tab-content'));
  } catch (err) { toast(err.message, 'error'); }
}

// ========================
// LESSONS
// ========================
async function createLesson() {
  const title = document.getElementById('lesson-title').value.trim();
  if (!title) return toast('Título obrigatório', 'error');
  
  try {
    const sb = getSupabase();
    const { data: lesson, error } = await sb.from('lessons').insert({ title, subject_id: currentSubjectId, user_id: currentUser.id, status: 'draft' }).select().single();
    if (error) throw new Error(error.message);
    closeModal('add-lesson-modal');
    document.getElementById('lesson-title').value = '';
    toast('Aula criada!', 'success');
    openLesson(lesson.id, lesson.title, lesson);
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteLesson(id) {
  if (!confirm('Excluir esta aula?')) return;
  try {
    const sb = getSupabase();
    await sb.from('lessons').delete().eq('id', id);
    toast('Aula excluída', 'success');
    loadLessonsTab(document.getElementById('subject-tab-content'));
  } catch {}
}

function openLesson(id, title, lessonData) {
  currentLessonId = id;
  currentLessonData = typeof lessonData === 'string' ? JSON.parse(lessonData) : (typeof lessonData === 'object' ? lessonData : {});
  showPage('lesson-editor', title);
  renderLessonEditor();
}

function renderLessonEditor() {
  const data = currentLessonData;
  const isSaved = data.status === 'saved';
  
  // 5-step workflow: Pesquisa → Estrutura → Slides → Anotações → Salvar
  let activeStep = 1;
  if (data.research) activeStep = 2;
  if (data.structure) activeStep = 3;
  if (data.slides) activeStep = 4;
  if (data.notes) activeStep = 5;
  if (isSaved) activeStep = 5; // stays on 5 (saved state)
  
  const steps = [
    { num: 1, label: 'Pesquisa',   icon: '🔍', unlocked: true },
    { num: 2, label: 'Estrutura',  icon: '📋', unlocked: !!data.research },
    { num: 3, label: 'Slides',     icon: '🎞️', unlocked: !!data.structure },
    { num: 4, label: 'Anotações',  icon: '🗒️', unlocked: !!data.slides },
    { num: 5, label: 'Salvar',     icon: '💾', unlocked: !!data.notes },
  ];
  
  const stepsHtml = steps.map(s => {
    const isDone = isSaved ? true : s.num < activeStep;
    const isActive = !isSaved && s.num === activeStep;
    const isGreen = isDone || (isSaved && s.num <= 5);
    const isLocked = !s.unlocked && !isDone;
    return `
    <div class="ai-step ${isGreen ? 'completed' : isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}"
         onclick="${s.unlocked || isDone ? 'renderLessonStep(' + s.num + ')' : ''}"
         style="cursor:${s.unlocked || isDone ? 'pointer' : 'not-allowed'};opacity:${isLocked ? '0.4' : '1'}"
         title="${isLocked ? 'Complete a etapa anterior primeiro' : s.label}">
      <div class="ai-step-num" style="${isGreen ? 'background:var(--green);color:white' : ''}">${isGreen ? '✓' : isLocked ? '🔒' : s.icon}</div>
      <span style="${isGreen ? 'color:var(--green)' : ''}">${s.label}</span>
    </div>`;
  }).join('');
  
  const container = document.getElementById('lesson-editor-content');
  container.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-sm btn-ghost" onclick="showPage('subject-detail')">← Voltar</button>
      <h2 style="font-family:Montserrat,sans-serif;font-size:18px;font-weight:700;flex:1">${escHtml(data.title)}</h2>
      <button class="btn btn-sm btn-ghost" onclick="toggleTheme()" id="editor-theme-btn" title="Alternar tema" style="font-size:16px;padding:6px 10px">${document.body.classList.contains('light-mode') ? '🌙' : '☀️'}</button>
      ${isSaved ? '<button class="btn btn-sm btn-primary" onclick="startPresentation()">📡 Apresentar</button>' : ''}
    </div>
    
    <div class="ai-steps">${stepsHtml}</div>
    
    <div class="card">
      <div class="card-body" id="lesson-step-content"></div>
    </div>
  `;
  
  renderLessonStep(activeStep);
}

function saveEditedContent(field) {
  const ta = document.getElementById('edit-' + field);
  if (!ta) return;
  currentLessonData[field] = ta.value;
  saveLessonData();
  toast('✅ Conteúdo salvo!', 'success');
}

function renderLessonStep(step) {
  const data = currentLessonData;
  const container = document.getElementById('lesson-step-content');
  
  // STEP 1 — PESQUISA
  if (step === 1) {
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <h3 style="font-family:Montserrat,sans-serif;font-size:16px;font-weight:700">🔍 Pesquisa Completa</h3>
        <button class="btn btn-sm btn-ghost" onclick="showPage('subject-detail')">✕ Cancelar e Voltar</button>
      </div>
      <p style="color:var(--text2);font-size:14px;margin-bottom:8px">A IA pesquisa e gera conteúdo teológico completo. Você pode editar o resultado diretamente.</p>
      <div id="research-loading" style="display:none" class="loading-pulse"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div><span>Pesquisando com IA...</span></div>
      ${data.research ? `
        <textarea id="edit-research" style="width:100%;min-height:320px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;line-height:1.7;padding:14px;resize:vertical;font-family:var(--font-main);outline:none" oninput="currentLessonData.research=this.value">${(data.research||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
        <div style="display:flex;justify-content:flex-end;margin-top:4px"><button class="btn btn-sm btn-secondary" onclick="saveEditedContent('research')">💾 Salvar edição</button></div>
      ` : '<div id="research-content" style="display:none"></div>'}
      <div class="ai-action-bar" style="margin-top:12px">
        <button class="btn btn-primary" id="research-btn" onclick="aiResearch()">🤖 ${data.research ? 'Pesquisar Novamente' : 'Pesquisar com IA'}</button>
        ${data.research ? '<button class="btn btn-secondary" id="expand-btn" onclick="expandResearch()">📈 Expandir +20%</button>' : ''}
        ${data.research ? '<button class="btn btn-success" onclick="saveStepAndAdvance(1)">💾 Salvar e Avançar →</button>' : ''}
      </div>`;
  
  // STEP 2 — ESTRUTURA
  } else if (step === 2) {
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <h3 style="font-family:Montserrat,sans-serif;font-size:16px;font-weight:700">📋 Estrutura da Aula</h3>
        <button class="btn btn-sm btn-ghost" onclick="showPage('subject-detail')">✕ Cancelar e Voltar</button>
      </div>
      <div id="structure-loading" style="display:none" class="loading-pulse"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div><span>Estruturando...</span></div>
      ${data.structure ? `
        <textarea id="edit-structure" style="width:100%;min-height:320px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;line-height:1.7;padding:14px;resize:vertical;font-family:var(--font-main);outline:none" oninput="currentLessonData.structure=this.value">${(data.structure||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
        <div style="display:flex;justify-content:flex-end;margin-top:4px"><button class="btn btn-sm btn-secondary" onclick="saveEditedContent('structure')">💾 Salvar edição</button></div>
      ` : '<div id="structure-content" style="display:none"></div>'}
      <div class="ai-action-bar" style="margin-top:12px">
        <button class="btn btn-ghost" onclick="renderLessonStep(1)">← Voltar</button>
        <button class="btn btn-primary" onclick="aiStructure()">🤖 ${data.structure ? 'Reestruturar' : 'Estruturar com IA'}</button>
        ${data.structure ? '<button class="btn btn-success" onclick="saveStepAndAdvance(2)">💾 Salvar e Avançar →</button>' : ''}
      </div>`;
  
  // STEP 3 — SLIDES
  } else if (step === 3) {
    let slidesPreview = '';
    if (data.slides) {
      try {
        const slides = JSON.parse(data.slides);
        slidesPreview = `<div style="margin-bottom:12px"><div class="slides-list">${(slides.slides || []).map((s, i) => `
          <div class="slide-preview">
            <div class="slide-num">${i + 1}</div>
            <div class="slide-content-preview">
              <div class="slide-title-preview">${escHtml(s.title)}</div>
              <div class="slide-points-preview">${(s.points || []).slice(0,2).map(p => '• ' + p).join(' ')}</div>
            </div>
          </div>`).join('')}</div></div>`;
      } catch {}
    }
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <h3 style="font-family:Montserrat,sans-serif;font-size:16px;font-weight:700">🎞️ Slides da Aula</h3>
        <button class="btn btn-sm btn-ghost" onclick="showPage('subject-detail')">✕ Cancelar e Voltar</button>
      </div>
      <div id="slides-preview">${slidesPreview}</div>
      ${data.slides ? `
        <details style="margin-top:8px">
          <summary style="cursor:pointer;font-size:12px;color:var(--text2);padding:6px 0">✏️ Editar JSON dos slides (avançado)</summary>
          <textarea id="edit-slides" style="width:100%;min-height:200px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:12px;line-height:1.5;padding:12px;resize:vertical;font-family:monospace;outline:none;margin-top:8px" oninput="currentLessonData.slides=this.value">${(data.slides||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
          <div style="display:flex;justify-content:flex-end;margin-top:4px"><button class="btn btn-sm btn-secondary" onclick="saveEditedContent('slides')">💾 Salvar edição</button></div>
        </details>
      ` : ''}
      <div id="slides-loading" style="display:none" class="loading-pulse"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div><span>Criando slides completos...</span></div>
      <div class="ai-action-bar" style="margin-top:12px">
        <button class="btn btn-ghost" onclick="renderLessonStep(2)">← Voltar</button>
        <button class="btn btn-primary" onclick="aiSlides()">🤖 ${data.slides ? 'Regerar Slides' : 'Criar Slides com IA'}</button>
        ${data.slides ? '<button class="btn btn-success" onclick="saveStepAndAdvance(3)">💾 Salvar e Avançar →</button>' : ''}
      </div>`;
  
  // STEP 4 — ANOTAÇÕES
  } else if (step === 4) {
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <h3 style="font-family:Montserrat,sans-serif;font-size:16px;font-weight:700">🗒️ Anotações do Professor</h3>
        <button class="btn btn-sm btn-ghost" onclick="showPage('subject-detail')">✕ Cancelar e Voltar</button>
      </div>
      <p style="color:var(--text2);font-size:13px;margin-bottom:8px">Anotações sincronizadas com os slides. Edite diretamente se quiser personalizar.</p>
      <div id="notes-loading" style="display:none" class="loading-pulse"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div><span>Gerando anotações sincronizadas...</span></div>
      ${data.notes ? `
        <textarea id="edit-notes" style="width:100%;min-height:320px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;line-height:1.7;padding:14px;resize:vertical;font-family:var(--font-main);outline:none" oninput="currentLessonData.notes=this.value">${(data.notes||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
        <div style="display:flex;justify-content:flex-end;margin-top:4px"><button class="btn btn-sm btn-secondary" onclick="saveEditedContent('notes')">💾 Salvar edição</button></div>
      ` : '<div id="notes-preview" style="display:none"></div>'}
      <div class="ai-action-bar" style="margin-top:12px">
        <button class="btn btn-ghost" onclick="renderLessonStep(3)">← Voltar</button>
        <button class="btn btn-primary" onclick="aiNotes('moderate')">🤖 ${data.notes ? 'Regerar' : 'Gerar Anotações'}</button>
        ${data.notes ? '<button class="btn btn-success" onclick="saveStepAndAdvance(4)">💾 Salvar e Avançar →</button>' : ''}
      </div>`;
  
  // STEP 5 — SALVAR
  } else if (step === 5) {
    const isSaved = data.status === 'saved';
    container.innerHTML = `
      <div style="text-align:center;padding:32px 20px">
        <div style="font-size:56px;margin-bottom:16px">${isSaved ? '✅' : '💾'}</div>
        <h3 style="font-family:Montserrat,sans-serif;font-size:20px;font-weight:700;margin-bottom:8px">${isSaved ? 'Aula Salva!' : 'Pronto para Salvar'}</h3>
        <p style="color:var(--text2);margin-bottom:8px;font-size:14px">
          ${isSaved ? 'Sua aula está completa. Você pode apresentá-la ou editar qualquer etapa.' : 'Todas as etapas concluídas. Salve para finalizar sua aula.'}
        </p>
        ${data.research ? '<p style="color:var(--green);font-size:12px;margin-bottom:20px">✓ Pesquisa ✓ Estrutura ✓ Slides ✓ Anotações</p>' : ''}
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-ghost" onclick="renderLessonStep(4)">← Voltar às Anotações</button>
          ${!isSaved ? '<button class="btn btn-success btn-lg" onclick="saveLesson()">💾 Salvar Aula Completa</button>' : ''}
          ${isSaved ? '<button class="btn btn-primary btn-lg" onclick="startPresentation()">📡 Apresentar Aula</button>' : ''}
          ${isSaved ? '<button class="btn btn-secondary" onclick="viewFullContent()">📖 Ver Conteúdo</button>' : ''}
        </div>
      </div>`;
  }
}

async function saveStepAndAdvance(currentStep) {
  await saveLessonData();
  const nextStep = currentStep + 1;
  // Re-render editor to update green checkmarks
  renderLessonEditor();
  // Then show the next step content
  setTimeout(() => renderLessonStep(nextStep), 50);
  toast('✅ Etapa concluída! Avançando...', 'success');
}

// ========================
// AI FUNCTIONS (Claude)
// ========================
async function aiResearch() {
  const btn = document.getElementById('research-btn');
  const loading = document.getElementById('research-loading');
  const content = document.getElementById('research-content');
  
  btn.disabled = true;
  loading.style.display = 'flex';
  content.style.display = 'none';
  
  try {
    const result = await claudeAI(
      `Faça uma pesquisa COMPLETA e DETALHADA sobre o tema teológico: "\${currentLessonData.title}" para um seminário presbiteriano renovado.

REGRAS OBRIGATÓRIAS ANTI-REPETIÇÃO:
- NUNCA repita o mesmo sujeito em itens consecutivos (ex: não comece 3 frases com o mesmo termo)
- Cada ponto deve trazer uma informação NOVA e DISTINTA do anterior
- Varie a estrutura das frases: use sujeitos diferentes, verbos variados, perspectivas distintas
- Se um conceito já foi mencionado, não o repita — apenas aprofunde ou conecte com outro

Estruture com:
## 1. Introdução e Contexto Bíblico
## 2. Fundamentos Teológicos Reformados
## 3. Desenvolvimento Doutrinal
## 4. Aplicações Práticas para o Ministério
## 5. Perspectiva Presbiteriana Renovada
## 6. Síntese

Use referências bíblicas específicas. Cite teólogos reformados quando relevante.`,
      'Você é especialista em teologia reformada e presbiteriana renovada. Crie conteúdo teológico rico, variado e sem repetições, fundamentado nas Escrituras. Nunca repita o mesmo sujeito em pontos consecutivos.'
    );
    
    currentLessonData.research = result;
    await saveLessonData();
    content.innerHTML = markdownToHtml(result);
    content.style.display = 'block';
    renderLessonStep(1);
    toast('Pesquisa concluída!', 'success');
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    loading.style.display = 'none';
  }
}

async function aiStructure() {
  const loading = document.getElementById('structure-loading');
  const content = document.getElementById('structure-content');
  loading.style.display = 'flex';
  content.style.display = 'none';
  
  try {
    const result = await claudeAI(
      `Com base na pesquisa sobre "\${currentLessonData.title}", crie uma estrutura pedagógica para uma aula de seminário presbiteriano renovado.
      
Pesquisa: \${currentLessonData.research}

REGRAS ANTI-REPETIÇÃO:
- Cada objetivo de aprendizagem deve ser ÚNICO e diferente dos demais
- Cada tópico deve cobrir um aspecto distinto — nunca repita conceitos
- Varie a linguagem: não comece itens consecutivos com as mesmas palavras

Estrutura:
## Objetivos de Aprendizagem (5-7 objetivos únicos e distintos)
## Divisão Temporal (com tempo estimado para cada parte)
## Tópicos Principais (cada um com subtópicos únicos)
## Atividades e Dinâmicas (para engajar os alunos do seminário)
## Avaliação da Aprendizagem`
    );
    
    currentLessonData.structure = result;
    await saveLessonData();
    content.innerHTML = markdownToHtml(result);
    content.style.display = 'block';
    renderLessonStep(2);
    toast('Estrutura criada!', 'success');
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  } finally {
    loading.style.display = 'none';
  }
}

async function aiSlides() {
  const loading = document.getElementById('slides-loading');
  const preview = document.getElementById('slides-preview');
  loading.style.display = 'flex';
  preview.innerHTML = '';
  
  try {
    const result = await claudeJSON(
      `Crie slides COMPLETOS para aula teológica sobre "\${currentLessonData.title}" em seminário presbiteriano renovado.
      
Conteúdo base: \${(currentLessonData.research || '').substring(0, 3000)}

REGRAS OBRIGATÓRIAS ANTI-REPETIÇÃO:
- Cada point deve ser ÚNICO — nunca comece dois points consecutivos com o mesmo sujeito
- NÃO repita conceitos entre slides diferentes
- Cada slide deve cobrir um aspecto DISTINTO do tema
- Varie a estrutura: use sujeitos, verbos e perspectivas diferentes em cada point
- Se um conceito aparece em um slide, não o repita em outro

Retorne APENAS JSON válido:
{
  "slides": [
    {
      "type": "intro",
      "title": "Título do slide",
      "subtitle": "Subtítulo opcional",
      "points": ["frase completa única 1", "frase completamente diferente 2", ...],
      "subpoints": { "ponto": ["detalhe a", "detalhe b"] },
      "note": "Orientação exclusiva para o professor"
    }
  ]
}

REGRAS:
- 10 a 14 slides. Tipos: intro, content, example, activity, summary, conclusion
- 4 a 6 points por slide, cada um DIFERENTE dos demais
- Inclua referências bíblicas nos points quando relevante
- Inclua slide de atividade/discussão para os alunos do seminário`,
      'Retorne APENAS JSON válido. Nunca repita o mesmo sujeito em points consecutivos. Contexto: seminário presbiteriano renovado.'
    );
    
    currentLessonData.slides = JSON.stringify(result);
    presentationSlides = result.slides || [];
    await saveLessonData();
    renderLessonStep(3);
    toast('Slides criados!', 'success');
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  } finally {
    loading.style.display = 'none';
  }
}

async function aiNotes(detail) {
  const loading = document.getElementById('notes-loading');
  const preview = document.getElementById('notes-preview');
  if (loading) loading.style.display = 'flex';
  if (preview) preview.style.display = 'none';
  
  try {
    let slides = [];
    if (currentLessonData.slides) {
      try { slides = JSON.parse(currentLessonData.slides).slides || []; } catch {}
    }
    
    if (slides.length === 0) {
      toast('Gere os slides primeiro!', 'error');
      return;
    }
    
    // Build detailed slide map for prompt
    const slideSummary = slides.map((s, i) => {
      const points = (s.points || []);
      return `SLIDE ${i+1}: "${s.title}"\n` + points.map((p, j) => `  Tópico ${j+1}: ${p}`).join('\n');
    }).join('\n\n');
    
    const result = await claudeAI(
      `Crie anotações de professor para a aula sobre "${currentLessonData.title}".

REGRAS OBRIGATÓRIAS:
- Para cada slide, escreva EXATAMENTE o mesmo número de anotações que o número de tópicos do slide
- Cada anotação explica APENAS o seu tópico correspondente — sem repetir o texto do slide
- Escreva o que o professor deve FALAR/EXPLICAR sobre aquele tópico específico
- Seja objetivo e único — sem repetições entre tópicos
- Se o tópico menciona "Panteísmo", explique o conceito brevemente para o professor falar

FORMATO EXATO (siga à risca):
## Slide N — [Título do Slide]
⏱️ [X] minutos
1. [Explicação única do Tópico 1 — o que falar em 1-2 frases]
2. [Explicação única do Tópico 2]
... (mesmo número que os tópicos do slide)
💡 [Uma dica pedagógica curta]

SLIDES:
${slideSummary}

NÃO repita frases entre tópicos. Cada número deve trazer informação NOVA e DISTINTA.
NUNCA comece dois itens consecutivos com o mesmo sujeito ou verbo.
Varie a perspectiva: teológica, prática, bíblica, histórica, aplicada ao ministério.`
    );
    
    currentLessonData.notes = result;
    await saveLessonData();
    if (preview) { preview.innerHTML = markdownToHtml(result); preview.style.display = 'block'; }
    renderLessonStep(4);
    toast('Anotações sincronizadas!', 'success');
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  } finally {
    if (loading) loading.style.display = 'none';
  }
}

async function adjustContent(mode) {
  const editor = document.getElementById('content-editor');
  const current = editor.value;
  
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '⏳';
  
  try {
    const result = await claudeAI(
      mode === 'expand' 
        ? `Expanda e enriqueça o seguinte conteúdo educacional, adicionando mais exemplos, explicações e detalhes:\n\n${current}`
        : `Reduza e sintetize o seguinte conteúdo educacional, mantendo apenas os pontos essenciais:\n\n${current}`
    );
    editor.value = result;
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = mode === 'expand' ? '+ Expandir' : '- Reduzir';
  }
}

function saveContentEdits() {
  const edited = document.getElementById('content-editor')?.value;
  if (edited) currentLessonData.research = edited;
  saveLessonData();
  renderLessonStep(4);
}

async function saveLessonData() {
  if (!currentLessonId) return;
  try {
    const sb = getSupabase();
    await sb.from('lessons').update({
      research: currentLessonData.research || null,
      structure: currentLessonData.structure || null,
      slides: currentLessonData.slides || null,
      notes: currentLessonData.notes || null,
      status: currentLessonData.status || 'draft'
    }).eq('id', currentLessonId);
  } catch {}
}

async function saveLesson() {
  try {
    currentLessonData.status = 'saved';
    await saveLessonData();
    toast('Aula salva com sucesso!', 'success');
    renderLessonEditor();
  } catch (err) { toast('Erro ao salvar: ' + err.message, 'error'); }
}

function viewFullContent() {
  const container = document.getElementById('lesson-step-content');
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h3 style="font-family:Syne,sans-serif">📖 Conteúdo Completo</h3>
      <button class="btn btn-ghost btn-sm" onclick="renderLessonEditor()">← Voltar</button>
    </div>
    <div class="ai-content-area" style="max-height:none">${markdownToHtml(currentLessonData.research || '')}</div>
    ${currentLessonData.structure ? `<h4 style="margin:20px 0 12px;font-family:Syne,sans-serif">Estrutura</h4><div class="ai-content-area" style="max-height:none">${markdownToHtml(currentLessonData.structure)}</div>` : ''}
  `;
}

// ========================
// PRESENTATION
// ========================
function startPresentation() {
  if (currentLessonData.slides) {
    try {
      const parsed = JSON.parse(currentLessonData.slides);
      presentationSlides = parsed.slides || [];
    } catch {}
  }
  if (!presentationSlides || presentationSlides.length === 0) return toast('Crie os slides primeiro', 'error');
  currentSlide = 0;
  // Use the unified presentation screen from study-addon.js
  startPresentationStudy();
}

// Keep legacy functions for keyboard listener compatibility
function nextSlide() { nextSlideStudy(); }
function prevSlide() { prevSlideStudy(); }
function toggleNotes() {}
function exitPresentation() { closePresentationScreen(); }

document.addEventListener('keydown', (e) => {
  const p = document.getElementById('presentation-screen');
  if (!p || p.style.display !== 'flex') return;
  const active = document.activeElement;
  const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
  if (isTyping) return;
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextSlideStudy(); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlideStudy(); }
  if (e.key === 'Escape') closePresentationScreen();
});

// ========================
// EXAM GENERATOR
// ========================
function openExamModal(subjectId) {
  currentSubjectId = subjectId;
  currentExamData = null;
  document.getElementById('exam-preview').innerHTML = '';
  document.getElementById('exam-modal-footer').style.display = 'none';
  openModal('exam-modal');
}

async function generateExam() {
  const btn = document.getElementById('gen-exam-btn');
  const preview = document.getElementById('exam-preview');
  const count = document.getElementById('exam-count').value;
  const type = document.getElementById('exam-type').value;
  const difficulty = document.getElementById('exam-difficulty').value;
  
  btn.disabled = true;
  btn.textContent = '⏳ Gerando...';
  preview.innerHTML = '<div class="loading-pulse" style="justify-content:center;padding:20px"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div><span>Gerando prova com IA...</span></div>';
  
  try {
    const subjects = await dbGet('subjects');
    const subject = subjects.find(s => s.id === currentSubjectId);
    
    const typeMap = { multiple: 'múltipla escolha (4 alternativas, indique a correta)', essay: 'dissertativa', truefalse: 'verdadeiro ou falso' };
    const diffMap = { easy: 'fácil (conceitos básicos)', medium: 'médio (compreensão e aplicação)', hard: 'difícil (análise e síntese)' };
    
    const exam = await claudeJSON(
      `Crie uma prova de ${count} questões de ${typeMap[type]} sobre ${subject?.name || 'a matéria'}.
      Dificuldade: ${diffMap[difficulty]}.
      
      Retorne APENAS JSON válido (sem markdown):
      {
        "title": "Título da Prova - ${subject?.name || 'Matéria'}",
        "questions": [
          {
            "number": 1,
            "question": "Texto completo da questão",
            "options": ["A) opção", "B) opção", "C) opção", "D) opção"],
            "answer": "A",
            "explanation": "Breve explicação da resposta correta"
          }
        ]
      }
      
      Para dissertativas, omita "options" e "answer". Para verdadeiro/falso, use apenas "Verdadeiro" e "Falso" nas options.`,
      'Retorne APENAS JSON válido sem texto extra.'
    );
    
    currentExamData = exam;
    
    preview.innerHTML = `
      <h3 style="font-family:Syne,sans-serif;margin-bottom:16px">${escHtml(exam.title || 'Prova Gerada')}</h3>
      ${(exam.questions || []).map(q => `
        <div class="exam-question">
          <div class="exam-question-num">Questão ${q.number}</div>
          <div class="exam-question-text">${escHtml(q.question)}</div>
          ${q.options ? `
            <div class="exam-options">
              ${q.options.map(opt => `<div class="exam-option ${q.answer && opt.startsWith(q.answer) ? 'correct' : ''}">${escHtml(opt)}</div>`).join('')}
            </div>` : ''}
          ${q.explanation ? `<div style="margin-top:8px;font-size:12px;color:var(--text3);padding:6px 10px;background:var(--bg2);border-radius:6px">💡 ${escHtml(q.explanation)}</div>` : ''}
        </div>
      `).join('')}
    `;
    
    document.getElementById('exam-modal-footer').style.display = 'flex';
    toast('Prova gerada!', 'success');
  } catch (err) {
    preview.innerHTML = `<p style="color:var(--red)">Erro: ${err.message}</p>`;
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔁 Gerar Novamente';
  }
}

async function saveExam() {
  if (!currentExamData) return;
  const count = document.getElementById('exam-count').value;
  const type = document.getElementById('exam-type').value;
  const difficulty = document.getElementById('exam-difficulty').value;
  
  try {
    const sb = getSupabase();
    await sb.from('exams').insert({
      title: currentExamData.title || 'Prova',
      content: JSON.stringify(currentExamData),
      difficulty,
      question_type: type,
      question_count: parseInt(count),
      subject_id: currentSubjectId,
      user_id: currentUser.id
    });
    closeModal('exam-modal');
    toast('Prova salva!', 'success');
    if (document.getElementById('page-subject-detail').classList.contains('active')) {
      switchSubjectTab('exams');
    }
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteExam(id) {
  if (!confirm('Excluir esta prova?')) return;
  try {
    const sb = getSupabase();
    await sb.from('exams').delete().eq('id', id);
    toast('Prova excluída', 'success');
    switchSubjectTab('exams');
  } catch {}
}

function exportExamPDF() {
  if (!currentExamData) return;
  exportToPDF('prova', renderExamForPDF(currentExamData));
}

async function exportSavedExamPDF(examId) {
  try {
    const exam = await dbGetOne('exams', examId);
    const data = JSON.parse(exam.content);
    exportToPDF('prova', renderExamForPDF(data));
  } catch {}
}

function renderExamForPDF(data) {
  return `
    <h1 style="font-size:22px;margin-bottom:8px">${data.title || 'Avaliação'}</h1>
    <p style="margin-bottom:24px">Nome: ______________________________ Data: ___________ Nota: _______</p>
    ${(data.questions || []).map(q => `
      <div style="margin-bottom:20px;page-break-inside:avoid">
        <strong>${q.number}. ${q.question}</strong><br>
        ${q.options ? q.options.map(o => `<div style="margin:4px 0 4px 16px">( ) ${o}</div>`).join('') : '<div style="margin-top:40px;border-bottom:1px solid #ccc"></div><div style="margin-top:40px;border-bottom:1px solid #ccc"></div>'}
      </div>
    `).join('')}`;
}

// ========================
// ASSIGNMENT GENERATOR
// ========================
function openAssignmentModal(subjectId) {
  currentSubjectId = subjectId;
  currentAssignmentData = null;
  selectedAssignmentIdx = 0;
  document.getElementById('assignment-preview').innerHTML = '';
  document.getElementById('assignment-modal-footer').style.display = 'none';
  openModal('assignment-modal');
}

async function generateAssignment() {
  const btn = document.getElementById('gen-assignment-btn');
  const preview = document.getElementById('assignment-preview');
  
  btn.disabled = true;
  btn.textContent = '⏳ Gerando...';
  preview.innerHTML = '<div class="loading-pulse" style="justify-content:center;padding:20px"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div><span>Gerando trabalhos com IA...</span></div>';
  
  try {
    const subjects = await dbGet('subjects');
    const subject = subjects.find(s => s.id === currentSubjectId);
    
    const result = await claudeJSON(
      `Crie 3 sugestões de trabalhos/atividades criativas para a matéria: ${subject?.name || 'esta matéria'}.
      
      Retorne APENAS JSON válido:
      {
        "assignments": [
          {
            "title": "Título do trabalho",
            "type": "pesquisa|texto|apresentação|estudo|prático",
            "description": "Descrição completa do que os alunos devem fazer",
            "objectives": ["objetivo 1", "objetivo 2", "objetivo 3"],
            "deadline": "Prazo sugerido (ex: 2 semanas)",
            "criteria": ["critério de avaliação 1", "critério 2"]
          }
        ]
      }`,
      'Retorne APENAS JSON válido sem texto extra.'
    );
    
    currentAssignmentData = result.assignments || [];
    
    const typeEmoji = { pesquisa: '🔍', texto: '✍️', 'apresentação': '📊', estudo: '📚', prático: '🔧' };
    
    preview.innerHTML = `
      <p style="font-size:13px;color:var(--text2);margin-bottom:12px">Clique em um trabalho para selecioná-lo:</p>
      ${currentAssignmentData.map((a, i) => `
        <div class="exam-question assignment-option" style="cursor:pointer;transition:all .2s;border:1px solid var(--border)" onclick="selectAssignment(${i}, this)">
          <div class="exam-question-num" style="color:var(--purple)">${typeEmoji[a.type] || '📄'} ${(a.type || '').toUpperCase()}</div>
          <div class="exam-question-text" style="font-size:15px;font-weight:600">${escHtml(a.title)}</div>
          <p style="font-size:13px;color:var(--text2);margin-bottom:8px">${escHtml(a.description)}</p>
          ${a.objectives ? `<div style="font-size:12px;color:var(--text3)">${a.objectives.map(o => '• ' + o).join(' · ')}</div>` : ''}
          <div style="margin-top:8px;font-size:12px;color:var(--text3)">📅 ${a.deadline}</div>
        </div>
      `).join('')}
    `;
    
    document.getElementById('assignment-modal-footer').style.display = 'flex';
    toast('Trabalhos gerados!', 'success');
  } catch (err) {
    preview.innerHTML = `<p style="color:var(--red)">Erro: ${err.message}</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '🔁 Novas Ideias';
  }
}

function selectAssignment(idx, el) {
  document.querySelectorAll('.assignment-option').forEach(a => {
    a.style.borderColor = 'var(--border)';
    a.style.background = '';
  });
  el.style.borderColor = 'var(--purple)';
  el.style.background = 'rgba(168,85,247,0.08)';
  selectedAssignmentIdx = idx;
}

async function saveAssignment() {
  if (!currentAssignmentData || !currentAssignmentData[selectedAssignmentIdx]) return toast('Selecione um trabalho', 'error');
  const a = currentAssignmentData[selectedAssignmentIdx];
  
  try {
    const sb = getSupabase();
    await sb.from('assignments').insert({
      title: a.title,
      content: JSON.stringify(a),
      subject_id: currentSubjectId,
      user_id: currentUser.id
    });
    closeModal('assignment-modal');
    toast('Trabalho salvo!', 'success');
    if (document.getElementById('page-subject-detail').classList.contains('active')) {
      switchSubjectTab('assignments');
    }
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteAssignment(id) {
  if (!confirm('Excluir este trabalho?')) return;
  try {
    const sb = getSupabase();
    await sb.from('assignments').delete().eq('id', id);
    toast('Trabalho excluído', 'success');
    switchSubjectTab('assignments');
  } catch {}
}

// ========================
// STUDENTS
// ========================
async function loadStudents() {
  try {
    const students = await dbGet('students');
    const el = document.getElementById('students-table');
    
    if (students.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👨‍🎓</div><div class="empty-state-title">Nenhum aluno cadastrado</div><button class="btn btn-primary" onclick="openModal(\'add-student-modal\')" style="margin-top:16px">+ Novo Aluno</button></div>';
      return;
    }
    
    el.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Matrícula</th><th>Criado em</th><th></th></tr></thead>
          <tbody>
            ${students.map(s => `
              <tr>
                <td style="font-weight:500">${escHtml(s.name)}</td>
                <td>${escHtml(s.email || '-')}</td>
                <td>${escHtml(s.registration || '-')}</td>
                <td>${formatDate(s.created_at)}</td>
                <td><button class="btn btn-sm btn-danger btn-icon" onclick="deleteStudent('${s.id}')">🗑</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) { toast('Erro ao carregar alunos', 'error'); }
}

async function createStudent() {
  const name = document.getElementById('student-name').value.trim();
  const email = document.getElementById('student-email').value.trim();
  const registration = document.getElementById('student-registration').value.trim();
  if (!name) return toast('Nome obrigatório', 'error');
  
  try {
    await dbInsert('students', { name, email, registration });
    closeModal('add-student-modal');
    document.getElementById('student-name').value = '';
    document.getElementById('student-email').value = '';
    document.getElementById('student-registration').value = '';
    toast('Aluno cadastrado!', 'success');
    loadStudents();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteStudent(id) {
  if (!confirm('Excluir este aluno?')) return;
  try {
    await dbDelete('students', id);
    toast('Aluno excluído', 'success');
    loadStudents();
  } catch (err) { toast(err.message, 'error'); }
}

// ========================
// GRADES
// ========================
function loadGradesSelect() { loadSubjectsForSelects(); }

async function openGradeModal() {
  try {
    const sb = getSupabase();
    const { data: students } = await sb.from('subject_students').select('students(*)').eq('subject_id', currentSubjectId);
    const studentList = (students || []).map(ss => ss.students).filter(Boolean);
    
    document.getElementById('grade-student').innerHTML = studentList.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
    document.getElementById('grade-date').value = new Date().toISOString().split('T')[0];
    openModal('add-grade-modal');
  } catch { openModal('add-grade-modal'); }
}

async function saveGrade() {
  const studentId = document.getElementById('grade-student').value;
  const activity = document.getElementById('grade-activity').value.trim();
  const grade = parseFloat(document.getElementById('grade-value').value);
  const maxGrade = parseFloat(document.getElementById('grade-max').value) || 10;
  const date = document.getElementById('grade-date').value;
  
  if (!activity || isNaN(grade)) return toast('Preencha todos os campos', 'error');
  
  try {
    const sb = getSupabase();
    await sb.from('grades').insert({ student_id: studentId, activity, grade, max_grade: maxGrade, date, subject_id: currentSubjectId, user_id: currentUser.id });
    closeModal('add-grade-modal');
    toast('Nota lançada!', 'success');
    if (document.getElementById('subject-grades-table')) loadSubjectGradesTable();
  } catch (err) { toast(err.message, 'error'); }
}

async function loadGrades() {
  const subjectId = document.getElementById('grades-subject-select')?.value;
  if (!subjectId) return;
  currentSubjectId = subjectId;
  
  try {
    const sb = getSupabase();
    const { data: grades } = await sb.from('grades').select('*, students(name)').eq('subject_id', subjectId).order('created_at', { ascending: false });
    const container = document.getElementById('grades-table');
    
    if (!grades || grades.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-title">Nenhuma nota lançada</div></div>';
      return;
    }
    
    container.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Aluno</th><th>Atividade</th><th>Nota</th><th>Máximo</th><th>%</th><th>Data</th></tr></thead>
          <tbody>
            ${grades.map(g => `
              <tr>
                <td>${escHtml(g.students?.name || '-')}</td>
                <td>${escHtml(g.activity)}</td>
                <td><strong>${g.grade}</strong></td>
                <td>${g.max_grade}</td>
                <td><span class="badge ${(g.grade/g.max_grade) >= 0.6 ? 'badge-green' : 'badge-red'}">${Math.round(g.grade/g.max_grade*100)}%</span></td>
                <td>${formatDate(g.date)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch {}
}

// ========================
// CALENDAR
// ========================
async function renderCalendar() {
  const sb = getSupabase();
  const { data: events } = await sb.from('calendar_events').select('*').eq('user_id', currentUser.id).catch(() => ({ data: [] }));
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  
  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('calendar-title').textContent = `${monthNames[month]} ${year}`;
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toDateString();
  
  const eventDays = {};
  (events || []).forEach(e => {
    const d = new Date(e.date + 'T00:00');
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!eventDays[key]) eventDays[key] = [];
    eventDays[key].push(e);
  });
  
  let html = `<div class="calendar-grid">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => `<div class="calendar-day-name">${d}</div>`).join('')}`;
  
  for (let i = 0; i < firstDay; i++) html += '<div class="calendar-day other-month"></div>';
  
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const isToday = date.toDateString() === today;
    const key = `${year}-${month}-${d}`;
    const dayEvents = eventDays[key] || [];
    
    html += `
      <div class="calendar-day ${isToday ? 'today' : ''} ${dayEvents.length ? 'has-event' : ''}">
        <span style="font-weight:${isToday ? '700' : '400'};color:${isToday ? 'var(--accent2)' : 'var(--text)'}">${d}</span>
        ${dayEvents.map(e => `<span style="font-size:9px;color:var(--accent2);width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(e.title)}</span>`).join('')}
      </div>`;
  }
  
  html += '</div>';
  document.getElementById('calendar-grid').innerHTML = html;
}

function changeMonth(dir) { calendarDate.setMonth(calendarDate.getMonth() + dir); renderCalendar(); }

async function createEvent() {
  const title = document.getElementById('event-title').value.trim();
  const date = document.getElementById('event-date').value;
  if (!title || !date) return toast('Título e data obrigatórios', 'error');
  
  const type = document.getElementById('event-type').value;
  const description = document.getElementById('event-desc').value;
  
  try {
    const sb = getSupabase();
    await sb.from('calendar_events').insert({ title, date, type, description, user_id: currentUser.id });
    closeModal('add-event-modal');
    toast('Evento criado!', 'success');
    renderCalendar();
  } catch (err) { toast(err.message, 'error'); }
}

// ========================
// REPORTS
// ========================
function loadReportsSelect() { loadSubjectsForSelects(); }

async function loadReports() {
  const subjectId = document.getElementById('report-subject-select').value;
  if (!subjectId) return;
  currentSubjectId = subjectId;
  
  try {
    const sb = getSupabase();
    const [{ data: students }, { data: attendance }, { data: grades }] = await Promise.all([
      sb.from('subject_students').select('students(*)').eq('subject_id', subjectId),
      sb.from('attendance').select('*, students(name)').eq('user_id', currentUser.id),
      sb.from('grades').select('*, students(name)').eq('subject_id', subjectId)
    ]);
    
    const studentList = (students || []).map(ss => ss.students).filter(Boolean);
    const container = document.getElementById('reports-content');
    
    // Calculate attendance per student
    const attStats = {};
    studentList.forEach(s => { attStats[s.id] = { name: s.name, total: 0, present: 0 }; });
    (attendance || []).forEach(a => {
      if (attStats[a.student_id]) {
        attStats[a.student_id].total++;
        if (a.status === 'present') attStats[a.student_id].present++;
      }
    });
    
    // Calculate grade averages per student
    const gradeStats = {};
    studentList.forEach(s => { gradeStats[s.id] = { name: s.name, total: 0, sum: 0 }; });
    (grades || []).forEach(g => {
      if (gradeStats[g.student_id]) {
        gradeStats[g.student_id].total++;
        gradeStats[g.student_id].sum += (g.grade / g.max_grade) * 10;
      }
    });
    
    const attendanceData = Object.values(attStats);
    const gradesData = Object.values(gradeStats);
    
    container.innerHTML = `
      <div class="card">
        <div class="card-header"><span class="card-title">✅ Frequência</span></div>
        <div class="card-body">
          ${attendanceData.length === 0 ? '<div class="empty-state"><div class="empty-state-title">Sem dados de frequência</div></div>' :
            attendanceData.map(a => {
              const pct = a.total > 0 ? Math.round((a.present / a.total) * 100) : 0;
              return `
                <div class="report-row">
                  <div class="report-name">${escHtml(a.name)}</div>
                  <div class="report-bar-container"><div class="report-bar" style="width:${pct}%;background:${pct >= 75 ? 'var(--green)' : 'var(--red)'}"></div></div>
                  <div class="report-pct" style="color:${pct >= 75 ? 'var(--green)' : 'var(--red)'}">${pct}%</div>
                </div>`;
            }).join('')}
        </div>
      </div>
      
      <div class="card">
        <div class="card-header"><span class="card-title">📊 Desempenho</span></div>
        <div class="card-body">
          ${gradesData.length === 0 ? '<div class="empty-state"><div class="empty-state-title">Sem notas lançadas</div></div>' :
            gradesData.map(g => {
              const avg = g.total > 0 ? (g.sum / g.total).toFixed(1) : '-';
              const pct = g.total > 0 ? Math.round(g.sum / g.total * 10) : 0;
              return `
                <div class="report-row">
                  <div class="report-name">${escHtml(g.name)}</div>
                  <div class="report-bar-container"><div class="report-bar" style="width:${pct}%;background:${pct >= 60 ? 'var(--green)' : 'var(--red)'}"></div></div>
                  <div class="report-pct" style="color:${pct >= 60 ? 'var(--green)' : 'var(--red)'}">${avg}</div>
                </div>`;
            }).join('')}
        </div>
      </div>`;
  } catch (err) { toast('Erro ao carregar relatórios', 'error'); }
}

function exportReportPDF() {
  const content = document.getElementById('reports-content');
  if (!content) return;
  exportToPDF('relatorio', content.innerHTML);
}

// ========================
// PDF EXPORT
// ========================
function exportToPDF(name, content) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AulaFlow — ${name}</title>
    <style>body{font-family:Arial,sans-serif;padding:40px;color:#333;line-height:1.6}h1{color:#4f46e5;margin-bottom:20px}.exam-question{margin-bottom:20px;padding:16px;border:1px solid #ddd;border-radius:8px}.exam-question-num{font-size:12px;font-weight:bold;color:#6366f1;margin-bottom:8px}.exam-question-text{font-weight:600;margin-bottom:8px}.exam-option{margin:4px 0 4px 16px}.report-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #eee}.report-name{flex:1}@media print{body{padding:20px}}</style>
    </head><body>
    <div style="text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #6366f1"><h1>📚 AulaFlow</h1><p style="color:#666">Gerado em ${new Date().toLocaleDateString('pt-BR')}</p></div>
    ${content}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

// ========================
// HELPERS
// ========================
function markdownToHtml(text) {
  if (!text) return '';
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return dateStr; }
}

function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${escHtml(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; setTimeout(() => el.remove(), 300); }, 3500);
}

// ========================
// EXPAND RESEARCH
// ========================
async function expandResearch() {
  if (!currentLessonData.research) return toast('Faça a pesquisa primeiro', 'error');
  
  const btn = document.getElementById('expand-btn');
  const loading = document.getElementById('research-loading');
  const content = document.getElementById('research-content');
  
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Expandindo...'; }
  if (loading) loading.style.display = 'flex';
  
  try {
    const result = await claudeAI(
      `Expanda o seguinte conteúdo educacional sobre "${currentLessonData.title}" em aproximadamente 20%, adicionando:
      - Mais argumentos e evidências para os pontos já existentes
      - Exemplos adicionais mais detalhados
      - Contexto histórico ou científico extra
      - Conexões com outros temas relevantes
      
      CONTEÚDO ATUAL:
      ${currentLessonData.research}
      
      Mantenha a estrutura e os títulos originais, apenas enriqueça cada seção com mais conteúdo.`
    );
    
    currentLessonData.research = result;
    await saveLessonData();
    if (content) { content.innerHTML = markdownToHtml(result); content.style.display = 'block'; }
    toast('Conteúdo expandido em 20%!', 'success');
    renderLessonStep(1);
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  } finally {
    if (loading) loading.style.display = 'none';
    if (btn) { btn.disabled = false; btn.textContent = '📈 Expandir +20%'; }
  }
}

// ========================
// THEME TOGGLE
// ========================
function toggleTheme() {
  const body = document.body;
  body.classList.toggle('light-mode');
  const isLight = body.classList.contains('light-mode');
  const icon = isLight ? '🌙' : '☀️';
  const title = isLight ? 'Mudar para Modo Escuro' : 'Mudar para Modo Claro';
  // Update all theme buttons
  ['theme-btn','editor-theme-btn','study-theme-btn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) { btn.textContent = icon; btn.title = title; }
  });
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  const btn = document.getElementById('theme-btn');
  if (saved === 'light') {
    document.body.classList.add('light-mode');
    if (btn) { btn.textContent = '🌙'; btn.title = 'Mudar para Modo Escuro'; }
  } else {
    if (btn) { btn.textContent = '☀️'; btn.title = 'Mudar para Modo Claro'; }
  }
}
// Init after DOM loads
document.addEventListener('DOMContentLoaded', () => setTimeout(initTheme, 100));
