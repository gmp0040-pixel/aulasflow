# 📚 AulaFlow — Sistema Inteligente para Professores

Sistema completo para professores com IA integrada, PWA instalável, gestão acadêmica e modo apresentação.

---

## 🚀 Instalação Rápida

### Pré-requisitos
- Node.js 18+ ([nodejs.org](https://nodejs.org))
- Chave da API OpenAI ([platform.openai.com](https://platform.openai.com))

### Passo a Passo

```bash
# 1. Entrar na pasta do projeto
cd aulaflow

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
# Crie um arquivo .env na raiz:
echo "OPENAI_API_KEY=sua-chave-aqui" > .env
echo "PORT=3000" >> .env
echo "JWT_SECRET=meu-segredo-seguro-2024" >> .env

# 4. Iniciar o servidor
npm start

# 5. Abrir no navegador
# http://localhost:3000
```

---

## 🌐 Instalar como PWA (App)

### No Computador (Chrome/Edge):
1. Abra `http://localhost:3000`
2. Clique no ícone 📥 na barra de endereço
3. Clique em "Instalar"

### No Celular (Android):
1. Abra no Chrome
2. Menu ⋮ → "Adicionar à tela inicial"

### No iPhone (Safari):
1. Abra no Safari
2. Compartilhar → "Adicionar à Tela de Início"

---

## 📁 Estrutura de Arquivos

```
aulaflow/
├── server.js          # Backend Node.js + Express
├── package.json       # Dependências
├── aulaflow.db        # Banco SQLite (criado automaticamente)
├── README.md          # Este arquivo
└── public/
    ├── index.html     # Interface do app
    ├── style.css      # Estilos
    ├── script.js      # Lógica frontend
    ├── manifest.json  # PWA manifest
    └── service-worker.js  # Cache offline
```

---

## 🔑 Variáveis de Ambiente

Crie um arquivo `.env` na raiz:

```env
OPENAI_API_KEY=sk-proj-xxxxx    # Chave da API OpenAI (obrigatório para IA)
PORT=3000                        # Porta do servidor
JWT_SECRET=seu-segredo-aqui      # Segredo para tokens JWT
```

> **Sem OPENAI_API_KEY:** O app funciona em modo demo, retornando respostas simuladas.

---

## 📱 Funcionalidades

### 📚 Matérias
- Criar, editar e excluir matérias
- Cores personalizadas
- Botões rápidos para gerar provas e trabalhos

### 📖 Aulas com IA (6 etapas)
1. **Pesquisa Completa** — IA pesquisa e gera conteúdo detalhado
2. **Estruturar Aula** — Cria tópicos e subtópicos
3. **Ajustar Conteúdo** — Editor manual + IA para expandir/reduzir
4. **Criar Slides** — Slides organizados automaticamente
5. **Anotações do Professor** — 3 níveis: resumido, moderado, detalhado
6. **Salvar** — Armazena tudo vinculado à matéria

### 🧪 Gerador de Provas
- Analisa TODAS as aulas salvas da matéria
- Configurações: quantidade, tipo, dificuldade
- Tipos: múltipla escolha, dissertativa, verdadeiro/falso
- Botão "Gerar Novamente"
- Exportar PDF pronto para impressão
- Seção "Provas Salvas" por matéria

### 📄 Gerador de Trabalhos
- 4 sugestões diferentes por geração
- Tipos: pesquisa, texto, apresentação, estudo dirigido, prático
- Selecionar e salvar a melhor opção
- Exportar PDF

### 📡 Modo Apresentação
- Slides em tela cheia
- Painel lateral de anotações (professor vê, aluno não)
- Controles por botão e teclado (← → Espaço Esc)
- Barra de progresso

### 👨‍🎓 Gestão de Alunos
- Cadastro com nome, email e matrícula
- Vincular alunos a matérias
- Chamada com 3 estados: presente, falta, justificado

### 📊 Notas
- Lançar notas por matéria
- Histórico de atividades
- Percentual de aproveitamento

### 📅 Calendário
- Eventos, provas, trabalhos, feriados
- Navegação por mês

### 📈 Relatórios
- Frequência com barra visual
- Desempenho médio por aluno
- Exportar PDF

---

## 🛠️ API Endpoints

### Autenticação
- `POST /api/auth/register` — Cadastro
- `POST /api/auth/login` — Login

### Matérias
- `GET /api/subjects` — Listar
- `POST /api/subjects` — Criar
- `PUT /api/subjects/:id` — Editar
- `DELETE /api/subjects/:id` — Excluir

### Aulas
- `GET /api/subjects/:id/lessons` — Listar
- `POST /api/subjects/:id/lessons` — Criar
- `PUT /api/lessons/:id` — Salvar dados
- `DELETE /api/lessons/:id` — Excluir

### IA
- `POST /api/ai/research` — Pesquisa
- `POST /api/ai/structure` — Estrutura
- `POST /api/ai/slides` — Slides
- `POST /api/ai/notes` — Anotações
- `POST /api/ai/exam` — Gerar prova
- `POST /api/ai/assignment` — Gerar trabalhos

### Outros
- `GET/POST /api/students` — Alunos
- `GET/POST /api/subjects/:id/grades` — Notas
- `GET/POST /api/lessons/:id/attendance` — Chamada
- `GET/POST /api/calendar` — Eventos

---

## 🔧 Modo Desenvolvimento

```bash
# Com hot-reload
npm run dev

# O servidor reinicia automaticamente ao editar arquivos
```

---

## 🌐 Deploy em Produção

### Railway / Render / Fly.io

1. Faça push do projeto para um repositório Git
2. Conecte ao serviço de hospedagem
3. Configure as variáveis de ambiente
4. Deploy!

### Variáveis necessárias em produção:
- `OPENAI_API_KEY`
- `JWT_SECRET` (use uma string longa e aleatória)
- `PORT` (geralmente configurado pelo serviço)

---

## ❓ Perguntas Frequentes

**O app funciona sem internet?**
Sim, parcialmente. O frontend é cacheado pelo service worker. Mas as funcionalidades de IA precisam de internet.

**Posso usar sem a chave da OpenAI?**
Sim! O app funciona em modo demo com respostas simuladas. Mas para IA real, você precisa da chave.

**Os dados ficam onde?**
No arquivo `aulaflow.db` (SQLite) na pasta do projeto.

**Posso ter múltiplos professores?**
Sim! Cada professor cria sua conta separada. Os dados são isolados por usuário.

---

## 📞 Suporte

Este projeto foi criado com AulaFlow. Para personalizar ou expandir funcionalidades, edite os arquivos diretamente.

---

**Desenvolvido com 🤖 IA + ❤️ para professores**
