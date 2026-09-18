// FOLLOW-UPS (2026-09-18) — os leads mornos ("vou pensar") há 24 h. Nada sai
// sozinho: o dono marca e aprova. Dentro da janela de 24 h da Meta vai como
// mensagem normal; fora dela, só com o modelo aprovado na Meta.
import type { ReactElement } from 'react';
import { FollowupsForm, type FollowupItem } from '../../../components/followups-form';
import { getJson, type ConfigCnh } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function FollowupsPage(): Promise<ReactElement> {
  const [dados, config] = await Promise.all([
    getJson<{ followups: FollowupItem[] }>('/cnh-api/admin/followups'),
    getJson<ConfigCnh>('/cnh-api/admin/config'),
  ]);
  if (dados === null)
    return <div className="erro">O serviço da CNH não respondeu. Tente de novo em instantes.</div>;

  return (
    <>
      <div className="kicker">Leads mornos</div>
      <h1 className="titulo">Follow-ups para aprovar</h1>
      <p className="subtitulo">
        Quem disse que ia pensar há mais de 24 h. A mensagem é a do roteiro: “Passando para saber se
        ficou alguma dúvida sobre o seu caso da CNH…”. Só sai com a sua aprovação.
      </p>
      {dados.followups.length === 0 ? (
        <div className="cartao vazio">Nenhum follow-up pendente agora.</div>
      ) : (
        <FollowupsForm itens={dados.followups} modeloConfigurado={config?.modeloFollowup != null} />
      )}
      {config !== null && config.modeloFollowup === null ? (
        <p className="nota">
          Sem modelo aprovado configurado: só dá para enviar a quem escreveu nas últimas 24 h. Veja
          em Configuração como cadastrar o modelo na Meta.
        </p>
      ) : null}
    </>
  );
}
