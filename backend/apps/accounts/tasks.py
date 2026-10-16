from celery import shared_task

from .utils.import_teacher import import_teacher_from_google_sheet


@shared_task
def sync_teachers():
    import_teacher_from_google_sheet()
    return 'Professores importados com succeso'