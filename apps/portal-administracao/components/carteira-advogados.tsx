'use client';
// CARTEIRA DE CRÉDITOS DOS ADVOGADOS PARCEIROS (decreto 2026-08-04) — o modelo
// comercial na tela: quanto cada advogado COMPROU (R$ 100/contrato), quanto já
// foi ABATIDO pelos clientes encaminhados (processos do guia v2) e o SALDO.
// O abate é automático no encaminhamento; aqui o Admin só REGISTRA compras e
// consulta o extrato (prestação de contas por cliente).
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { registrarCompraContratos } from '../lib/actions';
import type { CarteiraAdvogadoView, LancamentoCarteira } from '../lib/api';

function dataBr(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** O texto de UM lançamento. Antes só a COMPRA tinha texto próprio e todo o
 *  resto virava "abate de N" — então um ESTORNO era desenhado como se fosse mais
 *  um débito, e a leitura dizia o contrário do que aconteceu (caso Joelcio: ele
 *  foi transferido para outro advogado, os créditos voltaram, e o extrato do
 *  Cornélio continuava parecendo que ele pagava por esse cliente).
 *  O SINAL vai em cada linha: sem ele, "16" não diz se entrou ou saiu. */
function textoDoLancamento(l: LancamentoCarteira): string {
  const qtd = String(l.quantidade);
  const quem = l.nome ?? l.clienteId ?? 'cliente';
  if (l.tipo === 'compra') return `+${qtd} — compra de contratos`;
  if (l.tipo === 'estorno')
    return `+${qtd} — ESTORNO de ${quem}${l.motivo !== undefined ? ` (${l.motivo})` : ''}`;
  return `−${qtd} — abate de ${quem}`;
}

const FormCompra = ({ advogadoId }: { advogadoId: string }): ReactElement => {
  const router = useRouter();
  const [qtd, setQtd] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const comprar = async (): Promise<void> => {
    const n = Number(qtd);
    if (busy || !Number.isFinite(n) || n <= 0) {
      setMsg('Informe a quantidade de contratos (> 0).');
      return;
    }
    setBusy(true);
    setMsg(null);
    const r = await registrarCompraContratos(advogadoId, n);
    if (r.ok) {
      setMsg(`Compra de ${String(Math.round(n))} contrato(s) registrada. ✅`);
      setQtd('');
      router.refresh();
    } else {
      setMsg(r.error ?? 'Falha ao registrar.');
    }
    setBusy(false);
  };

  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        type="text"
        inputMode="numeric"
        className="sol-input"
        style={{ width: 90 }}
        placeholder="qtd"
        value={qtd}
        onChange={(e) => {
          setQtd(e.target.value.replace(/\D/g, ''));
        }}
      />
      <button
        className="btn"
        disabled={busy}
        onClick={() => {
          void comprar();
        }}
      >
        {busy ? 'Registrando…' : '+ Registrar compra'}
      </button>
      {msg !== null ? <span style={{ fontSize: 12 }}>{msg}</span> : null}
    </span>
  );
};

const CarteiraAdvogados = ({ carteiras }: { carteiras: CarteiraAdvogadoView[] }): ReactElement => (
  <div className="card" style={{ marginTop: 24 }}>
    <h3>Carteira de contratos dos advogados parceiros</h3>
    <p className="page-sub" style={{ marginTop: 0 }}>
      O advogado compra contratos (R$ 100/un — ex.: R$ 20.000 = 200) e cada cliente encaminhado
      abate automaticamente os PROCESSOS do guia (ativos 1=1; não-ativos 3=1 por banco/ano). O mesmo
      cliente nunca abate duas vezes.
    </p>
    {carteiras.length === 0 ? (
      <div className="empty">Nenhum advogado cadastrado ainda (aba Operadores).</div>
    ) : (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Advogado</th>
              <th>Comprados</th>
              <th>Abatidos</th>
              <th>Saldo</th>
              <th>Clientes</th>
              <th>Registrar compra</th>
            </tr>
          </thead>
          <tbody>
            {carteiras.map((c) => (
              <tr key={c.advogadoId}>
                <td style={{ fontWeight: 600 }}>
                  {c.nome}
                  {c.extrato.length > 0 ? (
                    <details style={{ marginTop: 4 }}>
                      <summary style={{ cursor: 'pointer', fontSize: 12 }}>
                        extrato ({c.extrato.length})
                      </summary>
                      <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 12 }}>
                        {c.extrato.map((l, i) => (
                          <li key={i}>
                            {dataBr(l.em)} — {textoDoLancamento(l)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </td>
                <td>{c.comprados}</td>
                <td>{c.abatidos}</td>
                <td>
                  <strong style={{ color: c.saldo < 0 ? '#c62828' : undefined }}>{c.saldo}</strong>
                </td>
                <td>{c.clientesAbatidos}</td>
                <td>
                  <FormCompra advogadoId={c.advogadoId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export default CarteiraAdvogados;
