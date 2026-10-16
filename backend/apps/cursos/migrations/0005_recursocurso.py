from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cursos', '0004_curso_atualizado_em'),
    ]

    operations = [
        migrations.CreateModel(
            name='RecursoCurso',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(max_length=200)),
                ('tipo', models.CharField(choices=[('pdf', 'PDF')], default='pdf', max_length=20)),
                ('arquivo', models.FileField(upload_to='cursos/recursos/')),
                ('tamanho_bytes', models.PositiveIntegerField(default=0)),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('curso', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='recursos', to='cursos.curso')),
            ],
            options={
                'ordering': ['-criado_em'],
            },
        ),
    ]
