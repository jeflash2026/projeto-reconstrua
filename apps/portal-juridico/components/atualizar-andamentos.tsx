'use client';
// Botão "Atualizar andamentos" — consulta o DataJud (CNJ) para TODOS os
// processos ativos. Leva ~0,5s por processo (ritmo suave com a API pública).
import { useState, type ReactElement } from 'react';

export default function AtualizarAndamentos({ processos }: { processos: number }): ReactElement {
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  async function atualizar(): Promise<void> {
    setOcupado(true);
    setResultado(null);
    try {
      const res = await fetch('/juridico/api/j/andamentos/atualizar', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        consultados?: number;
        encontrados?: number;
        novidades?: number;
        erros?: number;
      };
      if (!res.ok) {
        setResultado(`Falha: ${data.error ?? 'erro na consulta'}`);
        return;
      }
      setResultado(
        `${String(data.consultados ?? 0)} consultado(s) · ${String(data.encontrados ?? 0)} encontrado(s) no DataJud · ${String(data.novidades ?? 0)} com novidade${(data.erros ?? 0) > 0 ? ` · ${String(data.erros)} erro(s)` : ''}.`,
      );
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setResultado('Falha de rede — tente de novo.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button
        className="btn"
        disabled={ocupado}
        title="Consulta a classe e as movimentações de cada processo na API pública do CNJ (DataJud)"
        onClick={() => void atualizar()}
      >
        {ocupado
          ? `Consultando ${String(processos)} processo(s)…`
          : '⚖ Atualizar andamentos (DataJud)'}
      </button>
      {resultado !== null ? (
        <span style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 600 }}>{resultado}</span>
      ) : null}
    </span>
  );
}
