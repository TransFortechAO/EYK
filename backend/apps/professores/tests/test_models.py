import pytest

from apps.professores.models import Professor, ReacaoVideo, Seguidor, Video


@pytest.mark.django_db
class TestProfessorModel:
    def test_str_retorna_nome_publico(self, professor_user):
        professor = Professor.objects.create(
            user=professor_user, nome_publico="Professor Um", area="Matemática",
        )
        assert str(professor) == "Professor Um"

    def test_ativo_por_default(self, professor):
        assert professor.ativo is True


@pytest.mark.django_db
class TestVideoModel:
    def test_str_retorna_titulo(self, professor):
        video = Video.objects.create(professor=professor, titulo="Aula 1")
        assert str(video) == "Aula 1"

    def test_total_likes_conta_apenas_reacoes_like(self, professor, aluno_user, professor_user):
        video = Video.objects.create(professor=professor, titulo="Aula 1")
        ReacaoVideo.objects.create(video=video, utilizador=aluno_user, tipo="like")
        ReacaoVideo.objects.create(video=video, utilizador=professor_user, tipo="dislike")
        assert video.total_likes() == 1

    def test_ordering_por_ordem_depois_mais_recente(self, professor):
        segundo = Video.objects.create(professor=professor, titulo="Segundo", ordem=1)
        primeiro = Video.objects.create(professor=professor, titulo="Primeiro", ordem=0)
        assert list(Video.objects.all()) == [primeiro, segundo]


@pytest.mark.django_db
class TestSeguidorModel:
    def test_um_utilizador_nao_pode_seguir_o_mesmo_professor_duas_vezes(self, professor, aluno_user):
        Seguidor.objects.create(utilizador=aluno_user, professor=professor)
        with pytest.raises(Exception):
            Seguidor.objects.create(utilizador=aluno_user, professor=professor)
