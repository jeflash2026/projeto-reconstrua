'use client';
// CONTRATOS MIGRADOS (Decreto 2026-07-23) — DESTINAÇÃO DIRETA a um advogado sócio,
// SEM perícia e SEM os 10 dias. Contrato migrado não precisa de pedido
// administrativo; o admin já entrega o cliente ao advogado, que o vê no painel
// dele (op.work.assign — o MESMO assignCase, sem passar pela jornada da perícia).
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { assignCase } from '../lib/actions';
import type { AdvogadoOption } from './jornada-acoes';

const AtribuirSocioDireto = ({
  missionId,
  advogados,
}: {
  missionId: string | null;
  advogados: readonly AdvogadoOption[];
}): ReactElement => {
  const router = useRouter();
  const [advogadoId, setAdvogadoId] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const atribuir = async (): Promise<void> => {
    if (busy || missionId === null || advogadoId === '') return;
    setBusy(true);
    setErro(null);
    const result = await assignCase(missionId, advogadoId, 'admin');
    if (result) {
      setOk(true);
      router.refresh();
    } else {
      setErro('Falha ao atribuir (servidor do Advogado configurado?).');
    }
    setBusy(false);
  };

  if (missionId === null) {
    return <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>sem caso para atribuir</span>;
  }
  if (advogados.length === 0) {
    return (
      <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
        cadastre um advogado em Advogados
      </span>
    );
  }

  return (
    <div className="form-row" style={{ margin: 0, alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>ou atribua direto:</span>
      <select
        value={advogadoId}
        onChange={(e) => {
          setAdvogadoId(e.target.value);
        }}
      >
        <option value="">Escolher advogado…</option>
        {advogados.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <button
        className="primary"
        disabled={busy || advogadoId === ''}
        onClick={() => {
          void atribuir();
        }}
      >
        {busy ? 'Atribuindo…' : 'Atribuir advogado (sem perícia)'}
      </button>
      {ok ? <span style={{ fontSize: 13, color: 'var(--ok)' }}>✓ atribuído</span> : null}
      {erro ? <span style={{ fontSize: 13, color: 'var(--bad)' }}>{erro}</span> : null}
    </div>
  );
};

export default AtribuirSocioDireto;
