import pytest

from apps.cursos.models import Categoria, Curso, EngajamentoCurso, Inscricao


@pytest.fixture
def categoria(db):
    return Categoria.objects.create(nome="Matemática")


@pytest.fixture
def curso(db, professor, categoria):
    return Curso.objects.create(
        professor=professor, titulo="Álgebra Linear", descricao="Curso introdutório",
        categoria=categoria,
    )


@pytest.mark.django_db
class TestCategoriaModel:
    def test_str_retorna_nome(self, categoria):
        assert str(categoria) == "Matemática"


@pytest.mark.django_db
class TestCursoModel:
    def test_str_retorna_titulo(self, curso):
        assert str(curso) == "Álgebra Linear"

    def test_ativo_por_default(self, curso):
        assert curso.ativo is True

    def test_total_inscritos_sem_inscricoes(self, curso):
        assert curso.total_inscritos() == 0

    def test_total_inscritos_conta_inscricoes(self, curso, aluno):
        Inscricao.objects.create(aluno=aluno, curso=curso)
        assert curso.total_inscritos() == 1

    def test_total_visualizacoes_soma_engajamentos(self, curso, aluno):
        EngajamentoCurso.objects.create(curso=curso, aluno=aluno, visualizacoes=3)
        assert curso.total_visualizacoes() == 3


@pytest.mark.django_db
class TestInscricaoModel:
    def test_aluno_nao_pode_inscrever_se_duas_vezes_no_mesmo_curso(self, curso, aluno):
        Inscricao.objects.create(aluno=aluno, curso=curso)
        with pytest.raises(Exception):
            Inscricao.objects.create(aluno=aluno, curso=curso)

    def test_concluido_e_false_por_default(self, curso, aluno):
        inscricao = Inscricao.objects.create(aluno=aluno, curso=curso)
        assert inscricao.concluido is False
