'use client';
// ESTORNO GERAL DAS PERÍCIAS (decreto 2026-07-27) — os estudos baixados com a
// LEITURA ANTIGA do HISCON voltam todos a "prontos para download": o próximo
// download já sai com a leitura corrigida. Registros (credenciais/resposta do
// banco inclusos) ficam guardados em backup. Confirmação em 2 passos.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { pdEstornarPericias } from '../lib/actions';

const EstornarPericias = ({ baixadas }: { baixadas: number }): ReactElement | null => {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feito, setFeito] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (baixadas === 0 && feito === null) return null;

  const estornar = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setErro(null);
    const r = await pdEstornarPericias();
    if (r === null) setErro('A API não respondeu — tente novamente.');
    else {
      setFeito(r.estornados);
      router.refresh();
    }
    setBusy(false);
    setConfirmando(false);
  };

  if (feito !== null) {
    return (
      <div className="card" style={{ marginTop: 24 }}>
        <h3>Estorno concluído</h3>
        <p>
          <strong>{feito}</strong> estudo(s) voltaram para &quot;prontos para download&quot; — o
          próximo download do perito já sai com a leitura nova. Credenciais e respostas de banco
          ficaram guardadas em backup.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h3>Estornar estudos baixados (leitura antiga)</h3>
      <p className="page-sub" style={{ marginTop: 4 }}>
        Devolve os <strong>{baixadas}</strong> estudo(s) já baixados para &quot;prontos para
        download&quot; — o perito baixa de novo, agora com a leitura corrigida do HISCON. Nada é
        perdido: credenciais e respostas de banco ficam guardadas em backup.
      </p>
      {erro !== null ? <div className="error-box">{erro}</div> : null}
      {confirmando ? (
        <div className="form-row">
          <button className="primary" disabled={busy} onClick={() => void estornar()}>
            {busy ? 'Estornando…' : `Confirmar — estornar ${baixadas} estudo(s)`}
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
          onClick={() => {
            setConfirmando(true);
          }}
        >
          Estornar todos para novo download…
        </button>
      )}
    </div>
  );
};

export default EstornarPericias;
