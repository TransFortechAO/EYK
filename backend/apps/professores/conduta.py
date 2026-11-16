"""Código de conduta dos professores da EYK. Mudar o texto obriga a mudar a VERSAO: todos
os professores voltam a aceitá-lo antes de criar ou publicar."""

VERSAO = '2026-11.1'

REGRAS = [
    'Trato todos os alunos com respeito, sem discriminação, e uso linguagem adequada à idade.',
    'Partilho apenas conteúdos de que sou autor ou que tenho direito de usar, e corretos para a minha área.',
    'Não peço dados pessoais, fotografias nem contactos privados aos alunos, e não marco encontros fora da plataforma.',
    'Com crianças e adolescentes, comunico só nos espaços da EYK e sigo as regras de proteção de menores.',
    'Não publico conteúdos violentos, sexuais, de ódio ou que ponham alguém em risco.',
    'Respondo a denúncias e aceito que a equipa EYK suspenda a minha autorização se as regras forem quebradas.',
]


def texto() -> dict:
    return {'versao': VERSAO, 'regras': REGRAS}
