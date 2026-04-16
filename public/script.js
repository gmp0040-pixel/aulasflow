/**
 * **URL:** https://raw.githubusercontent.com/gmp0040-pixel/aulasflow/main/public/script.js
 */

// ===================================
// CONFIG & STATE
// ===================================
let currentUser = null;
let currentSubjectId = null;
let currentLessonId = null;
let currentLessonData = {};
let currentExamData = null;
let currentAssignmentData = null;
let selectedAssignmentIdx = 0;
let presentationSlides = [];
let presentationNotes = "";
let currentSlide = 0;
let calendarDate = new Date();
let _sb = null; // supabase client

// ===================================
// SUPABASE INIT
// ===================================
function getSupabase() {
  if (!_sb) {
    _sb = window._supabase;
  }
  return _sb;
}

// ===================================
// CLAUDE AI HELPER
// ===================================
async function claudeAI(prompt, systemPrompt, max_tokens) {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      system: systemPrompt || `Você é um professor e teólogo reformado de alto nível, especialista em criar conteúdo pedagógico excepcional em português brasileiro para formação ministerial em seminário teológico. Seu conteúdo é fundamentado exclusivamente nas Escrituras Sagradas. Cite teólogos reformados quando relevante: Calvino, Berkhof, Bavinck, Sproul, Kuyper, Hodge, Frame, Horton, Beeke. REGRAS: 1) NUNCA repita o mesmo sujeito em frases consecutivas; 2) Cada ponto traz informação NOVA e DISTINTA; 3) Varie perspectivas: bíblica, histórica, doutrinal, prática, pastoral; 4) Use referências bíblicas ESPECÍFICAS com capítulo e versículo; 5) Frases COMPLETAS e INFORMATIVAS — nunca palavras soltas.`, // CORREÇÃO AQUI: Usando crases para template literal
      max_tokens: max_tokens || 4000,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Erro na IA");

  return data.content;
}

async function claudeJSON(prompt, systemPrompt) {
  const text = await claudeAI(prompt, systemPrompt);
  const clean = text.replace(/\n/g, "").trim();
  return JSON.parse(clean);
}

// ===================================
// INIT
// ===================================
window.addEventListener("DOMContentLoaded", async () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }

  // Check if user is logged in
  const { data: { user } } = await getSupabase().auth.getUser();
  if (user) {
    currentUser = user;
    showAppScreen();
  } else {
    showAuthScreen();
  }

  // Add event listeners for auth
  document.getElementById("login-form").addEventListener("submit", login);
  document.getElementById("reg-form").addEventListener("submit", register);

  // Add event listeners for app
  document.getElementById("logout-btn").addEventListener("click", logout);
  document.getElementById("add-subject-btn").addEventListener("click", showAddSubjectModal);
  document.getElementById("save-subject-btn").addEventListener("click", saveSubject);
  document.getElementById("add-lesson-btn").addEventListener("click", showAddLessonModal);
  document.getElementById("save-lesson-btn").addEventListener("click", saveLesson);
  document.getElementById("add-exam-btn").addEventListener("click", showAddExamModal);
  document.getElementById("save-exam-btn").addEventListener("click", saveExam);
  document.getElementById("add-assignment-btn").addEventListener("click", showAddAssignmentModal);
  document.getElementById("save-assignment-btn").addEventListener("click", saveAssignment);
  document.getElementById("add-grade-btn").addEventListener("click", showAddGradeModal);
  document.getElementById("save-grade-btn").addEventListener("click", saveGrade);
  document.getElementById("add-event-btn").addEventListener("click", showAddEventModal);
  document.getElementById("save-event-btn").addEventListener("click", saveEvent);

  // Initial load
  loadSubjects();
  loadCalendar();
});

// ===================================
// UI FUNCTIONS
// ===================================
function showAuthScreen() {
  document.getElementById("auth-screen").style.display = "block";
  document.getElementById("app-screen").style.display = "none";
}

function showAppScreen() {
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app-screen").style.display = "grid";
  updateUserInfo();
}

function updateUserInfo() {
  document.getElementById("user-email").textContent = currentUser.email;
}

function showModal(modalId) {
  document.getElementById(modalId).classList.add("active");
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("active");
}

function showToast(message, type = "info") {
  const toastContainer = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function showLoading(message = "Carregando...") {
  const loadingOverlay = document.getElementById("loading-overlay");
  document.getElementById("loading-message").textContent = message;
  loadingOverlay.classList.add("active");
}

function hideLoading() {
  document.getElementById("loading-overlay").classList.remove("active");
}

function switchAuthTab(tab) {
  if (tab === "login") {
    document.getElementById("login-form").style.display = "block";
    document.getElementById("reg-form").style.display = "none";
    document.querySelector(".auth-tab[onclick*=\'login\']").classList.add("active");
    document.querySelector(".auth-tab[onclick*=\'register\']").classList.remove("active");
  } else {
    document.getElementById("login-form").style.display = "none";
    document.getElementById("reg-form").style.display = "block";
    document.querySelector(".auth-tab[onclick*=\'login\']").classList.remove("active");
    document.querySelector(".auth-tab[onclick*=\'register\']").classList.add("active");
  }
}

function toggleSidebar() {
  document.getElementById("sidebar-overlay").classList.toggle("active");
  document.getElementById("sidebar").classList.toggle("active");
}

// ===================================
// AUTH FUNCTIONS
// ===================================
async function login(event) {
  event.preventDefault();
  showLoading("Entrando...");
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  const { data, error } = await getSupabase().auth.signInWithPassword({
    email: email,
    password: password,
  });

  hideLoading();
  if (error) {
    showToast(error.message, "error");
  } else {
    currentUser = data.user;
    showAppScreen();
    showToast("Login bem-sucedido!", "success");
    loadSubjects();
    loadCalendar();
  }
}

async function register(event) {
  event.preventDefault();
  showLoading("Registrando...");
  const name = document.getElementById("reg-name").value;
  const email = document.getElementById("reg-email").value;
  const password = document.getElementById("reg-password").value;

  const { data, error } = await getSupabase().auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        full_name: name,
      },
    },
  });

  hideLoading();
  if (error) {
    showToast(error.message, "error");
  } else {
    currentUser = data.user;
    showAppScreen();
    showToast("Registro bem-sucedido! Verifique seu e-mail para confirmar.", "success");
    loadSubjects();
    loadCalendar();
  }
}

async function logout() {
  showLoading("Saindo...");
  const { error } = await getSupabase().auth.signOut();
  hideLoading();
  if (error) {
    showToast(error.message, "error");
  } else {
    currentUser = null;
    showAuthScreen();
    showToast("Logout bem-sucedido!", "info");
  }
}

// ===================================
// SUBJECT FUNCTIONS
// ===================================
async function loadSubjects() {
  showLoading("Carregando matérias...");
  const { data, error } = await getSupabase()
    .from("subjects")
    .select("*")
    .eq("user_id", currentUser.id);

  hideLoading();
  if (error) {
    showToast(error.message, "error");
    return;
  }

  const subjectsList = document.getElementById("subjects-list");
  subjectsList.innerHTML = "";
  data.forEach((subject) => {
    const li = document.createElement("li");
    li.className = "subject-item";
    li.innerHTML = `
      <span onclick="openSubject(${subject.id}, \'${subject.title}\')">${subject.title}</span>
      <div class="subject-actions">
        <button onclick="editSubject(${subject.id}, \'${subject.title}\')" class="btn btn-sm btn-info">Editar</button>
        <button onclick="deleteSubject(${subject.id})" class="btn btn-sm btn-danger">Excluir</button>
      </div>
    `;
    subjectsList.appendChild(li);
  });
}

function showAddSubjectModal() {
  document.getElementById("subject-title").value = "";
  document.getElementById("subject-id").value = "";
  showModal("subject-modal");
}

async function saveSubject() {
  const title = document.getElementById("subject-title").value;
  const id = document.getElementById("subject-id").value;

  if (!title) {
    showToast("O título da matéria não pode ser vazio.", "error");
    return;
  }

  showLoading("Salvando matéria...");
  let error;
  if (id) {
    // Update
    ({ error } = await getSupabase()
      .from("subjects")
      .update({ title: title })
      .eq("id", id));
  } else {
    // Insert
    ({ error } = await getSupabase()
      .from("subjects")
      .insert([{ title: title, user_id: currentUser.id }]));
  }

  hideLoading();
  if (error) {
    showToast(error.message, "error");
  } else {
    closeModal("subject-modal");
    showToast("Matéria salva com sucesso!", "success");
    loadSubjects();
  }
}

async function editSubject(id, title) {
  document.getElementById("subject-title").value = title;
  document.getElementById("subject-id").value = id;
  showModal("subject-modal");
}

async function deleteSubject(id) {
  if (!confirm("Tem certeza que deseja excluir esta matéria e todos os seus conteúdos (aulas, provas, trabalhos)?")) {
    return;
  }

  showLoading("Excluindo matéria...");
  const { error } = await getSupabase().from("subjects").delete().eq("id", id);
  hideLoading();
  if (error) {
    showToast(error.message, "error");
  } else {
    showToast("Matéria excluída com sucesso!", "success");
    loadSubjects();
    // Clear lesson view if the deleted subject was open
    if (currentSubjectId === id) {
      document.getElementById("lessons-view").innerHTML = "";
      document.getElementById("subject-title-display").textContent = "";
      currentSubjectId = null;
    }
  }
}

async function openSubject(subjectId, subjectTitle) {
  currentSubjectId = subjectId;
  document.getElementById("subject-title-display").textContent = subjectTitle;
  document.getElementById("main-content").innerHTML = `
    <div class="lessons-container">
      <div class="lessons-header">
        <h2>Aulas</h2>
        <button id="add-lesson-btn" class="btn btn-primary">Adicionar Aula</button>
      </div>
      <ul id="lessons-list" class="list-group"></ul>
    </div>
    <div class="exams-container">
      <div class="exams-header">
        <h2>Provas</h2>
        <button id="add-exam-btn" class="btn btn-primary">Adicionar Prova</button>
      </div>
      <ul id="exams-list" class="list-group"></ul>
    </div>
    <div class="assignments-container">
      <div class="assignments-header">
        <h2>Trabalhos</h2>
        <button id="add-assignment-btn" class="btn btn-primary">Adicionar Trabalho</button>
      </div>
      <ul id="assignments-list" class="list-group"></ul>
    </div>
  `;
  document.getElementById("add-lesson-btn").addEventListener("click", showAddLessonModal);
  document.getElementById("add-exam-btn").addEventListener("click", showAddExamModal);
  document.getElementById("add-assignment-btn").addEventListener("click", showAddAssignmentModal);
  loadLessons(subjectId);
  loadExams(subjectId);
  loadAssignments(subjectId);
}

// ===================================
// LESSON FUNCTIONS
// ===================================
async function loadLessons(subjectId) {
  showLoading("Carregando aulas...");
  const { data, error } = await getSupabase()
    .from("lessons")
    .select("*")
    .eq("subject_id", subjectId)
    .order("date", { ascending: true });

  hideLoading();
  if (error) {
    showToast(error.message, "error");
    return;
  }

  const lessonsList = document.getElementById("lessons-list");
  lessonsList.innerHTML = "";
  data.forEach((lesson) => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.innerHTML = `
      <span onclick="openLesson(${lesson.id}, \'${lesson.title}\')">${lesson.title} (${new Date(lesson.date).toLocaleDateString()})</span>
      <div class="lesson-actions">
        <button onclick="editLesson(${lesson.id}, \'${lesson.title}\', \'${lesson.date}\', \'${lesson.content}\')" class="btn btn-sm btn-info">Editar</button>
        <button onclick="deleteLesson(${lesson.id})" class="btn btn-sm btn-danger">Excluir</button>
      </div>
    `;
    lessonsList.appendChild(li);
  });
}

function showAddLessonModal() {
  document.getElementById("lesson-title").value = "";
  document.getElementById("lesson-date").value = new Date().toISOString().split("T")[0];
  document.getElementById("lesson-content").value = "";
  document.getElementById("lesson-id").value = "";
  showModal("lesson-modal");
}

async function saveLesson() {
  const title = document.getElementById("lesson-title").value;
  const date = document.getElementById("lesson-date").value;
  const content = document.getElementById("lesson-content").value;
  const id = document.getElementById("lesson-id").value;

  if (!title || !date) {
    showToast("Título e data da aula não podem ser vazios.", "error");
    return;
  }

  showLoading("Salvando aula...");
  let error;
  if (id) {
    // Update
    ({ error } = await getSupabase()
      .from("lessons")
      .update({ title, date, content })
      .eq("id", id));
  } else {
    // Insert
    ({ error } = await getSupabase()
      .from("lessons")
      .insert([{ title, date, content, subject_id: currentSubjectId }]));
  }

  hideLoading();
  if (error) {
    showToast(error.message, "error");
  } else {
    closeModal("lesson-modal");
    showToast("Aula salva com sucesso!", "success");
    loadLessons(currentSubjectId);
  }
}

async function editLesson(id, title, date, content) {
  document.getElementById("lesson-title").value = title;
  document.getElementById("lesson-date").value = date.split("T")[0]; // Format date for input
  document.getElementById("lesson-content").value = content;
  document.getElementById("lesson-id").value = id;
  showModal("lesson-modal");
}

async function deleteLesson(id) {
  if (!confirm("Tem certeza que deseja excluir esta aula?")) {
    return;
  }

  showLoading("Excluindo aula...");
  const { error } = await getSupabase().from("lessons").delete().eq("id", id);
  hideLoading();
  if (error) {
    showToast(error.message, "error");
  } else {
    showToast("Aula excluída com sucesso!", "success");
    loadLessons(currentSubjectId);
  }
}

async function openLesson(lessonId, lessonTitle) {
  currentLessonId = lessonId;
  document.getElementById("main-content").innerHTML = `
    <div class="lesson-detail-container">
      <div class="lesson-detail-header">
        <button onclick="closeLesson()" class="btn btn-secondary">Voltar</button>
        <h2>${lessonTitle}</h2>
        <div class="lesson-detail-actions">
          <button onclick="startStudyAddon()" class="btn btn-primary">Estudar com IA</button>
        </div>
      </div>
      <div id="lesson-content-display" class="lesson-content-display"></div>
    </div>
  `;
  await loadLessonContent(lessonId);
}

async function loadLessonContent(lessonId) {
  showLoading("Carregando conteúdo da aula...");
  const { data, error } = await getSupabase()
    .from("lessons")
    .select("content")
    .eq("id", lessonId)
    .single();

  hideLoading();
  if (error) {
    showToast(error.message, "error");
    return;
  }

  currentLessonData = data;
  document.getElementById("lesson-content-display").innerHTML = marked.parse(data.content);
}

function closeLesson() {
  currentLessonId = null;
  openSubject(currentSubjectId, document.getElementById("subject-title-display").textContent);
}

function startStudyAddon() {
  // This function is implemented in study-addon.js
  openStudyScreen(currentLessonId, document.querySelector("#main-content h2").textContent);
}

// ===================================
// EXAM FUNCTIONS
// ===================================
async function loadExams(subjectId) {
  showLoading("Carregando provas...");
  const { data, error } = await getSupabase()
    .from("exams")
    .select("*")
    .eq("subject_id", subjectId)
    .order("date", { ascending: true });

  hideLoading();
  if (error) {
    showToast(error.message, "error");
    return;
  }

  const examsList = document.getElementById("exams-list");
  examsList.innerHTML = "";
  data.forEach((exam) => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.innerHTML = `
      <span onclick="openExam(${exam.id}, \'${exam.title}\')">${exam.title} (${new Date(exam.date).toLocaleDateString()})</span>
      <div class="exam-actions">
        <button onclick="editExam(${exam.id}, \'${exam.title}\', \'${exam.date}\', ${exam.max_grade})" class="btn btn-sm btn-info">Editar</button>
        <button onclick="deleteExam(${exam.id})" class="btn btn-sm btn-danger">Excluir</button>
      </div>
    `;
    examsList.appendChild(li);
  });
}

function showAddExamModal() {
  document.getElementById("exam-title").value = "";
  document.getElementById("exam-date").value = new Date().toISOString().split("T")[0];
  document.getElementById("exam-max-grade").value = 10;
  document.getElementById("exam-id").value = "";
  showModal("exam-modal");
}

async function saveExam() {
  const title = document.getElementById("exam-title").value;
  const date = document.getElementById("exam-date").value;
  const max_grade = parseFloat(document.getElementById("exam-max-grade").value);
  const id = document.getElementById("exam-id").value;

  if (!title || !date) {
    showToast("Título e data da prova não podem ser vazios.", "error");
    return;
  }
  if (isNaN(max_grade) || max_grade <= 0) {
    showToast("Nota máxima inválida.", "error");
    return;
  }

  showLoading("Salvando prova...");
  let error;
  if (id) {
    // Update
    ({ error } = await getSupabase()
      .from("exams")
      .update({ title, date, max_grade })
      .eq("id", id));
  } else {
    // Insert
    ({ error } = await getSupabase()
      .from("exams")
      .insert([{ title, date, max_grade, subject_id: currentSubjectId }]));
  }

  hideLoading();
  if (error) {
    showToast(error.message, "error");
  } else {
    closeModal("exam-modal");
    showToast("Prova salva com sucesso!", "success");
    loadExams(currentSubjectId);
  }
}

async function editExam(id, title, date, max_grade) {
  document.getElementById("exam-title").value = title;
  document.getElementById("exam-date").value = date.split("T")[0];
  document.getElementById("exam-max-grade").value = max_grade;
  document.getElementById("exam-id").value = id;
  showModal("exam-modal");
}

async function deleteExam(id) {
  if (!confirm("Tem certeza que deseja excluir esta prova?")) {
    return;
  }

  showLoading("Excluindo prova...");
  const { error } = await getSupabase().from("exams").delete().eq("id", id);
  hideLoading();
  if (error) {
    showToast(error.message, "error");
  } else {
    showToast("Prova excluída com sucesso!", "success");
    loadExams(currentSubjectId);
  }
}

async function openExam(examId, examTitle) {
  document.getElementById("main-content").innerHTML = `
    <div class="exam-detail-container">
      <div class="exam-detail-header">
        <button onclick="closeExam()" class="btn btn-secondary">Voltar</button>
        <h2>${examTitle}</h2>
        <div class="exam-detail-actions">
          <button onclick="showAddGradeModal(${examId})" class="btn btn-primary">Lançar Nota</button>
        </div>
      </div>
      <ul id="grades-list" class="list-group"></ul>
    </div>
  `;
  loadGrades(examId);
}

function closeExam() {
  openSubject(currentSubjectId, document.getElementById("subject-title-display").textContent);
}

// ===================================
// ASSIGNMENT FUNCTIONS
// ===================================
async function loadAssignments(subjectId) {
  showLoading("Carregando trabalhos...");
  const { data, error } = await getSupabase()
    .from("assignments")
    .select("*")
    .eq("subject_id", subjectId)
    .order("due_date", { ascending: true });

  hideLoading();
  if (error) {
    showToast(error.message, "error");
    return;
  }

  const assignmentsList = document.getElementById("assignments-list");
  assignmentsList.innerHTML = "";
  data.forEach((assignment) => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.innerHTML = `
      <span onclick="openAssignment(${assignment.id}, \'${assignment.title}\')">${assignment.title} (Entrega: ${new Date(assignment.due_date).toLocaleDateString()})</span>
      <div class="assignment-actions">
        <button onclick="editAssignment(${assignment.id}, \'${assignment.title}\', \'${assignment.description}\', \'${assignment.due_date}\', ${assignment.max_grade})" class="btn btn-sm btn-info">Editar</button>
        <button onclick="deleteAssignment(${assignment.id})" class="btn btn-sm btn-danger">Excluir</button>
      </div>
    `;
    assignmentsList.appendChild(li);
  });
}

function showAddAssignmentModal() {
  document.getElementById("assignment-title").value = "";
  document.getElementById("assignment-description").value = "";
  document.getElementById("assignment-due-date").value = new Date().toISOString().split("T")[0];
  document.getElementById("assignment-max-grade").value = 10;
  document.getElementById("assignment-id").value = "";
  showModal("assignment-modal");
}

async function saveAssignment() {
  const title = document.getElementById("assignment-title").value;
  const description = document.getElementById("assignment-description").value;
  const due_date = document.getElementById("assignment-due-date").value;
  const max_grade = parseFloat(document.getElementById("assignment-max-grade").value);
  const id = document.getElementById("assignment-id").value;

  if (!title || !due_date) {
    showToast("Título e data de entrega do trabalho não podem ser vazios.", "error");
    return;
  }
  if (isNaN(max_grade) || max_grade <= 0) {
    showToast("Nota máxima inválida.", "error");
    return;
  }

  showLoading("Salvando trabalho...");
  let error;
  if (id) {
    // Update
    ({ error } = await getSupabase()
      .from("assignments")
      .update({ title, description, due_date, max_grade })
      .eq("id", id));
  } else {
    // Insert
    ({ error } = await getSupabase()
      .from("assignments")
      .insert([{ title, description, due_date, max_grade, subject_id: currentSubjectId }]));
  }

  hideLoading();
  if (error) {
    showToast(error.message, "error");
  } else {
    closeModal("assignment-modal");
    showToast("Trabalho salvo com sucesso!", "success");
    loadAssignments(currentSubjectId);
  }
}

async function editAssignment(id, title, description, due_date, max_grade) {
  document.getElementById("assignment-title").value = title;
  document.getElementById("assignment-description").value = description;
  document.getElementById("assignment-due-date").value = due_date.split("T")[0];
  document.getElementById("assignment-max-grade").value = max_grade;
  document.getElementById("assignment-id").value = id;
  showModal("assignment-modal");
}

async function deleteAssignment(id) {
  if (!confirm("Tem certeza que deseja excluir este trabalho?")) {
    return;
  }

  showLoading("Excluindo trabalho...");
  const { error } = await getSupabase().from("assignments").delete().eq("id", id);
  hideLoading();
  if (error) {
    showToast(error.message, "error");
  } else {
    showToast("Trabalho excluído com sucesso!", "success");
    loadAssignments(currentSubjectId);
  }
}

async function openAssignment(assignmentId, assignmentTitle) {
  document.getElementById("main-content").innerHTML = `
    <div class="assignment-detail-container">
      <div class="assignment-detail-header">
        <button onclick="closeAssignment()" class="btn btn-secondary">Voltar</button>
        <h2>${assignmentTitle}</h2>
        <div class="assignment-detail-actions">
          <button onclick="showAddGradeModal(${assignmentId}, true)" class="btn btn-primary">Lançar Nota</button>
        </div>
      </div>
      <ul id="grades-list" class="list-group"></ul>
    </div>
  `;
  loadGrades(assignmentId, true);
}

function closeAssignment() {
  openSubject(currentSubjectId, document.getElementById("subject-title-display").textContent);
}

// ===================================
// GRADE FUNCTIONS
// ===================================
async function loadGrades(parentId, isAssignment = false) {
  showLoading("Carregando notas...");
  let query = getSupabase().from("grades").select("*, students(name)");

  if (isAssignment) {
    query = query.eq("assignment_id", parentId);
  } else {
    query = query.eq("exam_id", parentId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  hideLoading();
  if (error) {
    showToast(error.message, "error");
    return;
  }

  const gradesList = document.getElementById("grades-list");
  gradesList.innerHTML = "";
  data.forEach((grade) => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.innerHTML = `
      <span>${grade.students.name}: ${grade.grade}</span>
      <div class="grade-actions">
        <button onclick="editGrade(${grade.id}, ${grade.student_id}, ${grade.grade}, ${parentId}, ${isAssignment})" class="btn btn-sm btn-info">Editar</button>
        <button onclick="deleteGrade(${grade.id}, ${parentId}, ${isAssignment})" class="btn btn-sm btn-danger">Excluir</button>
      </div>
    `;
    gradesList.appendChild(li);
  });
}

async function showAddGradeModal(parentId, isAssignment = false) {
  document.getElementById("grade-activity").value = isAssignment ? "Trabalho" : "Prova";
  document.getElementById("grade-activity").readOnly = true;
  document.getElementById("grade-parent-id").value = parentId;
  document.getElementById("grade-is-assignment").value = isAssignment ? "true" : "false";
  document.getElementById("grade-id").value = "";
  document.getElementById("grade-value").value = "";
  document.getElementById("grade-date").value = new Date().toISOString().split("T")[0];

  // Load students for dropdown
  const { data: students, error: studentsError } = await getSupabase()
    .from("students")
    .select("id, name")
    .eq("user_id", currentUser.id);

  if (studentsError) {
    showToast(studentsError.message, "error");
    return;
  }

  const studentSelect = document.getElementById("grade-student");
  studentSelect.innerHTML = "<option value=\"\">Selecione um aluno</option>";
  students.forEach(student => {
    const option = document.createElement("option");
    option.value = student.id;
    option.textContent = student.name;
    studentSelect.appendChild(option);
  });

  showModal("grade-modal");
}

async function saveGrade() {
  const student_id = document.getElementById("grade-student").value;
  const grade_value = parseFloat(document.getElementById("grade-value").value);
  const grade_date = document.getElementById("grade-date").value;
  const parent_id = document.getElementById("grade-parent-id").value;
  const is_assignment = document.getElementById("grade-is-assignment").value === "true";
  const id = document.getElementById("grade-id").value;

  if (!student_id || isNaN(grade_value) || grade_value < 0 || !grade_date) {
    showToast("Preencha todos os campos corretamente.", "error");
    return;
  }

  showLoading("Salvando nota...");
  let error;
  const gradeData = {
    student_id: student_id,
    grade: grade_value,
    date: grade_date,
    user_id: currentUser.id,
  };

  if (is_assignment) {
    gradeData.assignment_id = parent_id;
  } else {
    gradeData.exam_id = parent_id;
  }

  if (id) {
    // Update
    ({ error } = await getSupabase().from("grades").update(gradeData).eq("id", id));
  } else {
    // Insert
    ({ error } = await getSupabase().from("grades").insert([gradeData]));
  }

  hideLoading();
  if (error) {
    showToast(error.message, "error");
  } else {
    closeModal("grade-modal");
    showToast("Nota salva com sucesso!", "success");
    loadGrades(parent_id, is_assignment);
  }
}

async function editGrade(id, student_id, grade_value, parentId, isAssignment) {
  await showAddGradeModal(parentId, isAssignment);
  document.getElementById("grade-id").value = id;
  document.getElementById("grade-student").value = student_id;
  document.getElementById("grade-value").value = grade_value;
}

async function deleteGrade(id, parentId, isAssignment) {
  if (!confirm("Tem certeza que deseja excluir esta nota?")) {
    return;
  }

  showLoading("Excluindo nota...");
  const { error } = await getSupabase().from("grades").delete().eq("id", id);
  hideLoading();
  if (error) {
    showToast(error.message, "error");
  } else {
    showToast("Nota excluída com sucesso!", "success");
    loadGrades(parentId, isAssignment);
  }
}

// ===================================
// STUDENT FUNCTIONS
// ===================================
async function loadStudents() {
  showLoading("Carregando alunos...");
  const { data, error } = await getSupabase()
    .from("students")
    .select("*")
    .eq("user_id", currentUser.id);

  hideLoading();
  if (error) {
    showToast(error.message, "error");
    return;
  }

  const studentsList = document.getElementById("students-list");
  studentsList.innerHTML = "";
  data.forEach((student) => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.innerHTML = `
      <span>${student.name}</span>
      <div class="student-actions">
        <button onclick="editStudent(${student.id}, \'${student.name}\')" class="btn btn-sm btn-info">Editar</button>
        <button onclick="deleteStudent(${student.id})" class="btn btn-sm btn-danger">Excluir</button>
      </div>
    `;
    studentsList.appendChild(li);
  });
}

function showAddStudentModal() {
  document.getElementById("student-name").value = "";
  document.getElementById("student-id").value = "";
  showModal("student-modal");
}

async function saveStudent() {
  const name = document.getElementById("student-name").value;
  const id = document.getElementById("student-id").value;

  if (!name) {
    showToast("O nome do aluno não pode ser vazio.", "error");
    return;
  }

  showLoading("Salvando aluno...");
  let error;
  if (id) {
    // Update
    ({ error } = await getSupabase()
      .from("students")
      .update({ name: name })
      .eq("id", id));
  } else {
    // Insert
    ({ error } = await getSupabase()
      .from("students")
      .insert([{ name: name, user_id: currentUser.id }]));
  }

  hideLoading();
  if (error) {
    showToast(error.message, "error");
  } else {
    closeModal("student-modal");
    showToast("Aluno salvo com sucesso!", "success");
    loadStudents();
  }
}

async function editStudent(id, name) {
  document.getElementById("student-name").value = name;
  document.getElementById("student-id").value = id;
  showModal("student-modal");
}

async function deleteStudent(id) {
  if (!confirm("Tem certeza que deseja excluir este aluno e todas as suas notas?")) {
    return;
  }

  showLoading("Excluindo aluno...");
  const { error } = await getSupabase().from("students").delete().eq("id", id);
  hideLoading();
  if (error) {
    showToast(error.message, "error");
  } else {
    showToast("Aluno excluído com sucesso!", "success");
    loadStudents();
  }
}

// ===================================
// CALENDAR FUNCTIONS
// ===================================
async function loadCalendar() {
  showLoading("Carregando calendário...");
  const { data: events, error: eventsError } = await getSupabase()
    .from("events")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("date", { ascending: true });

  const { data: lessons, error: lessonsError } = await getSupabase()
    .from("lessons")
    .select("id, title, date")
    .eq("user_id", currentUser.id)
    .order("date", { ascending: true });

  const { data: exams, error: examsError } = await getSupabase()
    .from("exams")
    .select("id, title, date")
    .eq("user_id", currentUser.id)
    .order("date", { ascending: true });

  const { data: assignments, error: assignmentsError } = await getSupabase()
    .from("assignments")
    .select("id, title, due_date as date") // Alias due_date to date for consistency
    .eq("user_id", currentUser.id)
    .order("due_date", { ascending: true });

  hideLoading();

  if (eventsError || lessonsError || examsError || assignmentsError) {
    showToast("Erro ao carregar calendário: " + (eventsError || lessonsError || examsError || assignmentsError).message, "error");
    return;
  }

  const allEvents = [
    ...events.map(e => ({ ...e, type: 'event' })),
    ...lessons.map(l => ({ ...l, type: 'lesson' })),
    ...exams.map(e => ({ ...e, type: 'exam' })),
    ...assignments.map(a => ({ ...a, type: 'assignment' }))
  ];

  renderCalendar(allEvents);
}

function renderCalendar(events) {
  const calendarBody = document.getElementById("calendar-body");
  calendarBody.innerHTML = "";

  const today = new Date();
  const currentMonth = calendarDate.getMonth();
  const currentYear = calendarDate.getFullYear();

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

  document.getElementById("current-month-year").textContent = 
    `${firstDayOfMonth.toLocaleString("pt-BR", { month: "long" })} ${currentYear}`;

  let date = 1;
  for (let i = 0; i < 6; i++) {
    const row = document.createElement("tr");
    for (let j = 0; j < 7; j++) {
      if (i === 0 && j < firstDayOfMonth.getDay()) {
        // Empty cells before the first day of the month
        const cell = document.createElement("td");
        row.appendChild(cell);
      } else if (date > lastDayOfMonth.getDate()) {
        // Empty cells after the last day of the month
        const cell = document.createElement("td");
        row.appendChild(cell);
      } else {
        const cell = document.createElement("td");
        cell.textContent = date;
        const currentDate = new Date(currentYear, currentMonth, date);

        if (currentDate.toDateString() === today.toDateString()) {
          cell.classList.add("today");
        }

        // Add events to calendar cells
        const dayEvents = events.filter(event => {
          const eventDate = new Date(event.date);
          return eventDate.getDate() === date &&
                 eventDate.getMonth() === currentMonth &&
                 eventDate.getFullYear() === currentYear;
        });

        if (dayEvents.length > 0) {
          const eventList = document.createElement("ul");
          eventList.className = "calendar-events";
          dayEvents.forEach(event => {
            const eventItem = document.createElement("li");
            eventItem.textContent = event.title;
            eventItem.classList.add(`event-${event.type}`);
            eventList.appendChild(eventItem);
          });
          cell.appendChild(eventList);
        }

        row.appendChild(cell);
        date++;
      }
    }
    calendarBody.appendChild(row);
  }
}

function previousMonth() {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  loadCalendar();
}

function nextMonth() {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  loadCalendar();
}

function showAddEventModal() {
  document.getElementById("event-title").value = "";
  document.getElementById("event-date").value = new Date().toISOString().split("T")[0];
  document.getElementById("event-id").value = "";
  showModal("event-modal");
}

async function saveEvent() {
  const title = document.getElementById("event-title").value;
  const date = document.getElementById("event-date").value;
  const id = document.getElementById("event-id").value;

  if (!title || !date) {
    showToast("Título e data do evento não podem ser vazios.", "error");
    return;
  }

  showLoading("Salvando evento...");
  let error;
  if (id) {
    // Update
    ({ error } = await getSupabase()
      .from("events")
      .update({ title, date })
      .eq("id", id));
  } else {
    // Insert
    ({ error } = await getSupabase()
      .from("events")
      .insert([{ title, date, user_id: currentUser.id }]));
  }

  hideLoading();
  if (error) {
    showToast(error.message, "error");
  } else {
    closeModal("event-modal");
    showToast("Evento salvo com sucesso!", "success");
    loadCalendar();
  }
}

async function editEvent(id, title, date) {
  document.getElementById("event-title").value = title;
  document.getElementById("event-date").value = date.split("T")[0];
  document.getElementById("event-id").value = id;
  showModal("event-modal");
}

async function deleteEvent(id) {
  if (!confirm("Tem certeza que deseja excluir este evento?")) {
    return;
  }

  showLoading("Excluindo evento...");
  const { error } = await getSupabase().from("events").delete().eq("id", id);
  hideLoading();
  if (error) {
    showToast(error.message, "error");
  } else {
    showToast("Evento excluído com sucesso!", "success");
    loadCalendar();
  }
}

// ===================================
// NAVIGATION FUNCTIONS
// ===================================
function showSection(sectionId) {
  const sections = document.querySelectorAll(".content-section");
  sections.forEach(section => {
    section.style.display = "none";
  });
  document.getElementById(sectionId).style.display = "block";

  const navItems = document.querySelectorAll(".sidebar-nav-item");
  navItems.forEach(item => {
    item.classList.remove("active");
  });
  document.querySelector(`.sidebar-nav-item[onclick*=\'${sectionId}\']`).classList.add("active");

  // Close sidebar on mobile after navigation
  if (window.innerWidth <= 768) {
    toggleSidebar();
  }
}

// Initial section load
showSection("dashboard-section");
