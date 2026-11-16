from django.db import migrations


def aprovar_existentes(apps, schema_editor):
    """Quem já é professor (candidatura concluída antes desta fase) fica aprovado, sem
    interromper nada. Candidaturas que nunca criaram conta continuam por completar."""
    Candidatura = apps.get_model('professores', 'CandidaturaProfessor')
    Historico = apps.get_model('professores', 'HistoricoCandidatura')
    for c in Candidatura.objects.filter(user__isnull=False, user__is_teacher=True):
        c.estado = 'aprovada'
        c.save(update_fields=['estado'])
        Historico.objects.create(
            candidatura=c, de='', para='aprovada', mensagem='Professor anterior ao processo de aprovação.',
        )


class Migration(migrations.Migration):

    dependencies = [
        ('professores', '0019_candidatura_fase1'),
    ]

    operations = [
        migrations.RunPython(aprovar_existentes, migrations.RunPython.noop),
    ]
