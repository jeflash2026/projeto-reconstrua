// CAMPANHAS — atribuição por campanha (read model). Sem fonte de dados = dito
// explicitamente; nunca números inventados.
import type { ReactElement } from 'react';
import { getJson } from '../../lib/api';

interface CampaignsData {
  attribution: Record<string, number>;
  available: boolean;
}

const CampanhasPage = async (): Promise<ReactElement> => {
  const data = await getJson<CampaignsData>('/admin/campaigns');
  return (
    <>
      <h1 className="page-title">Campanhas</h1>
      <p className="page-sub">Atribuição de origem dos clientes (Meta Ads → WhatsApp).</p>
      {!data ? (
        <div className="error-box">API indisponível.</div>
      ) : !data.available ? (
        <div className="card empty">
          Sem fonte de dados de campanha ainda. A atribuição de origem será alimentada quando a integração de
          rastreamento (Meta Ads → link do WhatsApp) estiver conectada. Nenhum número é inventado.
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Campanha</th>
                <th>Clientes atribuídos</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.attribution).map(([campaign, count]) => (
                <tr key={campaign}>
                  <td>{campaign}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default CampanhasPage;
