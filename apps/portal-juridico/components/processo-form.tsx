'use client';
// NOVO PROCESSO — espelho do original: cliente + nº CNJ + bancos dinâmicos,
// cada banco com seus contratos (número, valor, assinatura, início, fim
// previsto, observações). "Adicionar banco" / "Adicionar contrato".
import { useState, type ReactElement } from 'react';

interface ContratoForm {
  numero: string;
  valor: string;
  assinatura: string;
  inicio: string;
  fimPrevisto: string;
  observacoes: string;
}

interface BancoForm {
  banco: string;
  contratos: ContratoForm[];
}

const CONTRATO_VAZIO: ContratoForm = {
  numero: '',
  valor: '',
  assinatura: '',
  inicio: '',
  fimPrevisto: '',
  observacoes: '',
};

export default function ProcessoForm({
  clientes,
  clienteInicial = '',
}: {
  clientes: { id: string; nome: string; cpfCnpj: string }[];
  clienteInicial?: string;
}): ReactElement {
  const [clienteId, setClienteId] = useState(clienteInicial);
  const [numero, setNumero] = useState('');
  const [status, setStatus] = useState('ativo');
  const [bancos, setBancos] = useState<BancoForm[]>([
    { banco: '', contratos: [{ ...CONTRATO_VAZIO }] },
  ]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function mudarBanco(i: number, mudanca: Partial<BancoForm>): void {
    setBancos((b) => b.map((banco, j) => (j === i ? { ...banco, ...mudanca } : banco)));
  }

  function mudarContrato(i: number, k: number, mudanca: Partial<ContratoForm>): void {
    setBancos((b) =>
      b.map((banco, j) =>
        j === i
          ? {
              ...banco,
              contratos: banco.contratos.map((c, l) => (l === k ? { ...c, ...mudanca } : c)),
            }
          : banco,
      ),
    );
  }

  async function salvar(): Promise<void> {
    setErro(null);
    if (clienteId === '') {
      setErro('selecione o cliente');
      return;
    }
    if (numero.trim() === '') {
      setErro('informe o número do processo');
      return;
    }
    setOcupado(true);
    try {
      const res = await fetch('/juridico/api/j/processos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          dados: { clienteId, numero: numero.trim(), status, bancos },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(data.error ?? 'falha ao cadastrar');
        return;
      }
      window.location.href = `/juridico/clientes/${clienteId}`;
    } catch {
      setErro('falha de rede — tente de novo');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <div className="secao-form">
        <h3>Identificação</h3>
        <div className="form-grade">
          <label className="campo">
            <span>Cliente *</span>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Selecione</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.cpfCnpj ? ` - ${c.cpfCnpj}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span>Número do processo *</span>
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="0000000-00.0000.0.00.0000"
            />
          </label>
          <label className="campo">
            <span>Status inicial</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ativo">Ativo</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </label>
        </div>
      </div>

      <div className="secao-form">
        <h3>Bancos e contratos</h3>
        {bancos.map((banco, i) => (
          <div
            key={i}
            style={{
              border: '1px solid var(--linha)',
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label className="campo" style={{ flex: 1, minWidth: 220 }}>
                <span>Banco</span>
                <input
                  value={banco.banco}
                  onChange={(e) => mudarBanco(i, { banco: e.target.value })}
                  placeholder="Ex.: Banco Safra S/A"
                />
              </label>
              {bancos.length > 1 ? (
                <button
                  className="btn perigo"
                  type="button"
                  onClick={() => setBancos((b) => b.filter((_, j) => j !== i))}
                >
                  Remover banco
                </button>
              ) : null}
            </div>
            {banco.contratos.map((c, k) => (
              <div
                key={k}
                style={{
                  borderTop: '1px dashed var(--linha)',
                  marginTop: 10,
                  paddingTop: 10,
                }}
              >
                <div className="form-grade">
                  <label className="campo">
                    <span>Contrato</span>
                    <input
                      value={c.numero}
                      onChange={(e) => mudarContrato(i, k, { numero: e.target.value })}
                    />
                  </label>
                  <label className="campo">
                    <span>Valor</span>
                    <input
                      value={c.valor}
                      onChange={(e) => mudarContrato(i, k, { valor: e.target.value })}
                      placeholder="R$ 0,00"
                    />
                  </label>
                  <label className="campo">
                    <span>Assinatura</span>
                    <input
                      type="date"
                      value={c.assinatura}
                      onChange={(e) => mudarContrato(i, k, { assinatura: e.target.value })}
                    />
                  </label>
                  <label className="campo">
                    <span>Início</span>
                    <input
                      type="date"
                      value={c.inicio}
                      onChange={(e) => mudarContrato(i, k, { inicio: e.target.value })}
                    />
                  </label>
                  <label className="campo">
                    <span>Fim previsto</span>
                    <input
                      type="date"
                      value={c.fimPrevisto}
                      onChange={(e) => mudarContrato(i, k, { fimPrevisto: e.target.value })}
                    />
                  </label>
                  <label className="campo">
                    <span>Observações</span>
                    <input
                      value={c.observacoes}
                      onChange={(e) => mudarContrato(i, k, { observacoes: e.target.value })}
                    />
                  </label>
                </div>
                {banco.contratos.length > 1 ? (
                  <button
                    className="btn perigo"
                    type="button"
                    style={{ marginTop: 8 }}
                    onClick={() =>
                      mudarBanco(i, { contratos: banco.contratos.filter((_, l) => l !== k) })
                    }
                  >
                    Remover contrato
                  </button>
                ) : null}
              </div>
            ))}
            <button
              className="btn"
              type="button"
              style={{ marginTop: 10 }}
              onClick={() =>
                mudarBanco(i, { contratos: [...banco.contratos, { ...CONTRATO_VAZIO }] })
              }
            >
              + Adicionar contrato
            </button>
          </div>
        ))}
        <button
          className="btn"
          type="button"
          onClick={() =>
            setBancos((b) => [...b, { banco: '', contratos: [{ ...CONTRATO_VAZIO }] }])
          }
        >
          + Adicionar banco
        </button>
      </div>

      {erro !== null ? <div className="erro-box">{erro}</div> : null}
      <div className="form-rodape">
        <a className="btn" href="/juridico/processos">
          Cancelar
        </a>
        <button className="btn primario" disabled={ocupado} onClick={() => void salvar()}>
          {ocupado ? 'Cadastrando…' : 'Cadastrar processo'}
        </button>
      </div>
    </>
  );
}
