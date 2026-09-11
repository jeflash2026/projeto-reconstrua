'use client';
// Botão "Atualizar andamentos" — dispara a consulta de TODOS os processos no
// DataJud e no DJEN. O DJEN passa pelo relay do Corvo, que pede ~3,5 s entre
// processos (limite do CNJ): a rodada leva minutos, então o botão só dispara e
// a tela acompanha pelo status; ao terminar, recarrega (2026-09-11).
import { useEffect, useState, type ReactElement } from 'react';

interface StatusAtualizacao {
  atualizando: boolean;
  iniciadaEm: string | null;
  ultima: {
    ok: boolean;
    consultados?: number;
    encontrados?: number;
    novidades?: number;
    erros?: number;
    error?: string;
    terminouEm: string;
  } | null;
}

async function lerStatus(): Promise<StatusAtualizacao | null> {
  try {
    const res = await fetch('/juridico/api/j/andamentos/status', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as StatusAtualizacao;
  } catch {
    return null;
  }
}

function resumo(u: NonNullable<StatusAtualizacao['ultima']>): string {
  if (!u.ok) return `Falha: ${u.error ?? 'erro na consulta'}`;
  const erros = u.erros ?? 0;
  return `${String(u.consultados ?? 0)} consultado(s) · ${String(u.encontrados ?? 0)} encontrado(s) · ${String(u.novidades ?? 0)} com novidade${erros > 0 ? ` · ${String(erros)} erro(s)` : ''}.`;
}

export default function AtualizarAndamentos({ processos }: { processos: number }): ReactElement {
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  // Abriu a tela no meio de uma rodada (a automática ou de outra pessoa):
  // já mostra o andamento em vez de oferecer o botão.
  useEffect(() => {
    void lerStatus().then((s) => {
      if (s?.atualizando === true) setRodando(true);
    });
  }, []);

  // Rodada em curso: confere a cada 5 s e recarrega quando terminar.
  useEffect(() => {
    if (!rodando) return;
    const timer = setInterval(() => {
      void lerStatus().then((s) => {
        if (s === null || s.atualizando) return;
        clearInterval(timer);
        setRodando(false);
        setResultado(s.ultima === null ? 'Atualização concluída.' : resumo(s.ultima));
        setTimeout(() => window.location.reload(), 1500);
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [rodando]);

  async function atualizar(): Promise<void> {
    setResultado(null);
    try {
      const res = await fetch('/juridico/api/j/andamentos/atualizar', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setResultado(`Falha: ${data.error ?? 'erro ao iniciar a consulta'}`);
        return;
      }
      setRodando(true);
    } catch {
      setResultado('Falha de rede — tente de novo.');
    }
  }

  const minutos = Math.max(1, Math.ceil((processos * 3.5) / 60));
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button
        className="btn"
        disabled={rodando}
        title="Consulta cada processo no DataJud (capa e movimentações) e no DJEN (publicações e intimações)"
        onClick={() => void atualizar()}
      >
        {rodando
          ? `Consultando ${String(processos)} processo(s)… (uns ${String(minutos)} min)`
          : '⚖ Atualizar andamentos (DataJud + DJEN)'}
      </button>
      {resultado !== null ? (
        <span style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 600 }}>{resultado}</span>
      ) : null}
    </span>
  );
}
