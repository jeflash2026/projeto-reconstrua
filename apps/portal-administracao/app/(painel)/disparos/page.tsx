// DISPAROS (2026-08-06) — decreto do dono: nada automático; o lote da
// APRESENTAÇÃO (template aprovado da Meta) só sai DAQUI, com a confirmação
// explícita do Admin. Alvo: documentação enviada + incompleto + o cliente não
// respondeu no canal da equipe depois do envio. Trava de 24h contra duplicado.
import type { ReactElement } from 'react';
import { getJson } from '../../../lib/api';
import DispararApresentacao from '../../../components/disparar-apresentacao';

interface AlvoDisparo {
  chatId: string;
  nome: string;
  telefone: string;
  uf: string;
  jaDisparadoHoje: boolean;
}

const DisparosPage = async (): Promise<ReactElement> => {
  const data = await getJson<{ alvos: AlvoDisparo[] }>('/admin/humanizado/disparo');
  const alvos = data?.alvos ?? null;
  const elegiveis = alvos?.filter((a) => !a.jaDisparadoHoje) ?? [];

  return (
    <>
      <h1 className="page-title">Disparos</h1>
      <p className="page-sub">
        O lote da apresentação da Layara (template aprovado) para quem recebeu a documentação e
        ainda não respondeu no canal da equipe. Nada sai sem a sua confirmação; quem recebeu
        template nas últimas 24h fica fora sozinho.
      </p>
      {alvos === null ? (
        <div className="error-box">API indisponível.</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <DispararApresentacao elegiveis={elegiveis.length} />
          </div>
          <div className="card">
            <h3>Fila do disparo ({alvos.length})</h3>
            <p className="page-sub">
              Documentação enviada, incompletos e sem resposta do cliente após o envio.
            </p>
            {alvos.length === 0 ? (
              <div className="empty">Ninguém na fila — todos responderam ou completaram.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>WhatsApp</th>
                      <th>UF</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alvos.map((a) => (
                      <tr key={a.chatId}>
                        <td style={{ fontWeight: 600 }}>{a.nome}</td>
                        <td className="mono" style={{ fontSize: 12 }}>
                          {a.telefone}
                        </td>
                        <td>{a.uf}</td>
                        <td>
                          {a.jaDisparadoHoje ? (
                            <span className="badge">template nas últimas 24h — fora do lote</span>
                          ) : (
                            <span className="badge ok">entra no lote</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default DisparosPage;
