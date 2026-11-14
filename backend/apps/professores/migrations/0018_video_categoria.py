import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cursos', '0010_consentimento_ia_lga'),
        ('professores', '0017_consentimento_ia_lga'),
    ]

    operations = [
        migrations.AddField(
            model_name='video',
            name='categoria',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='videos', to='cursos.categoria',
            ),
        ),
    ]
