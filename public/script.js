# 

**URL:** https://raw.githubusercontent.com/gmp0040-pixel/aulasflow/main/public/script.js

---

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
      system: systemPrompt || 'Você é um professor e teólogo reformado de alto nível, especialista em criar conteúdo pedagógico excepcional em português brasileiro para formação ministerial em seminário teológico. Seu conteúdo é fundamentado exclusivamente nas Escrituras Sagradas. Cite teólogos reformados quando relevante: Calvino, Berkhof, Bavinck, Sproul, Kuyper, Hodge, Frame, Horton, Beeke. REGRAS: 1) NUNCA repita o mesmo sujeito em frases consecutivas; 2) Cada ponto traz informação NOVA e DISTINTA; 3) Varie perspectivas: bíblica, histórica, doutrinal, prática, pastoral; 4) Use referências bíblicas ESPECÍFICAS com capítulo e versículo; 5) Frases COMPLETAS e INFORMATIVAS — nunca palavras soltas.',
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
// DASHBOARD
// ========================
async function loadDashboard() {
  const sb = getSupabase();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [subjects, students, lessons, assignments] = await Promise.all([
    dbGet('subjects'),
    dbGet('students'),
    dbGet('lessons'),
    dbGet('assignments')
  ]);

  document.getElementById('stat-subjects').textContent = subjects.length;
  document.getElementById('stat-students').textContent = students.length;
  document.getElementById('stat-lessons').textContent = lessons.length;
  document.getElementById('stat-assignments').textContent = assignments.length;

  const upcomingEvents = lessons
    .filter(l => new Date(l.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5)
    .map(l => `<li><strong>${new Date(l.date).toLocaleDateString()}</strong>: ${l.title}</li>`)
    .join('');
  document.getElementById('upcoming-events').innerHTML = upcomingEvents || '<li>Nenhum evento futuro.</li>';

  const recentActivity = lessons
    .filter(l => new Date(l.created_at) > new Date(thirtyDaysAgo))
    .map(l => ({ type: 'aula', ...l }))
    .concat(assignments.filter(a => new Date(a.created_at) > new Date(thirtyDaysAgo)).map(a => ({ type: 'tarefa', ...a })))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)
    .map(item => {
      const action = item.type === 'aula' ? 'criou a aula' : 'criou a tarefa';
      return `<li><strong>${currentUser.name}</strong> ${action} "${item.title}" em ${new Date(item.created_at).toLocaleDateString()}.</li>`;
    })
    .join('');
  document.getElementById('recent-activity').innerHTML = recentActivity || '<li>Nenhuma atividade recente.</li>';
}

// ========================
// SUBJECTS
// ========================
async function loadSubjects() {
  const subjects = await dbGet('subjects');
  const list = document.getElementById('subjects-list');
  list.innerHTML = subjects.map(s => `
    <div class="card" onclick="openSubjectDetail(${s.id}, '${escHtml(s.name)}')">
      <div class="card-body">
        <h3 class="card-title">${escHtml(s.name)}</h3>
        <p class="card-text">${escHtml(s.description) || 'Sem descrição'}</p>
      </div>
      <div class="card-footer">
        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteSubject(${s.id})">Excluir</button>
      </div>
    </div>
  `).join('') || '<p>Nenhuma matéria cadastrada.</p>';
}

async function addSubject() {
  const name = document.getElementById('add-subject-name').value.trim();
  const description = document.getElementById('add-subject-desc').value.trim();
  if (!name) return toast('Nome da matéria é obrigatório', 'error');

  try {
    await dbInsert('subjects', { name, description });
    toast('Matéria adicionada!', 'success');
    closeModal('add-subject-modal');
    loadSubjects();
    document.getElementById('add-subject-form').reset();
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  }
}

async function deleteSubject(id) {
  if (!confirm('Deseja excluir esta matéria e todas as suas aulas?')) return;
  try {
    await dbDelete('subjects', id);
    toast('Matéria excluída', 'success');
    loadSubjects();
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  }
}

// ========================
// SUBJECT DETAIL
// ========================
async function openSubjectDetail(id, name) {
  currentSubjectId = id;
  showPage('subject-detail', name);
  
  const [lessons, assignments, exams] = await Promise.all([
    dbGet('lessons', { subject_id: id }),
    dbGet('assignments', { subject_id: id }),
    dbGet('exams', { subject_id: id })
  ]);

  document.getElementById('subject-actions').innerHTML = `
    <button class="btn btn-sm btn-primary" onclick="openLessonEditor(null, ${id})">+ Nova Aula</button>
    <button class="btn btn-sm" onclick="openAssignmentEditor(null, ${id})">+ Nova Tarefa</button>
    <button class="btn btn-sm" onclick="openExamEditor(null, ${id})">+ Nova Prova</button>
  `;

  const lessonList = document.getElementById('lesson-list');
  lessonList.innerHTML = lessons.map(l => `
    <div class="list-item">
      <span>${escHtml(l.title)}</span>
      <div>
        <button class="btn btn-sm" onclick="openStudyScreen(${l.id}, '${escHtml(l.title)}')">Estudar</button>
        <button class="btn btn-sm" onclick="openLessonEditor(${l.id})">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteLesson(${l.id})">Excluir</button>
      </div>
    </div>
  `).join('') || '<p>Nenhuma aula criada.</p>';

  const assignmentList = document.getElementById('assignment-list');
  assignmentList.innerHTML = assignments.map(a => `
    <div class="list-item">
      <span>${escHtml(a.title)}</span>
      <div>
        <button class="btn btn-sm" onclick="openAssignmentEditor(${a.id})">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteAssignment(${a.id})">Excluir</button>
      </div>
    </div>
  `).join('') || '<p>Nenhuma tarefa criada.</p>';

  const examList = document.getElementById('exam-list');
  examList.innerHTML = exams.map(e => `
    <div class="list-item">
      <span>${escHtml(e.title)}</span>
      <div>
        <button class="btn btn-sm" onclick="openExamEditor(${e.id})">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteExam(${e.id})">Excluir</button>
      </div>
    </div>
  `).join('') || '<p>Nenhuma prova criada.</p>';
}

// ========================
// LESSON EDITOR
// ========================
async function openLessonEditor(id, subjectId) {
  currentLessonId = id;
  currentSubjectId = subjectId || currentSubjectId;
  
  if (id) {
    const lesson = await dbGetOne('lessons', id);
    currentLessonData = lesson || {};
    showPage('lesson-editor', 'Editar Aula: ' + lesson.title);
    document.getElementById('lesson-title').value = lesson.title;
    document.getElementById('lesson-date').value = lesson.date;
    document.getElementById('lesson-content').value = lesson.content;
    document.getElementById('lesson-notes').value = lesson.notes;
  } else {
    currentLessonData = {};
    showPage('lesson-editor', 'Nova Aula');
    document.getElementById('lesson-editor-form').reset();
  }
}

async function saveLesson() {
  const title = document.getElementById('lesson-title').value.trim();
  const date = document.getElementById('lesson-date').value;
  const content = document.getElementById('lesson-content').value.trim();
  const notes = document.getElementById('lesson-notes').value.trim();
  if (!title) return toast('Título da aula é obrigatório', 'error');

  const lessonData = { title, date, content, notes, subject_id: currentSubjectId };

  try {
    if (currentLessonId) {
      await dbUpdate('lessons', currentLessonId, lessonData);
      toast('Aula atualizada!', 'success');
    } else {
      await dbInsert('lessons', lessonData);
      toast('Aula criada!', 'success');
    }
    const subject = await dbGetOne('subjects', currentSubjectId);
    openSubjectDetail(currentSubjectId, subject.name);
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  }
}

async function deleteLesson(id) {
  if (!confirm('Deseja excluir esta aula?')) return;
  try {
    await dbDelete('lessons', id);
    toast('Aula excluída', 'success');
    const subject = await dbGetOne('subjects', currentSubjectId);
    openSubjectDetail(currentSubjectId, subject.name);
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  }
}

async function generateLessonContent() {
  const title = document.getElementById('lesson-title').value.trim();
  if (!title) return toast('Dê um título à aula primeiro', 'error');

  const btn = event.target;
  btn.disabled = true; btn.textContent = 'Gerando...';

  try {
    const prompt = `Crie o conteúdo completo para uma aula de seminário sobre "${title}". Estruture em seções com títulos (## Título) e pontos principais. Inclua referências bíblicas.`;
    const content = await claudeAI(prompt);
    document.getElementById('lesson-content').value = content;

    const notesPrompt = `Com base no conteúdo da aula sobre "${title}", crie anotações para o professor com dicas de ensino, perguntas para debate e pontos a enfatizar.`;
    const notes = await claudeAI(notesPrompt);
    document.getElementById('lesson-notes').value = notes;

    toast('Conteúdo gerado com IA!', 'success');
  } catch (err) {
    toast('Erro na IA: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Gerar com IA';
  }
}

// ========================
// STUDENTS
// ========================
async function loadStudents() {
  const students = await dbGet('students');
  const list = document.getElementById('students-list');
  list.innerHTML = students.map(s => `
    <div class="list-item">
      <span>${escHtml(s.name)} (${escHtml(s.email)})</span>
      <button class="btn btn-sm btn-danger" onclick="deleteStudent(${s.id})">Excluir</button>
    </div>
  `).join('') || '<p>Nenhum aluno cadastrado.</p>';
}

async function addStudent() {
  const name = document.getElementById('add-student-name').value.trim();
  const email = document.getElementById('add-student-email').value.trim();
  if (!name || !email) return toast('Nome e e-mail são obrigatórios', 'error');

  try {
    await dbInsert('students', { name, email });
    toast('Aluno adicionado!', 'success');
    closeModal('add-student-modal');
    loadStudents();
    document.getElementById('add-student-form').reset();
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  }
}

async function deleteStudent(id) {
  if (!confirm('Deseja excluir este aluno?')) return;
  try {
    await dbDelete('students', id);
    toast('Aluno excluído', 'success');
    loadStudents();
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  }
}

// ========================
// GRADES
// ========================
async function loadGradesSelect() {
  const subjects = await dbGet('subjects');
  const select = document.getElementById('grades-subject-select');
  select.innerHTML = '<option value="">Selecione uma matéria</option>' + 
    subjects.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
  document.getElementById('grades-assignment-select').innerHTML = '<option value="">Selecione uma atividade</option>';
  document.getElementById('grades-table-container').innerHTML = '';
}

async function onGradesSubjectChange(subjectId) {
  if (!subjectId) {
    document.getElementById('grades-assignment-select').innerHTML = '<option value="">Selecione uma atividade</option>';
    document.getElementById('grades-table-container').innerHTML = '';
    return;
  }
  const [assignments, exams] = await Promise.all([
    dbGet('assignments', { subject_id: subjectId }),
    dbGet('exams', { subject_id: subjectId })
  ]);
  const activities = [...assignments.map(a => ({...a, type: 'assignment'})), ...exams.map(e => ({...e, type: 'exam'}))];
  const select = document.getElementById('grades-assignment-select');
  select.innerHTML = '<option value="">Selecione uma atividade</option>' + 
    activities.map(a => `<option value="${a.type}-${a.id}">${escHtml(a.title)} (${a.type === 'assignment' ? 'Tarefa' : 'Prova'})</option>`).join('');
}

async function onGradesAssignmentChange(activityId) {
  if (!activityId) {
    document.getElementById('grades-table-container').innerHTML = '';
    return;
  }
  const [type, id] = activityId.split('-');
  
  const [students, grades] = await Promise.all([
    dbGet('students'),
    dbGet('grades', { [`${type}_id`]: id })
  ]);

  const gradesMap = grades.reduce((acc, g) => ({ ...acc, [g.student_id]: g.grade }), {});

  const table = `
    <table class="table">
      <thead><tr><th>Aluno</th><th>Nota</th></tr></thead>
      <tbody>
        ${students.map(s => `
          <tr>
            <td>${escHtml(s.name)}</td>
            <td><input type="number" class="form-input" value="${gradesMap[s.id] || ''}" onchange="saveGrade(${s.id}, '${type}', ${id}, this.value)" placeholder="-"></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  document.getElementById('grades-table-container').innerHTML = table;
}

async function saveGrade(studentId, type, activityId, grade) {
  const gradeValue = parseFloat(grade);
  if (isNaN(gradeValue)) return;

  const gradeData = {
    student_id: studentId,
    grade: gradeValue,
    user_id: currentUser.id
  };
  gradeData[`${type}_id`] = activityId;

  try {
    const existing = await dbGet('grades', { student_id: studentId, [`${type}_id`]: activityId });
    if (existing.length > 0) {
      await dbUpdate('grades', existing[0].id, { grade: gradeValue });
    } else {
      await dbInsert('grades', gradeData);
    }
    toast('Nota salva!', 'success', 1000);
  } catch (err) {
    toast('Erro ao salvar nota: ' + err.message, 'error');
  }
}

// ========================
// CALENDAR
// ========================
function renderCalendar() {
  const monthEl = document.getElementById('calendar-month');
  const yearEl = document.getElementById('calendar-year');
  const daysEl = document.getElementById('calendar-days');

  const month = calendarDate.getMonth();
  const year = calendarDate.getFullYear();

  monthEl.textContent = calendarDate.toLocaleDateString('pt-BR', { month: 'long' });
  yearEl.textContent = year;

  daysEl.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    daysEl.innerHTML += '<div></div>';
  }

  for (let i = 1; i <= lastDate; i++) {
    const dayDiv = document.createElement('div');
    dayDiv.textContent = i;
    if (i === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear()) {
      dayDiv.classList.add('today');
    }
    daysEl.appendChild(dayDiv);
  }
  // Note: Event loading would be added here
}

function changeMonth(offset) {
  calendarDate.setMonth(calendarDate.getMonth() + offset);
  renderCalendar();
}

// ========================
// REPORTS
// ========================
async function loadReportsSelect() {
  const subjects = await dbGet('subjects');
  const select = document.getElementById('reports-subject-select');
  select.innerHTML = '<option value="">Selecione uma matéria para ver o relatório</option>' + 
    subjects.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
  document.getElementById('report-content').innerHTML = '';
}

async function onReportSubjectChange(subjectId) {
  if (!subjectId) {
    document.getElementById('report-content').innerHTML = '';
    return;
  }

  const [students, assignments, exams, grades] = await Promise.all([
    dbGet('students'),
    dbGet('assignments', { subject_id: subjectId }),
    dbGet('exams', { subject_id: subjectId }),
    dbGet('grades') // Simplified, should filter by subject
  ]);

  const activities = [...assignments, ...exams];
  const reportData = students.map(student => {
    const studentGrades = grades.filter(g => g.student_id === student.id);
    const totalPoints = studentGrades.reduce((sum, g) => sum + g.grade, 0);
    const average = studentGrades.length > 0 ? (totalPoints / studentGrades.length).toFixed(1) : 'N/A';
    return { name: student.name, average, grades: studentGrades };
  });

  let content = '<h3>Desempenho Geral</h3>';
  content += `
    <table class="table">
      <thead><tr><th>Aluno</th><th>Média</th></tr></thead>
      <tbody>
        ${reportData.map(r => `<tr><td>${escHtml(r.name)}</td><td>${r.average}</td></tr>`).join('')}
      </tbody>
    </table>
  `;
  document.getElementById('report-content').innerHTML = content;
}

// ========================
// MODALS
// ========================
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// ========================
// UTILS
// ========================
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let toastTimeout;
function toast(message, type = 'info', duration = 3000) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = 'toast show ' + type;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { el.className = 'toast'; }, duration);
}

// Close modals on escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    closeStudyScreen();
  }
});

// Close user menu on click outside
document.addEventListener('click', function(event) {
  const userMenu = document.getElementById('user-menu');
  const userAvatar = document.getElementById('user-avatar');
  if (userMenu && userAvatar && !userMenu.contains(event.target) && !userAvatar.contains(event.target)) {
    userMenu.style.display = 'none';
  }
});

function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

// ========================
// ASSIGNMENT & EXAM EDITORS (Simplified)
// ========================
async function openAssignmentEditor(id, subjectId) {
  // Simplified - a full implementation would be similar to lesson editor
  alert('Gerenciamento de tarefas ainda não implementado.');
}

async function openExamEditor(id, subjectId) {
  alert('Gerenciamento de provas ainda não implementado.');
}

async function deleteAssignment(id) {
  if (!confirm('Deseja excluir esta tarefa?')) return;
  try {
    await dbDelete('assignments', id);
    toast('Tarefa excluída', 'success');
    const subject = await dbGetOne('subjects', currentSubjectId);
    openSubjectDetail(currentSubjectId, subject.name);
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  }
}

async function deleteExam(id) {
  if (!confirm('Deseja excluir esta prova?')) return;
  try {
    await dbDelete('exams', id);
    toast('Prova excluída', 'success');
    const subject = await dbGetOne('subjects', currentSubjectId);
    openSubjectDetail(currentSubjectId, subject.name);
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  }
}

// ========================
// DATA LOADING FOR SELECTS
// ========================
async function loadSubjectsForSelects() {
    const subjects = await dbGet('subjects');
    const selects = document.querySelectorAll('.subject-select');
    selects.forEach(select => {
        const currentVal = select.value;
        select.innerHTML = '<option value="">Selecione</option>';
        subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            if (s.id == currentVal) opt.selected = true;
            select.appendChild(opt);
        });
    });
}













































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































