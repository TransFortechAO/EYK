import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cursos', '0010_consentimento_ia_lga'),
        ('plataforma', '0005_amostra_lga'),
        ('professores', '0017_consentimento_ia_lga'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='FonteDatasetLGA',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('estado', models.CharField(choices=[('sugerida', 'Sugerida pelo sistema'), ('aprovada', 'Aprovada para o dataset'), ('rejeitada', 'Rejeitada'), ('retirada', 'Autorização retirada')], db_index=True, default='sugerida', max_length=12)),
                ('pontuacao', models.PositiveSmallIntegerField(default=0)),
                ('motivos', models.JSONField(blank=True, default=list)),
                ('palavra', models.CharField(blank=True, help_text='Rótulo do gesto ou palavra visível no segmento.', max_length=60)),
                ('inicio_segundos', models.PositiveIntegerField(blank=True, null=True)),
                ('fim_segundos', models.PositiveIntegerField(blank=True, null=True)),
                ('nota_revisao', models.CharField(blank=True, max_length=500)),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('atualizado_em', models.DateTimeField(auto_now=True)),
                ('revisto_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='fontes_dataset_lga_revistas', to=settings.AUTH_USER_MODEL)),
                ('video', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='fonte_dataset_lga', to='professores.video')),
            ],
            options={'ordering': ['-pontuacao', '-atualizado_em']},
        ),
    ]
