import pytest
from django.db.models.signals import post_save

from apps.professores.conduta import VERSAO
from apps.professores.models import Professor


def _conduta_aceite(sender, instance, created, **kwargs):
    if created and not instance.conduta_versao:
        Professor.objects.filter(pk=instance.pk).update(conduta_versao=VERSAO)
        instance.conduta_versao = VERSAO


@pytest.fixture(autouse=True)
def professores_com_conduta(request):
    """Nos testes da área do professor, os professores já aceitaram o código de conduta.
    Os testes da conduta pedem o contrário com @pytest.mark.sem_conduta."""
    if request.node.get_closest_marker('sem_conduta'):
        yield
        return
    post_save.connect(_conduta_aceite, sender=Professor, dispatch_uid='teste-conduta')
    yield
    post_save.disconnect(sender=Professor, dispatch_uid='teste-conduta')
