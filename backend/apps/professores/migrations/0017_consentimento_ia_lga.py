from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('professores', '0016_editado_em'),
    ]

    operations = [
        migrations.AddField(
            model_name='video', name='uso_ia_lga', field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='video', name='uso_ia_lga_em', field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='video', name='uso_ia_lga_versao', field=models.CharField(blank=True, max_length=30),
        ),
    ]
