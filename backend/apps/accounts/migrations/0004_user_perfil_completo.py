from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_remove_user_bio_alter_user_morada'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='perfil_completo',
            field=models.BooleanField(default=False),
        ),
    ]
