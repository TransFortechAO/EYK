# Arquitetura do Projeto EYK

## Visão Geral
O EYK é uma plataforma educacional que utiliza uma arquitetura de monorepo para gerenciar o frontend e backend de forma organizada e escalável.

### Tecnologias Principais
- **Backend**: Django + Django REST Framework
- **Frontend**: Next.js 14+ (React + TypeScript + TailwindCSS)
- **Banco de Dados**: PostgreSQL (produção), SQLite (desenvolvimento)
- **Cache e Filas**: Redis + Celery
- **Proxy Reverso**: Nginx
- **Containerização**: Docker + Docker Compose

## Estrutura do Monorepo
```
eyk/
├── backend/           # Projeto Django
├── frontend/          # Aplicação Next.js
├── infra/             # Infraestrutura e orquestração
├── .github/           # CI/CD workflows
└── docs/              # Documentação
```

## Backend - Arquitetura Django

### Organização do Código
O backend segue uma estrutura moderna separando:
- **Configurações**: `backend/config/settings/` com ambientes separados
- **Apps de Domínio**: `backend/apps/` agrupa todas as aplicações específicas
- **Código Transversal**: `backend/core/` compartilhado entre todos os apps
- **Scripts**: `backend/scripts/` utilitários de desenvolvimento

### Apps Principais
1. **accounts**: Autenticação e gerenciamento de usuários
2. **alunos**: Funcionalidades específicas para alunos
3. **professores**: Funcionalidades específicas para professores  
4. **cursos**: Gestão de cursos e conteúdos educacionais
5. **feed**: Comunidade e feed de atividades
6. **gamificacao**: Sistema de recompensas e engajamento

### Core (Código Transversal)
- **pagination**: Paginação padrão para todas as APIs
- **permissions**: Classes de permissão reutilizáveis
- **exceptions**: Handler global de exceções
- **audit**: Sistema de logs de auditoria para rastrear ações dos usuários

## Frontend - Arquitetura Next.js

### Estrutura
- App Router (Next.js 14+)
- Server Components por padrão
- TailwindCSS para estilização
- TypeScript para type safety
- API client centralizado

## Infraestrutura

### Docker Compose
Orquestra todos os serviços necessários para executar a aplicação:
- PostgreSQL
- Redis
- Django backend
- Next.js frontend
- Celery worker + beat
- Nginx proxy reverso

### CI/CD
GitHub Actions executam:
- Linting (Ruff para Python, ESLint para JS/TS)
- Testes automatizados
- Build do projeto
- Validação de migrações

## Decisões Arquiteturais

### Por que Monorepo?
- Facilita o desenvolvimento integrado frontend+backend
- Compartilhamento de conhecimento e documentação centralizada
- CI/CD unificado
- Dependências versionadas no mesmo repositório

### Por que Django REST Framework?
- Ecossistema maduro para APIs
- Serialização robusta
- Autenticação e permissões flexíveis
- Grande comunidade e suporte

### Por que Next.js?
- Renderização híbrida (SSR/SSG/CSR)
- Otimizações de performance nativas
- Full-stack React com TypeScript
- Ecossistema moderno e em crescimento

## Trade-offs e Considerações
- **Segurança**: Todas as requisições passam pelo Nginx, CORS configurado estritamente em produção
- **Escalabilidade**: Arquitetura permite escalar serviços independentemente
- **Manutenibilidade**: Separação clara de responsabilidades facilita onboarding e debugging
- **Performance**: Cache Redis, assets estáticos servidos pelo Nginx, otimizações do Next.js