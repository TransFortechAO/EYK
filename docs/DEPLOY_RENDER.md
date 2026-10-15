# Deploy no Render

A infraestrutura toda está descrita em [`render.yaml`](../render.yaml) (um "Blueprint").

| Serviço | O que é | Plano |
|---|---|---|
| `eyk-web` | Frontend Next.js — o único endereço que os utilizadores abrem | Starter |
| `eyk-api` | Django (gunicorn) + disco de 20 GB para a media | Starter |
| `eyk-worker` | Celery worker + beat (anúncios, lembrete de ofensiva, agendados) | Starter |
| `eyk-db` | PostgreSQL 16 | Basic 256 MB |
| `eyk-redis` | Redis (fila do Celery + cache) | Free |

Tudo em **Frankfurt**, a região mais próxima de Angola. Confirma os preços atuais em render.com/pricing.

## Como funciona

- O browser só fala com o `eyk-web`. O Next.js reencaminha `/api`, `/accounts`, `/aluno`, `/media`, `/static` e `/admin` para o `eyk-api` pela rede privada (ver `frontend/next.config.ts`).
  - Assim os cookies de sessão e de CSRF são do próprio site.
  - Se o frontend e a API estivessem em dois endereços `*.onrender.com`, os cookies seriam de terceiros, e o Safari (iPhone) e o Chrome bloqueiam-nos: o login deixava de funcionar.
- O `eyk-worker` corre o Celery com o beat embutido (`-B`). De 5 em 5 minutos, o beat verifica o que os admins definiram em **Administração → Plataforma → Tarefas agendadas**:
  - o lembrete de ofensiva, à hora escolhida;
  - os anúncios agendados.
- À meia-noite e cinco (hora de Luanda), o worker põe a zero as ofensivas quebradas.
- Os anúncios são sempre enviados pelo worker, aos lotes de 500. O painel mostra o progresso.

## Primeira vez

1. Faz push deste repositório para o GitHub ou GitLab.
2. No Render, abre **New → Blueprint** e escolhe o repositório. O `render.yaml` é detetado.
3. O Render pede os valores marcados como `sync: false`:
   - `NEXT_PUBLIC_URL`: o endereço do frontend, por exemplo `https://eyk-web.onrender.com`, sem barra no fim. O nome real aparece no painel depois de criares o serviço; se for diferente, corrige-o no grupo `eyk-comum` e faz *Manual Deploy* ao `eyk-api` e ao `eyk-worker`.
   - `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`: o SMTP. Com Gmail, usa `smtp.gmail.com` e uma *palavra-passe de app*, não a palavra-passe normal.
4. Espera pelos builds. O `eyk-api` corre as migrações sozinho antes de cada deploy (`preDeployCommand`).
5. Cria o primeiro administrador: abre o `eyk-api`, vai a **Shell** e corre:
   ```
   python manage.py createsuperuser
   ```
6. Abre o `NEXT_PUBLIC_URL` e entra com essa conta. Em **Administração → Plataforma → Tarefas agendadas** deve aparecer **"Agendador ativo"** até 5 minutos depois do arranque do worker.

## Depois de cada push

O Render faz deploy automático dos três serviços: corre as migrações, faz o build do Next e reinicia o worker.

O `API_INTERNO` e o `NEXT_PUBLIC_API_URL` são lidos no build do Next. Se mudares algum deles, faz um novo deploy do `eyk-web`.

## Domínio próprio (ex: `eyk.ao`)

1. No `eyk-web`, abre **Settings → Custom Domains** e adiciona `eyk.ao`. Configura o DNS como o Render indicar.
2. Muda `NEXT_PUBLIC_URL` para `https://eyk.ao` no grupo `eyk-comum` e faz novo deploy do `eyk-api` e do `eyk-worker`.

## Media num bucket (quando houver muitos alunos)

Por omissão, os vídeos ficam no disco do `eyk-api` e são servidos pelo Django, com suporte a Range. Isto chega para começar, mas cada vídeo visto ocupa uma *thread* do gunicorn.

Para escalar, usa um bucket S3-compatível. O Cloudflare R2 não cobra o tráfego de saída. No `eyk-api`, acrescenta:

```
AWS_STORAGE_BUCKET_NAME=eyk-media
AWS_ACCESS_KEY_ID=…
AWS_SECRET_ACCESS_KEY=…
AWS_S3_ENDPOINT_URL=https://<id-da-conta>.r2.cloudflarestorage.com
AWS_S3_REGION_NAME=auto
AWS_S3_CUSTOM_DOMAIN=media.eyk.ao        # domínio público do bucket (opcional)
```

- Sem `AWS_S3_CUSTOM_DOMAIN`, os URLs são assinados e expiram ao fim de 6 horas.
- Configura o CORS do bucket para aceitar `GET` e `HEAD` a partir do `NEXT_PUBLIC_URL`. A app descarrega vídeos para ver offline.
- Os ficheiros que já estão no disco não passam sozinhos para o bucket. Copia a pasta `/var/data/media` para lá, mantendo os mesmos caminhos.
- Depois disso, o disco pode ser removido do `render.yaml`.

## Passar os dados de desenvolvimento para produção

Se quiseres levar os utilizadores e os cursos do `db.sqlite3` local:

```
# no computador (backend/)
.venv/bin/python manage.py dumpdata --natural-foreign --natural-primary \
  -e contenttypes -e auth.permission -e sessions -e admin.logentry --indent 1 > dados.json
```

- Envia o `dados.json` e a pasta `media/` para o `eyk-api`, com `scp` através do SSH do Render ou a partir de um bucket temporário.
- Na **Shell** do `eyk-api`, corre `python manage.py loaddata dados.json`.
- Copia a media para `/var/data/media`.

## Variáveis de ambiente

| Variável | Onde | Para quê |
|---|---|---|
| `DJANGO_ENV=prod` | api, worker | Carrega `config/settings/prod.py` |
| `DJANGO_SECRET_KEY` | api, worker | Gerada pelo Render; tem de ser a mesma nos dois serviços (grupo `eyk-comum`) |
| `DATABASE_URL` | api, worker | PostgreSQL |
| `CELERY_BROKER_URL` | api, worker | Redis. Sem ela, as tarefas correm no próprio pedido e não há agendador |
| `CACHE_URL` | api, worker | Redis: limites de frequência partilhados entre processos |
| `NEXT_PUBLIC_URL` | api, worker | URL do frontend: links nos emails, CORS, CSRF e hosts aceites |
| `MEDIA_ROOT` | api | Pasta da media no disco |
| `CONFIAR_X_FORWARDED_FOR=True` | api | Usa o IP real do utilizador (limites, sessões) |
| `API_INTERNO` | web (build) | `host:porta` interno do `eyk-api` |
| `NEXT_PUBLIC_API_URL=/` | web (build) | A API está no mesmo domínio |
| `SENTRY_DSN` | api, worker | Opcional: erros enviados para o Sentry |

## Problemas comuns

- **O painel diz "O agendador não dá sinal".** O `eyk-worker` está parado ou a falhar. Vê os *Logs* do serviço. Sem o worker, os anúncios ficam "Na fila" e o lembrete não sai. Assim que o worker volta, envia o que estava em atraso no mesmo dia.
- **403 "CSRF Failed" ou o login não fica guardado.** O `NEXT_PUBLIC_URL` não corresponde ao endereço aberto no browser. Corrige-o e faz deploy do `eyk-api`.
- **Os emails não chegam.** Confirma as variáveis `EMAIL_*`. Com Gmail, a conta precisa de verificação em 2 passos e de uma palavra-passe de app.
  - Os serviços *free* do Render bloqueiam o SMTP; os *Starter* não.
  - Os emails só vão para contas com o email confirmado.
- **O upload de um vídeo grande falha.** O limite está em **Plataforma → Limites de upload**. Confirma também que o disco tem espaço.
