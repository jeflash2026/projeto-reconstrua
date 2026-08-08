'use client';
// GUIAS — lançamentos financeiros por processo (nome, advogado, valor, mês,
// andamento) com totalizador, criação, edição e remoção. Espelho do original.
import { useState, type ReactElement } from 'react';
import { MESES, moeda, type GuiaJuridica } from '../lib/api';

const VAZIA = { processo: '', nome: '', advogado: '', valor: '', mes: '', andamento: '' };

export default function GuiasPainel({
  guias,
  total,
}: {
  guias: GuiaJuridica[];
  total: number;
}): ReactElement {
  const [form, setForm] = useState<Record<string, string>>({ ...VAZIA });
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(payload: Record<string, unknown>): Promise<void> {
    setErro(null);
    setOcupado(true);
    try {
      const res = await fetch('/juridico/api/j/guias', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(data.error ?? 'falha na operação');
        return;
      }
      window.location.reload();
    } catch {
      setErro('falha de rede — tente de novo');
    } finally {
      setOcupado(false);
    }
  }

  const campos = (
    <div className="form-grade">
      <label className="campo">
        <span>Processo *</span>
        <input
          value={form['processo'] ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, processo: e.target.value }))}
        />
      </label>
      <label className="campo">
        <span>Nome *</span>
        <input
          value={form['nome'] ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
        />
      </label>
      <label className="campo">
        <span>Advogado responsável</span>
        <input
          value={form['advogado'] ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, advogado: e.target.value }))}
        />
      </label>
      <label className="campo">
        <span>Valor</span>
        <input
          value={form['valor'] ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
          placeholder="R$ 0,00"
        />
      </label>
      <label className="campo">
        <span>Mês *</span>
        <select
          value={form['mes'] ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, mes: e.target.value }))}
        >
          <option value="">Selecione o mês</option>
          {MESES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="campo">
        <span>Andamento</span>
        <input
          value={form['andamento'] ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, andamento: e.target.value }))}
        />
      </label>
    </div>
  );

  return (
    <>
      <div className="cards">
        <div className="card">
          <div className="rotulo">Guias lançadas</div>
          <div className="valor">{guias.length}</div>
        </div>
        <div className="card ok">
          <div className="rotulo">Valor total</div>
          <div className="valor">{moeda(total)}</div>
        </div>
      </div>

      <div className="secao-form">
        <h3>{editando === null ? 'Nova guia' : 'Editando guia'}</h3>
        {campos}
        {erro !== null ? <div className="erro-box">{erro}</div> : null}
        <div className="form-rodape">
          {editando !== null ? (
            <button
              className="btn"
              onClick={() => {
                setEditando(null);
                setForm({ ...VAZIA });
              }}
            >
              Cancelar edição
            </button>
          ) : null}
          <button
            className="btn primario"
            disabled={ocupado}
            onClick={() =>
              void enviar(editando === null ? { dados: form } : { id: editando, dados: form })
            }
          >
            {editando === null ? 'Cadastrar guia' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {guias.length === 0 ? (
        <div className="vazio">Nenhuma guia lançada ainda.</div>
      ) : (
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Processo</th>
                <th>Nome</th>
                <th>Advogado</th>
                <th>Valor</th>
                <th>Mês</th>
                <th>Andamento</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {guias.map((g) => (
                <tr key={g.id}>
                  <td className="mono">{g.processo}</td>
                  <td style={{ fontWeight: 600 }}>{g.nome}</td>
                  <td>{g.advogado || '—'}</td>
                  <td>{moeda(g.valor)}</td>
                  <td>{g.mes}</td>
                  <td>{g.andamento || 'Sem andamento'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        className="btn"
                        onClick={() => {
                          setEditando(g.id);
                          setForm({
                            processo: g.processo,
                            nome: g.nome,
                            advogado: g.advogado,
                            valor: g.valor === null ? '' : String(g.valor).replace('.', ','),
                            mes: g.mes,
                            andamento: g.andamento,
                          });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="btn perigo"
                        disabled={ocupado}
                        onClick={() => {
                          if (window.confirm(`Remover a guia de ${g.nome}?`))
                            void enviar({ id: g.id, acao: 'remover' });
                        }}
                      >
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
