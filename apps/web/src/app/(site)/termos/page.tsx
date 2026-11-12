import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/legal";
import { COMPANY, CONTACT, TRIAL } from "@/lib/site";

export const metadata: Metadata = {
	title: "Termos de Uso",
	description: "Regras de uso do IA2S Cast.",
};

export default function TermsPage() {
	return (
		<LegalPage
			title="Termos de Uso"
			intro={
				<p>
					Estes Termos regulam o uso do {COMPANY.product} ("Cast"), serviço
					oferecido por {COMPANY.legalName}, CNPJ {COMPANY.cnpj}, com sede em{" "}
					{COMPANY.address} ("IA2S", "nós"). Ao criar uma conta ou usar o Cast,
					você concorda com estes Termos e com a{" "}
					<Link href="/privacidade" className="text-foreground underline">
						Política de Privacidade
					</Link>
					. Se não concordar, não use o serviço.
				</p>
			}
		>
			<LegalSection id="servico" title="1. O que é o Cast">
				<p>
					O Cast é uma ferramenta on-line para enviar um vídeo uma única vez e
					publicá-lo, na hora ou em data agendada, em contas de redes sociais
					que você mesmo conecta, como Instagram, Facebook, TikTok, YouTube,
					LinkedIn, Threads, X, Pinterest, Bluesky, Telegram e Discord.
				</p>
				<p>
					O Cast só publica o conteúdo que você enviar, nas contas e nos
					horários que você escolher. Nenhuma publicação é feita sem uma ação
					sua.
				</p>
			</LegalSection>

			<LegalSection id="conta" title="2. Cadastro e conta">
				<ul>
					<li>Você precisa ter pelo menos 18 anos para criar uma conta.</li>
					<li>
						As informações do cadastro precisam ser verdadeiras e mantidas
						atualizadas.
					</li>
					<li>
						Você é responsável por manter sua senha em sigilo e por tudo o que
						for feito com a sua conta. Avise-nos imediatamente se suspeitar de
						uso indevido.
					</li>
					<li>Cada conta é pessoal e não pode ser revendida.</li>
				</ul>
			</LegalSection>

			<LegalSection id="teste" title="3. Teste grátis e continuidade">
				<p>
					Toda conta nova tem um período de teste gratuito de {TRIAL.days} dias,
					com até {TRIAL.maxPosts} publicações e {TRIAL.storageGb} GB para
					vídeos. Não pedimos cartão de crédito.
				</p>
				<p>
					Ao fim do teste, a conta continua acessível para consulta, mas não é
					possível publicar nem agendar. Publicações agendadas para depois do
					fim do teste não são enviadas. Para continuar usando o Cast, entre em
					contato com a IA2S; as condições comerciais são combinadas
					diretamente com você.
				</p>
			</LegalSection>

			<LegalSection id="redes" title="4. Conexão com as redes sociais">
				<p>
					Para publicar, você autoriza o Cast a acessar suas contas pelo login
					oficial de cada rede. Você pode desconectar uma conta a qualquer
					momento em "Contas", no Cast, ou revogar o acesso nas configurações
					da própria rede.
				</p>
				<p>
					Ao usar o Cast com uma rede, você também precisa cumprir as regras
					dela, entre outras:{" "}
					<a
						href="https://www.tiktok.com/legal/page/global/terms-of-service/pt-BR"
						target="_blank"
						rel="noreferrer"
					>
						Termos de Serviço do TikTok
					</a>
					,{" "}
					<a
						href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
						target="_blank"
						rel="noreferrer"
					>
						Music Usage Confirmation do TikTok
					</a>
					,{" "}
					<a
						href="https://www.youtube.com/t/terms"
						target="_blank"
						rel="noreferrer"
					>
						Termos de Serviço do YouTube
					</a>
					,{" "}
					<a
						href="https://help.instagram.com/581066165581870"
						target="_blank"
						rel="noreferrer"
					>
						Termos de Uso do Instagram
					</a>{" "}
					e{" "}
					<a
						href="https://www.facebook.com/terms"
						target="_blank"
						rel="noreferrer"
					>
						Termos do Facebook
					</a>
					.
				</p>
				<p>
					O Cast não é afiliado, patrocinado nem endossado por essas redes. As
					marcas citadas pertencem aos seus donos.
				</p>
			</LegalSection>

			<LegalSection id="conteudo" title="5. Seu conteúdo">
				<p>
					Os vídeos, legendas e demais materiais que você envia continuam sendo
					seus. Você nos concede apenas a permissão necessária para guardar,
					processar e transmitir esse conteúdo às redes que você escolher, pelo
					tempo necessário para prestar o serviço.
				</p>
				<p>
					Você declara ter todos os direitos sobre o que publica, inclusive de
					músicas, imagens e pessoas que aparecem no vídeo, e é o único
					responsável pelo conteúdo e pelas consequências da publicação.
					Conteúdo comercial ou patrocinado precisa ser identificado conforme as
					regras de cada rede e a legislação de publicidade.
				</p>
			</LegalSection>

			<LegalSection id="uso" title="6. Uso permitido">
				<p>Não é permitido usar o Cast para:</p>
				<ul>
					<li>
						publicar conteúdo ilegal, violento, discriminatório, sexual
						envolvendo menores, que viole direitos autorais ou de imagem, ou que
						desrespeite as regras das redes;
					</li>
					<li>enviar spam ou publicar em massa de forma abusiva;</li>
					<li>conectar contas que você não tem autorização para gerenciar;</li>
					<li>
						tentar burlar limites técnicos, acessar dados de outros usuários ou
						atacar a infraestrutura do serviço.
					</li>
				</ul>
			</LegalSection>

			<LegalSection id="disponibilidade" title="7. Disponibilidade">
				<p>
					Trabalhamos para manter o Cast funcionando, mas ele depende das
					interfaces (APIs) das redes, que podem mudar, ficar fora do ar,
					impor limites ou recusar uma publicação. Nesses casos o Cast tenta
					novamente quando possível e mostra o motivo da falha, mas não
					garantimos que toda publicação seja aceita pela rede.
				</p>
			</LegalSection>

			<LegalSection id="encerramento" title="8. Suspensão e encerramento">
				<p>
					Você pode excluir sua conta a qualquer momento pelo menu do perfil,
					em "Excluir minha conta". Seus dados são apagados conforme a Política
					de Privacidade. Publicações que já saíram nas redes continuam lá e
					devem ser removidas diretamente em cada rede.
				</p>
				<p>
					Podemos suspender ou encerrar contas que violem estes Termos ou as
					regras das redes, avisando por e-mail quando possível.
				</p>
			</LegalSection>

			<LegalSection id="responsabilidade" title="9. Limitação de responsabilidade">
				<p>
					Na extensão permitida pela lei, a IA2S não responde por danos
					indiretos, lucros cessantes ou perda de oportunidade decorrentes do
					uso ou da impossibilidade de uso do Cast, nem por decisões das redes
					sociais sobre o seu conteúdo ou a sua conta. Nada nestes Termos
					limita direitos garantidos pelo Código de Defesa do Consumidor quando
					ele se aplicar.
				</p>
			</LegalSection>

			<LegalSection id="propriedade" title="10. Propriedade intelectual">
				<p>
					O software, a marca e o design do Cast pertencem à IA2S. Você recebe
					uma licença pessoal, limitada e revogável para usar o serviço
					enquanto sua conta estiver ativa.
				</p>
			</LegalSection>

			<LegalSection id="alteracoes" title="11. Alterações">
				<p>
					Podemos atualizar estes Termos. Mudanças relevantes serão avisadas
					por e-mail ou dentro do Cast com antecedência razoável. Continuar
					usando o serviço depois da mudança significa concordar com a nova
					versão.
				</p>
			</LegalSection>

			<LegalSection id="lei" title="12. Lei aplicável e foro">
				<p>
					Estes Termos seguem as leis do Brasil. Fica eleito o foro da comarca
					da sede da IA2S, salvo quando a lei garantir a você o foro do seu
					domicílio.
				</p>
			</LegalSection>

			<LegalSection id="contato" title="13. Contato">
				<p>
					Dúvidas sobre estes Termos:{" "}
					<a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.
				</p>
			</LegalSection>
		</LegalPage>
	);
}
