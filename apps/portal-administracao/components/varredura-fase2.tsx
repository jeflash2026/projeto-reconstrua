'use client';
// VARREDURA DA FASE 2 (2026-08-11) — o cliente disse SIM e não apareceu na mesa
// do Humanizado (caso Oracio "e muitos outros"). Esta tela mostra a fronteira
// inteira e, num clique, manda TODOS os confirmados para a mesa. Nenhuma
// mensagem é enviada ao cliente: reparo é dado, não conversa.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { repararVarreduraFase2 } from '../lib/actions';

export interface LinhaVarredura {
  chatId: string;
  clienteId: string;
  nome: string;
  chaveParecer: string | null;
  confirmadoEm: string | null;
  disseSim: boolean;
  naMesa: boolean;
  situacao:
    | 'na-mesa'
    | 'confirmou-sem-registro'
    | 'parecer-em-chave-errada'
    | 'sem-cadastro'
    | 'aguardando-sim'
    | 'sem-parecer';
  reparavel: boolean;
}

export interface ResumoVarredura {
  verificados: number;
  naMesa: number;
  forasDaMesaComSim: number;
  linhas: LinhaVarredura[];
}

const ROTULO: Record<LinhaVarredura['situacao'], string> = {
  'na-mesa': 'Na mesa',
  'confirmou-sem-registro': 'Confirmou — falta o carimbo',
  'parecer-em-chave-errada': 'Confirmou — parecer na chave errada',
  'sem-cadastro': 'Confirmou — sem cadastro ainda',
  'aguardando-sim': 'Aguardando o SIM',
  'sem-parecer': 'Sem parecer',
};

function telefone(chatId: string): string {
  return chatId.split('@')[0] ?? chatId;
}

export default function VarreduraFase2({ resumo }: { resumo: ResumoVarredura }): ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const reparaveis = resumo.linhas.filter((l) => l.reparavel);
  const semCadastro = resumo.linhas.filter((l) => l.situacao === 'sem-cadastro');

  async function reparar(): Promise<void> {
    if (
      !window.confirm(
        `Enviar ${reparaveis.length} cliente(s) confirmado(s) para a mesa do Atendimento Humanizado? Nenhuma mensagem será enviada a eles.`,
      )
    )
      return;
    setErro(null);
    setAviso(null);
    setBusy(true);
    const r = await repararVarreduraFase2();
    setBusy(false);
    if (!r.ok) {
      setErro(r.error ?? 'falha ao reparar');
      return;
    }
    setAviso(`${r.reparados ?? 0} cliente(s) enviados para a mesa.`);
    router.refresh();
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <div>
            <div className="page-sub">Com parecer enviado</div>
            <strong style={{ fontSize: 22 }}>{resumo.verificados}</strong>
          </div>
          <div>
            <div className="page-sub">Já na mesa</div>
            <strong style={{ fontSize: 22 }}>{resumo.naMesa}</strong>
          </div>
          <div>
            <div className="page-sub">Confirmaram e ficaram de fora</div>
            <strong style={{ fontSize: 22, color: '#b45309' }}>{resumo.forasDaMesaComSim}</strong>
          </div>
          <button
            className="primary"
            disabled={busy || reparaveis.length === 0}
            onClick={() => void reparar()}
          >
            {reparaveis.length === 0 ? 'Nada a reparar' : `Enviar ${reparaveis.length} para a mesa`}
          </button>
        </div>
        {semCadastro.length > 0 ? (
          <p className="page-sub" style={{ marginTop: 8 }}>
            {semCadastro.length} confirmaram mas ainda não têm cadastro próprio — o cadastro nasce
            sozinho na próxima varredura do sistema e aí entram na mesa.
          </p>
        ) : null}
        {erro !== null ? <div className="error-box">{erro}</div> : null}
        {aviso !== null ? (
          <div className="badge ok" style={{ marginTop: 8 }}>
            {aviso}
          </div>
        ) : null}
      </div>

      <div className="card">
        <h3>Fronteira da fase 2 ({resumo.linhas.length})</h3>
        {resumo.linhas.length === 0 ? (
          <div className="empty">Nenhum cliente com parecer enviado ainda.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>Situação</th>
                  <th>Confirmado em</th>
                </tr>
              </thead>
              <tbody>
                {resumo.linhas.map((l) => (
                  <tr key={l.chatId}>
                    <td style={{ fontWeight: 600 }}>{l.nome}</td>
                    <td className="mono">{telefone(l.chatId)}</td>
                    <td>
                      <span
                        className={l.naMesa ? 'badge ok' : l.reparavel ? 'badge warn' : 'badge'}
                      >
                        {ROTULO[l.situacao]}
                      </span>
                    </td>
                    <td>
                      {l.confirmadoEm === null
                        ? '—'
                        : new Date(l.confirmadoEm).toLocaleDateString('pt-BR')}
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
