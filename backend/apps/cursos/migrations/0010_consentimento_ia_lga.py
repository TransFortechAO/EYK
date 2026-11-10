from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cursos', '0009_editado_em'),
    ]

    operations = [
        migrations.AddField(
            model_name='curso', name='uso_ia_lga', field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='curso', name='uso_ia_lga_em', field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='curso', name='uso_ia_lga_versao', field=models.CharField(blank=True, max_length=30),
        ),
    ]
