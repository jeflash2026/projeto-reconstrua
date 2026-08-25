'use client';
// INTEGRAÇÃO CORVO (2026-08-25) — a visão geral: cada cliente completo enviado
// à correspondência, o estado do envio e o caminho para a timeline por banco.
import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { reenviarAoCorvo } from '../lib/actions';

export interface ImportacaoCorvoView {
  clienteId: string;
  nome: string;
  cpf: string | null;
  estado: 'PENDENTE' | 'ENVIADO' | 'ERRO' | 'SEM_CPF' | 'SEM_CONTRATOS' | 'SEM_DOCUMENTOS';
  tentativas: number;
  ultimoErro: string | null;
  enviadoEm: string | null;
  bancos: { codigo: string; nome: string }[];
  caixaStatus: string | null;
  recebidoPeloCorvoEm: string | null;
}

export interface VisaoCorvo {
  ativa: boolean;
  importacoes: ImportacaoCorvoView[];
  totais: { enviados: number; pendentes: number; erros: number; caixas: number; respostas: number };
}

const ROTULO_ESTADO: Record<ImportacaoCorvoView['estado'], string> = {
  ENVIADO: 'Enviado',
  PENDENTE: 'Na fila (retry)',
  ERRO: 'Erro — precisa de ação',
  SEM_CPF: 'Sem CPF',
  SEM_CONTRATOS: 'Sem contratos legíveis',
  SEM_DOCUMENTOS: 'Sem documentos',
};

export default function CorvoBancos({ visao }: { visao: VisaoCorvo }): ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function reenviar(clienteId: string, nome: string): Promise<void> {
    if (
      !window.confirm(
        `Reenviar ${nome} ao Corvo? O ZIP completo é montado e enviado de novo (modo mesclar).`,
      )
    )
      return;
    setBusy(clienteId);
    await reenviarAoCorvo(clienteId);
    setBusy(null);
    router.refresh();
  }

  return (
    <>
      {!visao.ativa ? (
        <div className="error-box" style={{ marginBottom: 16 }}>
          Integração desligada: falta CORVO_API_KEY / CORVO_WEBHOOK_SECRET no .env da API. Nada é
          enviado até o dono configurar.
        </div>
      ) : null}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="page-sub">Enviados</div>
            <strong style={{ fontSize: 22 }}>{visao.totais.enviados}</strong>
          </div>
          <div>
            <div className="page-sub">Na fila</div>
            <strong style={{ fontSize: 22 }}>{visao.totais.pendentes}</strong>
          </div>
          <div>
            <div className="page-sub">Com pendência</div>
            <strong style={{ fontSize: 22, color: '#b45309' }}>{visao.totais.erros}</strong>
          </div>
          <div>
            <div className="page-sub">Caixas criadas</div>
            <strong style={{ fontSize: 22 }}>{visao.totais.caixas}</strong>
          </div>
          <div>
            <div className="page-sub">Respostas de bancos</div>
            <strong style={{ fontSize: 22 }}>{visao.totais.respostas}</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Clientes na correspondência ({visao.importacoes.length})</h3>
        {visao.importacoes.length === 0 ? (
          <div className="empty">
            Nenhum cliente enviado ainda — a varredura roda a cada 5 minutos sobre a mesa do
            Humanizado (documentação completa).
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Bancos</th>
                  <th>Caixa</th>
                  <th>Enviado em</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visao.importacoes.map((i) => (
                  <tr key={i.clienteId}>
                    <td style={{ fontWeight: 600 }}>
                      <Link href={`/corvo/${encodeURIComponent(i.clienteId)}`}>{i.nome}</Link>
                    </td>
                    <td>
                      <span
                        className={
                          i.estado === 'ENVIADO'
                            ? 'badge ok'
                            : i.estado === 'PENDENTE'
                              ? 'badge warn'
                              : 'badge'
                        }
                        title={i.ultimoErro ?? undefined}
                      >
                        {ROTULO_ESTADO[i.estado]}
                      </span>
                      {i.estado === 'ENVIADO' && i.recebidoPeloCorvoEm === null ? (
                        <span className="badge dim" style={{ marginLeft: 6 }}>
                          sem confirmação
                        </span>
                      ) : null}
                    </td>
                    <td>{i.bancos.length > 0 ? i.bancos.map((b) => b.nome).join(', ') : '—'}</td>
                    <td>{i.caixaStatus ?? '—'}</td>
                    <td>
                      {i.enviadoEm === null ? '—' : new Date(i.enviadoEm).toLocaleString('pt-BR')}
                    </td>
                    <td>
                      <button
                        disabled={busy !== null}
                        onClick={() => void reenviar(i.clienteId, i.nome)}
                      >
                        {busy === i.clienteId ? 'Reenviando…' : 'Reenviar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
