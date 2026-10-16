# Deploy gratuito (planos free de vários serviços)

A EYK pode ficar online sem pagar, juntando os planos gratuitos de cinco serviços:

| Peça | Serviço | Plano | O que faz |
|---|---|---|---|
| `eyk-web` | Render | Free | Frontend Next.js — o único endereço que os utilizadores abrem |
| `eyk-api` | Render | Free | Django (gunicorn) |
| Base de dados | [Neon](https://neon.tech) | Free | PostgreSQL |
| Ficheiros | [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) | Free | Vídeos, fotos e PDFs |
| Emails | [Brevo](https://www.brevo.com) | Free | Verificação de email, recuperação de palavra-passe, anúncios |
| Agendador | GitHub Actions | Free | Anúncios agendados, lembrete de ofensiva, reposição das ofensivas |

Os dois serviços do Render estão descritos em [`render-gratis.yaml`](../render-gratis.yaml). A versão paga, com worker, Redis e disco, continua em [`render.yaml`](../render.yaml) — ver [Passar para o plano pago](#passar-para-o-plano-pago).

> Os limites dos planos gratuitos mudam com frequência. Os valores abaixo eram os conhecidos em outubro de 2026; confirma-os nas páginas de preços de cada serviço.

## O que se perde no plano gratuito

- **O site adormece.** Ao fim de 15 minutos sem visitas, o Render desliga os serviços. A visita seguinte espera cerca de 1 minuto (ou mais, se a API também estiver a dormir).
- **750 horas por mês no Render, partilhadas pelos dois serviços.** Dois serviços acordados o mês inteiro gastavam cerca de 1.490 horas, e o Render suspendia-os até ao mês seguinte. Funciona porque adormecem quando ninguém usa. Não uses "pingers" para os manter acordados.
- **512 MB de RAM** na API. Chega para começar; o processamento de vídeos grandes é o ponto mais pesado.
- **As tarefas agendadas correm de hora a hora**, não de 5 em 5 minutos. Um anúncio agendado para as 10:20 sai por volta das 11:07.
- **Os anúncios "enviar agora" correm dentro do próprio pedido** (não há worker). Com milhares de utilizadores, o pedido pode demorar.
- **Limites de espaço:** Neon cerca de 0,5 GB de base de dados; R2 cerca de 10 GB de ficheiros; Brevo 300 emails por dia.

## Como funciona

- O browser só fala com o `eyk-web`. O Next.js reencaminha `/api`, `/accounts`, `/aluno`, `/media`, `/static` e `/admin` para o endereço público do `eyk-api` (ver `frontend/next.config.ts`).
  - Assim os cookies de sessão e de CSRF são do próprio site.
  - Se o browser falasse diretamente com dois endereços `*.onrender.com`, os cookies seriam de terceiros, e o Safari (iPhone) e o Chrome bloqueiam-nos: o login deixava de funcionar.
- **Sem Redis nem worker.** Sem `CELERY_BROKER_URL`, as tarefas (anúncios, lembretes) correm no próprio processo que as pede.
- **Ficheiros no R2.** O plano free do Render não tem disco: tudo o que fosse gravado no servidor perdia-se no reinício seguinte. Com `AWS_STORAGE_BUCKET_NAME` definido, o Django grava e lê os ficheiros no bucket (`backend/config/settings/prod.py`).
- **Emails pela API do Brevo.** O plano free do Render bloqueia as portas SMTP (25, 465 e 587). Com `BREVO_API_KEY` definido, o Django envia por HTTPS em vez de SMTP.
- **Agendador no GitHub Actions.** O workflow [`.github/workflows/agendador.yml`](../.github/workflows/agendador.yml) liga-se diretamente à base de dados do Neon e corre:
  - de hora a hora: os anúncios agendados e o lembrete de ofensiva (à hora escolhida em **Administração → Plataforma**);
  - às 00:05 de Luanda: põe a zero as ofensivas quebradas.

## Primeira vez

Usa a mesma região (Frankfurt / Europa central) em todos os serviços que deixem escolher. É a mais próxima de Angola e encurta o caminho entre a API e a base de dados.

### 1. Base de dados — Neon

1. Cria uma conta em [neon.tech](https://neon.tech) e um projeto. Região: **AWS Europe Central 1 (Frankfurt)**. Versão do Postgres: 16 ou mais recente.
2. Em **Connect**, copia a *connection string*:
   - desliga a opção **Connection pooling** (usa a ligação direta);
   - deve acabar em `?sslmode=require` (pode ter também `&channel_binding=require`).
3. Guarda-a: é o `DATABASE_URL`.

### 2. Ficheiros — Cloudflare R2

1. Cria uma conta na [Cloudflare](https://dash.cloudflare.com) e ativa o **R2**. A Cloudflare pode pedir um cartão para ativar o R2, mesmo no plano gratuito.
2. **R2 → Create bucket**, com o nome `eyk-media`. Região: *Automatic* ou *Europe*.
3. **R2 → Manage API tokens → Create API token**:
   - permissões: **Object Read & Write**;
   - aplica só ao bucket `eyk-media`.
   Guarda o **Access Key ID** e o **Secret Access Key** (só aparecem uma vez).
4. Na página do R2, copia o **Account ID**. O endpoint é `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
5. No bucket, abre **Settings → CORS policy** e cola (troca o endereço pelo do teu frontend):
   ```json
   [
     {
       "AllowedOrigins": ["https://eyk-web.onrender.com"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   A app descarrega vídeos para ver offline, e o browser precisa disto para os ler.

Não é preciso tornar o bucket público: sem domínio próprio, o Django gera URLs assinados que expiram ao fim de 6 horas.

### 3. Emails — Brevo

1. Cria uma conta em [brevo.com](https://www.brevo.com).
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: adiciona o email que vai aparecer como remetente (ex: `apoioekolayakelela@gmail.com`) e confirma-o pelo link que o Brevo envia.
   - Com um endereço Gmail (sem domínio próprio), o Brevo pode mostrar o remetente através de um domínio dele. Para emails com o teu domínio, autentica-o em **Domains** (DKIM/DMARC).
3. **SMTP & API → API Keys → Generate a new API key**. Guarda-a: é o `BREVO_API_KEY`. (É a chave da API, não a "SMTP key".)

### 4. Render — Blueprint

1. No Render, abre **New → Blueprint** e escolhe o repositório.
2. Preenche:
   - **Blueprint Name:** `EYK` (só para o identificares no painel);
   - **Branch:** o branch que tem o `render-gratis.yaml` (ex: `development-v2` ou `main`);
   - **Blueprint Path:** `render-gratis.yaml`.
3. O Render pede os valores marcados como `sync: false`:

   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_URL` | `https://eyk-web.onrender.com` (sem barra no fim) |
   | `DATABASE_URL` | a connection string do Neon (passo 1) |
   | `BREVO_API_KEY` | a chave do Brevo (passo 3) |
   | `DEFAULT_FROM_EMAIL` | o remetente verificado, ex: `EYK <apoioekolayakelela@gmail.com>` |
   | `AWS_STORAGE_BUCKET_NAME` | `eyk-media` |
   | `AWS_ACCESS_KEY_ID` | do token do R2 (passo 2) |
   | `AWS_SECRET_ACCESS_KEY` | do token do R2 (passo 2) |
   | `AWS_S3_ENDPOINT_URL` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
   | `API_INTERNO` | `https://eyk-api.onrender.com` (endereço público da API, sem barra no fim) |

4. Espera pelos builds. O `eyk-api` corre as migrações sozinho em cada arranque.
5. **Confirma os endereços.** O Render pode acrescentar um sufixo aos nomes (ex: `eyk-web-a1b2.onrender.com`). Vê os endereços reais no painel de cada serviço. Se forem diferentes:
   - corrige `NEXT_PUBLIC_URL` no grupo **eyk-comum** e faz **Manual Deploy** ao `eyk-api`;
   - corrige `API_INTERNO` no `eyk-web` e faz **Manual Deploy** ao `eyk-web` (é lido no build);
   - corrige o endereço no CORS do R2.

### 5. Primeiro administrador

O plano free do Render não tem **Shell**. Cria o admin a partir do teu computador, ligado à base de dados do Neon:

```
cd backend
.venv/bin/pip install -r requirements/prod.txt

DJANGO_ENV=prod \
DJANGO_SECRET_KEY=qualquer-texto-comprido-so-para-este-comando \
DATABASE_URL='<connection string do Neon>' \
NEXT_PUBLIC_URL=https://eyk-web.onrender.com \
CELERY_BROKER_URL= CACHE_URL= \
.venv/bin/python manage.py createsuperuser
```

- `CELERY_BROKER_URL=` e `CACHE_URL=` vazios evitam que o comando use o Redis do teu `.env` local.
- Depois, marca a conta como verificada e completa (evita o aviso de email e o ecrã de personalizar perfil), com as mesmas variáveis antes de:
  ```
  .venv/bin/python manage.py shell -c "from django.contrib.auth import get_user_model; get_user_model().objects.filter(username='O_TEU_USERNAME').update(email_verificado=True, perfil_completo=True)"
  ```

### 6. Agendador — GitHub Actions

No GitHub, abre o repositório → **Settings → Secrets and variables → Actions → New repository secret** e cria:

| Secret | Valor |
|---|---|
| `DATABASE_URL` | a connection string do Neon |
| `DJANGO_SECRET_KEY` | o mesmo do Render: no `eyk-api`, **Environment → eyk-comum → DJANGO_SECRET_KEY** |
| `NEXT_PUBLIC_URL` | o endereço do frontend (aparece nos links dos emails) |
| `BREVO_API_KEY` | a chave do Brevo |
| `DEFAULT_FROM_EMAIL` | o remetente verificado |

- Sem o `DATABASE_URL`, o workflow corre mas não faz nada.
- Para testar já: **Actions → Agendador → Run workflow**.
- O workflow só corre a partir do branch por defeito do repositório (normalmente `main`): o ficheiro `.github/workflows/agendador.yml` tem de estar lá.
- Num repositório privado de uma organização no plano gratuito, o GitHub dá cerca de 2.000 minutos de Actions por mês. Este workflow gasta cerca de 1 minuto por hora (≈ 750 por mês). Num repositório público não há limite.

### 7. Testar

1. Abre o `NEXT_PUBLIC_URL` (a primeira visita pode demorar cerca de 1 minuto) e entra com o admin.
2. Cria uma conta de teste: o email de verificação deve chegar.
3. Como professor, carrega um vídeo e confirma que aparece no bucket `eyk-media` do R2.
4. Em **Administração → Plataforma**, depois da primeira execução do workflow, deve aparecer **"Agendador ativo (de hora a hora)"**.

## Depois de cada push

O Render faz deploy automático dos dois serviços: o `eyk-api` corre as migrações no arranque e o `eyk-web` refaz o build do Next.

O `API_INTERNO` e o `NEXT_PUBLIC_API_URL` são lidos no build do Next. Se mudares algum deles, faz um novo deploy do `eyk-web`.

## Domínio próprio (ex: `eyk.ao`)

1. No `eyk-web`, abre **Settings → Custom Domains** e adiciona `eyk.ao`. Configura o DNS como o Render indicar.
2. Muda `NEXT_PUBLIC_URL` para `https://eyk.ao` no grupo **eyk-comum** e faz novo deploy do `eyk-api`.
3. Atualiza o secret `NEXT_PUBLIC_URL` no GitHub e o CORS do bucket no R2.
4. Opcional: com o domínio na Cloudflare, liga um subdomínio público ao bucket (ex: `media.eyk.ao`) e define `AWS_S3_CUSTOM_DOMAIN=media.eyk.ao` no `eyk-api`. Os URLs dos ficheiros deixam de expirar e passam pela cache da Cloudflare.

## Passar os dados de desenvolvimento para produção

Se quiseres levar os utilizadores e os cursos do `db.sqlite3` local:

```
# no computador (backend/), com a base de dados local
.venv/bin/python manage.py dumpdata --natural-foreign --natural-primary \
  -e contenttypes -e auth.permission -e sessions -e admin.logentry --indent 1 > dados.json
```

- Carrega o `dados.json` no Neon a partir do computador, com as mesmas variáveis do [passo 5](#5-primeiro-administrador) antes de `.venv/bin/python manage.py loaddata dados.json`.
- Copia a pasta `backend/media/` para o bucket `eyk-media`, mantendo os mesmos caminhos (ex: `videos/aula.mp4` fica `videos/aula.mp4` no bucket). Para muitos ficheiros, usa o [rclone](https://rclone.org) ou o `aws s3 sync` com o endpoint do R2.

## Variáveis de ambiente

| Variável | Onde | Para quê |
|---|---|---|
| `DJANGO_ENV=prod` | api, GitHub | Carrega `config/settings/prod.py` |
| `DJANGO_SECRET_KEY` | api, GitHub | Gerada pelo Render (grupo `eyk-comum`); a mesma no GitHub |
| `DATABASE_URL` | api, GitHub | PostgreSQL do Neon (ligação direta, `sslmode=require`) |
| `NEXT_PUBLIC_URL` | api, GitHub | URL do frontend: links nos emails, CORS, CSRF e hosts aceites |
| `BREVO_API_KEY` | api, GitHub | Envia os emails pela API do Brevo. Sem ela, usa SMTP (`EMAIL_*`) |
| `DEFAULT_FROM_EMAIL` | api, GitHub | Remetente dos emails (verificado no Brevo) |
| `AWS_STORAGE_BUCKET_NAME` | api | Bucket do R2. Sem ela, os ficheiros vão para o disco (perdem-se no plano free) |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | api | Token do R2 |
| `AWS_S3_ENDPOINT_URL` | api | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `AWS_S3_REGION_NAME=auto` | api | Região do R2 |
| `AWS_S3_CUSTOM_DOMAIN` | api | Opcional: domínio público do bucket |
| `CONFIAR_X_FORWARDED_FOR=True` | api | Usa o IP real do utilizador (limites, sessões) |
| `WEB_CONCURRENCY=1` | api | Processos do gunicorn (1 para caber nos 512 MB) |
| `API_INTERNO` | web (build) | Endereço público do `eyk-api` |
| `NEXT_PUBLIC_API_URL=/` | web (build) | A API está no mesmo domínio |
| `SENTRY_DSN` | api | Opcional: erros enviados para o Sentry |

## Problemas comuns

- **A primeira visita demora ou dá erro 502.** Os serviços estavam a dormir. Espera um minuto e recarrega. É normal no plano free.
- **403 "CSRF Failed" ou o login não fica guardado.** O `NEXT_PUBLIC_URL` não corresponde ao endereço aberto no browser. Corrige-o e faz deploy do `eyk-api`.
- **As páginas carregam mas a API dá erro.** O `API_INTERNO` do `eyk-web` está errado (tem de ser o endereço público do `eyk-api`, com `https://`). Corrige-o e faz deploy do `eyk-web`.
- **Os emails não chegam.**
  - Confirma `BREVO_API_KEY` e que o `DEFAULT_FROM_EMAIL` é um remetente verificado no Brevo.
  - Vê **Brevo → Transactional → Logs** e os *Logs* do `eyk-api`.
  - Os emails só vão para contas com o email confirmado; o limite é de 300 por dia.
- **Os vídeos não abrem ou o upload falha.**
  - Confirma as variáveis `AWS_*` e as permissões do token do R2 (Object Read & Write no bucket).
  - Para ver offline, confirma o CORS do bucket.
  - O limite de tamanho está em **Plataforma → Limites de upload**.
- **O painel diz "O agendador não dá sinal".** O workflow "Agendador" não correu na última hora e meia. Vê **GitHub → Actions → Agendador**: confirma os secrets e que o workflow está no branch por defeito. O GitHub desativa workflows agendados em repositórios sem atividade durante 60 dias; volta a ativá-lo nessa página.
- **O Render suspendeu os serviços.** Acabaram as 750 horas do mês. Voltam no início do mês seguinte, ou passa para o plano pago.
- **O Neon diz que a base de dados está cheia.** Passaste o limite do plano gratuito. Apaga dados antigos ou passa para um plano pago do Neon.

## Passar para o plano pago

Quando houver alunos a usar a EYK todos os dias, a espera ao acordar e os limites do plano free deixam de compensar. O [`render.yaml`](../render.yaml) descreve a versão paga, toda no Render:

| Serviço | Plano |
|---|---|
| `eyk-web`, `eyk-api`, `eyk-worker` (Celery worker + beat) | Starter |
| `eyk-db` (PostgreSQL 16) | Basic 256 MB |
| `eyk-redis` | Free |

- Cria um Blueprint novo com **Blueprint Path** `render.yaml` (ou vazio).
- Com o worker, o agendador corre de 5 em 5 minutos e o workflow do GitHub Actions deixa de ser preciso: apaga o secret `DATABASE_URL` no GitHub para o desligar.
- Podes manter o Neon, o R2 e o Brevo: no `render.yaml`, troca o `DATABASE_URL` pelo do Neon e acrescenta as variáveis `AWS_*` e `BREVO_API_KEY` ao `eyk-api` e ao `eyk-worker`. Com o bucket, o disco do `eyk-api` deixa de ser preciso.
- Para passar os dados do Neon para outra base de dados, usa `pg_dump` e `pg_restore`.
