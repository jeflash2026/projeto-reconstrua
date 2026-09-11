'use client';
// Botão "Gerar parecer agora" (2026-09-11) — a publicação atual do processo
// ainda sem parecer: a AHRI lê o texto do DJEN na hora (alguns segundos).
import { useState, type ReactElement } from 'react';

export default function GerarParecer({ numero }: { numero: string }): ReactElement {
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  async function gerar(): Promise<void> {
    setOcupado(true);
    setResultado(null);
    try {
      const res = await fetch(`/juridico/api/j/processos/${numero}/parecer`, { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        analisadas?: number;
        erros?: number;
      };
      if (!res.ok) {
        setResultado(`Falha: ${data.error ?? 'erro ao gerar o parecer'}`);
        return;
      }
      if ((data.analisadas ?? 0) > 0) {
        setResultado('Parecer pronto.');
        setTimeout(() => window.location.reload(), 800);
        return;
      }
      if ((data.erros ?? 0) > 0) {
        setResultado(
          'A AHRI não conseguiu ler esta publicação agora — tente de novo em instantes.',
        );
        return;
      }
      // Nada pendente: a rodada em segundo plano já estava gerando este parecer.
      setResultado('A AHRI já está preparando este parecer — atualizando…');
      setTimeout(() => window.location.reload(), 4000);
    } catch {
      setResultado('Falha de rede — tente de novo.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button className="btn primario" disabled={ocupado} onClick={() => void gerar()}>
        {ocupado ? 'A AHRI está lendo a publicação…' : 'Gerar parecer agora'}
      </button>
      {resultado !== null ? (
        <span style={{ fontSize: 13, color: 'var(--ink-dim)', fontWeight: 600 }}>{resultado}</span>
      ) : null}
    </span>
  );
}
