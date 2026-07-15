// CONFIGURAÇÕES — parâmetros operacionais visíveis (leitura). Alterações de regra
// pertencem à Governança (aprovação humana), nunca a esta tela.
import type { ReactElement } from 'react';
import { API_BASE, getJson } from '../../lib/api';

interface ConfigData {
  goLiveItems: number;
  notificationPolicy: string;
  portalRoles: string[];
}

const ConfiguracoesPage = async (): Promise<ReactElement> => {
  const data = await getJson<ConfigData>('/admin/config');
  return (
    <>
      <h1 className="page-title">Configurações</h1>
      <p className="page-sub">Parâmetros operacionais em leitura. Regras mudam por Governança, não por aqui.</p>
      <div className="card">
        <dl className="kv">
          <dt>API</dt>
          <dd className="mono">{API_BASE}</dd>
          <dt>Itens do Go-Live Checklist</dt>
          <dd>{data?.goLiveItems ?? '—'}</dd>
          <dt>Política de notificação</dt>
          <dd>{data?.notificationPolicy ?? '—'}</dd>
          <dt>Papéis dos portais</dt>
          <dd>{data ? data.portalRoles.join(', ') : '—'}</dd>
        </dl>
      </div>
    </>
  );
};

export default ConfiguracoesPage;
