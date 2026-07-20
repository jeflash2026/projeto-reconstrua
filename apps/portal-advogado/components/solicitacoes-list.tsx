'use client';
// 15C-2 · TELA 1 — a lista de solicitações do advogado. Filtros (Pendentes/
// Urgentes/Reabertas/Recebidas/Canceladas) + busca por cliente/caso/documento.
// Filtragem 100% client-side sobre os dados do servidor — nada recalculado.
import { useMemo, useState, type ReactElement } from 'react';
import Link from 'next/link';
import type { Solicitacao } from '../lib/api';
import { STATUS_AMIGAVEL, STATUS_CLASSE, ehUrgente, idadeDe, prazoDe, responsavelAtual } from './solicitacao-status';

type Filtro = 'todas' | 'pendentes' | 'urgentes' | 'reabertas' | 'recebidas' | 'canceladas';

const FILTROS: ReadonlyArray<{ id: Filtro; rotulo: string }> = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'pendentes', rotulo: 'Pendentes' },
  { id: 'urgentes', rotulo: 'Urgentes' },
  { id: 'reabertas', rotulo: 'Reabertas' },
  { id: 'recebidas', rotulo: 'Recebidas' },
  { id: 'canceladas', rotulo: 'Canceladas' },
];

function aplica(f: Filtro, s: Solicitacao): boolean {
  switch (f) {
    case 'todas': return true;
    case 'pendentes': return s.status === 'PENDING' || s.status === 'AWAITING_CONFIRMATION';
    case 'urgentes': return ehUrgente(s);
    case 'reabertas': return s.status === 'REOPENED';
    case 'recebidas': return s.status === 'RECEIVED';
    case 'canceladas': return s.status === 'CANCELLED';
  }
}

const Card = ({ s }: { s: Solicitacao }): ReactElement => {
  const prazo = prazoDe(s.dueAt, s.status);
  return (
    <Link href={`/solicitacoes/${s.requestId}`} className={`sol-card ${STATUS_CLASSE[s.status]}${ehUrgente(s) ? ' sol-urgente' : ''}`}>
      <div className="sol-card-top">
        <span className="sol-doc">{s.documentName}</span>
        {s.priority === 'alta' ? <span className="sol-tag sol-tag-alta">ALTA</span> : null}
        <span className={`sol-tag ${STATUS_CLASSE[s.status]}`}>{STATUS_AMIGAVEL[s.status]}</span>
      </div>
      <div className="sol-card-meta">
        <span title="Cliente" className="mono">{s.clientId.replace('@s.whatsapp.net', '')}</span>
        <span title="Caso" className="mono">caso {s.caseId}</span>
        <span title="Responsável atual">com: <b>{responsavelAtual(s)}</b></span>
      </div>
      <div className="sol-card-foot">
        <span>{idadeDe(s.createdAt)}</span>
        <span className={prazo.vencida ? 'sol-vencida' : ''}>{prazo.texto}</span>
        <span>atualizada {idadeDe(s.updatedAt)}</span>
      </div>
    </Link>
  );
};

const SolicitacoesList = ({ solicitacoes }: { solicitacoes: Solicitacao[] }): ReactElement => {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busca, setBusca] = useState('');

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return solicitacoes
      .filter((s) => aplica(filtro, s))
      .filter((s) => q === '' || s.documentName.toLowerCase().includes(q) || s.clientId.toLowerCase().includes(q) || s.caseId.toLowerCase().includes(q));
  }, [solicitacoes, filtro, busca]);

  const contagem = (f: Filtro): number => solicitacoes.filter((s) => aplica(f, s)).length;

  return (
    <>
      <div className="sol-toolbar">
        <div className="sol-filtros" role="tablist">
          {FILTROS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filtro === f.id} className={`sol-filtro${filtro === f.id ? ' ativo' : ''}`} onClick={() => { setFiltro(f.id); }}>
              {f.rotulo} <span className="sol-filtro-n">{contagem(f.id)}</span>
            </button>
          ))}
        </div>
        <input
          className="sol-busca"
          placeholder="Buscar por cliente, caso ou documento…"
          value={busca}
          onChange={(e) => { setBusca(e.target.value); }}
        />
      </div>

      {visiveis.length === 0 ? (
        <div className="sol-vazio">
          <div className="sol-vazio-icone" aria-hidden>{busca || filtro !== 'todas' ? '🔍' : '📄'}</div>
          <p>
            {busca || filtro !== 'todas'
              ? 'Nenhuma solicitação encontrada com esses critérios.'
              : 'Você ainda não solicitou nenhum documento. Quando precisar de algo de um cliente, a AHRI cuida da conversa por você.'}
          </p>
          {!busca && filtro === 'todas' ? <Link href="/solicitacoes/nova" className="sol-cta">Solicitar documento</Link> : null}
        </div>
      ) : (
        <div className="sol-grid">
          {visiveis.map((s) => <Card key={s.requestId} s={s} />)}
        </div>
      )}
    </>
  );
};

export default SolicitacoesList;
