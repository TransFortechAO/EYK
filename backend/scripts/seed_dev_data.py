#!/usr/bin/env python3
"""
Script para popular o banco de dados com dados de desenvolvimento
Útil para testar a aplicação localmente sem precisar criar todo o conteúdo manualmente
"""
import os
import random

import django
from django.contrib.auth import get_user_model
from django.core.management import call_command
from faker import Faker

# Configura o ambiente Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

User = get_user_model()
fake = Faker('pt_BR')


def create_superuser():
    """Cria um superusuário padrão para desenvolvimento"""
    if not User.objects.filter(username='admin').exists():
        User.objects.create_superuser(
            username='admin',
            email='admin@eyk.com.br',
            password='admin123'
        )
        print("✅ Superusuário admin criado com sucesso!")
    else:
        print("ℹ️ Superusuário admin já existe.")


def create_test_users():
    """Cria usuários de teste (alunos e professores)"""
    # Cria 5 professores
    for i in range(5):
        if not User.objects.filter(email=f'professor{i+1}@eyk.com.br').exists():
            user = User.objects.create_user(
                username=f'professor{i+1}',
                email=f'professor{i+1}@eyk.com.br',
                password='teste123',
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                perfil_completo=True
            )
            print(f"✅ Professor {user.username} criado")

    # Cria 15 alunos
    for i in range(15):
        if not User.objects.filter(email=f'aluno{i+1}@eyk.com.br').exists():
            user = User.objects.create_user(
                username=f'aluno{i+1}',
                email=f'aluno{i+1}@eyk.com.br',
                password='teste123',
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                perfil_completo=True
            )
            print(f"✅ Aluno {user.username} criado")


def run_migrations():
    """Executa migrações pendentes"""
    print("\n🔄 Executando migrações...")
    call_command('migrate')
    print("✅ Migrações concluídas!")


def main():
    print("🚀 Iniciando seed de dados de desenvolvimento...")
    
    run_migrations()
    
    print("\n👥 Criando usuários de teste...")
    create_superuser()
    create_test_users()
    
    print("\n✨ Seed concluído com sucesso!")
    print("\n📝 Credenciais de acesso:")
    print("   - Admin: admin / admin123")
    print("   - Professores: professor1 a professor5 / teste123")
    print("   - Alunos: aluno1 a aluno15 / teste123")


if __name__ == '__main__':
    main()