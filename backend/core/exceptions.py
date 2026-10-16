from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    """
    Handler de exceções uniforme para toda a API
    """
    # Chama o handler padrão primeiro
    response = exception_handler(exc, context)

    # Se não houver resposta, trata erros específicos
    if response is None:
        if isinstance(exc, DjangoValidationError):
            data = {
                'error': 'Erro de validação',
                'detail': exc.message_dict if hasattr(exc, 'message_dict') else str(exc)
            }
            return Response(data, status=status.HTTP_400_BAD_REQUEST)
            
        elif isinstance(exc, IntegrityError):
            data = {
                'error': 'Erro de integridade do banco de dados',
                'detail': str(exc)
            }
            return Response(data, status=status.HTTP_409_CONFLICT)
            
        else:
            data = {
                'error': 'Erro interno do servidor',
                'detail': str(exc)
            }
            return Response(data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Adiciona estrutura padronizada às respostas existentes
    if response.data:
        custom_data = {
            'error': response.status_text,
            'detail': response.data
        }
        response.data = custom_data

    return response