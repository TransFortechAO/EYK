from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.accounts'

    def ready(self):
        import apps.accounts.sessoes  # noqa: F401  (recetores de login/logout)
        import apps.accounts.signals  # noqa: F401
