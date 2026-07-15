'use client';
// FORMULÁRIO DE ATIVIDADE JURÍDICA — a única superfície de escrita do advogado.
// Ao registrar, a AHRI é AUTOMATICAMENTE informada e o Executive Brain decide se o
// cliente será comunicado (a resposta mostra a decisão, com a Regra Operacional).
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';

const KINDS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'numero_processo', label: 'Número do processo' },
  { value: 'protocolo', label: 'Protocolo' },
  { value: 'despacho', label: 'Despacho' },
  { value: 'movimentacao', label: 'Movimentação' },
  { value: 'observacao', label: 'Observação jurídica' },
  { value: 'prazo', label: 'Prazo' },
  { value: 'distribuicao', label: 'Marcar distribuição' },
  { value: 'conclusao', label: 'Marcar conclusão' },
  { value: 'documento', label: 'Anexar documento jurídico (referência)' },
];

interface AhriDecision {
  informed: boolean;
  decidedToSpeak: boolean;
  ruleRefs: string[];
}

const ActivityForm = ({ missionId, apiBase }: { missionId: string; apiBase: string }): ReactElement => {
  const router = useRouter();
  const [kind, setKind] = useState('movimentacao');
  const [text, setText] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (text.trim() === '' || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const cookie = document.cookie.split('; ').find((c) => c.startsWith('advogado-id='));
      const advogadoId = cookie ? decodeURIComponent(cookie.split('=')[1] ?? '') : '';
      const res = await fetch(`${apiBase}/advogado/processos/${missionId}/atividades`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-advogado-id': advogadoId },
        body: JSON.stringify({ kind, text, ...(dueAt !== '' ? { dueAt: new Date(dueAt).toISOString() } : {}) }),
      });
      if (!res.ok) {
        setStatus('Falha ao registrar (verifique sua atribuição).');
      } else {
        const body = (await res.json()) as { ahri: AhriDecision };
        setStatus(
          body.ahri.decidedToSpeak
            ? `Registrado. A AHRI decidiu comunicar o cliente (${body.ahri.ruleRefs.join(', ')}).`
            : 'Registrado. A AHRI foi informada e decidiu não comunicar o cliente agora.',
        );
        setText('');
        setDueAt('');
        router.refresh();
      }
    } catch {
      setStatus('API indisponível.');
    }
    setBusy(false);
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Registrar atividade jurídica</h3>
      <div className="form-row">
        <select value={kind} onChange={(e) => { setKind(e.target.value); }}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <input placeholder="Descrição da atividade…" value={text} onChange={(e) => { setText(e.target.value); }} style={{ flex: 2 }} />
        {kind === 'prazo' ? <input type="date" value={dueAt} onChange={(e) => { setDueAt(e.target.value); }} /> : null}
        <button className="primary" disabled={busy} onClick={() => { void submit(); }}>
          Registrar
        </button>
      </div>
      {status ? <p style={{ margin: 0, color: 'var(--text-dim)' }}>{status}</p> : null}
      <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
        Toda atividade informa a AHRI automaticamente. Quem decide comunicar o cliente é o Executive Brain — você nunca
        conversa diretamente com o cliente.
      </p>
    </div>
  );
};

export default ActivityForm;
