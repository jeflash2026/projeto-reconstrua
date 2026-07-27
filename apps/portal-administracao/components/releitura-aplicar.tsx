'use client';
// APLICAR LEITURA DEFINITIVA (decreto 2026-07-27) — o clique é a autorização
// EXPLÍCITA do admin: substitui o cache dos clientes CONFERIDOS pela auditoria
// do próprio documento (com backup reversível). Divergentes/imagens são pulados.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { pdAplicarReleitura, type AplicarReleituraResultado } from '../lib/actions';

const ReleituraAplicar = ({ conferidos }: { conferidos: number }): ReactElement => {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<AplicarReleituraResultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const aplicar = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setErro(null);
    const r = await pdAplicarReleitura();
    if (r === null) setErro('A API não respondeu — tente novamente.');
    else {
      setResultado(r);
      router.refresh();
    }
    setBusy(false);
    setConfirmando(false);
  };

  if (resultado !== null) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Leitura definitiva aplicada</h3>
        <p>
          <strong>{resultado.aplicados}</strong> cliente(s) atualizados (backup guardado) ·{' '}
          <strong>{resultado.pulados}</strong> pulado(s) para análise manual.
        </p>
        {resultado.detalhes.filter((d) => d.resultado === 'PULADO').length > 0 ? (
          <details>
            <summary style={{ cursor: 'pointer' }}>Ver os pulados</summary>
            <ul style={{ fontSize: 13 }}>
              {resultado.detalhes
                .filter((d) => d.resultado === 'PULADO')
                .map((d) => (
                  <li key={d.chatId} className="mono">
                    {d.chatId} — {d.motivo}
                  </li>
                ))}
            </ul>
          </details>
        ) : null}
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Aplicar leitura definitiva</h3>
      <p className="page-sub" style={{ marginTop: 4 }}>
        Substitui a leitura em produção pela do leitor novo em <strong>{conferidos}</strong>{' '}
        cliente(s) CONFERIDOS pela auditoria do próprio documento. A leitura antiga fica guardada em
        backup (reversível). Divergentes, não reconhecidos e imagens são pulados.
      </p>
      {erro ? <div className="error-box">{erro}</div> : null}
      {confirmando ? (
        <div className="form-row">
          <button className="primary" disabled={busy} onClick={() => void aplicar()}>
            {busy ? 'Aplicando… (reprocessa todos os PDFs)' : 'Confirmar — aplicar agora'}
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setConfirmando(false);
            }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          className="primary"
          disabled={conferidos === 0}
          onClick={() => {
            setConfirmando(true);
          }}
        >
          Aplicar leitura definitiva…
        </button>
      )}
    </div>
  );
};

export default ReleituraAplicar;
