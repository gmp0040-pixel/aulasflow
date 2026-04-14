require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'aulaflow-secret-2024';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new Database(path.join(__dirname, 'aulaflow.db'));

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    research TEXT,
    structure TEXT,
    slides TEXT,
    notes TEXT,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    registration TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS subject_students (
    subject_id INTEGER,
    student_id INTEGER,
    PRIMARY KEY (subject_id, student_id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    FOREIGN KEY (student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'present',
    date DATE NOT NULL,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id),
    FOREIGN KEY (student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    activity TEXT NOT NULL,
    grade REAL NOT NULL,
    max_grade REAL DEFAULT 10,
    date DATE NOT NULL,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  );

  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    difficulty TEXT DEFAULT 'medium',
    question_type TEXT DEFAULT 'multiple',
    question_count INTEGER DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'research',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
  );

  CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    type TEXT DEFAULT 'event',
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// OpenAI helper
async function callOpenAI(systemPrompt, userPrompt, maxTokens = 2000) {
  if (!OPENAI_API_KEY) {
    return generateMockResponse(userPrompt);
  }
  
const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`
  },
  body: JSON.stringify({
    model: 'llama-3.3-70b-versatile',
messages: [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userPrompt }
],
max_tokens: maxTokens,
temperature: 0.5,
frequency_penalty: 1.0,
presence_penalty: 0.6
  })
});

const data = await response.json();
return data.choices?.[0]?.message?.content || 'Erro ao gerar conteúdo';
}

function generateMockResponse(prompt) {
  return `[Modo Demo - Configure OPENAI_API_KEY para IA real]\n\nConteúdo gerado para: "${prompt.substring(0, 100)}..."\n\nEste é um exemplo de resposta. Com a chave da OpenAI configurada, a IA gerará conteúdo real e detalhado.`;
}

// =====================
// AUTH ROUTES
// =====================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
    const result = stmt.run(name, email, hashed);
    const token = jwt.sign({ id: result.lastInsertRowid, name, email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: result.lastInsertRowid, name, email } });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email já cadastrado' });
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// SUBJECTS ROUTES
// =====================
app.get('/api/subjects', authMiddleware, (req, res) => {
  const subjects = db.prepare('SELECT * FROM subjects WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(subjects);
});

app.post('/api/subjects', authMiddleware, (req, res) => {
  const { name, description, color } = req.body;
  const result = db.prepare('INSERT INTO subjects (user_id, name, description, color) VALUES (?, ?, ?, ?)').run(req.user.id, name, description, color || '#6366f1');
  res.json({ id: result.lastInsertRowid, name, description, color });
});

app.put('/api/subjects/:id', authMiddleware, (req, res) => {
  const { name, description, color } = req.body;
  db.prepare('UPDATE subjects SET name=?, description=?, color=? WHERE id=? AND user_id=?').run(name, description, color, req.params.id, req.user.id);
  res.json({ success: true });
});

app.delete('/api/subjects/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM subjects WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// =====================
// LESSONS ROUTES
// =====================
app.get('/api/subjects/:subjectId/lessons', authMiddleware, (req, res) => {
  const lessons = db.prepare('SELECT * FROM lessons WHERE subject_id = ? ORDER BY created_at DESC').all(req.params.subjectId);
  res.json(lessons);
});

app.post('/api/subjects/:subjectId/lessons', authMiddleware, (req, res) => {
  const { title } = req.body;
  const result = db.prepare('INSERT INTO lessons (subject_id, title) VALUES (?, ?)').run(req.params.subjectId, title);
  res.json({ id: result.lastInsertRowid, title, subject_id: req.params.subjectId });
});

app.put('/api/lessons/:id', authMiddleware, (req, res) => {
  const { title, research, structure, slides, notes, status } = req.body;
  db.prepare('UPDATE lessons SET title=?, research=?, structure=?, slides=?, notes=?, status=? WHERE id=?')
    .run(title, research, structure, slides, notes, status, req.params.id);
  res.json({ success: true });
});

app.delete('/api/lessons/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM lessons WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// =====================
// AI ROUTES
// =====================
app.post('/api/ai/research', authMiddleware, async (req, res) => {
  try {
    const { topic, subject } = req.body;
    const content = await callOpenAI(
      'Você é um especialista pedagógico. Gere conteúdo educacional completo, detalhado e bem estruturado em português brasileiro.',
      `Faça uma pesquisa completa e detalhada sobre o tópico: "${topic}" para a matéria de ${subject}. Inclua: introdução, desenvolvimento com subtópicos, exemplos práticos, curiosidades e conclusão. Formate em Markdown.`,
      3000
    );
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/structure', authMiddleware, async (req, res) => {
  try {
    const { topic, research } = req.body;
    const content = await callOpenAI(
      'Você é um especialista em pedagogia e estruturação de aulas. Responda em português brasileiro.',
      `Com base nesta pesquisa:\n\n${research?.substring(0, 2000)}\n\nCrie uma estrutura de aula para o tópico "${topic}" com:\n- Objetivos de aprendizagem\n- Tópicos principais (5-8 tópicos)\n- Subtópicos para cada tópico\n- Atividades sugeridas\n- Tempo estimado por tópico\n\nFormate em Markdown.`,
      2000
    );
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/slides', authMiddleware, async (req, res) => {
  try {
    const { topic, structure, research } = req.body;
    const content = await callOpenAI(
      'Você é especialista em criação de slides educacionais. Responda APENAS com JSON válido, sem markdown.',
      `Crie slides para a aula sobre "${topic}". Use esta estrutura:\n${structure?.substring(0, 1500)}\n\nRetorne um JSON com este formato exato:\n{"slides": [{"title": "título", "content": ["ponto 1", "ponto 2", "ponto 3"], "type": "intro|content|example|conclusion"}]}\n\nCrie entre 8 e 12 slides. Cada slide deve ter no máximo 5 pontos curtos.`,
      2500
    );
    
    let slides;
    try {
      const clean = content.replace(/```json|```/g, '').trim();
      slides = JSON.parse(clean);
    } catch {
      slides = { slides: [{ title: topic, content: ['Conteúdo será carregado', 'Configure a OpenAI API'], type: 'intro' }] };
    }
    res.json(slides);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/notes', authMiddleware, async (req, res) => {
  try {
    const { topic, slides, detail } = req.body;
    const detailInst = detail === 'detailed' ? 'muito detalhadas com exemplos' : detail === 'summary' ? 'breves e objetivas' : 'moderadas';
    const content = await callOpenAI(
      'Você é um especialista pedagógico criando anotações para professores. Responda em português brasileiro.',
      `Crie anotações de professor ${detailInst} para a aula sobre "${topic}".\nBaseado nos slides:\n${JSON.stringify(slides)?.substring(0, 1500)}\n\nPara cada slide, crie anotações com dicas de como apresentar, pontos importantes, perguntas para engajar alunos. Formate em Markdown.`,
      2000
    );
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/exam', authMiddleware, async (req, res) => {
  try {
    const { subjectId, count, type, difficulty } = req.body;
    
    const lessons = db.prepare('SELECT title, research, structure FROM lessons WHERE subject_id = ? AND status = "saved"').all(subjectId);
    const context = lessons.map(l => `Aula: ${l.title}\n${l.research?.substring(0, 500) || ''}`).join('\n\n');
    
    const typeInstructions = {
      multiple: 'múltipla escolha (4 alternativas, indique a correta)',
      essay: 'dissertativas (sem gabarito)',
      truefalse: 'verdadeiro ou falso (indique a resposta)'
    };
    
    const content = await callOpenAI(
      'Você é professor criando avaliações. Responda APENAS com JSON válido, sem markdown.',
      `Crie uma prova com ${count} questões de ${typeInstructions[type] || 'múltipla escolha'}, nível ${difficulty} (fácil/médio/difícil), baseada nas aulas:\n\n${context.substring(0, 2000)}\n\nRetorne JSON:\n{"title": "título da prova", "questions": [{"number": 1, "question": "texto", "options": ["A) opt1", "B) opt2", "C) opt3", "D) opt4"], "answer": "A", "type": "${type}"}]}`,
      3000
    );
    
    let exam;
    try {
      const clean = content.replace(/```json|```/g, '').trim();
      exam = JSON.parse(clean);
    } catch {
      exam = { title: 'Prova Gerada', questions: [{ number: 1, question: 'Configure a API da OpenAI para gerar questões reais', options: ['A) Opção 1', 'B) Opção 2'], answer: 'A', type }] };
    }
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/assignment', authMiddleware, async (req, res) => {
  try {
    const { subjectId } = req.body;
    const lessons = db.prepare('SELECT title, research FROM lessons WHERE subject_id = ? AND status = "saved"').all(subjectId);
    const context = lessons.map(l => `Aula: ${l.title}`).join(', ');
    
    const content = await callOpenAI(
      'Você é professor criando propostas de trabalho. Responda APENAS com JSON válido, sem markdown.',
      `Crie 4 propostas de trabalho para as aulas sobre: ${context}.\n\nRetorne JSON:\n{"assignments": [{"title": "título", "type": "pesquisa|texto|apresentação|estudo|prático", "description": "descrição detalhada", "objectives": ["obj1", "obj2"], "deadline": "X semanas", "criteria": "critérios de avaliação"}]}`,
      2000
    );
    
    let assignments;
    try {
      const clean = content.replace(/```json|```/g, '').trim();
      assignments = JSON.parse(clean);
    } catch {
      assignments = { assignments: [{ title: 'Trabalho de Pesquisa', type: 'pesquisa', description: 'Configure a API para gerar trabalhos', objectives: ['Pesquisar'], deadline: '2 semanas', criteria: 'Critérios' }] };
    }
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// EXAMS ROUTES
// =====================
app.get('/api/subjects/:subjectId/exams', authMiddleware, (req, res) => {
  const exams = db.prepare('SELECT * FROM exams WHERE subject_id = ? ORDER BY created_at DESC').all(req.params.subjectId);
  res.json(exams);
});

app.post('/api/subjects/:subjectId/exams', authMiddleware, (req, res) => {
  const { title, content, difficulty, question_type, question_count } = req.body;
  const result = db.prepare('INSERT INTO exams (subject_id, title, content, difficulty, question_type, question_count) VALUES (?, ?, ?, ?, ?, ?)').run(req.params.subjectId, title, content, difficulty, question_type, question_count);
  res.json({ id: result.lastInsertRowid });
});

app.delete('/api/exams/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM exams WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// =====================
// ASSIGNMENTS ROUTES
// =====================
app.get('/api/subjects/:subjectId/assignments', authMiddleware, (req, res) => {
  const assignments = db.prepare('SELECT * FROM assignments WHERE subject_id = ? ORDER BY created_at DESC').all(req.params.subjectId);
  res.json(assignments);
});

app.post('/api/subjects/:subjectId/assignments', authMiddleware, (req, res) => {
  const { title, content, type } = req.body;
  const result = db.prepare('INSERT INTO assignments (subject_id, title, content, type) VALUES (?, ?, ?, ?)').run(req.params.subjectId, title, content, type);
  res.json({ id: result.lastInsertRowid });
});

app.delete('/api/assignments/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM assignments WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// =====================
// STUDENTS ROUTES
// =====================
app.get('/api/students', authMiddleware, (req, res) => {
  const students = db.prepare('SELECT * FROM students WHERE user_id = ? ORDER BY name').all(req.user.id);
  res.json(students);
});

app.post('/api/students', authMiddleware, (req, res) => {
  const { name, email, registration } = req.body;
  const result = db.prepare('INSERT INTO students (user_id, name, email, registration) VALUES (?, ?, ?, ?)').run(req.user.id, name, email, registration);
  res.json({ id: result.lastInsertRowid, name, email, registration });
});

app.delete('/api/students/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM students WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

app.get('/api/subjects/:subjectId/students', authMiddleware, (req, res) => {
  const students = db.prepare(`
    SELECT s.* FROM students s
    JOIN subject_students ss ON s.id = ss.student_id
    WHERE ss.subject_id = ? ORDER BY s.name
  `).all(req.params.subjectId);
  res.json(students);
});

app.post('/api/subjects/:subjectId/students', authMiddleware, (req, res) => {
  const { student_id } = req.body;
  db.prepare('INSERT OR IGNORE INTO subject_students (subject_id, student_id) VALUES (?, ?)').run(req.params.subjectId, student_id);
  res.json({ success: true });
});

// =====================
// ATTENDANCE ROUTES
// =====================
app.get('/api/lessons/:lessonId/attendance', authMiddleware, (req, res) => {
  const attendance = db.prepare(`
    SELECT a.*, s.name as student_name FROM attendance a
    JOIN students s ON a.student_id = s.id
    WHERE a.lesson_id = ?
  `).all(req.params.lessonId);
  res.json(attendance);
});

app.post('/api/lessons/:lessonId/attendance', authMiddleware, (req, res) => {
  const { student_id, status, date } = req.body;
  db.prepare('INSERT OR REPLACE INTO attendance (lesson_id, student_id, status, date) VALUES (?, ?, ?, ?)').run(req.params.lessonId, student_id, status, date);
  res.json({ success: true });
});

// =====================
// GRADES ROUTES
// =====================
app.get('/api/subjects/:subjectId/grades', authMiddleware, (req, res) => {
  const grades = db.prepare(`
    SELECT g.*, s.name as student_name FROM grades g
    JOIN students s ON g.student_id = s.id
    WHERE g.subject_id = ? ORDER BY g.date DESC
  `).all(req.params.subjectId);
  res.json(grades);
});

app.post('/api/subjects/:subjectId/grades', authMiddleware, (req, res) => {
  const { student_id, activity, grade, max_grade, date } = req.body;
  const result = db.prepare('INSERT INTO grades (student_id, subject_id, activity, grade, max_grade, date) VALUES (?, ?, ?, ?, ?, ?)').run(student_id, req.params.subjectId, activity, grade, max_grade || 10, date);
  res.json({ id: result.lastInsertRowid });
});

// =====================
// CALENDAR ROUTES
// =====================
app.get('/api/calendar', authMiddleware, (req, res) => {
  const events = db.prepare('SELECT * FROM calendar_events WHERE user_id = ? ORDER BY date').all(req.user.id);
  res.json(events);
});

app.post('/api/calendar', authMiddleware, (req, res) => {
  const { title, description, date, type } = req.body;
  const result = db.prepare('INSERT INTO calendar_events (user_id, title, description, date, type) VALUES (?, ?, ?, ?, ?)').run(req.user.id, title, description, date, type);
  res.json({ id: result.lastInsertRowid });
});

app.delete('/api/calendar/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM calendar_events WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// =====================
// REPORTS
// =====================
app.get('/api/reports/attendance/:subjectId', authMiddleware, (req, res) => {
  const report = db.prepare(`
    SELECT s.name, 
      COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present,
      COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent,
      COUNT(CASE WHEN a.status = 'justified' THEN 1 END) as justified,
      COUNT(a.id) as total
    FROM students s
    JOIN subject_students ss ON s.id = ss.student_id
    LEFT JOIN attendance a ON a.student_id = s.id AND a.lesson_id IN (
      SELECT id FROM lessons WHERE subject_id = ?
    )
    WHERE ss.subject_id = ?
    GROUP BY s.id, s.name
    ORDER BY s.name
  `).all(req.params.subjectId, req.params.subjectId);
  res.json(report);
});

app.get('/api/reports/grades/:subjectId', authMiddleware, (req, res) => {
  const report = db.prepare(`
    SELECT s.name,
      AVG(g.grade / g.max_grade * 10) as average,
      COUNT(g.id) as activities,
      MIN(g.grade / g.max_grade * 10) as min_grade,
      MAX(g.grade / g.max_grade * 10) as max_grade
    FROM students s
    JOIN subject_students ss ON s.id = ss.student_id
    LEFT JOIN grades g ON g.student_id = s.id AND g.subject_id = ?
    WHERE ss.subject_id = ?
    GROUP BY s.id, s.name
    ORDER BY s.name
  `).all(req.params.subjectId, req.params.subjectId);
  res.json(report);
});

app.post('/api/ai/research', authMiddleware, async (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ error: 'Tema obrigatório' });
  const systemPrompt = `Você é um professor especialista. Crie uma pesquisa completa e profunda sobre o tema. Use Markdown. Estruture com: # Título, ## Introdução, ## Conceitos Fundamentais, ## Tópicos Principais, ### Subtópicos, ## Aplicações Práticas. Mínimo 800 palavras. Responda em Português.`;
  const userPrompt = `Faça uma pesquisa completa e aprofundada sobre: "${topic}"`;
  try {
    const content = await callOpenAI(systemPrompt, userPrompt, 3000);
    const notesPrompt = `Com base nesta pesquisa sobre "${topic}", crie anotações do professor com: pontos importantes, sugestões de fala, perguntas para alunos, dicas pedagógicas. Use Markdown.`;
    const notes = await callOpenAI('Você é um pedagogo experiente.', notesPrompt, 1500);
    res.json({ content, notes });
  } catch (err) {
    res.status(500).json({ error: 'Erro: ' + err.message });
  }
});

app.post('/api/ai/notes', authMiddleware, async (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ error: 'Conteúdo obrigatório' });
  try {
    const notes = await callOpenAI('Você é um pedagogo experiente.', `Crie anotações do professor para: ${topic.substring(0, 2000)}`, 1500);
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/slides', authMiddleware, async (req, res) => {
  const { content, count = 8, style = 'modern' } = req.body;
  if (!content) return res.status(400).json({ error: 'Conteúdo obrigatório' });
  const systemPrompt = `Você cria slides educacionais em JSON. Responda APENAS com JSON válido, sem texto antes ou depois.`;
  const userPrompt = `Crie ${count} slides baseados neste conteúdo:\n${content.substring(0, 3000)}\n\nResponda APENAS com este JSON:\n{"slides":[{"type":"intro","title":"Título","subtitle":"Subtítulo","points":["ponto 1","ponto 2"]}]}`;
  try {
    const raw = await callOpenAI(systemPrompt, userPrompt, 2000);
    const clean = raw.replace(/\`\`\`json|\`\`\`/g, '').trim();
    const parsed = JSON.parse(clean);
    res.json(parsed);
  } catch (err) {
    res.json({ slides: [{ type: 'intro', title: 'Apresentação', subtitle: 'Conteúdo com IA', points: [] }] });
  }
});

app.get('/api/lessons/:id', authMiddleware, (req, res) => {
  try {
    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Aula não encontrada' });
    res.json(lesson);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lessons/:id/study', authMiddleware, (req, res) => {
  const { research, notes, slides } = req.body;
  try {
    db.prepare('UPDATE lessons SET research = ?, notes = ?, slides = ? WHERE id = ?').run(research, notes, slides, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 AulaFlow rodando em http://localhost:${PORT}`);
  console.log(`📚 API disponível em http://localhost:${PORT}/api`);
  if (!OPENAI_API_KEY) console.log('⚠️  Configure OPENAI_API_KEY para IA real');
});

