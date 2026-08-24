'use client';
// AUDITORIA DE ABATES (pedido do dono, 2026-08-24) — a régua do guia mudou
// (migração vale processo; RMC/RCC que o leitor não via) e os abates já feitos
// ficaram defasados. Esta tela compara cliente a cliente e ajusta a DIFERENÇA,
// com motivo no extrato. Nada some: complemento e estorno são lançamentos novos.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { ajustarAbates } from '../lib/actions';

export interface LinhaAuditoria {
  advogadoId: string;
  advogado: string;
  clienteId: string;
  nome: string;
  abatido: number;
  regraAtual: number | null;
  diferenca: number | null;
  /** De onde a régua atual vem (pedido do dono: "está considerando RMC?"). */
  composicao: { ativos: number; excluidos: number; rmc: number; rcc: number } | null;
}

/** "3 ativos + 1 RMC + 1 RCC" — só as partes que existem. */
function composicaoLegivel(c: NonNullable<LinhaAuditoria['composicao']>): string {
  const partes: string[] = [];
  if (c.ativos > 0) partes.push(`${String(c.ativos)} ativo${c.ativos > 1 ? 's' : ''}`);
  if (c.excluidos > 0) partes.push(`${String(c.excluidos)} de excluídos`);
  if (c.rmc > 0) partes.push(`${String(c.rmc)} RMC`);
  if (c.rcc > 0) partes.push(`${String(c.rcc)} RCC`);
  return partes.length > 0 ? partes.join(' + ') : 'nenhum processo';
}

export interface Auditoria {
  linhas: LinhaAuditoria[];
  divergentes: number;
  naoConferiveis: number;
}

export default function AuditoriaAbates({ auditoria }: { auditoria: Auditoria }): ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const divergentes = auditoria.linhas.filter((l) => (l.diferenca ?? 0) !== 0);

  async function ajustar(l?: LinhaAuditoria): Promise<void> {
    const alvo =
      l !== undefined
        ? `${l.nome} (${l.advogado}): ${String(l.abatido)} → ${String(l.regraAtual ?? 0)}`
        : `TODAS as ${String(divergentes.length)} divergências`;
    if (
      !window.confirm(
        `Ajustar ${alvo}?\n\nO lançamento é só a diferença, com o motivo da auditoria — o extrato do advogado mostra tudo.`,
      )
    )
      return;
    setErro(null);
    setAviso(null);
    setBusy(true);
    const r = await ajustarAbates(l?.advogadoId, l?.clienteId);
    setBusy(false);
    if (!r.ok) {
      setErro(r.error ?? 'falha no ajuste');
      return;
    }
    setAviso(`${String(r.ajustados ?? 0)} abate(s) ajustado(s) à régua atual.`);
    router.refresh();
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <div>
            <div className="page-sub">Clientes abatidos</div>
            <strong style={{ fontSize: 22 }}>{auditoria.linhas.length}</strong>
          </div>
          <div>
            <div className="page-sub">Fora da régua atual</div>
            <strong style={{ fontSize: 22, color: '#b45309' }}>{auditoria.divergentes}</strong>
          </div>
          <div>
            <div className="page-sub">Não conferíveis</div>
            <strong style={{ fontSize: 22 }}>{auditoria.naoConferiveis}</strong>
          </div>
          <button
            className="primary"
            disabled={busy || divergentes.length === 0}
            onClick={() => void ajustar()}
          >
            {divergentes.length === 0
              ? 'Tudo na régua'
              : `Ajustar todas (${String(divergentes.length)})`}
          </button>
        </div>
        {auditoria.naoConferiveis > 0 ? (
          <p className="page-sub" style={{ marginTop: 8 }}>
            &quot;Não conferível&quot; = o HISCON do cliente não pôde ser relido agora (sem chat ou
            leitura falhou) — esses ficam como estão; nada é ajustado no escuro.
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
        <h3>Cliente a cliente ({auditoria.linhas.length})</h3>
        {auditoria.linhas.length === 0 ? (
          <div className="empty">Nenhum abate registrado ainda.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Advogado</th>
                  <th>Abatido</th>
                  <th>Régua atual</th>
                  <th>Composição (cartão incluso?)</th>
                  <th>Diferença</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {auditoria.linhas.map((l) => (
                  <tr key={`${l.advogadoId}-${l.clienteId}`}>
                    <td style={{ fontWeight: 600 }}>{l.nome}</td>
                    <td>{l.advogado}</td>
                    <td>{l.abatido}</td>
                    <td>{l.regraAtual ?? '—'}</td>
                    <td className="page-sub">
                      {l.composicao === null ? (
                        '—'
                      ) : (
                        <>
                          {composicaoLegivel(l.composicao)}
                          {l.composicao.rmc + l.composicao.rcc > 0 ? (
                            <span className="badge ok" style={{ marginLeft: 6 }}>
                              cartão contado
                            </span>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td>
                      {l.diferenca === null ? (
                        <span className="badge dim">não conferível</span>
                      ) : l.diferenca === 0 ? (
                        <span className="badge ok">confere</span>
                      ) : (
                        <span className="badge warn">
                          {l.diferenca > 0 ? `+${String(l.diferenca)}` : String(l.diferenca)}
                        </span>
                      )}
                    </td>
                    <td>
                      {l.diferenca !== null && l.diferenca !== 0 ? (
                        <button disabled={busy} onClick={() => void ajustar(l)}>
                          Ajustar
                        </button>
                      ) : null}
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
