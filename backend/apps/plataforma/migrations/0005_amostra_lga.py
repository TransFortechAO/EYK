# Generated for voluntary, private LGA research samples.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

import apps.instituicoes.armazenamento


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('plataforma', '0004_gestos_lga'),
    ]

    operations = [
        migrations.CreateModel(
            name='AmostraLGA',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('palavra', models.CharField(max_length=60)),
                ('variante', models.CharField(blank=True, help_text='Província ou variante regional, se conhecida.', max_length=80)),
                ('video', models.FileField(storage=apps.instituicoes.armazenamento.storage_privado, upload_to='lga-amostras/')),
                ('consentimento_versao', models.CharField(max_length=30)),
                ('consentido_em', models.DateTimeField()),
                ('confirmacao_representante', models.BooleanField(default=False)),
                ('estado', models.CharField(choices=[('pendente', 'Pendente'), ('validada', 'Validada'), ('rejeitada', 'Rejeitada')], default='pendente', max_length=12)),
                ('nota_revisao', models.CharField(blank=True, max_length=500)),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('revisto_em', models.DateTimeField(blank=True, null=True)),
                ('autor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='amostras_lga', to=settings.AUTH_USER_MODEL)),
                ('revisto_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='amostras_lga_revistas', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-criado_em']},
        ),
    ]
