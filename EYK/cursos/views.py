# Create your views here.

from django.shortcuts import render

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from .models import Curso
from .serializers import CursoSerializer


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def cursos_do_professor(request):
    if request.method == 'GET':
        cursos = Curso.objects.filter(professor=request.user)
        serializer = CursoSerializer(cursos, many=True)
        return Response(serializer.data)
    
    if request.method == 'POST':
        serializer = CursoSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(professor=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def curso_detalhado_professor(request, curso_id):


    try:
        curso = Curso.objects.get(id=curso_id, professor=request.user)
    except Curso.DoesNotExist:
        return Response({'erro': 'Curso não encontrado'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = CursoSerializer(curso)
        return Response(serializer.data)

    if request.method == 'PUT':
        serializer = CursoSerializer(curso, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        curso.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)



@api_view(['GET'])
@permission_classes([AllowAny])
def feed_aluno(request):
    cursos = Curso.object.all().order_by('-criado_em')[:10]
    serializer = CursoSerializer(cursos, many=True)
    return Response(serializer.data)