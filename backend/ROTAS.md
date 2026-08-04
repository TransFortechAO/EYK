# EYK — Documentação de Rotas

Gerado em: Abril 2026  
Framework: Django 5.x

---

## Como aplicar as alterações

```bash
python manage.py migrate
python manage.py runserver
```

---

## Rotas Existentes (não alteradas)

| Método | URL | Nome | Descrição |
|--------|-----|------|-----------|
| GET | `/` | `index` | Página inicial pública |
| GET/POST | `/accounts/login/` | `accounts:login` | Login do utilizador |
| GET/POST | `/accounts/register/` | `accounts:register` | Registo de novo aluno |
| GET | `/accounts/logout/` | `accounts:logout` | Terminar sessão |
| GET | `/professor/perfil/` | `professores:perfil` | Perfil público do professor logado |
| GET/POST | `/professor/meus-cursos/` | `professores:meus-cursos` | Lista de cursos do professor |
| GET/POST | `/professor/criar-curso/` | `professores:criar-curso` | Criar novo curso |
| GET | `/feed/` | `feed:home` | Feed principal (home após login) |
| `*` | `/api/` | — | API REST de cursos |
| `*` | `/admin/` | `admin:index` | Painel Django Admin |

---

## ✅ Novas Rotas Criadas

### Accounts — Personalização de Perfil

#### `GET/POST /accounts/completar-perfil/`
- **Nome:** `accounts:completar-perfil-aluno`
- **View:** `accounts.views.completar_perfil_aluno`
- **Acesso:** Utilizador autenticado (`@login_required`)
- **Descrição:** Página de personalização do perfil do aluno após o registo. Permite adicionar **foto** e **bio**. Ao guardar, o campo `perfil_completo` do utilizador é marcado como `True` e é redirecionado para `feed:home`.
- **Template:** `accounts/templates/accounts/completar_perfil_aluno.html`
- **Fluxo:** `register → completar-perfil-aluno → feed:home`

---

#### `GET/POST /accounts/completar-perfil-professor/`
- **Nome:** `accounts:completar-perfil-professor`
- **View:** `accounts.views.completar_perfil_professor`
- **Acesso:** Utilizador autenticado (`@login_required`) com `is_teacher=True`
- **Descrição:** Página de personalização do perfil do professor no **primeiro login**. Permite preencher **nome público**, **área de atuação**, **bio** e **foto**. Ao guardar, `perfil_completo` é marcado como `True` e é redirecionado para `feed:home`.
- **Template:** `accounts/templates/accounts/completar_perfil_professor.html`
- **Fluxo:** `login (1º acesso) → completar-perfil-professor → feed:home`

---

### Accounts — Dashboard Admin

#### `GET/POST /accounts/dashboard/professores/`
- **Nome:** `accounts:dashboard-professores`
- **View:** `accounts.admin_dashboard.registar_professor`
- **Acesso:** Apenas `staff` (`@staff_member_required`) — redireciona para `/admin/login/` se não autorizado
- **Descrição:** Dashboard exclusiva para administradores registarem professores na plataforma. Inclui formulário de registo e tabela com todos os professores existentes (foto, nome, email, área, estado do perfil e data de registo).
- **Template:** `accounts/templates/accounts/dashboard_professores.html`
- **Campos do formulário:** `username`, `email`, `password` (temporária), `nome_publico`, `area`

---

### Professores — Gestão de Cursos (adicionadas ao urlconf)

#### `GET/POST /professor/editar-curso/<int:curso_id>/`
- **Nome:** `professores:editar-curso`
- **View:** `professores.views.editar_curso`
- **Acesso:** Utilizador autenticado com perfil de professor
- **Descrição:** Editar um curso existente do professor logado. Garante que o professor só edita os seus próprios cursos.

---

#### `GET/POST /professor/deletar-curso/<int:curso_id>/`
- **Nome:** `professores:deletar-curso`
- **View:** `professores.views.deletar_curso`
- **Acesso:** Utilizador autenticado com perfil de professor
- **Descrição:** Eliminar um curso do professor logado, com página de confirmação antes da eliminação definitiva.

---

## Campos adicionados ao modelo `User`

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `perfil_completo` | `BooleanField` | `False` | Controla se o utilizador já completou a personalização do perfil. Usado no `login_view` para decidir o redirecionamento. |

> **Migração criada:** `accounts/migrations/0004_user_perfil_completo.py`

---

## Lógica de Redirecionamento no Login

```
login_view (POST)
│
├── perfil_completo = False
│   ├── is_student → /accounts/completar-perfil/
│   └── is_teacher → /accounts/completar-perfil-professor/
│
└── perfil_completo = True
    └── /feed/  (feed:home)
```

---

## Lógica de Redirecionamento no Registo

```
register_view (POST)
│
└── Registo bem-sucedido
    └── /accounts/completar-perfil/  (accounts:completar-perfil-aluno)
        └── Após guardar → /feed/
```

---

## Templates Atualizados (dados dinâmicos)

| Template | O que foi dinamizado |
|----------|---------------------|
| `feed/templates/feed/home.html` | Cursos e professores vêm do DB; navbar mostra nome/foto do utilizador logado; saudação personalizada; estados vazios com mensagem |
| `professores/templates/professores/perfil.html` | Foto, nome, área, bio, stats e cursos do professor logado; avatar gerado com inicial se sem foto |
| `professores/templates/professores/meus_cursos.html` | Lista de cursos reais; stats de inscritos; botões de editar/eliminar com URLs corretas |
| `templates/base.html` | Navbar corrigida — removidos dados estáticos (coins/streak); links condicionais por tipo de utilizador (`is_teacher`, `is_staff`); nome do utilizador logado exibido |

---

## Resumo de Ficheiros Modificados/Criados

```
accounts/
├── models.py                          ← campo perfil_completo adicionado
├── forms.py                           ← AlunoPerfilForm + ProfessorPerfilForm
├── views.py                           ← completar_perfil_aluno/professor + login redirect
├── urls.py                            ← 3 novas rotas
├── admin_dashboard.py                 ← NOVO — lógica da dashboard admin
├── migrations/0004_user_perfil_completo.py  ← NOVA migração
└── templates/accounts/
    ├── completar_perfil_aluno.html    ← NOVO
    ├── completar_perfil_professor.html← NOVO
    └── dashboard_professores.html     ← NOVO

professores/
├── urls.py                            ← editar-curso + deletar-curso adicionados
└── templates/professores/
    ├── perfil.html                    ← totalmente dinâmico
    └── meus_cursos.html               ← totalmente dinâmico

feed/
└── templates/feed/
    └── home.html                      ← totalmente dinâmico

templates/
└── base.html                          ← navbar dinâmica corrigida
```
