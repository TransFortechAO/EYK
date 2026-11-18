"""Trabalho que não precisa de fazer esperar quem pediu (emails aos seguidores, capa e
duração dos vídeos).

O plano gratuito não tem worker do Celery, por isso corre numa thread do próprio processo,
depois de a transação gravar. Nos testes (SEGUNDO_PLANO_SINCRONO) corre logo, para ser
determinístico."""
import logging
import threading

from django.conf import settings
from django.db import close_old_connections, connections, transaction

logger = logging.getLogger(__name__)


def executar_depois(funcao, *args, **kwargs) -> None:
    if getattr(settings, 'SEGUNDO_PLANO_SINCRONO', False):
        funcao(*args, **kwargs)
        return

    def correr():
        close_old_connections()
        try:
            funcao(*args, **kwargs)
        except Exception:
            logger.exception('Falhou a tarefa em segundo plano %s', getattr(funcao, '__name__', funcao))
        finally:
            # A thread abriu a sua própria ligação à base de dados: fecha-a.
            connections.close_all()

    transaction.on_commit(lambda: threading.Thread(target=correr, daemon=True, name='eyk-segundo-plano').start())
