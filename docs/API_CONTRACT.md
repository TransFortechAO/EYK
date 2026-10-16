# Contrato de API - EYK Plataforma Educacional

## Visão Geral
Este documento detalha todos os endpoints da API que são consumidos pelo frontend Next.js, garantindo consistência entre frontend e backend.

## Base URL
```
Desenvolvimento: http://localhost:8000/api
Produção: https://sua-api.com.br/api
```

## Autenticação
Todas as requisições autenticadas devem incluir cookies de sessão gerenciados pelo Django.

### Endpoints de Autenticação
#### `POST /accounts/login/`
Realiza login do usuário.
**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "string",
    "email": "string",
    "first_name": "string",
    "last_name": "string",
    "perfil_completo": true
  }
}
```

#### `POST /accounts/logout/`
Encerra a sessão do usuário.
**Response (200 OK):**
```json
{
  "success": true
}
```

#### `GET /accounts/me/`
Retorna dados do usuário autenticado.
**Response (200 OK):**
```json
{
  "id": 1,
  "username": "string",
  "email": "string",
  "first_name": "string",
  "last_name": "string",
  "perfil_completo": true,
  "tipo_usuario": "aluno|professor|admin",
  "moedas": 100,
  "xp": 500
}
```

## Cursos
#### `GET /cursos/`
Lista todos os cursos (paginado).
**Query Parameters:**
- `page`: número da página (default: 1)
- `page_size`: quantidade por página (default: 20)
- `search`: busca por título ou descrição
- `categoria`: filtra por categoria

**Response (200 OK):**
```json
{
  "count": 100,
  "next": "http://...",
  "previous": null,
  "total_pages": 5,
  "current_page": 1,
  "results": [
    {
      "id": 1,
      "titulo": "string",
      "descricao": "string",
      "professor": {
        "id": 1,
        "nome": "string",
        "avatar": "url"
      },
      "capa": "url",
      "total_inscritos": 50,
      "categoria": "string",
      "data_criacao": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### `GET /cursos/{id}/`
Retorna detalhes de um curso específico.
**Response (200 OK):**
```json
{
  "id": 1,
  "titulo": "string",
  "descricao": "string",
  "professor": { /* dados do professor */ },
  "videos": [
    {
      "id": 1,
      "titulo": "string",
      "duracao": 600,
      "ordem": 1,
      "thumbnail": "url"
    }
  ],
  "inscrito": true,
  "progresso": 75.5
}
```

#### `POST /cursos/{id}/inscrever/`
Inscreve o usuário em um curso.
**Response (200 OK):**
```json
{
  "success": true,
  "inscrito": true
}
```

## Alunos
#### `GET /alunos/perfil/{id}/`
Retorna perfil de um aluno.
**Response (200 OK):**
```json
{
  "id": 1,
  "nome": "string",
  "avatar": "url",
  "bio": "string",
  "cursos_inscritos": 10,
  "ranking": 5,
  "moedas": 500,
  "xp": 2500
}
```

## Professores
#### `GET /professores/perfil/{id}/`
Retorna perfil de um professor.
**Response (200 OK):**
```json
{
  "id": 1,
  "nome": "string",
  "avatar": "url",
  "bio": "string",
  "total_cursos": 5,
  "total_alunos": 500,
  "avaliacao_media": 4.8
}
```

#### `PUT /professores/cursos/criar/`
Cria um novo curso (apenas professores).
**Request Body:**
```json
{
  "titulo": "string",
  "descricao": "string",
  "categoria": "string"
}
```

## Feed/Comunidade
#### `GET /feed/posts/`
Lista posts do feed principal (paginado).
**Response (200 OK):**
```json
{
  "count": 50,
  "next": "...",
  "previous": null,
  "results": [
    {
      "id": 1,
      "autor": { "id": 1, "nome": "string", "avatar": "url" },
      "conteudo": "string",
      "curso": { "id": 1, "titulo": "string" },
      "curtidas": 25,
      "comentarios": 5,
      "data_criacao": "2024-01-01T00:00:00Z",
      "usuario_curtiu": false
    }
  ]
}
```

#### `POST /feed/posts/{id}/curtir/`
Curte/descurte um post.
**Response (200 OK):**
```json
{
  "success": true,
  "curtidas": 26,
  "curtiu": true
}
```

## Gamificação
#### `GET /gamificacao/leaderboard/`
Retorna o ranking global.
**Response (200 OK):**
```json
{
  "ranking": [
    {
      "posicao": 1,
      "usuario": { "id": 1, "nome": "string", "avatar": "url" },
      "xp": 10000,
      "moedas": 2000
    }
  ],
  "sua_posicao": 15,
  "seu_xp": 2500
}
```

#### `GET /gamificacao/minhas-conquistas/`
Retorna conquistas do usuário.
**Response (200 OK):**
```json
{
  "conquistas": [
    {
      "id": 1,
      "nome": "Primeiro Curso",
      "descricao": "Completou seu primeiro curso",
      "icone": "url",
      "data_desbloqueio": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Notificações
#### `GET /notificacoes/`
Lista notificações não lidas.
**Response (200 OK):**
```json
{
  "nao_lidas": 5,
  "todas": [
    {
      "id": 1,
      "tipo": "curso_inscrito|comentario|curtida",
      "mensagem": "string",
      "lida": false,
      "data_criacao": "2024-01-01T00:00:00Z",
      "link": "/cursos/1"
    }
  ]
}
```

#### `POST /notificacoes/{id}/marcar-como-lida/`
Marca uma notificação como lida.
**Response (200 OK):**
```json
{
  "success": true
}
```

## Códigos de Erro
| Código | Descrição |
|--------|-----------|
| 400 | Requisição inválida |
| 401 | Não autenticado |
| 403 | Permissão negada |
| 404 | Recurso não encontrado |
| 409 | Conflito de dados |
| 500 | Erro interno do servidor |

## Formato de Erro
```json
{
  "error": "Mensagem de erro",
  "detail": "Detalhes adicionais se disponíveis"
}
```