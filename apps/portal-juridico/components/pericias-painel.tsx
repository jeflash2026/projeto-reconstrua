'use client';
// PERÍCIAS — agenda judicial: processo, requerente × requerido, data/hora,
// local, situação, advogado e andamento. Criação, edição e remoção.
import { useState, type ReactElement } from 'react';
import { ROTULO_SITUACAO, dataBr, type PericiaJuridica } from '../lib/api';

const VAZIA = {
  processo: '',
  assunto: '',
  requerente: '',
  requerido: '',
  data: '',
  horario: '',
  local: '',
  situacao: '',
  advogado: '',
  andamento: '',
};

export default function PericiasPainel({
  pericias,
}: {
  pericias: PericiaJuridica[];
}): ReactElement {
  const [form, setForm] = useState<Record<string, string>>({ ...VAZIA });
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const agendadas = pericias.filter((p) => p.situacao === 'agendada').length;

  async function enviar(payload: Record<string, unknown>): Promise<void> {
    setErro(null);
    setOcupado(true);
    try {
      const res = await fetch('/juridico/api/j/pericias', {
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

  const campo = (chave: string, rotulo: string, tipo = 'text'): ReactElement => (
    <label className="campo" key={chave}>
      <span>{rotulo}</span>
      <input
        type={tipo}
        value={form[chave] ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, [chave]: e.target.value }))}
      />
    </label>
  );

  return (
    <>
      <div className="cards">
        <div className="card">
          <div className="rotulo">Perícias</div>
          <div className="valor">{pericias.length}</div>
        </div>
        <div className="card ok">
          <div className="rotulo">Agendadas</div>
          <div className="valor">{agendadas}</div>
        </div>
      </div>

      <div className="secao-form">
        <h3>{editando === null ? 'Nova perícia' : 'Editando perícia'}</h3>
        <div className="form-grade">
          {campo('processo', 'Processo *')}
          {campo('assunto', 'Assunto')}
          {campo('requerente', 'Requerente *')}
          {campo('requerido', 'Requerido')}
          {campo('data', 'Data da perícia', 'date')}
          {campo('horario', 'Horário', 'time')}
          {campo('local', 'Cidade/local')}
          <label className="campo">
            <span>Situação *</span>
            <select
              value={form['situacao'] ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, situacao: e.target.value }))}
            >
              <option value="">Selecione a situação</option>
              {Object.entries(ROTULO_SITUACAO).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </label>
          {campo('advogado', 'Advogado responsável')}
          {campo('andamento', 'Andamento / observações')}
        </div>
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
            {editando === null ? 'Cadastrar perícia' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {pericias.length === 0 ? (
        <div className="vazio">Nenhuma perícia cadastrada ainda.</div>
      ) : (
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Processo</th>
                <th>Requerente</th>
                <th>Requerido</th>
                <th>Data / hora</th>
                <th>Cidade</th>
                <th>Situação</th>
                <th>Advogado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pericias.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.processo}</td>
                  <td style={{ fontWeight: 600 }}>{p.requerente}</td>
                  <td>{p.requerido || '—'}</td>
                  <td>
                    {p.data === null
                      ? 'Sem data'
                      : `${dataBr(p.data)}${p.horario !== null ? ` às ${p.horario}` : ''}`}
                  </td>
                  <td>{p.local || '—'}</td>
                  <td>
                    <span
                      className={`selo-status ${
                        p.situacao === 'agendada'
                          ? 'ativo'
                          : p.situacao === 'cancelada' || p.situacao === 'nao-compareceu'
                            ? 'excluido'
                            : 'neutro'
                      }`}
                    >
                      {ROTULO_SITUACAO[p.situacao] ?? p.situacao}
                    </span>
                  </td>
                  <td>{p.advogado || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        className="btn"
                        onClick={() => {
                          setEditando(p.id);
                          setForm({
                            processo: p.processo,
                            assunto: p.assunto,
                            requerente: p.requerente,
                            requerido: p.requerido,
                            data: p.data ?? '',
                            horario: p.horario ?? '',
                            local: p.local,
                            situacao: p.situacao,
                            advogado: p.advogado,
                            andamento: p.andamento,
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
                          if (window.confirm(`Remover a perícia de ${p.requerente}?`))
                            void enviar({ id: p.id, acao: 'remover' });
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
