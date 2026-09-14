from django.db import migrations


BADGES_PROFESSOR = [
    ('professor-popular', 'Professor Popular', 'Atinge 500 visualizações totais', 'Eye', 12),
    ('professor-influente', 'Professor Influente', 'Atinge 2000 visualizações totais', 'TrendingUp', 13),
    ('mentor', 'Mentor', 'Publica 10 aulas ou vídeos', 'Video', 14),
]


def seed(apps, schema_editor):
    Badge = apps.get_model('gamificacao', 'Badge')
    for slug, nome, descricao, icone, ordem in BADGES_PROFESSOR:
        Badge.objects.get_or_create(
            slug=slug,
            defaults={'nome': nome, 'descricao': descricao, 'icone': icone, 'ordem': ordem},
        )


def remove(apps, schema_editor):
    Badge = apps.get_model('gamificacao', 'Badge')
    Badge.objects.filter(slug__in=[b[0] for b in BADGES_PROFESSOR]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('gamificacao', '0002_badge_carteira_xp_alter_transacaomoeda_motivo_and_more'),
    ]

    operations = [
        migrations.RunPython(seed, remove),
    ]
