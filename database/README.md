# Base de dados (PostgreSQL)

Ficheiros para criar a base de dados do EYK no Neon (ou noutro PostgreSQL 16 ou mais recente).

| Ficheiro | Conteúdo | Quando usar |
|---|---|---|
| `eyk_vazia.sql` | Todas as tabelas, sem utilizadores nem conteúdos. Inclui o registo das migrações e os dados iniciais que elas criam (palavras proibidas, badges). | Começar o site do zero. |
| `eyk_completo.sql` | Tabelas + os dados atuais do `backend/db.sqlite3` (utilizadores, cursos, vídeos, posts, comentários…). | Levar para produção o que já existe no computador. |

Usa **só um** dos dois, numa base de dados vazia.

> `eyk_completo.sql` tem emails e hashes de palavras-passe dos utilizadores. Não está no git (ver `.gitignore`); não o partilhes.

## Importar no Neon

### Opção A — `psql` (recomendado)

Com o Postgres.app, o `psql` está em `/Applications/Postgres.app/Contents/Versions/latest/bin/psql`.

```
psql '<connection string do Neon>' -v ON_ERROR_STOP=1 -f database/eyk_completo.sql
```

### Opção B — SQL Editor do Neon

No painel do Neon: **SQL Editor** → cola o conteúdo do ficheiro → **Run**.

## Depois de importar

- O `eyk-api` corre `python manage.py migrate` no arranque. Com estes ficheiros não há nada para aplicar, e as migrações novas que criares mais tarde são aplicadas normalmente.
- Com `eyk_vazia.sql`, cria o primeiro administrador (ver `docs/DEPLOY_RENDER.md`, passo 5).
- **Ficheiros (vídeos, fotos, PDFs):** a base de dados guarda só os caminhos. Para os conteúdos de `eyk_completo.sql` aparecerem, envia o conteúdo de `backend/media/` para o bucket do R2 mantendo as mesmas pastas.

## Gerar de novo

Os ficheiros foram gerados a partir de um PostgreSQL 16 local: `migrate`, depois `dumpdata` do SQLite e `loaddata` no Postgres, e por fim:

```
pg_dump --no-owner --no-privileges --no-comments --column-inserts --rows-per-insert=200 <base> \
  | grep -v -E '^\\(un)?restrict '
```

Os comandos `\restrict` são retirados para o ficheiro funcionar também no SQL Editor do Neon.
