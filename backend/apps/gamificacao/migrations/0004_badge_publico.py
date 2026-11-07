from django.db import migrations, models

DE_ALUNO = ['primeira-aula', 'cinefilo', 'perfeccionista', 'eficiente', 'aluno-dedicado', 'colecionador']
DE_PROFESSOR = ['professor-popular', 'professor-influente', 'mentor']


def separar(apps, schema_editor):
    Badge = apps.get_model('gamificacao', 'Badge')
    Badge.objects.filter(slug__in=DE_ALUNO).update(publico='aluno')
    Badge.objects.filter(slug__in=DE_PROFESSOR).update(publico='professor')


class Migration(migrations.Migration):

    dependencies = [
        ('gamificacao', '0003_badges_professor'),
    ]

    operations = [
        migrations.AddField(
            model_name='badge',
            name='publico',
            field=models.CharField(
                choices=[('todos', 'Todos'), ('aluno', 'Alunos'), ('professor', 'Professores')], default='todos',
                max_length=10,
            ),
        ),
        migrations.RunPython(separar, migrations.RunPython.noop),
    ]
