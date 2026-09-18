// CONFIGURAÇÃO (2026-09-18) — o estado das integrações e o que falta ligar:
// o número oficial da CNH, a IA, o modelo de follow-up e o link do site.
import type { ReactElement } from 'react';
import { HONORARIOS, getJson, reais, type ConfigCnh } from '../../../lib/api';

export const dynamic = 'force-dynamic';

const Estado = ({ ok, sim, nao }: { ok: boolean; sim: string; nao: string }): ReactElement => (
  <span className={`selo ${ok ? 'ok' : 'ruim'}`}>{ok ? sim : nao}</span>
);

export default async function ConfigPage(): Promise<ReactElement> {
  const config = await getJson<ConfigCnh>('/cnh-api/admin/config');
  const textoSite = encodeURIComponent('Olá! Vim pelo site e preciso de ajuda com a minha CNH.');

  return (
    <>
      <div className="kicker">Integrações</div>
      <h1 className="titulo">Configuração</h1>
      <p className="subtitulo">O que está ligado e o que falta para a AHRI atender a CNH.</p>

      {config === null ? (
        <div className="erro">O serviço da CNH não respondeu.</div>
      ) : (
        <div className="cartao">
          <table className="tabela">
            <tbody>
              <tr>
                <td>WhatsApp oficial da CNH</td>
                <td>
                  <Estado ok={config.whatsapp} sim="Ligado" nao="Falta configurar" />
                </td>
                <td className="lead-sub">CNH_META_PHONE_NUMBER_ID e o token da Meta no .env</td>
              </tr>
              <tr>
                <td>IA da AHRI</td>
                <td>
                  <Estado ok={config.ia} sim="Ligada" nao="Desligada" />
                </td>
                <td className="lead-sub">
                  Sem IA a AHRI responde só pela sequência de perguntas do roteiro
                </td>
              </tr>
              <tr>
                <td>Modelo de follow-up (fora das 24 h)</td>
                <td>
                  <Estado
                    ok={config.modeloFollowup !== null}
                    sim={config.modeloFollowup ?? ''}
                    nao="Não configurado"
                  />
                </td>
                <td className="lead-sub">
                  CNH_META_TEMPLATE_FOLLOWUP — nome do modelo aprovado na Meta
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="cartao">
        <h2>Webhook na Meta</h2>
        <p className="nota" style={{ marginTop: 0 }}>
          Se o número da CNH estiver num app Meta próprio, a URL de callback é:
        </p>
        <p>
          <span className="codigo">
            https://www.projetoreconstrua.com.br/cnh-api/webhook/meta?token=CNH_META_VERIFY_TOKEN
          </span>
        </p>
        <p className="nota">
          Com o token de verificação igual a CNH_META_VERIFY_TOKEN. Se o número estiver no MESMO app
          do Reconstrua, não precisa de nada: a API do Reconstrua repassa as mensagens da CNH para
          cá.
        </p>
      </div>

      <div className="cartao">
        <h2>Botão do site</h2>
        <p className="nota" style={{ marginTop: 0 }}>
          O site chama o WhatsApp com uma mensagem pronta; quem começa a conversa é o cliente, e a
          AHRI responde na hora:
        </p>
        <p>
          <span className="codigo">https://wa.me/55DDDNUMERO?text={textoSite}</span>
        </p>
      </div>

      <div className="cartao">
        <h2>Honorários do roteiro</h2>
        <p className="nota" style={{ marginTop: 0 }}>
          Suspensão {reais(HONORARIOS.suspensao)} · Cassação {reais(HONORARIOS.cassacao)} — fixos, à
          vista ou em até 2 vezes. A AHRI só fala de valor depois de enviar a proposta, e só estes.
        </p>
      </div>
    </>
  );
}
