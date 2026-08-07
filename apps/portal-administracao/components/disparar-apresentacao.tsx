'use client';
// BOTÃO DO DISPARO (2026-08-06) — decreto do dono: nada automático; o lote da
// apresentação só sai daqui, com confirmação explícita. O resultado volta na
// tela (enviados + falhas nominais); a trava de 24h da API impede duplicado.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { dispararApresentacaoHumanizado } from '../lib/actions';

const DispararApresentacao = ({
  elegiveis,
  uf = null,
}: {
  elegiveis: number;
  /** Recorte por ESTADO (2026-08-07): null = fila inteira. */
  uf?: string | null;
}): ReactElement => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<{
    enviados: number;
    falhas: { nome: string; erro: string }[];
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const disparar = async (): Promise<void> => {
    const confirmado = window.confirm(
      `Disparar a mensagem da Layara para ${String(elegiveis)} cliente(s)${uf !== null ? ` de ${uf}` : ''} com documentação pendente e sem retorno?\n\nCada cliente recebe UMA mensagem (apresentação ou cobrança do que falta, conforme a fase); quem já recebeu template nas últimas 24h fica fora automaticamente.`,
    );
    if (!confirmado) return;
    setBusy(true);
    setErro(null);
    setResultado(null);
    try {
      const r = await dispararApresentacaoHumanizado(uf ?? undefined);
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
          : `📣 Disparar para ${String(elegiveis)} cliente(s)${uf !== null ? ` de ${uf}` : ''}`}
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
