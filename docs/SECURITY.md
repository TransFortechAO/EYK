# Política de Segurança - Projeto EYK

## Visão Geral
O EYK implementa múltiplas camadas de segurança para proteger os dados dos usuários e a integridade da plataforma.

## Autenticação e Autorização

### Autenticação de Dois Fatores (2FA)
- Todos os usuários podem habilitar 2FA via TOTP (Google Authenticator, Authy)
- Tokens temporários de recuperação são gerados na primeira configuração
- 2FA é obrigatório para contas de administrador

### Gerenciamento de Sessões
- Sessões expiram após 24 horas de inatividade
- Máximo de 5 sessões simultâneas por usuário
- Sessões são invalidadas ao alterar a senha
- Cookies seguros (HttpOnly, Secure, SameSite=Lax) em produção

### Permissões e RBAC (Role-Based Access Control)
| Função | Permissões |
|--------|------------|
| Aluno | Acessar cursos inscritos, interagir na comunidade, visualizar próprio desempenho |
| Professor | Criar/gerenciar seus cursos, ver dados de seus alunos, interagir na comunidade |
| Admin | Acesso completo a todas as funcionalidades e dados |

## Proteções Técnicas

### Frontend
- Validação de todos os inputs no cliente
- Sanitização de conteúdo para prevenir XSS
- CSP (Content Security Policy) implementado
- Todas as requisições sensíveis usam POST/PUT/DELETE
- Tokens CSRF válidos para todas as requisições state-changing

### Backend
- ORM do Django previne SQL Injection
- Validação de todos os dados de entrada
- Rate limiting em todas as APIs
- Sanitização de uploads de arquivos (apenas tipos permitidos)
- Scan de malware em uploads (em produção)

### Banco de Dados
- Senhas armazenadas com PBKDF2 + SHA-256
- Dados sensíveis criptografados no banco
- Backups diários criptografados
- Acesso restrito ao banco apenas por serviços internos

## Infraestrutura

### Rede
- Tudo o tráfego usa HTTPS/TLS 1.3
- WAF (Web Application Firewall) bloqueia ataques comuns
- CDN em produção para conteúdo estático
- Acesso ao banco apenas pela rede privada
- Redis acessível apenas do backend

### Segredos e Credenciais
- Nunca commitados no repositório
- Armazenados em variáveis de ambiente
- Rotação de credenciais a cada 90 dias
- Diferentes credenciais por ambiente (dev/staging/prod)
- AWS Secrets Manager ou HashiCorp Vault em produção

## Logging e Monitoramento

### Auditoria
- Todas as ações sensíveis são logadas:
  - Logins/Logouts
  - Alterações de permissão
  - Acessos a dados sensíveis
  - Alterações em configurações
- Logs armazenados por 1 ano
- Acesso aos logs restrito apenas à equipe de segurança

### Monitoramento
- Alertas em tempo real para:
  - Tentativas de login falhadas (5+ em 10min)
  - Acessos a rotas administrativas
  - Uso anormal de API
  - Erros 5xx em produção
- Dashboard de segurança com métricas em tempo real

## Threat Model

### Ameaças Mitigadas
✅ **SQL Injection**: ORM do Django + validação de inputs  
✅ **XSS**: Sanitização + CSP  
✅ **CSRF**: Tokens CSRF válidos para todas as requisições  
✅ **Brute Force**: Rate limiting + bloqueio temporário  
✅ **Session Hijacking**: Cookies seguros + expiração  
✅ **DDoS**: Cloudflare/CDN mitiga  
✅ **Data Leakage**: Permissões granulares + auditoria  

### Ameaças a Monitorar
⚠️ **Injeção de comandos**: Validação rigorosa de todos os inputs  
⚠️ **Ataques de força bruta em 2FA**: Rate limiting específico  
⚠️ **Phishing**: Educação contínua dos usuários  

## Resposta a Incidentes

### Procedimento em Caso de Brecha
1. **Identificação**: Equipe detecta atividade suspeita
2. **Contenção**: Isolar sistemas afetados, invalidar sessões
3. **Investigação**: Determinar escopo e impacto
4. **Mitigação**: Corrigir vulnerabilidades exploradas
5. **Notificação**: Alertar usuários afetados conforme LGPD
6. **Prevenção**: Atualizar políticas e implementar novas proteções

### Contato
Para reportar vulnerabilidades de segurança, entre em contato:
- security@eyk.com.br
- PGP key disponível para comunicação criptografada
- Programa de bug bounty para pesquisadores independentes

## Conformidade Legal

### LGPD (Lei Geral de Proteção de Dados)
- Dados coletados apenas com consentimento explícito
- Usuários podem solicitar exclusão/cópia de seus dados
- Política de privacidade disponível publicamente
- Responsável pelo tratamento de dados formalmente designado

### Outras Normas
- Base Nacional Comum Curricular (BNCC) para conteúdo educacional
- GDPR para usuários da União Europeia
- CCPA para usuários da Califórnia

## Checklist de Deploy em Produção
- [ ] HTTPS configurado com certificado válido
- [ ] Debug=False no settings.prod
- [ ] SECRET_KEY forte e único
- [ ] CORS_ALLOWED_ORIGINS configurado
- [ ] CSRF_TRUSTED_ORIGINS configurado
- [ ] SECURE_SSL_REDIRECT=True
- [ ] SESSION_COOKIE_SECURE=True
- [ ] CSRF_COOKIE_SECURE=True
- [ ] HSTS ativado
- [ ] Backup automático configurado
- [ ] Monitoramento e alertas ativos
- [ ] Logs de auditoria configurados