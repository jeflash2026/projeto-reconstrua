'use client';
// ADVOGADO RESPONSÁVEL (guia v2, 2026-08-04) — a secretária marca a quem o
// cliente pertence ao enviar a procuração. Com a marcação feita, o Jarvis do
// dono monta os pacotes de processos SÓ com os clientes daquele advogado que
// já têm a procuração assinada. Salva no ato da escolha; "— sem advogado —"
// limpa a marcação.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { marcarAdvogadoCliente } from '../lib/actions';
import type { AdvogadoOpcao } from '../lib/api';

const AdvogadoSelect = ({
  chatId,
  advogadoId,
  advogados,
}: {
  chatId: string;
  advogadoId: string | null;
  advogados: AdvogadoOpcao[];
}): ReactElement | null => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState(false);

  if (advogados.length === 0) return null;

  const salvar = async (novo: string): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setErro(false);
    const r = await marcarAdvogadoCliente(chatId, novo === '' ? null : novo);
    if (!r.ok) setErro(true);
    router.refresh();
    setBusy(false);
  };

  return (
    <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--texto-dim)' }}>
        Advogado responsável:
      </label>
      <select
        value={advogadoId ?? ''}
        disabled={busy}
        onChange={(e) => {
          void salvar(e.target.value);
        }}
      >
        <option value="">— sem advogado —</option>
        {advogados.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nome}
          </option>
        ))}
      </select>
      {busy ? <span style={{ fontSize: 12 }}>salvando…</span> : null}
      {erro ? <span style={{ fontSize: 12, color: 'var(--vermelho)' }}>falhou — tente</span> : null}
    </div>
  );
};

export default AdvogadoSelect;
