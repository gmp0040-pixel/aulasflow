// ========================
// CONFIG & STATE
// ========================
const API = window.location.origin + '/api';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');
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

// ========================
// INIT
// ========================
window.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js');
  }
  if (token && currentUser) {
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
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  if (!email || !password) return toast('Preencha todos os campos', 'error');
  
  try {
    const res = await api('POST', '/auth/login', { email, password });
    token = res.token;
    currentUser = res.user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));
    showApp();
  } catch (err) {
    toast(err.message || 'Erro ao entrar', 'error');
  }
}

async function register() {
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  if (!name || !email || !password) return toast('Preencha todos os campos', 'error');
  
  try {
    const res = await api('POST', '/auth/register', { name, email, password });
    token = res.token;
    currentUser = res.user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));
    showApp();
  } catch (err) {
    toast(err.message || 'Erro ao cadastrar', 'error');
  }
}

function logout() {
  if (!confirm('Deseja sair?')) return;
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
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
// API HELPER
// ========================
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na requisição');
  return data;
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
// SIDEBAR (mobile)
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
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ========================
// DASHBOARD
// ========================
async function loadDashboard() {
  try {
    const [subjects, students, events] = await Promise.all([
      api('GET', '/subjects'),
      api('GET', '/students'),
      api('GET', '/calendar'),
    ]);
    
    const totalLessons = 0; // would need another endpoint
    
    document.getElementById('dashboard-stats').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon blue">📚</div>
        <div>
          <div class="stat-value">${subjects.length}</div>
          <div class="stat-label">Matérias</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">👨‍🎓</div>
        <div>
          <div class="stat-value">${students.length}</div>
          <div class="stat-label">Alunos</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">📅</div>
        <div>
          <div class="stat-value">${events.length}</div>
          <div class="stat-label">Eventos</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">🤖</div>
        <div>
          <div class="stat-value">IA</div>
          <div class="stat-label">Integrada</div>
        </div>
      </div>
    `;
    
    const subjectsEl = document.getElementById('dashboard-subjects');
    if (subjects.length === 0) {
      subjectsEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📚</div><div class="empty-state-title">Nenhuma matéria</div><button class="btn btn-sm btn-primary" onclick="showPage(\'subjects\')" style="margin-top:12px">+ Criar Matéria</button></div>';
    } else {
      subjectsEl.innerHTML = subjects.slice(0, 4).map(s => `
        <div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="openSubject(${s.id}, '${escHtml(s.name)}')">
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
  } catch (err) {
    console.error(err);
  }
}

// ========================
// SUBJECTS
// ========================
async function loadSubjects() {
  try {
    const subjects = await api('GET', '/subjects');
    const grid = document.getElementById('subjects-grid');
    
    if (subjects.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">📚</div>
          <div class="empty-state-title">Nenhuma matéria criada</div>
          <div class="empty-state-desc">Crie sua primeira matéria para começar</div>
          <button class="btn btn-primary" onclick="openModal('add-subject-modal')" style="margin-top:16px">+ Nova Matéria</button>
        </div>
      `;
      return;
    }
    
    const emojis = ['📐', '🔬', '📖', '🌎', '💻', '🎨', '🎵', '⚗️', '🏛️', '💡'];
    grid.innerHTML = subjects.map((s, i) => `
      <div class="subject-card" onclick="openSubject(${s.id}, '${escHtml(s.name)}')">
        <div class="subject-card-header" style="background: linear-gradient(135deg, ${s.color}33, ${s.color}11)">
          <div class="subject-card-emoji">${emojis[i % emojis.length]}</div>
          <div style="width:8px;height:8px;border-radius:50%;background:${s.color}"></div>
        </div>
        <div class="subject-card-body">
          <div class="subject-card-name">${escHtml(s.name)}</div>
          <div class="subject-card-desc">${escHtml(s.description || 'Sem descrição')}</div>
        </div>
        <div class="subject-card-actions" onclick="event.stopPropagation()">
          <button class="btn btn-sm btn-ghost" style="flex:1;background:rgba(99,102,241,0.1);color:var(--accent2)" onclick="openExamModal(${s.id})">🧪 Criar Prova</button>
          <button class="btn btn-sm btn-ghost" style="flex:1;background:rgba(168,85,247,0.1);color:var(--purple)" onclick="openAssignmentModal(${s.id})">📄 Criar Trabalho</button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteSubject(${s.id})">🗑</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    toast('Erro ao carregar matérias', 'error');
  }
}

async function createSubject() {
  const name = document.getElementById('subject-name').value.trim();
  if (!name) return toast('Nome obrigatório', 'error');
  const description = document.getElementById('subject-desc').value;
  const color = document.querySelector('.color-opt.selected')?.dataset.color || '#6366f1';
  
  try {
    await api('POST', '/subjects', { name, description, color });
    closeModal('add-subject-modal');
    document.getElementById('subject-name').value = '';
    document.getElementById('subject-desc').value = '';
    toast('Matéria criada!', 'success');
    loadSubjects();
    loadSubjectsForSelects();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteSubject(id) {
  if (!confirm('Excluir esta matéria? Todas as aulas serão removidas.')) return;
  try {
    await api('DELETE', '/subjects/' + id);
    toast('Matéria excluída', 'success');
    loadSubjects();
    loadSubjectsForSelects();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function selectColor(el) {
  document.querySelectorAll('.color-opt').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

async function loadSubjectsForSelects() {
  try {
    const subjects = await api('GET', '/subjects');
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
    <button class="btn btn-sm btn-ghost" style="background:rgba(99,102,241,0.1);color:var(--accent2)" onclick="openExamModal(${subjectId})">🧪 Criar Prova</button>
    <button class="btn btn-sm btn-ghost" style="background:rgba(168,85,247,0.1);color:var(--purple)" onclick="openAssignmentModal(${subjectId})">📄 Criar Trabalho</button>
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
    const lessons = await api('GET', `/subjects/${currentSubjectId}/lessons`);
    
    if (lessons.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📖</div>
          <div class="empty-state-title">Nenhuma aula criada</div>
          <div class="empty-state-desc">Crie sua primeira aula com IA</div>
          <button class="btn btn-primary" onclick="openModal('add-lesson-modal')" style="margin-top:16px">+ Nova Aula</button>
        </div>
      `;
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
            <div class="lesson-actions">
              <button class="btn btn-sm btn-primary" onclick="openLesson(${l.id}, '${escHtml(l.title)}', ${JSON.stringify(l).replace(/"/g, '&quot;')})">
                ${l.status === 'saved' ? '📂 Abrir' : '✏️ Editar'}
              </button>
              <button class="btn btn-sm btn-danger btn-icon" onclick="deleteLesson(${l.id})">🗑</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = '<p class="text-muted">Erro ao carregar aulas</p>';
  }
}

async function loadExamsTab(container) {
  try {
    const exams = await api('GET', `/subjects/${currentSubjectId}/exams`);
    
    if (exams.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🧪</div><div class="empty-state-title">Nenhuma prova salva</div><button class="btn btn-primary" onclick="openExamModal(${currentSubjectId})" style="margin-top:12px">Gerar Prova com IA</button></div>`;
      return;
    }
    
    container.innerHTML = `
      <div class="lesson-list">
        ${exams.map(e => `
          <div class="lesson-item" onclick="viewSavedExam(${e.id})">
            <span style="font-size:20px">🧪</span>
            <div class="lesson-title">${escHtml(e.title)}</div>
            <span class="badge badge-accent">${e.question_count} questões</span>
            <span class="badge badge-purple">${e.difficulty}</span>
            <div class="lesson-meta">${formatDate(e.created_at)}</div>
            <div class="lesson-actions">
              <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();exportSavedExamPDF(${e.id})">📄 PDF</button>
              <button class="btn btn-sm btn-danger btn-icon" onclick="event.stopPropagation();deleteExam(${e.id})">🗑</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch {}
}

async function loadAssignmentsTab(container) {
  try {
    const assignments = await api('GET', `/subjects/${currentSubjectId}/assignments`);
    
    if (assignments.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📄</div><div class="empty-state-title">Nenhum trabalho salvo</div><button class="btn btn-primary" onclick="openAssignmentModal(${currentSubjectId})" style="margin-top:12px">Gerar Trabalho com IA</button></div>`;
      return;
    }
    
    const typeEmoji = { pesquisa: '🔍', texto: '✍️', 'apresentação': '📊', estudo: '📚', prático: '🔧' };
    container.innerHTML = `
      <div class="lesson-list">
        ${assignments.map(a => `
          <div class="lesson-item">
            <span style="font-size:20px">${typeEmoji[a.type] || '📄'}</span>
            <div class="lesson-title">${escHtml(a.title)}</div>
            <span class="badge badge-purple">${a.type}</span>
            <div class="lesson-meta">${formatDate(a.created_at)}</div>
            <div class="lesson-actions">
              <button class="btn btn-sm btn-danger btn-icon" onclick="deleteAssignment(${a.id})">🗑</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch {}
}

async function loadAttendanceTab(container) {
  try {
    const [lessons, students] = await Promise.all([
      api('GET', `/subjects/${currentSubjectId}/lessons`),
      api('GET', `/subjects/${currentSubjectId}/students`)
    ]);
    
    if (lessons.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Crie aulas primeiro</div></div>';
      return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    container.innerHTML = `
      <div style="margin-bottom:16px;display:flex;gap:12px;align-items:center">
        <label class="form-label mb-0">Selecionar Aula:</label>
        <select class="form-select" style="width:auto" id="attendance-lesson-select" onchange="loadAttendanceForLesson()">
          ${lessons.map(l => `<option value="${l.id}">${escHtml(l.title)}</option>`).join('')}
        </select>
        <input type="date" id="attendance-date" class="form-input" style="width:auto" value="${today}">
      </div>
      <div id="attendance-table"></div>
    `;
    
    await loadAttendanceForLesson();
  } catch (err) {
    container.innerHTML = '<p class="text-muted">Erro ao carregar</p>';
  }
}

async function loadAttendanceForLesson() {
  const lessonId = document.getElementById('attendance-lesson-select')?.value;
  if (!lessonId) return;
  
  try {
    const [students, existingAttendance] = await Promise.all([
      api('GET', `/subjects/${currentSubjectId}/students`),
      api('GET', `/lessons/${lessonId}/attendance`)
    ]);
    
    const attMap = {};
    existingAttendance.forEach(a => { attMap[a.student_id] = a.status; });
    
    if (students.length === 0) {
      document.getElementById('attendance-table').innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-title">Nenhum aluno nesta matéria</div><button class="btn btn-sm btn-primary" onclick="switchSubjectTab('subject-students')">Adicionar Alunos</button></div>`;
      return;
    }
    
    document.getElementById('attendance-table').innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Aluno</th><th>Status</th></tr></thead>
          <tbody>
            ${students.map(s => `
              <tr>
                <td>${escHtml(s.name)}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="attendance-btn ${attMap[s.id] === 'present' ? 'present' : ''}" onclick="setAttendance(${lessonId}, ${s.id}, 'present', this)">✓ Presente</button>
                    <button class="attendance-btn ${attMap[s.id] === 'absent' ? 'absent' : ''}" onclick="setAttendance(${lessonId}, ${s.id}, 'absent', this)">✗ Falta</button>
                    <button class="attendance-btn ${attMap[s.id] === 'justified' ? 'justified' : ''}" onclick="setAttendance(${lessonId}, ${s.id}, 'justified', this)">J Justificado</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch {}
}

async function setAttendance(lessonId, studentId, status, btn) {
  const date = document.getElementById('attendance-date')?.value || new Date().toISOString().split('T')[0];
  try {
    await api('POST', `/lessons/${lessonId}/attendance`, { student_id: studentId, status, date });
    // Update buttons in row
    const row = btn.closest('tr');
    row.querySelectorAll('.attendance-btn').forEach(b => {
      b.classList.remove('present', 'absent', 'justified');
    });
    btn.classList.add(status);
  } catch {}
}

async function loadSubjectGradesTab(container) {
  try {
    const students = await api('GET', `/subjects/${currentSubjectId}/students`);
    
    container.innerHTML = `
      <div style="margin-bottom:16px">
        <button class="btn btn-sm btn-primary" onclick="openGradeModal()">+ Lançar Nota</button>
      </div>
      <div id="subject-grades-table"></div>
    `;
    
    await loadSubjectGradesTable();
  } catch {}
}

async function loadSubjectGradesTable() {
  try {
    const grades = await api('GET', `/subjects/${currentSubjectId}/grades`);
    const el = document.getElementById('subject-grades-table');
    if (!el) return;
    
    if (grades.length === 0) {
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
                <td>${escHtml(g.student_name)}</td>
                <td>${escHtml(g.activity)}</td>
                <td><strong>${g.grade}</strong></td>
                <td>${g.max_grade}</td>
                <td><span class="badge ${(g.grade/g.max_grade) >= 0.6 ? 'badge-green' : 'badge-red'}">${Math.round(g.grade/g.max_grade*100)}%</span></td>
                <td>${formatDate(g.date)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch {}
}

async function loadSubjectStudentsTab(container) {
  try {
    const [allStudents, subjectStudents] = await Promise.all([
      api('GET', '/students'),
      api('GET', `/subjects/${currentSubjectId}/students`)
    ]);
    
    const enrolledIds = new Set(subjectStudents.map(s => s.id));
    
    container.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><span class="card-title">Alunos Matriculados (${subjectStudents.length})</span></div>
        <div class="card-body" style="padding:0">
          <div class="table-wrapper">
            <table>
              <thead><tr><th>Nome</th><th>E-mail</th><th>Matrícula</th></tr></thead>
              <tbody>
                ${subjectStudents.length ? subjectStudents.map(s => `
                  <tr><td>${escHtml(s.name)}</td><td>${escHtml(s.email || '-')}</td><td>${escHtml(s.registration || '-')}</td></tr>
                `).join('') : '<tr><td colspan="3" style="text-align:center;color:var(--text3)">Nenhum aluno matriculado</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header"><span class="card-title">Adicionar Aluno</span></div>
        <div class="card-body">
          <div style="display:flex;gap:8px">
            <select class="form-select" id="enroll-student-select">
              ${allStudents.filter(s => !enrolledIds.has(s.id)).map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('')}
            </select>
            <button class="btn btn-primary" onclick="enrollStudent()">Adicionar</button>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = '<p>Erro ao carregar alunos</p>';
  }
}

async function enrollStudent() {
  const studentId = document.getElementById('enroll-student-select')?.value;
  if (!studentId) return;
  try {
    await api('POST', `/subjects/${currentSubjectId}/students`, { student_id: studentId });
    toast('Aluno adicionado!', 'success');
    loadSubjectStudentsTab(document.getElementById('subject-tab-content'));
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ========================
// LESSONS
// ========================
async function createLesson() {
  const title = document.getElementById('lesson-title').value.trim();
  if (!title) return toast('Título obrigatório', 'error');
  
  try {
    const lesson = await api('POST', `/subjects/${currentSubjectId}/lessons`, { title });
    closeModal('add-lesson-modal');
    document.getElementById('lesson-title').value = '';
    toast('Aula criada!', 'success');
    openLesson(lesson.id, lesson.title, lesson);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteLesson(id) {
  if (!confirm('Excluir esta aula?')) return;
  try {
    await api('DELETE', '/lessons/' + id);
    toast('Aula excluída', 'success');
    loadLessonsTab(document.getElementById('subject-tab-content'));
  } catch {}
}

function openLesson(id, title, lessonData) {
  currentLessonId = id;
  currentLessonData = typeof lessonData === 'string' ? JSON.parse(lessonData) : lessonData;
  showPage('lesson-editor', title);
  renderLessonEditor();
}

function renderLessonEditor() {
  const data = currentLessonData;
  const isSaved = data.status === 'saved';
  
  // Determine current step
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
    
    <div class="ai-steps">${stepsHtml}</div><button class="btn-study" onclick="openStudyScreen(currentLessonId, currentLessonData.title || '')">🎓 Modo Estudo</button>
    
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
      <div id="research-loading" style="display:none" class="loading-pulse"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div><span>Pesquisando...</span></div>
      <div class="ai-action-bar" style="margin-top:12px">
        <button class="btn btn-primary" id="research-btn" onclick="aiResearch()">🤖 Pesquisar com IA</button>
        ${data.research ? '<button class="btn btn-success" onclick="renderLessonStep(2)">Próximo: Estruturar →</button>' : ''}
      </div>
    `;
  } else if (step === 2) {
    container.innerHTML = `
      <h3 style="font-family:Syne,sans-serif;margin-bottom:16px">📋 Estrutura da Aula</h3>
      <div id="structure-content" class="ai-content-area" style="display:${data.structure ? 'block' : 'none'}">${markdownToHtml(data.structure || '')}</div>
      <div id="structure-loading" style="display:none" class="loading-pulse"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div><span>Estruturando...</span></div>
      <div class="ai-action-bar" style="margin-top:12px">
        <button class="btn btn-ghost" onclick="renderLessonStep(1)">← Pesquisa</button>
        <button class="btn btn-primary" onclick="aiStructure()">🤖 ${data.structure ? 'Reestruturar' : 'Estruturar com IA'}</button>
        ${data.structure ? '<button class="btn btn-success" onclick="renderLessonStep(3)">Próximo: Conteúdo →</button>' : ''}
      </div>
    `;
  } else if (step === 3) {
    container.innerHTML = `
      <h3 style="font-family:Syne,sans-serif;margin-bottom:16px">📝 Ajustar Conteúdo</h3>
      <textarea id="content-editor" class="form-textarea" style="min-height:300px;font-size:13px">${data.research || ''}</textarea>
      <div class="ai-action-bar" style="margin-top:12px">
        <button class="btn btn-ghost" onclick="renderLessonStep(2)">← Estrutura</button>
        <button class="btn btn-secondary" onclick="adjustContent('expand')">+ Expandir</button>
        <button class="btn btn-secondary" onclick="adjustContent('reduce')">- Reduzir</button>
        <button class="btn btn-success" onclick="saveContentEdits()">Salvar e Continuar →</button>
      </div>
    `;
  } else if (step === 4) {
    let slidesPreview = '';
    if (data.slides) {
      try {
        const slides = JSON.parse(data.slides);
        slidesPreview = `
          <div style="margin-bottom:12px">
            <div class="slides-list">
              ${slides.slides?.map((s, i) => `
                <div class="slide-preview">
                  <div class="slide-num">${i + 1}</div>
                  <div class="slide-content-preview">
                    <div class="slide-title-preview">${escHtml(s.title)}</div>
                    <div class="slide-points-preview">${s.content?.slice(0,2).map(p => '• ' + p).join(' ')}</div>
                  </div>
                </div>
              `).join('') || ''}
            </div>
          </div>
        `;
      } catch {}
    }
    
    container.innerHTML = `
      <h3 style="font-family:Syne,sans-serif;margin-bottom:16px">🎞 Slides</h3>
      <div id="slides-preview">${slidesPreview}</div>
      <div id="slides-loading" style="display:none" class="loading-pulse"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div><span>Criando slides...</span></div>
      <div class="ai-action-bar" style="margin-top:12px">
        <button class="btn btn-ghost" onclick="renderLessonStep(3)">← Conteúdo</button>
        <button class="btn btn-primary" onclick="aiSlides()">🤖 ${data.slides ? 'Regerar Slides' : 'Criar Slides com IA'}</button>
        ${data.slides ? '<button class="btn btn-success" onclick="renderLessonStep(5)">Próximo: Anotações →</button>' : ''}
      </div>
    `;
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
      </div>
    `;
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
      </div>
    `;
  }
}

async function aiResearch() {
  const btn = document.getElementById('research-btn');
  const loading = document.getElementById('research-loading');
  const content = document.getElementById('research-content');
  
  btn.disabled = true;
  loading.style.display = 'flex';
  content.style.display = 'none';
  
  try {
    const subject = await getSubjectName();
    const res = await api('POST', '/ai/research', { topic: currentLessonData.title, subject });
    currentLessonData.research = res.content;
    await api('PUT', '/lessons/' + currentLessonId, { ...currentLessonData });
    content.innerHTML = markdownToHtml(res.content);
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
    const res = await api('POST', '/ai/structure', { topic: currentLessonData.title, research: currentLessonData.research });
    currentLessonData.structure = res.content;
    await api('PUT', '/lessons/' + currentLessonId, { ...currentLessonData });
    content.innerHTML = markdownToHtml(res.content);
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
    const res = await api('POST', '/ai/slides', { topic: currentLessonData.title, structure: currentLessonData.structure, research: currentLessonData.research });
    currentLessonData.slides = JSON.stringify(res);
    await api('PUT', '/lessons/' + currentLessonId, { ...currentLessonData });
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
    let slides = [];
    if (currentLessonData.slides) {
      try { slides = JSON.parse(currentLessonData.slides).slides || []; } catch {}
    }
    const res = await api('POST', '/ai/notes', { topic: currentLessonData.title, slides, detail });
    currentLessonData.notes = res.content;
    await api('PUT', '/lessons/' + currentLessonId, { ...currentLessonData });
    preview.innerHTML = markdownToHtml(res.content);
    preview.style.display = 'block';
    renderLessonStep(5);
    toast('Anotações geradas!', 'success');
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  } finally {
    loading.style.display = 'none';
  }
}

function saveContentEdits() {
  const edited = document.getElementById('content-editor')?.value;
  if (edited) currentLessonData.research = edited;
  renderLessonStep(4);
}

async function saveLesson() {
  try {
    currentLessonData.status = 'saved';
    await api('PUT', '/lessons/' + currentLessonId, { ...currentLessonData });
    toast('Aula salva com sucesso!', 'success');
    renderLessonEditor();
  } catch (err) {
    toast('Erro ao salvar: ' + err.message, 'error');
  }
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
  if (!currentLessonData.slides) return toast('Crie os slides primeiro', 'error');
  
  try {
    const parsed = JSON.parse(currentLessonData.slides);
    presentationSlides = parsed.slides || [];
    presentationNotes = currentLessonData.notes || '';
    currentSlide = 0;
    
    document.getElementById('presentation-mode').classList.add('active');
    document.body.style.overflow = 'hidden';
    renderSlide();
  } catch (err) {
    toast('Erro ao iniciar apresentação', 'error');
  }
}

function renderSlide() {
  const slide = presentationSlides[currentSlide];
  if (!slide) return;
  
  const typeColors = {
    intro: { bg: 'rgba(99,102,241,0.1)', border: 'var(--accent)', text: 'var(--accent2)', label: 'Introdução' },
    content: { bg: 'rgba(16,185,129,0.05)', border: 'var(--border)', text: 'var(--green)', label: 'Conteúdo' },
    example: { bg: 'rgba(245,158,11,0.05)', border: 'var(--border)', text: 'var(--yellow)', label: 'Exemplo' },
    conclusion: { bg: 'rgba(168,85,247,0.05)', border: 'var(--border)', text: 'var(--purple)', label: 'Conclusão' },
  };
  
  const style = typeColors[slide.type] || typeColors.content;
  const total = presentationSlides.length;
  
  document.getElementById('slide-display').innerHTML = `
    <div class="slide-display-num">${currentSlide + 1} / ${total}</div>
    <div class="slide-display-type-badge" style="background:${style.bg};color:${style.text};border:1px solid ${style.border}">${style.label}</div>
    <div class="slide-display-title">${escHtml(slide.title)}</div>
    <div class="slide-display-points">
      ${(slide.content || []).map((p, i) => `
        <div class="slide-point" style="animation-delay:${i * 0.1}s">
          <div class="slide-point-bullet"></div>
          <span>${escHtml(p)}</span>
        </div>
      `).join('')}
    </div>
  `;
  
  document.getElementById('slide-counter').textContent = `${currentSlide + 1} / ${total}`;
  document.getElementById('progress-bar').style.width = `${((currentSlide + 1) / total) * 100}%`;
  
  // Notes
  const notesLines = presentationNotes.split('\n');
  const slideNotes = notesLines.slice(currentSlide * 3, currentSlide * 3 + 10).join('\n') || `Anotações para: ${slide.title}`;
  document.getElementById('notes-content').textContent = slideNotes;
}

function nextSlide() {
  if (currentSlide < presentationSlides.length - 1) {
    currentSlide++;
    renderSlide();
  }
}

function prevSlide() {
  if (currentSlide > 0) {
    currentSlide--;
    renderSlide();
  }
}

function toggleNotes() {
  const panel = document.getElementById('notes-panel');
  panel.classList.toggle('visible');
}

function exitPresentation() {
  document.getElementById('presentation-mode').classList.remove('active');
  document.body.style.overflow = '';
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('presentation-mode').classList.contains('active')) return;
  if (e.key === 'ArrowRight' || e.key === 'Space') nextSlide();
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
    const exam = await api('POST', '/ai/exam', { subjectId: currentSubjectId, count: parseInt(count), type, difficulty });
    currentExamData = exam;
    
    preview.innerHTML = `
      <h3 style="font-family:Syne,sans-serif;margin-bottom:16px">${escHtml(exam.title || 'Prova Gerada')}</h3>
      ${(exam.questions || []).map(q => `
        <div class="exam-question">
          <div class="exam-question-num">Questão ${q.number}</div>
          <div class="exam-question-text">${escHtml(q.question)}</div>
          ${q.options ? `
            <div class="exam-options">
              ${q.options.map(opt => `
                <div class="exam-option ${q.answer && opt.startsWith(q.answer) ? 'correct' : ''}">${escHtml(opt)}</div>
              `).join('')}
            </div>
          ` : ''}
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
    await api('POST', `/subjects/${currentSubjectId}/exams`, {
      title: currentExamData.title || 'Prova',
      content: JSON.stringify(currentExamData),
      difficulty,
      question_type: type,
      question_count: parseInt(count)
    });
    closeModal('exam-modal');
    toast('Prova salva!', 'success');
    if (document.getElementById('page-subject-detail').classList.contains('active')) {
      switchSubjectTab('exams');
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteExam(id) {
  if (!confirm('Excluir esta prova?')) return;
  try {
    await api('DELETE', '/exams/' + id);
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
    const exams = await api('GET', `/subjects/${currentSubjectId}/exams`);
    const exam = exams.find(e => e.id === examId);
    if (!exam) return;
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
    `).join('')}
  `;
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
    const result = await api('POST', '/ai/assignment', { subjectId: currentSubjectId });
    currentAssignmentData = result.assignments || [];
    
    const typeEmoji = { pesquisa: '🔍', texto: '✍️', 'apresentação': '📊', estudo: '📚', prático: '🔧' };
    
    preview.innerHTML = `
      <p style="font-size:13px;color:var(--text2);margin-bottom:12px">Clique em um trabalho para selecioná-lo:</p>
      ${currentAssignmentData.map((a, i) => `
        <div class="exam-question assignment-option" style="cursor:pointer;transition:all .2s;border:1px solid var(--border)" onclick="selectAssignment(${i}, this)">
          <div class="exam-question-num" style="color:var(--purple)">${typeEmoji[a.type] || '📄'} ${a.type?.toUpperCase()}</div>
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
    await api('POST', `/subjects/${currentSubjectId}/assignments`, {
      title: a.title,
      content: JSON.stringify(a),
      type: a.type
    });
    closeModal('assignment-modal');
    toast('Trabalho salvo!', 'success');
    if (document.getElementById('page-subject-detail').classList.contains('active')) {
      switchSubjectTab('assignments');
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteAssignment(id) {
  if (!confirm('Excluir?')) return;
  try {
    await api('DELETE', '/assignments/' + id);
    toast('Trabalho excluído', 'success');
    switchSubjectTab('assignments');
  } catch {}
}

// ========================
// STUDENTS
// ========================
async function loadStudents() {
  try {
    const students = await api('GET', '/students');
    const el = document.getElementById('students-table');
    
    if (students.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👨‍🎓</div><div class="empty-state-title">Nenhum aluno cadastrado</div><button class="btn btn-primary" onclick="openModal(\'add-student-modal\')" style="margin-top:12px">+ Novo Aluno</button></div>';
      return;
    }
    
    el.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Matrícula</th><th>Ações</th></tr></thead>
          <tbody>
            ${students.map(s => `
              <tr>
                <td><strong>${escHtml(s.name)}</strong></td>
                <td>${escHtml(s.email || '-')}</td>
                <td>${escHtml(s.registration || '-')}</td>
                <td><button class="btn btn-sm btn-danger btn-icon" onclick="deleteStudent(${s.id})">🗑</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    toast('Erro ao carregar alunos', 'error');
  }
}

async function createStudent() {
  const name = document.getElementById('student-name').value.trim();
  if (!name) return toast('Nome obrigatório', 'error');
  const email = document.getElementById('student-email').value;
  const registration = document.getElementById('student-registration').value;
  
  try {
    await api('POST', '/students', { name, email, registration });
    closeModal('add-student-modal');
    ['student-name', 'student-email', 'student-registration'].forEach(id => { document.getElementById(id).value = ''; });
    toast('Aluno cadastrado!', 'success');
    loadStudents();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteStudent(id) {
  if (!confirm('Excluir este aluno?')) return;
  try {
    await api('DELETE', '/students/' + id);
    toast('Aluno excluído', 'success');
    loadStudents();
  } catch {}
}

// ========================
// GRADES
// ========================
function loadGradesSelect() {
  loadSubjectsForSelects();
}

async function loadGradesPage() {
  const subjectId = document.getElementById('grades-subject-select').value;
  if (!subjectId) return;
  currentSubjectId = subjectId;
  
  const content = document.getElementById('grades-content');
  content.innerHTML = `
    <div style="margin-bottom:16px">
      <button class="btn btn-sm btn-primary" onclick="openGradeModal()">+ Lançar Nota</button>
    </div>
    <div id="grades-table-content"></div>
  `;
  
  await loadGradesTable();
}

async function loadGradesTable() {
  try {
    const grades = await api('GET', `/subjects/${currentSubjectId}/grades`);
    const el = document.getElementById('grades-table-content');
    if (!el) return;
    
    if (grades.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">Nenhuma nota lançada</div></div>';
      return;
    }
    
    el.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Aluno</th><th>Atividade</th><th>Nota</th><th>Máx</th><th>%</th><th>Data</th></tr></thead>
          <tbody>
            ${grades.map(g => `
              <tr>
                <td>${escHtml(g.student_name)}</td>
                <td>${escHtml(g.activity)}</td>
                <td><strong>${g.grade}</strong></td>
                <td>${g.max_grade}</td>
                <td><span class="badge ${(g.grade/g.max_grade) >= 0.6 ? 'badge-green' : 'badge-red'}">${Math.round(g.grade/g.max_grade*100)}%</span></td>
                <td>${formatDate(g.date)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch {}
}

async function openGradeModal() {
  try {
    const students = await api('GET', `/subjects/${currentSubjectId}/students`);
    document.getElementById('grade-student').innerHTML = students.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
    document.getElementById('grade-date').value = new Date().toISOString().split('T')[0];
    openModal('add-grade-modal');
  } catch {}
}

async function saveGrade() {
  const student_id = document.getElementById('grade-student').value;
  const activity = document.getElementById('grade-activity').value.trim();
  const grade = parseFloat(document.getElementById('grade-value').value);
  const max_grade = parseFloat(document.getElementById('grade-max').value) || 10;
  const date = document.getElementById('grade-date').value;
  
  if (!activity || isNaN(grade)) return toast('Preencha todos os campos', 'error');
  
  try {
    await api('POST', `/subjects/${currentSubjectId}/grades`, { student_id, activity, grade, max_grade, date });
    closeModal('add-grade-modal');
    toast('Nota lançada!', 'success');
    loadGradesTable();
    loadSubjectGradesTable();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ========================
// CALENDAR
// ========================
async function renderCalendar() {
  const events = await api('GET', '/calendar').catch(() => []);
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  
  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('calendar-title').textContent = `${monthNames[month]} ${year}`;
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toDateString();
  
  const eventDays = {};
  events.forEach(e => {
    const d = new Date(e.date + 'T00:00');
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!eventDays[key]) eventDays[key] = [];
    eventDays[key].push(e);
  });
  
  let html = `
    <div class="calendar-grid">
      ${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => `<div class="calendar-day-name">${d}</div>`).join('')}
  `;
  
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day other-month"></div>';
  }
  
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const isToday = date.toDateString() === today;
    const key = `${year}-${month}-${d}`;
    const dayEvents = eventDays[key] || [];
    
    html += `
      <div class="calendar-day ${isToday ? 'today' : ''} ${dayEvents.length ? 'has-event' : ''}">
        <span style="font-weight:${isToday ? '700' : '400'};color:${isToday ? 'var(--accent2)' : 'var(--text)'}">${d}</span>
        ${dayEvents.map(e => `<span style="font-size:9px;color:var(--accent2);width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(e.title)}</span>`).join('')}
      </div>
    `;
  }
  
  html += '</div>';
  document.getElementById('calendar-grid').innerHTML = html;
}

function changeMonth(dir) {
  calendarDate.setMonth(calendarDate.getMonth() + dir);
  renderCalendar();
}

async function createEvent() {
  const title = document.getElementById('event-title').value.trim();
  const date = document.getElementById('event-date').value;
  if (!title || !date) return toast('Título e data obrigatórios', 'error');
  
  const type = document.getElementById('event-type').value;
  const description = document.getElementById('event-desc').value;
  
  try {
    await api('POST', '/calendar', { title, date, type, description });
    closeModal('add-event-modal');
    toast('Evento criado!', 'success');
    renderCalendar();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ========================
// REPORTS
// ========================
function loadReportsSelect() {
  loadSubjectsForSelects();
}

async function loadReports() {
  const subjectId = document.getElementById('report-subject-select').value;
  if (!subjectId) return;
  currentSubjectId = subjectId;
  
  try {
    const [attendance, grades] = await Promise.all([
      api('GET', `/reports/attendance/${subjectId}`),
      api('GET', `/reports/grades/${subjectId}`)
    ]);
    
    const container = document.getElementById('reports-content');
    
    container.innerHTML = `
      <div class="card">
        <div class="card-header"><span class="card-title">✅ Frequência</span></div>
        <div class="card-body">
          ${attendance.length === 0 ? '<div class="empty-state"><div class="empty-state-title">Sem dados</div></div>' :
            attendance.map(a => {
              const pct = a.total > 0 ? Math.round((a.present / a.total) * 100) : 0;
              return `
                <div class="report-row">
                  <div class="report-name">${escHtml(a.name)}</div>
                  <div class="report-bar-container">
                    <div class="report-bar" style="width:${pct}%;background:${pct >= 75 ? 'var(--green)' : 'var(--red)'}"></div>
                  </div>
                  <div class="report-pct" style="color:${pct >= 75 ? 'var(--green)' : 'var(--red)'}">${pct}%</div>
                </div>
              `;
            }).join('')}
        </div>
      </div>
      
      <div class="card">
        <div class="card-header"><span class="card-title">📊 Desempenho</span></div>
        <div class="card-body">
          ${grades.length === 0 ? '<div class="empty-state"><div class="empty-state-title">Sem dados</div></div>' :
            grades.map(g => {
              const avg = g.average ? parseFloat(g.average).toFixed(1) : '-';
              const pct = g.average ? Math.round(g.average * 10) : 0;
              return `
                <div class="report-row">
                  <div class="report-name">${escHtml(g.name)}</div>
                  <div class="report-bar-container">
                    <div class="report-bar" style="width:${pct}%;background:${pct >= 60 ? 'var(--green)' : 'var(--red)'}"></div>
                  </div>
                  <div class="report-pct" style="color:${pct >= 60 ? 'var(--green)' : 'var(--red)'}">${avg}</div>
                </div>
              `;
            }).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    toast('Erro ao carregar relatórios', 'error');
  }
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
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>AulaFlow — ${name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
        h1 { color: #4f46e5; margin-bottom: 20px; }
        .exam-question { margin-bottom: 20px; padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
        .exam-question-num { font-size: 12px; font-weight: bold; color: #6366f1; margin-bottom: 8px; }
        .exam-question-text { font-weight: 600; margin-bottom: 8px; }
        .exam-option { margin: 4px 0 4px 16px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
        .report-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #eee; }
        .report-name { flex: 1; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div style="text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #6366f1">
        <h1>📚 AulaFlow</h1>
        <p style="color:#666">Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
      </div>
      ${content}
    </body>
    </html>
  `);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

// ========================
// HELPERS
// ========================
async function getSubjectName() {
  try {
    const subjects = await api('GET', '/subjects');
    return subjects.find(s => s.id === currentSubjectId)?.name || 'Matéria';
  } catch { return 'Matéria'; }
}

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
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return dateStr; }
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
