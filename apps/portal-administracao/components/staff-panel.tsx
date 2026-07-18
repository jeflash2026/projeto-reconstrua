'use client';
// STAFF PANEL — gestão da equipe por papel: cadastrar, editar, ativar, desativar,
// fila e carga (read models). Compartilhado por Advogados/Peritos/Operadores/Supervisores.
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { type StaffData } from '../lib/api';
import { createStaff, fetchStaff, setStaffActive } from '../lib/actions';
import { formatDate } from '../lib/format';

const StaffPanel = ({ role, title }: { role: string; title: string }): ReactElement => {
  const [data, setData] = useState<StaffData | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setData(await fetchStaff(role));
  }, [role]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      void load();
    }, 8000);
    return () => {
      window.clearInterval(id);
    };
  }, [load]);

  const register = async (): Promise<void> => {
    setError(null);
    if (name.trim() === '') {
      setError('Informe o nome.');
      return;
    }
    const created = await createStaff(role, name, email.trim() === '' ? null : email);
    if (!created) {
      setError('Falha ao cadastrar (API indisponível?).');
      return;
    }
    setName('');
    setEmail('');
    await load();
  };

  const setActive = async (id: string, active: boolean): Promise<void> => {
    await setStaffActive(id, active);
    await load();
  };

  return (
    <>
      <h1 className="page-title">{title}</h1>
      <p className="page-sub">Diretório operacional — carga e fila vêm dos Read Models.</p>

      {data ? (
        <div className="grid stats" style={{ marginBottom: 16 }}>
          <div className="card stat"><div className="value">{data.workload.activeMembers}</div><div className="label">Ativos</div></div>
          <div className="card stat"><div className="value">{data.workload.inactiveMembers}</div><div className="label">Inativos</div></div>
          <div className="card stat"><div className="value">{data.workload.openHandoffs}</div><div className="label">Fila (handoffs abertos)</div></div>
          <div className="card stat">
            <div className="value">{data.workload.avgQueuePerMember === null ? '—' : data.workload.avgQueuePerMember.toFixed(1)}</div>
            <div className="label">Carga média por pessoa</div>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Cadastrar</h3>
        <div className="form-row">
          <input placeholder="Nome completo" value={name} onChange={(e) => { setName(e.target.value); }} />
          <input placeholder="E-mail (opcional)" value={email} onChange={(e) => { setEmail(e.target.value); }} />
          <button className="primary" onClick={() => { void register(); }}>
            Cadastrar
          </button>
        </div>
        {error ? <div className="error-box">{error}</div> : null}
      </div>

      <div className="card">
        <h3>Equipe</h3>
        {!data ? (
          <div className="error-box">API indisponível.</div>
        ) : data.members.length === 0 ? (
          <div className="empty">Ninguém cadastrado ainda.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>ID (login no portal)</th>
                  <th>Status</th>
                  <th>Cadastro</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.name}</td>
                    <td>{m.email ?? '—'}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{m.id}</td>
                    <td>{m.active ? <span className="badge ok">ativo</span> : <span className="badge bad">inativo</span>}</td>
                    <td>{formatDate(m.createdAt)}</td>
                    <td>
                      <button onClick={() => { void setActive(m.id, !m.active); }}>{m.active ? 'Desativar' : 'Ativar'}</button>
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
};

export default StaffPanel;
