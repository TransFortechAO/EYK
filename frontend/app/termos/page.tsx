import type { Metadata } from "next";
import Link from "next/link";
import {
  CONTACTO_LEGAL,
  DocumentoLegal,
  EmailContacto,
  Lista,
  Secao,
  SubSecao,
} from "@/components/legal/documento-legal";

export const metadata: Metadata = {
  title: "Termos de Utilização · EYK",
  description: "Condições de acesso e utilização da plataforma EYK — Ekola Ya Kelela.",
};

export default function TermosUtilizacaoPage() {
  return (
    <DocumentoLegal
      titulo="Termos de Utilização"
      subtitulo="Condições de acesso, publicação de conteúdos, gamificação, moderação e recursos"
    >
      <Secao id="apresentacao" titulo="1. Apresentação">
        <p>
          A EYK — Ekola Ya Kelela — é uma plataforma digital de apoio à educação, concebida para facilitar o acesso a
          conteúdos educativos, vídeos, cursos e recursos de aprendizagem, incluindo funcionalidades destinadas a
          alunos com necessidades educativas especiais.
        </p>
        <p>
          Estes Termos de Utilização regulam o acesso e a utilização da plataforma por alunos, professores,
          encarregados de educação e demais utilizadores autorizados.
        </p>
        <p>
          Ao criar uma conta ou utilizar a plataforma, o utilizador declara que leu e compreendeu estes Termos.
          Quando a legislação exigir a intervenção de um representante legal, a utilização fica sujeita à respetiva
          autorização.
        </p>
      </Secao>

      <Secao id="quem-pode-utilizar" titulo="2. Quem pode utilizar a plataforma">
        <p>A EYK destina-se a crianças, jovens, estudantes, professores e outros interessados em educação.</p>
        <Lista
          itens={[
            "Os utilizadores maiores de idade podem criar e gerir as suas próprias contas.",
            "Os menores de 18 anos devem utilizar a plataforma com a autorização e, quando aplicável, sob a supervisão dos pais, encarregados de educação ou representantes legais.",
            "Para crianças que ainda não tenham autonomia adequada para gerir uma conta, recomenda-se que o acesso seja realizado através de uma conta gerida por um encarregado de educação, professor ou instituição autorizada.",
            "Os professores devem fornecer informações verdadeiras e publicar apenas conteúdos que estejam autorizados a disponibilizar.",
            "A EYK pode solicitar informações razoáveis para confirmar a autorização necessária, evitando recolher dados excessivos de menores.",
          ]}
        />
        <p>
          A autorização de um encarregado de educação não elimina o dever da EYK de proteger a privacidade e os
          direitos da criança.
        </p>
      </Secao>

      <Secao id="regras" titulo="3. Regras gerais de utilização">
        <p>O utilizador compromete-se a:</p>
        <Lista
          itens={[
            "Fornecer informações verdadeiras e manter os dados da conta atualizados.",
            "Proteger as credenciais de acesso e não permitir a utilização indevida da sua conta.",
            "Respeitar os outros utilizadores, independentemente das suas capacidades, dificuldades, origem ou condição.",
            "Utilizar os conteúdos educativos para fins legítimos.",
            "Respeitar os direitos de autor e a privacidade de terceiros.",
            "Denunciar conteúdos ou comportamentos que violem estes Termos.",
          ]}
        />
        <p>É proibido:</p>
        <Lista
          itens={[
            "Publicar conteúdos ofensivos, discriminatórios, ameaçadores, violentos ou que promovam o assédio.",
            "Praticar bullying, cyberbullying, intimidação ou perseguição.",
            "Publicar imagens, vídeos, gravações ou dados pessoais de terceiros sem a devida autorização.",
            "Publicar conteúdos sexuais envolvendo menores, material de exploração infantil ou qualquer conteúdo ilegal.",
            "Copiar, vender, redistribuir ou utilizar comercialmente conteúdos de terceiros sem autorização.",
            "Fazer-se passar por outra pessoa ou utilizar contas alheias sem autorização.",
            "Tentar aceder a contas, sistemas ou dados para os quais não tenha permissão.",
            "Manipular moedas, pontos, classificações ou outras funcionalidades da plataforma.",
            "Utilizar a plataforma para fraude, spam, publicidade abusiva ou atividades ilícitas.",
          ]}
        />
      </Secao>

      <Secao id="conteudos-professores" titulo="4. Conteúdos publicados pelos professores">
        <SubSecao titulo="4.1. Propriedade dos conteúdos">
          <p>
            Salvo acordo escrito em contrário, o professor mantém os direitos de autor e os demais direitos que
            legalmente lhe pertençam sobre os conteúdos originais que publica. A publicação na EYK não transfere
            automaticamente a propriedade desses conteúdos para a plataforma.
          </p>
        </SubSecao>
        <SubSecao titulo="4.2. Licença de utilização pela EYK">
          <p>
            Ao publicar um conteúdo, o professor concede à EYK uma licença não exclusiva, limitada às finalidades de
            funcionamento da plataforma, para alojar, armazenar, reproduzir tecnicamente, apresentar e disponibilizar
            esse conteúdo aos utilizadores autorizados. Esta licença abrange as operações técnicas necessárias à
            publicação, reprodução, transmissão e visualização dos conteúdos dentro da plataforma. Não autoriza a
            venda independente dos conteúdos, a sua utilização publicitária fora da plataforma ou a transferência dos
            direitos de autor para a EYK sem acordo específico.
          </p>
          <p>
            A utilização promocional de vídeos, fotografias ou da imagem do professor fora da plataforma exige
            autorização adequada, quando legalmente necessária.
          </p>
        </SubSecao>
        <SubSecao titulo="4.3. Responsabilidades do professor">
          <p>O professor declara que:</p>
          <Lista
            itens={[
              "É titular dos direitos sobre os conteúdos ou possui as autorizações necessárias.",
              "Obteve as autorizações exigidas para utilizar imagens, vozes e trabalhos de outras pessoas.",
              "Não expõe dados pessoais de alunos desnecessariamente.",
              "Não publica gravações de menores sem as autorizações aplicáveis.",
              "Não disponibiliza materiais ilegais, enganosos ou que violem direitos de terceiros.",
            ]}
          />
        </SubSecao>
        <SubSecao titulo="4.4. Remoção dos conteúdos">
          <p>
            O professor pode solicitar a remoção dos seus conteúdos, sujeita às necessidades técnicas de
            processamento do pedido e às obrigações legais de conservação. A EYK pode restringir ou remover conteúdos
            que violem estes Termos, os direitos de terceiros ou a legislação aplicável. Sempre que possível e
            adequado, o professor será informado dos motivos e poderá apresentar recurso.
          </p>
        </SubSecao>
      </Secao>

      <Secao id="videos-cursos" titulo="5. Vídeos aleatórios e cursos">
        <p>
          A EYK pode disponibilizar publicações de vídeos individuais e cursos compostos por vários vídeos ou aulas.
        </p>
        <p>
          Um vídeo individual pode ser publicado como conteúdo autónomo. Quando vários vídeos forem organizados como
          um conjunto de aprendizagem, poderão constituir um curso, com título, descrição, categoria e organização
          das aulas.
        </p>
        <p>
          A classificação automática dos conteúdos pela plataforma não altera, por si só, a titularidade dos direitos
          de autor nem garante a qualidade pedagógica do material.
        </p>
      </Secao>

      <Secao id="gamificacao" titulo="6. Moedas, pontos e gamificação">
        <p>
          A EYK pode incluir moedas virtuais, pontos, níveis, conquistas, classificações e outras ferramentas de
          incentivo à aprendizagem.
        </p>
        <Lista
          itens={[
            "Salvo indicação expressa em condições específicas, as moedas e os pontos são elementos virtuais de utilização interna.",
            "Não constituem dinheiro, depósito, investimento ou instrumento financeiro.",
            "Não podem ser convertidos em dinheiro, transferidos para contas bancárias ou trocados por bens ou serviços externos.",
            "Não podem ser comprados, vendidos ou transferidos entre utilizadores, salvo se a EYK introduzir expressamente uma funcionalidade autorizada para esse efeito.",
            "A atribuição de recompensas deve obedecer às regras de cada atividade e não pode ser manipulada através de contas falsas, automatizações indevidas ou fraude.",
            "A EYK pode corrigir saldos atribuídos por erro ou obtidos de forma fraudulenta, mediante verificação adequada.",
            "Alterações às regras de gamificação devem ser comunicadas de forma razoável e não devem prejudicar arbitrariamente recompensas já legitimamente adquiridas.",
          ]}
        />
        <p>A EYK não garante que os pontos ou moedas tenham qualquer valor fora da plataforma.</p>
      </Secao>

      <Secao id="denuncias" titulo="7. Denúncias e moderação">
        <p>
          Qualquer utilizador pode denunciar publicações, comentários, contas ou outros comportamentos suspeitos.
        </p>
        <p>
          A EYK analisará as denúncias de acordo com a gravidade, as provas disponíveis e a necessidade de proteger
          os utilizadores, especialmente os menores.
        </p>
        <p>
          Uma denúncia não determina automaticamente a culpa do denunciado. Sempre que possível, a análise deve
          respeitar a privacidade, a imparcialidade e o direito de resposta, sem comprometer a segurança de quem
          denunciou.
        </p>
      </Secao>

      <Secao id="sancoes" titulo="8. Sanções">
        <p>
          Em caso de violação destes Termos, a EYK poderá aplicar medidas proporcionais à gravidade e à repetição da
          infração, incluindo:
        </p>
        <Lista
          itens={[
            "Advertência e orientação sobre a conduta esperada.",
            "Remoção ou ocultação de conteúdos.",
            "Restrição temporária de funcionalidades.",
            "Suspensão temporária da conta.",
            "Suspensão ou encerramento da conta em situações graves ou repetidas.",
            "Correção ou anulação de pontos e moedas obtidos fraudulentamente.",
            "Comunicação às autoridades competentes quando exigida por lei ou necessária para lidar com uma situação legalmente relevante.",
          ]}
        />
        <p>
          A EYK poderá adotar medidas imediatas quando forem necessárias para prevenir riscos sérios, proteger
          crianças ou impedir a divulgação de conteúdos ilegais.
        </p>
      </Secao>

      <Secao id="recurso" titulo="9. Recurso contra sanções">
        <p>
          O utilizador poderá contestar uma decisão de moderação ou sanção através do canal oficial de contacto da
          EYK (<EmailContacto />), indicando a conta afetada, a decisão contestada, os motivos do pedido de revisão e
          os elementos relevantes para a análise.
        </p>
        <p>Sempre que adequado, a revisão será realizada por alguém que não tenha tomado a decisão inicial.</p>
        <p>
          A EYK procurará responder num prazo razoável e explicar o resultado. A apresentação de recurso não garante
          o restabelecimento da conta ou do conteúdo.
        </p>
      </Secao>

      <Secao id="disponibilidade" titulo="10. Disponibilidade e alterações">
        <p>
          A EYK procurará manter a plataforma disponível e segura, mas não garante funcionamento ininterrupto,
          ausência absoluta de erros ou disponibilidade permanente de todos os conteúdos e funcionalidades.
        </p>
        <p>Poderão ocorrer manutenções, atualizações, alterações de funcionalidades ou interrupções técnicas.</p>
        <p>
          Alterações relevantes destes Termos serão comunicadas de forma adequada. Quando a lei exigir novo
          consentimento, este será solicitado antes da aplicação das alterações correspondentes.
        </p>
      </Secao>

      <Secao id="protecao-dados" titulo="11. Proteção de dados e legislação aplicável">
        <p>
          A utilização da plataforma está igualmente sujeita à{" "}
          <Link href="/privacidade" className="font-medium text-[#d4a24a] underline-offset-2 hover:underline">
            Política de Privacidade
          </Link>{" "}
          da EYK. O tratamento de dados pessoais deve respeitar a legislação aplicável em Angola, incluindo a Lei n.º
          22/11, de 17 de junho, de Proteção de Dados Pessoais, e as competências da Agência de Proteção de Dados
          (APD).
        </p>
      </Secao>

      <Secao id="contacto" titulo="12. Contacto">
        <p>
          Para esclarecimentos, denúncias, pedidos de revisão ou questões relativas a estes Termos, o utilizador
          poderá contactar a equipa responsável pela EYK através dos seguintes dados:
        </p>
        <Lista
          itens={[
            <>Entidade responsável: {CONTACTO_LEGAL.entidade}</>,
            <>
              E-mail: <EmailContacto />
            </>,
          ]}
        />
      </Secao>

      <Secao id="aceitacao" titulo="13. Aceitação">
        <p>
          Ao utilizar a EYK, o utilizador compromete-se a cumprir estes Termos, sem prejuízo dos direitos que lhe
          sejam garantidos pela legislação aplicável.
        </p>
        <p className="pt-2 text-white/55">EYK — Ekola Ya Kelela · Educação acessível, aprendizagem e inclusão.</p>
      </Secao>
    </DocumentoLegal>
  );
}
