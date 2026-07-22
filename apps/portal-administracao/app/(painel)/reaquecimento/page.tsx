// REAQUECIMENTO DE LEADS (decreto 2026-07-22) — leads que esfriaram, do "só
// mandou oi" ao "enviou parte dos documentos". A AHRI SÓ reaquece com a sua
// autorização, lead a lead — a mensagem é a certa para o estágio, com
// guardrails anti-spam (mínimo 24h entre tentativas; máximo 3 por lead).
import Link from 'next/link';
import type { ReactElement } from 'react';
import AutoRefresh from '../../../components/auto-refresh';
import { ReaquecerLead } from '../../../components/reaquecer-lead';
import { getJson } from '../../../lib/api';

interface LeadFrioView {
  chatId: string;
  nome: string | null;
  estagio: string;
  horasParado: number;
  docsRecebidos: number;
  proximoDocumento: string | null;
  tentativas: number;
  ultimaTentativaEm: string | null;
  podeReaquecer: boolean;
  motivoBloqueio: string | null;
}

const ESTAGIOS: Record<string, string> = {
  SO_CONTATO: 'Só fez contato',
  IDENTIFICADO: 'Identificado (sem interesse confirmado)',
  CONSENTIU_SEM_DOCS: 'Confirmou interesse (sem documentos)',
  DOCS_PARCIAIS: 'Documentos parciais',
  DESISTIU: 'Desistiu (retomada delicada)',
};

const dias = (horas: number): string =>
  horas < 48 ? `${String(horas)}h` : `${String(Math.floor(horas / 24))} dia(s)`;

const ReaquecimentoPage = async (): Promise<ReactElement> => {
  const data = await getJson<{ leads: LeadFrioView[] }>('/admin/reaquecimento');
  const leads = data?.leads ?? [];
  return (
    <>
      <AutoRefresh seconds={60} />
      <h1 className="page-title">Reaquecimento de Leads</h1>
      <p className="page-sub">
        Leads parados há 24h ou mais, do primeiro contato aos documentos parciais. A AHRI só
        reaquece com a sua autorização — um lead por clique, com a mensagem certa para o estágio.
        Anti-spam: mínimo de 24h entre tentativas e máximo de 3 por lead.
      </p>
      {leads.length === 0 ? (
        <div className="empty">
          Nenhum lead frio no momento — todo mundo que chegou está em andamento ou concluído.
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Estágio</th>
                  <th>Parado há</th>
                  <th>Documentos</th>
                  <th>Tentativas</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.chatId}>
                    <td>
                      <Link
                        href={`/clientes/${encodeURIComponent(l.chatId)}`}
                        style={{ color: 'var(--accent)' }}
                      >
                        {l.nome ?? l.chatId.replace(/@.*$/, '')}
                      </Link>
                    </td>
                    <td>{ESTAGIOS[l.estagio] ?? l.estagio}</td>
                    <td className="mono">{dias(l.horasParado)}</td>
                    <td>
                      {l.docsRecebidos > 0
                        ? `${String(l.docsRecebidos)} recebido(s) · falta: ${l.proximoDocumento ?? '—'}`
                        : '—'}
                    </td>
                    <td className="mono">
                      {l.tentativas}
                      {l.ultimaTentativaEm !== null
                        ? ` (última: ${new Date(l.ultimaTentativaEm).toLocaleString('pt-BR')})`
                        : ''}
                    </td>
                    <td>
                      <ReaquecerLead
                        chatId={l.chatId}
                        habilitado={l.podeReaquecer}
                        motivoBloqueio={l.motivoBloqueio}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
};

export default ReaquecimentoPage;
