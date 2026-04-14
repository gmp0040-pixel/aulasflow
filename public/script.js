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
async function claudeAI(prompt, systemPrompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: systemPrompt || "Você é um assistente educacional especializado em criar conteúdo pedagógico de alta qualidade em português brasileiro. Seja detalhado, preciso e didático.",
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Erro na IA');
  return data.content[0].text;
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
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    
    const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
    currentUser = { id: data.user.id, name: profile?.name || email, email };
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
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    
    // Save profile
    await sb.from('profiles').upsert({ id: data.user.id, name, email });
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
  if (error) throw new Error(error.message);
  return data || [];
}

async function dbGetOne(table, id) {
  const sb = getSupabase();
  const { data, error } = await sb.from(table).select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data;
}

async function dbInsert(table, obj) {
  const sb = getSupabase();
  const { data, error } = await sb.from(table).insert({ ...obj, user_id: currentUser.id }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function dbUpdate(table, id, obj) {
  const sb = getSupabase();
  const { data, error } = await sb.from(table).update(obj).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function dbDelete(table, id) {
  const sb = getSupabase();
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
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
              <button class="btn btn-sm btn-ghost" onclick="openStudyScreen('${l.id}', '${escHtml(l.title)}')">🎓 Estudar</button>
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
  
  let activeStep = 1;
  if (data.research) activeStep = 2;
  if (data.structure) activeStep = 3;
  if (data.slides) activeStep = 4;
  if (data.notes) activeStep = 5;
  if (isSaved) activeStep = 6;
  
  const steps = [
    { num: 1, label: 'Pesquisa' },
    { num: 2, label: 'Estrutura' },
    { num: 3, label: 'Conteúdo' },
    { num: 4, label: 'Slides' },
    { num: 5, label: 'Anotações' },
    { num: 6, label: 'Salvar' },
  ];
  
  const stepsHtml = steps.map(s => `
    <div class="ai-step ${s.num < activeStep ? 'completed' : s.num === activeStep ? 'active' : ''}">
      <div class="ai-step-num">${s.num < activeStep ? '✓' : s.num}</div>
      <span>${s.label}</span>
    </div>
  `).join('');
  
  const container = document.getElementById('lesson-editor-content');
  container.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-sm btn-ghost" onclick="showPage('subject-detail')">← Voltar</button>
      <h2 style="font-family:Syne,sans-serif;font-size:18px;font-weight:700;flex:1">${escHtml(data.title)}</h2>
      ${isSaved ? `<button class="btn btn-sm btn-primary" onclick="startPresentation()">📡 Apresentar</button>` : ''}
    </div>
    
    <div class="ai-steps">${stepsHtml}</div>
    <button class="btn-study" onclick="openStudyScreen('${currentLessonId}', '${escHtml(data.title || '')}')">🎓 Modo Estudo</button>
    
    <div class="card">
      <div class="card-body" id="lesson-step-content"></div>
    </div>
  `;
  
  renderLessonStep(activeStep);
}

function renderLessonStep(step) {
  const data = currentLessonData;
  const container = document.getElementById('lesson-step-content');
  
  if (step === 1 || !data.research) {
    container.innerHTML = `
      <h3 style="font-family:Syne,sans-serif;margin-bottom:16px">🔍 Pesquisa Completa</h3>
      <p style="color:var(--text2);font-size:14px;margin-bottom:16px">A IA irá pesquisar e gerar o conteúdo completo sobre o tópico.</p>
      <div id="research-content" class="ai-content-area" style="display:${data.research ? 'block' : 'none'}">${markdownToHtml(data.research || '')}</div>
      <div id="research-loading" style="display:none" class="loading-pulse"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div><span>Pesquisando com IA...</span></div>
      <div class="ai-action-bar" style="margin-top:12px">
        <button class="btn btn-primary" id="research-btn" onclick="aiResearch()">🤖 Pesquisar com IA</button>
        ${data.research ? '<button class="btn btn-success" onclick="renderLessonStep(2)">Próximo: Estruturar →</button>' : ''}
      </div>`;
  } else if (step === 2) {
    container.innerHTML = `
      <h3 style="font-family:Syne,sans-serif;margin-bottom:16px">📋 Estrutura da Aula</h3>
      <div id="structure-content" class="ai-content-area" style="display:${data.structure ? 'block' : 'none'}">${markdownToHtml(data.structure || '')}</div>
      <div id="structure-loading" style="display:none" class="loading-pulse"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div><span>Estruturando...</span></div>
      <div class="ai-action-bar" style="margin-top:12px">
        <button class="btn btn-ghost" onclick="renderLessonStep(1)">← Pesquisa</button>
        <button class="btn btn-primary" onclick="aiStructure()">🤖 ${data.structure ? 'Reestruturar' : 'Estruturar com IA'}</button>
        ${data.structure ? '<button class="btn btn-success" onclick="renderLessonStep(3)">Próximo: Conteúdo →</button>' : ''}
      </div>`;
  } else if (step === 3) {
    container.innerHTML = `
      <h3 style="font-family:Syne,sans-serif;margin-bottom:16px">📝 Ajustar Conteúdo</h3>
      <textarea id="content-editor" class="form-textarea" style="min-height:300px;font-size:13px">${data.research || ''}</textarea>
      <div class="ai-action-bar" style="margin-top:12px">
        <button class="btn btn-ghost" onclick="renderLessonStep(2)">← Estrutura</button>
        <button class="btn btn-secondary" onclick="adjustContent('expand')">+ Expandir</button>
        <button class="btn btn-secondary" onclick="adjustContent('reduce')">- Reduzir</button>
        <button class="btn btn-success" onclick="saveContentEdits()">Salvar e Continuar →</button>
      </div>`;
  } else if (step === 4) {
    let slidesPreview = '';
    if (data.slides) {
      try {
        const slides = JSON.parse(data.slides);
        slidesPreview = `<div style="margin-bottom:12px"><div class="slides-list">${(slides.slides || []).map((s, i) => `
          <div class="slide-preview">
            <div class="slide-num">${i + 1}</div>
            <div class="slide-content-preview">
              <div class="slide-title-preview">${escHtml(s.title)}</div>
              <div class="slide-points-preview">${(s.content || []).slice(0,2).map(p => '• ' + p).join(' ')}</div>
            </div>
          </div>`).join('')}</div></div>`;
      } catch {}
    }
    
    container.innerHTML = `
      <h3 style="font-family:Syne,sans-serif;margin-bottom:16px">🎞 Slides</h3>
      <div id="slides-preview">${slidesPreview}</div>
      <div id="slides-loading" style="display:none" class="loading-pulse"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div><span>Criando slides detalhados...</span></div>
      <div class="ai-action-bar" style="margin-top:12px">
        <button class="btn btn-ghost" onclick="renderLessonStep(3)">← Conteúdo</button>
        <button class="btn btn-primary" onclick="aiSlides()">🤖 ${data.slides ? 'Regerar Slides' : 'Criar Slides com IA'}</button>
        ${data.slides ? '<button class="btn btn-success" onclick="renderLessonStep(5)">Próximo: Anotações →</button>' : ''}
      </div>`;
  } else if (step === 5) {
    container.innerHTML = `
      <h3 style="font-family:Syne,sans-serif;margin-bottom:16px">🗒 Anotações do Professor</h3>
      <div id="notes-preview" class="ai-content-area" style="display:${data.notes ? 'block' : 'none'}">${markdownToHtml(data.notes || '')}</div>
      <div id="notes-loading" style="display:none" class="loading-pulse"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div><span>Gerando anotações...</span></div>
      <div class="ai-action-bar" style="margin-top:12px">
        <button class="btn btn-ghost" onclick="renderLessonStep(4)">← Slides</button>
        <button class="btn btn-secondary" onclick="aiNotes('summary')">📝 Resumido</button>
        <button class="btn btn-primary" onclick="aiNotes('moderate')">🤖 ${data.notes ? 'Regerar' : 'Gerar Anotações'}</button>
        <button class="btn btn-secondary" onclick="aiNotes('detailed')">📚 Detalhado</button>
        ${data.notes ? '<button class="btn btn-success" onclick="saveLesson()">💾 Salvar Aula Completa</button>' : ''}
      </div>`;
  }
  
  if (step === 6 || data.status === 'saved') {
    container.innerHTML = `
      <div style="text-align:center;padding:40px">
        <div style="font-size:48px;margin-bottom:16px">✅</div>
        <h3 style="font-family:Syne,sans-serif;font-size:20px;margin-bottom:8px">Aula Salva!</h3>
        <p style="color:var(--text2);margin-bottom:24px">Sua aula está completa e pronta para uso.</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-primary btn-lg" onclick="viewFullContent()">📖 Ver Conteúdo Completo</button>
          <button class="btn btn-secondary btn-lg" onclick="startPresentation()">📡 Apresentar Aula</button>
        </div>
      </div>`;
  }
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
      `Faça uma pesquisa completa e detalhada sobre o tema: "${currentLessonData.title}". 
      
      Inclua:
      - Conceitos fundamentais e definições
      - Contextualização histórica e importância
      - Tópicos principais com explicações aprofundadas
      - Exemplos práticos e aplicações
      - Curiosidades relevantes
      - Conexões com outros temas
      
      Seja didático, detalhado e use linguagem adequada para professores. Formate bem com títulos e subtítulos.`,
      'Você é um especialista em educação e pesquisa acadêmica. Crie conteúdo rico, detalhado e bem estruturado em português.'
    );
    
    currentLessonData.research = result;
    await saveLessonData();
    content.innerHTML = markdownToHtml(result);
    content.style.display = 'block';
    renderLessonStep(2);
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
      `Com base na pesquisa abaixo sobre "${currentLessonData.title}", crie uma estrutura pedagógica detalhada para uma aula completa.
      
      Pesquisa: ${currentLessonData.research}
      
      Crie uma estrutura com:
      - Objetivos de aprendizagem (ao menos 5)
      - Divisão temporal da aula (por ex: 10 min introdução, 30 min desenvolvimento, etc.)
      - Tópicos principais com subtópicos
      - Atividades sugeridas
      - Como avaliar a aprendizagem`
    );
    
    currentLessonData.structure = result;
    await saveLessonData();
    content.innerHTML = markdownToHtml(result);
    content.style.display = 'block';
    renderLessonStep(3);
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
      `Crie slides COMPLETOS e DETALHADOS para uma aula sobre "${currentLessonData.title}".
      
      Baseado no conteúdo: ${(currentLessonData.research || '').substring(0, 3000)}
      
      Retorne APENAS um JSON válido (sem markdown, sem explicações) com este formato exato:
      {
        "slides": [
          {
            "type": "intro",
            "title": "Título do slide",
            "subtitle": "Subtítulo opcional",
            "points": ["ponto 1 com explicação completa em 1-2 frases", "ponto 2 com contexto", ...],
            "subpoints": { "ponto 1": ["detalhe a", "detalhe b"], ... },
            "note": "Nota pedagógica para o professor sobre este slide"
          }
        ]
      }
      
      REGRAS IMPORTANTES:
      - Crie de 10 a 14 slides
      - Tipos possíveis: intro, content, example, activity, summary, conclusion
      - Cada slide deve ter de 4 a 7 points bem elaborados
      - Os points devem ser frases completas e informativas (não apenas palavras soltas)
      - Adicione subpoints para aprofundar conceitos quando necessário
      - Inclua slides de exemplo prático e atividade
      - O último slide deve ser resumo/conclusão
      - Linguagem clara e educativa em português`,
      'Você é especialista em design instrucional. Retorne APENAS JSON válido sem nenhum texto extra.'
    );
    
    currentLessonData.slides = JSON.stringify(result);
    presentationSlides = result.slides || [];
    await saveLessonData();
    renderLessonStep(4);
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
  loading.style.display = 'flex';
  preview.style.display = 'none';
  
  try {
    const detailMap = {
      summary: 'resumidas (pontos-chave em bullet points)',
      moderate: 'moderadas (explicações práticas para cada tópico)',
      detailed: 'detalhadas (guia completo com dicas, exemplos e explicações aprofundadas)'
    };
    
    let slides = [];
    if (currentLessonData.slides) {
      try { slides = JSON.parse(currentLessonData.slides).slides || []; } catch {}
    }
    
    const result = await claudeAI(
      `Crie anotações de professor ${detailMap[detail] || 'moderadas'} para a aula sobre "${currentLessonData.title}".
      
      Slides da aula: ${JSON.stringify(slides.slice(0, 8))}
      
      Inclua para cada slide principal:
      - O que falar / explicar
      - Dicas pedagógicas
      - Exemplos para usar em sala
      - Possíveis dúvidas dos alunos e como responder
      - Tempo sugerido`
    );
    
    currentLessonData.notes = result;
    await saveLessonData();
    preview.innerHTML = markdownToHtml(result);
    preview.style.display = 'block';
    renderLessonStep(5);
    toast('Anotações geradas!', 'success');
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  } finally {
    loading.style.display = 'none';
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
  if (currentLessonData.slides && currentLessonData.slides.length > 0) {
    try {
      const parsed = JSON.parse(currentLessonData.slides);
      presentationSlides = parsed.slides || [];
    } catch {}
  }
  
  if (!presentationSlides || presentationSlides.length === 0) return toast('Crie os slides primeiro', 'error');
  
  presentationNotes = currentLessonData.notes || '';
  currentSlide = 0;
  
  document.getElementById('presentation-mode').classList.add('active');
  document.body.style.overflow = 'hidden';
  renderSlide();
}

function renderSlide() {
  const slide = presentationSlides[currentSlide];
  if (!slide) return;
  
  const typeColors = {
    intro: { bg: 'rgba(99,102,241,0.12)', border: 'var(--accent)', text: 'var(--accent2)', label: 'Introdução' },
    content: { bg: 'rgba(16,185,129,0.06)', border: 'var(--border)', text: 'var(--green)', label: 'Conteúdo' },
    example: { bg: 'rgba(245,158,11,0.06)', border: 'var(--border)', text: 'var(--yellow)', label: 'Exemplo' },
    activity: { bg: 'rgba(6,182,212,0.06)', border: 'var(--border)', text: 'var(--cyan)', label: 'Atividade' },
    summary: { bg: 'rgba(168,85,247,0.06)', border: 'var(--border)', text: 'var(--purple)', label: 'Resumo' },
    conclusion: { bg: 'rgba(168,85,247,0.08)', border: 'var(--border)', text: 'var(--purple)', label: 'Conclusão' },
  };
  
  const style = typeColors[slide.type] || typeColors.content;
  const total = presentationSlides.length;
  
  document.getElementById('slide-display').innerHTML = `
    <div class="slide-display-num">${currentSlide + 1} / ${total}</div>
    <div class="slide-display-type-badge" style="background:${style.bg};color:${style.text};border:1px solid ${style.border}">${style.label}</div>
    ${slide.subtitle ? `<p style="color:var(--text2);font-size:16px;margin-bottom:8px">${escHtml(slide.subtitle)}</p>` : ''}
    <div class="slide-display-title">${escHtml(slide.title)}</div>
    <div class="slide-display-points">
      ${(slide.points || slide.content || []).map((p, i) => `
        <div class="slide-point" style="animation-delay:${i * 0.08}s">
          <div class="slide-point-bullet"></div>
          <span>${escHtml(p)}</span>
        </div>
      `).join('')}
    </div>
    ${slide.note ? `<div style="margin-top:16px;padding:10px 14px;background:rgba(245,158,11,0.08);border-left:3px solid var(--yellow);border-radius:0 8px 8px 0;font-size:13px;color:var(--yellow)">💡 ${escHtml(slide.note)}</div>` : ''}
  `;
  
  document.getElementById('slide-counter').textContent = `${currentSlide + 1} / ${total}`;
  document.getElementById('progress-bar').style.width = `${((currentSlide + 1) / total) * 100}%`;
  
  const notesLines = presentationNotes.split('\n');
  const slideNotes = notesLines.slice(currentSlide * 3, currentSlide * 3 + 10).join('\n') || `Anotações para: ${slide.title}`;
  document.getElementById('notes-content').textContent = slideNotes;
}

function nextSlide() { if (currentSlide < presentationSlides.length - 1) { currentSlide++; renderSlide(); } }
function prevSlide() { if (currentSlide > 0) { currentSlide--; renderSlide(); } }
function toggleNotes() { document.getElementById('notes-panel').classList.toggle('visible'); }
function exitPresentation() { document.getElementById('presentation-mode').classList.remove('active'); document.body.style.overflow = ''; }

document.addEventListener('keydown', (e) => {
  if (!document.getElementById('presentation-mode').classList.contains('active')) return;
  if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
  if (e.key === 'ArrowLeft') prevSlide();
  if (e.key === 'Escape') exitPresentation();
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
