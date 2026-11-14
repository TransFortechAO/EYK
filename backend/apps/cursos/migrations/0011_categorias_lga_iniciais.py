from django.db import migrations

CATEGORIAS = [
    'Alfabeto dactilológico e números',
    'Cumprimentos e expressões de cortesia',
    'Família e relações pessoais',
    'Dias da semana, meses e noções de tempo',
    'Cores e formas',
    'Alimentos e bebidas',
    'Profissões e locais de trabalho',
    'Meios de transporte e direções',
    'Emoções e estados de espírito',
    'Saúde e corpo humano',
]


def adicionar_categorias(apps, schema_editor):
    Categoria = apps.get_model('cursos', 'Categoria')
    Categoria.objects.bulk_create(
        [Categoria(nome=nome) for nome in CATEGORIAS],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('cursos', '0010_consentimento_ia_lga'),
    ]

    operations = [
        migrations.RunPython(adicionar_categorias, migrations.RunPython.noop),
    ]
