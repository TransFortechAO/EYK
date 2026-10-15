from django.db import migrations

# Ponto de partida — os administradores editam a lista em
# Administração → Moderação → Palavras proibidas.
BLOQUEAR = ['filho da puta', 'fdp', 'puta', 'caralho', 'foda-se', 'cabrão', 'paneleiro', 'viado']
SINALIZAR = ['merda', 'corno', 'idiota', 'estúpido']


def criar(apps, schema_editor):
    PalavraProibida = apps.get_model('moderacao', 'PalavraProibida')
    for termo in BLOQUEAR:
        PalavraProibida.objects.get_or_create(termo=termo, defaults={'acao': 'bloquear'})
    for termo in SINALIZAR:
        PalavraProibida.objects.get_or_create(termo=termo, defaults={'acao': 'sinalizar'})


def remover(apps, schema_editor):
    apps.get_model('moderacao', 'PalavraProibida').objects.filter(termo__in=BLOQUEAR + SINALIZAR).delete()


class Migration(migrations.Migration):
    dependencies = [('moderacao', '0001_initial')]
    operations = [migrations.RunPython(criar, remover)]
