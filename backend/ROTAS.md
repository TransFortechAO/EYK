# EYK — Documentação de Rotas

Atualizado em: Agosto 2026
Arquitetura: **2 apps separadas** — API REST em Django 5.x (`backend/`) + frontend em Next.js (`frontend/`)

---

## Arquitetura

O backend Django **não renderiza HTML** (templates foram removidos — commit `96aaf55`). Serve apenas:

- **API JSON** consumida pelo frontend Next.js (`fetch` com `credentials: 'include'`, autenticação por cookie de sessão + CSRF).
- Ficheiros de **media** (`/media/...`) e o **Django Admin** (`/admin/...`).

Qualquer rota que não seja `admin/`, `accounts/`, `api/`, `aluno/`, `media/`, `static/` ou `health/` é redirecionada (302) para o frontend Next.js (`config/urls.py`, `redirect_to_next`), configurável via `NEXT_PUBLIC_URL` (default `http://localhost:3000`). Ou seja, a UI vive inteiramente no Next.js — o Django só existe como API.

| App | Porta (dev) | Base URL (dev) |
|-----|-------------|-----------------|
| Backend (Django) | 8000 | `http://localhost:8000` |
| Frontend (Next.js) | 3000 | `http://localhost:3000` |

O cliente da API no frontend está em [`frontend/app/lib/api.ts`](../frontend/app/lib/api.ts), com `NEXT_PUBLIC_API_URL` a apontar para o backend.

---

## Frontend — Rotas (Next.js `app/`)

Controlo de acesso feito em [`components/providers.tsx`](../frontend/app/components/providers.tsx): rotas fora de `ROTAS_PUBLICAS` passam por `AuthGate` (sem sessão → redireciona para `/login`); páginas de administração fazem também uma verificação client-side de `user.isStaff`.

| Rota | Acesso | Descrição |
|------|--------|-----------|
| `/` | Pública | Landing page |
| `/login` | Pública | Login (com suporte a 2FA) |
| `/register` | Pública | Registo de novo aluno |
| `/personalizar-perfil` | Autenticada (sem sidebar/topbar) | Onboarding pós-registo: foto + bio do aluno |
| `/inicio` | Autenticada | Dashboard/feed principal |
| `/cursos` | Autenticada | Listagem de cursos |
| `/videos` | Autenticada | Listagem de vídeos |
| `/biblioteca` | Autenticada | Biblioteca de conteúdos |
| `/comunidade` | Autenticada | Feed social (posts, comentários, reações) |
| `/notificacoes` | Autenticada | Notificações do utilizador |
| `/gamificacao` | Autenticada | Painel de gamificação (moedas, streak, badges) |
| `/leaderboard` | Autenticada | Ranking de alunos |
| `/configuracoes` | Autenticada | Preferências, segurança (2FA, senha), apagar conta |
| `/configuracoes/administracao/utilizadores` | Staff | Gestão de utilizadores |
| `/configuracoes/administracao/professores` | Staff | Registo/gestão de professores |
| `/professor` | Professor | Dashboard do professor |
| `/professor/cursos` | Professor | Cursos do professor |
| `/professor/cursos/[id]` | Professor | Detalhe/edição de um curso |
| `/professor/videos` | Professor | Vídeos do professor |
| `/professor/videos/[id]` | Professor | Detalhe/edição de um vídeo |

> ⚠️ Não existem rotas `/accounts/...` nem `/accounts/dashboard/professores` no frontend — essas eram páginas Django antigas (ver secção histórica no fim deste documento).

---

## Backend — API (Django)

### `accounts/` — Autenticação (JSON, usado pelo Next.js)

| Método | URL | Nome | Descrição |
|--------|-----|------|-----------|
| GET | `/accounts/auth/csrf/` | `accounts:auth-csrf` | Devolve o token CSRF |
| POST | `/accounts/auth/register/` | `accounts:auth-register-json` | Regista novo aluno e autentica a sessão |
| POST | `/accounts/auth/login/` | `accounts:auth-login-json` | Login (pode devolver `requires2fa: true`) |
| POST | `/accounts/auth/verificar-2fa/` | `accounts:auth-verificar-2fa-json` | Confirma código 2FA e completa o login |
| POST | `/accounts/auth/logout/` | `accounts:auth-logout-json` | Termina a sessão |
| GET | `/accounts/auth/me/` | `accounts:auth-me` | Utilizador autenticado (ou `authenticated: false`) |

### `accounts/api/` — Onboarding, preferências e segurança

| Método | URL | Nome | Descrição |
|--------|-----|------|-----------|
| POST | `/accounts/api/perfil/completar/` | `accounts:api-perfil-completar` | Marca `perfil_completo=True` (fim do onboarding) |
| POST | `/accounts/api/preferencias/` | `accounts:api-preferencias-atualizar` | Tema preferido + preferências de notificação por email |
| POST | `/accounts/api/seguranca/alterar-senha/` | `accounts:api-alterar-senha` | Alterar palavra-passe |
| GET | `/accounts/api/seguranca/2fa/status/` | `accounts:api-2fa-status` | Estado do 2FA |
| POST | `/accounts/api/seguranca/2fa/iniciar/` | `accounts:api-2fa-iniciar` | Inicia setup do 2FA (QR code) |
| POST | `/accounts/api/seguranca/2fa/confirmar/` | `accounts:api-2fa-confirmar` | Confirma código e ativa o 2FA |
| POST | `/accounts/api/seguranca/2fa/desativar/` | `accounts:api-2fa-desativar-json` | Desativa o 2FA |

### `accounts/api/admin/` — Administração (exige `is_staff`)

| Método | URL | Nome | Descrição |
|--------|-----|------|-----------|
| GET | `/accounts/api/admin/professores/` | `accounts:api-admin-listar-professores` | Lista professores |
| POST | `/accounts/api/admin/professores/criar/` | `accounts:api-admin-registar-professor` | Regista um novo professor |
| GET | `/accounts/api/admin/utilizadores/` | `accounts:api-admin-listar-utilizadores` | Lista utilizadores (filtros `q`, `tipo`) |
| POST | `/accounts/api/admin/utilizadores/<id>/toggle/` | `accounts:api-admin-toggle-ativo-usuario` | Ativa/desativa um utilizador |
| POST | `/accounts/api/admin/utilizadores/<id>/apagar/` | `accounts:api-admin-apagar-usuario` | Apaga um utilizador |

### `aluno/api/` — Perfil do aluno

| Método | URL | Nome | Descrição |
|--------|-----|------|-----------|
| GET | `/aluno/api/perfil/` | `aluno:api-perfil-get` | Bio, foto e estado do 2FA do aluno |
| POST | `/aluno/api/perfil/atualizar/` | `aluno:api-perfil-atualizar` | Atualiza bio/foto (JSON ou multipart) |
| POST | `/aluno/api/apagar-conta/` | `aluno:api-apagar-conta` | Apaga a conta do aluno autenticado |

### `api/` — Cursos, vídeos, comunidade, notificações, gamificação

| Método | URL | Nome | Descrição |
|--------|-----|------|-----------|
| GET | `/api/usuario/` | `usuario-atual` | Utilizador atual (legado) |
| GET | `/api/categorias/` | `categoria-list` | Categorias de cursos |
| GET | `/api/cursos/` | `cursos-list` | Lista de cursos (`DefaultRouter`) |
| GET | `/api/cursos/<id>/` | `cursos-detail` | Detalhe de um curso |
| POST | `/api/cursos/<id>/inscrever/` | `curso-inscrever` | Inscrever-se num curso |
| GET | `/api/videos/` | `video-list` | Lista de vídeos (`?tab=recent\|popular\|short`) |
| GET | `/api/videos/<id>/` | `video-detail` | Detalhe de um vídeo |
| POST | `/api/videos/<id>/reagir/` | `video-react` | Like/dislike num vídeo |
| POST | `/api/professores/<id>/seguir/` | `api-professor-seguir` | Seguir/deixar de seguir um professor |
| GET | `/api/comunidade/posts/` | `api-post-list` | Feed de posts |
| POST | `/api/comunidade/posts/<id>/reagir/` | `api-post-react` | Reagir a um post |
| GET/POST | `/api/comunidade/posts/<id>/comentarios/` | `api-comentario-list` | Listar/criar comentários |
| GET | `/api/notificacoes/` | `notificacao-list` | Notificações do utilizador |
| POST | `/api/notificacoes/<id>/marcar-lida/` | `notificacao-marcar-lida` | Marcar notificação como lida |
| GET | `/api/gamificacao/` | `gamificacao-painel` | Moedas, streak, nível |
| GET | `/api/leaderboard/` | `leaderboard-list` | Ranking de alunos |
| GET | `/api/badges/` | `badges-list` | Badges/conquistas |
| GET | `/api/carteira/` | `carteira-historico` | Histórico de transações de moedas |

### `api/professor/` — Dashboard do professor (exige `is_teacher`)

| Método | URL | Nome | Descrição |
|--------|-----|------|-----------|
| GET/PATCH | `/api/professor/perfil/` | `api-professor-perfil` | Perfil público do professor |
| POST | `/api/professor/apagar-conta/` | `api-professor-apagar-conta` | Apaga a conta do professor |
| GET/POST | `/api/professor/cursos/` | `api-professor-cursos` | Listar/criar cursos |
| GET/PATCH/DELETE | `/api/professor/cursos/<id>/` | `api-professor-curso-detail` | Ver/editar/apagar um curso |
| GET | `/api/professor/cursos/<id>/engajamento/` | `api-professor-curso-engajamento` | Estatísticas de um curso |
| GET/POST | `/api/professor/videos/` | `api-professor-videos` | Listar/criar vídeos |
| POST | `/api/professor/videos/reordenar/` | `api-professor-videos-reordenar` | Reordenar vídeos |
| GET/PATCH/DELETE | `/api/professor/videos/<id>/` | `api-professor-video-detail` | Ver/editar/apagar um vídeo |
| GET | `/api/professor/videos/<id>/engajamento/` | `api-professor-video-engajamento` | Estatísticas de um vídeo |

### Outras

| Método | URL | Nome | Descrição |
|--------|-----|------|-----------|
| `*` | `/admin/` | `admin:index` | Django Admin |
| GET | `/health/` | `health_check` | Health check |
| GET | `/media/...` | — | Ficheiros enviados (fotos de perfil, etc.) |

---

## Nota histórica

Até Abril de 2026 o backend também renderizava HTML diretamente (rotas como `/accounts/login/`, `/accounts/dashboard/professores/`, templates em `accounts/templates/`, `professores/templates/`, `feed/templates/`). Essa camada foi **completamente removida** no commit `96aaf55` ("Remove toda a renderização de templates HTML do backend Django"), quando o projeto passou a ter frontend e backend como aplicações separadas (commit `c5db316`). Qualquer link ou bookmark antigo para essas rotas resulta em 404 — usar as rotas do Next.js documentadas acima.
