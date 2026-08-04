import secrets

import gspread
from django.conf import settings
from django.contrib.auth import get_user_model
from google.oauth2.service_account import Credentials

User = get_user_model()

def import_teacher_from_google_sheet():
    SCOPES = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
    ]

    credentials = Credentials.from_service_account_file(settings.GOOGLE_CREDENTIALS_FILE, scopes=SCOPES)
    client = gspread.authorize(credentials)
    SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1ESZlIE1e7v9c88JWmGSBe0epR9Zcr8-LwkyMkJdsk1c/edit?resourcekey=&gid=1323887326#gid=1323887326'
    sheet = client.open_by_url(SPREADSHEET_URL)
    ws = sheet.sheet1

    rows = ws.get_all_records()
    header = ws.row_values(1)

    if 'Processado' not in header:
        ws.update_cell(1, len(header)+1, 'Processado')
        header.append('Processado')

    for idx, row in enumerate(rows, start=2):
        email = (row.get('Email') or '').strip()
        status = (row.get('Status') or '').strip().lower()
        processado = str(row.get('Processado') or '').strip().lower()

        if not email or status != 'sim' or processado == 'sim':
            continue

        nome = row.get('Nome', '').strip()
        telefone = row.get('Número de telefone', '').strip()
        password = secrets.token_urlsafe(8)

        if User.objects.filter(email__iexact=email).exists():
            ws.update_cell(idx, header.index('Processado') + 1, 'Sim (existente)')
            continue

        username = email.split('@')[0]
        user = User.objects.create_user(
            username = username,
            email = email,
            password = password,
            phone_number = row.get('Número de telefone', '').strip(),
            bio = row.get('Fale mais sobre você', ''),
            morada = row.get('Morada', ''),
            is_teacher = True
        )

        print(f'Criado professor: {user.username}')
        ws.update_cell(idx, header.index('Processado') + 1, 'Sim')

    print('Importação finalizada com sucesso!')

