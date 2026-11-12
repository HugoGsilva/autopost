import type { Metadata } from "next";

import { LegalPage, LegalSection } from "@/components/legal";
import { COMPANY, CONTACT } from "@/lib/site";

export const metadata: Metadata = {
	title: "Política de Privacidade",
	description:
		"Como o IA2S Cast coleta, usa, guarda e apaga dados pessoais, conforme a LGPD.",
};

export default function PrivacyPage() {
	return (
		<LegalPage
			title="Política de Privacidade"
			intro={
				<p>
					Esta Política explica como o {COMPANY.product} ("Cast") trata dados
					pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei
					13.709/2018, "LGPD"). O controlador dos dados é {COMPANY.legalName},
					CNPJ {COMPANY.cnpj}, com sede em {COMPANY.address} ("IA2S").
				</p>
			}
		>
			<LegalSection id="dados" title="1. Dados que coletamos">
				<ul>
					<li>
						<strong>Cadastro:</strong> nome, e-mail e senha (guardada apenas
						como hash, nunca em texto), data de aceite destes termos.
					</li>
					<li>
						<strong>Conteúdo:</strong> os vídeos que você envia, legendas,
						opções de publicação, horários agendados e o resultado de cada
						publicação (link do post ou mensagem de erro da rede).
					</li>
					<li>
						<strong>Contas conectadas:</strong> quando você conecta uma rede,
						recebemos dela o identificador da conta, o nome de exibição, o nome
						de usuário, a foto de perfil e as chaves de acesso (tokens) que
						permitem publicar em seu nome.
					</li>
					<li>
						<strong>Dados técnicos:</strong> endereço IP e navegador de cada
						sessão de login, usados para segurança.
					</li>
				</ul>
				<p>
					Não coletamos dados de pagamento, não usamos cookies de publicidade e
					não instalamos ferramentas de rastreamento de terceiros.
				</p>
			</LegalSection>

			<LegalSection id="finalidades" title="2. Para que usamos">
				<ul>
					<li>
						Criar e manter sua conta e permitir o login (execução de contrato,
						art. 7º, V, da LGPD).
					</li>
					<li>
						Publicar seus vídeos nas contas e horários que você escolher, e
						mostrar o resultado (execução de contrato).
					</li>
					<li>
						Proteger o serviço contra abuso e acesso indevido (legítimo
						interesse, art. 7º, IX).
					</li>
					<li>
						Falar com você sobre a conta, o fim do teste e mudanças nestes
						termos (execução de contrato e legítimo interesse).
					</li>
					<li>Cumprir obrigações legais (art. 7º, II).</li>
				</ul>
				<p>
					Não vendemos dados pessoais, não os usamos para publicidade e não os
					usamos para treinar modelos de inteligência artificial.
				</p>
			</LegalSection>

			<LegalSection id="redes" title="3. Dados das redes sociais">
				<p>
					O Cast acessa cada rede apenas com as permissões que você aprova na
					tela de login dela, e só para mostrar qual conta está conectada e
					publicar o que você mandou.
				</p>
				<ul>
					<li>
						<strong>TikTok:</strong> usamos as permissões{" "}
						<code>user.info.basic</code> (identificador, nome de exibição e
						foto, para mostrar a conta conectada e quem vai publicar),{" "}
						<code>video.upload</code> (enviar o vídeo como rascunho para você
						finalizar no app do TikTok) e <code>video.publish</code> (publicar
						o vídeo com as opções de privacidade e interação que você escolher).
						Não lemos seus vídeos, seguidores, mensagens nem métricas.
					</li>
					<li>
						<strong>YouTube:</strong> usamos os serviços de API do YouTube para
						enviar vídeos ao seu canal. Ao conectar o YouTube, você também
						concorda com a{" "}
						<a
							href="https://policies.google.com/privacy"
							target="_blank"
							rel="noreferrer"
						>
							Política de Privacidade do Google
						</a>
						. O uso de dados recebidos das APIs do Google segue a{" "}
						<a
							href="https://developers.google.com/terms/api-services-user-data-policy"
							target="_blank"
							rel="noreferrer"
						>
							Política de Dados do Usuário dos Serviços de API do Google
						</a>
						, incluindo os requisitos de uso limitado.
					</li>
					<li>
						<strong>Instagram, Facebook e Threads (Meta), LinkedIn, X,
						Pinterest e demais redes:</strong> usamos apenas a identificação da
						conta e a permissão de publicar.
					</li>
				</ul>
				<p>
					As chaves de acesso são guardadas criptografadas (AES-256-GCM) e só
					são usadas pelo serviço que publica. Você pode desconectar uma conta
					em "Contas" a qualquer momento, o que apaga as chaves do Cast, e
					também revogar o acesso direto na rede, por exemplo em{" "}
					<a
						href="https://support.tiktok.com/pt_BR/account-and-privacy/account-privacy-settings/third-party-apps"
						target="_blank"
						rel="noreferrer"
					>
						Gerenciar apps no TikTok
					</a>{" "}
					ou em{" "}
					<a
						href="https://myaccount.google.com/permissions"
						target="_blank"
						rel="noreferrer"
					>
						permissões da Conta Google
					</a>
					.
				</p>
			</LegalSection>

			<LegalSection id="compartilhamento" title="4. Com quem compartilhamos">
				<ul>
					<li>
						Com as redes sociais que você escolher, apenas o conteúdo que você
						mandou publicar.
					</li>
					<li>
						Com fornecedores de infraestrutura (servidores e banco de dados)
						que guardam os dados em nosso nome, sob contrato e dever de sigilo.
						Esses servidores podem ficar fora do Brasil; nesse caso seguimos as
						regras de transferência internacional da LGPD (art. 33).
					</li>
					<li>
						Com autoridades, quando houver obrigação legal ou ordem judicial.
					</li>
				</ul>
			</LegalSection>

			<LegalSection id="retencao" title="5. Por quanto tempo guardamos">
				<ul>
					<li>
						<strong>Vídeos:</strong> apagados automaticamente 24 horas depois
						do envio, se não forem usados em nenhuma publicação, e 30 dias
						depois que a publicação termina (publicada, com falha ou cancelada).
					</li>
					<li>
						<strong>Chaves de acesso das redes:</strong> até você desconectar a
						conta ou excluir seu cadastro.
					</li>
					<li>
						<strong>Cadastro e histórico de publicações:</strong> enquanto sua
						conta existir.
					</li>
				</ul>
				<p>
					Ao excluir sua conta, apagamos na hora o cadastro, o histórico, os
					vídeos e as chaves de acesso. Cópias de segurança são sobrescritas
					no ciclo normal de backup.
				</p>
			</LegalSection>

			<LegalSection id="seguranca" title="6. Segurança">
				<p>
					Usamos conexão criptografada (HTTPS), senhas com hash, chaves de
					acesso criptografadas, isolamento entre contas de usuários e limite
					de tentativas de login. Nenhum sistema é totalmente imune a falhas;
					se houver um incidente que possa trazer risco a você, avisaremos você
					e a ANPD como a lei exige.
				</p>
			</LegalSection>

			<LegalSection id="direitos" title="7. Seus direitos">
				<p>
					Pela LGPD, você pode pedir confirmação de que tratamos seus dados,
					acesso, correção, anonimização, portabilidade, informação sobre
					compartilhamento, revogação do consentimento e exclusão. Você mesmo
					pode excluir a conta e todos os dados pelo menu do perfil, em
					"Excluir minha conta". Para os demais pedidos, escreva para{" "}
					<a href={`mailto:${CONTACT.privacyEmail}`}>{CONTACT.privacyEmail}</a>
					. Respondemos em até 15 dias. Você também pode reclamar à Autoridade
					Nacional de Proteção de Dados (ANPD).
				</p>
			</LegalSection>

			<LegalSection id="cookies" title="8. Cookies">
				<p>
					Usamos apenas cookies essenciais: o de sessão, que mantém você
					conectado, e um temporário durante a conexão com uma rede, que
					protege o login contra fraude. A preferência de tema claro ou escuro
					fica guardada no seu próprio navegador.
				</p>
			</LegalSection>

			<LegalSection id="menores" title="9. Menores de idade">
				<p>
					O Cast não é destinado a menores de 18 anos e não coletamos dados de
					crianças de forma intencional.
				</p>
			</LegalSection>

			<LegalSection id="alteracoes" title="10. Alterações">
				<p>
					Podemos atualizar esta Política. A data no topo mostra a última
					revisão, e mudanças relevantes serão avisadas por e-mail ou dentro do
					Cast.
				</p>
			</LegalSection>

			<LegalSection id="contato" title="11. Encarregado e contato">
				<p>
					Encarregado pelo tratamento de dados (DPO):{" "}
					<a href={`mailto:${CONTACT.privacyEmail}`}>{CONTACT.privacyEmail}</a>
					.
				</p>
			</LegalSection>
		</LegalPage>
	);
}
