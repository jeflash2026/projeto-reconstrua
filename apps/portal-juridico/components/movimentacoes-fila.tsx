'use client';
// FILA DE MOVIMENTAÇÕES — qualquer processo que se mexeu espera o visto do
// advogado. "✓ Dar visto" tira da fila (assinado com o nome da sessão).
import { useState, type ReactElement } from 'react';
import { dataBr } from '../lib/api';

export interface ItemFila {
  numero: string;
  clienteNome: string;
  classe: string;
  orgaoJulgador: string;
  ultimoMovimento: { nome: string; dataHora: string };
  naoVistos: { nome: string; dataHora: string }[];
  pendente: boolean;
  vistoPor: string | null;
  vistoAte: string | null;
}

export default function MovimentacoesFila({ fila }: { fila: ItemFila[] }): ReactElement {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const pendentes = fila.filter((i) => i.pendente);
  const emDia = fila.filter((i) => !i.pendente);

  async function darVisto(numero: string): Promise<void> {
    setErro(null);
    setOcupado(numero);
    try {
      const res = await fetch('/juridico/api/j/movimentacoes/visto', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ numero }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(data.error ?? 'falha ao dar o visto');
        return;
      }
      window.location.reload();
    } catch {
      setErro('falha de rede — tente de novo');
    } finally {
      setOcupado(null);
    }
  }

  const Cartao = ({
    item,
    mostraVisto,
  }: {
    item: ItemFila;
    mostraVisto: boolean;
  }): ReactElement => (
    <div
      className="secao-form"
      style={mostraVisto ? { borderColor: '#f0dfae' } : { opacity: 0.85 }}
    >
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 800 }}>{item.clienteNome}</div>
          <div className="mono" style={{ fontSize: 13 }}>
            <a href={`/juridico/processos?q=${encodeURIComponent(item.numero)}`}>{item.numero}</a>
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
            {item.classe || 'Classe —'}
            {item.orgaoJulgador !== '' ? ` · ${item.orgaoJulgador}` : ''}
          </div>
        </div>
        {mostraVisto ? (
          <button
            className="btn primario"
            disabled={ocupado !== null}
            onClick={() => void darVisto(item.numero)}
          >
            {ocupado === item.numero ? 'Registrando…' : '✓ Dar visto'}
          </button>
        ) : (
          <span style={{ fontSize: 12.5, color: 'var(--ink-dim)', fontWeight: 600 }}>
            visto por {item.vistoPor ?? '—'}
          </span>
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: 13.5 }}>
        {(mostraVisto ? item.naoVistos : [item.ultimoMovimento]).map((m, i) => (
          <div
            key={i}
            style={{
              padding: '5px 0',
              borderBottom: '1px solid var(--linha)',
            }}
          >
            <strong>{dataBr(m.dataHora)}</strong> — {m.nome}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {erro !== null ? <div className="erro-box">{erro}</div> : null}

      <h2 style={{ fontSize: '1.05rem' }}>Aguardando atenção ({pendentes.length})</h2>
      {pendentes.length === 0 ? (
        <div className="ok-box">✓ Tudo visto — nenhuma movimentação esperando conferência.</div>
      ) : (
        pendentes.map((item) => <Cartao key={item.numero} item={item} mostraVisto={true} />)
      )}

      {emDia.length > 0 ? (
        <>
          <h2 style={{ fontSize: '1.05rem', marginTop: 24 }}>Já conferidos ({emDia.length})</h2>
          {emDia.map((item) => (
            <Cartao key={item.numero} item={item} mostraVisto={false} />
          ))}
        </>
      ) : null}
    </>
  );
}
