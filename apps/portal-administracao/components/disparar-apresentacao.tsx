'use client';
// BOTÃO DO DISPARO (2026-08-06) — decreto do dono: nada automático; o lote da
// apresentação só sai daqui, com confirmação explícita. O resultado volta na
// tela (enviados + falhas nominais); a trava de 24h da API impede duplicado.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { dispararApresentacaoHumanizado } from '../lib/actions';

const DispararApresentacao = ({ elegiveis }: { elegiveis: number }): ReactElement => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<{
    enviados: number;
    falhas: { nome: string; erro: string }[];
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const disparar = async (): Promise<void> => {
    const confirmado = window.confirm(
      `Disparar a APRESENTAÇÃO da Layara (template aprovado) para ${String(elegiveis)} cliente(s) com documentação enviada e sem retorno?\n\nCada cliente recebe UMA mensagem; quem já recebeu template nas últimas 24h fica fora automaticamente.`,
    );
    if (!confirmado) return;
    setBusy(true);
    setErro(null);
    setResultado(null);
    try {
      const r = await dispararApresentacaoHumanizado();
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
          ? 'Disparando… (ritmo suave, aguarde)'
          : `📣 Disparar apresentação para ${String(elegiveis)} cliente(s)`}
      </button>
      {erro !== null ? <div className="error-box">{erro}</div> : null}
      {resultado !== null ? (
        <div className="card" style={{ marginTop: 10 }}>
          <strong>{resultado.enviados} enviada(s) com sucesso.</strong>
          {resultado.falhas.length > 0 ? (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
              {resultado.falhas.map((f, i) => (
                <li key={i}>
                  {f.nome} — {f.erro}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default DispararApresentacao;
