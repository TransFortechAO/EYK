from django import forms

from .models import Categoria, Curso


class CursoForm(forms.ModelForm):
    """Formulário para criar e editar cursos"""

    categoria_nome = forms.CharField(
        max_length=100,
        required=False,
        label='Categoria',
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ex: Programação, Design, Marketing...'
        })
    )

    class Meta:
        model = Curso
        fields = ['titulo', 'descricao', 'preco', 'duracao', 'thumbnail', 'ativo']
        widgets = {
            'titulo': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Título do curso'}),
            'descricao': forms.Textarea(attrs={'class': 'form-control', 'rows': 4, 'placeholder': 'Descrição do curso'}),
            'preco': forms.NumberInput(attrs={'class': 'form-control', 'placeholder': '0.00'}),
            'duracao': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: 10 horas, 3 semanas...'}),
            'thumbnail': forms.FileInput(attrs={'class': 'form-control'}),
            'ativo': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }
        labels = {
            'titulo': 'Título',
            'descricao': 'Descrição',
            'preco': 'Preço (AOA)',
            'duracao': 'Duração',
            'thumbnail': 'Imagem de Capa',
            'ativo': 'Publicar curso',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Se estamos a editar, pré-preenche a categoria
        if self.instance and self.instance.pk and self.instance.categoria:
            self.fields['categoria_nome'].initial = self.instance.categoria.nome

    def save(self, commit=True):
        curso = super().save(commit=False)
        categoria_nome = self.cleaned_data.get('categoria_nome', '').strip()
        if categoria_nome:
            categoria, _ = Categoria.objects.get_or_create(nome=categoria_nome)
            curso.categoria = categoria
        if commit:
            curso.save()
        return curso
