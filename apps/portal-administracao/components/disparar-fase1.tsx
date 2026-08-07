'use client';
// BOTÃO DO REAQUECIMENTO FASE 1 (2026-08-07) — decreto do dono: nada
// automático; o lote só sai daqui, com confirmação explícita. O template sai
// pelo número OFICIAL da AHRI; quando o lead responde, o funil retoma sozinho
// de onde parou (a resposta é permitida pelo decreto).
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { dispararReaquecimentoFase1 } from '../lib/actions';

const DispararFase1 = ({ elegiveis }: { elegiveis: number }): ReactElement => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<{
    enviados: number;
    falhas: { nome: string; erro: string }[];
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const disparar = async (): Promise<void> => {
    const confirmado = window.confirm(
      `Reaquecer ${String(elegiveis)} lead(s) da FASE 1 (com HISCON legível, sem confirmação de interesse)?\n\nCada lead recebe UMA mensagem (template reaquecimento_fase1 pelo número oficial da AHRI); quem já recebeu nas últimas 24h fica fora. Quando o lead responder, a AHRI retoma o atendimento sozinha do ponto em que ele parou.`,
    );
    if (!confirmado) return;
    setBusy(true);
    setErro(null);
    setResultado(null);
    try {
      const r = await dispararReaquecimentoFase1();
      if (r === null) setErro('falha no disparo — a API não respondeu; confira e tente de novo');
      else {
        setResultado(r);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        className="primary"
        disabled={busy || elegiveis === 0}
        onClick={() => void disparar()}
      >
        {busy
          ? 'Reaquecendo… (ritmo suave, aguarde)'
          : `🔥 Reaquecer ${String(elegiveis)} lead(s) da fase 1`}
      </button>
      {erro !== null ? <div className="error-box">{erro}</div> : null}
      {resultado !== null ? (
        <div className="card" style={{ marginTop: 10 }}>
          <strong>{resultado.enviados} enviada(s) com sucesso.</strong>
          {resultado.falhas.length > 0 ? (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
              {resultado.falhas.slice(0, 20).map((f, i) => (
                <li key={i}>
                  {f.nome} — {f.erro}
                </li>
              ))}
              {resultado.falhas.length > 20 ? (
                <li>… e mais {resultado.falhas.length - 20} falha(s)</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default DispararFase1;
