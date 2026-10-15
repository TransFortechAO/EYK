import type { Metadata } from "next";
import {
  CONTACTO_LEGAL,
  DocumentoLegal,
  EmailContacto,
  Lista,
  Secao,
  SubSecao,
} from "@/components/legal/documento-legal";

export const metadata: Metadata = {
  title: "Política de Privacidade · EYK",
  description: "Como a EYK trata, conserva e protege os dados pessoais dos utilizadores.",
};

export default function PoliticaPrivacidadePage() {
  return (
    <DocumentoLegal
      titulo="Política de Privacidade"
      subtitulo="Tratamento de dados pessoais, conservação, segurança e direitos dos titulares"
    >
      <Secao id="introducao" titulo="1. Introdução">
        <p>
          A EYK — Ekola Ya Kelela — respeita a privacidade dos seus utilizadores e procura proteger os dados
          pessoais tratados no âmbito da utilização da plataforma.
        </p>
        <p>
          Esta Política explica quais os dados que podem ser recolhidos, para que finalidades são utilizados,
          durante quanto tempo são conservados, com quem podem ser partilhados e como os titulares podem exercer
          os seus direitos.
        </p>
        <p>
          O tratamento de dados será realizado de acordo com a legislação aplicável em Angola, incluindo a Lei n.º
          22/11, de 17 de junho, de Proteção de Dados Pessoais.
        </p>
      </Secao>

      <Secao id="responsavel" titulo="2. Responsável pelo tratamento">
        <p>O responsável pelo tratamento dos dados pessoais é:</p>
        <Lista
          itens={[
            <>Entidade responsável: {CONTACTO_LEGAL.entidade}</>,
            <>
              E-mail para assuntos de privacidade: <EmailContacto />
            </>,
          ]}
        />
        <p>
          A identificação desta entidade permite aos utilizadores saber quem responde pelos seus dados e onde
          podem apresentar os seus pedidos.
        </p>
      </Secao>

      <Secao id="dados-recolhidos" titulo="3. Que dados podemos recolher">
        <SubSecao titulo="3.1. Dados de identificação e conta">
          <Lista
            itens={[
              "Nome ou nome de utilizador.",
              "Endereço de e-mail, quando solicitado.",
              "Palavra-passe armazenada de forma protegida, nunca em texto simples.",
              "Tipo de conta, como aluno, professor ou administrador.",
              "Idade ou informação estritamente necessária para determinar a autorização aplicável.",
              "Dados necessários para gerir a autorização do encarregado de educação, quando aplicável.",
            ]}
          />
        </SubSecao>
        <SubSecao titulo="3.2. Dados do perfil">
          <Lista
            itens={[
              "Fotografia de perfil, se fornecida.",
              "Biografia, área de ensino e outras informações que o utilizador escolha disponibilizar.",
              "Informações profissionais dos professores necessárias para a apresentação do seu perfil.",
            ]}
          />
        </SubSecao>
        <SubSecao titulo="3.3. Dados de aprendizagem">
          <Lista
            itens={[
              "Cursos inscritos ou consultados.",
              "Aulas e vídeos visualizados.",
              "Progresso de aprendizagem e atividades concluídas.",
              "Pontos, moedas virtuais, níveis e conquistas.",
              "Comentários, publicações e interações realizadas na plataforma.",
            ]}
          />
          <p>
            Estes dados serão utilizados para disponibilizar as funcionalidades educativas correspondentes e não
            deverão ser usados para criar perfis invasivos ou discriminar os alunos.
          </p>
        </SubSecao>
        <SubSecao titulo="3.4. Conteúdos publicados">
          <p>
            A plataforma poderá armazenar vídeos, imagens, textos, documentos, comentários e outros ficheiros
            enviados pelos utilizadores. Os ficheiros podem conter imagem ou voz de pessoas identificadas ou
            identificáveis. Por isso, os utilizadores devem evitar publicar dados pessoais de terceiros sem
            autorização adequada.
          </p>
        </SubSecao>
        <SubSecao titulo="3.5. Dados técnicos e de segurança">
          <Lista
            itens={[
              "Endereço IP e informações básicas do dispositivo ou navegador.",
              "Datas de acesso e registos de atividade.",
              "Registos de autenticação e tentativas de acesso.",
              "Informações técnicas utilizadas para diagnosticar erros e prevenir abusos.",
            ]}
          />
          <p>
            A recolha deve limitar-se ao necessário para assegurar o funcionamento, a manutenção e a segurança da
            plataforma.
          </p>
        </SubSecao>
      </Secao>

      <Secao id="finalidades" titulo="4. Para que utilizamos os dados">
        <Lista
          itens={[
            "Criar, autenticar e gerir contas.",
            "Disponibilizar cursos, vídeos, materiais educativos e funcionalidades de aprendizagem.",
            "Guardar o progresso dos alunos e apresentar conquistas ou recompensas.",
            "Permitir a publicação e a gestão de conteúdos pelos professores.",
            "Processar denúncias, investigar violações dos Termos e proteger os utilizadores.",
            "Prevenir acessos indevidos, fraude, spam e utilização abusiva.",
            "Responder a pedidos, reclamações e solicitações dos titulares.",
            "Cumprir obrigações legais aplicáveis.",
            "Melhorar a plataforma através de análises técnicas proporcionais e, sempre que possível, de dados agregados ou anonimizados.",
          ]}
        />
        <p>
          Cada finalidade deve ter um fundamento jurídico adequado. Quando o tratamento depender de consentimento,
          este deverá ser livre, específico, informado e demonstrável, nos termos aplicáveis.
        </p>
        <p>
          A aceitação desta Política não substitui os consentimentos específicos que sejam legalmente necessários.
        </p>
      </Secao>

      <Secao id="menores" titulo="5. Dados de crianças e adolescentes">
        <p>
          A EYK reconhece que os seus utilizadores podem incluir crianças e adolescentes e que estes merecem
          proteção reforçada.
        </p>
        <Lista
          itens={[
            "Serão recolhidos apenas os dados necessários para a finalidade educativa.",
            "Quando exigido, será obtida autorização do pai, mãe, encarregado de educação ou representante legal.",
            "A linguagem das informações destinadas a menores deverá ser simples e compreensível.",
            "Não deverão ser publicados dados de contacto, moradas, documentos de identificação ou outras informações sensíveis de alunos sem necessidade e autorização adequadas.",
            "Não serão utilizados dados de menores para publicidade comportamental ou finalidades incompatíveis com a educação sem uma base jurídica válida e as garantias exigidas.",
            "Pedidos de acesso, correção ou eliminação apresentados por representantes legais serão analisados de acordo com a lei e com os direitos da criança.",
          ]}
        />
        <p>
          A EYK deverá estabelecer procedimentos para verificar as autorizações necessárias sem recolher cópias de
          documentos de identificação de forma indiscriminada.
        </p>
      </Secao>

      <Secao id="partilha" titulo="6. Com quem podemos partilhar os dados">
        <p>
          A EYK não deverá comercializar os dados pessoais dos seus utilizadores. Os dados poderão ser
          disponibilizados, estritamente na medida necessária, a:
        </p>
        <Lista
          itens={[
            "Prestadores de alojamento, armazenamento, manutenção e segurança da plataforma.",
            "Prestadores de serviços técnicos necessários ao funcionamento da conta.",
            "Professores ou responsáveis autorizados, quando precisem de informações para executar as respetivas funções educativas.",
            "Autoridades competentes, quando a comunicação for legalmente exigida ou autorizada.",
          ]}
        />
        <p>
          Os prestadores de serviços deverão estar sujeitos a obrigações adequadas de confidencialidade, segurança e
          utilização dos dados apenas para as finalidades contratadas.
        </p>
        <p>
          A EYK deverá informar os utilizadores sobre transferências internacionais de dados que ocorram através dos
          seus fornecedores e verificar os requisitos legais aplicáveis antes dessas transferências.
        </p>
      </Secao>

      <Secao id="conservacao" titulo="7. Durante quanto tempo conservamos os dados">
        <p>
          Os dados serão conservados apenas durante o período necessário às finalidades para as quais foram
          recolhidos, respeitando as obrigações legais aplicáveis.
        </p>
        <p>Os prazos de conservação indicativos são os seguintes:</p>
        <Lista
          itens={[
            "Dados da conta ativa: enquanto a conta estiver ativa e forem necessários ao serviço.",
            "Perfil e conteúdos publicados: enquanto estiverem ativos ou até ao pedido de remoção, ressalvadas obrigações legítimas de conservação.",
            "Progresso e gamificação: enquanto forem necessários à prestação do serviço educativo ou até ao pedido aplicável de eliminação.",
            "Registos técnicos de segurança: até 180 dias, salvo necessidade justificada de conservação adicional.",
            "Denúncias e registos de moderação: até 12 meses após o encerramento do caso, salvo necessidade justificada ou obrigação legal.",
            "Dados de contas eliminadas: eliminação ou anonimização, em regra, no prazo operacional de 30 dias após o pedido validado, ressalvadas cópias de segurança e obrigações legais.",
          ]}
        />
        <p>
          As cópias de segurança poderão conservar temporariamente dados eliminados até ao ciclo normal de
          substituição, devendo existir medidas para impedir a sua utilização corrente e evitar que os dados sejam
          reintroduzidos indevidamente.
        </p>
      </Secao>

      <Secao id="seguranca" titulo="8. Segurança dos dados">
        <p>
          A EYK deverá adotar medidas técnicas e organizativas proporcionais aos riscos, incluindo, conforme
          aplicável:
        </p>
        <Lista
          itens={[
            "Proteção das palavras-passe através de mecanismos seguros de hash.",
            "Controlo de acesso por funções e permissões.",
            "Utilização de ligações seguras.",
            "Cópias de segurança e procedimentos de recuperação.",
            "Atualizações e correções de segurança.",
            "Proteção contra acessos não autorizados.",
            "Procedimentos para identificar e responder a incidentes de segurança.",
          ]}
        />
        <p>
          Nenhum sistema é completamente imune a riscos. Caso ocorra um incidente, a EYK deverá avaliar a situação e
          cumprir as obrigações de comunicação que forem legalmente aplicáveis.
        </p>
      </Secao>

      <Secao id="direitos" titulo="9. Direitos dos titulares dos dados">
        <p>
          Nos termos da legislação aplicável, os titulares poderão exercer os direitos que lhes assistam, incluindo:
        </p>
        <Lista
          itens={[
            "Direito de informação: saber como os dados são tratados.",
            "Direito de acesso: obter confirmação sobre o tratamento e aceder aos dados abrangidos pelo direito.",
            "Direito de retificação: corrigir dados inexatos ou incompletos.",
            "Direito de atualização: manter os dados corretos e atuais.",
            "Direito de eliminação ou cancelamento: solicitar a eliminação dos dados, quando legalmente aplicável.",
            "Direito de oposição: opor-se a determinados tratamentos, quando a lei o permita.",
            "Direito relativo ao consentimento: retirar o consentimento quando este for a base do tratamento, sem afetar a licitude do tratamento anterior à retirada.",
          ]}
        />
        <p>
          O exercício destes direitos poderá estar sujeito a verificação razoável da identidade e, nos casos de
          menores, da legitimidade do representante.
        </p>
        <p>
          Alguns dados poderão ter de ser conservados quando exista obrigação legal ou outra razão legítima prevista
          na lei. Nesses casos, a EYK explicará, na medida legalmente permitida, o motivo da conservação.
        </p>
      </Secao>

      <Secao id="exercer-direitos" titulo="10. Como exercer os direitos">
        <p>Os pedidos relativos aos dados pessoais devem ser enviados para:</p>
        <p>
          E-mail: <EmailContacto />
        </p>
        <p>
          O pedido deverá indicar o direito que se pretende exercer e fornecer informações suficientes para
          identificar a conta, evitando o envio desnecessário de documentos ou dados sensíveis.
        </p>
        <p>A EYK confirmará a receção e responderá nos prazos legalmente aplicáveis.</p>
        <p>
          Se o titular considerar que os seus direitos não foram respeitados, poderá procurar orientação ou
          apresentar reclamação junto da Agência de Proteção de Dados (APD), nos termos aplicáveis.
        </p>
      </Secao>

      <Secao id="cookies" titulo="11. Cookies e armazenamento local">
        <p>
          A EYK poderá utilizar cookies ou mecanismos equivalentes para manter a sessão iniciada, proteger a
          autenticação, guardar preferências e assegurar o funcionamento das funcionalidades.
        </p>
        <p>
          Se forem utilizados mecanismos de análise, publicidade ou rastreamento não essenciais, a plataforma deverá
          informar os utilizadores sobre a sua finalidade e obter o consentimento quando exigido.
        </p>
        <p>
          As preferências guardadas no navegador, incluindo o progresso armazenado localmente, poderão deixar de
          estar disponíveis quando o utilizador limpar os dados do navegador ou mudar de dispositivo.
        </p>
      </Secao>

      <Secao id="servicos-externos" titulo="12. Ligações e serviços externos">
        <p>A plataforma poderá incluir ligações para serviços externos ou incorporar conteúdos de terceiros.</p>
        <p>
          A EYK não controla integralmente as políticas de privacidade desses serviços. Antes de utilizar serviços
          externos, o utilizador deverá consultar as respetivas condições e políticas.
        </p>
        <p>
          A integração de um serviço externo não autoriza automaticamente a partilha de todos os dados do utilizador
          com esse serviço.
        </p>
      </Secao>

      <Secao id="alteracoes" titulo="13. Alterações a esta Política">
        <p>Esta Política poderá ser atualizada para refletir alterações legais, técnicas ou funcionais.</p>
        <p>
          As alterações relevantes serão comunicadas de forma adequada. Quando necessário, será solicitado novo
          consentimento.
        </p>
        <p>A versão em vigor indica a data da última atualização.</p>
      </Secao>

      <Secao id="contactos" titulo="14. Contactos e autoridade de supervisão">
        <Lista
          itens={[
            <>Responsável pelo tratamento: {CONTACTO_LEGAL.entidade}</>,
            <>
              Contacto de privacidade: <EmailContacto />
            </>,
            <>
              Autoridade de referência em Angola: Agência de Proteção de Dados (APD) —{" "}
              <a
                href="https://apd.ao"
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline"
              >
                https://apd.ao
              </a>
            </>,
          ]}
        />
        <p className="pt-2 text-white/55">A educação acessível começa com o respeito pelos direitos de cada pessoa.</p>
      </Secao>
    </DocumentoLegal>
  );
}
