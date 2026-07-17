'use client';
// ATRIBUIÇÃO (BL-3.4) — o Administrador atribui esta missão qualificada a um advogado
// parceiro (Sociedade). Chama a API EXISTENTE do servidor Advogado via Server Action
// (server-side, autenticado). Após atribuir, o caso aparece no portal do advogado
// pelos mecanismos já existentes (isolamento por atribuição). O advogado nunca fala
// com o cliente — quem comunica é a AHRI.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { assignCase } from '../lib/actions';

const AssignForm = ({
  missionId,
  advogados,
}: {
  missionId: string;
  advogados: ReadonlyArray<{ id: string; name: string }>;
}): ReactElement => {
  const router = useRouter();
  const [advogadoId, setAdvogadoId] = useState(advogados[0]?.id ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (advogadoId === '' || busy) return;
    setBusy(true);
    setStatus(null);
    const result = await assignCase(missionId, advogadoId, 'admin');
    if (result) {
      setStatus('Caso atribuído. O advogado já vê o processo no portal dele.');
      router.refresh();
    } else {
      setStatus('Falha ao atribuir (verifique a configuração do Advogado).');
    }
    setBusy(false);
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Atribuir a advogado parceiro (Sociedade)</h3>
      {advogados.length === 0 ? (
        <div className="empty">Nenhum advogado ativo cadastrado.</div>
      ) : (
        <div className="form-row">
          <select value={advogadoId} onChange={(e) => { setAdvogadoId(e.target.value); }}>
            {advogados.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button className="primary" disabled={busy} onClick={() => { void submit(); }}>
            Atribuir
          </button>
        </div>
      )}
      {status ? <p style={{ margin: '8px 0 0', color: 'var(--text-dim)' }}>{status}</p> : null}
    </div>
  );
};

export default AssignForm;
