from django.db import migrations


def criar(apps, schema_editor):
    """Professores criados sem candidatura (ex: pela administração) passam a ter uma, já
    aprovada, para a equipa EYK os poder acompanhar e, se preciso, suspender."""
    Professor = apps.get_model('professores', 'Professor')
    Candidatura = apps.get_model('professores', 'CandidaturaProfessor')
    Historico = apps.get_model('professores', 'HistoricoCandidatura')
    com_candidatura = set(Candidatura.objects.filter(user__isnull=False).values_list('user_id', flat=True))
    for prof in Professor.objects.select_related('user').exclude(user_id__in=com_candidatura):
        u = prof.user
        c = Candidatura.objects.create(
            nome=prof.nome_publico or u.first_name or u.username, email=u.email or '', user=u,
            area=prof.area or '', apresentacao=prof.bio or '', estado='aprovada' if prof.ativo else 'suspensa',
        )
        Historico.objects.create(candidatura=c, de='', para=c.estado, mensagem='Professor anterior ao processo de aprovação.')


class Migration(migrations.Migration):

    dependencies = [
        ('professores', '0022_seguranca_professores'),
    ]

    operations = [
        migrations.RunPython(criar, migrations.RunPython.noop),
    ]
