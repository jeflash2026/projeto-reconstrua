'use client';
// RESULTADO DO PROCESSO (2026-09-16) — o desfecho que o escritório lança quando
// o processo termina: PAGO (valor total recebido, antes da divisão com o
// cliente) ou ENCERRADO SEM ÊXITO. Se o processo está na carteira de um
// investidor, o valor lançado aqui atualiza o painel dele na hora.
import { useState, type ReactElement } from 'react';
import type { ResultadoProcessoView } from '../lib/api';

const moeda = (v: number): string =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dataBr = (d: string | null): string =>
  d === null || d === '' ? '—' : `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export default function ResultadoProcesso({
  numero,
  resultado,
  investidor,
}: {
  numero: string;
  resultado: ResultadoProcessoView | null;
  investidor: string | null;
}): ReactElement {
  const encerrado = resultado !== null && resultado.situacao !== 'em-andamento';
  const [editando, setEditando] = useState(false);
  const [situacao, setSituacao] = useState<'pago' | 'perdido' | 'em-andamento'>(
    encerrado ? resultado.situacao : 'pago',
  );
  const [valor, setValor] = useState(
    encerrado && resultado.valorRecebido !== null && resultado.valorRecebido > 0
      ? String(resultado.valorRecebido).replace('.', ',')
      : '',
  );
  const [data, setData] = useState(encerrado ? (resultado.data ?? '') : '');
  const [observacao, setObservacao] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(): Promise<void> {
    setErro(null);
    if (situacao === 'pago' && valor.trim() === '') {
      setErro('Informe o valor total recebido no processo.');
      return;
    }
    const confirmacao =
      situacao === 'pago'
        ? `Lançar o processo como PAGO com ${valor} recebidos?`
        : situacao === 'perdido'
          ? 'Lançar o processo como ENCERRADO SEM ÊXITO?'
          : 'Desfazer o desfecho e voltar o processo para EM ANDAMENTO?';
    if (
      !window.confirm(
        investidor !== null
          ? `${confirmacao}\n\nEste processo está na carteira de ${investidor}: o painel dele será atualizado.`
          : confirmacao,
      )
    )
      return;
    setOcupado(true);
    try {
      const res = await fetch(`/juridico/api/j/processos/${numero}/resultado`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ situacao, valorRecebido: valor, data, observacao }),
      });
      const r = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(r.error ?? 'Não foi possível lançar o resultado.');
        return;
      }
      window.location.reload();
    } catch {
      setErro('Falha de rede — tente de novo.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="secao-form">
      <h3>Resultado do processo</h3>
      {investidor !== null ? (
        <p style={{ margin: '0 0 10px', fontSize: 13.5 }}>
          Este processo está na carteira do investidor <strong>{investidor}</strong>. O valor
          lançado aqui atualiza o painel dele.
        </p>
      ) : null}
      {encerrado && !editando ? (
        <>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {resultado.situacao === 'pago'
              ? `Pago — ${moeda(resultado.valorRecebido ?? 0)} recebidos em ${dataBr(resultado.data)}`
              : `Encerrado sem êxito em ${dataBr(resultado.data)}`}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', margin: '4px 0 10px' }}>
            Lançado por {resultado.autor}
            {resultado.observacao !== '' ? ` · ${resultado.observacao}` : ''}
          </div>
          <button className="btn" onClick={() => setEditando(true)}>
            Corrigir o resultado
          </button>
        </>
      ) : !editando ? (
        <>
          <p style={{ margin: '0 0 10px', color: 'var(--ink-dim)' }}>
            Em andamento. Quando o processo terminar, lance aqui se foi pago (com o valor total
            recebido) ou encerrado sem êxito.
          </p>
          <button className="btn" onClick={() => setEditando(true)}>
            Lançar resultado
          </button>
        </>
      ) : (
        <>
          <div className="form-grade">
            <label>
              Situação
              <select
                value={situacao}
                onChange={(e) => setSituacao(e.target.value as typeof situacao)}
                disabled={ocupado}
              >
                <option value="pago">Pago</option>
                <option value="perdido">Encerrado sem êxito</option>
                {encerrado ? <option value="em-andamento">Voltar para em andamento</option> : null}
              </select>
            </label>
            {situacao === 'pago' ? (
              <label>
                Valor total recebido no processo (R$)
                <input
                  inputMode="decimal"
                  placeholder="ex.: 14.000,00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  disabled={ocupado}
                />
              </label>
            ) : null}
            {situacao !== 'em-andamento' ? (
              <label>
                Data
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  disabled={ocupado}
                />
              </label>
            ) : null}
            <label>
              Observação (opcional)
              <input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                disabled={ocupado}
              />
            </label>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-dim)', margin: '8px 0' }}>
            Valor total do processo, antes da divisão com o cliente. Sem data, vale a de hoje.
          </p>
          {erro !== null ? <div className="erro-box">{erro}</div> : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn primario" disabled={ocupado} onClick={() => void salvar()}>
              {ocupado ? 'Salvando…' : 'Salvar resultado'}
            </button>
            <button className="btn" disabled={ocupado} onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
