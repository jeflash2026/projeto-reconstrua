'use client';
// TRANSFERIR CLIENTE DE ADVOGADO (2026-08-12) — o encaminhamento foi para o
// advogado errado. Busca por NOME ou TELEFONE (é assim que o dono conhece o
// cliente), mostra com quem ele está hoje e troca com confirmação. Os créditos
// seguem o cliente: voltam para quem o perdeu, saem de quem o recebeu.
// Nenhuma mensagem é enviada — avisar os advogados é do dono.
import { useState, type ReactElement } from 'react';
import { buscarClienteParaTransferir, transferirClienteDeAdvogado } from '../lib/actions';

export interface ClienteAchado {
  chatId: string;
  nome: string;
  telefone: string;
  uf: string;
  advogadoId: string | null;
  advogado: string | null;
}
export interface AdvogadoOpcao {
  id: string;
  nome: string;
}

function telefoneBonito(t: string): string {
  const d = t.replace(/\D/g, '');
  const local = d.startsWith('55') ? d.slice(2) : d;
  if (local.length < 10) return t;
  return `(${local.slice(0, 2)}) ${local.slice(2, -4)}-${local.slice(-4)}`;
}

export default function TransferirAdvogado(): ReactElement {
  const [termo, setTermo] = useState('');
  const [clientes, setClientes] = useState<ClienteAchado[] | null>(null);
  const [advogados, setAdvogados] = useState<AdvogadoOpcao[]>([]);
  const [destino, setDestino] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function buscar(): Promise<void> {
    setErro(null);
    setAviso(null);
    setBusy(true);
    const r = await buscarClienteParaTransferir(termo.trim());
    setBusy(false);
    if (r === null) {
      setErro('API indisponível (ou ainda sem o deploy desta versão).');
      return;
    }
    setClientes(r.clientes);
    setAdvogados(r.advogados ?? []);
  }

  async function transferir(c: ClienteAchado): Promise<void> {
    const advogadoId = destino[c.chatId] ?? '';
    if (advogadoId === '') return;
    const nomeDestino = advogados.find((a) => a.id === advogadoId)?.nome ?? advogadoId;
    if (
      !window.confirm(
        `Transferir ${c.nome} de ${c.advogado ?? 'ninguém'} para ${nomeDestino}? Os créditos voltam para o advogado antigo e são debitados do novo. Nenhuma mensagem é enviada — avise os dois.`,
      )
    )
      return;
    setErro(null);
    setBusy(true);
    const r = await transferirClienteDeAdvogado(c.chatId, advogadoId);
    setBusy(false);
    if (!r.ok) {
      setErro(r.error ?? 'falha na transferência');
      return;
    }
    setAviso(
      `${c.nome} agora é de ${nomeDestino}. Créditos: ${String(r.estornados ?? 0)} devolvido(s) ao advogado anterior, ${String(r.abatidos ?? 0)} debitado(s) do novo.`,
    );
    await buscar();
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Achar o cliente</h3>
        <p className="page-sub">Pelo nome ou pelo telefone — pode digitar com ou sem máscara.</p>
        <div className="form-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input
            type="text"
            placeholder="Nome ou telefone"
            value={termo}
            autoComplete="off"
            onChange={(e) => {
              setTermo(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void buscar();
            }}
          />
          <button disabled={busy || termo.trim().length < 3} onClick={() => void buscar()}>
            Buscar
          </button>
        </div>
        {erro !== null ? <div className="error-box">{erro}</div> : null}
        {aviso !== null ? (
          <div className="badge ok" style={{ marginTop: 8 }}>
            {aviso}
          </div>
        ) : null}
      </div>

      {clientes !== null ? (
        <div className="card">
          <h3>Resultados ({clientes.length})</h3>
          {clientes.length === 0 ? (
            <div className="empty">
              Ninguém encontrado. A busca cobre a mesa do Humanizado — quem ainda não confirmou o
              interesse não aparece aqui.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Telefone</th>
                    <th>UF</th>
                    <th>Advogado atual</th>
                    <th>Transferir para</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c.chatId}>
                      <td style={{ fontWeight: 600 }}>{c.nome}</td>
                      <td className="mono">{telefoneBonito(c.telefone)}</td>
                      <td>{c.uf}</td>
                      <td>
                        {c.advogado === null ? (
                          <span className="badge dim">sem advogado</span>
                        ) : (
                          c.advogado
                        )}
                      </td>
                      <td>
                        <select
                          value={destino[c.chatId] ?? ''}
                          onChange={(e) => {
                            setDestino((d) => ({ ...d, [c.chatId]: e.target.value }));
                          }}
                        >
                          <option value="">Escolha…</option>
                          {advogados
                            .filter((a) => a.id !== c.advogadoId)
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.nome}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>
                        <button
                          className="primary"
                          disabled={busy || (destino[c.chatId] ?? '') === ''}
                          onClick={() => void transferir(c)}
                        >
                          Transferir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
